package com.archermind.hdc.factory.runtime.dto;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

public class DeviceTelemetryRequest {
    private String stageCode;
    private String deviceCode;
    private String state;
    private String source;
    private Double speedMps;
    private Double progress;
    private LocalDateTime occurredAt;
    private Map<String, Object> metrics = new LinkedHashMap<>();

    public String getStageCode() { return stageCode; }
    public void setStageCode(String stageCode) { this.stageCode = stageCode; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Double getSpeedMps() { return speedMps; }
    public void setSpeedMps(Double speedMps) { this.speedMps = speedMps; }
    public Double getProgress() { return progress; }
    public void setProgress(Double progress) { this.progress = progress; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }
    public Map<String, Object> getMetrics() { return metrics; }
    public void setMetrics(Map<String, Object> metrics) { this.metrics = metrics; }
}
