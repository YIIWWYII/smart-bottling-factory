package com.archermind.hdc.factory.contract;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.auth.model.AdminUser;
import com.archermind.hdc.factory.snapshot.LineSnapshot;
import com.archermind.hdc.factory.snapshot.StageSnapshot;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
public class FactoryContractController {
    private final FactoryContractService service;

    public FactoryContractController(FactoryContractService service) {
        this.service = service;
    }

    @GetMapping("/factory/topology")
    public Result<Map<String, Object>> topology() { return Result.success(service.topology()); }

    @GetMapping("/factory/line-snapshot")
    public Result<LineSnapshot> lineSnapshot() { return Result.success(service.lineSnapshot()); }

    @GetMapping("/factory/stages/{stageCode}/snapshot")
    public Result<StageSnapshot> stageSnapshot(@PathVariable String stageCode) {
        return call(() -> service.stageSnapshot(stageCode));
    }

    @GetMapping("/factory/stages/{stageCode}/capabilities")
    public Result<List<Map<String, Object>>> stageCapabilities(@PathVariable String stageCode) {
        return call(() -> service.stageCapabilities(stageCode));
    }

    @GetMapping("/devices/{deviceCode}/capabilities")
    public Result<Map<String, Object>> deviceCapabilities(@PathVariable String deviceCode) {
        return call(() -> service.deviceCapability(deviceCode));
    }

    @GetMapping("/devices/{deviceCode}/parameters")
    public Result<Map<String, Object>> deviceParameters(@PathVariable String deviceCode) {
        return call(() -> service.deviceParameters(deviceCode));
    }

    @GetMapping("/production/orders")
    public Result<List<Map<String, Object>>> orders() { return Result.success(service.orders()); }

    @PostMapping("/production/orders")
    public Result<Map<String, Object>> createOrder(@RequestBody Map<String, Object> request,
                                                   HttpServletRequest servletRequest) {
        return call(() -> service.saveOrder(request, operator(servletRequest)));
    }

    @GetMapping("/production/orders/{id}")
    public Result<Map<String, Object>> order(@PathVariable String id) {
        return call(() -> service.orders().stream().filter(item -> id.equals(item.get("id"))).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("production order not found: " + id)));
    }

    @PatchMapping("/production/orders/{id}")
    public Result<Map<String, Object>> updateOrder(@PathVariable String id,
                                                   @RequestBody Map<String, Object> request,
                                                   HttpServletRequest servletRequest) {
        return call(() -> service.updateOrder(id, request, operator(servletRequest)));
    }

    @GetMapping("/quality/gates")
    public Result<List<Map<String, Object>>> qualityGates() { return Result.success(service.qualityGates()); }

    @GetMapping("/quality/rules")
    public Result<List<Map<String, Object>>> qualityRules() { return Result.success(service.configurations("QUALITY_RULE")); }

    @PostMapping("/quality/rules")
    public Result<Map<String, Object>> createQualityRule(@RequestBody Map<String, Object> request,
                                                         HttpServletRequest servletRequest) {
        return call(() -> service.saveConfiguration("QUALITY_RULE", request, operator(servletRequest)));
    }

    @GetMapping("/config/recipes")
    public Result<List<Map<String, Object>>> recipes() { return Result.success(service.configurations("RECIPE")); }

    @PostMapping("/config/recipes")
    public Result<Map<String, Object>> createRecipe(@RequestBody Map<String, Object> request,
                                                    HttpServletRequest servletRequest) {
        return call(() -> service.saveConfiguration("RECIPE", request, operator(servletRequest)));
    }

    @PostMapping("/config/recipes/{id}/approve")
    public Result<Map<String, Object>> approveRecipe(@PathVariable String id, HttpServletRequest servletRequest) {
        return call(() -> service.publishConfiguration("RECIPE", id, operator(servletRequest)));
    }

    @GetMapping("/config/thresholds")
    public Result<List<Map<String, Object>>> thresholds() { return Result.success(service.configurations("THRESHOLD")); }

    @PostMapping("/config/thresholds")
    public Result<Map<String, Object>> createThreshold(@RequestBody Map<String, Object> request,
                                                       HttpServletRequest servletRequest) {
        return call(() -> service.saveConfiguration("THRESHOLD", request, operator(servletRequest)));
    }

    @PostMapping("/config/thresholds/{id}/publish")
    public Result<Map<String, Object>> publishThreshold(@PathVariable String id, HttpServletRequest servletRequest) {
        return call(() -> service.publishConfiguration("THRESHOLD", id, operator(servletRequest)));
    }

    @GetMapping("/audit/operations")
    public Result<List<Map<String, Object>>> audits() { return Result.success(service.audits()); }

    @GetMapping("/reports/production")
    public Result<Map<String, Object>> report() { return Result.success(service.report()); }

    @GetMapping("/simulation/scenarios")
    public Result<List<Map<String, Object>>> scenarios() { return Result.success(service.simulationScenarios()); }

    @PostMapping("/simulation/start")
    public Result<Object> startSimulation(@RequestBody(required = false) Map<String, Object> request) {
        return call(() -> service.simulationStart(request == null ? null : String.valueOf(request.get("scenarioCode"))));
    }

    @PostMapping("/simulation/stop")
    public Result<Object> stopSimulation() { return call(service::simulationStop); }

    @PostMapping("/simulation/reset")
    public Result<Object> resetSimulation() { return call(service::simulationReset); }

    private String operator(HttpServletRequest request) {
        Object value = request.getAttribute("authUser");
        return value instanceof AdminUser ? ((AdminUser) value).getUsername() : "SYSTEM";
    }

    private <T> Result<T> call(Action<T> action) {
        try { return Result.success(action.run()); }
        catch (RuntimeException exception) { return Result.message(exception.getMessage()); }
    }

    private interface Action<T> { T run(); }
}
