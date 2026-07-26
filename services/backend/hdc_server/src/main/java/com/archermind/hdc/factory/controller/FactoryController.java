package com.archermind.hdc.factory.controller;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.factory.dto.FactoryDashboard;
import com.archermind.hdc.factory.dto.FactoryDispositionRequest;
import com.archermind.hdc.factory.dto.FactoryStartRequest;
import com.archermind.hdc.factory.dto.FactoryStepRequest;
import com.archermind.hdc.factory.model.FactoryRun;
import com.archermind.hdc.factory.service.FactoryService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/factory")
public class FactoryController {
    private final FactoryService factoryService;

    public FactoryController(FactoryService factoryService) {
        this.factoryService = factoryService;
    }

    @GetMapping("/health")
    public Result<Map<String, Object>> health() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("status", "UP");
        data.put("mode", "SIMULATION");
        data.put("service", "factory-core");
        return Result.success(data);
    }

    @GetMapping("/dashboard")
    public Result<FactoryDashboard> dashboard() {
        return Result.success(factoryService.dashboard());
    }

    @GetMapping("/runs/{traceCode}")
    public Result<FactoryRun> find(@PathVariable String traceCode) {
        try {
            return Result.success(factoryService.find(traceCode));
        } catch (RuntimeException exception) {
            return Result.message(exception.getMessage());
        }
    }

    @PostMapping("/runs")
    public Result<FactoryRun> start(@RequestBody(required = false) FactoryStartRequest request) {
        try {
            return Result.success(factoryService.start(request));
        } catch (RuntimeException exception) {
            return Result.message(exception.getMessage());
        }
    }

    @PostMapping("/runs/scenario")
    public Result<FactoryRun> runScenario(@RequestBody(required = false) FactoryStartRequest request) {
        try {
            return Result.success(factoryService.runScenario(request));
        } catch (RuntimeException exception) {
            return Result.message(exception.getMessage());
        }
    }

    @PostMapping("/runs/{traceCode}/steps")
    public Result<FactoryRun> step(@PathVariable String traceCode,
                                   @RequestBody FactoryStepRequest request) {
        try {
            return Result.success(factoryService.step(traceCode, request));
        } catch (RuntimeException exception) {
            return Result.message(exception.getMessage());
        }
    }

    @PostMapping("/runs/{traceCode}/disposition")
    public Result<FactoryRun> disposition(@PathVariable String traceCode,
                                          @RequestBody FactoryDispositionRequest request) {
        try {
            return Result.success(factoryService.disposition(traceCode, request));
        } catch (RuntimeException exception) {
            return Result.message(exception.getMessage());
        }
    }

    @DeleteMapping("/runs")
    public Result reset() {
        factoryService.reset();
        return Result.success();
    }
}
