package com.archermind.hdc.operations.dto;

public class CommandAckRequest {
    private String status;
    private String message;
    private String clientRequestId;
    private String deviceCode;
    private String edgeAckId;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getClientRequestId() { return clientRequestId; }
    public void setClientRequestId(String clientRequestId) { this.clientRequestId = clientRequestId; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getEdgeAckId() { return edgeAckId; }
    public void setEdgeAckId(String edgeAckId) { this.edgeAckId = edgeAckId; }
}
