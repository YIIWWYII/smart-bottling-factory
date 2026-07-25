package com.archermind.hdc.factory.model;

import java.time.LocalDateTime;

public class FactoryEvent {
    private String eventId;
    private String traceCode;
    private String stage;
    private String status;
    private String message;
    private LocalDateTime occurredAt;

    public FactoryEvent() {
    }

    public FactoryEvent(String eventId, String traceCode, String stage, String status,
                        String message, LocalDateTime occurredAt) {
        this.eventId = eventId;
        this.traceCode = traceCode;
        this.stage = stage;
        this.status = status;
        this.message = message;
        this.occurredAt = occurredAt;
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getTraceCode() {
        return traceCode;
    }

    public void setTraceCode(String traceCode) {
        this.traceCode = traceCode;
    }

    public String getStage() {
        return stage;
    }

    public void setStage(String stage) {
        this.stage = stage;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public LocalDateTime getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(LocalDateTime occurredAt) {
        this.occurredAt = occurredAt;
    }
}
