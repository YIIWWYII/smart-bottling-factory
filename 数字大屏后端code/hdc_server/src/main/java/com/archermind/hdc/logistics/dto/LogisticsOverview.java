package com.archermind.hdc.logistics.dto;

import com.archermind.hdc.logistics.model.AgvTask;
import com.archermind.hdc.logistics.model.WarehouseStock;
import com.archermind.hdc.logistics.model.WarehouseZone;

import java.util.ArrayList;
import java.util.List;

public class LogisticsOverview {
    private List<AgvTask> tasks = new ArrayList<>();
    private List<WarehouseZone> zones = new ArrayList<>();
    private List<WarehouseStock> stock = new ArrayList<>();

    public List<AgvTask> getTasks() { return tasks; }
    public void setTasks(List<AgvTask> tasks) { this.tasks = tasks; }
    public List<WarehouseZone> getZones() { return zones; }
    public void setZones(List<WarehouseZone> zones) { this.zones = zones; }
    public List<WarehouseStock> getStock() { return stock; }
    public void setStock(List<WarehouseStock> stock) { this.stock = stock; }
}
