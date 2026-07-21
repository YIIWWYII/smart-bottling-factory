package com.archermind.hdc.logistics.dto;

public class WarehouseTelemetryRequest {
    private double vocPpm;
    private double smoke;
    private double temperatureC;

    public double getVocPpm() { return vocPpm; }
    public void setVocPpm(double vocPpm) { this.vocPpm = vocPpm; }
    public double getSmoke() { return smoke; }
    public void setSmoke(double smoke) { this.smoke = smoke; }
    public double getTemperatureC() { return temperatureC; }
    public void setTemperatureC(double temperatureC) { this.temperatureC = temperatureC; }
}
