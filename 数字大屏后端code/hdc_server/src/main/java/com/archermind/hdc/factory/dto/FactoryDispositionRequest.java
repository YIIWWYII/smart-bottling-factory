package com.archermind.hdc.factory.dto;

public class FactoryDispositionRequest {
    private String action;
    private String targetStage;
    private String incidentId;
    private String note;

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getTargetStage() { return targetStage; }
    public void setTargetStage(String targetStage) { this.targetStage = targetStage; }
    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
