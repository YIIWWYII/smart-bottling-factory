package com.archermind.hdc.factory.runtime.dto;

public class IncidentResolutionRequest {
    private String action;
    private String targetStage;
    private String note;

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getTargetStage() { return targetStage; }
    public void setTargetStage(String targetStage) { this.targetStage = targetStage; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
