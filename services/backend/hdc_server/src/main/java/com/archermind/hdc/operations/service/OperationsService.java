package com.archermind.hdc.operations.service;

import com.alibaba.fastjson.JSON;
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
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class OperationsService {
    private static final String KNOWLEDGE_VERSION = "SIMULATION-KB-2026.1";

    @Value("${factory.thresholds.voc-max:10.0}")
    private double vocMax;
    @Value("${factory.thresholds.smoke-max:0.5}")
    private double smokeMax;
    @Value("${factory.thresholds.temperature-min:20.0}")
    private double temperatureMin;
    @Value("${factory.thresholds.temperature-max:30.0}")
    private double temperatureMax;
    @Value("${factory.thresholds.agv-distance-min:20.0}")
    private double agvDistanceMin;

    private final Map<String, SensorReading> readings = new ConcurrentHashMap<>();
    private final Map<String, SensorReading> latest = new ConcurrentHashMap<>();
    private final Map<String, AlarmRecord> alarms = new ConcurrentHashMap<>();
    private final Map<String, DeviceCommand> commands = new ConcurrentHashMap<>();
    private final Map<String, AiAuditRecord> aiAudits = new ConcurrentHashMap<>();
    private final OperationsPersistence persistence;
    private final OperationsRealtimePublisher realtimePublisher;
    @Autowired(required = false)
    private FactoryRuntimeService runtimeService;

    public OperationsService(OperationsPersistence persistence,
                             OperationsRealtimePublisher realtimePublisher) {
        this.persistence = persistence;
        this.realtimePublisher = realtimePublisher;
    }

    @PostConstruct
    public void restore() {
        if (!persistence.isEnabled()) return;
        for (SensorReading value : persistence.loadReadings()) {
            readings.put(value.getReadingId(), value);
            latest.putIfAbsent(latestKey(value), value);
        }
        for (AlarmRecord value : persistence.loadAlarms()) alarms.put(value.getAlarmId(), value);
        for (DeviceCommand value : persistence.loadCommands()) commands.put(value.getCommandId(), value);
        for (AiAuditRecord value : persistence.loadAiAudits()) aiAudits.put(value.getAuditId(), value);
    }

    public SensorReading recordSensor(SensorReadingRequest request) {
        require(request != null, "request is required");
        requireText(request.getDeviceCode(), "deviceCode is required");
        requireText(request.getSensorType(), "sensorType is required");
        require(request.getValue() != null, "value is required");

        SensorReading value = new SensorReading();
        value.setReadingId("READ-" + UUID.randomUUID());
        value.setDeviceCode(request.getDeviceCode().trim());
        value.setSensorType(request.getSensorType().trim().toUpperCase(Locale.ROOT));
        value.setStage(normalize(request.getStage(), "UNKNOWN"));
        value.setTraceCode(normalize(request.getTraceCode(), null));
        value.setValue(request.getValue());
        value.setUnit(normalize(request.getUnit(), defaultUnit(value.getSensorType())));
        value.setQuality(normalize(request.getQuality(), "GOOD").toUpperCase(Locale.ROOT));
        value.setMode(normalize(request.getMode(), "SIMULATION").toUpperCase(Locale.ROOT));
        require("REAL".equals(value.getMode()) || "SIMULATION".equals(value.getMode()),
                "mode must be REAL or SIMULATION");
        value.setOccurredAt(LocalDateTime.now());

        readings.put(value.getReadingId(), value);
        latest.put(latestKey(value), value);
        persistence.save(value);
        realtimePublisher.publish("factory.sensor.changed", value);
        createThresholdAlarm(value);
        return value;
    }

    public List<SensorReading> latestReadings(String deviceCode) {
        return latest.values().stream()
                .filter(value -> !StringUtils.hasText(deviceCode)
                        || value.getDeviceCode().equalsIgnoreCase(deviceCode.trim()))
                .sorted(Comparator.comparing(SensorReading::getOccurredAt).reversed())
                .collect(Collectors.toList());
    }

    public List<AlarmRecord> alarms(String status) {
        return alarms.values().stream()
                .filter(value -> !StringUtils.hasText(status)
                        || value.getStatus().equalsIgnoreCase(status.trim()))
                .sorted(Comparator.comparing(AlarmRecord::getOccurredAt).reversed())
                .limit(100)
                .collect(Collectors.toList());
    }

    public AlarmRecord acknowledgeAlarm(String alarmId) {
        AlarmRecord value = requiredAlarm(alarmId);
        synchronized (value) {
            if ("ACKNOWLEDGED".equals(value.getStatus())) return value;
            value.setStatus("ACKNOWLEDGED");
            value.setAcknowledgedAt(LocalDateTime.now());
            persistence.save(value);
            realtimePublisher.publish("factory.alarm.acknowledged", value);
        }
        return value;
    }

    public DeviceCommand createCommand(DeviceCommandRequest request) {
        require(request != null, "request is required");
        requireText(request.getDeviceCode(), "deviceCode is required");
        requireText(request.getCommandType(), "commandType is required");
        require(request.getPayload() != null && !request.getPayload().isEmpty(), "payload is required");

        DeviceCommand value = new DeviceCommand();
        value.setCommandId("CMD-" + UUID.randomUUID());
        value.setDeviceCode(request.getDeviceCode().trim());
        value.setCommandType(request.getCommandType().trim().toUpperCase(Locale.ROOT));
        value.setPayload(JSON.toJSONString(request.getPayload()));
        value.setSource(normalize(request.getSource(), "OPERATOR").toUpperCase(Locale.ROOT));
        value.setTraceCode(normalize(request.getTraceCode(), null));
        value.setStatus("PENDING");
        value.setMessage("Waiting for device acknowledgement");
        value.setCreatedAt(LocalDateTime.now());
        commands.put(value.getCommandId(), value);
        persistence.save(value);
        realtimePublisher.publish("factory.command.created", value);
        return value;
    }

    public DeviceCommand acknowledgeCommand(String commandId, CommandAckRequest request) {
        DeviceCommand value = requiredCommand(commandId);
        require(request != null, "request is required");
        String status = normalize(request.getStatus(), "SUCCEEDED").toUpperCase(Locale.ROOT);
        require("SUCCEEDED".equals(status) || "FAILED".equals(status),
                "status must be SUCCEEDED or FAILED");
        synchronized (value) {
            require("PENDING".equals(value.getStatus()), "command has already been acknowledged");
            value.setStatus(status);
            value.setMessage(normalize(request.getMessage(), "Device acknowledgement received"));
            value.setAcknowledgedAt(LocalDateTime.now());
            persistence.save(value);
            realtimePublisher.publish("factory.command.acknowledged", value);
        }
        return value;
    }

    public List<DeviceCommand> commands(String status) {
        return commands.values().stream()
                .filter(value -> !StringUtils.hasText(status)
                        || value.getStatus().equalsIgnoreCase(status.trim()))
                .sorted(Comparator.comparing(DeviceCommand::getCreatedAt).reversed())
                .limit(100)
                .collect(Collectors.toList());
    }

    public AiDecisionResponse decide(AiDecisionRequest request) {
        require(request != null, "request is required");
        requireText(request.getTraceCode(), "traceCode is required");
        requireText(request.getBottleType(), "bottleType is required");
        requireText(request.getStage(), "stage is required");

        Map<String, Object> parameters = recipe(request.getBottleType());
        boolean knownBottle = !parameters.isEmpty();
        boolean observationsSafe = observationsSafe(request.getObservations());
        String validation = knownBottle && observationsSafe ? "PASSED" : "REJECTED";
        String decision = "PASSED".equals(validation) ? "APPLY_RECIPE" : "MANUAL_REVIEW";
        String reason = !knownBottle
                ? "Bottle type is not present in the local approved recipe database"
                : observationsSafe
                    ? "Local recipe found and all safety constraints passed"
                    : "Sensor observations failed a safety constraint";

        AiAuditRecord audit = new AiAuditRecord();
        audit.setAuditId("AI-" + UUID.randomUUID());
        audit.setTraceCode(request.getTraceCode().trim());
        audit.setBottleType(request.getBottleType().trim().toUpperCase(Locale.ROOT));
        audit.setStage(request.getStage().trim().toUpperCase(Locale.ROOT));
        audit.setRequestJson(JSON.toJSONString(request));
        audit.setKnowledgeVersion(KNOWLEDGE_VERSION);
        audit.setRecommendationJson(JSON.toJSONString(parameters));
        audit.setValidationStatus(validation);
        audit.setDecision(decision);
        audit.setReason(reason);
        audit.setCreatedAt(LocalDateTime.now());
        aiAudits.put(audit.getAuditId(), audit);
        persistence.save(audit);
        realtimePublisher.publish("factory.ai.decision", audit);

        AiDecisionResponse response = new AiDecisionResponse();
        response.setAuditId(audit.getAuditId());
        response.setKnowledgeVersion(KNOWLEDGE_VERSION);
        response.setDecision(decision);
        response.setValidationStatus(validation);
        response.setReason(reason);
        response.setParameters(parameters);
        if (request.isAutoApply() && "PASSED".equals(validation)) {
            DeviceCommandRequest command = new DeviceCommandRequest();
            command.setDeviceCode("LINE-CONTROL-01");
            command.setCommandType("SET_RECIPE");
            command.setPayload(parameters);
            command.setSource("AI_VALIDATED");
            command.setTraceCode(request.getTraceCode());
            response.setCommandId(createCommand(command).getCommandId());
        }
        return response;
    }

    public List<AiAuditRecord> aiAudits() {
        return aiAudits.values().stream()
                .sorted(Comparator.comparing(AiAuditRecord::getCreatedAt).reversed())
                .limit(100)
                .collect(Collectors.toList());
    }

    public OperationsOverview overview() {
        OperationsOverview value = new OperationsOverview();
        value.setLatestReadings(latestReadings(null));
        value.setAlarms(alarms(null));
        value.setCommands(commands(null));
        value.setAiAudits(aiAudits());
        return value;
    }

    public void reset() {
        readings.clear();
        latest.clear();
        alarms.clear();
        commands.clear();
        aiAudits.clear();
    }

    private void createThresholdAlarm(SensorReading reading) {
        String type = reading.getSensorType();
        Double limit = null;
        boolean triggered = false;
        String message = null;
        String level = "WARNING";
        if (!"GOOD".equals(reading.getQuality())) {
            message = "Sensor quality is " + reading.getQuality();
            level = "WARNING";
            triggered = true;
        } else if ("VOC".equals(type) && reading.getValue() > vocMax) {
            limit = vocMax;
            message = "VOC exceeds the configured demo limit";
            level = "CRITICAL";
            triggered = true;
        } else if ("SMOKE".equals(type) && reading.getValue() > smokeMax) {
            limit = smokeMax;
            message = "Warehouse smoke level exceeds the configured demo limit";
            level = "CRITICAL";
            triggered = true;
        } else if ("TEMPERATURE".equals(type)
                && (reading.getValue() < temperatureMin || reading.getValue() > temperatureMax)) {
            limit = reading.getValue() < temperatureMin ? temperatureMin : temperatureMax;
            message = "Beverage temperature is outside the configured demo range";
            triggered = true;
        } else if ("AGV_DISTANCE".equals(type) && reading.getValue() < agvDistanceMin) {
            limit = agvDistanceMin;
            message = "AGV obstacle distance is below the configured stop distance";
            level = "CRITICAL";
            triggered = true;
        }
        if (!triggered) return;

        AlarmRecord alarm = new AlarmRecord();
        alarm.setAlarmId("ALM-" + UUID.randomUUID());
        alarm.setDeviceCode(reading.getDeviceCode());
        alarm.setTraceCode(reading.getTraceCode());
        alarm.setAlarmType(type + "_LIMIT");
        alarm.setLevel(level);
        alarm.setStatus("OPEN");
        alarm.setMessage(message);
        alarm.setValue(reading.getValue());
        alarm.setLimitValue(limit);
        alarm.setOccurredAt(LocalDateTime.now());
        alarms.put(alarm.getAlarmId(), alarm);
        persistence.save(alarm);
        realtimePublisher.publish("factory.alarm.opened", alarm);
        reportRuntimeIncident(reading, alarm);
    }

    private void reportRuntimeIncident(SensorReading reading, AlarmRecord alarm) {
        if (runtimeService == null) return;
        String stage = normalize(reading.getStage(), "UNKNOWN").toUpperCase(Locale.ROOT);
        if ("WAREHOUSE_SAFETY".equals(stage)) stage = "WAREHOUSE_INBOUND";
        String strategy = "STOP_STAGE";
        if ("AGV_DISTANCE".equals(reading.getSensorType())) strategy = "BUFFER_AND_STOP";
        else if ("TEMPERATURE".equals(reading.getSensorType())) strategy = "ROUTE_REWORK";
        try {
            runtimeService.reportAutomatic(reading.getTraceCode(), stage, reading.getDeviceCode(),
                    alarm.getAlarmType(), alarm.getMessage(), strategy);
        } catch (IllegalArgumentException ignored) {
            // Readings outside the production-stage catalog still retain their alarm record.
        }
    }

    private Map<String, Object> recipe(String bottleType) {
        String normalized = bottleType.trim().toUpperCase(Locale.ROOT);
        if (!"PLA-500".equals(normalized) && !"PLA-330".equals(normalized)) {
            return new LinkedHashMap<>();
        }
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("recipeCode", normalized + "-DEMO-V1");
        values.put("pretreatmentSeconds", 20);
        values.put("washSeconds", 15);
        values.put("airWashSeconds", 10);
        values.put("conveyorSpeedMmS", "PLA-500".equals(normalized) ? 120 : 135);
        values.put("fillingTemperatureC", 25.0);
        values.put("fillVolumeMl", "PLA-500".equals(normalized) ? 500 : 330);
        values.put("capTorqueNm", 0.9);
        return values;
    }

    private boolean observationsSafe(Map<String, Object> observations) {
        if (observations == null) return true;
        Object voc = observations.get("voc");
        if (voc instanceof Number && ((Number) voc).doubleValue() > vocMax) return false;
        Object smoke = observations.get("smoke");
        return !(smoke instanceof Number) || ((Number) smoke).doubleValue() <= smokeMax;
    }

    private AlarmRecord requiredAlarm(String id) {
        AlarmRecord value = alarms.get(id);
        if (value == null) throw new IllegalArgumentException("alarm not found: " + id);
        return value;
    }

    private DeviceCommand requiredCommand(String id) {
        DeviceCommand value = commands.get(id);
        if (value == null) throw new IllegalArgumentException("command not found: " + id);
        return value;
    }

    private String latestKey(SensorReading value) {
        return value.getDeviceCode() + ":" + value.getSensorType();
    }

    private String defaultUnit(String sensorType) {
        if ("TEMPERATURE".equals(sensorType)) return "C";
        if ("HUMIDITY".equals(sensorType)) return "%RH";
        if ("VOC".equals(sensorType)) return "ppm";
        if ("SMOKE".equals(sensorType)) return "%";
        if ("AGV_DISTANCE".equals(sensorType)) return "cm";
        return "unit";
    }

    private String normalize(String value, String defaultValue) {
        return StringUtils.hasText(value) ? value.trim() : defaultValue;
    }

    private void requireText(String value, String message) {
        require(StringUtils.hasText(value), message);
    }

    private void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }
}
