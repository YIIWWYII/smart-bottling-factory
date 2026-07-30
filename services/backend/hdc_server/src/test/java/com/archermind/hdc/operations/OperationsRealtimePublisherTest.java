package com.archermind.hdc.operations;

import com.archermind.hdc.operations.service.OperationsRealtimePublisher;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OperationsRealtimePublisherTest {
    @Test
    void realtimeEnvelopeMatchesContract() {
        OperationsRealtimePublisher publisher = new OperationsRealtimePublisher();

        Map<String, Object> envelope = publisher.envelope(
                "operations.command.changed", Collections.singletonMap("status", "PENDING"));

        assertTrue(String.valueOf(envelope.get("eventId")).startsWith("EVT-"));
        assertEquals("operations.command.changed", envelope.get("type"));
        assertEquals("LINE-01", envelope.get("lineId"));
        assertEquals(1L, envelope.get("stateVersion"));
        assertEquals(1, envelope.get("schemaVersion"));
        assertNotNull(envelope.get("occurredAt"));
        assertTrue(String.valueOf(envelope.get("occurredAt")).contains("T"));
        assertNotNull(envelope.get("payload"));
    }
}
