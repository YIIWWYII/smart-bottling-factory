package com.archermind.hdc.operations.service;

import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.service.ws.CommonWebSocketService;
import com.archermind.hdc.service.ws.DataScreenWebSocketService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class OperationsRealtimePublisher {
    public void publish(String type, Object payload) {
        String json = JSONObject.toJSONString(envelope(type, payload));
        DataScreenWebSocketService.sentMessageByGroupId(1L, json);
        CommonWebSocketService.sentMessageByGroupId(1L, json);
    }

    public Map<String, Object> envelope(String type, Object payload) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("eventId", "EVT-" + UUID.randomUUID());
        message.put("type", type);
        message.put("occurredAt", LocalDateTime.now());
        message.put("schemaVersion", 1);
        message.put("payload", payload);
        return message;
    }
}
