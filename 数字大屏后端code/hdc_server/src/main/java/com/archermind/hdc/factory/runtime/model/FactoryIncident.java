package com.archermind.hdc.factory.runtime.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class FactoryIncident {
    private String incidentId;
    private String traceCode;
    private String stageCode;
    private String deviceCode;
    private String incidentType;
    private String message;
    private String strategy;
    private String targetStage;
    private String status;
    private String resolutionAction;
    private String resolutionNote;
    private List<String> affectedStages = new ArrayList<>();
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }
    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public String getStageCode() { return stageCode; }
    public void setStageCode(String stageCode) { this.stageCode = stageCode; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getIncidentType() { return incidentType; }
    public void setIncidentType(String incidentType) { this.incidentType = incidentType; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getStrategy() { return strategy; }
    public void setStrategy(String strategy) { this.strategy = strategy; }
    public String getTargetStage() { return targetStage; }
    public void setTargetStage(String targetStage) { this.targetStage = targetStage; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getResolutionAction() { return resolutionAction; }
    public void setResolutionAction(String resolutionAction) { this.resolutionAction = resolutionAction; }
    public String getResolutionNote() { return resolutionNote; }
    public void setResolutionNote(String resolutionNote) { this.resolutionNote = resolutionNote; }
    public List<String> getAffectedStages() { return affectedStages; }
    public void setAffectedStages(List<String> affectedStages) { this.affectedStages = affectedStages; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}
