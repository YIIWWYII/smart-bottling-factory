package com.archermind.hdc.factory.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class FactoryRun {
    private String traceCode;
    private String batchCode;
    private String bottleType;
    private String scenario;
    private String currentStage;
    private String status;
    private Double voc;
    private Double beverageTemperature;
    private Double beverageHumidity;
    private String defectType;
    private String boxCode;
    private String agvTaskCode;
    private String warehouseLocation;
    private LocalDateTime startedAt;
    private LocalDateTime updatedAt;
    private List<FactoryEvent> events = new ArrayList<>();

    public FactoryRun() {
    }

    public FactoryRun copy() {
        FactoryRun copy = new FactoryRun();
        copy.traceCode = traceCode;
        copy.batchCode = batchCode;
        copy.bottleType = bottleType;
        copy.scenario = scenario;
        copy.currentStage = currentStage;
        copy.status = status;
        copy.voc = voc;
        copy.beverageTemperature = beverageTemperature;
        copy.beverageHumidity = beverageHumidity;
        copy.defectType = defectType;
        copy.boxCode = boxCode;
        copy.agvTaskCode = agvTaskCode;
        copy.warehouseLocation = warehouseLocation;
        copy.startedAt = startedAt;
        copy.updatedAt = updatedAt;
        copy.events = new ArrayList<>(events);
        return copy;
    }

    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public String getBatchCode() { return batchCode; }
    public void setBatchCode(String batchCode) { this.batchCode = batchCode; }
    public String getBottleType() { return bottleType; }
    public void setBottleType(String bottleType) { this.bottleType = bottleType; }
    public String getScenario() { return scenario; }
    public void setScenario(String scenario) { this.scenario = scenario; }
    public String getCurrentStage() { return currentStage; }
    public void setCurrentStage(String currentStage) { this.currentStage = currentStage; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Double getVoc() { return voc; }
    public void setVoc(Double voc) { this.voc = voc; }
    public Double getBeverageTemperature() { return beverageTemperature; }
    public void setBeverageTemperature(Double beverageTemperature) { this.beverageTemperature = beverageTemperature; }
    public Double getBeverageHumidity() { return beverageHumidity; }
    public void setBeverageHumidity(Double beverageHumidity) { this.beverageHumidity = beverageHumidity; }
    public String getDefectType() { return defectType; }
    public void setDefectType(String defectType) { this.defectType = defectType; }
    public String getBoxCode() { return boxCode; }
    public void setBoxCode(String boxCode) { this.boxCode = boxCode; }
    public String getAgvTaskCode() { return agvTaskCode; }
    public void setAgvTaskCode(String agvTaskCode) { this.agvTaskCode = agvTaskCode; }
    public String getWarehouseLocation() { return warehouseLocation; }
    public void setWarehouseLocation(String warehouseLocation) { this.warehouseLocation = warehouseLocation; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<FactoryEvent> getEvents() { return events; }
    public void setEvents(List<FactoryEvent> events) { this.events = events; }
}
