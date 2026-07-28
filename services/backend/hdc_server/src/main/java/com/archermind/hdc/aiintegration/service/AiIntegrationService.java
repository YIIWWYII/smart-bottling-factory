package com.archermind.hdc.aiintegration.service;

import com.alibaba.fastjson.JSON;
import com.archermind.hdc.aiintegration.dto.CommandIntentRequest;
import com.archermind.hdc.aiintegration.dto.VisionRecognitionRequest;
import com.archermind.hdc.aiintegration.model.CommandIntentRecord;
import com.archermind.hdc.aiintegration.model.VisionRecognitionRecord;
import com.archermind.hdc.auth.model.AdminUser;
import com.archermind.hdc.auth.service.AuthService;
import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.coordination.FactoryRealtimeEventPublisher;
import com.archermind.hdc.factory.coordination.FactoryStateVersionService;
import com.archermind.hdc.factory.contract.FactoryContractService;
import com.archermind.hdc.factory.snapshot.LineSnapshot;
import com.archermind.hdc.factory.snapshot.StageSnapshot;
import com.archermind.hdc.operations.dto.DeviceCommandRequest;
import com.archermind.hdc.operations.model.DeviceCommand;
import com.archermind.hdc.operations.service.OperationsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class AiIntegrationService {
    private final Map<String, CommandIntentRecord> intents = new ConcurrentHashMap<>();
    private final Map<String, VisionRecognitionRecord> recognitions = new ConcurrentHashMap<>();
    private final AuthService authService;
    private final FactoryContractService contractService;
    private final OperationsService operationsService;
    private final DeviceCapabilityCatalog capabilities;
    private final FactoryRealtimeEventPublisher publisher;
    private final AiIntegrationPersistence persistence;

    @Value("${factory.ai.service-token:dev-ai-service-token}")
    private String serviceToken;

    public AiIntegrationService(AuthService authService,
                                FactoryContractService contractService,
                                OperationsService operationsService,
                                DeviceCapabilityCatalog capabilities,
                                FactoryRealtimeEventPublisher publisher,
                                AiIntegrationPersistence persistence) {
        this.authService = authService;
        this.contractService = contractService;
        this.operationsService = operationsService;
        this.capabilities = capabilities;
        this.publisher = publisher;
        this.persistence = persistence;
    }

    public Map<String, Object> facts(String authorization, String subjectAuthorization, String sourceApp,
                                     String lineId, String stageCode, String deviceCode, String traceCode) {
        requireAiService(authorization);
        String source = normalizeSourceApp(sourceApp);
        AdminUser user = authenticateSubjectIfPresent(subjectAuthorization);
        String scopedStage = scopedStage(source, stageCode);
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("sourceApp", source);
        value.put("lineId", text(lineId, FactoryStateVersionService.LINE_ID));
        value.put("requestedAt", LocalDateTime.now());
        value.put("subject", subject(user));
        value.put("scope", scope(source, scopedStage, deviceCode, traceCode, user));
        if (scopedStage == null) {
            LineSnapshot snapshot = contractService.lineSnapshot();
            value.put("lineSnapshot", snapshot);
            value.put("stateVersion", snapshot.getStateVersion());
            value.put("entityIds", lineEntityIds(snapshot));
        } else {
            StageSnapshot snapshot = contractService.stageSnapshot(scopedStage);
            value.put("stageSnapshot", snapshot);
            value.put("stateVersion", snapshot.getStateVersion());
            value.put("entityIds", stageEntityIds(snapshot));
        }
        if (StringUtils.hasText(deviceCode)) {
            value.put("deviceParameters", contractService.deviceParameters(deviceCode));
        }
        return value;
    }

    public VisionRecognitionRecord recognize(String authorization, VisionRecognitionRequest request) {
        requireAiService(authorization);
        require(request != null, "recognition request is required");
        requireText(request.getTaskType(), "taskType is required");
        requireText(request.getCameraCode(), "cameraCode is required");
        requireText(request.getStageCode(), "stageCode is required");
        VisionRecognitionRecord value = new VisionRecognitionRecord();
        value.setInferenceId(text(request.getInferenceId(), "VIR-" + UUID.randomUUID()));
        value.setTaskType(upper(request.getTaskType()));
        value.setCameraCode(upper(request.getCameraCode()));
        value.setLineId(text(request.getLineId(), FactoryStateVersionService.LINE_ID));
        value.setStageCode(upper(request.getStageCode()));
        value.setTraceCode(emptyToNull(request.getTraceCode()));
        value.setBottleTypeCode(emptyToNull(request.getBottleTypeCode()));
        value.setConfidence(request.getConfidence());
        value.setEvidenceRef(emptyToNull(request.getEvidenceRef()));
        value.setModelVersion(text(request.getModelVersion(), "vision-model-demo"));
        value.setStatus(text(request.getStatus(), "SUCCEEDED").toUpperCase(Locale.ROOT));
        value.setLatencyMs(request.getLatencyMs());
        value.setDefectsJson(JSON.toJSONString(request.getDefects() == null ? new ArrayList<>() : request.getDefects()));
        value.setCapturedAt(parseTime(request.getCapturedAt()));
        value.setReceivedAt(LocalDateTime.now());
        recognitions.put(value.getInferenceId(), value);
        persistence.save(value);
        publisher.publish("ai.vision.changed", value.getStageCode(), recognitionPayload(value));
        return value;
    }

    public Map<String, Object> commandIntent(String authorization, String subjectAuthorization,
                                             CommandIntentRequest request) {
        requireAiService(authorization);
        require(request != null, "command intent request is required");
        requireText(request.getDecisionId(), "decisionId is required");
        requireText(request.getIdempotencyKey(), "idempotencyKey is required");
        require(request.getProposedChanges() != null && !request.getProposedChanges().isEmpty(),
                "proposedChanges are required");
        rejectConversationOrigin(request.getOriginType());
        AdminUser operator = authService.authenticate(subjectAuthorization);
        require(!"VIEWER".equals(operator.getRole()), "VIEWER cannot approve AI command intents");

        CommandIntentRecord existing = findIntent(request.getIdempotencyKey());
        if (existing != null) return intentResponse(existing);

        LocalDateTime now = LocalDateTime.now();
        CommandIntentRecord record = new CommandIntentRecord();
        record.setIntentId("ACI-" + UUID.randomUUID());
        record.setIdempotencyKey(request.getIdempotencyKey().trim());
        record.setDecisionId(request.getDecisionId().trim());
        record.setCorrelationId(emptyToNull(request.getCorrelationId()));
        record.setSourceApp(normalizeSourceApp(request.getSourceApp()));
        record.setLineId(text(request.getLineId(), FactoryStateVersionService.LINE_ID));
        record.setStageCode(emptyToNull(request.getStageCode()));
        record.setDeviceCode(emptyToNull(request.getDeviceCode()));
        record.setTraceCode(emptyToNull(request.getTraceCode()));
        record.setOperator(operator.getUsername());
        record.setOperatorRole(operator.getRole());
        record.setContextStateVersion(request.getContextStateVersion());
        record.setRequestJson(JSON.toJSONString(request));
        record.setCreatedAt(now);
        record.setUpdatedAt(now);

        List<Map<String, Object>> blocked = new ArrayList<>();
        List<DeviceCommandRequest> accepted = new ArrayList<>();
        for (List<CommandIntentRequest.CommandIntentChange> group : atomicGroups(request.getProposedChanges())) {
            List<DeviceCommandRequest> candidates = group.stream()
                    .map(change -> commandRequest(record, request, change, operator))
                    .collect(Collectors.toList());
            String blockedReason = validateGroup(candidates);
            if (blockedReason != null) {
                for (DeviceCommandRequest candidate : candidates) {
                    blocked.add(blocked(candidate, blockedReason));
                }
            } else {
                accepted.addAll(candidates);
            }
        }

        List<String> commandIds = new ArrayList<>();
        for (DeviceCommandRequest command : accepted) {
            try {
                commandIds.add(operationsService.createCommand(command).getCommandId());
            } catch (RuntimeException exception) {
                blocked.add(blocked(command, exception.getMessage()));
            }
        }
        record.setCommandIds(commandIds);
        record.setBlockedJson(JSON.toJSONString(blocked));
        if (commandIds.isEmpty()) {
            record.setStatus("BLOCKED");
            record.setStatusReason(blocked.isEmpty() ? "No eligible changes" : "All changes blocked by backend safety gate");
        } else if (!blocked.isEmpty()) {
            record.setStatus("PARTIALLY_BLOCKED");
            record.setStatusReason("Eligible fields accepted; blocked fields were not sent to edge");
        } else {
            record.setStatus("COMMAND_PENDING");
            record.setStatusReason("Accepted by backend safety gate; waiting for edge acknowledgement");
        }
        record.setUpdatedAt(LocalDateTime.now());
        intents.put(record.getIntentId(), record);
        intents.put(record.getIdempotencyKey(), record);
        persistence.save(record);
        publisher.publish("ai.decision.changed", record.getStageCode(), intentResponse(record));
        return intentResponse(record);
    }

    public Map<String, Object> commandStatus(String authorization, String id) {
        requireAiService(authorization);
        CommandIntentRecord intent = findIntent(id);
        if (intent != null) return intentResponse(intent);
        DeviceCommand command = operationsService.command(id);
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("commandId", command.getCommandId());
        value.put("clientRequestId", command.getClientRequestId());
        value.put("decisionId", command.getAiDecisionId());
        value.put("correlationId", command.getCorrelationId());
        value.put("deviceCode", command.getDeviceCode());
        value.put("parameterCode", command.getParameterCode());
        value.put("status", command.getStatus());
        value.put("message", command.getMessage());
        value.put("acceptedStateVersion", command.getAcceptedStateVersion());
        value.put("acceptedParameterVersion", command.getAcceptedParameterVersion());
        value.put("edgeAckId", command.getEdgeAckId());
        value.put("acknowledgedAt", command.getAcknowledgedAt());
        return value;
    }

    private String validateGroup(List<DeviceCommandRequest> candidates) {
        for (DeviceCommandRequest candidate : candidates) {
            try {
                operationsService.validateCommandRequest(candidate);
            } catch (RuntimeException exception) {
                return exception.getMessage();
            }
        }
        return null;
    }

    private DeviceCommandRequest commandRequest(CommandIntentRecord record, CommandIntentRequest request,
                                                CommandIntentRequest.CommandIntentChange change, AdminUser operator) {
        String deviceCode = text(change.getDeviceCode(), request.getDeviceCode());
        String parameterCode = text(change.getParameterCode(), null);
        String commandType = text(change.getCommandType(), commandType(parameterCode));
        Map<String, Object> parameters = change.getParameters();
        if (parameters == null) {
            parameters = new LinkedHashMap<>();
            parameters.put("value", change.getProposedValue());
            if (StringUtils.hasText(change.getUnit())) parameters.put("unit", change.getUnit());
        }
        DeviceCommandRequest value = new DeviceCommandRequest();
        value.setClientRequestId(record.getIntentId() + ":" + deviceCode + ":" + commandType + ":" + parameterCode);
        value.setClientType("AI_SERVICE");
        value.setLineId(record.getLineId());
        value.setStageCode(text(request.getStageCode(), capabilities.stageForDevice(upper(deviceCode))));
        value.setDeviceCode(deviceCode);
        value.setCommandType(commandType);
        value.setParameters(parameters);
        value.setSource("AI_DECISION");
        value.setTraceCode(request.getTraceCode());
        value.setOperator("AI_CENTER:" + operator.getUsername());
        value.setOperatorRole(operator.getRole());
        value.setReason(text(change.getReason(), text(request.getReason(), "AI decision " + request.getDecisionId())));
        value.setExpectedStateVersion(request.getContextStateVersion());
        value.setExpectedParameterVersion(change.getParameterVersion());
        value.setParameterCode(parameterCode);
        value.setAtomicGroupId(emptyToNull(change.getAtomicGroupId()));
        value.setAiDecisionId(record.getDecisionId());
        value.setCorrelationId(record.getCorrelationId());
        return value;
    }

    private List<List<CommandIntentRequest.CommandIntentChange>> atomicGroups(List<CommandIntentRequest.CommandIntentChange> changes) {
        Map<String, List<CommandIntentRequest.CommandIntentChange>> groups = new LinkedHashMap<>();
        int index = 0;
        for (CommandIntentRequest.CommandIntentChange change : changes) {
            String key = StringUtils.hasText(change.getAtomicGroupId()) ? change.getAtomicGroupId() : "single-" + index++;
            groups.computeIfAbsent(key, ignored -> new ArrayList<>()).add(change);
        }
        return new ArrayList<>(groups.values());
    }

    private Map<String, Object> blocked(DeviceCommandRequest command, String reason) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("deviceCode", command.getDeviceCode());
        value.put("parameterCode", command.getParameterCode());
        value.put("commandType", command.getCommandType());
        value.put("atomicGroupId", command.getAtomicGroupId());
        value.put("reason", reason);
        return value;
    }

    private Map<String, Object> intentResponse(CommandIntentRecord record) {
        List<Map<String, Object>> commandResults = commandResults(record.getCommandIds());
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("intentId", record.getIntentId());
        value.put("idempotencyKey", record.getIdempotencyKey());
        value.put("decisionId", record.getDecisionId());
        value.put("correlationId", record.getCorrelationId());
        value.put("sourceApp", record.getSourceApp());
        value.put("lineId", record.getLineId());
        value.put("stageCode", record.getStageCode());
        value.put("deviceCode", record.getDeviceCode());
        value.put("traceCode", record.getTraceCode());
        value.put("operator", record.getOperator());
        value.put("operatorRole", record.getOperatorRole());
        value.put("contextStateVersion", record.getContextStateVersion());
        value.put("status", aggregateStatus(record, commandResults));
        value.put("statusReason", aggregateStatusReason(record, commandResults));
        value.put("commandIds", record.getCommandIds());
        value.put("commandResults", commandResults);
        value.put("blockedChanges", JSON.parseArray(record.getBlockedJson()));
        value.put("createdAt", record.getCreatedAt());
        value.put("updatedAt", record.getUpdatedAt());
        return value;
    }

    private List<Map<String, Object>> commandResults(List<String> commandIds) {
        List<Map<String, Object>> values = new ArrayList<>();
        if (commandIds == null) return values;
        for (String commandId : commandIds) {
            try {
                DeviceCommand command = operationsService.command(commandId);
                Map<String, Object> value = new LinkedHashMap<>();
                value.put("commandId", command.getCommandId());
                value.put("deviceCode", command.getDeviceCode());
                value.put("parameterCode", command.getParameterCode());
                value.put("status", command.getStatus());
                value.put("message", command.getMessage());
                value.put("acceptedStateVersion", command.getAcceptedStateVersion());
                value.put("acceptedParameterVersion", command.getAcceptedParameterVersion());
                value.put("edgeAckId", command.getEdgeAckId());
                value.put("acknowledgedAt", command.getAcknowledgedAt());
                values.add(value);
            } catch (RuntimeException exception) {
                Map<String, Object> missing = new LinkedHashMap<>();
                missing.put("commandId", commandId);
                missing.put("status", "UNKNOWN");
                missing.put("message", exception.getMessage());
                values.add(missing);
            }
        }
        return values;
    }

    private String aggregateStatus(CommandIntentRecord record, List<Map<String, Object>> commandResults) {
        if (commandResults.isEmpty()) return record.getStatus();
        boolean allAck = commandResults.stream().allMatch(item -> "ACKNOWLEDGED".equals(item.get("status")));
        if (allAck) return "APPLIED";
        boolean anyPending = commandResults.stream().anyMatch(item -> "PENDING".equals(item.get("status")) || "SENT".equals(item.get("status")));
        if (anyPending) return record.getStatus();
        boolean anyFailed = commandResults.stream().anyMatch(item -> Arrays.asList("FAILED", "TIMEOUT", "CANCELLED", "UNKNOWN").contains(item.get("status")));
        if (anyFailed && "PARTIALLY_BLOCKED".equals(record.getStatus())) return "PARTIALLY_BLOCKED";
        if (anyFailed) return "FAILED";
        return record.getStatus();
    }

    private String aggregateStatusReason(CommandIntentRecord record, List<Map<String, Object>> commandResults) {
        String status = aggregateStatus(record, commandResults);
        if ("APPLIED".equals(status)) return "All backend commands were acknowledged by edge";
        if ("FAILED".equals(status)) return "One or more backend commands failed before acknowledgement";
        return record.getStatusReason();
    }

    private CommandIntentRecord findIntent(String id) {
        CommandIntentRecord value = intents.get(id);
        if (value != null) return value;
        value = persistence.findIntent(id);
        if (value != null) {
            intents.put(value.getIntentId(), value);
            intents.put(value.getIdempotencyKey(), value);
        }
        return value;
    }

    private Map<String, Object> recognitionPayload(VisionRecognitionRecord record) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("inferenceId", record.getInferenceId());
        value.put("taskType", record.getTaskType());
        value.put("cameraCode", record.getCameraCode());
        value.put("lineId", record.getLineId());
        value.put("stageCode", record.getStageCode());
        value.put("traceCode", record.getTraceCode());
        value.put("bottleTypeCode", record.getBottleTypeCode());
        value.put("confidence", record.getConfidence());
        value.put("evidenceRef", record.getEvidenceRef());
        value.put("modelVersion", record.getModelVersion());
        value.put("status", record.getStatus());
        value.put("latencyMs", record.getLatencyMs());
        value.put("defects", JSON.parseArray(record.getDefectsJson()));
        value.put("capturedAt", record.getCapturedAt());
        value.put("receivedAt", record.getReceivedAt());
        return value;
    }

    private Map<String, Object> lineEntityIds(LineSnapshot snapshot) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("stages", snapshot.getStages().stream().map(item -> item.get("stageCode")).collect(Collectors.toList()));
        value.put("products", snapshot.getRecentProducts().stream().map(item -> item.get("traceCode")).collect(Collectors.toList()));
        return value;
    }

    private Map<String, Object> stageEntityIds(StageSnapshot snapshot) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("stage", snapshot.getStageCode());
        value.put("devices", snapshot.getDevices().stream().map(item -> item.get("deviceCode")).collect(Collectors.toList()));
        value.put("products", snapshot.getProducts().stream().map(item -> item.get("traceCode")).collect(Collectors.toList()));
        value.put("alarms", snapshot.getAlarms());
        return value;
    }

    private Map<String, Object> scope(String sourceApp, String stageCode, String deviceCode, String traceCode, AdminUser user) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("sourceApp", sourceApp);
        value.put("stageCode", stageCode);
        value.put("deviceCode", emptyToNull(deviceCode));
        value.put("traceCode", emptyToNull(traceCode));
        value.put("readOnly", user == null || "VIEWER".equals(user.getRole()) || "DISPLAY".equals(sourceApp));
        return value;
    }

    private Map<String, Object> subject(AdminUser user) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("authenticated", user != null);
        if (user != null) {
            value.put("userId", String.valueOf(user.getId()));
            value.put("username", user.getUsername());
            value.put("role", user.getRole());
        }
        return value;
    }

    private void requireAiService(String authorization) {
        String token = normalizeBearer(authorization);
        require(StringUtils.hasText(token) && token.equals(serviceToken), "AI_SERVICE token is invalid");
    }

    private AdminUser authenticateSubjectIfPresent(String authorization) {
        return StringUtils.hasText(authorization) ? authService.authenticate(authorization) : null;
    }

    private void rejectConversationOrigin(String originType) {
        if (!StringUtils.hasText(originType)) return;
        String value = originType.trim().toUpperCase(Locale.ROOT);
        require(!Arrays.asList("ASSISTANT_MESSAGE", "CONVERSATION", "FREE_TEXT", "CHAT").contains(value),
                "assistant conversation/message cannot create command-intent");
    }

    private String scopedStage(String sourceApp, String stageCode) {
        if (!"WORKSTATION".equals(sourceApp)) return emptyToNull(stageCode);
        requireText(stageCode, "WORKSTATION facts require stageCode");
        return upper(stageCode);
    }

    private String normalizeSourceApp(String value) {
        String source = text(value, "ADMIN").toUpperCase(Locale.ROOT);
        require(Arrays.asList("DISPLAY", "WORKSTATION", "ADMIN").contains(source),
                "sourceApp must be DISPLAY, WORKSTATION or ADMIN");
        return source;
    }

    private String commandType(String parameterCode) {
        String parameter = upper(parameterCode);
        return parameter.startsWith("SET_") || parameter.startsWith("REJECT_") ? parameter : "SET_" + parameter;
    }

    private LocalDateTime parseTime(String value) {
        if (!StringUtils.hasText(value)) return LocalDateTime.now();
        try {
            return OffsetDateTime.parse(value).toLocalDateTime();
        } catch (RuntimeException ignored) {
            return LocalDateTime.parse(value);
        }
    }

    private String normalizeBearer(String authorization) {
        if (!StringUtils.hasText(authorization)) return null;
        String value = authorization.trim();
        return value.regionMatches(true, 0, "Bearer ", 0, 7) ? value.substring(7).trim() : value;
    }

    private String text(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String emptyToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private void requireText(String value, String message) {
        require(StringUtils.hasText(value), message);
    }

    private void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }
}
