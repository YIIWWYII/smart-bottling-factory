package com.archermind.hdc.factory.snapshot;

import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.coordination.FactoryStateVersionService;
import com.archermind.hdc.factory.dto.FactoryDashboard;
import com.archermind.hdc.factory.model.FactoryRun;
import com.archermind.hdc.factory.runtime.dto.FactoryRuntimeSnapshot;
import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.model.StageRuntimeState;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import com.archermind.hdc.factory.service.FactoryService;
import com.archermind.hdc.factory.simulation.FactorySimulationService;
import com.archermind.hdc.factory.simulation.SimulationState;
import com.archermind.hdc.logistics.dto.LogisticsOverview;
import com.archermind.hdc.logistics.model.AgvTask;
import com.archermind.hdc.logistics.service.LogisticsService;
import com.archermind.hdc.operations.model.AiAuditRecord;
import com.archermind.hdc.operations.model.AlarmRecord;
import com.archermind.hdc.operations.model.SensorReading;
import com.archermind.hdc.operations.service.OperationsService;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class FactorySnapshotService {
    private static final ZoneId FACTORY_ZONE = ZoneId.of("Asia/Shanghai");

    private final FactoryStateVersionService stateVersions;
    private final FactoryRuntimeService runtimeService;
    private final FactoryService factoryService;
    private final OperationsService operationsService;
    private final LogisticsService logisticsService;
    private final DeviceCapabilityCatalog capabilities;
    private final FactorySimulationService simulationService;

    public FactorySnapshotService(FactoryStateVersionService stateVersions,
                                  FactoryRuntimeService runtimeService,
                                  FactoryService factoryService,
                                  OperationsService operationsService,
                                  LogisticsService logisticsService,
                                  DeviceCapabilityCatalog capabilities,
                                  FactorySimulationService simulationService) {
        this.stateVersions = stateVersions;
        this.runtimeService = runtimeService;
        this.factoryService = factoryService;
        this.operationsService = operationsService;
        this.logisticsService = logisticsService;
        this.capabilities = capabilities;
        this.simulationService = simulationService;
    }

    public LineSnapshot lineSnapshot() {
        long version = stateVersions.current();
        FactoryRuntimeSnapshot runtime = runtimeService.snapshot(null);
        FactoryDashboard dashboard = factoryService.dashboard();
        LogisticsOverview logistics = logisticsService.overview();
        SimulationState simulation = simulationService.state();

        List<Map<String, Object>> products = products(dashboard, null, runtime.getDevices(), simulation);
        LineSnapshot value = new LineSnapshot();
        value.setLineId(FactoryStateVersionService.LINE_ID);
        value.setLineName("智慧装瓶示范线");
        value.setStateVersion(version);
        value.setGeneratedAt(OffsetDateTime.now(FACTORY_ZONE));
        value.setDataMode(dataMode(runtime.getDevices()));
        value.setStages(stageSummaries(runtime, products));
        value.setProduction(productionSummary(dashboard));
        value.setLogistics(logisticsSummary(logistics));
        value.setWarehouse(warehouseSummary(logistics));
        value.setActiveIncidents(runtime.getIncidents());
        value.setRecentProducts(products.stream().limit(30).collect(Collectors.toList()));
        return value;
    }

    public StageSnapshot stageSnapshot(String stageCode) {
        String stage = normalizeStage(stageCode);
        long version = stateVersions.current();
        FactoryRuntimeSnapshot runtime = runtimeService.snapshot(stage);
        FactoryDashboard dashboard = factoryService.dashboard();
        SimulationState simulation = simulationService.state();
        StageRuntimeState stageState = runtime.getStages().get(0);
        List<Map<String, Object>> devices = deviceRuntime(runtime.getDevices(), version);
        List<Map<String, Object>> products = products(dashboard, stage, runtime.getDevices(), simulation);

        StageSnapshot value = new StageSnapshot();
        value.setLineId(FactoryStateVersionService.LINE_ID);
        value.setStageCode(stage);
        value.setStageName(capabilities.stageName(stage));
        value.setState(normalizeStageState(stageState.getState()));
        value.setStateReason(stageState.getReason());
        value.setStateVersion(version);
        value.setGeneratedAt(OffsetDateTime.now(FACTORY_ZONE));
        value.setDataMode(dataMode(runtime.getDevices()));
        value.setWorkOrder(workOrder(dashboard));
        value.setDevices(devices);
        value.setProducts(products);
        value.setQualityGates(qualityGates(stage));
        value.setBuffer(buffer(stageState));
        value.setIncidents(runtime.getIncidents());
        value.setAlarms(stageAlarms(stage));
        value.setActiveRecipe(activeRecipe());
        value.setAiDecision(latestAiDecision(stage));
        value.setUpstream(stageLinks(stage, -1, runtimeService.snapshot(null)));
        value.setDownstream(stageLinks(stage, 1, runtimeService.snapshot(null)));
        value.setCapabilityVersion(DeviceCapabilityCatalog.VERSION);
        return value;
    }

    private List<Map<String, Object>> stageSummaries(FactoryRuntimeSnapshot runtime,
                                                      List<Map<String, Object>> products) {
        List<Map<String, Object>> values = new ArrayList<>();
        for (StageRuntimeState stage : runtime.getStages()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("stageCode", stage.getStageCode());
            item.put("stageName", capabilities.stageName(stage.getStageCode()));
            item.put("state", normalizeStageState(stage.getState()));
            item.put("stateReason", stage.getReason());
            item.put("wip", products.stream().filter(product -> stage.getStageCode().equals(product.get("stageCode"))).count());
            item.put("bufferLevel", stage.getBufferLevel());
            item.put("bufferCapacity", stage.getBufferCapacity());
            item.put("deviceCount", capabilities.devices(stage.getStageCode()).size());
            item.put("alarmCount", stageAlarms(stage.getStageCode()).size());
            values.add(item);
        }
        return values;
    }

    private List<Map<String, Object>> deviceRuntime(List<DeviceRuntimeState> source, long version) {
        List<Map<String, Object>> values = new ArrayList<>();
        int index = 0;
        for (DeviceRuntimeState device : source) {
            Map<String, Object> item = new LinkedHashMap<>();
            double progress = device.getProgress() == null ? deterministicProgress(version, index) : device.getProgress();
            item.put("deviceCode", device.getDeviceCode());
            item.put("stageCode", device.getStageCode());
            item.put("state", normalizeDeviceState(device.getState()));
            item.put("actionCode", actionCode(device.getDeviceCode()));
            item.put("cycleProgressPct", Math.round(progress * 1000D) / 10D);
            item.put("speed", device.getSpeedMps());
            item.put("speedUnit", "m/s");
            item.put("parameters", parameters(device.getDeviceCode()));
            item.put("telemetry", device.getMetrics());
            item.put("source", normalizeSource(device.getSource()));
            item.put("fallback", device.isFallback());
            item.put("lastSeenAt", device.getOccurredAt());
            values.add(item);
            index++;
        }
        return values;
    }

    private List<Map<String, Object>> products(FactoryDashboard dashboard, String stageFilter,
                                               List<DeviceRuntimeState> devices, SimulationState simulation) {
        List<Map<String, Object>> values = new ArrayList<>();
        double speed = devices.isEmpty() || devices.get(0).getSpeedMps() == null ? .1D : devices.get(0).getSpeedMps();
        for (FactoryRun run : dashboard.getRuns()) {
            String stage = baseStage(run.getCurrentStage());
            if (stageFilter != null && !stageFilter.equals(stage)) continue;
            values.add(product(run.getTraceCode(), run.getBottleType(), run.getBatchCode(), run.getStatus(), stage,
                    speed, progress(simulation.getTick(), run.getTraceCode()), false, run.getUpdatedAt()));
        }
        if ("RUNNING".equals(simulation.getStatus())) {
            List<String> stages = stageFilter == null ? capabilities.stageCodes() : java.util.Collections.singletonList(stageFilter);
            for (String stage : stages) {
                for (int index = 0; index < 2; index++) {
                    String trace = "SIM-" + stage + "-" + index;
                    values.add(product(trace, "PLA-500", "SIM-" + simulation.getScenarioCode(), "RUNNING", stage,
                            speed, progress(simulation.getTick() + index * 3L, trace), true, simulation.getUpdatedAt()));
                }
            }
        }
        values.sort(Comparator.comparing(item -> String.valueOf(item.get("updatedAt")), Comparator.reverseOrder()));
        return values;
    }

    private Map<String, Object> product(String traceCode, String bottleType, String batchCode, String status,
                                        String stage, double speed, double progress, boolean estimated, Object updatedAt) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("traceCode", traceCode);
        item.put("bottleType", bottleType);
        item.put("workOrderCode", batchCode);
        item.put("batchCode", batchCode);
        item.put("status", status);
        item.put("qualitySummary", "REJECTED".equals(status) ? "FAIL" : "PASS");
        item.put("stageCode", stage);
        item.put("laneCode", "LANE-01");
        item.put("stageProgressPct", Math.round(progress * 1000D) / 10D);
        item.put("speed", speed);
        item.put("speedUnit", "m/s");
        item.put("animationState", "RUNNING".equals(status) ? "MOVING" : status);
        item.put("enteredStageAt", updatedAt);
        item.put("updatedAt", updatedAt);
        item.put("estimated", estimated);
        item.put("source", estimated ? "SIMULATION" : "MYSQL");
        return item;
    }

    private Map<String, Object> productionSummary(FactoryDashboard dashboard) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("workOrderCode", dashboard.getRuns().isEmpty() ? "SIM-ORDER-001" : dashboard.getRuns().get(0).getBatchCode());
        value.put("planned", Math.max(100, dashboard.getTotal()));
        value.put("actual", dashboard.getTotal());
        value.put("completed", dashboard.getCompleted());
        value.put("rejected", dashboard.getRejected());
        value.put("hold", dashboard.getHolding());
        int inspected = dashboard.getCompleted() + dashboard.getRejected();
        value.put("passRatePct", inspected == 0 ? 100D : Math.round(dashboard.getCompleted() * 1000D / inspected) / 10D);
        return value;
    }

    private Map<String, Object> logisticsSummary(LogisticsOverview overview) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("agvTotal", overview.getTasks().stream().map(AgvTask::getAgvCode).distinct().count());
        value.put("taskTotal", overview.getTasks().size());
        value.put("inTransit", overview.getTasks().stream().filter(task -> "RUNNING".equals(task.getStatus())).count());
        value.put("blocked", overview.getTasks().stream().filter(task -> "BLOCKED".equals(task.getStatus())).count());
        value.put("availableCapacity", Math.max(0, 1 - (int) overview.getTasks().stream().filter(task -> "RUNNING".equals(task.getStatus())).count()));
        return value;
    }

    private Map<String, Object> warehouseSummary(LogisticsOverview overview) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("stockBoxes", overview.getStock().size());
        value.put("occupiedLocations", overview.getStock().stream().map(item -> item.getLocationCode()).distinct().count());
        value.put("safeZones", overview.getZones().stream().filter(zone -> "SAFE".equals(zone.getStatus())).count());
        value.put("openAlarms", overview.getZones().stream().filter(zone -> "ALARM".equals(zone.getStatus())).count());
        return value;
    }

    private Map<String, Object> workOrder(FactoryDashboard dashboard) {
        Map<String, Object> value = new LinkedHashMap<>();
        if (dashboard.getRuns().isEmpty()) {
            value.put("orderCode", "SIM-ORDER-001");
            value.put("batchCode", "SIM-NORMAL");
            value.put("bottleType", "PLA-500");
            value.put("plannedQuantity", 100);
        } else {
            FactoryRun run = dashboard.getRuns().get(0);
            value.put("orderCode", run.getBatchCode());
            value.put("batchCode", run.getBatchCode());
            value.put("bottleType", run.getBottleType());
            value.put("plannedQuantity", Math.max(100, dashboard.getTotal()));
        }
        return value;
    }

    private List<Map<String, Object>> qualityGates(String stage) {
        List<Map<String, Object>> values = new ArrayList<>();
        List<SensorReading> readings = operationsService.latestReadings(null).stream()
                .filter(item -> stage.equalsIgnoreCase(item.getStage())).collect(Collectors.toList());
        if (readings.isEmpty()) {
            Map<String, Object> gate = new LinkedHashMap<>();
            gate.put("gateCode", stage + "-GATE");
            gate.put("standard", "等待本站检测数据");
            gate.put("actualValue", null);
            gate.put("result", "WAIT");
            gate.put("source", "SIMULATION");
            gate.put("ruleVersion", "quality-2026.1");
            values.add(gate);
            return values;
        }
        for (SensorReading reading : readings) {
            Map<String, Object> gate = new LinkedHashMap<>();
            gate.put("gateCode", stage + ":" + reading.getSensorType());
            gate.put("standard", "后端安全阈值");
            gate.put("actualValue", reading.getValue());
            gate.put("unit", reading.getUnit());
            gate.put("result", "GOOD".equals(reading.getQuality()) ? "PASS" : "FAIL");
            gate.put("source", normalizeSource(reading.getMode()));
            gate.put("ruleVersion", "quality-2026.1");
            values.add(gate);
        }
        return values;
    }

    private List<AlarmRecord> stageAlarms(String stage) {
        List<String> devices = capabilities.devices(stage);
        return operationsService.alarms("OPEN").stream()
                .filter(item -> devices.contains(item.getDeviceCode()) || item.getDeviceCode().startsWith("WAREHOUSE-"))
                .collect(Collectors.toList());
    }

    private Map<String, Object> activeRecipe() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("recipeCode", "PLA-500-DEMO");
        value.put("version", "recipe-v1");
        value.put("source", "APPROVED_DEFAULT");
        value.put("applyStatus", "ACTIVE");
        return value;
    }

    private Map<String, Object> latestAiDecision(String stage) {
        for (AiAuditRecord audit : operationsService.aiAudits()) {
            if (!stage.equalsIgnoreCase(audit.getStage())) continue;
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("auditId", audit.getAuditId());
            value.put("decision", audit.getDecision());
            value.put("knowledgeVersion", audit.getKnowledgeVersion());
            value.put("validationStatus", audit.getValidationStatus());
            value.put("executionStatus", "PENDING".equals(audit.getDecision()) ? "PENDING" : "NOT_REQUESTED");
            return value;
        }
        return null;
    }

    private List<Map<String, Object>> stageLinks(String stage, int offset, FactoryRuntimeSnapshot runtime) {
        int index = capabilities.stageCodes().indexOf(stage) + offset;
        if (index < 0 || index >= capabilities.stageCodes().size()) return new ArrayList<>();
        String linkedCode = capabilities.stageCodes().get(index);
        StageRuntimeState linked = runtime.getStages().stream().filter(item -> linkedCode.equals(item.getStageCode())).findFirst().orElse(null);
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("stageCode", linkedCode);
        value.put("stageName", capabilities.stageName(linkedCode));
        value.put("state", linked == null ? "OFFLINE" : normalizeStageState(linked.getState()));
        value.put("materialFlow", offset < 0 ? "INBOUND" : "OUTBOUND");
        return new ArrayList<>(java.util.Collections.singletonList(value));
    }

    private Map<String, Object> buffer(StageRuntimeState stage) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("inputLevel", stage.getBufferLevel());
        value.put("outputLevel", 0);
        value.put("capacity", stage.getBufferCapacity());
        value.put("blockedReason", "RUNNING".equals(stage.getState()) ? null : stage.getReason());
        return value;
    }

    private Map<String, Object> parameters(String deviceCode) {
        Map<String, Object> values = new LinkedHashMap<>();
        for (Map<String, Object> control : capabilities.controls(deviceCode)) {
            values.put(String.valueOf(control.get("commandType")), control.get("currentValue"));
        }
        return values;
    }

    private String dataMode(List<DeviceRuntimeState> devices) {
        boolean mqtt = devices.stream().anyMatch(item -> "MQTT".equals(normalizeSource(item.getSource())));
        boolean simulation = devices.stream().anyMatch(item -> "SIMULATION".equals(normalizeSource(item.getSource())));
        return mqtt && simulation ? "MIXED" : mqtt ? "MQTT" : "SIMULATION";
    }

    private String normalizeSource(String source) {
        return "REAL".equals(source) ? "MQTT" : source;
    }

    private String normalizeStageState(String state) {
        if ("STOPPED".equals(state)) return "HOLD";
        return state;
    }

    private String normalizeDeviceState(String state) {
        if ("HOLD".equals(state) || "BLOCKED".equals(state) || "STOPPED".equals(state)) return "STANDBY";
        return state;
    }

    private String normalizeStage(String stageCode) {
        String value = stageCode == null ? "" : stageCode.trim().toUpperCase(java.util.Locale.ROOT);
        if (!capabilities.stageCodes().contains(value)) throw new IllegalArgumentException("unsupported stageCode: " + value);
        return value;
    }

    private double deterministicProgress(long version, int index) {
        return ((version * 7L + index * 13L) % 100L) / 100D;
    }

    private double progress(long tick, String key) {
        long hash = Math.abs((long) key.hashCode());
        return ((tick * 7L + hash % 100L) % 100L) / 100D;
    }

    private String baseStage(String stage) {
        if (stage == null || "COMPLETED".equals(stage)) return "WAREHOUSE_INBOUND";
        if (stage.startsWith("BUFFER_")) return stage.substring("BUFFER_".length());
        if (stage.startsWith("REWORK_")) return stage.substring("REWORK_".length());
        return stage;
    }

    private String actionCode(String deviceCode) {
        if (deviceCode.contains("WASH")) return "WASHING";
        if (deviceCode.startsWith("VIS-") || deviceCode.startsWith("SEC-CAM")) return "SCANNING";
        if (deviceCode.startsWith("FIL-")) return "FILLING";
        if (deviceCode.contains("REJECT")) return "REJECTING";
        if (deviceCode.startsWith("PK-ARM") || deviceCode.startsWith("PK-GRIP")) return "PICKING";
        if (deviceCode.startsWith("AGV-")) return "MOVING";
        return "CONVEYING";
    }
}
