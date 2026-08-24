package com.archermind.hdc.integration.enterprise;

import com.archermind.hdc.dto.MqttHelper;
import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.runtime.dto.DeviceTelemetryRequest;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.log.XLog;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class EnterprisePlcRuntimeAdapter {
    private static final List<String> SWITCH_NAMES = Arrays.asList("机械臂", "机床", "输送线", "巡检车");

    @Value("${factory.enterprise.plc.enabled:true}")
    private boolean enabled;
    @Value("${factory.enterprise.plc.switch-devices:PK-ARM-01,FIL-HEAD-01,PT-CV-01,AGV-01}")
    private String configuredDevices;

    private final FactoryRuntimeService runtimeService;
    private final DeviceCapabilityCatalog capabilities;

    public EnterprisePlcRuntimeAdapter(FactoryRuntimeService runtimeService,
                                       DeviceCapabilityCatalog capabilities) {
        this.runtimeService = runtimeService;
        this.capabilities = capabilities;
    }

    public void recordSync(MqttHelper.OrderServiceSyncDto dto) {
        if (!enabled || dto == null || dto.getDevice() == null) return;
        List<Integer> states = dto.getDevice();
        for (int index = 0; index < Math.min(states.size(), deviceCodes().size()); index++) {
            record(dto.getSn(), index, states.get(index), "order/service/sync");
        }
    }

    public void recordSwitch(MqttHelper.OrderServiceSwitchDto dto) {
        if (!enabled || dto == null || dto.getIndex() == null || dto.getAction() == null) return;
        record(dto.getSn(), dto.getIndex(), dto.getAction(), "order/service/switch");
    }

    private void record(String sn, int index, Integer action, String topic) {
        List<String> devices = deviceCodes();
        if (index < 0 || index >= devices.size() || action == null) return;
        String deviceCode = devices.get(index);
        String stageCode = capabilities.stageForDevice(deviceCode);
        if (!StringUtils.hasText(stageCode)) {
            XLog.warn("企业 PLC 点位未映射到有效设备：index=" + index + ", device=" + deviceCode);
            return;
        }

        DeviceTelemetryRequest request = new DeviceTelemetryRequest();
        request.setStageCode(stageCode);
        request.setDeviceCode(deviceCode);
        request.setSource("MQTT");
        request.setState(action == 1 ? "RUNNING" : "STANDBY");
        request.setSpeedMps(action == 1 ? null : 0D);
        request.setProgress(0D);
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("adapter", "ENTERPRISE_PLC");
        metrics.put("adapterSn", sn);
        metrics.put("legacySwitchIndex", index);
        metrics.put("legacySwitchName", index < SWITCH_NAMES.size() ? SWITCH_NAMES.get(index) : "开关" + index);
        metrics.put("legacyTopic", topic);
        request.setMetrics(metrics);
        runtimeService.recordTelemetry(request);
    }

    private List<String> deviceCodes() {
        return Arrays.stream(configuredDevices.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .collect(Collectors.toList());
    }
}
