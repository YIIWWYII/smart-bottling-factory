package com.archermind.hdc.factory.runtime.service;

import com.archermind.hdc.factory.runtime.dto.DeviceTelemetryRequest;
import com.archermind.hdc.factory.runtime.dto.FactoryRuntimeSnapshot;
import com.archermind.hdc.factory.runtime.dto.IncidentRequest;
import com.archermind.hdc.factory.runtime.dto.IncidentResolutionRequest;
import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.model.FactoryIncident;
import com.archermind.hdc.factory.runtime.model.StageRuntimeState;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class FactoryRuntimeService {
    private static final List<String> STAGE_ORDER = Arrays.asList(
            "PRETREATMENT", "GAS_INSPECTION", "APPEARANCE_INSPECTION",
            "BEVERAGE_READY", "FILLING", "SECONDARY_INSPECTION",
            "PACKING", "AGV_TRANSPORT", "WAREHOUSE_INBOUND");

    private static final Map<String, List<String>> DEVICES = new LinkedHashMap<>();
    private static final Map<String, Double> SPEEDS = new LinkedHashMap<>();
    private static final Map<String, Double> PATH_LENGTHS = new LinkedHashMap<>();

    static {
        DEVICES.put("PRETREATMENT", Arrays.asList("PT-CV-01", "PT-WASH-01", "PT-AIR-01", "PT-PLC-01"));
        DEVICES.put("GAS_INSPECTION", Arrays.asList("GAS-CHAMBER-01", "GAS-VERIFY-01", "GAS-PUMP-01", "GAS-LAMP-01"));
        DEVICES.put("APPEARANCE_INSPECTION", Arrays.asList("VIS-TOP-01", "VIS-SIDE-01", "VIS-BOTTOM-01", "VIS-LIGHT-01", "VIS-REJECT-01"));
        DEVICES.put("BEVERAGE_READY", Arrays.asList("BEV-MIX-01", "BEV-HT-01", "BEV-TEMP-01", "BEV-HUM-01"));
        DEVICES.put("FILLING", Arrays.asList("FIL-POS-01", "FIL-PUMP-01", "FIL-HEAD-01", "FIL-FLOW-01", "FIL-LEVEL-01"));
        DEVICES.put("SECONDARY_INSPECTION", Arrays.asList("SEC-CAM-01", "SEC-LEVEL-01", "SEC-LIGHT-01", "SEC-REJECT-01"));
        DEVICES.put("PACKING", Arrays.asList("PK-ARM-01", "PK-GRIP-01", "PK-CAM-01", "PK-PRINT-01", "PK-COUNT-01"));
        DEVICES.put("AGV_TRANSPORT", Arrays.asList("AGV-01", "AGV-US-01", "AGV-ODO-01", "AGV-LOAD-01", "AGV-DISPATCH-01"));
        DEVICES.put("WAREHOUSE_INBOUND", Arrays.asList("WH-VOC-01", "WH-SMOKE-01", "WH-LAMP-01", "WH-WMS-01"));

        SPEEDS.put("PRETREATMENT", .12D); SPEEDS.put("GAS_INSPECTION", .10D);
        SPEEDS.put("APPEARANCE_INSPECTION", .18D); SPEEDS.put("BEVERAGE_READY", .08D);
        SPEEDS.put("FILLING", .12D); SPEEDS.put("SECONDARY_INSPECTION", .16D);
        SPEEDS.put("PACKING", .08D); SPEEDS.put("AGV_TRANSPORT", 1D);
        SPEEDS.put("WAREHOUSE_INBOUND", .10D);

        PATH_LENGTHS.put("PRETREATMENT", .96D); PATH_LENGTHS.put("GAS_INSPECTION", .80D);
        PATH_LENGTHS.put("APPEARANCE_INSPECTION", .90D); PATH_LENGTHS.put("BEVERAGE_READY", .96D);
        PATH_LENGTHS.put("FILLING", .84D); PATH_LENGTHS.put("SECONDARY_INSPECTION", .96D);
        PATH_LENGTHS.put("PACKING", .96D); PATH_LENGTHS.put("AGV_TRANSPORT", 10D);
        PATH_LENGTHS.put("WAREHOUSE_INBOUND", 1D);
    }

    @Value("${factory.runtime.mqtt-timeout-seconds:5}")
    private int mqttTimeoutSeconds;
    @Value("${factory.runtime.buffer-capacity:6}")
    private int bufferCapacity;

    private final Map<String, DeviceRuntimeState> telemetry = new ConcurrentHashMap<>();
    private final Map<String, StageRuntimeState> stages = new ConcurrentHashMap<>();
    private final Map<String, FactoryIncident> incidents = new ConcurrentHashMap<>();
    private final FactoryRuntimePersistence persistence;

    public FactoryRuntimeService() {
        this(null);
    }

    @Autowired
    public FactoryRuntimeService(FactoryRuntimePersistence persistence) {
        this.persistence = persistence;
        for (String stageCode : STAGE_ORDER) stages.put(stageCode, defaultStage(stageCode));
    }

    @PostConstruct
    public void restore() {
        if (persistence == null || !persistence.isEnabled()) return;

        Map<String, StageRuntimeState> persistedStages = new LinkedHashMap<>();
        for (StageRuntimeState value : persistence.loadStages()) {
            if (STAGE_ORDER.contains(value.getStageCode())) persistedStages.put(value.getStageCode(), value);
        }
        stages.clear();
        for (String stageCode : STAGE_ORDER) {
            stages.put(stageCode, persistedStages.containsKey(stageCode)
                    ? persistedStages.get(stageCode) : defaultStage(stageCode));
        }

        telemetry.clear();
        for (DeviceRuntimeState value : persistence.loadDevices()) {
            List<String> stageDevices = DEVICES.get(value.getStageCode());
            if (stageDevices != null && stageDevices.contains(value.getDeviceCode())) {
                telemetry.put(value.getDeviceCode(), value);
            }
        }

        incidents.clear();
        for (FactoryIncident value : persistence.loadIncidents()) {
            if (STAGE_ORDER.contains(value.getStageCode())) incidents.put(value.getIncidentId(), value);
        }

        if (persistedStages.isEmpty()) {
            incidents.values().stream().filter(item -> "OPEN".equals(item.getStatus()))
                    .forEach(this::applyIncidentToStage);
        }
        persistence.saveStages(stages.values());
    }

    @Transactional
    public DeviceRuntimeState recordTelemetry(DeviceTelemetryRequest request) {
        require(request != null, "request is required");
        String stageCode = upper(request.getStageCode());
        String deviceCode = upper(request.getDeviceCode());
        require(DEVICES.containsKey(stageCode), "unsupported stageCode: " + stageCode);
        require(DEVICES.get(stageCode).contains(deviceCode), "device does not belong to stage: " + deviceCode);
        String source = upper(defaultText(request.getSource(), "MQTT"));
        require("MQTT".equals(source) || "REAL".equals(source) || "SIMULATION".equals(source),
                "source must be MQTT, REAL or SIMULATION");

        DeviceRuntimeState value = new DeviceRuntimeState();
        value.setStageCode(stageCode);
        value.setDeviceCode(deviceCode);
        value.setState(upper(defaultText(request.getState(), "RUNNING")));
        value.setSource("REAL".equals(source) ? "MQTT" : source);
        value.setFallback(false);
        value.setSpeedMps(nonNegative(request.getSpeedMps(), SPEEDS.get(stageCode)));
        value.setProgress(clamp(request.getProgress() == null ? 0D : request.getProgress(), 0D, 1D));
        value.setOccurredAt(request.getOccurredAt() == null ? LocalDateTime.now() : request.getOccurredAt());
        value.setMetrics(request.getMetrics() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(request.getMetrics()));
        telemetry.put(deviceCode, value);
        if (persistence != null) persistence.saveDevice(value);
        return copyDevice(value);
    }

    public FactoryRuntimeSnapshot snapshot(String stageCode) {
        LocalDateTime now = LocalDateTime.now();
        String filter = StringUtils.hasText(stageCode) ? upper(stageCode) : null;
        FactoryRuntimeSnapshot snapshot = new FactoryRuntimeSnapshot();
        snapshot.setGeneratedAt(now);
        snapshot.setMqttTimeoutSeconds(mqttTimeoutSeconds);
        List<DeviceRuntimeState> devices = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : DEVICES.entrySet()) {
            if (filter != null && !filter.equals(entry.getKey())) continue;
            for (int index = 0; index < entry.getValue().size(); index++) {
                String deviceCode = entry.getValue().get(index);
                DeviceRuntimeState actual = telemetry.get(deviceCode);
                devices.add(isFreshMqtt(actual, now)
                        ? applyStageState(copyDevice(actual))
                        : simulated(entry.getKey(), deviceCode, index, entry.getValue().size(), now, actual));
            }
        }
        snapshot.setDevices(devices);
        snapshot.setStages(stageStates(filter));
        snapshot.setIncidents(openIncidents(filter));
        return snapshot;
    }

    @Transactional
    public FactoryIncident reportIncident(IncidentRequest request) {
        require(request != null, "request is required");
        String stageCode = upper(request.getStageCode());
        require(DEVICES.containsKey(stageCode), "unsupported stageCode: " + stageCode);
        String type = upper(defaultText(request.getIncidentType(), "PROCESS_EXCEPTION"));
        String strategy = upper(defaultText(request.getStrategy(), defaultStrategy(type, stageCode)));

        FactoryIncident value = new FactoryIncident();
        value.setIncidentId("INC-" + UUID.randomUUID());
        value.setTraceCode(trim(request.getTraceCode()));
        value.setStageCode(stageCode);
        value.setDeviceCode(upperOrNull(request.getDeviceCode()));
        value.setIncidentType(type);
        value.setMessage(defaultText(request.getMessage(), type + " at " + stageCode));
        value.setStrategy(strategy);
        value.setTargetStage(defaultTarget(strategy, stageCode, request.getTargetStage()));
        value.setStatus("OPEN");
        value.setCreatedAt(LocalDateTime.now());
        value.setAffectedStages(affectedStages(stageCode, strategy));
        incidents.put(value.getIncidentId(), value);
        applyIncidentToStage(value);
        persistIncidentAndStages(value);
        return value;
    }

    @Transactional
    public FactoryIncident reportAutomatic(String traceCode, String stageCode, String deviceCode,
                                           String incidentType, String message, String strategy) {
        IncidentRequest request = new IncidentRequest();
        request.setTraceCode(traceCode);
        request.setStageCode(stageCode);
        request.setDeviceCode(deviceCode);
        request.setIncidentType(incidentType);
        request.setMessage(message);
        request.setStrategy(strategy);
        return reportIncident(request);
    }

    @Transactional
    public FactoryIncident resolve(String incidentId, IncidentResolutionRequest request) {
        FactoryIncident value = incidents.get(incidentId);
        require(value != null, "incident not found: " + incidentId);
        synchronized (value) {
            require("OPEN".equals(value.getStatus()), "incident has already been resolved");
            value.setStatus("RESOLVED");
            value.setResolutionAction(upper(defaultText(request == null ? null : request.getAction(), "RESUME")));
            value.setResolutionNote(request == null ? null : trim(request.getNote()));
            if (request != null && StringUtils.hasText(request.getTargetStage())) value.setTargetStage(upper(request.getTargetStage()));
            value.setResolvedAt(LocalDateTime.now());
        }
        if ("STOP_LINE".equals(value.getStrategy())) {
            for (String stageCode : STAGE_ORDER) restoreStageIfPossible(stageCode);
        } else {
            restoreStageIfPossible(value.getStageCode());
        }
        if ("BUFFER_AND_STOP".equals(value.getStrategy())) drainUpstreamBuffer(value.getStageCode());
        persistIncidentAndStages(value);
        return value;
    }

    public FactoryIncident findIncident(String incidentId) {
        FactoryIncident value = incidents.get(incidentId);
        require(value != null, "incident not found: " + incidentId);
        return value;
    }

    public List<FactoryIncident> incidents(String status, String stageCode) {
        return incidents.values().stream()
                .filter(item -> !StringUtils.hasText(status) || item.getStatus().equalsIgnoreCase(status))
                .filter(item -> !StringUtils.hasText(stageCode) || item.getStageCode().equalsIgnoreCase(stageCode))
                .sorted(Comparator.comparing(FactoryIncident::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    private DeviceRuntimeState simulated(String stageCode, String deviceCode, int index, int count,
                                         LocalDateTime now, DeviceRuntimeState stale) {
        StageRuntimeState stage = stages.get(stageCode);
        double speed = SPEEDS.get(stageCode);
        double path = PATH_LENGTHS.get(stageCode);
        boolean running = "RUNNING".equals(stage.getState());
        double cycle = path / speed;
        double seconds = System.currentTimeMillis() / 1000D;
        double progress = running ? modulo(seconds / cycle + (double) index / Math.max(1, count), 1D) : 0D;

        DeviceRuntimeState value = new DeviceRuntimeState();
        value.setStageCode(stageCode);
        value.setDeviceCode(deviceCode);
        value.setState(running ? "RUNNING" : stage.getState());
        value.setSource("SIMULATION");
        value.setFallback(true);
        value.setSpeedMps(running ? speed : 0D);
        value.setProgress(progress);
        value.setOccurredAt(now);
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("pathLengthM", path);
        metrics.put("cycleSeconds", cycle);
        metrics.put("activity", activity(progress, (double) (index + 1) / (count + 1)));
        metrics.put("fallbackReason", stale == null ? "NO_MQTT_DATA" : "MQTT_DATA_TIMEOUT");
        value.setMetrics(metrics);
        return value;
    }

    private DeviceRuntimeState applyStageState(DeviceRuntimeState device) {
        StageRuntimeState stage = stages.get(device.getStageCode());
        if (stage != null && !"RUNNING".equals(stage.getState())) {
            device.setState(stage.getState());
            device.setSpeedMps(0D);
        }
        return device;
    }

    private void applyIncidentToStage(FactoryIncident incident) {
        StageRuntimeState stage = stages.get(incident.getStageCode());
        String strategy = incident.getStrategy();
        if ("STOP_LINE".equals(strategy)) {
            for (StageRuntimeState item : stages.values()) stopStage(item, "整线急停：" + incident.getMessage());
            return;
        }
        if ("STOP_STAGE".equals(strategy) || "BUFFER_AND_STOP".equals(strategy)) {
            stopStage(stage, incident.getMessage());
            if ("BUFFER_AND_STOP".equals(strategy)) fillUpstreamBuffer(incident.getStageCode());
        } else {
            stage.setReason("产品按 " + strategy + " 路由，工位保持运行");
            stage.setUpstreamImpact("上游继续生产");
            stage.setDownstreamImpact("仅当前产品受影响");
        }
    }

    private void stopStage(StageRuntimeState stage, String reason) {
        stage.setState("STOPPED");
        stage.setReason(reason);
        stage.setUpstreamImpact("上游进入缓冲区，缓冲满后仅停止相邻上游");
        stage.setDownstreamImpact("下游缺料等待，其他工位保持独立");
    }

    private void fillUpstreamBuffer(String stageCode) {
        int index = STAGE_ORDER.indexOf(stageCode);
        if (index <= 0) return;
        StageRuntimeState upstream = stages.get(STAGE_ORDER.get(index - 1));
        upstream.setBufferLevel(Math.min(upstream.getBufferCapacity(), upstream.getBufferLevel() + 1));
        upstream.setDownstreamImpact("下游停机，产出进入缓冲区");
        if (upstream.getBufferLevel() >= upstream.getBufferCapacity()) {
            upstream.setState("BLOCKED");
            upstream.setReason("下游缓冲区已满");
        }
    }

    private void drainUpstreamBuffer(String stageCode) {
        int index = STAGE_ORDER.indexOf(stageCode);
        if (index <= 0) return;
        String upstreamCode = STAGE_ORDER.get(index - 1);
        StageRuntimeState upstream = stages.get(upstreamCode);
        upstream.setBufferLevel(Math.max(0, upstream.getBufferLevel() - 1));
        if ("BLOCKED".equals(upstream.getState()) && upstream.getBufferLevel() < upstream.getBufferCapacity()) {
            restoreStageIfPossible(upstreamCode);
        } else if ("RUNNING".equals(upstream.getState())) {
            upstream.setDownstreamImpact("无");
        }
    }

    private void restoreStageIfPossible(String stageCode) {
        boolean stillBlocked = incidents.values().stream().anyMatch(item -> "OPEN".equals(item.getStatus())
                && ("STOP_LINE".equals(item.getStrategy()) || (stageCode.equals(item.getStageCode())
                && Arrays.asList("STOP_STAGE", "BUFFER_AND_STOP").contains(item.getStrategy()))));
        if (!stillBlocked) {
            stages.put(stageCode, defaultStage(stageCode));
            incidents.values().stream()
                    .filter(item -> "OPEN".equals(item.getStatus()) && stageCode.equals(item.getStageCode()))
                    .filter(item -> !Arrays.asList("STOP_STAGE", "BUFFER_AND_STOP", "STOP_LINE").contains(item.getStrategy()))
                    .forEach(this::applyIncidentToStage);
        }
    }

    private List<StageRuntimeState> stageStates(String filter) {
        List<StageRuntimeState> result = new ArrayList<>();
        for (String stageCode : STAGE_ORDER) {
            if (filter == null || filter.equals(stageCode)) result.add(copyStage(stages.get(stageCode)));
        }
        return result;
    }

    private List<FactoryIncident> openIncidents(String filter) {
        return incidents.values().stream()
                .filter(item -> "OPEN".equals(item.getStatus()))
                .filter(item -> filter == null || filter.equals(item.getStageCode()))
                .sorted(Comparator.comparing(FactoryIncident::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    private boolean isFreshMqtt(DeviceRuntimeState value, LocalDateTime now) {
        return value != null && "MQTT".equals(value.getSource()) && value.getOccurredAt() != null
                && Math.abs(Duration.between(value.getOccurredAt(), now).getSeconds()) <= mqttTimeoutSeconds;
    }

    private void persistIncidentAndStages(FactoryIncident incident) {
        if (persistence == null) return;
        persistence.saveIncident(incident);
        persistence.saveStages(stages.values());
    }

    private String defaultStrategy(String type, String stageCode) {
        if (type.contains("DEFECT")) return "REJECT_PRODUCT";
        if (type.contains("RECHECK") || type.contains("RETRY")) return "RETURN_PREVIOUS";
        if (type.contains("SAFETY") || type.contains("SMOKE") || type.contains("VOC")) return "STOP_STAGE";
        if (type.contains("EQUIPMENT") || type.contains("BLOCKED") || "AGV_TRANSPORT".equals(stageCode)) return "BUFFER_AND_STOP";
        if (type.contains("PROCESS") || type.contains("QUALITY")) return "ROUTE_REWORK";
        return "MANUAL_HOLD";
    }

    private String defaultTarget(String strategy, String stageCode, String requested) {
        if (StringUtils.hasText(requested)) return upper(requested);
        int index = STAGE_ORDER.indexOf(stageCode);
        if ("RETURN_PREVIOUS".equals(strategy)) return index > 0 ? STAGE_ORDER.get(index - 1) : stageCode;
        if ("ROUTE_REWORK".equals(strategy)) return "REWORK_" + stageCode;
        if ("BUFFER_AND_STOP".equals(strategy)) return "BUFFER_" + stageCode;
        return stageCode;
    }

    private List<String> affectedStages(String stageCode, String strategy) {
        if ("STOP_LINE".equals(strategy)) return new ArrayList<>(STAGE_ORDER);
        if (!"STOP_STAGE".equals(strategy) && !"BUFFER_AND_STOP".equals(strategy)) return Collections.singletonList(stageCode);
        List<String> result = new ArrayList<>();
        int index = STAGE_ORDER.indexOf(stageCode);
        if (index > 0) result.add(STAGE_ORDER.get(index - 1));
        result.add(stageCode);
        if (index < STAGE_ORDER.size() - 1) result.add(STAGE_ORDER.get(index + 1));
        return result;
    }

    private StageRuntimeState defaultStage(String stageCode) {
        StageRuntimeState state = new StageRuntimeState();
        state.setStageCode(stageCode);
        state.setState("RUNNING");
        state.setReason("独立工位正常运行");
        state.setUpstreamImpact("无");
        state.setDownstreamImpact("无");
        state.setBufferCapacity(bufferCapacity > 0 ? bufferCapacity : 6);
        return state;
    }

    private DeviceRuntimeState copyDevice(DeviceRuntimeState source) {
        DeviceRuntimeState copy = new DeviceRuntimeState();
        copy.setStageCode(source.getStageCode()); copy.setDeviceCode(source.getDeviceCode());
        copy.setState(source.getState()); copy.setSource(source.getSource()); copy.setFallback(source.isFallback());
        copy.setSpeedMps(source.getSpeedMps()); copy.setProgress(source.getProgress()); copy.setOccurredAt(source.getOccurredAt());
        copy.setMetrics(source.getMetrics() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(source.getMetrics()));
        return copy;
    }

    private StageRuntimeState copyStage(StageRuntimeState source) {
        StageRuntimeState copy = new StageRuntimeState();
        copy.setStageCode(source.getStageCode()); copy.setState(source.getState()); copy.setReason(source.getReason());
        copy.setUpstreamImpact(source.getUpstreamImpact()); copy.setDownstreamImpact(source.getDownstreamImpact());
        copy.setBufferLevel(source.getBufferLevel()); copy.setBufferCapacity(source.getBufferCapacity());
        return copy;
    }

    private double activity(double progress, double target) {
        return clamp(1D - Math.abs(progress - target) / .12D, 0D, 1D);
    }
    private double modulo(double value, double divisor) { return ((value % divisor) + divisor) % divisor; }
    private double clamp(double value, double min, double max) { return Math.min(max, Math.max(min, value)); }
    private double nonNegative(Double value, Double fallback) { return Math.max(0D, value == null ? fallback : value); }
    private String upper(String value) { return value == null ? null : value.trim().toUpperCase(Locale.ROOT); }
    private String upperOrNull(String value) { return StringUtils.hasText(value) ? upper(value) : null; }
    private String trim(String value) { return StringUtils.hasText(value) ? value.trim() : null; }
    private String defaultText(String value, String fallback) { return StringUtils.hasText(value) ? value.trim() : fallback; }
    private void require(boolean condition, String message) { if (!condition) throw new IllegalArgumentException(message); }
}
