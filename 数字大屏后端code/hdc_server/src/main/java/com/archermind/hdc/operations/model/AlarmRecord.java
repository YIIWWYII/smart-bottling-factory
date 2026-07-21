package com.archermind.hdc.operations.model;

import java.time.LocalDateTime;

public class AlarmRecord {
    private String alarmId;
    private String deviceCode;
    private String traceCode;
    private String alarmType;
    private String level;
    private String status;
    private String message;
    private Double value;
    private Double limitValue;
    private LocalDateTime occurredAt;
    private LocalDateTime acknowledgedAt;

    public String getAlarmId() { return alarmId; }
    public void setAlarmId(String alarmId) { this.alarmId = alarmId; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public String getAlarmType() { return alarmType; }
    public void setAlarmType(String alarmType) { this.alarmType = alarmType; }
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Double getValue() { return value; }
    public void setValue(Double value) { this.value = value; }
    public Double getLimitValue() { return limitValue; }
    public void setLimitValue(Double limitValue) { this.limitValue = limitValue; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }
    public LocalDateTime getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(LocalDateTime acknowledgedAt) { this.acknowledgedAt = acknowledgedAt; }
}
