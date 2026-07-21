package com.archermind.hdc.factory.runtime.controller;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.factory.runtime.dto.DeviceTelemetryRequest;
import com.archermind.hdc.factory.runtime.dto.FactoryRuntimeSnapshot;
import com.archermind.hdc.factory.runtime.dto.IncidentRequest;
import com.archermind.hdc.factory.runtime.dto.IncidentResolutionRequest;
import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.model.FactoryIncident;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.factory.dto.FactoryDispositionRequest;
import com.archermind.hdc.factory.service.FactoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/factory/runtime")
public class FactoryRuntimeController {
    private final FactoryRuntimeService service;
    private final FactoryService factoryService;

    public FactoryRuntimeController(FactoryRuntimeService service, FactoryService factoryService) {
        this.service = service;
        this.factoryService = factoryService;
    }

    @GetMapping
    public Result<FactoryRuntimeSnapshot> snapshot(@RequestParam(required = false) String stageCode) {
        return Result.success(service.snapshot(stageCode));
    }

    @PostMapping("/telemetry")
    public Result<DeviceRuntimeState> telemetry(@RequestBody DeviceTelemetryRequest request) {
        return call(() -> service.recordTelemetry(request));
    }

    @GetMapping("/incidents")
    public Result<List<FactoryIncident>> incidents(@RequestParam(required = false) String status,
                                                   @RequestParam(required = false) String stageCode) {
        return Result.success(service.incidents(status, stageCode));
    }

    @PostMapping("/incidents")
    public Result<FactoryIncident> report(@RequestBody IncidentRequest request) {
        return call(() -> service.reportIncident(request));
    }

    @PostMapping("/incidents/{incidentId}/resolve")
    public Result<FactoryIncident> resolve(@PathVariable String incidentId,
                                           @RequestBody(required = false) IncidentResolutionRequest request) {
        return call(() -> {
            FactoryIncident incident = service.findIncident(incidentId);
            if (incident.getTraceCode() != null && request != null && request.getAction() != null) {
                FactoryDispositionRequest disposition = new FactoryDispositionRequest();
                disposition.setAction(request.getAction());
                disposition.setTargetStage(request.getTargetStage());
                disposition.setIncidentId(incidentId);
                disposition.setNote(request.getNote());
                factoryService.disposition(incident.getTraceCode(), disposition);
            }
            return service.resolve(incidentId, request);
        });
    }

    private <T> Result<T> call(Action<T> action) {
        try { return Result.success(action.run()); }
        catch (RuntimeException exception) { return Result.message(exception.getMessage()); }
    }

    private interface Action<T> { T run(); }
}
