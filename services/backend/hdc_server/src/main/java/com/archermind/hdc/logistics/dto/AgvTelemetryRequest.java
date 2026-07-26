package com.archermind.hdc.logistics.dto;

public class AgvTelemetryRequest {
    private double speedMps;
    private double completedDistanceM;
    private double obstacleDistanceCm;
    private double loadKg;

    public double getSpeedMps() { return speedMps; }
    public void setSpeedMps(double speedMps) { this.speedMps = speedMps; }
    public double getCompletedDistanceM() { return completedDistanceM; }
    public void setCompletedDistanceM(double completedDistanceM) { this.completedDistanceM = completedDistanceM; }
    public double getObstacleDistanceCm() { return obstacleDistanceCm; }
    public void setObstacleDistanceCm(double obstacleDistanceCm) { this.obstacleDistanceCm = obstacleDistanceCm; }
    public double getLoadKg() { return loadKg; }
    public void setLoadKg(double loadKg) { this.loadKg = loadKg; }
}
