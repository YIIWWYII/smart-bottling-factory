package com.archermind.hdc.integration.enterprise;

import com.archermind.hdc.dto.MqttHelper;
import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.runtime.dto.DeviceTelemetryRequest;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.integration.enterprise.dto.EnterprisePlcStatus;
import com.archermind.hdc.log.XLog;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
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
    @Value("${factory.enterprise.plc.online-timeout-seconds:15}")
    private int onlineTimeoutSeconds;

    private String adapterSn;
    private String adapterIp;
    private String protocolType;
    private String version;
    private LocalDateTime lastSeenAt;
    private List<Integer> switchStates = new ArrayList<>();
    private List<Integer> lampStates = new ArrayList<>();

    private final FactoryRuntimeService runtimeService;
    private final DeviceCapabilityCatalog capabilities;

    public EnterprisePlcRuntimeAdapter(FactoryRuntimeService runtimeService,
                                       DeviceCapabilityCatalog capabilities) {
        this.runtimeService = runtimeService;
        this.capabilities = capabilities;
    }

    public synchronized void recordOnline(MqttHelper.DeviceNetworkOnlineDto dto) {
        if (!enabled || dto == null || !StringUtils.hasText(dto.getSn())) return;
        if (!dto.getSn().equals(adapterSn)) {
            switchStates = new ArrayList<>();
            lampStates = new ArrayList<>();
            version = null;
        }
        adapterSn = dto.getSn();
        adapterIp = dto.getIp();
        protocolType = dto.getProtocolType();
        lastSeenAt = LocalDateTime.now();
        refreshCurrentSwitches();
    }

    public synchronized void recordSync(MqttHelper.OrderServiceSyncDto dto) {
        if (!enabled || dto == null || dto.getDevice() == null) return;
        adapterSn = dto.getSn();
        version = dto.getVersion();
        lastSeenAt = LocalDateTime.now();
        switchStates = new ArrayList<>(dto.getDevice());
        lampStates = dto.getLamps() == null ? new ArrayList<>() : new ArrayList<>(dto.getLamps());
        for (int index = 0; index < Math.min(switchStates.size(), deviceCodes().size()); index++) {
            record(dto.getSn(), index, switchStates.get(index), "order/service/sync");
        }
    }

    public synchronized void recordSwitch(MqttHelper.OrderServiceSwitchDto dto) {
        if (!enabled || dto == null || dto.getIndex() == null || dto.getAction() == null) return;
        adapterSn = dto.getSn();
        lastSeenAt = LocalDateTime.now();
        ensureSize(switchStates, Math.max(4, dto.getIndex() + 1));
        switchStates.set(dto.getIndex(), dto.getAction());
        record(dto.getSn(), dto.getIndex(), dto.getAction(), "order/service/switch");
    }

    public synchronized void recordLamps(MqttHelper.OrderServiceLampsDto dto) {
        if (!enabled || dto == null || dto.getIndex() == null || dto.getAction() == null) return;
        adapterSn = dto.getSn();
        lastSeenAt = LocalDateTime.now();
        int size = dto.getTotalLamps() == null ? dto.getIndex() + 1 : dto.getTotalLamps();
        ensureSize(lampStates, Math.max(size, dto.getIndex() + 1));
        lampStates.set(dto.getIndex(), dto.getAction());
    }

    public synchronized EnterprisePlcStatus snapshot(boolean mqttConnected) {
        EnterprisePlcStatus status = new EnterprisePlcStatus();
        status.setMqttConnected(mqttConnected);
        status.setOnline(isOnline());
        status.setAdapterSn(adapterSn);
        status.setAdapterIp(adapterIp);
        status.setProtocolType(protocolType);
        status.setVersion(version);
        status.setLastSeenAt(lastSeenAt);
        status.setSwitchNames(new ArrayList<>(SWITCH_NAMES));
        status.setSwitchDevices(deviceCodes());
        status.setSwitches(new ArrayList<>(switchStates));
        status.setLamps(new ArrayList<>(lampStates));
        return status;
    }

    public synchronized boolean isOnline() {
        return lastSeenAt != null && Math.abs(Duration.between(lastSeenAt, LocalDateTime.now()).getSeconds())
                <= Math.max(1, onlineTimeoutSeconds);
    }

    private void refreshCurrentSwitches() {
        for (int index = 0; index < Math.min(switchStates.size(), deviceCodes().size()); index++) {
            record(adapterSn, index, switchStates.get(index), "device/network/online");
        }
    }

    private void ensureSize(List<Integer> values, int size) {
        while (values.size() < size) values.add(0);
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
