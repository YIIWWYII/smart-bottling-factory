package com.archermind.hdc.factory.coordination;

import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.service.ws.CommonWebSocketService;
import com.archermind.hdc.service.ws.DataScreenWebSocketService;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class FactoryRealtimeEventPublisher {
    private static final ZoneId FACTORY_ZONE = ZoneId.of("Asia/Shanghai");

    private final FactoryStateVersionService stateVersionService;

    public FactoryRealtimeEventPublisher(FactoryStateVersionService stateVersionService) {
        this.stateVersionService = stateVersionService;
    }

    public long publish(String type, String stageCode, Object payload) {
        return publish(null, type, stageCode, payload);
    }

    public long publish(String eventId, String type, String stageCode, Object payload) {
        return publish(eventId, type, stageCode, payload, null);
    }

    public long publish(String eventId, String type, String stageCode, Object payload,
                        Map<String, Object> compatibilityFields) {
        long stateVersion = stateVersionService.next();
        Map<String, Object> message = envelope(eventId, type, stageCode, stateVersion, payload);
        if (compatibilityFields != null) message.putAll(compatibilityFields);
        String json = JSONObject.toJSONString(message);
        DataScreenWebSocketService.sentMessageByGroupId(1L, json);
        CommonWebSocketService.sentMessageByGroupId(1L, json);
        return stateVersion;
    }

    public Map<String, Object> envelope(String eventId, String type, String stageCode,
                                        long stateVersion, Object payload) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("eventId", eventId == null ? "EVT-" + UUID.randomUUID() : eventId);
        message.put("type", type);
        message.put("lineId", FactoryStateVersionService.LINE_ID);
        message.put("stageCode", stageCode);
        message.put("stateVersion", stateVersion);
        message.put("occurredAt", OffsetDateTime.now(FACTORY_ZONE).toString());
        message.put("schemaVersion", 1);
        message.put("payload", payload);
        return message;
    }
}
