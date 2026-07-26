package com.archermind.hdc.factory.snapshot;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class StageSnapshot {
    private String lineId;
    private String stageCode;
    private String stageName;
    private String state;
    private String stateReason;
    private long stateVersion;
    private OffsetDateTime generatedAt;
    private String dataMode;
    private Map<String, Object> workOrder;
    private List<Map<String, Object>> devices = new ArrayList<>();
    private List<Map<String, Object>> products = new ArrayList<>();
    private List<Map<String, Object>> qualityGates = new ArrayList<>();
    private Map<String, Object> buffer = new LinkedHashMap<>();
    private List<?> incidents = new ArrayList<>();
    private List<?> alarms = new ArrayList<>();
    private Map<String, Object> activeRecipe;
    private Map<String, Object> aiDecision;
    private List<Map<String, Object>> upstream = new ArrayList<>();
    private List<Map<String, Object>> downstream = new ArrayList<>();
    private String capabilityVersion;

    public String getLineId() { return lineId; }
    public void setLineId(String lineId) { this.lineId = lineId; }
    public String getStageCode() { return stageCode; }
    public void setStageCode(String stageCode) { this.stageCode = stageCode; }
    public String getStageName() { return stageName; }
    public void setStageName(String stageName) { this.stageName = stageName; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getStateReason() { return stateReason; }
    public void setStateReason(String stateReason) { this.stateReason = stateReason; }
    public long getStateVersion() { return stateVersion; }
    public void setStateVersion(long stateVersion) { this.stateVersion = stateVersion; }
    public OffsetDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(OffsetDateTime generatedAt) { this.generatedAt = generatedAt; }
    public String getDataMode() { return dataMode; }
    public void setDataMode(String dataMode) { this.dataMode = dataMode; }
    public Map<String, Object> getWorkOrder() { return workOrder; }
    public void setWorkOrder(Map<String, Object> workOrder) { this.workOrder = workOrder; }
    public List<Map<String, Object>> getDevices() { return devices; }
    public void setDevices(List<Map<String, Object>> devices) { this.devices = devices; }
    public List<Map<String, Object>> getProducts() { return products; }
    public void setProducts(List<Map<String, Object>> products) { this.products = products; }
    public List<Map<String, Object>> getQualityGates() { return qualityGates; }
    public void setQualityGates(List<Map<String, Object>> qualityGates) { this.qualityGates = qualityGates; }
    public Map<String, Object> getBuffer() { return buffer; }
    public void setBuffer(Map<String, Object> buffer) { this.buffer = buffer; }
    public List<?> getIncidents() { return incidents; }
    public void setIncidents(List<?> incidents) { this.incidents = incidents; }
    public List<?> getAlarms() { return alarms; }
    public void setAlarms(List<?> alarms) { this.alarms = alarms; }
    public Map<String, Object> getActiveRecipe() { return activeRecipe; }
    public void setActiveRecipe(Map<String, Object> activeRecipe) { this.activeRecipe = activeRecipe; }
    public Map<String, Object> getAiDecision() { return aiDecision; }
    public void setAiDecision(Map<String, Object> aiDecision) { this.aiDecision = aiDecision; }
    public List<Map<String, Object>> getUpstream() { return upstream; }
    public void setUpstream(List<Map<String, Object>> upstream) { this.upstream = upstream; }
    public List<Map<String, Object>> getDownstream() { return downstream; }
    public void setDownstream(List<Map<String, Object>> downstream) { this.downstream = downstream; }
    public String getCapabilityVersion() { return capabilityVersion; }
    public void setCapabilityVersion(String capabilityVersion) { this.capabilityVersion = capabilityVersion; }
}
