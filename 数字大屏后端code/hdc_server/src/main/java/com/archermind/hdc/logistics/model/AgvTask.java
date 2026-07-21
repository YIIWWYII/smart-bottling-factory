package com.archermind.hdc.logistics.model;

import java.time.LocalDateTime;

public class AgvTask {
    private String taskId;
    private String agvCode;
    private String boxCode;
    private String source;
    private String destination;
    private double totalDistanceM;
    private double completedDistanceM;
    private double speedMps;
    private double loadKg;
    private double obstacleDistanceCm;
    private String status;
    private String mode;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    public String getAgvCode() { return agvCode; }
    public void setAgvCode(String agvCode) { this.agvCode = agvCode; }
    public String getBoxCode() { return boxCode; }
    public void setBoxCode(String boxCode) { this.boxCode = boxCode; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public double getTotalDistanceM() { return totalDistanceM; }
    public void setTotalDistanceM(double totalDistanceM) { this.totalDistanceM = totalDistanceM; }
    public double getCompletedDistanceM() { return completedDistanceM; }
    public void setCompletedDistanceM(double completedDistanceM) { this.completedDistanceM = completedDistanceM; }
    public double getSpeedMps() { return speedMps; }
    public void setSpeedMps(double speedMps) { this.speedMps = speedMps; }
    public double getLoadKg() { return loadKg; }
    public void setLoadKg(double loadKg) { this.loadKg = loadKg; }
    public double getObstacleDistanceCm() { return obstacleDistanceCm; }
    public void setObstacleDistanceCm(double obstacleDistanceCm) { this.obstacleDistanceCm = obstacleDistanceCm; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
