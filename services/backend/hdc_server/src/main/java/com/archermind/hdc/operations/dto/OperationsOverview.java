package com.archermind.hdc.operations.dto;

import com.archermind.hdc.operations.model.AiAuditRecord;
import com.archermind.hdc.operations.model.AlarmRecord;
import com.archermind.hdc.operations.model.DeviceCommand;
import com.archermind.hdc.operations.model.SensorReading;

import java.util.ArrayList;
import java.util.List;

public class OperationsOverview {
    private List<SensorReading> latestReadings = new ArrayList<>();
    private List<AlarmRecord> alarms = new ArrayList<>();
    private List<DeviceCommand> commands = new ArrayList<>();
    private List<AiAuditRecord> aiAudits = new ArrayList<>();

    public List<SensorReading> getLatestReadings() { return latestReadings; }
    public void setLatestReadings(List<SensorReading> latestReadings) { this.latestReadings = latestReadings; }
    public List<AlarmRecord> getAlarms() { return alarms; }
    public void setAlarms(List<AlarmRecord> alarms) { this.alarms = alarms; }
    public List<DeviceCommand> getCommands() { return commands; }
    public void setCommands(List<DeviceCommand> commands) { this.commands = commands; }
    public List<AiAuditRecord> getAiAudits() { return aiAudits; }
    public void setAiAudits(List<AiAuditRecord> aiAudits) { this.aiAudits = aiAudits; }
}
