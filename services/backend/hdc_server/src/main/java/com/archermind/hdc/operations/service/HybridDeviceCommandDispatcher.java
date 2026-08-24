package com.archermind.hdc.operations.service;

import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.factory.service.FactoryMqttBridge;
import com.archermind.hdc.integration.enterprise.DobotTcpClient;
import com.archermind.hdc.operations.dto.CommandAckRequest;
import com.archermind.hdc.operations.model.DeviceCommand;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class HybridDeviceCommandDispatcher {
    private final OperationsService operationsService;
    private final FactoryRuntimeService runtimeService;
    private final FactoryMqttBridge mqttBridge;
    private final DobotTcpClient dobotTcpClient;

    public HybridDeviceCommandDispatcher(OperationsService operationsService,
                                         FactoryRuntimeService runtimeService,
                                         FactoryMqttBridge mqttBridge,
                                         DobotTcpClient dobotTcpClient) {
        this.operationsService = operationsService;
        this.runtimeService = runtimeService;
        this.mqttBridge = mqttBridge;
        this.dobotTcpClient = dobotTcpClient;
    }

    public DeviceCommand dispatch(DeviceCommand command) {
        if (!"PENDING".equals(command.getStatus())) return command;
        if ("LINE-CONTROL-01".equalsIgnoreCase(command.getDeviceCode())) {
            return acknowledge(command, "Backend line coordinator applied command",
                    "LINE-" + UUID.randomUUID());
        }
        DeviceRuntimeState runtime = runtimeService.snapshot(command.getStageCode()).getDevices().stream()
                .filter(item -> command.getDeviceCode().equalsIgnoreCase(item.getDeviceCode()))
                .findFirst().orElse(null);
        if (runtime == null) return fail(command, "Device runtime is unavailable");
        if (runtime.isFallback() || "SIMULATION".equalsIgnoreCase(runtime.getSource())) {
            return acknowledge(command, "Simulation adapter applied command", "SIM-" + UUID.randomUUID());
        }
        if (dobotTcpClient.supports(command)) {
            if (!dobotTcpClient.isEnabled()) {
                return fail(command, "Real DOBOT detected but TCP adapter is disabled");
            }
            try {
                String message = dobotTcpClient.executePackingPlan();
                return acknowledge(command, message, "DOBOT-" + UUID.randomUUID());
            } catch (RuntimeException exception) {
                return fail(command, exception.getMessage());
            }
        }
        if (!mqttBridge.isConnected()) {
            return fail(command, "Real device detected but MQTT command channel is unavailable");
        }
        try {
            operationsService.markCommandSent(command.getCommandId(), "Command published to MQTT; waiting for edge ACK");
            mqttBridge.publishDeviceCommand(command);
            return operationsService.command(command.getCommandId());
        } catch (RuntimeException exception) {
            return fail(command, exception.getMessage());
        }
    }

    private DeviceCommand acknowledge(DeviceCommand command, String message, String edgeAckId) {
        CommandAckRequest request = ack("ACKNOWLEDGED", message, edgeAckId, command);
        return operationsService.acknowledgeCommand(command.getCommandId(), request);
    }

    private DeviceCommand fail(DeviceCommand command, String message) {
        CommandAckRequest request = ack("FAILED", message, "ADAPTER-" + UUID.randomUUID(), command);
        return operationsService.acknowledgeCommand(command.getCommandId(), request);
    }

    private CommandAckRequest ack(String status, String message, String edgeAckId, DeviceCommand command) {
        CommandAckRequest request = new CommandAckRequest();
        request.setStatus(status);
        request.setMessage(message);
        request.setEdgeAckId(edgeAckId);
        request.setClientRequestId(command.getClientRequestId());
        request.setDeviceCode(command.getDeviceCode());
        return request;
    }
}
