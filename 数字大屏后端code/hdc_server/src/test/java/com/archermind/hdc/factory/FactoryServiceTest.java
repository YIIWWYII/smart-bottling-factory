package com.archermind.hdc.factory;

import com.archermind.hdc.factory.dto.FactoryStartRequest;
import com.archermind.hdc.factory.dto.FactoryDispositionRequest;
import com.archermind.hdc.factory.dto.FactoryStepRequest;
import com.archermind.hdc.factory.model.FactoryRun;
import com.archermind.hdc.factory.service.FactoryRealtimePublisher;
import com.archermind.hdc.factory.service.FactoryService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FactoryServiceTest {
    private FactoryService service() {
        return new FactoryService(new FactoryRealtimePublisher());
    }

    @Test
    void normalScenarioCompletesWarehouseInbound() {
        FactoryRun run = service().runScenario(request("BOT-TEST-001", "NORMAL"));

        assertEquals("COMPLETED", run.getStatus());
        assertEquals("COMPLETED", run.getCurrentStage());
        assertEquals("BOX-001", run.getBoxCode());
        assertEquals("AGV-TASK-001", run.getAgvTaskCode());
        assertEquals("A-01-01", run.getWarehouseLocation());
    }

    @Test
    void gasAlarmStopsBeforeAppearanceInspection() {
        FactoryRun run = service().runScenario(request("BOT-TEST-002", "GAS_ALARM"));

        assertEquals("HOLD", run.getStatus());
        assertEquals("GAS_INSPECTION", run.getCurrentStage());
        assertEquals(12.5D, run.getVoc());
        assertEquals(null, run.getBoxCode());
    }

    @Test
    void appearanceDefectIsRejected() {
        FactoryRun run = service().runScenario(request("BOT-TEST-003", "APPEARANCE_DEFECT"));

        assertEquals("REJECTED", run.getStatus());
        assertEquals("APPEARANCE_INSPECTION", run.getCurrentStage());
        assertEquals("BODY_DENT", run.getDefectType());
    }

    @Test
    void duplicateTraceCodeAndJumpAreRejected() {
        FactoryService service = service();
        service.start(request("BOT-TEST-004", "MANUAL"));
        assertThrows(IllegalStateException.class,
                () -> service.start(request("BOT-TEST-004", "MANUAL")));

        com.archermind.hdc.factory.dto.FactoryStepRequest jump =
                new com.archermind.hdc.factory.dto.FactoryStepRequest();
        jump.setStage("FILLING");
        assertThrows(IllegalStateException.class,
                () -> service.step("BOT-TEST-004", jump));
    }

    @Test
    void reworkRouteReturnsProductToOriginalStage() {
        FactoryService service = service();
        FactoryRun run = service.runScenario(request("BOT-TEST-005", "GAS_ALARM"));
        assertEquals("HOLD", run.getStatus());

        FactoryDispositionRequest disposition = new FactoryDispositionRequest();
        disposition.setAction("ROUTE_REWORK");
        run = service.disposition(run.getTraceCode(), disposition);
        assertEquals("REWORK_GAS_INSPECTION", run.getCurrentStage());
        assertEquals("RUNNING", run.getStatus());

        FactoryStepRequest rework = new FactoryStepRequest();
        rework.setStage("REWORK_GAS_INSPECTION");
        rework.setResult("PASS");
        run = service.step(run.getTraceCode(), rework);
        assertEquals("GAS_INSPECTION", run.getCurrentStage());
        assertEquals("RUNNING", run.getStatus());
    }

    private FactoryStartRequest request(String traceCode, String scenario) {
        FactoryStartRequest request = new FactoryStartRequest();
        request.setTraceCode(traceCode);
        request.setBottleType("PLA-500");
        request.setScenario(scenario);
        return request;
    }
}
