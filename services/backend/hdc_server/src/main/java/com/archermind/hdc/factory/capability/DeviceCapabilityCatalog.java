package com.archermind.hdc.factory.capability;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeviceCapabilityCatalog {
    public static final String VERSION = "capability-2026.1";

    private final Map<String, String> stageNames = new LinkedHashMap<>();
    private final Map<String, List<String>> stageDevices = new LinkedHashMap<>();
    private final Map<String, List<Map<String, Object>>> controls = new LinkedHashMap<>();

    public DeviceCapabilityCatalog() {
        stage("PRETREATMENT", "瓶体预处理", "PT-CV-01", "PT-WASH-01", "PT-AIR-01", "PT-PLC-01");
        stage("GAS_INSPECTION", "气体安全检测", "GAS-CHAMBER-01", "GAS-VERIFY-01", "GAS-PUMP-01", "GAS-LAMP-01");
        stage("APPEARANCE_INSPECTION", "瓶体外观检测", "VIS-TOP-01", "VIS-SIDE-01", "VIS-BOTTOM-01", "VIS-LIGHT-01", "VIS-REJECT-01");
        stage("BEVERAGE_READY", "饮料调配与杀菌", "BEV-MIX-01", "BEV-HT-01", "BEV-TEMP-01", "BEV-HUM-01");
        stage("FILLING", "饮料灌装", "FIL-POS-01", "FIL-PUMP-01", "FIL-HEAD-01", "FIL-FLOW-01", "FIL-LEVEL-01");
        stage("SECONDARY_INSPECTION", "灌装后二次检测", "SEC-CAM-01", "SEC-LEVEL-01", "SEC-LIGHT-01", "SEC-REJECT-01");
        stage("PACKING", "机械臂装箱", "PK-ARM-01", "PK-GRIP-01", "PK-CAM-01", "PK-PRINT-01", "PK-COUNT-01");
        stage("AGV_TRANSPORT", "AGV 运输", "AGV-01", "AGV-US-01", "AGV-ODO-01", "AGV-LOAD-01", "AGV-DISPATCH-01");
        stage("WAREHOUSE_INBOUND", "仓储入库", "WH-VOC-01", "WH-SMOKE-01", "WH-LAMP-01", "WH-WMS-01");

        control("PT-CV-01", "SET_CONVEYOR_SPEED", "输送速度", "number", "mm/s", 30D, 300D, 5D, 120D, "OPERATOR", "MEDIUM", true);
        control("PT-WASH-01", "SET_WASH_TIME", "水洗时长", "number", "s", 5D, 120D, 1D, 30D, "OPERATOR", "MEDIUM", true);
        control("PT-AIR-01", "SET_AIR_TIME", "风洗时长", "number", "s", 5D, 120D, 1D, 20D, "OPERATOR", "MEDIUM", true);
        control("GAS-PUMP-01", "SET_PURGE_TIME", "采样置换时长", "number", "s", 5D, 90D, 1D, 20D, "ENGINEER", "HIGH", true);
        control("VIS-REJECT-01", "REJECT_PRODUCT", "剔除当前产品", "boolean", null, null, null, null, false, "OPERATOR", "HIGH", true);
        control("BEV-MIX-01", "SET_MIX_SPEED", "混合转速", "number", "rpm", 20D, 300D, 5D, 120D, "OPERATOR", "MEDIUM", true);
        control("BEV-HT-01", "SET_TARGET_TEMPERATURE", "杀菌目标温度", "number", "C", 60D, 95D, 1D, 85D, "ENGINEER", "HIGH", true);
        control("FIL-PUMP-01", "SET_FILL_VOLUME", "灌装量", "number", "ml", 50D, 1000D, 10D, 500D, "OPERATOR", "MEDIUM", true);
        control("FIL-PUMP-01", "SET_FLOW_RATE", "灌装流量", "number", "ml/s", 10D, 300D, 5D, 120D, "OPERATOR", "MEDIUM", true);
        control("SEC-REJECT-01", "REJECT_PRODUCT", "剔除当前产品", "boolean", null, null, null, null, false, "OPERATOR", "HIGH", true);
        control("PK-ARM-01", "SET_ARM_SPEED", "机械臂速度", "number", "%", 10D, 100D, 5D, 60D, "ENGINEER", "HIGH", true);
        control("AGV-01", "SET_SPEED_LIMIT", "AGV 速度上限", "number", "m/s", .1D, 2D, .1D, 1D, "OPERATOR", "HIGH", true);
        control("AGV-DISPATCH-01", "REDISPATCH", "重新调度", "string", null, null, null, null, "AUTO", "ADMIN", "HIGH", true);
        control("WH-LAMP-01", "ACK_SAFETY_ALARM", "确认仓区报警", "boolean", null, null, null, null, false, "OPERATOR", "HIGH", true);
        control("LINE-CONTROL-01", "SET_RECIPE", "应用已批准配方", "object", null, null, null, null, null, "OPERATOR", "HIGH", true);
    }

    public List<String> stageCodes() { return new ArrayList<>(stageNames.keySet()); }
    public String stageName(String stageCode) { return stageNames.get(stageCode); }
    public List<String> devices(String stageCode) {
        List<String> values = stageDevices.get(stageCode);
        return values == null ? Collections.emptyList() : new ArrayList<>(values);
    }
    public String stageForDevice(String deviceCode) {
        if ("LINE-CONTROL-01".equals(deviceCode)) return null;
        for (Map.Entry<String, List<String>> entry : stageDevices.entrySet()) {
            if (entry.getValue().contains(deviceCode)) return entry.getKey();
        }
        return null;
    }
    public List<Map<String, Object>> controls(String deviceCode) {
        List<Map<String, Object>> values = controls.get(deviceCode);
        if (values == null) return Collections.emptyList();
        List<Map<String, Object>> copies = new ArrayList<>();
        for (Map<String, Object> value : values) copies.add(new LinkedHashMap<>(value));
        return copies;
    }
    public Map<String, Object> control(String deviceCode, String commandType) {
        for (Map<String, Object> value : controls(deviceCode)) {
            if (commandType.equals(value.get("commandType"))) return value;
        }
        return null;
    }

    private void stage(String code, String name, String... devices) {
        stageNames.put(code, name);
        stageDevices.put(code, Arrays.asList(devices));
    }

    private void control(String deviceCode, String commandType, String displayName, String valueType,
                         String unit, Double min, Double max, Double step, Object currentValue,
                         String requiredRole, String riskLevel, boolean reasonRequired) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("controlId", deviceCode + ":" + commandType);
        value.put("commandType", commandType);
        value.put("displayName", displayName);
        value.put("valueType", valueType);
        value.put("unit", unit);
        value.put("min", min);
        value.put("max", max);
        value.put("step", step);
        value.put("currentValue", currentValue);
        value.put("requiredRole", requiredRole);
        value.put("riskLevel", riskLevel);
        value.put("confirmationRequired", "HIGH".equals(riskLevel));
        value.put("reasonRequired", reasonRequired);
        value.put("interlocks", Arrays.asList("DEVICE_ONLINE", "NO_CRITICAL_ALARM", "STATE_VERSION_MATCH"));
        value.put("writable", true);
        value.put("disabledReason", null);
        controls.computeIfAbsent(deviceCode, key -> new ArrayList<>()).add(value);
    }
}
