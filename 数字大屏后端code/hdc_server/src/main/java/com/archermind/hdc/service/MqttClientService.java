package com.archermind.hdc.service;

import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.dto.MqttHelper;
import com.archermind.hdc.log.XLog;
import com.archermind.hdc.util.GsonUtil;
import com.archermind.hdc.util.UUID;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import javax.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

import static com.archermind.hdc.dto.MqttHelper.*;

@Service
public class MqttClientService implements MqttCallbackExtended {
    private String tag = "MQTT client:";


    @Value("${mqtt.url}")
    String url;
    @Value("${mqtt.port}")
    String port;
    @Value("${mqtt.enabled:true}")
    boolean enabled;


    private MqttClient client;
    private String mqttClientId = UUID.getUUID();

    private MqttHelper.RegisterMessage registerMessage;

//    @PostConstruct
//    public void init() throws MqttException {
//        client = new MqttClient(url + ":" + port, mqttClientId, new MemoryPersistence());
//        conn();
//    }

    private void conn() throws MqttException {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setCleanSession(true);
        options.setConnectionTimeout(30);
        options.setKeepAliveInterval(120);
        options.setAutomaticReconnect(true);
        options.setMaxInflight(5000);//默认并行下发消息是10个，这里修改为5000，避免消息无法下发
        client.setCallback(this);
        client.connect(options);
    }


    @Override
    public void connectionLost(Throwable throwable) {
        XLog.error(tag + "断开--" + throwable.getMessage());
        throwable.printStackTrace();
        XLog.error(throwable);
    }

    @Override
    public void messageArrived(String topic, MqttMessage mqttMessage) {
        String payload = new String(mqttMessage.getPayload(), StandardCharsets.UTF_8);
        if (ObjectUtils.isEmpty(registerMessage)) {
            return;
        }
        XLog.info("接收topic："+topic+" ,payload:" + payload);
        try {

            if (Objects.equals(topic, DEVICE_NETWORK_ONLINE.getTopic())) {
                registerMessage.deviceNetworkOnline(GsonUtil.getInstance().fromJson(payload, MqttHelper.DeviceNetworkOnlineDto.class));
                return;
            }
            if (Objects.equals(topic, ORDER_SERVICE_SYNC.getTopic())) {
                registerMessage.orderServiceSync(GsonUtil.getInstance().fromJson(payload, MqttHelper.OrderServiceSyncDto.class));
                return;
            }
            if (Objects.equals(topic, ORDER_SERVICE_SWITCH.getTopic())) {
                registerMessage.orderServiceSwitch(GsonUtil.getInstance().fromJson(payload, MqttHelper.OrderServiceSwitchDto.class));
                return;
            }
            if (Objects.equals(topic, ORDER_SERVICE_LAMPS.getTopic())) {
                registerMessage.orderServiceLamps(GsonUtil.getInstance().fromJson(payload, MqttHelper.OrderServiceLampsDto.class));
            }
            if (Objects.equals(topic, SERVICE_INFO_GROUP.getTopic())) {
                registerMessage.listGroupDevces(GsonUtil.getInstance().fromJson(payload, MqttHelper.DeviceInfoDto.class));
            }

        } catch (Exception e) {
            XLog.error(tag + "接收数据非JSON，payload：" + payload);
            e.printStackTrace();
        }

    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken iMqttDeliveryToken) {
        boolean result = iMqttDeliveryToken.isComplete();
        if (!result) {
            try {
                XLog.error(tag + "投递失败--" + new String(iMqttDeliveryToken.getMessage().getPayload(), StandardCharsets.UTF_8));
            } catch (MqttException e) {
                e.printStackTrace();
                XLog.error(e);
            }
        }
    }


    public void sendToMqtt(String topic, String payload) throws MqttException {
        if (!enabled || client == null || !client.isConnected()) {
            XLog.warn(tag + "MQTT unavailable, command kept in simulation mode. topic=" + topic);
            return;
        }
        XLog.info(tag + "下发--" + "topic:" + topic + ",payload:" + payload);
        MqttTopic mqttTopic = client.getTopic(topic);
        MqttMessage mqttMessage = new MqttMessage();
        mqttMessage.setQos(2);
        mqttMessage.setPayload(payload.getBytes(StandardCharsets.UTF_8));
        mqttTopic.publish(mqttMessage);
    }

    @Override
    public void connectComplete(boolean reconnect, String serverURI) {
        XLog.info("mqtt 链接完成，reconnect：" + reconnect);
        try {
            for (MqttHelper.TopicHelper topicHelper : MqttHelper.getInstance().getRegisterTopics()) {
                client.subscribe(topicHelper.getTopic(), 2);
                XLog.info(tag + "注册TOPIC：" + topicHelper.getTopic() + "，" + topicHelper.getDesc());
            }
        } catch (MqttException mqttException) {
            XLog.error(mqttException);
        }
        try {
            if (ObjectUtils.isEmpty(registerMessage)) {
                return;
            }
            registerMessage.connectComplete();
        } catch (MqttException mqttException) {
            XLog.error(mqttException);
        }
    }

    public void setRegisterMessage(MqttHelper.RegisterMessage registerMessage) {
        this.registerMessage = registerMessage;
        if (!enabled) {
            XLog.warn(tag + "simulation mode, MQTT connection disabled");
            return;
        }
        try {
            client = new MqttClient(url + ":" + port, mqttClientId, new MemoryPersistence());
            conn();
        } catch (MqttException e) {
            throw new RuntimeException(e);
        }
    }
}
