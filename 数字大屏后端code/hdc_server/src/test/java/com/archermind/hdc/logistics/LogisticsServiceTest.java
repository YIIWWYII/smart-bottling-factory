package com.archermind.hdc.logistics;

import com.archermind.hdc.logistics.dto.*;
import com.archermind.hdc.logistics.model.AgvTask;
import com.archermind.hdc.logistics.service.LogisticsService;
import com.archermind.hdc.operations.service.OperationsPersistence;
import com.archermind.hdc.operations.service.OperationsRealtimePublisher;
import com.archermind.hdc.operations.service.OperationsService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;

class LogisticsServiceTest {
    @Test
    void obstacleStopsAgvAndSafeArrivalAllowsInbound() {
        OperationsService operations = new OperationsService(
                new OperationsPersistence(new JdbcTemplate()), new OperationsRealtimePublisher());
        ReflectionTestUtils.setField(operations, "agvDistanceMin", 20.0D);
        ReflectionTestUtils.setField(operations, "vocMax", 10.0D);
        ReflectionTestUtils.setField(operations, "smokeMax", 0.5D);
        ReflectionTestUtils.setField(operations, "temperatureMin", 20.0D);
        ReflectionTestUtils.setField(operations, "temperatureMax", 30.0D);
        LogisticsService service = new LogisticsService(operations);
        ReflectionTestUtils.setField(service, "stopDistanceCm", 20.0D);

        AgvTaskRequest create = new AgvTaskRequest();
        create.setBoxCode("BOX-LOG-001");
        create.setTotalDistanceM(10);
        create.setLoadKg(5);
        AgvTask task = service.createTask(create);

        AgvTelemetryRequest blocked = new AgvTelemetryRequest();
        blocked.setSpeedMps(1);
        blocked.setCompletedDistanceM(2);
        blocked.setObstacleDistanceCm(10);
        assertEquals("BLOCKED", service.telemetry(task.getTaskId(), blocked).getStatus());
        assertEquals(1, operations.alarms("OPEN").size());

        AgvTelemetryRequest arrived = new AgvTelemetryRequest();
        arrived.setCompletedDistanceM(10);
        arrived.setObstacleDistanceCm(100);
        assertEquals("ARRIVED", service.telemetry(task.getTaskId(), arrived).getStatus());

        WarehouseTelemetryRequest safe = new WarehouseTelemetryRequest();
        safe.setVocPpm(3);
        safe.setSmoke(0.1);
        safe.setTemperatureC(25);
        assertEquals("SAFE", service.warehouseTelemetry("A-01", safe).getStatus());

        WarehouseInboundRequest inbound = new WarehouseInboundRequest();
        inbound.setTaskId(task.getTaskId());
        inbound.setBoxCode("BOX-LOG-001");
        inbound.setBottleType("PLA-500");
        inbound.setZoneCode("A-01");
        assertEquals("IN_STOCK", service.inbound(inbound).getStatus());
        assertEquals("COMPLETED", task.getStatus());
    }
}
