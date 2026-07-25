package com.archermind.hdc.factory.contract;

import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.factory.coordination.FactoryRealtimeEventPublisher;
import com.archermind.hdc.factory.coordination.FactoryStateVersionService;
import com.archermind.hdc.factory.snapshot.FactorySnapshotService;
import com.archermind.hdc.factory.snapshot.LineSnapshot;
import com.archermind.hdc.factory.snapshot.StageSnapshot;
import com.archermind.hdc.factory.simulation.FactorySimulationService;
import com.archermind.hdc.logistics.dto.LogisticsOverview;
import com.archermind.hdc.logistics.service.LogisticsService;
import com.archermind.hdc.operations.service.OperationsService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class FactoryContractService {
    private final DeviceCapabilityCatalog capabilities;
    private final FactorySnapshotService snapshots;
    private final FactoryContractPersistence persistence;
    private final FactoryRealtimeEventPublisher publisher;
    private final FactoryStateVersionService stateVersions;
    private final FactorySimulationService simulation;
    private final OperationsService operations;
    private final LogisticsService logistics;

    public FactoryContractService(DeviceCapabilityCatalog capabilities,
                                  FactorySnapshotService snapshots,
                                  FactoryContractPersistence persistence,
                                  FactoryRealtimeEventPublisher publisher,
                                  FactoryStateVersionService stateVersions,
                                  FactorySimulationService simulation,
                                  OperationsService operations,
                                  LogisticsService logistics) {
        this.capabilities = capabilities;
        this.snapshots = snapshots;
        this.persistence = persistence;
        this.publisher = publisher;
        this.stateVersions = stateVersions;
        this.simulation = simulation;
        this.operations = operations;
        this.logistics = logistics;
    }

    public Map<String, Object> topology() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("lineId", FactoryStateVersionService.LINE_ID);
        value.put("lineName", "智慧装瓶示范线");
        value.put("topologyVersion", "topology-2026.1");
        List<Map<String, Object>> stages = new ArrayList<>();
        int order = 1;
        for (String code : capabilities.stageCodes()) {
            int index = order - 1;
            Map<String, Object> stage = new LinkedHashMap<>();
            stage.put("order", order++);
            stage.put("stageCode", code);
            stage.put("stageName", capabilities.stageName(code));
            stage.put("devices", capabilities.devices(code));
            stage.put("upstream", index == 0 ? null : capabilities.stageCodes().get(index - 1));
            stage.put("downstream", index == capabilities.stageCodes().size() - 1
                    ? null : capabilities.stageCodes().get(index + 1));
            stages.add(stage);
        }
        value.put("stages", stages);
        return value;
    }

    public LineSnapshot lineSnapshot() { return snapshots.lineSnapshot(); }
    public StageSnapshot stageSnapshot(String stageCode) { return snapshots.stageSnapshot(stageCode); }

    public List<Map<String, Object>> stageCapabilities(String stageCode) {
        requireStage(stageCode);
        List<Map<String, Object>> values = new ArrayList<>();
        for (String deviceCode : capabilities.devices(stageCode)) values.add(device(deviceCode));
        return values;
    }

    public Map<String, Object> deviceCapability(String deviceCode) {
        String code = upper(deviceCode);
        if (!capabilities.devices(capabilities.stageForDevice(code)).contains(code)
                && !"LINE-CONTROL-01".equals(code)) {
            throw new IllegalArgumentException("unknown deviceCode: " + code);
        }
        return device(code);
    }

    public Map<String, Object> deviceParameters(String deviceCode) {
        Map<String, Object> value = deviceCapability(deviceCode);
        value.put("stateVersion", stateVersions.current());
        value.put("source", "APPROVED_DEFAULT");
        value.put("recipeVersion", "recipe-v1");
        return value;
    }

    public List<Map<String, Object>> orders() {
        return persistence.productionOrders();
    }

    public Map<String, Object> saveOrder(Map<String, Object> request, String operator) {
        require(request != null, "order request is required");
        Map<String, Object> value = new LinkedHashMap<>();
        LocalDateTime now = LocalDateTime.now();
        value.put("id", "ORDER-" + UUID.randomUUID());
        value.put("orderCode", text(request.get("orderCode"), "ORDER-" + now.toString().replaceAll("[^0-9]", "")));
        value.put("batchCode", text(request.get("batchCode"), "BATCH-" + now.toString().replaceAll("[^0-9]", "")));
        value.put("bottleType", text(request.get("bottleType"), "PLA-500"));
        value.put("plannedQuantity", number(request.get("plannedQuantity"), 100));
        value.put("status", text(request.get("status"), "PLANNED"));
        value.put("scheduledAt", request.get("scheduledAt"));
        value.put("createdAt", now);
        value.put("updatedAt", now);
        persistence.saveProductionOrder(value);
        audit("PRODUCTION_ORDER", String.valueOf(value.get("id")), "CREATE", operator, request);
        publisher.publish("production.order.changed", null, value);
        return value;
    }

    public Map<String, Object> updateOrder(String id, Map<String, Object> request, String operator) {
        Map<String, Object> current = orders().stream().filter(item -> id.equals(item.get("id"))).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("production order not found: " + id));
        if (request != null) current.putAll(request);
        current.put("id", id);
        current.put("updatedAt", LocalDateTime.now());
        persistence.saveProductionOrder(current);
        audit("PRODUCTION_ORDER", id, "UPDATE", operator, request);
        publisher.publish("production.order.changed", null, current);
        return current;
    }

    public List<Map<String, Object>> qualityGates() {
        List<Map<String, Object>> values = new ArrayList<>();
        for (String stage : capabilities.stageCodes()) values.addAll(snapshots.stageSnapshot(stage).getQualityGates());
        return values;
    }

    public List<Map<String, Object>> configurations(String category) {
        String normalized = normalizeCategory(category);
        List<Map<String, Object>> values = persistence.configurations(normalized);
        if (!values.isEmpty()) return values;
        return defaultConfiguration(normalized);
    }

    public Map<String, Object> saveConfiguration(String category, Map<String, Object> request, String operator) {
        String normalized = normalizeCategory(category);
        require(request != null, "configuration is required");
        Map<String, Object> value = new LinkedHashMap<>(request);
        value.putIfAbsent("id", normalized + "-" + UUID.randomUUID());
        value.putIfAbsent("version", normalized.toLowerCase() + "-" + stateVersions.current());
        value.putIfAbsent("status", "DRAFT");
        value.put("operator", operator);
        value.putIfAbsent("createdAt", LocalDateTime.now());
        value.put("updatedAt", LocalDateTime.now());
        persistence.saveConfiguration(normalized, value);
        audit(normalized, String.valueOf(value.get("id")), "SAVE", operator, value);
        publisher.publish("config." + normalized.toLowerCase() + ".changed", null, value);
        return value;
    }

    public Map<String, Object> publishConfiguration(String category, String id, String operator) {
        Map<String, Object> value = configurations(category).stream().filter(item -> id.equals(item.get("id"))).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("configuration not found: " + id));
        value.put("status", "PUBLISHED");
        value.put("operator", operator);
        value.put("updatedAt", LocalDateTime.now());
        persistence.saveConfiguration(normalizeCategory(category), value);
        audit(normalizeCategory(category), id, "PUBLISH", operator, value);
        publisher.publish("config." + normalizeCategory(category).toLowerCase() + ".changed", null, value);
        return value;
    }

    public List<Map<String, Object>> audits() {
        return persistence.audits();
    }

    public Map<String, Object> report() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("generatedAt", LocalDateTime.now());
        value.put("lineSnapshot", lineSnapshot());
        value.put("qualityGateCount", qualityGates().size());
        value.put("commandCount", operations.commands(null).size());
        LogisticsOverview overview = logistics.overview();
        value.put("agvTaskCount", overview.getTasks().size());
        value.put("warehouseStockCount", overview.getStock().size());
        return value;
    }

    public List<Map<String, Object>> simulationScenarios() { return simulation.scenarios(); }
    public Object simulationStart(String scenario) { return simulation.start(scenario); }
    public Object simulationStop() { return simulation.stop(); }
    public Object simulationReset() { return simulation.reset(); }

    private Map<String, Object> device(String deviceCode) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("deviceCode", deviceCode);
        value.put("stageCode", capabilities.stageForDevice(deviceCode));
        value.put("capabilityVersion", DeviceCapabilityCatalog.VERSION);
        value.put("controls", capabilities.controls(deviceCode));
        value.put("deviceType", deviceCode.startsWith("AGV") ? "AGV" : deviceCode.startsWith("VIS") ? "VISION" : "PROCESS_DEVICE");
        return value;
    }

    private List<Map<String, Object>> defaultConfiguration(String category) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", category + "-DEFAULT");
        value.put("category", category);
        value.put("version", category.toLowerCase() + "-2026.1");
        value.put("status", "PUBLISHED");
        value.put("operator", "SYSTEM");
        if ("THRESHOLD".equals(category)) {
            value.put("vocMaxPpm", 10D);
            value.put("smokeMax", .5D);
            value.put("agvMinObstacleDistanceCm", 20D);
            value.put("temperatureMinC", 20D);
            value.put("temperatureMaxC", 30D);
        } else if ("RECIPE".equals(category)) {
            value.put("bottleType", "PLA-500");
            value.put("fillVolumeMl", 500D);
            value.put("fillingTemperatureC", 25D);
            value.put("capTorqueNm", .9D);
        } else {
            value.put("ruleCode", "DEFAULT-QUALITY");
            value.put("description", "按后端安全阈值和传感器质量判定");
        }
        return new ArrayList<>(java.util.Collections.singletonList(value));
    }

    private void audit(String category, String targetId, String action, String operator, Object detail) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("auditId", "AUDIT-" + UUID.randomUUID());
        value.put("category", category);
        value.put("targetId", targetId);
        value.put("action", action);
        value.put("operator", StringUtils.hasText(operator) ? operator : "UNKNOWN");
        value.put("detail", detail);
        value.put("occurredAt", LocalDateTime.now());
        persistence.saveAudit(value);
    }

    private void requireStage(String value) {
        if (!capabilities.stageCodes().contains(upper(value))) throw new IllegalArgumentException("unsupported stageCode: " + value);
    }
    private String normalizeCategory(String value) {
        String category = upper(value);
        if (!Arrays.asList("RECIPE", "THRESHOLD", "QUALITY_RULE").contains(category)) {
            throw new IllegalArgumentException("category must be RECIPE, THRESHOLD or QUALITY_RULE");
        }
        return category;
    }
    private String upper(String value) { return value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT); }
    private String text(Object value, String fallback) { return value == null || String.valueOf(value).trim().isEmpty() ? fallback : String.valueOf(value).trim(); }
    private int number(Object value, int fallback) { return value instanceof Number ? ((Number) value).intValue() : fallback; }
    private void require(boolean condition, String message) { if (!condition) throw new IllegalArgumentException(message); }
}
