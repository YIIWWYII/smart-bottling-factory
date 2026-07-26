package com.archermind.hdc.factory.dto;

public class FactoryStepRequest {
    private String stage;
    private String result;
    private Double value;
    private String defectType;

    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public Double getValue() { return value; }
    public void setValue(Double value) { this.value = value; }
    public String getDefectType() { return defectType; }
    public void setDefectType(String defectType) { this.defectType = defectType; }
}
