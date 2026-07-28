package com.archermind.hdc.aiintegration.model;

import java.time.LocalDateTime;

public class VisionRecognitionRecord {
    private String inferenceId;
    private String taskType;
    private String cameraCode;
    private String lineId;
    private String stageCode;
    private String traceCode;
    private String bottleTypeCode;
    private Double confidence;
    private String evidenceRef;
    private String modelVersion;
    private String status;
    private Long latencyMs;
    private String defectsJson;
    private LocalDateTime capturedAt;
    private LocalDateTime receivedAt;

    public String getInferenceId() { return inferenceId; }
    public void setInferenceId(String inferenceId) { this.inferenceId = inferenceId; }
    public String getTaskType() { return taskType; }
    public void setTaskType(String taskType) { this.taskType = taskType; }
    public String getCameraCode() { return cameraCode; }
    public void setCameraCode(String cameraCode) { this.cameraCode = cameraCode; }
    public String getLineId() { return lineId; }
    public void setLineId(String lineId) { this.lineId = lineId; }
    public String getStageCode() { return stageCode; }
    public void setStageCode(String stageCode) { this.stageCode = stageCode; }
    public String getTraceCode() { return traceCode; }
    public void setTraceCode(String traceCode) { this.traceCode = traceCode; }
    public String getBottleTypeCode() { return bottleTypeCode; }
    public void setBottleTypeCode(String bottleTypeCode) { this.bottleTypeCode = bottleTypeCode; }
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }
    public String getEvidenceRef() { return evidenceRef; }
    public void setEvidenceRef(String evidenceRef) { this.evidenceRef = evidenceRef; }
    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }
    public String getDefectsJson() { return defectsJson; }
    public void setDefectsJson(String defectsJson) { this.defectsJson = defectsJson; }
    public LocalDateTime getCapturedAt() { return capturedAt; }
    public void setCapturedAt(LocalDateTime capturedAt) { this.capturedAt = capturedAt; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime receivedAt) { this.receivedAt = receivedAt; }
}
