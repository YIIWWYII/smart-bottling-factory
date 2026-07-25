package com.archermind.hdc.factory.snapshot;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class LineSnapshot {
    private String lineId;
    private String lineName;
    private long stateVersion;
    private OffsetDateTime generatedAt;
    private String dataMode;
    private List<Map<String, Object>> stages = new ArrayList<>();
    private Map<String, Object> production = new LinkedHashMap<>();
    private Map<String, Object> logistics = new LinkedHashMap<>();
    private Map<String, Object> warehouse = new LinkedHashMap<>();
    private List<?> activeIncidents = new ArrayList<>();
    private List<Map<String, Object>> recentProducts = new ArrayList<>();

    public String getLineId() { return lineId; }
    public void setLineId(String lineId) { this.lineId = lineId; }
    public String getLineName() { return lineName; }
    public void setLineName(String lineName) { this.lineName = lineName; }
    public long getStateVersion() { return stateVersion; }
    public void setStateVersion(long stateVersion) { this.stateVersion = stateVersion; }
    public OffsetDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(OffsetDateTime generatedAt) { this.generatedAt = generatedAt; }
    public String getDataMode() { return dataMode; }
    public void setDataMode(String dataMode) { this.dataMode = dataMode; }
    public List<Map<String, Object>> getStages() { return stages; }
    public void setStages(List<Map<String, Object>> stages) { this.stages = stages; }
    public Map<String, Object> getProduction() { return production; }
    public void setProduction(Map<String, Object> production) { this.production = production; }
    public Map<String, Object> getLogistics() { return logistics; }
    public void setLogistics(Map<String, Object> logistics) { this.logistics = logistics; }
    public Map<String, Object> getWarehouse() { return warehouse; }
    public void setWarehouse(Map<String, Object> warehouse) { this.warehouse = warehouse; }
    public List<?> getActiveIncidents() { return activeIncidents; }
    public void setActiveIncidents(List<?> activeIncidents) { this.activeIncidents = activeIncidents; }
    public List<Map<String, Object>> getRecentProducts() { return recentProducts; }
    public void setRecentProducts(List<Map<String, Object>> recentProducts) { this.recentProducts = recentProducts; }
}
