package com.archermind.hdc.operations.dto;

import java.util.Map;

public class DeviceCommandRequest {
    private String clientRequestId;
    private String clientType;
    private String lineId;
    private String stageCode;
    private String deviceCode;
    private String commandType;
    private Map<String, Object> payload;
    private Map<String, Object> parameters;
    private String source;
    private String traceCode;
    private String operator;
    private String operatorRole;
    private String reason;
    private Integer timeoutSeconds;
    private Long expectedStateVersion;
    private String recipeVersion;

    public String getClientRequestId() { return clientRequestId; }
    public void setClientRequestId(String clientRequestId) { this.clientRequestId = clientRequestId; }
    public String getClientType() { return clientType; }
    public void setClientType(String clientType) { this.clientType = clientType; }
    public String getLineId() { return lineId; }
    public void setLineId(String lineId) { this.lineId = lineId; }
    public String getStageCode() { return stageCode; }
    public void setStageCode(String stageCode) { this.stageCode = stageCode; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getCommandType() { return commandType; }
    public void setCommandType(String commandType) { this.commandType = commandType; }
    public Map<String, Object> getPayload() { return payload; }
    public void setPayload(Map<String, Object> payload) { this.payload = payload; }
    public Map<String, Object> getParameters() { return parameters; }
    public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }
    public Map<String, Object> effectiveParameters() { return parameters == null ? payload : parameters; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getOperatorRole() { return operatorRole; }
    public void setOperatorRole(String operatorRole) { this.operatorRole = operatorRole; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Integer getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(Integer timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
    public Long getExpectedStateVersion() { return expectedStateVersion; }
    public void setExpectedStateVersion(Long expectedStateVersion) { this.expectedStateVersion = expectedStateVersion; }
    public String getRecipeVersion() { return recipeVersion; }
    public void setRecipeVersion(String recipeVersion) { this.recipeVersion = recipeVersion; }
}
