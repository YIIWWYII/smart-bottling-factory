package com.archermind.hdc.auth.service;

import cn.hutool.crypto.digest.BCrypt;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.auth.controller.AuthController;
import com.archermind.hdc.auth.model.AdminUser;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthServiceTest {
    @Test
    void adminDemoPasswordCanLogin() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AdminUser admin = user(1L, "admin", "ADMIN", "ADMIN", null);
        admin.setPasswordHash(BCrypt.hashpw("admin123", BCrypt.gensalt()));
        when(jdbc.query(anyString(), any(Object[].class), any(org.springframework.jdbc.core.RowMapper.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0);
                    Object[] args = invocation.getArgument(1);
                    if (sql.contains("where username=?") && "admin".equals(args[0])) {
                        return Collections.singletonList(admin);
                    }
                    if (sql.contains("where id=?") && Long.valueOf(1L).equals(args[0])) {
                        return Collections.singletonList(admin);
                    }
                    return Collections.emptyList();
                });

        Map<String, Object> response = new AuthService(jdbc).login("admin", "admin123");

        assertNotNull(response.get("token"));
        assertEquals("admin", ((AdminUser) response.get("user")).getUsername());
    }

    @Test
    void loginFailuresReturnDistinctCodes() {
        AuthController controller = new AuthController(mock(AuthService.class));
        AuthController.LoginRequest request = new AuthController.LoginRequest();
        request.setUsername("missing");
        request.setPassword("admin123");

        AuthService auth = mock(AuthService.class);
        when(auth.login(eq("missing"), eq("admin123")))
                .thenThrow(new AuthService.AuthFailureException(4101, "账号不存在"));
        controller = new AuthController(auth);
        Result<Map<String, Object>> missing = controller.login(request);

        when(auth.login(eq("missing"), eq("admin123")))
                .thenThrow(new AuthService.AuthFailureException(4102, "密码错误"));
        Result<Map<String, Object>> wrongPassword = controller.login(request);

        when(auth.login(eq("missing"), eq("admin123")))
                .thenThrow(new AuthService.AuthFailureException(4103, "账号已停用，请联系管理员"));
        Result<Map<String, Object>> disabled = controller.login(request);

        when(auth.login(eq("missing"), eq("admin123")))
                .thenThrow(new DataAccessResourceFailureException("connection refused"));
        Result<Map<String, Object>> databaseDown = controller.login(request);

        assertEquals(4101, missing.getCode());
        assertEquals(4102, wrongPassword.getCode());
        assertEquals(4103, disabled.getCode());
        assertEquals(4104, databaseDown.getCode());
    }

    @Test
    void workstationAccountScopeIsBoundToItsStage() {
        BoundAuthService service = new BoundAuthService(user(7L, "station_filling", "OPERATOR", "WORKSTATION", "FILLING"));

        Map<String, Object> introspect = service.introspect("Bearer test-token", "WORKSTATION", "LINE-01",
                null, null, null);
        Map<?, ?> scope = (Map<?, ?>) introspect.get("scope");

        assertEquals("FILLING", scope.get("stageCode"));
        assertThrows(AuthService.AuthFailureException.class,
                () -> service.introspect("Bearer test-token", "WORKSTATION", "LINE-01",
                        "GAS_INSPECTION", null, null));
    }

    @Test
    void demoAccountsIncludeEveryWorkstationStage() {
        List<AuthService.DemoAccount> accounts = AuthService.demoAccounts();

        assertEquals(11, accounts.size());
        assertEquals(9, accounts.stream().filter(account -> "WORKSTATION".equals(account.sourceApp)).count());
        assertEquals(1, accounts.stream()
                .filter(account -> "admin".equals(account.username) && "admin123".equals(account.password))
                .count());
    }

    private static AdminUser user(Long id, String username, String role, String sourceApp, String stageCode) {
        AdminUser user = new AdminUser();
        user.setId(id);
        user.setUsername(username);
        user.setDisplayName(username);
        user.setRole(role);
        user.setStatus("ACTIVE");
        user.setSourceApp(sourceApp);
        user.setStageCode(stageCode);
        user.setCreatedAt(LocalDateTime.now());
        return user;
    }

    private static class BoundAuthService extends AuthService {
        private final AdminUser user;

        BoundAuthService(AdminUser user) {
            super(mock(JdbcTemplate.class));
            this.user = user;
        }

        @Override
        public AdminUser authenticate(String authorization) {
            return user;
        }
    }
}
