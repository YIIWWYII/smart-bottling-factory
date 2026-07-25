package com.archermind.hdc.factory.service;

import com.archermind.hdc.factory.dto.FactoryDashboard;
import com.archermind.hdc.factory.dto.FactoryDispositionRequest;
import com.archermind.hdc.factory.dto.FactoryStartRequest;
import com.archermind.hdc.factory.dto.FactoryStepRequest;
import com.archermind.hdc.factory.model.FactoryEvent;
import com.archermind.hdc.factory.model.FactoryRun;
import com.archermind.hdc.factory.runtime.service.FactoryRuntimeService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class FactoryService {
    public static final String RUNNING = "RUNNING";
    public static final String COMPLETED = "COMPLETED";
    public static final String REJECTED = "REJECTED";
    public static final String HOLD = "HOLD";

    private static final double VOC_LIMIT = 10.0D;
    private static final DateTimeFormatter CODE_TIME =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final Map<String, FactoryRun> runs = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong(1);
    private final FactoryRealtimePublisher realtimePublisher;
    @Autowired(required = false)
    private FactoryPersistence persistence;
    @Autowired(required = false)
    private FactoryRuntimeService runtimeService;

    public FactoryService(FactoryRealtimePublisher realtimePublisher) {
        this.realtimePublisher = realtimePublisher;
    }

    @PostConstruct
    public void restore() {
        if (persistence == null || !persistence.isEnabled()) {
            return;
        }
        for (FactoryRun run : persistence.loadRuns()) {
            runs.put(run.getTraceCode(), run);
        }
    }

    public FactoryRun start(FactoryStartRequest request) {
        String traceCode = normalizeTraceCode(request == null ? null : request.getTraceCode());
        String bottleType = normalize(request == null ? null : request.getBottleType(), "PLA-500");
        String scenario = normalize(request == null ? null : request.getScenario(), "MANUAL");

        FactoryRun run = new FactoryRun();
        run.setTraceCode(traceCode);
        run.setBatchCode("BATCH-" + LocalDateTime.now().format(CODE_TIME));
        run.setBottleType(bottleType);
        run.setScenario(scenario.toUpperCase(Locale.ROOT));
        run.setCurrentStage("PRETREATMENT");
        run.setStatus(RUNNING);
        run.setStartedAt(LocalDateTime.now());
        run.setUpdatedAt(run.getStartedAt());

        if (runs.putIfAbsent(traceCode, run) != null) {
            throw new IllegalStateException("traceCode already exists: " + traceCode);
        }
        // The run row must exist before its first event because factory_event has a foreign key.
        persist(run);
        appendEvent(run, "IDENTIFICATION", "PASSED", "Bottle type identified: " + bottleType);
        return run.copy();
    }

    public FactoryRun step(String traceCode, FactoryStepRequest request) {
        FactoryRun run = required(traceCode);
        if (request == null || !StringUtils.hasText(request.getStage())) {
            throw new IllegalArgumentException("stage is required");
        }
        synchronized (run) {
            ensureRunning(run);
            String stage = request.getStage().trim().toUpperCase(Locale.ROOT);
            if (!stage.equals(run.getCurrentStage())) {
                throw new IllegalStateException(
                        "expected stage " + run.getCurrentStage() + " but received " + stage);
            }
            if (stage.startsWith("BUFFER_") || stage.startsWith("REWORK_")) {
                completeAuxiliaryRoute(run, stage, request);
                run.setUpdatedAt(LocalDateTime.now());
                persist(run);
                return run.copy();
            }
            applyStage(run, stage, request);
            run.setUpdatedAt(LocalDateTime.now());
            persist(run);
            return run.copy();
        }
    }

    public FactoryRun runScenario(FactoryStartRequest request) {
        FactoryStartRequest actual = request == null ? new FactoryStartRequest() : request;
        String scenario = normalize(actual.getScenario(), "NORMAL").toUpperCase(Locale.ROOT);
        actual.setScenario(scenario);
        FactoryRun run = start(actual);
        String traceCode = run.getTraceCode();

        step(traceCode, step("PRETREATMENT", "PASS", null, null));
        if ("GAS_ALARM".equals(scenario)) {
            return step(traceCode, step("GAS_INSPECTION", "FAIL", 12.5D, null));
        }
        step(traceCode, step("GAS_INSPECTION", "PASS", 6.2D, null));
        if ("APPEARANCE_DEFECT".equals(scenario)) {
            return step(traceCode, step("APPEARANCE_INSPECTION", "FAIL", null, "BODY_DENT"));
        }
        step(traceCode, step("APPEARANCE_INSPECTION", "PASS", null, null));
        step(traceCode, step("BEVERAGE_READY", "PASS", 25.0D, null));
        step(traceCode, step("FILLING", "PASS", null, null));
        if ("SECONDARY_DEFECT".equals(scenario)) {
            return step(traceCode, step("SECONDARY_INSPECTION", "FAIL", null, "CAP_TILTED"));
        }
        step(traceCode, step("SECONDARY_INSPECTION", "PASS", null, null));
        step(traceCode, step("PACKING", "PASS", null, null));
        if ("AGV_BLOCKED".equals(scenario)) {
            return step(traceCode, step("AGV_TRANSPORT", "FAIL", null, null));
        }
        step(traceCode, step("AGV_TRANSPORT", "PASS", null, null));
        return step(traceCode, step("WAREHOUSE_INBOUND", "PASS", null, null));
    }

    public FactoryRun find(String traceCode) {
        return required(traceCode).copy();
    }

    public FactoryRun disposition(String traceCode, FactoryDispositionRequest request) {
        FactoryRun run = required(traceCode);
        if (request == null || !StringUtils.hasText(request.getAction())) {
            throw new IllegalArgumentException("action is required");
        }
        synchronized (run) {
            String action = request.getAction().trim().toUpperCase(Locale.ROOT);
            String current = run.getCurrentStage();
            String target = normalize(request.getTargetStage(), null);
            if ("REJECT_PRODUCT".equals(action)) {
                run.setStatus(REJECTED);
            } else if ("RESUME".equals(action)) {
                run.setCurrentStage(StringUtils.hasText(target) ? target.toUpperCase(Locale.ROOT) : baseStage(current));
                run.setStatus(RUNNING);
            } else if ("RETURN_PREVIOUS".equals(action)) {
                run.setCurrentStage(StringUtils.hasText(target) ? target.toUpperCase(Locale.ROOT) : previousStage(baseStage(current)));
                run.setStatus(RUNNING);
            } else if ("ROUTE_REWORK".equals(action)) {
                run.setCurrentStage(StringUtils.hasText(target) ? target.toUpperCase(Locale.ROOT) : "REWORK_" + baseStage(current));
                run.setStatus(RUNNING);
            } else if ("ROUTE_BUFFER".equals(action) || "BUFFER_AND_STOP".equals(action)) {
                run.setCurrentStage(StringUtils.hasText(target) ? target.toUpperCase(Locale.ROOT) : "BUFFER_" + baseStage(current));
                run.setStatus(RUNNING);
            } else if ("STOP_STAGE".equals(action) || "MANUAL_HOLD".equals(action)) {
                run.setStatus(HOLD);
            } else {
                throw new IllegalArgumentException("unsupported disposition action: " + action);
            }
            appendEvent(run, current, "DISPOSITION", action + ": " + normalize(request.getNote(), "operator decision"));
            run.setUpdatedAt(LocalDateTime.now());
            persist(run);
            return run.copy();
        }
    }

    public FactoryDashboard dashboard() {
        List<FactoryRun> copies = new ArrayList<>();
        for (FactoryRun run : runs.values()) {
            copies.add(run.copy());
        }
        copies.sort(Comparator.comparing(FactoryRun::getUpdatedAt).reversed());
        FactoryDashboard dashboard = new FactoryDashboard();
        dashboard.setRuns(copies);
        dashboard.setTotal(copies.size());
        for (FactoryRun run : copies) {
            if (RUNNING.equals(run.getStatus())) dashboard.setRunning(dashboard.getRunning() + 1);
            if (COMPLETED.equals(run.getStatus())) dashboard.setCompleted(dashboard.getCompleted() + 1);
            if (REJECTED.equals(run.getStatus())) dashboard.setRejected(dashboard.getRejected() + 1);
            if (HOLD.equals(run.getStatus())) dashboard.setHolding(dashboard.getHolding() + 1);
        }
        return dashboard;
    }

    public void reset() {
        runs.clear();
    }

    private void applyStage(FactoryRun run, String stage, FactoryStepRequest request) {
        String result = normalize(request.getResult(), "PASS").toUpperCase(Locale.ROOT);
        if ("PRETREATMENT".equals(stage)) {
            passOrHold(run, stage, result, "GAS_INSPECTION", "Pretreatment completed");
        } else if ("GAS_INSPECTION".equals(stage)) {
            applyGasInspection(run, request, result);
        } else if ("APPEARANCE_INSPECTION".equals(stage)) {
            applyInspection(run, stage, result, request.getDefectType(), "BEVERAGE_READY");
        } else if ("BEVERAGE_READY".equals(stage)) {
            run.setBeverageTemperature(request.getValue());
            passOrHold(run, stage, result, "FILLING", "Beverage batch ready");
        } else if ("FILLING".equals(stage)) {
            passOrHold(run, stage, result, "SECONDARY_INSPECTION", "Filling completed");
        } else if ("SECONDARY_INSPECTION".equals(stage)) {
            applyInspection(run, stage, result, request.getDefectType(), "PACKING");
        } else if ("PACKING".equals(stage)) {
            if (isPass(result)) {
                run.setBoxCode("BOX-" + suffix(run.getTraceCode()));
                advance(run, stage, "PASSED", "Packed into " + run.getBoxCode(), "AGV_TRANSPORT");
            } else {
                reportIncident(run, stage, "PK-ARM-01", "EQUIPMENT_FAILURE", "Packing failed", "BUFFER_AND_STOP");
                hold(run, stage, "Packing failed");
            }
        } else if ("AGV_TRANSPORT".equals(stage)) {
            run.setAgvTaskCode("AGV-TASK-" + suffix(run.getTraceCode()));
            if (isPass(result)) {
                advance(run, stage, "PASSED", "AGV arrived at warehouse", "WAREHOUSE_INBOUND");
            } else {
                reportIncident(run, stage, "AGV-01", "AGV_BLOCKED", "AGV stopped or blocked", "BUFFER_AND_STOP");
                hold(run, stage, "AGV stopped or blocked");
            }
        } else if ("WAREHOUSE_INBOUND".equals(stage)) {
            if (isPass(result)) {
                run.setWarehouseLocation("A-01-01");
                run.setCurrentStage("COMPLETED");
                run.setStatus(COMPLETED);
                appendEvent(run, stage, "PASSED", "Inbound at " + run.getWarehouseLocation());
            } else {
                reportIncident(run, stage, "WH-WMS-01", "WAREHOUSE_SAFETY", "Warehouse safety check failed", "STOP_STAGE");
                hold(run, stage, "Warehouse safety check failed");
            }
        } else {
            throw new IllegalArgumentException("unsupported stage: " + stage);
        }
    }

    private void completeAuxiliaryRoute(FactoryRun run, String routeStage, FactoryStepRequest request) {
        String result = normalize(request.getResult(), "PASS").toUpperCase(Locale.ROOT);
        if (!isPass(result)) {
            run.setStatus(HOLD);
            appendEvent(run, routeStage, "FAILED", routeStage + " requires manual handling");
            return;
        }
        String target = baseStage(routeStage);
        appendEvent(run, routeStage, "PASSED", routeStage + " completed; return to " + target);
        run.setCurrentStage(target);
        run.setStatus(RUNNING);
    }

    private void applyGasInspection(FactoryRun run, FactoryStepRequest request, String result) {
        Double voc = request.getValue();
        if (voc == null) {
            throw new IllegalArgumentException("gas inspection requires value");
        }
        run.setVoc(voc);
        if (!isPass(result) || voc > VOC_LIMIT) {
            reportIncident(run, "GAS_INSPECTION", "GAS-VERIFY-01", "VOC_SAFETY_LIMIT",
                    "VOC exceeded limit: " + voc + " ppm", "STOP_STAGE");
            hold(run, "GAS_INSPECTION", "VOC exceeded limit: " + voc + " ppm");
            return;
        }
        advance(run, "GAS_INSPECTION", "PASSED", "VOC safe: " + voc + " ppm",
                "APPEARANCE_INSPECTION");
    }

    private void applyInspection(FactoryRun run, String stage, String result,
                                 String defectType, String nextStage) {
        if (!isPass(result)) {
            run.setDefectType(normalize(defectType, "UNKNOWN_DEFECT"));
            run.setStatus(REJECTED);
            reportIncident(run, stage, stage.equals("APPEARANCE_INSPECTION") ? "VIS-REJECT-01" : "SEC-REJECT-01",
                    "PRODUCT_DEFECT", "Rejected: " + run.getDefectType(), "REJECT_PRODUCT");
            appendEvent(run, stage, "FAILED", "Rejected: " + run.getDefectType());
            return;
        }
        advance(run, stage, "PASSED", "Inspection passed", nextStage);
    }

    private void passOrHold(FactoryRun run, String stage, String result,
                            String nextStage, String successMessage) {
        if (isPass(result)) {
            advance(run, stage, "PASSED", successMessage, nextStage);
        } else {
            reportIncident(run, stage, null, "PROCESS_FAILURE", stage + " failed", "ROUTE_REWORK");
            hold(run, stage, stage + " failed");
        }
    }

    private void advance(FactoryRun run, String stage, String status,
                         String message, String nextStage) {
        appendEvent(run, stage, status, message);
        run.setCurrentStage(nextStage);
    }

    private void hold(FactoryRun run, String stage, String message) {
        run.setStatus(HOLD);
        appendEvent(run, stage, "FAILED", message);
    }

    private void appendEvent(FactoryRun run, String stage, String status, String message) {
        FactoryEvent event = new FactoryEvent(
                "EVT-" + UUID.randomUUID(),
                run.getTraceCode(),
                stage,
                status,
                message,
                LocalDateTime.now());
        run.getEvents().add(event);
        if (persistence != null) {
            persistence.saveEvent(event);
        }
        realtimePublisher.publish(event);
    }

    private void persist(FactoryRun run) {
        if (persistence != null) {
            persistence.saveRun(run);
        }
    }

    private void reportIncident(FactoryRun run, String stage, String deviceCode,
                                String type, String message, String strategy) {
        if (runtimeService == null) return;
        runtimeService.reportAutomatic(run.getTraceCode(), stage, deviceCode, type, message, strategy);
    }

    private FactoryRun required(String traceCode) {
        FactoryRun run = runs.get(traceCode);
        if (run == null) {
            throw new IllegalArgumentException("traceCode not found: " + traceCode);
        }
        return run;
    }

    private void ensureRunning(FactoryRun run) {
        if (!RUNNING.equals(run.getStatus())) {
            throw new IllegalStateException("run is not active: " + run.getStatus());
        }
    }

    private FactoryStepRequest step(String stage, String result, Double value, String defectType) {
        FactoryStepRequest request = new FactoryStepRequest();
        request.setStage(stage);
        request.setResult(result);
        request.setValue(value);
        request.setDefectType(defectType);
        return request;
    }

    private boolean isPass(String result) {
        return "PASS".equals(result) || "SUCCESS".equals(result);
    }

    private String normalizeTraceCode(String traceCode) {
        if (StringUtils.hasText(traceCode)) {
            return traceCode.trim();
        }
        return "BOT-" + LocalDateTime.now().format(CODE_TIME) + "-" + sequence.getAndIncrement();
    }

    private String normalize(String value, String defaultValue) {
        return StringUtils.hasText(value) ? value.trim() : defaultValue;
    }

    private String suffix(String traceCode) {
        int index = traceCode.lastIndexOf('-');
        return index >= 0 ? traceCode.substring(index + 1) : traceCode;
    }

    private String baseStage(String stage) {
        if (stage == null) return "PRETREATMENT";
        if (stage.startsWith("BUFFER_")) return stage.substring("BUFFER_".length());
        if (stage.startsWith("REWORK_")) return stage.substring("REWORK_".length());
        return stage;
    }

    private String previousStage(String stage) {
        String[] stages = {"PRETREATMENT", "GAS_INSPECTION", "APPEARANCE_INSPECTION", "BEVERAGE_READY",
                "FILLING", "SECONDARY_INSPECTION", "PACKING", "AGV_TRANSPORT", "WAREHOUSE_INBOUND"};
        for (int index = 1; index < stages.length; index++) {
            if (stages[index].equals(stage)) return stages[index - 1];
        }
        return "PRETREATMENT";
    }
}
