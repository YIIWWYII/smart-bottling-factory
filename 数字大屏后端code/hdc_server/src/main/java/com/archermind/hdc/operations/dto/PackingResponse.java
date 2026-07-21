package com.archermind.hdc.operations.dto;

import java.util.ArrayList;
import java.util.List;

public class PackingResponse {
    private boolean fit;
    private String bottleType;
    private int count;
    private int rows;
    private int columns;
    private int layers;
    private String message;
    private List<PackingPlacement> placements = new ArrayList<>();

    public boolean isFit() { return fit; }
    public void setFit(boolean fit) { this.fit = fit; }
    public String getBottleType() { return bottleType; }
    public void setBottleType(String bottleType) { this.bottleType = bottleType; }
    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }
    public int getRows() { return rows; }
    public void setRows(int rows) { this.rows = rows; }
    public int getColumns() { return columns; }
    public void setColumns(int columns) { this.columns = columns; }
    public int getLayers() { return layers; }
    public void setLayers(int layers) { this.layers = layers; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public List<PackingPlacement> getPlacements() { return placements; }
    public void setPlacements(List<PackingPlacement> placements) { this.placements = placements; }
}
