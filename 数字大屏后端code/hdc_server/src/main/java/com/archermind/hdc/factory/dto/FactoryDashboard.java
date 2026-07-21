package com.archermind.hdc.factory.dto;

import com.archermind.hdc.factory.model.FactoryRun;

import java.util.ArrayList;
import java.util.List;

public class FactoryDashboard {
    private int total;
    private int running;
    private int completed;
    private int rejected;
    private int holding;
    private List<FactoryRun> runs = new ArrayList<>();

    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }
    public int getRunning() { return running; }
    public void setRunning(int running) { this.running = running; }
    public int getCompleted() { return completed; }
    public void setCompleted(int completed) { this.completed = completed; }
    public int getRejected() { return rejected; }
    public void setRejected(int rejected) { this.rejected = rejected; }
    public int getHolding() { return holding; }
    public void setHolding(int holding) { this.holding = holding; }
    public List<FactoryRun> getRuns() { return runs; }
    public void setRuns(List<FactoryRun> runs) { this.runs = runs; }
}
