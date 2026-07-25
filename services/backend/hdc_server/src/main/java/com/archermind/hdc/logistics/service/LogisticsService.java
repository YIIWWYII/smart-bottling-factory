package com.archermind.hdc.logistics.service;

import com.archermind.hdc.logistics.dto.*;
import com.archermind.hdc.logistics.model.AgvTask;
import com.archermind.hdc.logistics.model.WarehouseStock;
import com.archermind.hdc.logistics.model.WarehouseZone;
import com.archermind.hdc.operations.dto.SensorReadingRequest;
import com.archermind.hdc.operations.service.OperationsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import javax.annotation.PostConstruct;

@Service
public class LogisticsService {
    private final Map<String, AgvTask> tasks = new ConcurrentHashMap<>();
    private final Map<String, WarehouseZone> zones = new ConcurrentHashMap<>();
    private final Map<String, WarehouseStock> stock = new ConcurrentHashMap<>();
    private final OperationsService operationsService;
    @Autowired(required = false)
    private LogisticsPersistence persistence;
    @Value("${factory.thresholds.agv-distance-min:20.0}")
    private double stopDistanceCm;

    public LogisticsService(OperationsService operationsService) {
        this.operationsService = operationsService;
    }

    @PostConstruct
    public void restore() {
        if (persistence == null || !persistence.isEnabled()) return;
        for (AgvTask value : persistence.loadTasks()) tasks.put(value.getTaskId(), value);
        for (WarehouseZone value : persistence.loadZones()) zones.put(value.getZoneCode(), value);
        for (WarehouseStock value : persistence.loadStock()) stock.put(value.getBoxCode(), value);
    }

    public AgvTask createTask(AgvTaskRequest request) {
        require(request != null, "request is required");
        requireText(request.getBoxCode(), "boxCode is required");
        require(request.getTotalDistanceM() > 0, "totalDistanceM must be greater than 0");
        AgvTask task = new AgvTask();
        task.setTaskId("AGV-TASK-" + UUID.randomUUID());
        task.setAgvCode("AGV-01");
        task.setBoxCode(request.getBoxCode().trim());
        task.setSource(normalize(request.getSource(), "PACKING"));
        task.setDestination(normalize(request.getDestination(), "WAREHOUSE"));
        task.setTotalDistanceM(request.getTotalDistanceM());
        task.setLoadKg(Math.max(0, request.getLoadKg()));
        task.setObstacleDistanceCm(999);
        task.setMode(normalize(request.getMode(), "SIMULATION").toUpperCase(Locale.ROOT));
        require("REAL".equals(task.getMode()) || "SIMULATION".equals(task.getMode()),
                "mode must be REAL or SIMULATION");
        task.setStatus("DISPATCHED");
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(task.getCreatedAt());
        tasks.put(task.getTaskId(), task);
        persist(task);
        return task;
    }

    public AgvTask telemetry(String taskId, AgvTelemetryRequest request) {
        AgvTask task = requiredTask(taskId);
        require(request != null, "request is required");
        synchronized (task) {
            task.setSpeedMps(Math.max(0, request.getSpeedMps()));
            task.setCompletedDistanceM(Math.min(task.getTotalDistanceM(), Math.max(0, request.getCompletedDistanceM())));
            task.setObstacleDistanceCm(request.getObstacleDistanceCm());
            task.setLoadKg(Math.max(0, request.getLoadKg()));
            if (request.getObstacleDistanceCm() < stopDistanceCm) {
                task.setStatus("BLOCKED");
                task.setSpeedMps(0);
            } else if (task.getCompletedDistanceM() >= task.getTotalDistanceM()) {
                task.setStatus("ARRIVED");
            } else {
                task.setStatus("RUNNING");
            }
            task.setUpdatedAt(LocalDateTime.now());
        }
        sensor(task.getAgvCode(), "AGV_DISTANCE", request.getObstacleDistanceCm(), "cm",
                "AGV_TRANSPORT", task.getMode());
        persist(task);
        return task;
    }

    public WarehouseZone warehouseTelemetry(String zoneCode, WarehouseTelemetryRequest request) {
        requireText(zoneCode, "zoneCode is required");
        require(request != null, "request is required");
        WarehouseZone zone = zones.computeIfAbsent(zoneCode.trim(), key -> new WarehouseZone());
        zone.setZoneCode(zoneCode.trim());
        zone.setVocPpm(request.getVocPpm());
        zone.setSmoke(request.getSmoke());
        zone.setTemperatureC(request.getTemperatureC());
        zone.setStatus(request.getVocPpm() > 10.0 || request.getSmoke() > 0.5 ? "ALARM" : "SAFE");
        zone.setUpdatedAt(LocalDateTime.now());
        sensor("WAREHOUSE-" + zone.getZoneCode(), "VOC", request.getVocPpm(), "ppm", "WAREHOUSE_SAFETY", "SIMULATION");
        sensor("WAREHOUSE-" + zone.getZoneCode(), "SMOKE", request.getSmoke(), "%", "WAREHOUSE_SAFETY", "SIMULATION");
        if (persistence != null) persistence.save(zone);
        return zone;
    }

    public WarehouseStock inbound(WarehouseInboundRequest request) {
        require(request != null, "request is required");
        requireText(request.getTaskId(), "taskId is required");
        requireText(request.getBoxCode(), "boxCode is required");
        AgvTask task = requiredTask(request.getTaskId());
        require("ARRIVED".equals(task.getStatus()), "AGV must be ARRIVED before warehouse inbound");
        String zoneCode = normalize(request.getZoneCode(), "A-01");
        WarehouseZone zone = zones.get(zoneCode);
        require(zone == null || "SAFE".equals(zone.getStatus()), "warehouse zone is not safe");
        WarehouseStock value = new WarehouseStock();
        value.setBoxCode(request.getBoxCode().trim());
        value.setBottleType(normalize(request.getBottleType(), "UNKNOWN"));
        value.setZoneCode(zoneCode);
        value.setLocationCode(normalize(request.getLocationCode(), "A-01-01"));
        value.setStatus("IN_STOCK");
        value.setInboundAt(LocalDateTime.now());
        stock.put(value.getBoxCode(), value);
        task.setStatus("COMPLETED");
        task.setUpdatedAt(LocalDateTime.now());
        persist(task);
        if (persistence != null) persistence.save(value);
        return value;
    }

    public LogisticsOverview overview() {
        LogisticsOverview value = new LogisticsOverview();
        value.setTasks(tasks.values().stream().sorted(Comparator.comparing(AgvTask::getUpdatedAt).reversed()).collect(Collectors.toList()));
        value.setZones(zones.values().stream().sorted(Comparator.comparing(WarehouseZone::getUpdatedAt).reversed()).collect(Collectors.toList()));
        value.setStock(stock.values().stream().sorted(Comparator.comparing(WarehouseStock::getInboundAt).reversed()).collect(Collectors.toList()));
        return value;
    }

    private void sensor(String device, String type, double value, String unit, String stage, String mode) {
        SensorReadingRequest reading = new SensorReadingRequest();
        reading.setDeviceCode(device);
        reading.setSensorType(type);
        reading.setStage(stage);
        reading.setValue(value);
        reading.setUnit(unit);
        reading.setMode(mode);
        operationsService.recordSensor(reading);
    }

    private AgvTask requiredTask(String id) {
        AgvTask task = tasks.get(id);
        if (task == null) throw new IllegalArgumentException("AGV task not found: " + id);
        return task;
    }

    private void persist(AgvTask value) {
        if (persistence != null) persistence.save(value);
    }

    private String normalize(String value, String fallback) { return StringUtils.hasText(value) ? value.trim() : fallback; }
    private void requireText(String value, String message) { require(StringUtils.hasText(value), message); }
    private void require(boolean condition, String message) { if (!condition) throw new IllegalArgumentException(message); }
}
