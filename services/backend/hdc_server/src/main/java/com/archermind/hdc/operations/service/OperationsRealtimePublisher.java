package com.archermind.hdc.operations.service;

import com.archermind.hdc.factory.coordination.FactoryRealtimeEventPublisher;
import org.springframework.stereotype.Service;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class OperationsRealtimePublisher {
    private final FactoryRealtimeEventPublisher publisher;

    public OperationsRealtimePublisher() {
        this(new FactoryRealtimeEventPublisher(new com.archermind.hdc.factory.coordination.FactoryStateVersionService(new JdbcTemplate())));
    }

    @Autowired
    public OperationsRealtimePublisher(FactoryRealtimeEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publish(String type, Object payload) {
        publisher.publish(type, stageCode(payload), payload);
    }

    public Map<String, Object> envelope(String type, Object payload) {
        return publisher.envelope(null, type, stageCode(payload), 1L, payload);
    }

    private String stageCode(Object payload) {
        if (payload instanceof com.archermind.hdc.operations.model.SensorReading) {
            return ((com.archermind.hdc.operations.model.SensorReading) payload).getStage();
        }
        if (payload instanceof com.archermind.hdc.operations.model.AiAuditRecord) {
            return ((com.archermind.hdc.operations.model.AiAuditRecord) payload).getStage();
        }
        if (payload instanceof com.archermind.hdc.operations.model.DeviceCommand) {
            return ((com.archermind.hdc.operations.model.DeviceCommand) payload).getStageCode();
        }
        return null;
    }
}
