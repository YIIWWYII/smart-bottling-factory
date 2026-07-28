package com.archermind.hdc.aiintegration.service;

import com.alibaba.fastjson.JSON;
import com.archermind.hdc.aiintegration.model.CommandIntentRecord;
import com.archermind.hdc.aiintegration.model.VisionRecognitionRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Service
public class AiIntegrationPersistence {
    @Value("${factory.persistence.enabled:false}")
    private boolean enabled;

    private final JdbcTemplate jdbcTemplate;

    public AiIntegrationPersistence(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void migrateSchema() {
        if (!enabled) return;
        jdbcTemplate.execute("create table if not exists ai_vision_recognition ("
                + "inference_id varchar(100) not null,"
                + "task_type varchar(80) not null,"
                + "camera_code varchar(100) not null,"
                + "line_id varchar(100) not null,"
                + "stage_code varchar(80) not null,"
                + "trace_code varchar(100) null,"
                + "bottle_type_code varchar(100) null,"
                + "confidence decimal(12,6) null,"
                + "evidence_ref varchar(500) null,"
                + "model_version varchar(100) null,"
                + "status varchar(30) not null,"
                + "latency_ms bigint null,"
                + "defects_json json not null,"
                + "captured_at datetime(6) not null,"
                + "received_at datetime(6) not null,"
                + "primary key(inference_id),"
                + "key idx_ai_vision_trace_time(trace_code,received_at),"
                + "key idx_ai_vision_stage_time(stage_code,received_at)"
                + ") engine=InnoDB default charset=utf8mb4 comment='AI视觉结构化识别结果'");
        jdbcTemplate.execute("create table if not exists ai_command_intent ("
                + "intent_id varchar(100) not null,"
                + "idempotency_key varchar(160) not null,"
                + "decision_id varchar(100) not null,"
                + "correlation_id varchar(100) null,"
                + "source_app varchar(30) not null,"
                + "line_id varchar(100) not null,"
                + "stage_code varchar(80) null,"
                + "device_code varchar(100) null,"
                + "trace_code varchar(100) null,"
                + "operator_name varchar(100) not null,"
                + "operator_role varchar(50) not null,"
                + "context_state_version bigint null,"
                + "status varchar(50) not null,"
                + "status_reason varchar(500) not null,"
                + "request_json json not null,"
                + "command_ids json not null,"
                + "blocked_json json not null,"
                + "created_at datetime(6) not null,"
                + "updated_at datetime(6) not null,"
                + "primary key(intent_id),"
                + "unique key uk_ai_command_intent_idempotency(idempotency_key),"
                + "key idx_ai_command_intent_decision(decision_id),"
                + "key idx_ai_command_intent_status(status,updated_at)"
                + ") engine=InnoDB default charset=utf8mb4 comment='AI字段级命令意图和后端安全门结果'");
    }

    public void save(VisionRecognitionRecord value) {
        if (!enabled) return;
        jdbcTemplate.update("insert into ai_vision_recognition(inference_id,task_type,camera_code,line_id,stage_code,"
                        + "trace_code,bottle_type_code,confidence,evidence_ref,model_version,status,latency_ms,"
                        + "defects_json,captured_at,received_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                        + "on duplicate key update status=values(status),confidence=values(confidence),"
                        + "defects_json=values(defects_json),received_at=values(received_at)",
                value.getInferenceId(), value.getTaskType(), value.getCameraCode(), value.getLineId(),
                value.getStageCode(), value.getTraceCode(), value.getBottleTypeCode(), value.getConfidence(),
                value.getEvidenceRef(), value.getModelVersion(), value.getStatus(), value.getLatencyMs(),
                value.getDefectsJson(), timestamp(value.getCapturedAt()), timestamp(value.getReceivedAt()));
    }

    public void save(CommandIntentRecord value) {
        if (!enabled) return;
        jdbcTemplate.update("insert into ai_command_intent(intent_id,idempotency_key,decision_id,correlation_id,"
                        + "source_app,line_id,stage_code,device_code,trace_code,operator_name,operator_role,"
                        + "context_state_version,status,status_reason,request_json,command_ids,blocked_json,created_at,updated_at) "
                        + "values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on duplicate key update status=values(status),"
                        + "status_reason=values(status_reason),command_ids=values(command_ids),blocked_json=values(blocked_json),"
                        + "updated_at=values(updated_at)",
                value.getIntentId(), value.getIdempotencyKey(), value.getDecisionId(), value.getCorrelationId(),
                value.getSourceApp(), value.getLineId(), value.getStageCode(), value.getDeviceCode(), value.getTraceCode(),
                value.getOperator(), value.getOperatorRole(), value.getContextStateVersion(), value.getStatus(),
                value.getStatusReason(), value.getRequestJson(), JSON.toJSONString(value.getCommandIds()),
                value.getBlockedJson(), timestamp(value.getCreatedAt()), timestamp(value.getUpdatedAt()));
    }

    public CommandIntentRecord findIntent(String idOrIdempotencyKey) {
        if (!enabled) return null;
        List<CommandIntentRecord> values = jdbcTemplate.query(
                "select intent_id,idempotency_key,decision_id,correlation_id,source_app,line_id,stage_code,device_code,"
                        + "trace_code,operator_name,operator_role,context_state_version,status,status_reason,request_json,"
                        + "command_ids,blocked_json,created_at,updated_at from ai_command_intent "
                        + "where intent_id=? or idempotency_key=?",
                new Object[]{idOrIdempotencyKey, idOrIdempotencyKey}, (rs, rowNum) -> {
                    CommandIntentRecord value = new CommandIntentRecord();
                    value.setIntentId(rs.getString("intent_id"));
                    value.setIdempotencyKey(rs.getString("idempotency_key"));
                    value.setDecisionId(rs.getString("decision_id"));
                    value.setCorrelationId(rs.getString("correlation_id"));
                    value.setSourceApp(rs.getString("source_app"));
                    value.setLineId(rs.getString("line_id"));
                    value.setStageCode(rs.getString("stage_code"));
                    value.setDeviceCode(rs.getString("device_code"));
                    value.setTraceCode(rs.getString("trace_code"));
                    value.setOperator(rs.getString("operator_name"));
                    value.setOperatorRole(rs.getString("operator_role"));
                    value.setContextStateVersion(rs.getObject("context_state_version", Long.class));
                    value.setStatus(rs.getString("status"));
                    value.setStatusReason(rs.getString("status_reason"));
                    value.setRequestJson(rs.getString("request_json"));
                    value.setCommandIds(commandIds(rs.getString("command_ids")));
                    value.setBlockedJson(rs.getString("blocked_json"));
                    value.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
                    value.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime());
                    return value;
                });
        return values.isEmpty() ? null : values.get(0);
    }

    private List<String> commandIds(String json) {
        if (json == null || json.trim().isEmpty()) return Collections.emptyList();
        String[] values = JSON.parseObject(json, String[].class);
        return values == null ? Collections.emptyList() : Arrays.asList(values);
    }

    private Timestamp timestamp(LocalDateTime value) {
        return value == null ? null : Timestamp.valueOf(value);
    }
}
