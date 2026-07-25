package com.archermind.hdc.auth.filter;

import com.archermind.hdc.auth.model.AdminUser;
import com.archermind.hdc.auth.service.AuthService;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ManagementAuthFilter extends OncePerRequestFilter {
    private final AuthService authService;

    public ManagementAuthFilter(AuthService authService) {
        this.authService = authService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod()) || !requiresAuthentication(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            AdminUser user = authService.authenticate(request.getHeader("Authorization"));
            if (requiresAdministrator(request) && !"ADMIN".equals(user.getRole())) {
                writeError(response, HttpServletResponse.SC_FORBIDDEN, 2003, "需要系统管理员权限");
                return;
            }
            if (requiresOperator(request) && "VIEWER".equals(user.getRole())) {
                writeError(response, HttpServletResponse.SC_FORBIDDEN, 2003, "当前账号为只读用户，无控制权限");
                return;
            }
            request.setAttribute("authUser", user);
            filterChain.doFilter(request, response);
        } catch (SecurityException exception) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, 2004, exception.getMessage());
        }
    }

    private boolean requiresAuthentication(HttpServletRequest request) {
        String path = request.getServletPath();
        if (path.startsWith("/auth/")) return !path.equals("/auth/login") && !path.equals("/auth/register");
        return isProtectedMutation(request);
    }

    private boolean requiresAdministrator(HttpServletRequest request) {
        return request.getServletPath().startsWith("/auth/users");
    }

    private boolean requiresOperator(HttpServletRequest request) {
        return isProtectedMutation(request);
    }

    private boolean isProtectedMutation(HttpServletRequest request) {
        String path = request.getServletPath();
        String method = request.getMethod();
        if ("GET".equalsIgnoreCase(method)) return false;
        if (path.equals("/factory/runs") || path.equals("/factory/runs/scenario") || path.matches("/factory/runs/[^/]+/steps")) return true;
        if (path.matches("/factory/runs/[^/]+/disposition") || path.equals("/factory/runtime/incidents")
                || path.matches("/factory/runtime/incidents/[^/]+/resolve")) return true;
        if (path.matches("/operations/alarms/[^/]+/ack") || path.equals("/operations/commands") || path.equals("/operations/ai/decide")) return true;
        return path.equals("/logistics/agv/tasks") || path.equals("/logistics/warehouse/inbound");
    }

    private void writeError(HttpServletResponse response, int status, int code, String message) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        String safeMessage = message == null ? "认证失败" : message.replace("\\", "\\\\").replace("\"", "\\\"");
        response.getWriter().write("{\"code\":" + code + ",\"message\":\"" + safeMessage + "\",\"data\":null}");
    }
}
