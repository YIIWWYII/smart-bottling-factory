package com.archermind.hdc.operations.dto;

import java.util.Map;

public class AiDecisionRequest {
    private String traceCode;
    private String bottleType;
    private String stage;
    private Map<String, Object> observations;
    private boolean autoApply;

    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public String getBottleType() { return bottleType; }
    public void setBottleType(String bottleType) { this.bottleType = bottleType; }
    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public Map<String, Object> getObservations() { return observations; }
    public void setObservations(Map<String, Object> observations) { this.observations = observations; }
    public boolean isAutoApply() { return autoApply; }
    public void setAutoApply(boolean autoApply) { this.autoApply = autoApply; }
}
