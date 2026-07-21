package com.archermind.hdc.operations.dto;

import java.util.LinkedHashMap;
import java.util.Map;

public class AiDecisionResponse {
    private String auditId;
    private String knowledgeVersion;
    private String decision;
    private String validationStatus;
    private String reason;
    private String commandId;
    private Map<String, Object> parameters = new LinkedHashMap<>();

    public String getAuditId() { return auditId; }
    public void setAuditId(String auditId) { this.auditId = auditId; }
    public String getKnowledgeVersion() { return knowledgeVersion; }
    public void setKnowledgeVersion(String knowledgeVersion) { this.knowledgeVersion = knowledgeVersion; }
    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }
    public String getValidationStatus() { return validationStatus; }
    public void setValidationStatus(String validationStatus) { this.validationStatus = validationStatus; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getCommandId() { return commandId; }
    public void setCommandId(String commandId) { this.commandId = commandId; }
    public Map<String, Object> getParameters() { return parameters; }
    public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }
}
