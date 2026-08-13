package com.archermind.hdc.aiintegration.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class CommandIntentRecord {
    private String intentId;
    private String idempotencyKey;
    private String decisionId;
    private String correlationId;
    private String sourceApp;
    private String lineId;
    private String stageCode;
    private String deviceCode;
    private String traceCode;
    private String operator;
    private String operatorRole;
    private Long contextStateVersion;
    private String status;
    private String statusReason;
    private String requestJson;
    private List<String> commandIds = new ArrayList<>();
    private String blockedJson;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public String getIntentId() { return intentId; }
    public void setIntentId(String intentId) { this.intentId = intentId; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getDecisionId() { return decisionId; }
    public void setDecisionId(String decisionId) { this.decisionId = decisionId; }
    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
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
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getOperatorRole() { return operatorRole; }
    public void setOperatorRole(String operatorRole) { this.operatorRole = operatorRole; }
    public Long getContextStateVersion() { return contextStateVersion; }
    public void setContextStateVersion(Long contextStateVersion) { this.contextStateVersion = contextStateVersion; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public String getRequestJson() { return requestJson; }
    public void setRequestJson(String requestJson) { this.requestJson = requestJson; }
    public List<String> getCommandIds() { return commandIds; }
    public void setCommandIds(List<String> commandIds) { this.commandIds = commandIds; }
    public String getBlockedJson() { return blockedJson; }
    public void setBlockedJson(String blockedJson) { this.blockedJson = blockedJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
