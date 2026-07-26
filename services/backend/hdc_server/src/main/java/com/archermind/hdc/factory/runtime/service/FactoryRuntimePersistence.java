package com.archermind.hdc.factory.runtime.service;

import com.archermind.hdc.factory.runtime.model.DeviceRuntimeState;
import com.archermind.hdc.factory.runtime.model.FactoryIncident;
import com.archermind.hdc.factory.runtime.model.StageRuntimeState;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FactoryRuntimePersistence {
    @Value("${factory.persistence.enabled:false}")
    private boolean enabled;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public FactoryRuntimePersistence(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public List<DeviceRuntimeState> loadDevices() {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select device_code,stage_code,state,source,speed_mps,progress,metrics,occurred_at "
                        + "from factory_device_runtime",
                (rs, rowNum) -> {
                    DeviceRuntimeState value = new DeviceRuntimeState();
                    value.setDeviceCode(rs.getString("device_code"));
                    value.setStageCode(rs.getString("stage_code"));
                    value.setState(rs.getString("state"));
                    value.setSource(rs.getString("source"));
                    value.setFallback(false);
                    value.setSpeedMps(rs.getObject("speed_mps", Double.class));
                    value.setProgress(rs.getObject("progress", Double.class));
                    value.setMetrics(readMap(rs.getString("metrics")));
                    value.setOccurredAt(rs.getTimestamp("occurred_at").toLocalDateTime());
                    return value;
                });
    }

    public List<StageRuntimeState> loadStages() {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select stage_code,state,reason,upstream_impact,downstream_impact,buffer_level,buffer_capacity "
                        + "from factory_stage_runtime",
                (rs, rowNum) -> {
                    StageRuntimeState value = new StageRuntimeState();
                    value.setStageCode(rs.getString("stage_code"));
                    value.setState(rs.getString("state"));
                    value.setReason(rs.getString("reason"));
                    value.setUpstreamImpact(rs.getString("upstream_impact"));
                    value.setDownstreamImpact(rs.getString("downstream_impact"));
                    value.setBufferLevel(rs.getInt("buffer_level"));
                    value.setBufferCapacity(rs.getInt("buffer_capacity"));
                    return value;
                });
    }

    public List<FactoryIncident> loadIncidents() {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select incident_id,trace_code,stage_code,device_code,incident_type,message,strategy,target_stage,"
                        + "status,resolution_action,resolution_note,affected_stages,created_at,resolved_at "
                        + "from factory_incident order by created_at desc",
                (rs, rowNum) -> {
                    FactoryIncident value = new FactoryIncident();
                    value.setIncidentId(rs.getString("incident_id"));
                    value.setTraceCode(rs.getString("trace_code"));
                    value.setStageCode(rs.getString("stage_code"));
                    value.setDeviceCode(rs.getString("device_code"));
                    value.setIncidentType(rs.getString("incident_type"));
                    value.setMessage(rs.getString("message"));
                    value.setStrategy(rs.getString("strategy"));
                    value.setTargetStage(rs.getString("target_stage"));
                    value.setStatus(rs.getString("status"));
                    value.setResolutionAction(rs.getString("resolution_action"));
                    value.setResolutionNote(rs.getString("resolution_note"));
                    value.setAffectedStages(readList(rs.getString("affected_stages")));
                    value.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
                    Timestamp resolvedAt = rs.getTimestamp("resolved_at");
                    value.setResolvedAt(resolvedAt == null ? null : resolvedAt.toLocalDateTime());
                    return value;
                });
    }

    public void saveDevice(DeviceRuntimeState value) {
        if (!enabled) return;
        jdbcTemplate.update(
                "insert into factory_device_runtime(device_code,stage_code,state,source,speed_mps,progress,metrics,"
                        + "occurred_at,received_at) values(?,?,?,?,?,?,?,?,now(6)) "
                        + "on duplicate key update stage_code=values(stage_code),state=values(state),"
                        + "source=values(source),speed_mps=values(speed_mps),progress=values(progress),"
                        + "metrics=values(metrics),occurred_at=values(occurred_at),received_at=now(6)",
                value.getDeviceCode(), value.getStageCode(), value.getState(), value.getSource(), value.getSpeedMps(),
                value.getProgress(), writeJson(value.getMetrics()), Timestamp.valueOf(value.getOccurredAt()));
    }

    public void saveStages(Collection<StageRuntimeState> values) {
        if (!enabled) return;
        for (StageRuntimeState value : values) {
            jdbcTemplate.update(
                    "insert into factory_stage_runtime(stage_code,state,reason,upstream_impact,downstream_impact,"
                            + "buffer_level,buffer_capacity) values(?,?,?,?,?,?,?) on duplicate key update "
                            + "state=values(state),reason=values(reason),upstream_impact=values(upstream_impact),"
                            + "downstream_impact=values(downstream_impact),buffer_level=values(buffer_level),"
                            + "buffer_capacity=values(buffer_capacity)",
                    value.getStageCode(), value.getState(), value.getReason(), value.getUpstreamImpact(),
                    value.getDownstreamImpact(), value.getBufferLevel(), value.getBufferCapacity());
        }
    }

    public void saveIncident(FactoryIncident value) {
        if (!enabled) return;
        jdbcTemplate.update(
                "insert into factory_incident(incident_id,trace_code,stage_code,device_code,incident_type,message,"
                        + "strategy,target_stage,status,resolution_action,resolution_note,affected_stages,created_at,"
                        + "resolved_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?) on duplicate key update "
                        + "trace_code=values(trace_code),stage_code=values(stage_code),device_code=values(device_code),"
                        + "incident_type=values(incident_type),message=values(message),strategy=values(strategy),"
                        + "target_stage=values(target_stage),status=values(status),"
                        + "resolution_action=values(resolution_action),resolution_note=values(resolution_note),"
                        + "affected_stages=values(affected_stages),resolved_at=values(resolved_at)",
                value.getIncidentId(), value.getTraceCode(), value.getStageCode(), value.getDeviceCode(),
                value.getIncidentType(), value.getMessage(), value.getStrategy(), value.getTargetStage(),
                value.getStatus(), value.getResolutionAction(), value.getResolutionNote(),
                writeJson(value.getAffectedStages()), Timestamp.valueOf(value.getCreatedAt()),
                value.getResolvedAt() == null ? null : Timestamp.valueOf(value.getResolvedAt()));
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("runtime data cannot be serialized", exception);
        }
    }

    private Map<String, Object> readMap(String value) {
        if (value == null || value.trim().isEmpty()) return new LinkedHashMap<>();
        try {
            return objectMapper.readValue(value, new TypeReference<LinkedHashMap<String, Object>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("runtime metrics cannot be restored", exception);
        }
    }

    private List<String> readList(String value) {
        if (value == null || value.trim().isEmpty()) return new ArrayList<>();
        try {
            return objectMapper.readValue(value, new TypeReference<ArrayList<String>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("incident stages cannot be restored", exception);
        }
    }
}
