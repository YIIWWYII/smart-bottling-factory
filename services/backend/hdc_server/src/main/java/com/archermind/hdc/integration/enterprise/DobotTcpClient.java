package com.archermind.hdc.integration.enterprise;

import com.archermind.hdc.operations.model.DeviceCommand;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

@Service
public class DobotTcpClient {
    @Value("${factory.enterprise.dobot.enabled:false}")
    private boolean enabled;
    @Value("${factory.enterprise.dobot.host:192.168.1.6}")
    private String host;
    @Value("${factory.enterprise.dobot.port:29999}")
    private int port;
    @Value("${factory.enterprise.dobot.timeout-millis:3000}")
    private int timeoutMillis;
    @Value("${factory.enterprise.dobot.packing-script:blockly_hdc2024}")
    private String packingScript;

    public boolean supports(DeviceCommand command) {
        return command != null && "PK-ARM-01".equalsIgnoreCase(command.getDeviceCode())
                && "START_PACKING_PLAN".equalsIgnoreCase(command.getCommandType());
    }

    public boolean isEnabled() { return enabled; }

    public String executePackingPlan() {
        if (!enabled) throw new IllegalStateException("DOBOT TCP adapter is disabled");
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMillis);
            socket.setSoTimeout(timeoutMillis);
            BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                    socket.getOutputStream(), StandardCharsets.UTF_8));
            send(writer, "EnableRobot()");
            send(writer, "StopScript()");
            send(writer, "runscript(" + packingScript + ")");
            return "DOBOT script started at " + host + ":" + port;
        } catch (Exception exception) {
            throw new IllegalStateException("DOBOT TCP command failed: " + exception.getMessage(), exception);
        }
    }

    private void send(BufferedWriter writer, String command) throws Exception {
        writer.write(command);
        writer.write("\n");
        writer.flush();
    }
}
