package com.archermind.hdc.operations.model;

import java.time.LocalDateTime;

public class AiAuditRecord {
    private String auditId;
    private String traceCode;
    private String bottleType;
    private String stage;
    private String requestJson;
    private String knowledgeVersion;
    private String recommendationJson;
    private String validationStatus;
    private String decision;
    private String reason;
    private LocalDateTime createdAt;

    public String getAuditId() { return auditId; }
    public void setAuditId(String auditId) { this.auditId = auditId; }
    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public String getBottleType() { return bottleType; }
    public void setBottleType(String bottleType) { this.bottleType = bottleType; }
    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public String getRequestJson() { return requestJson; }
    public void setRequestJson(String requestJson) { this.requestJson = requestJson; }
    public String getKnowledgeVersion() { return knowledgeVersion; }
    public void setKnowledgeVersion(String knowledgeVersion) { this.knowledgeVersion = knowledgeVersion; }
    public String getRecommendationJson() { return recommendationJson; }
    public void setRecommendationJson(String recommendationJson) { this.recommendationJson = recommendationJson; }
    public String getValidationStatus() { return validationStatus; }
    public void setValidationStatus(String validationStatus) { this.validationStatus = validationStatus; }
    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
