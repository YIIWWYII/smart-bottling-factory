package com.archermind.hdc.factory.service;

import com.archermind.hdc.factory.coordination.FactoryRealtimeEventPublisher;
import com.archermind.hdc.factory.model.FactoryEvent;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class FactoryRealtimePublisher {
    private final FactoryRealtimeEventPublisher publisher;

    public FactoryRealtimePublisher() {
        this(new FactoryRealtimeEventPublisher(new com.archermind.hdc.factory.coordination.FactoryStateVersionService(new JdbcTemplate())));
    }

    @Autowired
    public FactoryRealtimePublisher(FactoryRealtimeEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publish(FactoryEvent event) {
        Map<String, Object> compatibility = new LinkedHashMap<>();
        compatibility.put("traceCode", event.getTraceCode());
        compatibility.put("stage", event.getStage());
        compatibility.put("status", event.getStatus());
        compatibility.put("message", event.getMessage());
        publisher.publish(event.getEventId(), "factory.stage.changed", event.getStage(), event, compatibility);
    }
}
