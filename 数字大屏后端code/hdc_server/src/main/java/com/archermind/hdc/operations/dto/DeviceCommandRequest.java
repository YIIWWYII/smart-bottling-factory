package com.archermind.hdc.operations.dto;

import java.util.Map;

public class DeviceCommandRequest {
    private String deviceCode;
    private String commandType;
    private Map<String, Object> payload;
    private String source;
    private String traceCode;

    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getCommandType() { return commandType; }
    public void setCommandType(String commandType) { this.commandType = commandType; }
    public Map<String, Object> getPayload() { return payload; }
    public void setPayload(Map<String, Object> payload) { this.payload = payload; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
}
