package com.archermind.hdc.operations.service;

import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.service.ws.CommonWebSocketService;
import com.archermind.hdc.service.ws.DataScreenWebSocketService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class OperationsRealtimePublisher {
    public void publish(String type, Object payload) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", type);
        message.put("occurredAt", LocalDateTime.now());
        message.put("payload", payload);
        String json = JSONObject.toJSONString(message);
        DataScreenWebSocketService.sentMessageByGroupId(1L, json);
        CommonWebSocketService.sentMessageByGroupId(1L, json);
    }
}
