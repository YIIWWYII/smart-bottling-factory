package com.archermind.hdc.logistics.model;

import java.time.LocalDateTime;

public class WarehouseStock {
    private String boxCode;
    private String bottleType;
    private String zoneCode;
    private String locationCode;
    private String status;
    private LocalDateTime inboundAt;

    public String getBoxCode() { return boxCode; }
    public void setBoxCode(String boxCode) { this.boxCode = boxCode; }
    public String getBottleType() { return bottleType; }
    public void setBottleType(String bottleType) { this.bottleType = bottleType; }
    public String getZoneCode() { return zoneCode; }
    public void setZoneCode(String zoneCode) { this.zoneCode = zoneCode; }
    public String getLocationCode() { return locationCode; }
    public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getInboundAt() { return inboundAt; }
    public void setInboundAt(LocalDateTime inboundAt) { this.inboundAt = inboundAt; }
}
