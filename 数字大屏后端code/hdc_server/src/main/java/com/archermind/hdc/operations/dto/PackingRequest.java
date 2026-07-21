package com.archermind.hdc.operations.dto;

public class PackingRequest {
    private String bottleType;
    private double bottleWidthMm;
    private double bottleLengthMm;
    private double bottleHeightMm;
    private double boxWidthMm;
    private double boxLengthMm;
    private double boxHeightMm;
    private boolean allowRotation = true;

    public String getBottleType() { return bottleType; }
    public void setBottleType(String bottleType) { this.bottleType = bottleType; }
    public double getBottleWidthMm() { return bottleWidthMm; }
    public void setBottleWidthMm(double bottleWidthMm) { this.bottleWidthMm = bottleWidthMm; }
    public double getBottleLengthMm() { return bottleLengthMm; }
    public void setBottleLengthMm(double bottleLengthMm) { this.bottleLengthMm = bottleLengthMm; }
    public double getBottleHeightMm() { return bottleHeightMm; }
    public void setBottleHeightMm(double bottleHeightMm) { this.bottleHeightMm = bottleHeightMm; }
    public double getBoxWidthMm() { return boxWidthMm; }
    public void setBoxWidthMm(double boxWidthMm) { this.boxWidthMm = boxWidthMm; }
    public double getBoxLengthMm() { return boxLengthMm; }
    public void setBoxLengthMm(double boxLengthMm) { this.boxLengthMm = boxLengthMm; }
    public double getBoxHeightMm() { return boxHeightMm; }
    public void setBoxHeightMm(double boxHeightMm) { this.boxHeightMm = boxHeightMm; }
    public boolean isAllowRotation() { return allowRotation; }
    public void setAllowRotation(boolean allowRotation) { this.allowRotation = allowRotation; }
}
