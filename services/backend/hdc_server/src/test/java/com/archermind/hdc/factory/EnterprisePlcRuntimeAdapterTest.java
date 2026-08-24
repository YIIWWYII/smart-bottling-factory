package com.archermind.hdc.factory;

import com.archermind.hdc.dto.MqttHelper;
import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.integration.enterprise.EnterprisePlcRuntimeAdapter;
import com.archermind.hdc.util.GsonUtil;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EnterprisePlcRuntimeAdapterTest {
    @Test
    void enterpriseSwitchTopicBecomesCanonicalRuntimeTelemetry() {
        FactoryRuntimeService runtime = new FactoryRuntimeService();
        ReflectionTestUtils.setField(runtime, "mqttTimeoutSeconds", 30);
        ReflectionTestUtils.setField(runtime, "bufferCapacity", 6);
        EnterprisePlcRuntimeAdapter adapter = new EnterprisePlcRuntimeAdapter(
                runtime, new DeviceCapabilityCatalog());
        ReflectionTestUtils.setField(adapter, "enabled", true);
        ReflectionTestUtils.setField(adapter, "configuredDevices",
                "PK-ARM-01,FIL-HEAD-01,PT-CV-01,AGV-01");
        ReflectionTestUtils.setField(adapter, "onlineTimeoutSeconds", 15);

        MqttHelper.OrderServiceSwitchDto message = GsonUtil.getInstance().fromJson(
                "{\"sn\":\"PLC-DEMO\",\"index\":2,\"action\":1}",
                MqttHelper.OrderServiceSwitchDto.class);
        adapter.recordSwitch(message);

        DeviceRuntimeState conveyor = runtime.snapshot("PRETREATMENT").getDevices().stream()
                .filter(item -> "PT-CV-01".equals(item.getDeviceCode())).findFirst().get();
        assertEquals("MQTT", conveyor.getSource());
        assertEquals("RUNNING", conveyor.getState());
        assertFalse(conveyor.isFallback());
        assertEquals("ENTERPRISE_PLC", conveyor.getMetrics().get("adapter"));
    }

    @Test
    void syncAndHeartbeatExposeLivePlcStatusWithoutLegacyGroup() {
        FactoryRuntimeService runtime = new FactoryRuntimeService();
        ReflectionTestUtils.setField(runtime, "mqttTimeoutSeconds", 30);
        ReflectionTestUtils.setField(runtime, "bufferCapacity", 6);
        EnterprisePlcRuntimeAdapter adapter = new EnterprisePlcRuntimeAdapter(
                runtime, new DeviceCapabilityCatalog());
        ReflectionTestUtils.setField(adapter, "enabled", true);
        ReflectionTestUtils.setField(adapter, "configuredDevices",
                "PK-ARM-01,FIL-HEAD-01,PT-CV-01,AGV-01");
        ReflectionTestUtils.setField(adapter, "onlineTimeoutSeconds", 15);

        MqttHelper.OrderServiceSyncDto sync = GsonUtil.getInstance().fromJson(
                "{\"sn\":\"PLC-LIVE\",\"device\":[1,0,1,1],\"lamps\":[1,0,1,1],\"version\":\"0.00\"}",
                MqttHelper.OrderServiceSyncDto.class);
        adapter.recordSync(sync);
        MqttHelper.DeviceNetworkOnlineDto heartbeat = GsonUtil.getInstance().fromJson(
                "{\"sn\":\"PLC-LIVE\",\"ip\":\"192.168.1.50\",\"protocolType\":\"MQTT\"}",
                MqttHelper.DeviceNetworkOnlineDto.class);
        adapter.recordOnline(heartbeat);

        assertTrue(adapter.snapshot(true).isOnline());
        assertTrue(adapter.snapshot(true).isMqttConnected());
        assertEquals(Arrays.asList(1, 0, 1, 1), adapter.snapshot(true).getSwitches());
        assertEquals(Arrays.asList(1, 0, 1, 1), adapter.snapshot(true).getLamps());
        assertEquals("192.168.1.50", adapter.snapshot(true).getAdapterIp());
    }
}
