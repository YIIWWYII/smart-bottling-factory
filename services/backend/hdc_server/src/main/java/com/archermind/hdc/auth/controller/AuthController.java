package com.archermind.hdc.auth.controller;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.auth.model.AdminUser;
import com.archermind.hdc.auth.service.AuthService;
import lombok.Data;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public Result<AdminUser> register(@Valid @RequestBody RegisterRequest request) {
        return call(() -> authService.register(request.getUsername(), request.getPassword(), request.getDisplayName()));
    }

    @PostMapping("/login")
    public Result<Map<String, Object>> login(@Valid @RequestBody LoginRequest request) {
        return call(() -> authService.login(request.getUsername(), request.getPassword()));
    }

    @GetMapping("/me")
    public Result<AdminUser> current(HttpServletRequest request) {
        return Result.success((AdminUser) request.getAttribute("authUser"));
    }

    @PostMapping("/logout")
    public Result logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        authService.logout(authorization);
        return Result.success();
    }

    @GetMapping("/users")
    public Result<List<AdminUser>> users() {
        return Result.success(authService.listUsers());
    }

    @PatchMapping("/users/{id}")
    public Result<AdminUser> update(@PathVariable long id, @Valid @RequestBody UpdateUserRequest update,
                                    HttpServletRequest request) {
        AdminUser operator = (AdminUser) request.getAttribute("authUser");
        return call(() -> authService.updateUser(id, update.getRole(), update.getStatus(), operator.getId()));
    }

    private <T> Result<T> call(Action<T> action) {
        try { return Result.success(action.run()); }
        catch (RuntimeException exception) { return Result.message(exception.getMessage()); }
    }

    private interface Action<T> { T run(); }

    @Data
    public static class LoginRequest {
        @NotBlank private String username;
        @NotBlank private String password;
    }

    @Data
    public static class RegisterRequest {
        @NotBlank private String username;
        @NotBlank private String password;
        private String displayName;
    }

    @Data
    public static class UpdateUserRequest {
        @NotBlank private String role;
        @NotBlank private String status;
    }
}
