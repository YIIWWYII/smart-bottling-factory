package com.archermind.hdc.factory.service;

import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.factory.model.FactoryEvent;
import com.archermind.hdc.service.ws.CommonWebSocketService;
import com.archermind.hdc.service.ws.DataScreenWebSocketService;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class FactoryRealtimePublisher {
    public void publish(FactoryEvent event) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "factory.stage.changed");
        message.put("eventId", event.getEventId());
        message.put("traceCode", event.getTraceCode());
        message.put("stage", event.getStage());
        message.put("status", event.getStatus());
        message.put("message", event.getMessage());
        message.put("occurredAt", event.getOccurredAt());
        message.put("schemaVersion", 1);
        message.put("payload", event);
        String json = JSONObject.toJSONString(message);
        DataScreenWebSocketService.sentMessageByGroupId(1L, json);
        CommonWebSocketService.sentMessageByGroupId(1L, json);
    }
}
