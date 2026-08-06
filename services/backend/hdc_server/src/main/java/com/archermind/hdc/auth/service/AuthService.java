package com.archermind.hdc.auth.service;

import cn.hutool.crypto.digest.BCrypt;
import com.archermind.hdc.auth.model.AdminUser;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataAccessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
    private static final Logger LOGGER = LoggerFactory.getLogger(AuthService.class);
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9_]{3,32}$");
    private static final List<String> ROLES = Arrays.asList("ADMIN", "ENGINEER", "OPERATOR", "VIEWER");
    private static final List<String> STATUSES = Arrays.asList("ACTIVE", "DISABLED");
    private static final int SESSION_HOURS = 12;
    private static final int CODE_ACCOUNT_NOT_FOUND = 4101;
    private static final int CODE_PASSWORD_INCORRECT = 4102;
    private static final int CODE_ACCOUNT_DISABLED = 4103;
    private static final int CODE_AUTH_CONFIG = 4105;
    private static final int CODE_SCOPE_DENIED = 4106;
    private static final String USER_COLUMNS = "id,username,password_hash,display_name,role,status,source_app,stage_code,last_login_at,created_at";

    private final JdbcTemplate jdbcTemplate;

    @Value("${factory.auth.demo-seed-enabled:true}")
    private boolean demoSeedEnabled = true;

    public AuthService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void initializeDefaultAdministrator() {
        try {
            ensureAuthSchema();
            if (!demoSeedEnabled) return;
            for (DemoAccount account : demoAccounts()) upsertDemoAccount(account);
        } catch (DataAccessException exception) {
            LOGGER.warn("auth demo seed skipped because database is unavailable or schema is invalid: {}",
                    exception.getMessage());
        }
    }

    public AdminUser register(String username, String password, String displayName) {
        String normalized = username == null ? "" : username.trim();
        validateCredentials(normalized, password);
        String name = displayName == null || displayName.trim().isEmpty() ? normalized : displayName.trim();
        if (name.length() > 50) throw new IllegalArgumentException("姓名不能超过50个字符");
        try {
            jdbcTemplate.update("insert into admin_user(username,password_hash,display_name,role,status,source_app,stage_code) values(?,?,?,?,?,?,?)",
                    normalized, BCrypt.hashpw(password, BCrypt.gensalt()), name, "VIEWER", "ACTIVE", "ADMIN", null);
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("用户名已存在");
        }
        return findByUsername(normalized);
    }

    public Map<String, Object> login(String username, String password) {
        String normalized = username == null ? "" : username.trim();
        AdminUser user = findByUsername(normalized);
        if (user == null) throw new AuthFailureException(CODE_ACCOUNT_NOT_FOUND, "账号不存在");
        if (!"ACTIVE".equals(user.getStatus())) throw new AuthFailureException(CODE_ACCOUNT_DISABLED, "账号已停用，请联系管理员");
        if (password == null || !matchesPassword(password, user.getPasswordHash())) {
            throw new AuthFailureException(CODE_PASSWORD_INCORRECT, "密码错误");
        }

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
                "select u.id,u.username,u.password_hash,u.display_name,u.role,u.status,u.source_app,u.stage_code,u.last_login_at,u.created_at "
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

    public Map<String, Object> introspect(String authorization, String sourceApp, String lineId,
                                          String stageCode, String deviceCode, String traceCode) {
        AdminUser user = authenticate(authorization);
        String source = normalizeSourceApp(sourceApp);
        String requestedStage = scopedStage(user, source, stageCode);
        Map<String, Object> scope = new LinkedHashMap<>();
        scope.put("lineId", lineId == null || lineId.trim().isEmpty() ? "LINE-01" : lineId.trim());
        scope.put("sourceApp", source);
        scope.put("stageCode", requestedStage);
        scope.put("deviceCode", emptyToNull(deviceCode));
        scope.put("traceCode", emptyToNull(traceCode));
        scope.put("readOnly", "VIEWER".equals(user.getRole()) || "DISPLAY".equals(source));
        scope.put("canControl", !"VIEWER".equals(user.getRole()) && !"DISPLAY".equals(source));
        scope.put("canReviewKnowledge", "ADMIN".equals(user.getRole()) || "ENGINEER".equals(user.getRole()));
        scope.put("canSubmitKnowledge", "ADMIN".equals(user.getRole()) || "ENGINEER".equals(user.getRole()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("active", true);
        result.put("userId", String.valueOf(user.getId()));
        result.put("username", user.getUsername());
        result.put("displayName", user.getDisplayName());
        result.put("role", user.getRole());
        result.put("status", user.getStatus());
        result.put("sourceApp", user.getSourceApp());
        result.put("stageCode", user.getStageCode());
        result.put("scope", scope);
        return result;
    }

    public List<AdminUser> listUsers() {
        return jdbcTemplate.query("select " + USER_COLUMNS + " "
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
        List<AdminUser> users = jdbcTemplate.query("select " + USER_COLUMNS + " "
                + "from admin_user where username=?", new Object[]{username}, (rs, rowNum) -> mapUser(rs));
        return users.isEmpty() ? null : users.get(0);
    }

    private AdminUser findById(long id) {
        List<AdminUser> users = jdbcTemplate.query("select " + USER_COLUMNS + " "
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
        user.setSourceApp(rs.getString("source_app"));
        user.setStageCode(rs.getString("stage_code"));
        Timestamp lastLogin = rs.getTimestamp("last_login_at");
        user.setLastLoginAt(lastLogin == null ? null : lastLogin.toLocalDateTime());
        user.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
        return user;
    }

    private void ensureAuthSchema() {
        ensureColumn("admin_user", "source_app",
                "ALTER TABLE admin_user ADD COLUMN source_app VARCHAR(30) NOT NULL DEFAULT 'ADMIN' AFTER status");
        ensureColumn("admin_user", "stage_code",
                "ALTER TABLE admin_user ADD COLUMN stage_code VARCHAR(80) NULL AFTER source_app");
    }

    private void ensureColumn(String tableName, String columnName, String ddl) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns where table_schema=database() "
                        + "and table_name=? and column_name=?",
                new Object[]{tableName, columnName}, Integer.class);
        if (count == null || count == 0) jdbcTemplate.execute(ddl);
    }

    private void upsertDemoAccount(DemoAccount account) {
        jdbcTemplate.update("insert into admin_user(username,password_hash,display_name,role,status,source_app,stage_code) "
                        + "values(?,?,?,?,?,?,?) on duplicate key update "
                        + "password_hash=values(password_hash),display_name=values(display_name),role=values(role),"
                        + "status=values(status),source_app=values(source_app),stage_code=values(stage_code)",
                account.username, BCrypt.hashpw(account.password, BCrypt.gensalt()), account.displayName,
                account.role, "ACTIVE", account.sourceApp, account.stageCode);
    }

    static List<DemoAccount> demoAccounts() {
        return Arrays.asList(
                new DemoAccount("admin", "admin123", "系统管理员", "ADMIN", "ADMIN", null),
                new DemoAccount("engineer", "engineer123", "工艺工程师", "ENGINEER", "ADMIN", null),
                new DemoAccount("station_pretreatment", "station123", "瓶体预处理工位", "OPERATOR", "WORKSTATION", "PRETREATMENT"),
                new DemoAccount("station_gas", "station123", "气体安全检测工位", "OPERATOR", "WORKSTATION", "GAS_INSPECTION"),
                new DemoAccount("station_appearance", "station123", "瓶体外观检测工位", "OPERATOR", "WORKSTATION", "APPEARANCE_INSPECTION"),
                new DemoAccount("station_beverage", "station123", "饮料调配杀菌工位", "OPERATOR", "WORKSTATION", "BEVERAGE_READY"),
                new DemoAccount("station_filling", "station123", "饮料灌装工位", "OPERATOR", "WORKSTATION", "FILLING"),
                new DemoAccount("station_secondary", "station123", "灌装后二次检测工位", "OPERATOR", "WORKSTATION", "SECONDARY_INSPECTION"),
                new DemoAccount("station_packing", "station123", "机械臂装箱工位", "OPERATOR", "WORKSTATION", "PACKING"),
                new DemoAccount("station_agv", "station123", "AGV运输工位", "OPERATOR", "WORKSTATION", "AGV_TRANSPORT"),
                new DemoAccount("station_warehouse", "station123", "仓储入库工位", "OPERATOR", "WORKSTATION", "WAREHOUSE_INBOUND"));
    }

    private String normalizeToken(String authorization) {
        if (authorization == null || authorization.trim().isEmpty()) return null;
        String value = authorization.trim();
        return value.regionMatches(true, 0, "Bearer ", 0, 7) ? value.substring(7).trim() : value;
    }

    private String normalizeSourceApp(String value) {
        String source = value == null ? "ADMIN" : value.trim().toUpperCase();
        if (!Arrays.asList("DISPLAY", "WORKSTATION", "ADMIN").contains(source)) {
            throw new IllegalArgumentException("sourceApp must be DISPLAY, WORKSTATION or ADMIN");
        }
        return source;
    }

    private String scopedStage(AdminUser user, String sourceApp, String stageCode) {
        String requested = emptyToNull(stageCode);
        String bound = emptyToNull(user.getStageCode());
        if (bound != null) bound = bound.toUpperCase();
        if ("WORKSTATION".equals(user.getSourceApp()) && !"WORKSTATION".equals(sourceApp)) {
            throw new AuthFailureException(CODE_SCOPE_DENIED, "工位账号只能以 WORKSTATION 来源访问");
        }
        if (!"WORKSTATION".equals(sourceApp)) return requested;
        if (requested == null) requested = bound;
        if (requested == null) {
            throw new AuthFailureException(CODE_AUTH_CONFIG, "WORKSTATION 账号未绑定 stageCode");
        }
        requested = requested.trim().toUpperCase();
        if (bound != null && !bound.equals(requested)) {
            throw new AuthFailureException(CODE_SCOPE_DENIED, "工位账号不能访问未绑定工位");
        }
        return requested;
    }

    private String emptyToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private boolean matchesPassword(String password, String passwordHash) {
        try {
            return passwordHash != null && BCrypt.checkpw(password, passwordHash);
        } catch (RuntimeException exception) {
            throw new AuthFailureException(CODE_AUTH_CONFIG, "账号密码哈希配置异常");
        }
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

    public static class AuthFailureException extends RuntimeException {
        private final int code;

        public AuthFailureException(int code, String message) {
            super(message);
            this.code = code;
        }

        public int getCode() {
            return code;
        }
    }

    static class DemoAccount {
        final String username;
        final String password;
        final String displayName;
        final String role;
        final String sourceApp;
        final String stageCode;

        DemoAccount(String username, String password, String displayName, String role, String sourceApp, String stageCode) {
            this.username = username;
            this.password = password;
            this.displayName = displayName;
            this.role = role;
            this.sourceApp = sourceApp;
            this.stageCode = stageCode;
        }
    }
}
