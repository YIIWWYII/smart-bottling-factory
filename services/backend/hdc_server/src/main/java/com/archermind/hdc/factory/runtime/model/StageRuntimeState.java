package com.archermind.hdc.factory.runtime.model;

public class StageRuntimeState {
    private String stageCode;
    private String state;
    private String reason;
    private String upstreamImpact;
    private String downstreamImpact;
    private int bufferLevel;
    private int bufferCapacity;

    public String getStageCode() { return stageCode; }
    public void setStageCode(String stageCode) { this.stageCode = stageCode; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getUpstreamImpact() { return upstreamImpact; }
    public void setUpstreamImpact(String upstreamImpact) { this.upstreamImpact = upstreamImpact; }
    public String getDownstreamImpact() { return downstreamImpact; }
    public void setDownstreamImpact(String downstreamImpact) { this.downstreamImpact = downstreamImpact; }
    public int getBufferLevel() { return bufferLevel; }
    public void setBufferLevel(int bufferLevel) { this.bufferLevel = bufferLevel; }
    public int getBufferCapacity() { return bufferCapacity; }
    public void setBufferCapacity(int bufferCapacity) { this.bufferCapacity = bufferCapacity; }
}
