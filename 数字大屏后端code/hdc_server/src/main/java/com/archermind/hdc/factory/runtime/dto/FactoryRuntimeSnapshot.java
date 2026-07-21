package com.archermind.hdc.factory.runtime.dto;

import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.model.FactoryIncident;
import com.archermind.hdc.factory.runtime.model.StageRuntimeState;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class FactoryRuntimeSnapshot {
    private LocalDateTime generatedAt;
    private int mqttTimeoutSeconds;
    private List<DeviceRuntimeState> devices = new ArrayList<>();
    private List<StageRuntimeState> stages = new ArrayList<>();
    private List<FactoryIncident> incidents = new ArrayList<>();

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
    public int getMqttTimeoutSeconds() { return mqttTimeoutSeconds; }
    public void setMqttTimeoutSeconds(int mqttTimeoutSeconds) { this.mqttTimeoutSeconds = mqttTimeoutSeconds; }
    public List<DeviceRuntimeState> getDevices() { return devices; }
    public void setDevices(List<DeviceRuntimeState> devices) { this.devices = devices; }
    public List<StageRuntimeState> getStages() { return stages; }
    public void setStages(List<StageRuntimeState> stages) { this.stages = stages; }
    public List<FactoryIncident> getIncidents() { return incidents; }
    public void setIncidents(List<FactoryIncident> incidents) { this.incidents = incidents; }
}
