package com.archermind.hdc.factory.simulation;

import com.archermind.hdc.factory.coordination.FactoryRealtimeEventPublisher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class FactorySimulationService {
    private static final List<String> SCENARIOS = Arrays.asList(
            "NORMAL", "GAS_ALARM", "APPEARANCE_DEFECT", "SECONDARY_DEFECT", "AGV_BLOCKED");

    @Value("${factory.persistence.enabled:false}")
    private boolean persistenceEnabled;
    @Value("${factory.simulation.auto-start:true}")
    private boolean autoStart;

    private final JdbcTemplate jdbcTemplate;
    private final FactoryRealtimeEventPublisher publisher;
    private final SimulationState state = new SimulationState();

    public FactorySimulationService(JdbcTemplate jdbcTemplate, FactoryRealtimeEventPublisher publisher) {
        this.jdbcTemplate = jdbcTemplate;
        this.publisher = publisher;
        state.setScenarioCode("NORMAL");
        state.setStatus("STOPPED");
        state.setUpdatedAt(LocalDateTime.now());
    }

    @PostConstruct
    public synchronized void restore() {
        if (persistenceEnabled) {
            try {
                SimulationState stored = jdbcTemplate.queryForObject(
                        "select scenario_code,status,tick,started_at,updated_at from factory_simulation_state "
                                + "where line_id='LINE-01'",
                        (rs, rowNum) -> {
                            SimulationState value = new SimulationState();
                            value.setScenarioCode(rs.getString("scenario_code"));
                            value.setStatus(rs.getString("status"));
                            value.setTick(rs.getLong("tick"));
                            Timestamp started = rs.getTimestamp("started_at");
                            value.setStartedAt(started == null ? null : started.toLocalDateTime());
                            value.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime());
                            return value;
                        });
                if (stored != null) copyInto(stored, state);
            } catch (EmptyResultDataAccessException ignored) {
                // First start uses the configured initial state below.
            }
        }
        if (autoStart && "STOPPED".equals(state.getStatus())) {
            state.setStatus("RUNNING");
            state.setStartedAt(LocalDateTime.now());
            state.setUpdatedAt(state.getStartedAt());
        }
        save();
    }

    public List<Map<String, Object>> scenarios() {
        List<Map<String, Object>> values = new ArrayList<>();
        for (String code : SCENARIOS) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("scenarioCode", code);
            item.put("name", scenarioName(code));
            item.put("description", scenarioDescription(code));
            values.add(item);
        }
        return values;
    }

    public synchronized SimulationState start(String scenarioCode) {
        String code = normalizeScenario(scenarioCode);
        state.setScenarioCode(code);
        state.setStatus("RUNNING");
        state.setTick(0L);
        state.setStartedAt(LocalDateTime.now());
        state.setUpdatedAt(state.getStartedAt());
        save();
        publisher.publish("simulation.changed", null, state.copy());
        return state.copy();
    }

    public synchronized SimulationState stop() {
        state.setStatus("STOPPED");
        state.setUpdatedAt(LocalDateTime.now());
        save();
        publisher.publish("simulation.changed", null, state.copy());
        return state.copy();
    }

    public synchronized SimulationState reset() {
        state.setTick(0L);
        state.setStatus(autoStart ? "RUNNING" : "STOPPED");
        state.setStartedAt("RUNNING".equals(state.getStatus()) ? LocalDateTime.now() : null);
        state.setUpdatedAt(LocalDateTime.now());
        save();
        publisher.publish("simulation.changed", null, state.copy());
        return state.copy();
    }

    public synchronized SimulationState state() {
        return state.copy();
    }

    @Scheduled(fixedRateString = "${factory.simulation.tick-millis:1000}")
    public synchronized void tick() {
        if (!"RUNNING".equals(state.getStatus())) return;
        state.setTick(state.getTick() + 1L);
        state.setUpdatedAt(LocalDateTime.now());
        save();
        publisher.publish("simulation.changed", null, state.copy());
    }

    private String normalizeScenario(String scenarioCode) {
        String value = StringUtils.hasText(scenarioCode)
                ? scenarioCode.trim().toUpperCase(Locale.ROOT) : "NORMAL";
        if (!SCENARIOS.contains(value)) throw new IllegalArgumentException("unsupported scenarioCode: " + value);
        return value;
    }

    private void save() {
        if (!persistenceEnabled) return;
        jdbcTemplate.update(
                "insert into factory_simulation_state(line_id,scenario_code,status,tick,started_at,updated_at) "
                        + "values('LINE-01',?,?,?,?,?) on duplicate key update scenario_code=values(scenario_code),"
                        + "status=values(status),tick=values(tick),started_at=values(started_at),updated_at=values(updated_at)",
                state.getScenarioCode(), state.getStatus(), state.getTick(), timestamp(state.getStartedAt()),
                timestamp(state.getUpdatedAt()));
    }

    private Timestamp timestamp(LocalDateTime value) {
        return value == null ? null : Timestamp.valueOf(value);
    }

    private void copyInto(SimulationState source, SimulationState target) {
        target.setScenarioCode(source.getScenarioCode());
        target.setStatus(source.getStatus());
        target.setTick(source.getTick());
        target.setStartedAt(source.getStartedAt());
        target.setUpdatedAt(source.getUpdatedAt());
    }

    private String scenarioName(String code) {
        if ("GAS_ALARM".equals(code)) return "气体超限";
        if ("APPEARANCE_DEFECT".equals(code)) return "外观缺陷";
        if ("SECONDARY_DEFECT".equals(code)) return "二检缺陷";
        if ("AGV_BLOCKED".equals(code)) return "AGV 避障";
        return "正常连续生产";
    }

    private String scenarioDescription(String code) {
        if ("NORMAL".equals(code)) return "九工序连续运行，产品按节拍流转";
        return "在保持其他工位独立运行的同时注入 " + scenarioName(code) + " 事件";
    }
}
