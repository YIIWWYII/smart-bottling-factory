package com.archermind.hdc.factory;

import com.archermind.hdc.factory.runtime.dto.DeviceTelemetryRequest;
import com.archermind.hdc.factory.runtime.dto.FactoryRuntimeSnapshot;
import com.archermind.hdc.factory.runtime.dto.IncidentRequest;
import com.archermind.hdc.factory.runtime.dto.IncidentResolutionRequest;
import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.model.FactoryIncident;
import com.archermind.hdc.factory.runtime.model.StageRuntimeState;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimePersistence;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FactoryRuntimeServiceTest {
    private FactoryRuntimeService service() {
        FactoryRuntimeService service = new FactoryRuntimeService();
        ReflectionTestUtils.setField(service, "mqttTimeoutSeconds", 5);
        ReflectionTestUtils.setField(service, "bufferCapacity", 6);
        return service;
    }

    @Test
    void simulationIsUsedUntilFreshMqttTelemetryArrives() {
        FactoryRuntimeService service = service();
        FactoryRuntimeSnapshot initial = service.snapshot("FILLING");
        assertTrue(initial.getDevices().stream().allMatch(item -> item.isFallback()
                && "SIMULATION".equals(item.getSource())));

        DeviceTelemetryRequest telemetry = new DeviceTelemetryRequest();
        telemetry.setStageCode("FILLING");
        telemetry.setDeviceCode("FIL-PUMP-01");
        telemetry.setSource("MQTT");
        telemetry.setState("RUNNING");
        telemetry.setSpeedMps(.2D);
        telemetry.setProgress(.35D);
        service.recordTelemetry(telemetry);

        assertEquals("MQTT", service.snapshot("FILLING").getDevices().stream()
                .filter(item -> "FIL-PUMP-01".equals(item.getDeviceCode())).findFirst().get().getSource());

        telemetry.setOccurredAt(LocalDateTime.now().minusSeconds(10));
        service.recordTelemetry(telemetry);
        assertEquals("SIMULATION", service.snapshot("FILLING").getDevices().stream()
                .filter(item -> "FIL-PUMP-01".equals(item.getDeviceCode())).findFirst().get().getSource());
    }

    @Test
    void productDefectKeepsStageIndependentButEquipmentFailureUsesBuffer() {
        FactoryRuntimeService service = service();
        IncidentRequest defect = incident("APPEARANCE_INSPECTION", "PRODUCT_DEFECT");
        FactoryIncident defectIncident = service.reportIncident(defect);
        assertEquals("REJECT_PRODUCT", defectIncident.getStrategy());
        assertEquals("RUNNING", stage(service, "APPEARANCE_INSPECTION").getState());

        IncidentRequest failure = incident("FILLING", "EQUIPMENT_FAILURE");
        FactoryIncident failureIncident = service.reportIncident(failure);
        assertEquals("BUFFER_AND_STOP", failureIncident.getStrategy());
        assertEquals("STOPPED", stage(service, "FILLING").getState());
        assertEquals(1, stage(service, "BEVERAGE_READY").getBufferLevel());

        IncidentResolutionRequest resolution = new IncidentResolutionRequest();
        resolution.setAction("RESUME");
        service.resolve(failureIncident.getIncidentId(), resolution);
        assertEquals("RUNNING", stage(service, "FILLING").getState());
        assertEquals(0, stage(service, "BEVERAGE_READY").getBufferLevel());
    }

    @Test
    void lineStopResolutionRestoresEveryStageWithoutOverridingIndependentIncident() {
        FactoryRuntimeService service = service();
        IncidentRequest stageFailure = incident("FILLING", "EQUIPMENT_FAILURE");
        FactoryIncident stageIncident = service.reportIncident(stageFailure);
        service.reportIncident(incident("APPEARANCE_INSPECTION", "PRODUCT_DEFECT"));

        IncidentRequest emergency = incident("WAREHOUSE_INBOUND", "SAFETY_EMERGENCY");
        emergency.setStrategy("STOP_LINE");
        FactoryIncident lineIncident = service.reportIncident(emergency);
        assertTrue(service.snapshot(null).getStages().stream().allMatch(item -> "STOPPED".equals(item.getState())));

        service.resolve(lineIncident.getIncidentId(), new IncidentResolutionRequest());
        assertEquals("STOPPED", stage(service, "FILLING").getState());
        assertEquals("RUNNING", stage(service, "PACKING").getState());
        assertTrue(!"无".equals(stage(service, "APPEARANCE_INSPECTION").getDownstreamImpact()));

        service.resolve(stageIncident.getIncidentId(), new IncidentResolutionRequest());
        assertEquals("RUNNING", stage(service, "FILLING").getState());
    }

    @Test
    void persistedRuntimeRestoresTelemetryStageAndIncident() {
        FactoryRuntimePersistence persistence = mock(FactoryRuntimePersistence.class);
        when(persistence.isEnabled()).thenReturn(true);

        DeviceRuntimeState device = new DeviceRuntimeState();
        device.setStageCode("FILLING");
        device.setDeviceCode("FIL-PUMP-01");
        device.setState("RUNNING");
        device.setSource("MQTT");
        device.setSpeedMps(.2D);
        device.setProgress(.4D);
        device.setMetrics(new LinkedHashMap<>());
        device.setOccurredAt(LocalDateTime.now());
        when(persistence.loadDevices()).thenReturn(Collections.singletonList(device));

        StageRuntimeState persistedStage = new StageRuntimeState();
        persistedStage.setStageCode("FILLING");
        persistedStage.setState("STOPPED");
        persistedStage.setReason("equipment failure");
        persistedStage.setUpstreamImpact("buffering");
        persistedStage.setDownstreamImpact("waiting");
        persistedStage.setBufferCapacity(6);
        when(persistence.loadStages()).thenReturn(Collections.singletonList(persistedStage));

        FactoryIncident incident = new FactoryIncident();
        incident.setIncidentId("INC-PERSISTED");
        incident.setStageCode("FILLING");
        incident.setIncidentType("EQUIPMENT_FAILURE");
        incident.setMessage("equipment failure");
        incident.setStrategy("BUFFER_AND_STOP");
        incident.setTargetStage("BUFFER_FILLING");
        incident.setStatus("OPEN");
        incident.setCreatedAt(LocalDateTime.now());
        when(persistence.loadIncidents()).thenReturn(Collections.singletonList(incident));

        FactoryRuntimeService service = new FactoryRuntimeService(persistence);
        ReflectionTestUtils.setField(service, "mqttTimeoutSeconds", 5);
        ReflectionTestUtils.setField(service, "bufferCapacity", 6);
        service.restore();

        FactoryRuntimeSnapshot snapshot = service.snapshot("FILLING");
        assertEquals("STOPPED", snapshot.getStages().get(0).getState());
        assertEquals("MQTT", snapshot.getDevices().stream()
                .filter(item -> "FIL-PUMP-01".equals(item.getDeviceCode())).findFirst().get().getSource());
        assertEquals("INC-PERSISTED", snapshot.getIncidents().get(0).getIncidentId());
        verify(persistence).saveStages(anyCollection());
    }

    private IncidentRequest incident(String stage, String type) {
        IncidentRequest request = new IncidentRequest();
        request.setStageCode(stage);
        request.setIncidentType(type);
        request.setMessage(type);
        return request;
    }

    private StageRuntimeState stage(FactoryRuntimeService service, String stageCode) {
        return service.snapshot(stageCode).getStages().get(0);
    }
}
