package com.archermind.hdc.operations;

import com.archermind.hdc.operations.dto.AiDecisionRequest;
import com.archermind.hdc.operations.dto.SensorReadingRequest;
import com.archermind.hdc.operations.model.SensorReading;
import com.archermind.hdc.operations.service.OperationsPersistence;
import com.archermind.hdc.operations.service.OperationsRealtimePublisher;
import com.archermind.hdc.operations.service.OperationsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class OperationsServiceTest {
    private OperationsService service;

    @BeforeEach
    void setUp() {
        service = new OperationsService(new OperationsPersistence(new JdbcTemplate()),
                new OperationsRealtimePublisher());
        ReflectionTestUtils.setField(service, "vocMax", 10.0D);
        ReflectionTestUtils.setField(service, "smokeMax", 0.5D);
        ReflectionTestUtils.setField(service, "temperatureMin", 20.0D);
        ReflectionTestUtils.setField(service, "temperatureMax", 30.0D);
        ReflectionTestUtils.setField(service, "agvDistanceMin", 20.0D);
    }

    @Test
    void sensorOutsideLimitCreatesAlarm() {
        SensorReadingRequest request = new SensorReadingRequest();
        request.setDeviceCode("GAS-01");
        request.setSensorType("VOC");
        request.setValue(12.5D);
        request.setTraceCode("BOT-OPS-001");

        SensorReading reading = service.recordSensor(request);

        assertEquals("VOC", reading.getSensorType());
        assertEquals(1, service.alarms("OPEN").size());
    }

    @Test
    void validatedAiRecipeCanCreatePendingCommand() {
        AiDecisionRequest request = new AiDecisionRequest();
        request.setTraceCode("BOT-OPS-002");
        request.setBottleType("PLA-500");
        request.setStage("FILLING");
        request.setObservations(Collections.singletonMap("voc", 6.2D));
        request.setAutoApply(true);

        com.archermind.hdc.operations.dto.AiDecisionResponse response = service.decide(request);

        assertEquals("PASSED", response.getValidationStatus());
        assertEquals("APPLY_RECIPE", response.getDecision());
        assertNotNull(response.getCommandId());
        assertEquals("PENDING", service.commands("PENDING").get(0).getStatus());
    }

    @Test
    void unknownBottleTypeRequiresManualReview() {
        AiDecisionRequest request = new AiDecisionRequest();
        request.setTraceCode("BOT-OPS-003");
        request.setBottleType("UNKNOWN-999");
        request.setStage("FILLING");

        assertEquals("MANUAL_REVIEW", service.decide(request).getDecision());
        assertEquals("REJECTED", service.decide(request).getValidationStatus());
    }
}
