package com.archermind.hdc.logistics.controller;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.logistics.dto.*;
import com.archermind.hdc.logistics.model.AgvTask;
import com.archermind.hdc.logistics.model.WarehouseStock;
import com.archermind.hdc.logistics.model.WarehouseZone;
import com.archermind.hdc.logistics.service.LogisticsService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/logistics")
public class LogisticsController {
    private final LogisticsService service;
    public LogisticsController(LogisticsService service) { this.service = service; }

    @GetMapping("/overview")
    public Result<LogisticsOverview> overview() { return Result.success(service.overview()); }

    @PostMapping("/agv/tasks")
    public Result<AgvTask> createTask(@RequestBody AgvTaskRequest request) { return call(() -> service.createTask(request)); }

    @PostMapping("/agv/tasks/{taskId}/telemetry")
    public Result<AgvTask> telemetry(@PathVariable String taskId, @RequestBody AgvTelemetryRequest request) {
        return call(() -> service.telemetry(taskId, request));
    }

    @PostMapping("/warehouse/zones/{zoneCode}/telemetry")
    public Result<WarehouseZone> zone(@PathVariable String zoneCode, @RequestBody WarehouseTelemetryRequest request) {
        return call(() -> service.warehouseTelemetry(zoneCode, request));
    }

    @PostMapping("/warehouse/inbound")
    public Result<WarehouseStock> inbound(@RequestBody WarehouseInboundRequest request) { return call(() -> service.inbound(request)); }

    private <T> Result<T> call(Action<T> action) {
        try { return Result.success(action.run()); }
        catch (RuntimeException exception) { return Result.message(exception.getMessage()); }
    }
    private interface Action<T> { T run(); }
}
