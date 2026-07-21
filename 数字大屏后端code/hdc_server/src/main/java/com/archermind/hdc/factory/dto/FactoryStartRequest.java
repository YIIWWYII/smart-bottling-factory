package com.archermind.hdc.factory.dto;

public class FactoryStartRequest {
    private String traceCode;
    private String bottleType;
    private String scenario;

    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public String getBottleType() { return bottleType; }
    public void setBottleType(String bottleType) { this.bottleType = bottleType; }
    public String getScenario() { return scenario; }
    public void setScenario(String scenario) { this.scenario = scenario; }
}
