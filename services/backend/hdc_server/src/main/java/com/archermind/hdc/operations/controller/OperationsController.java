package com.archermind.hdc.operations.controller;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.auth.model.AdminUser;
import com.archermind.hdc.operations.dto.AiDecisionRequest;
import com.archermind.hdc.operations.dto.AiDecisionResponse;
import com.archermind.hdc.operations.dto.CommandAckRequest;
import com.archermind.hdc.operations.dto.DeviceCommandRequest;
import com.archermind.hdc.operations.dto.OperationsOverview;
import com.archermind.hdc.operations.dto.SensorReadingRequest;
import com.archermind.hdc.operations.model.AiAuditRecord;
import com.archermind.hdc.operations.model.AlarmRecord;
import com.archermind.hdc.operations.model.DeviceCommand;
import com.archermind.hdc.operations.model.SensorReading;
import com.archermind.hdc.operations.service.OperationsService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import javax.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/operations")
public class OperationsController {
    private final OperationsService service;

    public OperationsController(OperationsService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public Result<OperationsOverview> overview() {
        return Result.success(service.overview());
    }

    @PostMapping("/sensors/readings")
    public Result<SensorReading> recordSensor(@RequestBody SensorReadingRequest request) {
        return call(() -> service.recordSensor(request));
    }

    @GetMapping("/sensors/latest")
    public Result<List<SensorReading>> latest(
            @RequestParam(required = false) String deviceCode) {
        return Result.success(service.latestReadings(deviceCode));
    }

    @GetMapping("/alarms")
    public Result<List<AlarmRecord>> alarms(@RequestParam(required = false) String status) {
        return Result.success(service.alarms(status));
    }

    @PostMapping("/alarms/{alarmId}/ack")
    public Result<AlarmRecord> acknowledgeAlarm(@PathVariable String alarmId) {
        return call(() -> service.acknowledgeAlarm(alarmId));
    }

    @PostMapping("/commands")
    public Result<DeviceCommand> createCommand(@RequestBody DeviceCommandRequest request,
                                               HttpServletRequest servletRequest) {
        Object authenticated = servletRequest.getAttribute("authUser");
        if (authenticated instanceof AdminUser) {
            AdminUser user = (AdminUser) authenticated;
            request.setOperator(user.getUsername());
            request.setOperatorRole(user.getRole());
        }
        return call(() -> service.createCommand(request));
    }

    @GetMapping("/commands")
    public Result<List<DeviceCommand>> commands(@RequestParam(required = false) String status) {
        return Result.success(service.commands(status));
    }

    @PostMapping("/commands/{commandId}/ack")
    public Result<DeviceCommand> acknowledgeCommand(@PathVariable String commandId,
                                                     @RequestBody CommandAckRequest request) {
        return call(() -> service.acknowledgeCommand(commandId, request));
    }

    @PostMapping("/ai/decide")
    public Result<AiDecisionResponse> decide(@RequestBody AiDecisionRequest request) {
        return call(() -> service.decide(request));
    }

    @GetMapping("/ai/audits")
    public Result<List<AiAuditRecord>> aiAudits() {
        return Result.success(service.aiAudits());
    }

    @DeleteMapping
    public Result reset() {
        service.reset();
        return Result.success();
    }

    private <T> Result<T> call(Action<T> action) {
        try {
            return Result.success(action.run());
        } catch (RuntimeException exception) {
            return Result.message(exception.getMessage());
        }
    }

    private interface Action<T> {
        T run();
    }
}
