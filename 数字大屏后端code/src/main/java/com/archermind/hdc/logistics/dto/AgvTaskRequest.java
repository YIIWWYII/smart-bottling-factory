package com.archermind.hdc.logistics.dto;

public class AgvTaskRequest {
    private String boxCode;
    private String source;
    private String destination;
    private double totalDistanceM;
    private double loadKg;
    private String mode;

    public String getBoxCode() { return boxCode; }
    public void setBoxCode(String boxCode) { this.boxCode = boxCode; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public double getTotalDistanceM() { return totalDistanceM; }
    public void setTotalDistanceM(double totalDistanceM) { this.totalDistanceM = totalDistanceM; }
    public double getLoadKg() { return loadKg; }
    public void setLoadKg(double loadKg) { this.loadKg = loadKg; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
}
