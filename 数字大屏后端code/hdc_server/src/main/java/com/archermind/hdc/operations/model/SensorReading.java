package com.archermind.hdc.operations.model;

import java.time.LocalDateTime;

public class SensorReading {
    private String readingId;
    private String deviceCode;
    private String sensorType;
    private String stage;
    private String traceCode;
    private Double value;
    private String unit;
    private String quality;
    private String mode;
    private LocalDateTime occurredAt;

    public String getReadingId() { return readingId; }
    public void setReadingId(String readingId) { this.readingId = readingId; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getSensorType() { return sensorType; }
    public void setSensorType(String sensorType) { this.sensorType = sensorType; }
    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public Double getValue() { return value; }
    public void setValue(Double value) { this.value = value; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getQuality() { return quality; }
    public void setQuality(String quality) { this.quality = quality; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }
}
