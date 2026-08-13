package com.archermind.hdc.operations;

import com.archermind.hdc.operations.dto.AiDecisionRequest;
import com.archermind.hdc.operations.dto.CommandAckRequest;
import com.archermind.hdc.operations.dto.DeviceCommandRequest;
import com.archermind.hdc.operations.dto.SensorReadingRequest;
import com.archermind.hdc.operations.model.DeviceCommand;
import com.archermind.hdc.operations.model.SensorReading;
import com.archermind.hdc.operations.service.OperationsPersistence;
import com.archermind.hdc.operations.service.OperationsRealtimePublisher;
import com.archermind.hdc.operations.service.OperationsService;
import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.coordination.FactoryStateVersionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
        ReflectionTestUtils.setField(service, "capabilityCatalog", new DeviceCapabilityCatalog());
        ReflectionTestUtils.setField(service, "stateVersionService",
                new FactoryStateVersionService(new JdbcTemplate()));
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
    void legacyAiDecisionAutoApplyDoesNotCreateCommand() {
        AiDecisionRequest request = new AiDecisionRequest();
        request.setTraceCode("BOT-OPS-002");
        request.setBottleType("PLA-500");
        request.setStage("FILLING");
        request.setObservations(Collections.singletonMap("voc", 6.2D));
        request.setAutoApply(true);

        com.archermind.hdc.operations.dto.AiDecisionResponse response = service.decide(request);

        assertEquals("PASSED", response.getValidationStatus());
        assertEquals("APPLY_RECIPE", response.getDecision());
        assertNull(response.getCommandId());
        assertEquals(0, service.commands("PENDING").size());
    }

    @Test
    void commandSafetyGateRequiresControlRoleAndValidRanges() {
        DeviceCommandRequest viewer = command("CMD-REQ-VIEWER");
        viewer.setOperatorRole("VIEWER");
        assertThrows(IllegalArgumentException.class, () -> service.createCommand(viewer));

        DeviceCommandRequest outOfRange = command("CMD-REQ-RANGE");
        outOfRange.getPayload().put("fillingTemperatureC", 45D);
        assertThrows(IllegalArgumentException.class, () -> service.createCommand(outOfRange));
    }

    @Test
    void commandClientRequestIdIsIdempotentAndAckUsesContractStatus() {
        DeviceCommand first = service.createCommand(command("CMD-REQ-IDEMPOTENT"));
        DeviceCommand second = service.createCommand(command("CMD-REQ-IDEMPOTENT"));
        assertEquals(first.getCommandId(), second.getCommandId());

        CommandAckRequest ack = new CommandAckRequest();
        ack.setStatus("SUCCEEDED");
        ack.setMessage("edge applied");
        DeviceCommand acknowledged = service.acknowledgeCommand(first.getCommandId(), ack);

        assertEquals("ACKNOWLEDGED", acknowledged.getStatus());
        assertNotNull(acknowledged.getAcknowledgedAt());
    }

    @Test
    void openCriticalAlarmBlocksRelatedCommand() {
        SensorReadingRequest reading = new SensorReadingRequest();
        reading.setDeviceCode("FIL-PUMP-01");
        reading.setSensorType("VOC");
        reading.setStage("FILLING");
        reading.setTraceCode("BOT-OPS-BLOCKED");
        reading.setValue(12.5D);
        service.recordSensor(reading);

        DeviceCommandRequest request = command("CMD-REQ-BLOCKED");
        request.setTraceCode("BOT-OPS-BLOCKED");
        assertThrows(IllegalArgumentException.class, () -> service.createCommand(request));
    }

    @Test
    void commandTimeoutPreventsLateSuccess() {
        DeviceCommandRequest request = command("CMD-REQ-TIMEOUT");
        request.setTimeoutSeconds(1);
        DeviceCommand command = service.createCommand(request);

        assertEquals(1, service.expirePendingCommands(LocalDateTime.now().plusSeconds(2)));
        assertEquals("TIMEOUT", service.commands("TIMEOUT").get(0).getStatus());

        CommandAckRequest ack = new CommandAckRequest();
        ack.setStatus("ACKNOWLEDGED");
        assertThrows(IllegalArgumentException.class,
                () -> service.acknowledgeCommand(command.getCommandId(), ack));
    }

    @Test
    void commandRejectsWrongStageAndStaleVersion() {
        DeviceCommandRequest wrongStage = command("CMD-REQ-STAGE");
        wrongStage.setDeviceCode("FIL-PUMP-01");
        wrongStage.setStageCode("GAS_INSPECTION");
        assertThrows(IllegalArgumentException.class, () -> service.createCommand(wrongStage));

        DeviceCommandRequest stale = command("CMD-REQ-VERSION");
        stale.setExpectedStateVersion(99L);
        assertThrows(IllegalArgumentException.class, () -> service.createCommand(stale));
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

    private DeviceCommandRequest command(String requestId) {
        DeviceCommandRequest request = new DeviceCommandRequest();
        request.setClientRequestId(requestId);
        request.setDeviceCode("LINE-CONTROL-01");
        request.setCommandType("SET_RECIPE");
        request.setPayload(recipePayload());
        request.setSource("OPERATOR");
        request.setOperator("operator01");
        request.setOperatorRole("OPERATOR");
        request.setReason("test command safety gate");
        return request;
    }

    private Map<String, Object> recipePayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("recipeCode", "PLA-500-DEMO-V1");
        payload.put("fillingTemperatureC", 25D);
        payload.put("fillVolumeMl", 500);
        payload.put("capTorqueNm", .9D);
        return payload;
    }
}
