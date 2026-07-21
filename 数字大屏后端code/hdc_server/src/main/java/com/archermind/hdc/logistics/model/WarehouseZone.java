package com.archermind.hdc.logistics.model;

import java.time.LocalDateTime;

public class WarehouseZone {
    private String zoneCode;
    private double vocPpm;
    private double smoke;
    private double temperatureC;
    private String status;
    private LocalDateTime updatedAt;

    public String getZoneCode() { return zoneCode; }
    public void setZoneCode(String zoneCode) { this.zoneCode = zoneCode; }
    public double getVocPpm() { return vocPpm; }
    public void setVocPpm(double vocPpm) { this.vocPpm = vocPpm; }
    public double getSmoke() { return smoke; }
    public void setSmoke(double smoke) { this.smoke = smoke; }
    public double getTemperatureC() { return temperatureC; }
    public void setTemperatureC(double temperatureC) { this.temperatureC = temperatureC; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
