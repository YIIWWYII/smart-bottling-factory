package com.archermind.hdc.factory.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.factory.dto.FactoryStepRequest;
import com.archermind.hdc.factory.model.FactoryRun;
import com.archermind.hdc.factory.runtime.dto.DeviceTelemetryRequest;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.log.XLog;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Service
public class FactoryMqttBridge {
    @Value("${factory.mqtt.enabled:false}")
    private boolean enabled;
    @Value("${mqtt.url:tcp://127.0.0.1}")
    private String url;
    @Value("${mqtt.port:31883}")
    private String port;

    private final FactoryService factoryService;
    private final FactoryRuntimeService runtimeService;
    private MqttClient client;

    public FactoryMqttBridge(FactoryService factoryService, FactoryRuntimeService runtimeService) {
        this.factoryService = factoryService;
        this.runtimeService = runtimeService;
    }

    @PostConstruct
    public void start() {
        if (!enabled) {
            XLog.info("factory MQTT bridge disabled");
            return;
        }
        try {
            client = new MqttClient(url + ":" + port, "factory-bridge-" + UUID.randomUUID(), new MemoryPersistence());
            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setAutomaticReconnect(true);
            options.setConnectionTimeout(5);
            client.connect(options);
            client.subscribe("factory/+/+/+/telemetry", 1, this::onMessage);
            client.subscribe("factory/+/+/+/event", 1, this::onMessage);
            XLog.info("factory MQTT bridge connected");
        } catch (Exception exception) {
            XLog.error("factory MQTT bridge unavailable: " + exception.getMessage());
        }
    }

    private void onMessage(String topic, MqttMessage mqttMessage) {
        String payload = new String(mqttMessage.getPayload(), StandardCharsets.UTF_8);
        try {
            JSONObject object = JSON.parseObject(payload);
            if (topic.endsWith("/telemetry")) {
                String[] parts = topic.split("/");
                DeviceTelemetryRequest telemetry = object.toJavaObject(DeviceTelemetryRequest.class);
                if (parts.length >= 5) {
                    if (telemetry.getStageCode() == null) telemetry.setStageCode(parts[2]);
                    if (telemetry.getDeviceCode() == null) telemetry.setDeviceCode(parts[3]);
                }
                telemetry.setSource("MQTT");
                runtimeService.recordTelemetry(telemetry);
                XLog.info("factory MQTT telemetry applied: " + telemetry.getDeviceCode());
                return;
            }
            String traceCode = object.getString("traceCode");
            if (traceCode == null || traceCode.trim().isEmpty()) {
                XLog.warn("factory MQTT message missing traceCode: " + topic);
                return;
            }
            FactoryStepRequest request = object.toJavaObject(FactoryStepRequest.class);
            FactoryRun run = factoryService.step(traceCode, request);
            XLog.info("factory MQTT event applied: " + run.getTraceCode() + " " + run.getCurrentStage());
        } catch (Exception exception) {
            XLog.error("factory MQTT message rejected: " + payload + ", reason=" + exception.getMessage());
        }
    }

    public void publishCommand(String topic, Object payload) {
        if (client == null || !client.isConnected()) {
            throw new IllegalStateException("factory MQTT bridge is not connected");
        }
        try {
            MqttMessage message = new MqttMessage(JSON.toJSONString(payload).getBytes(StandardCharsets.UTF_8));
            message.setQos(1);
            client.publish(topic, message);
        } catch (MqttException exception) {
            throw new IllegalStateException("factory MQTT publish failed", exception);
        }
    }

    @PreDestroy
    public void stop() {
        if (client == null) return;
        try {
            client.disconnect();
            client.close();
        } catch (MqttException exception) {
            XLog.warn("factory MQTT bridge close failed: " + exception.getMessage());
        }
    }
}
