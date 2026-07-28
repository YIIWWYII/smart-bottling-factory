package com.archermind.hdc.factory.parameter;

import java.time.LocalDateTime;

public class ParameterState {
    private String deviceCode;
    private String parameterCode;
    private Object value;
    private String unit;
    private String ownerSource;
    private String lockMode;
    private String lockedBy;
    private LocalDateTime lockedAt;
    private String lockReason;
    private LocalDateTime expiresAt;
    private long parameterVersion;
    private String atomicGroupId;
    private LocalDateTime updatedAt;

    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getParameterCode() { return parameterCode; }
    public void setParameterCode(String parameterCode) { this.parameterCode = parameterCode; }
    public Object getValue() { return value; }
    public void setValue(Object value) { this.value = value; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getOwnerSource() { return ownerSource; }
    public void setOwnerSource(String ownerSource) { this.ownerSource = ownerSource; }
    public String getLockMode() { return lockMode; }
    public void setLockMode(String lockMode) { this.lockMode = lockMode; }
    public String getLockedBy() { return lockedBy; }
    public void setLockedBy(String lockedBy) { this.lockedBy = lockedBy; }
    public LocalDateTime getLockedAt() { return lockedAt; }
    public void setLockedAt(LocalDateTime lockedAt) { this.lockedAt = lockedAt; }
    public String getLockReason() { return lockReason; }
    public void setLockReason(String lockReason) { this.lockReason = lockReason; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public long getParameterVersion() { return parameterVersion; }
    public void setParameterVersion(long parameterVersion) { this.parameterVersion = parameterVersion; }
    public String getAtomicGroupId() { return atomicGroupId; }
    public void setAtomicGroupId(String atomicGroupId) { this.atomicGroupId = atomicGroupId; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
