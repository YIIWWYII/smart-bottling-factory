package com.archermind.hdc.aiintegration;

import com.archermind.hdc.aiintegration.dto.CommandIntentRequest;
import com.archermind.hdc.aiintegration.dto.VisionRecognitionRequest;
import com.archermind.hdc.aiintegration.service.AiIntegrationPersistence;
import com.archermind.hdc.aiintegration.service.AiIntegrationService;
import com.archermind.hdc.auth.model.AdminUser;
import com.archermind.hdc.auth.service.AuthService;
import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.contract.FactoryContractService;
import com.archermind.hdc.factory.coordination.FactoryRealtimeEventPublisher;
import com.archermind.hdc.factory.coordination.FactoryStateVersionService;
import com.archermind.hdc.factory.parameter.ParameterStateService;
import com.archermind.hdc.operations.service.OperationsPersistence;
import com.archermind.hdc.operations.service.OperationsRealtimePublisher;
import com.archermind.hdc.operations.service.OperationsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiIntegrationServiceTest {
    private AiIntegrationService service;
    private ParameterStateService parameterStates;

    @BeforeEach
    void setUp() {
        DeviceCapabilityCatalog catalog = new DeviceCapabilityCatalog();
        parameterStates = new ParameterStateService(catalog, new JdbcTemplate());
        parameterStates.restore();

        OperationsService operations = new OperationsService(new OperationsPersistence(new JdbcTemplate()),
                new OperationsRealtimePublisher());
        ReflectionTestUtils.setField(operations, "vocMax", 10.0D);
        ReflectionTestUtils.setField(operations, "smokeMax", 0.5D);
        ReflectionTestUtils.setField(operations, "temperatureMin", 20.0D);
        ReflectionTestUtils.setField(operations, "temperatureMax", 30.0D);
        ReflectionTestUtils.setField(operations, "agvDistanceMin", 20.0D);
        ReflectionTestUtils.setField(operations, "capabilityCatalog", catalog);
        ReflectionTestUtils.setField(operations, "stateVersionService", new FactoryStateVersionService(new JdbcTemplate()));
        ReflectionTestUtils.setField(operations, "parameterStateService", parameterStates);

        AuthService auth = mock(AuthService.class);
        when(auth.authenticate("Bearer operator-token")).thenReturn(user("operator01", "OPERATOR"));

        service = new AiIntegrationService(auth, mock(FactoryContractService.class), operations, catalog,
                new FactoryRealtimeEventPublisher(new FactoryStateVersionService(new JdbcTemplate())),
                new AiIntegrationPersistence(new JdbcTemplate()));
        ReflectionTestUtils.setField(service, "serviceToken", "test-ai-token");
    }

    @Test
    void aiCommandIntentCreatesPendingCommandThroughSafetyGate() {
        Map<String, Object> response = service.commandIntent("Bearer test-ai-token", "Bearer operator-token",
                intent("AI-INTENT-001", "DEC-001", "FIL-PUMP-01", "FLOW_RATE", 120D));

        assertEquals("COMMAND_PENDING", response.get("status"));
        assertEquals(1, ((java.util.List<?>) response.get("commandIds")).size());
    }

    @Test
    void assistantConversationOriginCannotBecomeCommandIntent() {
        CommandIntentRequest request = intent("AI-INTENT-002", "DEC-002", "FIL-PUMP-01", "FLOW_RATE", 120D);
        request.setOriginType("ASSISTANT_MESSAGE");

        assertThrows(IllegalArgumentException.class,
                () -> service.commandIntent("Bearer test-ai-token", "Bearer operator-token", request));
    }

    @Test
    void manualHoldBlocksAiFieldPatch() {
        parameterStates.lock("FIL-PUMP-01", "FLOW_RATE", "operator01", "manual calibration", "MANUAL_HOLD", null);

        Map<String, Object> response = service.commandIntent("Bearer test-ai-token", "Bearer operator-token",
                intent("AI-INTENT-003", "DEC-003", "FIL-PUMP-01", "FLOW_RATE", 120D));

        assertEquals("BLOCKED", response.get("status"));
        assertEquals(0, ((java.util.List<?>) response.get("commandIds")).size());
    }

    @Test
    void workstationSubjectCannotReadFactsOutsideBoundStage() {
        AuthService auth = mock(AuthService.class);
        when(auth.authenticate("Bearer station-token")).thenReturn(user("station_filling", "OPERATOR", "WORKSTATION", "FILLING"));
        AiIntegrationService scopedService = new AiIntegrationService(auth, mock(FactoryContractService.class),
                mock(OperationsService.class), new DeviceCapabilityCatalog(),
                new FactoryRealtimeEventPublisher(new FactoryStateVersionService(new JdbcTemplate())),
                new AiIntegrationPersistence(new JdbcTemplate()));
        ReflectionTestUtils.setField(scopedService, "serviceToken", "test-ai-token");

        assertThrows(IllegalArgumentException.class,
                () -> scopedService.facts("Bearer test-ai-token", "Bearer station-token", "WORKSTATION",
                        "LINE-01", "GAS_INSPECTION", null, null));
    }

    @Test
    void workstationSubjectCannotSubmitCommandIntentForAnotherStage() {
        AuthService auth = mock(AuthService.class);
        when(auth.authenticate("Bearer station-token")).thenReturn(user("station_gas", "OPERATOR", "WORKSTATION", "GAS_INSPECTION"));
        AiIntegrationService scopedService = new AiIntegrationService(auth, mock(FactoryContractService.class),
                mock(OperationsService.class), new DeviceCapabilityCatalog(),
                new FactoryRealtimeEventPublisher(new FactoryStateVersionService(new JdbcTemplate())),
                new AiIntegrationPersistence(new JdbcTemplate()));
        ReflectionTestUtils.setField(scopedService, "serviceToken", "test-ai-token");

        assertThrows(IllegalArgumentException.class,
                () -> scopedService.commandIntent("Bearer test-ai-token", "Bearer station-token",
                        intent("AI-INTENT-004", "DEC-004", "FIL-PUMP-01", "FLOW_RATE", 120D)));
    }

    @Test
    void visionRecognitionRequiresAiServiceToken() {
        VisionRecognitionRequest request = new VisionRecognitionRequest();
        request.setTaskType("BOTTLE_TYPE");
        request.setCameraCode("VIS-TOP-01");
        request.setStageCode("APPEARANCE_INSPECTION");

        assertThrows(IllegalArgumentException.class, () -> service.recognize("wrong-token", request));
    }

    private CommandIntentRequest intent(String idempotencyKey, String decisionId, String deviceCode,
                                        String parameterCode, Object proposedValue) {
        CommandIntentRequest request = new CommandIntentRequest();
        request.setIdempotencyKey(idempotencyKey);
        request.setDecisionId(decisionId);
        request.setSourceApp("WORKSTATION");
        request.setLineId("LINE-01");
        request.setStageCode("FILLING");
        request.setDeviceCode(deviceCode);
        request.setReason("AI field patch test");

        CommandIntentRequest.CommandIntentChange change = new CommandIntentRequest.CommandIntentChange();
        change.setDeviceCode(deviceCode);
        change.setParameterCode(parameterCode);
        change.setCommandType("SET_" + parameterCode);
        change.setProposedValue(proposedValue);
        change.setUnit("ml/s");
        change.setParameterVersion(1L);
        change.setAtomicGroupId("FILL_VOLUME_GROUP");
        request.setProposedChanges(Collections.singletonList(change));
        return request;
    }

    private AdminUser user(String username, String role) {
        return user(username, role, "ADMIN", null);
    }

    private AdminUser user(String username, String role, String sourceApp, String stageCode) {
        AdminUser user = new AdminUser();
        user.setId(7L);
        user.setUsername(username);
        user.setDisplayName(username);
        user.setRole(role);
        user.setStatus("ACTIVE");
        user.setSourceApp(sourceApp);
        user.setStageCode(stageCode);
        return user;
    }
}
