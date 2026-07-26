package com.archermind.hdc.operations.service;

import com.archermind.hdc.operations.model.AiAuditRecord;
import com.archermind.hdc.operations.model.AlarmRecord;
import com.archermind.hdc.operations.model.DeviceCommand;
import com.archermind.hdc.operations.model.SensorReading;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

@Service
public class OperationsPersistence {
    @Value("${factory.persistence.enabled:false}")
    private boolean enabled;

    private final JdbcTemplate jdbcTemplate;

    public OperationsPersistence(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean isEnabled() { return enabled; }

    @PostConstruct
    public void migrateSchema() {
        if (!enabled) return;
        addColumnIfMissing("device_command", "client_request_id", "varchar(100) null");
        addColumnIfMissing("device_command", "client_type", "varchar(50) null");
        addColumnIfMissing("device_command", "line_id", "varchar(100) null");
        addColumnIfMissing("device_command", "stage_code", "varchar(80) null");
        addColumnIfMissing("device_command", "operator_name", "varchar(100) null");
        addColumnIfMissing("device_command", "operator_role", "varchar(50) null");
        addColumnIfMissing("device_command", "reason", "varchar(500) null");
        addColumnIfMissing("device_command", "expires_at", "datetime(6) null");
        addColumnIfMissing("device_command", "expected_state_version", "bigint null");
        addColumnIfMissing("device_command", "accepted_state_version", "bigint null");
        addColumnIfMissing("device_command", "recipe_version", "varchar(100) null");
        addColumnIfMissing("device_command", "old_value", "text null");
        addColumnIfMissing("device_command", "new_value", "text null");
        addColumnIfMissing("device_command", "safety_validation", "text null");
        addColumnIfMissing("device_command", "edge_ack_id", "varchar(100) null");
        addUniqueIndexIfMissing("device_command", "uk_device_command_client_request",
                "client_request_id");
    }

    public List<SensorReading> loadReadings() {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select reading_id,device_code,sensor_type,stage,trace_code,value,unit,quality,mode,occurred_at "
                        + "from sensor_reading order by occurred_at desc limit 1000",
                (rs, rowNum) -> {
                    SensorReading value = new SensorReading();
                    value.setReadingId(rs.getString("reading_id"));
                    value.setDeviceCode(rs.getString("device_code"));
                    value.setSensorType(rs.getString("sensor_type"));
                    value.setStage(rs.getString("stage"));
                    value.setTraceCode(rs.getString("trace_code"));
                    value.setValue(rs.getObject("value", Double.class));
                    value.setUnit(rs.getString("unit"));
                    value.setQuality(rs.getString("quality"));
                    value.setMode(rs.getString("mode"));
                    value.setOccurredAt(rs.getTimestamp("occurred_at").toLocalDateTime());
                    return value;
                });
    }

    public List<AlarmRecord> loadAlarms() {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select alarm_id,device_code,trace_code,alarm_type,level,status,message,value,limit_value,"
                        + "occurred_at,acknowledged_at from factory_alarm order by occurred_at desc limit 500",
                (rs, rowNum) -> {
                    AlarmRecord value = new AlarmRecord();
                    value.setAlarmId(rs.getString("alarm_id"));
                    value.setDeviceCode(rs.getString("device_code"));
                    value.setTraceCode(rs.getString("trace_code"));
                    value.setAlarmType(rs.getString("alarm_type"));
                    value.setLevel(rs.getString("level"));
                    value.setStatus(rs.getString("status"));
                    value.setMessage(rs.getString("message"));
                    value.setValue(rs.getObject("value", Double.class));
                    value.setLimitValue(rs.getObject("limit_value", Double.class));
                    value.setOccurredAt(rs.getTimestamp("occurred_at").toLocalDateTime());
                    Timestamp ack = rs.getTimestamp("acknowledged_at");
                    value.setAcknowledgedAt(ack == null ? null : ack.toLocalDateTime());
                    return value;
                });
    }

    public List<DeviceCommand> loadCommands() {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select command_id,client_request_id,client_type,line_id,stage_code,device_code,command_type,payload,"
                        + "source,trace_code,operator_name,operator_role,reason,expected_state_version,"
                        + "accepted_state_version,recipe_version,old_value,new_value,safety_validation,status,message,"
                        + "created_at,expires_at,acknowledged_at,edge_ack_id from device_command order by created_at desc limit 500",
                (rs, rowNum) -> {
                    DeviceCommand value = new DeviceCommand();
                    value.setCommandId(rs.getString("command_id"));
                    value.setClientRequestId(rs.getString("client_request_id"));
                    value.setClientType(rs.getString("client_type"));
                    value.setLineId(rs.getString("line_id"));
                    value.setStageCode(rs.getString("stage_code"));
                    value.setDeviceCode(rs.getString("device_code"));
                    value.setCommandType(rs.getString("command_type"));
                    value.setPayload(rs.getString("payload"));
                    value.setSource(rs.getString("source"));
                    value.setTraceCode(rs.getString("trace_code"));
                    value.setOperator(rs.getString("operator_name"));
                    value.setOperatorRole(rs.getString("operator_role"));
                    value.setReason(rs.getString("reason"));
                    value.setExpectedStateVersion(rs.getObject("expected_state_version", Long.class));
                    value.setAcceptedStateVersion(rs.getObject("accepted_state_version", Long.class));
                    value.setRecipeVersion(rs.getString("recipe_version"));
                    value.setOldValue(rs.getString("old_value"));
                    value.setNewValue(rs.getString("new_value"));
                    value.setSafetyValidation(rs.getString("safety_validation"));
                    value.setStatus(rs.getString("status"));
                    value.setMessage(rs.getString("message"));
                    value.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
                    Timestamp expiresAt = rs.getTimestamp("expires_at");
                    value.setExpiresAt(expiresAt == null ? null : expiresAt.toLocalDateTime());
                    Timestamp ack = rs.getTimestamp("acknowledged_at");
                    value.setAcknowledgedAt(ack == null ? null : ack.toLocalDateTime());
                    value.setEdgeAckId(rs.getString("edge_ack_id"));
                    return value;
                });
    }

    public List<AiAuditRecord> loadAiAudits() {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select audit_id,trace_code,bottle_type,stage,request_json,knowledge_version,recommendation_json,"
                        + "validation_status,decision,reason,created_at from ai_decision_audit "
                        + "order by created_at desc limit 500",
                (rs, rowNum) -> {
                    AiAuditRecord value = new AiAuditRecord();
                    value.setAuditId(rs.getString("audit_id"));
                    value.setTraceCode(rs.getString("trace_code"));
                    value.setBottleType(rs.getString("bottle_type"));
                    value.setStage(rs.getString("stage"));
                    value.setRequestJson(rs.getString("request_json"));
                    value.setKnowledgeVersion(rs.getString("knowledge_version"));
                    value.setRecommendationJson(rs.getString("recommendation_json"));
                    value.setValidationStatus(rs.getString("validation_status"));
                    value.setDecision(rs.getString("decision"));
                    value.setReason(rs.getString("reason"));
                    value.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
                    return value;
                });
    }

    public void save(SensorReading value) {
        if (!enabled) return;
        jdbcTemplate.update("insert ignore into sensor_reading(reading_id,device_code,sensor_type,stage,trace_code,"
                        + "value,unit,quality,mode,occurred_at) values(?,?,?,?,?,?,?,?,?,?)",
                value.getReadingId(), value.getDeviceCode(), value.getSensorType(), value.getStage(),
                value.getTraceCode(), value.getValue(), value.getUnit(), value.getQuality(), value.getMode(),
                Timestamp.valueOf(value.getOccurredAt()));
    }

    public void save(AlarmRecord value) {
        if (!enabled) return;
        jdbcTemplate.update("insert into factory_alarm(alarm_id,device_code,trace_code,alarm_type,level,status,message,"
                        + "value,limit_value,occurred_at,acknowledged_at) values(?,?,?,?,?,?,?,?,?,?,?) "
                        + "on duplicate key update status=values(status),acknowledged_at=values(acknowledged_at)",
                value.getAlarmId(), value.getDeviceCode(), value.getTraceCode(), value.getAlarmType(),
                value.getLevel(), value.getStatus(), value.getMessage(), value.getValue(), value.getLimitValue(),
                Timestamp.valueOf(value.getOccurredAt()), timestamp(value.getAcknowledgedAt()));
    }

    public void save(DeviceCommand value) {
        if (!enabled) return;
        jdbcTemplate.update("insert into device_command(command_id,client_request_id,client_type,line_id,stage_code,"
                        + "device_code,command_type,payload,source,trace_code,operator_name,operator_role,reason,"
                        + "expected_state_version,accepted_state_version,recipe_version,old_value,new_value,"
                        + "safety_validation,status,message,created_at,expires_at,acknowledged_at,edge_ack_id) "
                        + "values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                        + "on duplicate key update status=values(status),message=values(message),"
                        + "acknowledged_at=values(acknowledged_at),edge_ack_id=values(edge_ack_id)",
                value.getCommandId(), value.getClientRequestId(), value.getClientType(), value.getLineId(),
                value.getStageCode(), value.getDeviceCode(), value.getCommandType(), value.getPayload(),
                value.getSource(), value.getTraceCode(), value.getOperator(), value.getOperatorRole(), value.getReason(),
                value.getExpectedStateVersion(), value.getAcceptedStateVersion(), value.getRecipeVersion(),
                value.getOldValue(), value.getNewValue(), value.getSafetyValidation(), value.getStatus(), value.getMessage(),
                Timestamp.valueOf(value.getCreatedAt()), timestamp(value.getExpiresAt()),
                timestamp(value.getAcknowledgedAt()), value.getEdgeAckId());
    }

    public void save(AiAuditRecord value) {
        if (!enabled) return;
        jdbcTemplate.update("insert ignore into ai_decision_audit(audit_id,trace_code,bottle_type,stage,request_json,"
                        + "knowledge_version,recommendation_json,validation_status,decision,reason,created_at) "
                        + "values(?,?,?,?,?,?,?,?,?,?,?)",
                value.getAuditId(), value.getTraceCode(), value.getBottleType(), value.getStage(),
                value.getRequestJson(), value.getKnowledgeVersion(), value.getRecommendationJson(),
                value.getValidationStatus(), value.getDecision(), value.getReason(),
                Timestamp.valueOf(value.getCreatedAt()));
    }

    private Timestamp timestamp(java.time.LocalDateTime value) {
        return value == null ? null : Timestamp.valueOf(value);
    }

    private void addColumnIfMissing(String tableName, String columnName, String definition) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns where table_schema=database() "
                        + "and table_name=? and column_name=?",
                new Object[]{tableName, columnName}, Integer.class);
        if (count != null && count == 0) {
            jdbcTemplate.execute("alter table " + tableName + " add column " + columnName + " " + definition);
        }
    }

    private void addUniqueIndexIfMissing(String tableName, String indexName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.statistics where table_schema=database() "
                        + "and table_name=? and index_name=?",
                new Object[]{tableName, indexName}, Integer.class);
        if (count != null && count == 0) {
            jdbcTemplate.execute("alter table " + tableName + " add unique key " + indexName
                    + " (" + columnName + ")");
        }
    }
}
