package com.archermind.hdc.factory.contract;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FactoryContractPersistence {
    @Value("${factory.persistence.enabled:false}")
    private boolean enabled;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public FactoryContractPersistence(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> productionOrders() {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select order_id,order_code,batch_code,bottle_type,planned_quantity,status,scheduled_at,created_at,updated_at "
                        + "from production_order order by updated_at desc",
                (rs, rowNum) -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("id", rs.getString("order_id"));
                    value.put("orderCode", rs.getString("order_code"));
                    value.put("batchCode", rs.getString("batch_code"));
                    value.put("bottleType", rs.getString("bottle_type"));
                    value.put("plannedQuantity", rs.getInt("planned_quantity"));
                    value.put("status", rs.getString("status"));
                    value.put("scheduledAt", time(rs.getTimestamp("scheduled_at")));
                    value.put("createdAt", time(rs.getTimestamp("created_at")));
                    value.put("updatedAt", time(rs.getTimestamp("updated_at")));
                    return value;
                });
    }

    public void saveProductionOrder(Map<String, Object> value) {
        requireEnabled();
        jdbcTemplate.update(
                "insert into production_order(order_id,order_code,batch_code,bottle_type,planned_quantity,status,"
                        + "scheduled_at,created_at,updated_at) values(?,?,?,?,?,?,?,?,?) on duplicate key update "
                        + "order_code=values(order_code),batch_code=values(batch_code),bottle_type=values(bottle_type),"
                        + "planned_quantity=values(planned_quantity),status=values(status),scheduled_at=values(scheduled_at),"
                        + "updated_at=values(updated_at)",
                value.get("id"), value.get("orderCode"), value.get("batchCode"), value.get("bottleType"),
                value.get("plannedQuantity"), value.get("status"), timestamp(value.get("scheduledAt")),
                timestamp(value.get("createdAt")), timestamp(value.get("updatedAt")));
    }

    public List<Map<String, Object>> configurations(String category) {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select config_id,category,version,status,payload,operator_name,created_at,updated_at "
                        + "from factory_config_version where category=? order by updated_at desc",
                new Object[]{category}, (rs, rowNum) -> {
                    Map<String, Object> value = readMap(rs.getString("payload"));
                    value.put("id", rs.getString("config_id"));
                    value.put("category", rs.getString("category"));
                    value.put("version", rs.getString("version"));
                    value.put("status", rs.getString("status"));
                    value.put("operator", rs.getString("operator_name"));
                    value.put("createdAt", time(rs.getTimestamp("created_at")));
                    value.put("updatedAt", time(rs.getTimestamp("updated_at")));
                    return value;
                });
    }

    public void saveConfiguration(String category, Map<String, Object> value) {
        requireEnabled();
        Map<String, Object> payload = new LinkedHashMap<>(value);
        payload.keySet().removeAll(java.util.Arrays.asList(
                "id", "category", "version", "status", "operator", "createdAt", "updatedAt"));
        jdbcTemplate.update(
                "insert into factory_config_version(config_id,category,version,status,payload,operator_name,created_at,updated_at) "
                        + "values(?,?,?,?,?,?,?,?) on duplicate key update status=values(status),payload=values(payload),"
                        + "operator_name=values(operator_name),updated_at=values(updated_at)",
                value.get("id"), category, value.get("version"), value.get("status"), writeJson(payload),
                value.get("operator"), timestamp(value.get("createdAt")), timestamp(value.get("updatedAt")));
    }

    public void saveAudit(Map<String, Object> value) {
        requireEnabled();
        jdbcTemplate.update(
                "insert into operation_audit(audit_id,category,target_id,action,operator_name,detail,occurred_at) "
                        + "values(?,?,?,?,?,?,?)",
                value.get("auditId"), value.get("category"), value.get("targetId"), value.get("action"),
                value.get("operator"), writeJson(value.get("detail")), timestamp(value.get("occurredAt")));
    }

    public List<Map<String, Object>> audits() {
        if (!enabled) return new ArrayList<>();
        return jdbcTemplate.query(
                "select audit_id,category,target_id,action,operator_name,detail,occurred_at "
                        + "from operation_audit order by occurred_at desc limit 500",
                (rs, rowNum) -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("auditId", rs.getString("audit_id"));
                    value.put("category", rs.getString("category"));
                    value.put("targetId", rs.getString("target_id"));
                    value.put("action", rs.getString("action"));
                    value.put("operator", rs.getString("operator_name"));
                    value.put("detail", readMap(rs.getString("detail")));
                    value.put("occurredAt", time(rs.getTimestamp("occurred_at")));
                    return value;
                });
    }

    private void requireEnabled() {
        if (!enabled) throw new IllegalStateException("MySQL persistence is required for this write operation");
    }

    private Object time(Timestamp value) {
        return value == null ? null : value.toLocalDateTime();
    }

    private Timestamp timestamp(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDateTime) return Timestamp.valueOf((LocalDateTime) value);
        return Timestamp.valueOf(String.valueOf(value).replace("T", " "));
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("contract data cannot be serialized", exception);
        }
    }

    private Map<String, Object> readMap(String value) {
        if (value == null || value.trim().isEmpty()) return new LinkedHashMap<>();
        try {
            return objectMapper.readValue(value, new TypeReference<LinkedHashMap<String, Object>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("contract data cannot be restored", exception);
        }
    }
}
