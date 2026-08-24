package com.archermind.hdc.factory;

import com.archermind.hdc.dto.MqttHelper;
import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.integration.enterprise.EnterprisePlcRuntimeAdapter;
import com.archermind.hdc.util.GsonUtil;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

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
}
