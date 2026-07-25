package com.archermind.hdc.factory.simulation;

import java.time.LocalDateTime;

public class SimulationState {
    private String scenarioCode;
    private String status;
    private long tick;
    private LocalDateTime startedAt;
    private LocalDateTime updatedAt;

    public SimulationState copy() {
        SimulationState value = new SimulationState();
        value.scenarioCode = scenarioCode;
        value.status = status;
        value.tick = tick;
        value.startedAt = startedAt;
        value.updatedAt = updatedAt;
        return value;
    }

    public String getScenarioCode() { return scenarioCode; }
    public void setScenarioCode(String scenarioCode) { this.scenarioCode = scenarioCode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public long getTick() { return tick; }
    public void setTick(long tick) { this.tick = tick; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
