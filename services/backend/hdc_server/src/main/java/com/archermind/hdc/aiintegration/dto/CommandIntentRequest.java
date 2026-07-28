package com.archermind.hdc.aiintegration.dto;

import java.util.List;
import java.util.Map;

public class CommandIntentRequest {
    private String idempotencyKey;
    private String decisionId;
    private String correlationId;
    private String originType;
    private String sourceApp;
    private String lineId;
    private String stageCode;
    private String deviceCode;
    private String traceCode;
    private Long contextStateVersion;
    private String reason;
    private List<CommandIntentChange> proposedChanges;

    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getDecisionId() { return decisionId; }
    public void setDecisionId(String decisionId) { this.decisionId = decisionId; }
    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
    public String getOriginType() { return originType; }
    public void setOriginType(String originType) { this.originType = originType; }
    public String getSourceApp() { return sourceApp; }
    public void setSourceApp(String sourceApp) { this.sourceApp = sourceApp; }
    public String getLineId() { return lineId; }
    public void setLineId(String lineId) { this.lineId = lineId; }
    public String getStageCode() { return stageCode; }
    public void setStageCode(String stageCode) { this.stageCode = stageCode; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public Long getContextStateVersion() { return contextStateVersion; }
    public void setContextStateVersion(Long contextStateVersion) { this.contextStateVersion = contextStateVersion; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public List<CommandIntentChange> getProposedChanges() { return proposedChanges; }
    public void setProposedChanges(List<CommandIntentChange> proposedChanges) { this.proposedChanges = proposedChanges; }

    public static class CommandIntentChange {
        private String deviceCode;
        private String parameterCode;
        private String commandType;
        private Object proposedValue;
        private String unit;
        private String reason;
        private Long parameterVersion;
        private String atomicGroupId;
        private Map<String, Object> parameters;

        public String getDeviceCode() { return deviceCode; }
        public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
        public String getParameterCode() { return parameterCode; }
        public void setParameterCode(String parameterCode) { this.parameterCode = parameterCode; }
        public String getCommandType() { return commandType; }
        public void setCommandType(String commandType) { this.commandType = commandType; }
        public Object getProposedValue() { return proposedValue; }
        public void setProposedValue(Object proposedValue) { this.proposedValue = proposedValue; }
        public String getUnit() { return unit; }
        public void setUnit(String unit) { this.unit = unit; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public Long getParameterVersion() { return parameterVersion; }
        public void setParameterVersion(Long parameterVersion) { this.parameterVersion = parameterVersion; }
        public String getAtomicGroupId() { return atomicGroupId; }
        public void setAtomicGroupId(String atomicGroupId) { this.atomicGroupId = atomicGroupId; }
        public Map<String, Object> getParameters() { return parameters; }
        public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }
    }
}
