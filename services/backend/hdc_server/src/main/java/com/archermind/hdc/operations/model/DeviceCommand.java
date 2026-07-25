package com.archermind.hdc.operations.model;

import java.time.LocalDateTime;

public class DeviceCommand {
    private String commandId;
    private String clientRequestId;
    private String clientType;
    private String lineId;
    private String stageCode;
    private String deviceCode;
    private String commandType;
    private String payload;
    private String source;
    private String traceCode;
    private String operator;
    private String operatorRole;
    private String reason;
    private Long expectedStateVersion;
    private Long acceptedStateVersion;
    private String recipeVersion;
    private String oldValue;
    private String newValue;
    private String safetyValidation;
    private String status;
    private String message;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private LocalDateTime acknowledgedAt;
    private String edgeAckId;

    public String getCommandId() { return commandId; }
    public void setCommandId(String commandId) { this.commandId = commandId; }
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
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
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
    public Long getExpectedStateVersion() { return expectedStateVersion; }
    public void setExpectedStateVersion(Long expectedStateVersion) { this.expectedStateVersion = expectedStateVersion; }
    public Long getAcceptedStateVersion() { return acceptedStateVersion; }
    public void setAcceptedStateVersion(Long acceptedStateVersion) { this.acceptedStateVersion = acceptedStateVersion; }
    public String getRecipeVersion() { return recipeVersion; }
    public void setRecipeVersion(String recipeVersion) { this.recipeVersion = recipeVersion; }
    public String getOldValue() { return oldValue; }
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }
    public String getNewValue() { return newValue; }
    public void setNewValue(String newValue) { this.newValue = newValue; }
    public String getSafetyValidation() { return safetyValidation; }
    public void setSafetyValidation(String safetyValidation) { this.safetyValidation = safetyValidation; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public LocalDateTime getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(LocalDateTime acknowledgedAt) { this.acknowledgedAt = acknowledgedAt; }
    public String getEdgeAckId() { return edgeAckId; }
    public void setEdgeAckId(String edgeAckId) { this.edgeAckId = edgeAckId; }
}
