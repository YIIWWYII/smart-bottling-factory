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
import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.coordination.FactoryStateVersionService;
import com.archermind.hdc.factory.parameter.ParameterStateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
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
    private static final List<String> CONTROL_ROLES = Arrays.asList("ADMIN", "OPERATOR", "ENGINEER", "AI_DECISION");
    private static final int DEFAULT_COMMAND_TIMEOUT_SECONDS = 30;

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
    @Autowired(required = false)
    private DeviceCapabilityCatalog capabilityCatalog;
    @Autowired(required = false)
    private FactoryStateVersionService stateVersionService;
    @Autowired(required = false)
    private ParameterStateService parameterStateService;

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
        require("REAL".equals(value.getMode()) || "MQTT".equals(value.getMode()) || "SIMULATION".equals(value.getMode()),
                "mode must be MQTT or SIMULATION");
        if ("REAL".equals(value.getMode())) value.setMode("MQTT");
        value.setOccurredAt(LocalDateTime.now());

        readings.put(value.getReadingId(), value);
        latest.put(latestKey(value), value);
        persistence.save(value);
        realtimePublisher.publish("operations.sensor.recorded", value);
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
            realtimePublisher.publish("operations.alarm.changed", value);
        }
        return value;
    }

    public DeviceCommand createCommand(DeviceCommandRequest request) {
        require(request != null, "request is required");
        requireText(request.getClientRequestId(), "clientRequestId is required");
        requireText(request.getDeviceCode(), "deviceCode is required");
        requireText(request.getCommandType(), "commandType is required");
        Map<String, Object> parameters = request.effectiveParameters();
        require(parameters != null && !parameters.isEmpty(), "parameters are required");
        requireText(request.getReason(), "reason is required");

        expirePendingCommands(LocalDateTime.now());
        DeviceCommand existing = commandByClientRequestId(request.getClientRequestId());
        if (existing != null) {
            require(existing.getDeviceCode().equalsIgnoreCase(request.getDeviceCode().trim())
                            && existing.getCommandType().equalsIgnoreCase(request.getCommandType().trim()),
                    "clientRequestId has been used for a different command");
            return existing;
        }

        validateCommandRequest(request);
        LocalDateTime now = LocalDateTime.now();

        DeviceCommand value = new DeviceCommand();
        value.setCommandId("CMD-" + UUID.randomUUID());
        value.setClientRequestId(request.getClientRequestId().trim());
        value.setClientType(normalize(request.getClientType(), "TERMINAL_CLIENT").toUpperCase(Locale.ROOT));
        value.setLineId(normalize(request.getLineId(), FactoryStateVersionService.LINE_ID));
        value.setStageCode(normalize(request.getStageCode(), stageForDevice(request.getDeviceCode())));
        value.setDeviceCode(request.getDeviceCode().trim());
        value.setCommandType(request.getCommandType().trim().toUpperCase(Locale.ROOT));
        value.setPayload(JSON.toJSONString(parameters));
        value.setSource(normalize(request.getSource(), "OPERATOR").toUpperCase(Locale.ROOT));
        value.setTraceCode(normalize(request.getTraceCode(), null));
        value.setOperator(normalize(request.getOperator(), "unknown"));
        value.setOperatorRole(normalize(request.getOperatorRole(), defaultRole(value.getSource())).toUpperCase(Locale.ROOT));
        value.setReason(request.getReason().trim());
        value.setExpectedStateVersion(request.getExpectedStateVersion());
        value.setAcceptedStateVersion(stateVersionService == null ? null : stateVersionService.current());
        value.setExpectedParameterVersion(request.getExpectedParameterVersion());
        value.setAcceptedParameterVersion(parameterStateService == null ? null : parameterStateService.currentVersion(request));
        value.setParameterCode(normalize(request.getParameterCode(), parameterFromCommand(request.getCommandType())));
        value.setAtomicGroupId(normalize(request.getAtomicGroupId(), null));
        value.setAiDecisionId(normalize(request.getAiDecisionId(), null));
        value.setCorrelationId(normalize(request.getCorrelationId(), null));
        value.setRecipeVersion(normalize(request.getRecipeVersion(), null));
        value.setOldValue(currentCapabilityValue(request));
        value.setNewValue(JSON.toJSONString(parameters));
        value.setSafetyValidation("{\"status\":\"PASSED\",\"checks\":[\"RBAC\",\"RANGE\",\"ONLINE\",\"INTERLOCK\",\"VERSION\"]}");
        value.setStatus("PENDING");
        value.setMessage("Accepted by backend safety gate; waiting for edge acknowledgement");
        value.setCreatedAt(now);
        value.setExpiresAt(now.plusSeconds(commandTimeoutSeconds(request)));
        commands.put(value.getCommandId(), value);
        persistence.save(value);
        realtimePublisher.publish("operations.command.changed", value);
        return value;
    }

    public DeviceCommand acknowledgeCommand(String commandId, CommandAckRequest request) {
        DeviceCommand value = requiredCommand(commandId);
        require(request != null, "request is required");
        String status = normalize(request.getStatus(), "ACKNOWLEDGED").toUpperCase(Locale.ROOT);
        if ("SUCCEEDED".equals(status)) status = "ACKNOWLEDGED";
        require("ACKNOWLEDGED".equals(status) || "FAILED".equals(status),
                "status must be ACKNOWLEDGED or FAILED");
        if (StringUtils.hasText(request.getClientRequestId())) {
            require(request.getClientRequestId().equals(value.getClientRequestId()), "ack clientRequestId mismatch");
        }
        if (StringUtils.hasText(request.getDeviceCode())) {
            require(request.getDeviceCode().equalsIgnoreCase(value.getDeviceCode()), "ack deviceCode mismatch");
        }
        synchronized (value) {
            expireCommandIfNeeded(value, LocalDateTime.now());
            require("PENDING".equals(value.getStatus()) || "SENT".equals(value.getStatus()),
                    "command is not waiting for acknowledgement");
            value.setStatus(status);
            value.setMessage(normalize(request.getMessage(), "Device acknowledgement received"));
            value.setAcknowledgedAt(LocalDateTime.now());
            value.setEdgeAckId(normalize(request.getEdgeAckId(), null));
            if ("ACKNOWLEDGED".equals(status) && parameterStateService != null) {
                parameterStateService.applyAcknowledged(value);
            }
            persistence.save(value);
            realtimePublisher.publish("operations.command.changed", value);
        }
        return value;
    }

    public List<DeviceCommand> commands(String status) {
        expirePendingCommands(LocalDateTime.now());
        return commands.values().stream()
                .filter(value -> !StringUtils.hasText(status)
                        || value.getStatus().equalsIgnoreCase(status.trim()))
                .sorted(Comparator.comparing(DeviceCommand::getCreatedAt).reversed())
                .limit(100)
                .collect(Collectors.toList());
    }

    public DeviceCommand command(String commandId) {
        expirePendingCommands(LocalDateTime.now());
        return requiredCommand(commandId);
    }

    public void validateCommandRequest(DeviceCommandRequest request) {
        require(request != null, "request is required");
        requireText(request.getClientRequestId(), "clientRequestId is required");
        requireText(request.getDeviceCode(), "deviceCode is required");
        requireText(request.getCommandType(), "commandType is required");
        Map<String, Object> parameters = request.effectiveParameters();
        require(parameters != null && !parameters.isEmpty(), "parameters are required");
        requireText(request.getReason(), "reason is required");
        validateCommandSafety(request);
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
        realtimePublisher.publish("ai.decision.changed", audit);

        AiDecisionResponse response = new AiDecisionResponse();
        response.setAuditId(audit.getAuditId());
        response.setKnowledgeVersion(KNOWLEDGE_VERSION);
        response.setDecision(decision);
        response.setValidationStatus(validation);
        response.setReason(reason);
        response.setParameters(parameters);
        if (request.isAutoApply() && "PASSED".equals(validation)) {
            DeviceCommandRequest command = new DeviceCommandRequest();
            command.setClientRequestId("AI-" + audit.getAuditId());
            command.setDeviceCode("LINE-CONTROL-01");
            command.setCommandType("SET_RECIPE");
            command.setPayload(parameters);
            command.setSource("AI_VALIDATED");
            command.setTraceCode(request.getTraceCode());
            command.setOperator("AI_DECISION_CENTER");
            command.setOperatorRole("AI_DECISION");
            command.setReason("AI decision " + audit.getAuditId() + " passed backend safety validation");
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
        realtimePublisher.publish("operations.alarm.changed", alarm);
        reportRuntimeIncident(reading, alarm);
    }

    public int expirePendingCommands(LocalDateTime now) {
        int changed = 0;
        for (DeviceCommand value : commands.values()) {
            synchronized (value) {
                if (expireCommandIfNeeded(value, now)) changed++;
            }
        }
        return changed;
    }

    private boolean expireCommandIfNeeded(DeviceCommand value, LocalDateTime now) {
        if (value == null || value.getExpiresAt() == null) return false;
        if (!"PENDING".equals(value.getStatus()) && !"SENT".equals(value.getStatus())) return false;
        if (!now.isAfter(value.getExpiresAt())) return false;
        value.setStatus("TIMEOUT");
        value.setMessage("No edge acknowledgement before command timeout");
        value.setAcknowledgedAt(now);
        persistence.save(value);
        realtimePublisher.publish("operations.command.changed", value);
        return true;
    }

    private void validateCommandSafety(DeviceCommandRequest request) {
        String role = normalize(request.getOperatorRole(), defaultRole(request.getSource())).toUpperCase(Locale.ROOT);
        require(CONTROL_ROLES.contains(role), "operator role is not allowed to control devices");
        Map<String, Object> parameters = request.effectiveParameters();
        validatePayloadRanges(parameters);
        validateCapability(request, role, parameters);
        if (parameterStateService != null) {
            parameterStateService.validateWritable(request, role, request.getSource());
        }
        if (request.getExpectedStateVersion() != null && stateVersionService != null) {
            require(request.getExpectedStateVersion() == stateVersionService.current(),
                    "stateVersion changed; refresh snapshot before retrying command");
        }
        require(!blockedByOpenAlarm(request), "quality or safety gate is blocking this command");
        DeviceRuntimeState device = runtimeDevice(request.getDeviceCode());
        if (device != null) {
            String state = normalize(device.getState(), "UNKNOWN").toUpperCase(Locale.ROOT);
            require(!Arrays.asList("OFFLINE", "MAINTENANCE", "ALARM", "STOPPED").contains(state),
                    "device is not in a controllable state: " + state);
        }
    }

    private void validatePayloadRanges(Map<String, Object> payload) {
        checkRange(payload, "conveyorSpeedMmS", 30D, 300D);
        checkRange(payload, "fillingTemperatureC", 20D, 30D);
        checkRange(payload, "fillVolumeMl", 50D, 1000D);
        checkRange(payload, "capTorqueNm", .2D, 2D);
        checkRange(payload, "speedMps", 0D, 2D);
        checkRange(payload, "pumpRateMlS", 0D, 1000D);
    }

    private void validateCapability(DeviceCommandRequest request, String role, Map<String, Object> parameters) {
        if (capabilityCatalog == null) return;
        String deviceCode = request.getDeviceCode().trim().toUpperCase(Locale.ROOT);
        String commandType = request.getCommandType().trim().toUpperCase(Locale.ROOT);
        Map<String, Object> capability = capabilityCatalog.control(deviceCode, commandType);
        require(capability != null, "device does not support commandType: " + commandType);
        String stage = capabilityCatalog.stageForDevice(deviceCode);
        if (StringUtils.hasText(request.getStageCode())) {
            require(request.getStageCode().equalsIgnoreCase(stage), "device does not belong to requested stageCode");
        }
        String requiredRole = String.valueOf(capability.get("requiredRole"));
        require(roleLevel(role) >= roleLevel(requiredRole), "operator role does not meet capability requirement: " + requiredRole);
        Object min = capability.get("min");
        Object max = capability.get("max");
        if (min instanceof Number && max instanceof Number && parameters.containsKey("value")) {
            Object raw = parameters.get("value");
            require(raw instanceof Number, "value must be numeric");
            double value = ((Number) raw).doubleValue();
            require(value >= ((Number) min).doubleValue() && value <= ((Number) max).doubleValue(),
                    "value is outside device capability range");
        }
    }

    private int roleLevel(String role) {
        if ("ADMIN".equals(role) || "AI_DECISION".equals(role)) return 4;
        if ("ENGINEER".equals(role)) return 3;
        if ("OPERATOR".equals(role)) return 2;
        return 1;
    }

    private String stageForDevice(String deviceCode) {
        return capabilityCatalog == null ? null : capabilityCatalog.stageForDevice(deviceCode.trim().toUpperCase(Locale.ROOT));
    }

    private String currentCapabilityValue(DeviceCommandRequest request) {
        if (capabilityCatalog == null) return null;
        Map<String, Object> capability = capabilityCatalog.control(
                request.getDeviceCode().trim().toUpperCase(Locale.ROOT),
                request.getCommandType().trim().toUpperCase(Locale.ROOT));
        return capability == null ? null : JSON.toJSONString(capability.get("currentValue"));
    }

    private void checkRange(Map<String, Object> payload, String key, double min, double max) {
        if (!payload.containsKey(key)) return;
        Object raw = payload.get(key);
        if (!(raw instanceof Number)) {
            require(raw instanceof String, key + " must be numeric");
            try {
                raw = Double.valueOf((String) raw);
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException(key + " must be numeric");
            }
        }
        double value = ((Number) raw).doubleValue();
        require(value >= min && value <= max, key + " must be between " + min + " and " + max);
    }

    private boolean blockedByOpenAlarm(DeviceCommandRequest request) {
        String deviceCode = request.getDeviceCode().trim();
        String traceCode = normalize(request.getTraceCode(), null);
        return alarms.values().stream().anyMatch(alarm -> "OPEN".equals(alarm.getStatus())
                && "CRITICAL".equals(alarm.getLevel())
                && (deviceCode.equalsIgnoreCase(alarm.getDeviceCode())
                || (traceCode != null && traceCode.equalsIgnoreCase(alarm.getTraceCode()))));
    }

    private DeviceRuntimeState runtimeDevice(String deviceCode) {
        if (runtimeService == null) return null;
        return runtimeService.snapshot(null).getDevices().stream()
                .filter(item -> item.getDeviceCode().equalsIgnoreCase(deviceCode.trim()))
                .findFirst().orElse(null);
    }

    private DeviceCommand commandByClientRequestId(String clientRequestId) {
        String key = clientRequestId.trim();
        return commands.values().stream()
                .filter(item -> key.equals(item.getClientRequestId()))
                .findFirst().orElse(null);
    }

    private int commandTimeoutSeconds(DeviceCommandRequest request) {
        Integer value = request.getTimeoutSeconds();
        if (value == null) return DEFAULT_COMMAND_TIMEOUT_SECONDS;
        require(value >= 1 && value <= 300, "timeoutSeconds must be between 1 and 300");
        return value;
    }

    private String defaultRole(String source) {
        String normalized = normalize(source, "OPERATOR").toUpperCase(Locale.ROOT);
        return normalized.startsWith("AI") ? "AI_DECISION" : "OPERATOR";
    }

    private String parameterFromCommand(String commandType) {
        String normalized = normalize(commandType, "").toUpperCase(Locale.ROOT);
        return normalized.startsWith("SET_") ? normalized.substring(4) : normalized;
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
