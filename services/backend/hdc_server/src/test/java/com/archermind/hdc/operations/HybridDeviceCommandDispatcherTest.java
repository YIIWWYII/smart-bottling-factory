package com.archermind.hdc.operations;

import com.archermind.hdc.factory.runtime.dto.FactoryRuntimeSnapshot;
import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.factory.service.FactoryMqttBridge;
import com.archermind.hdc.integration.enterprise.DobotTcpClient;
import com.archermind.hdc.operations.dto.CommandAckRequest;
import com.archermind.hdc.operations.model.DeviceCommand;
import com.archermind.hdc.operations.service.HybridDeviceCommandDispatcher;
import com.archermind.hdc.operations.service.OperationsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HybridDeviceCommandDispatcherTest {
    private OperationsService operations;
    private FactoryRuntimeService runtime;
    private FactoryMqttBridge mqtt;
    private DobotTcpClient dobot;
    private HybridDeviceCommandDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        operations = mock(OperationsService.class);
        runtime = mock(FactoryRuntimeService.class);
        mqtt = mock(FactoryMqttBridge.class);
        dobot = mock(DobotTcpClient.class);
        dispatcher = new HybridDeviceCommandDispatcher(operations, runtime, mqtt, dobot);
        when(operations.acknowledgeCommand(any(), any())).thenAnswer(invocation -> {
            DeviceCommand value = command();
            CommandAckRequest ack = invocation.getArgument(1);
            value.setStatus(ack.getStatus());
            value.setMessage(ack.getMessage());
            return value;
        });
    }

    @Test
    void simulatedDeviceIsAcknowledgedWithoutTouchingHardware() {
        when(runtime.snapshot("FILLING")).thenReturn(snapshot("SIMULATION", true));

        DeviceCommand result = dispatcher.dispatch(command());

        assertEquals("ACKNOWLEDGED", result.getStatus());
        verify(mqtt, never()).publishDeviceCommand(any());
        verify(dobot, never()).executePackingPlan();
    }

    @Test
    void lineRecipeIsAppliedByBackendCoordinator() {
        DeviceCommand command = command();
        command.setStageCode(null);
        command.setDeviceCode("LINE-CONTROL-01");
        command.setCommandType("SET_RECIPE");

        DeviceCommand result = dispatcher.dispatch(command);

        assertEquals("ACKNOWLEDGED", result.getStatus());
        verify(runtime, never()).snapshot(any());
        verify(mqtt, never()).publishDeviceCommand(any());
    }

    @Test
    void realDeviceUsesMqttAndWaitsForEdgeAck() {
        DeviceCommand sent = command();
        sent.setStatus("SENT");
        when(runtime.snapshot("FILLING")).thenReturn(snapshot("MQTT", false));
        when(mqtt.isConnected()).thenReturn(true);
        when(operations.markCommandSent(eq("CMD-TEST"), any())).thenReturn(sent);
        when(operations.command("CMD-TEST")).thenReturn(sent);

        DeviceCommand result = dispatcher.dispatch(command());

        assertEquals("SENT", result.getStatus());
        verify(mqtt).publishDeviceCommand(any());
    }

    private FactoryRuntimeSnapshot snapshot(String source, boolean fallback) {
        DeviceRuntimeState device = new DeviceRuntimeState();
        device.setStageCode("FILLING");
        device.setDeviceCode("FIL-PUMP-01");
        device.setSource(source);
        device.setFallback(fallback);
        FactoryRuntimeSnapshot snapshot = new FactoryRuntimeSnapshot();
        snapshot.setDevices(Collections.singletonList(device));
        return snapshot;
    }

    private DeviceCommand command() {
        DeviceCommand command = new DeviceCommand();
        command.setCommandId("CMD-TEST");
        command.setClientRequestId("REQ-TEST");
        command.setStageCode("FILLING");
        command.setDeviceCode("FIL-PUMP-01");
        command.setCommandType("SET_PUMP_SPEED");
        command.setStatus("PENDING");
        return command;
    }
}
