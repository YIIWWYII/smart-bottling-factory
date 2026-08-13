package com.archermind.hdc.aiintegration.dto;

import java.util.List;
import java.util.Map;

public class VisionRecognitionRequest {
    private String inferenceId;
    private String taskType;
    private String cameraCode;
    private String lineId;
    private String stageCode;
    private String traceCode;
    private String capturedAt;
    private String bottleTypeCode;
    private Double confidence;
    private String evidenceRef;
    private String modelVersion;
    private String status;
    private Long latencyMs;
    private List<Map<String, Object>> defects;

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
    public String getCapturedAt() { return capturedAt; }
    public void setCapturedAt(String capturedAt) { this.capturedAt = capturedAt; }
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
    public List<Map<String, Object>> getDefects() { return defects; }
    public void setDefects(List<Map<String, Object>> defects) { this.defects = defects; }
}
