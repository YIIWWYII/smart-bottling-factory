package com.archermind.hdc.factory;

import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.contract.FactoryContractPersistence;
import com.archermind.hdc.factory.contract.FactoryContractService;
import com.archermind.hdc.factory.coordination.FactoryRealtimeEventPublisher;
import com.archermind.hdc.factory.coordination.FactoryStateVersionService;
import com.archermind.hdc.factory.parameter.ParameterStateService;
import com.archermind.hdc.factory.simulation.FactorySimulationService;
import com.archermind.hdc.factory.snapshot.FactorySnapshotService;
import com.archermind.hdc.logistics.service.LogisticsService;
import com.archermind.hdc.operations.service.OperationsService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class FactoryContractServiceTest {
    @Test
    void topologyLinksEachStageToAdjacentStages() {
        FactoryContractService service = new FactoryContractService(
                new DeviceCapabilityCatalog(),
                mock(FactorySnapshotService.class),
                mock(FactoryContractPersistence.class),
                mock(FactoryRealtimeEventPublisher.class),
                mock(FactoryStateVersionService.class),
                mock(FactorySimulationService.class),
                mock(OperationsService.class),
                mock(LogisticsService.class),
                mock(ParameterStateService.class));

        List<Map<String, Object>> stages = (List<Map<String, Object>>) service.topology().get("stages");

        assertEquals(9, stages.size());
        assertEquals(null, stages.get(0).get("upstream"));
        assertEquals("GAS_INSPECTION", stages.get(0).get("downstream"));
        assertEquals("PRETREATMENT", stages.get(1).get("upstream"));
        assertEquals("APPEARANCE_INSPECTION", stages.get(1).get("downstream"));
        assertEquals("AGV_TRANSPORT", stages.get(8).get("upstream"));
        assertEquals(null, stages.get(8).get("downstream"));
    }
}
