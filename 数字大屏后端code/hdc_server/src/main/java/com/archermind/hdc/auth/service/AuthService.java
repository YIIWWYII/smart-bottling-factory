package com.archermind.hdc.auth.service;

import cn.hutool.crypto.digest.BCrypt;
import com.archermind.hdc.auth.model.AdminUser;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AuthService {
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9_]{3,32}$");
    private static final List<String> ROLES = Arrays.asList("ADMIN", "OPERATOR", "VIEWER");
    private static final List<String> STATUSES = Arrays.asList("ACTIVE", "DISABLED");
    private static final int SESSION_HOURS = 12;

    private final JdbcTemplate jdbcTemplate;

    public AuthService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void initializeDefaultAdministrator() {
        Integer count = jdbcTemplate.queryForObject("select count(*) from admin_user", Integer.class);
        if (count != null && count == 0) {
            jdbcTemplate.update("insert into admin_user(username,password_hash,display_name,role,status) values(?,?,?,?,?)",
                    "admin", BCrypt.hashpw("Admin@123456", BCrypt.gensalt()), "系统管理员", "ADMIN", "ACTIVE");
        }
    }

    public AdminUser register(String username, String password, String displayName) {
        String normalized = username == null ? "" : username.trim();
        validateCredentials(normalized, password);
        String name = displayName == null || displayName.trim().isEmpty() ? normalized : displayName.trim();
        if (name.length() > 50) throw new IllegalArgumentException("姓名不能超过50个字符");
        try {
            jdbcTemplate.update("insert into admin_user(username,password_hash,display_name,role,status) values(?,?,?,?,?)",
                    normalized, BCrypt.hashpw(password, BCrypt.gensalt()), name, "VIEWER", "ACTIVE");
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("用户名已存在");
        }
        return findByUsername(normalized);
    }

    public Map<String, Object> login(String username, String password) {
        String normalized = username == null ? "" : username.trim();
        AdminUser user = findByUsername(normalized);
        if (user == null || password == null || !BCrypt.checkpw(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("用户名或密码错误");
        }
        if (!"ACTIVE".equals(user.getStatus())) throw new IllegalStateException("账号已停用，请联系管理员");

        jdbcTemplate.update("delete from admin_session where expires_at <= now(6)");
        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        LocalDateTime expiresAt = LocalDateTime.now().plusHours(SESSION_HOURS);
        jdbcTemplate.update("insert into admin_session(token_hash,user_id,expires_at) values(?,?,?)",
                sha256(token), user.getId(), Timestamp.valueOf(expiresAt));
        jdbcTemplate.update("update admin_user set last_login_at=now(6) where id=?", user.getId());
        user = findById(user.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token", token);
        result.put("expiresAt", expiresAt);
        result.put("user", user);
        return result;
    }

    public AdminUser authenticate(String authorization) {
        String token = normalizeToken(authorization);
        if (token == null) throw new SecurityException("请先登录");
        List<AdminUser> users = jdbcTemplate.query(
                "select u.id,u.username,u.password_hash,u.display_name,u.role,u.status,u.last_login_at,u.created_at "
                        + "from admin_session s join admin_user u on u.id=s.user_id "
                        + "where s.token_hash=? and s.expires_at>now(6)",
                new Object[]{sha256(token)}, (rs, rowNum) -> mapUser(rs));
        if (users.isEmpty()) throw new SecurityException("登录已过期，请重新登录");
        AdminUser user = users.get(0);
        if (!"ACTIVE".equals(user.getStatus())) throw new SecurityException("账号已停用");
        return user;
    }

    public void logout(String authorization) {
        String token = normalizeToken(authorization);
        if (token != null) jdbcTemplate.update("delete from admin_session where token_hash=?", sha256(token));
    }

    public List<AdminUser> listUsers() {
        return jdbcTemplate.query("select id,username,password_hash,display_name,role,status,last_login_at,created_at "
                + "from admin_user order by created_at desc", (rs, rowNum) -> mapUser(rs));
    }

    public AdminUser updateUser(long id, String role, String status, long operatorId) {
        if (!ROLES.contains(role)) throw new IllegalArgumentException("无效角色");
        if (!STATUSES.contains(status)) throw new IllegalArgumentException("无效账号状态");
        if (id == operatorId && (!"ADMIN".equals(role) || !"ACTIVE".equals(status))) {
            throw new IllegalArgumentException("不能降低或停用当前登录管理员账号");
        }
        int changed = jdbcTemplate.update("update admin_user set role=?,status=? where id=?", role, status, id);
        if (changed == 0) throw new IllegalArgumentException("用户不存在");
        if ("DISABLED".equals(status)) jdbcTemplate.update("delete from admin_session where user_id=?", id);
        return findById(id);
    }

    private void validateCredentials(String username, String password) {
        if (!USERNAME.matcher(username).matches()) throw new IllegalArgumentException("用户名需为3-32位字母、数字或下划线");
        if (password == null || password.length() < 8 || password.length() > 72) throw new IllegalArgumentException("密码长度需为8-72位");
    }

    private AdminUser findByUsername(String username) {
        List<AdminUser> users = jdbcTemplate.query("select id,username,password_hash,display_name,role,status,last_login_at,created_at "
                + "from admin_user where username=?", new Object[]{username}, (rs, rowNum) -> mapUser(rs));
        return users.isEmpty() ? null : users.get(0);
    }

    private AdminUser findById(long id) {
        List<AdminUser> users = jdbcTemplate.query("select id,username,password_hash,display_name,role,status,last_login_at,created_at "
                + "from admin_user where id=?", new Object[]{id}, (rs, rowNum) -> mapUser(rs));
        return users.isEmpty() ? null : users.get(0);
    }

    private AdminUser mapUser(java.sql.ResultSet rs) throws java.sql.SQLException {
        AdminUser user = new AdminUser();
        user.setId(rs.getLong("id"));
        user.setUsername(rs.getString("username"));
        user.setPasswordHash(rs.getString("password_hash"));
        user.setDisplayName(rs.getString("display_name"));
        user.setRole(rs.getString("role"));
        user.setStatus(rs.getString("status"));
        Timestamp lastLogin = rs.getTimestamp("last_login_at");
        user.setLastLoginAt(lastLogin == null ? null : lastLogin.toLocalDateTime());
        user.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
        return user;
    }

    private String normalizeToken(String authorization) {
        if (authorization == null || authorization.trim().isEmpty()) return null;
        String value = authorization.trim();
        return value.regionMatches(true, 0, "Bearer ", 0, 7) ? value.substring(7).trim() : value;
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte item : digest) result.append(String.format("%02x", item));
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
