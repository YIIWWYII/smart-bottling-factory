package com.archermind.hdc.factory.service;

import com.archermind.hdc.factory.model.FactoryEvent;
import com.archermind.hdc.factory.model.FactoryRun;
import com.archermind.hdc.log.XLog;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

@Service
public class FactoryPersistence {
    @Value("${factory.persistence.enabled:false}")
    private boolean enabled;

    private final JdbcTemplate jdbcTemplate;

    public FactoryPersistence(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void check() {
        XLog.info("factory persistence enabled=" + enabled);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public List<FactoryRun> loadRuns() {
        if (!enabled) return new ArrayList<>();
        List<FactoryRun> runs = jdbcTemplate.query(
                "select trace_code,batch_code,bottle_type,scenario,current_stage,status,voc,"
                        + "beverage_temperature,beverage_humidity,defect_type,box_code,agv_task_code,"
                        + "warehouse_location,started_at,updated_at from factory_run order by updated_at desc",
                (rs, rowNum) -> {
                    FactoryRun run = new FactoryRun();
                    run.setTraceCode(rs.getString("trace_code"));
                    run.setBatchCode(rs.getString("batch_code"));
                    run.setBottleType(rs.getString("bottle_type"));
                    run.setScenario(rs.getString("scenario"));
                    run.setCurrentStage(rs.getString("current_stage"));
                    run.setStatus(rs.getString("status"));
                    run.setVoc(rs.getObject("voc", Double.class));
                    run.setBeverageTemperature(rs.getObject("beverage_temperature", Double.class));
                    run.setBeverageHumidity(rs.getObject("beverage_humidity", Double.class));
                    run.setDefectType(rs.getString("defect_type"));
                    run.setBoxCode(rs.getString("box_code"));
                    run.setAgvTaskCode(rs.getString("agv_task_code"));
                    run.setWarehouseLocation(rs.getString("warehouse_location"));
                    run.setStartedAt(rs.getTimestamp("started_at").toLocalDateTime());
                    run.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime());
                    return run;
                });
        for (FactoryRun run : runs) run.setEvents(loadEvents(run.getTraceCode()));
        return runs;
    }

    private List<FactoryEvent> loadEvents(String traceCode) {
        return jdbcTemplate.query(
                "select event_id,trace_code,stage,status,message,occurred_at from factory_event "
                        + "where trace_code=? order by occurred_at,event_id",
                new Object[]{traceCode},
                (rs, rowNum) -> new FactoryEvent(
                        rs.getString("event_id"),
                        rs.getString("trace_code"),
                        rs.getString("stage"),
                        rs.getString("status"),
                        rs.getString("message"),
                        rs.getTimestamp("occurred_at").toLocalDateTime()));
    }

    public void saveRun(FactoryRun run) {
        if (!enabled) return;
        jdbcTemplate.update(
                "insert into factory_run(trace_code,batch_code,bottle_type,scenario,current_stage,status,voc,"
                        + "beverage_temperature,beverage_humidity,defect_type,box_code,agv_task_code,"
                        + "warehouse_location,started_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                        + "on duplicate key update batch_code=values(batch_code),bottle_type=values(bottle_type),"
                        + "scenario=values(scenario),current_stage=values(current_stage),status=values(status),"
                        + "voc=values(voc),beverage_temperature=values(beverage_temperature),"
                        + "beverage_humidity=values(beverage_humidity),defect_type=values(defect_type),"
                        + "box_code=values(box_code),agv_task_code=values(agv_task_code),"
                        + "warehouse_location=values(warehouse_location),updated_at=values(updated_at)",
                run.getTraceCode(), run.getBatchCode(), run.getBottleType(), run.getScenario(),
                run.getCurrentStage(), run.getStatus(), run.getVoc(), run.getBeverageTemperature(),
                run.getBeverageHumidity(), run.getDefectType(), run.getBoxCode(), run.getAgvTaskCode(),
                run.getWarehouseLocation(), Timestamp.valueOf(run.getStartedAt()),
                Timestamp.valueOf(run.getUpdatedAt()));
    }

    public void saveEvent(FactoryEvent event) {
        if (!enabled) return;
        jdbcTemplate.update(
                "insert ignore into factory_event(event_id,trace_code,stage,status,message,occurred_at) "
                        + "values(?,?,?,?,?,?)",
                event.getEventId(), event.getTraceCode(), event.getStage(), event.getStatus(),
                event.getMessage(), Timestamp.valueOf(event.getOccurredAt()));
    }
}
