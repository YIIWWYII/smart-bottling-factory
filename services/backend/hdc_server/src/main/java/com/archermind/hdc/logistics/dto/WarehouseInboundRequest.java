package com.archermind.hdc.logistics.dto;

public class WarehouseInboundRequest {
    private String taskId;
    private String boxCode;
    private String bottleType;
    private String zoneCode;
    private String locationCode;

    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    public String getBoxCode() { return boxCode; }
    public void setBoxCode(String boxCode) { this.boxCode = boxCode; }
    public String getBottleType() { return bottleType; }
    public void setBottleType(String bottleType) { this.bottleType = bottleType; }
    public String getZoneCode() { return zoneCode; }
    public void setZoneCode(String zoneCode) { this.zoneCode = zoneCode; }
    public String getLocationCode() { return locationCode; }
    public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
}
