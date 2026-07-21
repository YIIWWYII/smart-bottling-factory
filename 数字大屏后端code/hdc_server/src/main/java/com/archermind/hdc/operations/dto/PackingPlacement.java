package com.archermind.hdc.operations.dto;

public class PackingPlacement {
    private int index;
    private int row;
    private int column;
    private int layer;
    private double xMm;
    private double yMm;
    private double zMm;
    private double rotationDeg;

    public int getIndex() { return index; }
    public void setIndex(int index) { this.index = index; }
    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }
    public int getColumn() { return column; }
    public void setColumn(int column) { this.column = column; }
    public int getLayer() { return layer; }
    public void setLayer(int layer) { this.layer = layer; }
    public double getXMm() { return xMm; }
    public void setXMm(double xMm) { this.xMm = xMm; }
    public double getYMm() { return yMm; }
    public void setYMm(double yMm) { this.yMm = yMm; }
    public double getZMm() { return zMm; }
    public void setZMm(double zMm) { this.zMm = zMm; }
    public double getRotationDeg() { return rotationDeg; }
    public void setRotationDeg(double rotationDeg) { this.rotationDeg = rotationDeg; }
}
