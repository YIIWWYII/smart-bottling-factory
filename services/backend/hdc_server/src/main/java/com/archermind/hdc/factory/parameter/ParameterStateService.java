package com.archermind.hdc.factory.parameter;

import com.alibaba.fastjson.JSON;
import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import com.archermind.hdc.operations.dto.DeviceCommandRequest;
import com.archermind.hdc.operations.model.DeviceCommand;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ParameterStateService {
    private final Map<String, ParameterState> states = new ConcurrentHashMap<>();
    private final DeviceCapabilityCatalog capabilities;
    private final JdbcTemplate jdbcTemplate;

    @Value("${factory.persistence.enabled:false}")
    private boolean persistenceEnabled;

    public ParameterStateService(DeviceCapabilityCatalog capabilities, JdbcTemplate jdbcTemplate) {
        this.capabilities = capabilities;
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void restore() {
        migrateSchema();
        seedDefaults();
        if (!persistenceEnabled) return;
        jdbcTemplate.query("select device_code,parameter_code,value_json,unit,owner_source,lock_mode,locked_by,"
                        + "locked_at,lock_reason,expires_at,parameter_version,atomic_group_id,updated_at "
                        + "from device_parameter_state",
                rs -> {
                    ParameterState value = new ParameterState();
                    value.setDeviceCode(rs.getString("device_code"));
                    value.setParameterCode(rs.getString("parameter_code"));
                    value.setValue(JSON.parse(rs.getString("value_json")));
                    value.setUnit(rs.getString("unit"));
                    value.setOwnerSource(rs.getString("owner_source"));
                    value.setLockMode(rs.getString("lock_mode"));
                    value.setLockedBy(rs.getString("locked_by"));
                    value.setLockedAt(time(rs.getTimestamp("locked_at")));
                    value.setLockReason(rs.getString("lock_reason"));
                    value.setExpiresAt(time(rs.getTimestamp("expires_at")));
                    value.setParameterVersion(rs.getLong("parameter_version"));
                    value.setAtomicGroupId(rs.getString("atomic_group_id"));
                    value.setUpdatedAt(time(rs.getTimestamp("updated_at")));
                    states.put(key(value.getDeviceCode(), value.getParameterCode()), value);
                });
    }

    public Map<String, Object> parameters(String deviceCode) {
        String device = normalize(deviceCode);
        Map<String, Object> values = new LinkedHashMap<>();
        for (Map<String, Object> control : capabilities.controls(device)) {
            String parameterCode = parameterCode(control);
            values.put(parameterCode, publicState(state(device, parameterCode, control)));
        }
        return values;
    }

    public List<Map<String, Object>> ownership(String deviceCode) {
        return new ArrayList<>(parameters(deviceCode).values()).stream()
                .map(item -> (Map<String, Object>) item)
                .collect(java.util.stream.Collectors.toList());
    }

    public Map<String, Object> lock(String deviceCode, String parameterCode, String operator, String reason,
                                    String lockMode, LocalDateTime expiresAt) {
        ParameterState state = requireState(deviceCode, parameterCode);
        synchronized (state) {
            String mode = StringUtils.hasText(lockMode) ? lockMode.trim().toUpperCase(Locale.ROOT) : "MANUAL_HOLD";
            require("MANUAL_HOLD".equals(mode) || "SAFETY_LOCK".equals(mode), "lockMode must be MANUAL_HOLD or SAFETY_LOCK");
            state.setLockMode(mode);
            state.setLockedBy(StringUtils.hasText(operator) ? operator : "SYSTEM");
            state.setLockedAt(LocalDateTime.now());
            state.setLockReason(StringUtils.hasText(reason) ? reason.trim() : "manual override");
            state.setExpiresAt(expiresAt);
            state.setParameterVersion(state.getParameterVersion() + 1);
            state.setOwnerSource("MANUAL_HOLD".equals(mode) ? "MANUAL" : "SYSTEM");
            state.setUpdatedAt(LocalDateTime.now());
            save(state);
            return publicState(state);
        }
    }

    public Map<String, Object> release(String deviceCode, String parameterCode, String operator) {
        ParameterState state = requireState(deviceCode, parameterCode);
        synchronized (state) {
            require(!"SAFETY_LOCK".equals(state.getLockMode()), "SAFETY_LOCK cannot be released by ordinary override API");
            state.setLockMode("NONE");
            state.setLockedBy(null);
            state.setLockedAt(null);
            state.setLockReason(null);
            state.setExpiresAt(null);
            state.setOwnerSource("MANUAL".equals(state.getOwnerSource()) ? "SYSTEM" : state.getOwnerSource());
            state.setParameterVersion(state.getParameterVersion() + 1);
            state.setUpdatedAt(LocalDateTime.now());
            save(state);
            return publicState(state);
        }
    }

    public void validateWritable(DeviceCommandRequest request, String role, String source) {
        ParameterState state = stateForCommand(request);
        if (state == null) return;
        synchronized (state) {
            expireIfNeeded(state);
            if (request.getExpectedParameterVersion() != null) {
                require(request.getExpectedParameterVersion() == state.getParameterVersion(),
                        "parameterVersion changed; refresh parameter state before retrying command");
            }
            if ("SAFETY_LOCK".equals(state.getLockMode())) {
                throw new IllegalArgumentException("parameter is blocked by SAFETY_LOCK: " + state.getParameterCode());
            }
            if ("MANUAL_HOLD".equals(state.getLockMode()) && isAiSource(source)) {
                throw new IllegalArgumentException("parameter is held by manual override: " + state.getParameterCode());
            }
            if (StringUtils.hasText(request.getAtomicGroupId())
                    && StringUtils.hasText(state.getAtomicGroupId())
                    && !request.getAtomicGroupId().equals(state.getAtomicGroupId())) {
                throw new IllegalArgumentException("atomicGroupId mismatch for parameter: " + state.getParameterCode());
            }
        }
    }

    public Long currentVersion(DeviceCommandRequest request) {
        ParameterState state = stateForCommand(request);
        return state == null ? null : state.getParameterVersion();
    }

    public void applyAcknowledged(DeviceCommand command) {
        if (command == null || !"ACKNOWLEDGED".equals(command.getStatus())) return;
        ParameterState state = stateForCommand(command.getDeviceCode(), command.getCommandType(), command.getParameterCode());
        if (state == null) return;
        synchronized (state) {
            state.setValue(extractNewValue(command.getPayload()));
            state.setOwnerSource(sourceOwner(command.getSource()));
            if ("MANUAL".equals(state.getOwnerSource())) {
                state.setLockMode("MANUAL_HOLD");
                state.setLockedBy(command.getOperator());
                state.setLockedAt(LocalDateTime.now());
                state.setLockReason(command.getReason());
            }
            state.setParameterVersion(state.getParameterVersion() + 1);
            state.setUpdatedAt(LocalDateTime.now());
            save(state);
        }
    }

    public Map<String, Object> publicState(ParameterState state) {
        expireIfNeeded(state);
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("deviceCode", state.getDeviceCode());
        value.put("parameterCode", state.getParameterCode());
        value.put("value", state.getValue());
        value.put("unit", state.getUnit());
        value.put("ownerSource", state.getOwnerSource());
        value.put("lockMode", state.getLockMode());
        value.put("lockedBy", state.getLockedBy());
        value.put("lockedAt", state.getLockedAt());
        value.put("lockReason", state.getLockReason());
        value.put("expiresAt", state.getExpiresAt());
        value.put("parameterVersion", state.getParameterVersion());
        value.put("atomicGroupId", state.getAtomicGroupId());
        value.put("updatedAt", state.getUpdatedAt());
        return value;
    }

    private void seedDefaults() {
        for (String stage : capabilities.stageCodes()) {
            for (String device : capabilities.devices(stage)) {
                for (Map<String, Object> control : capabilities.controls(device)) {
                    state(device, parameterCode(control), control);
                }
            }
        }
        for (Map<String, Object> control : capabilities.controls("LINE-CONTROL-01")) {
            state("LINE-CONTROL-01", parameterCode(control), control);
        }
    }

    private ParameterState state(String deviceCode, String parameterCode, Map<String, Object> control) {
        String key = key(deviceCode, parameterCode);
        return states.computeIfAbsent(key, ignored -> {
            ParameterState value = new ParameterState();
            value.setDeviceCode(deviceCode);
            value.setParameterCode(parameterCode);
            value.setValue(control.get("currentValue"));
            value.setUnit((String) control.get("unit"));
            value.setOwnerSource("RECIPE");
            value.setLockMode("NONE");
            value.setParameterVersion(1L);
            value.setAtomicGroupId(atomicGroup(deviceCode, parameterCode));
            value.setUpdatedAt(LocalDateTime.now());
            save(value);
            return value;
        });
    }

    private ParameterState requireState(String deviceCode, String parameterCode) {
        ParameterState state = stateForCommand(deviceCode, parameterCode, parameterCode);
        require(state != null, "parameter not found: " + deviceCode + "/" + parameterCode);
        return state;
    }

    private ParameterState stateForCommand(DeviceCommandRequest request) {
        return stateForCommand(request.getDeviceCode(), request.getCommandType(), request.getParameterCode());
    }

    private ParameterState stateForCommand(String deviceCode, String commandType, String explicitParameterCode) {
        if (!StringUtils.hasText(deviceCode)) return null;
        String device = normalize(deviceCode);
        String parameter = StringUtils.hasText(explicitParameterCode)
                ? normalize(explicitParameterCode) : parameterFromCommand(commandType);
        if (!StringUtils.hasText(parameter)) return null;
        ParameterState direct = states.get(key(device, parameter));
        if (direct != null) return direct;
        String command = normalize(commandType);
        for (Map<String, Object> control : capabilities.controls(device)) {
            if (command.equals(control.get("commandType")) || parameter.equals(parameterCode(control))) {
                return state(device, parameterCode(control), control);
            }
        }
        return null;
    }

    private String parameterCode(Map<String, Object> control) {
        return parameterFromCommand(String.valueOf(control.get("commandType")));
    }

    private String parameterFromCommand(String commandType) {
        String command = normalize(commandType);
        if (command.startsWith("SET_")) return command.substring(4);
        return command;
    }

    private Object extractNewValue(String payload) {
        Object parsed = JSON.parse(payload);
        if (parsed instanceof Map && ((Map<?, ?>) parsed).containsKey("value")) return ((Map<?, ?>) parsed).get("value");
        return parsed;
    }

    private String sourceOwner(String source) {
        String value = normalize(source);
        if (value.startsWith("AI")) return "AI";
        if ("OPERATOR".equals(value) || "TERMINAL_CLIENT".equals(value) || "ADMIN_CLIENT".equals(value)) return "MANUAL";
        return "SYSTEM";
    }

    private void expireIfNeeded(ParameterState state) {
        if (state == null || state.getExpiresAt() == null || !"MANUAL_HOLD".equals(state.getLockMode())) return;
        if (!LocalDateTime.now().isAfter(state.getExpiresAt())) return;
        state.setLockMode("NONE");
        state.setLockedBy(null);
        state.setLockedAt(null);
        state.setLockReason(null);
        state.setExpiresAt(null);
        state.setUpdatedAt(LocalDateTime.now());
        save(state);
    }

    private String atomicGroup(String deviceCode, String parameterCode) {
        if ("FIL-PUMP-01".equals(deviceCode) && (parameterCode.contains("FLOW") || parameterCode.contains("FILL"))) {
            return "FILL_VOLUME_GROUP";
        }
        if ("BEV-HT-01".equals(deviceCode)) return "BEVERAGE_HEAT_GROUP";
        if ("LINE-CONTROL-01".equals(deviceCode)) return "RECIPE_APPLY_GROUP";
        return deviceCode + ":" + parameterCode;
    }

    private boolean isAiSource(String source) {
        return normalize(source).startsWith("AI");
    }

    private String key(String deviceCode, String parameterCode) {
        return normalize(deviceCode) + ":" + normalize(parameterCode);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private void migrateSchema() {
        if (!persistenceEnabled) return;
        jdbcTemplate.execute("create table if not exists device_parameter_state ("
                + "device_code varchar(100) not null,"
                + "parameter_code varchar(100) not null,"
                + "value_json json not null,"
                + "unit varchar(30) null,"
                + "owner_source varchar(30) not null,"
                + "lock_mode varchar(30) not null,"
                + "locked_by varchar(100) null,"
                + "locked_at datetime(6) null,"
                + "lock_reason varchar(500) null,"
                + "expires_at datetime(6) null,"
                + "parameter_version bigint not null,"
                + "atomic_group_id varchar(100) not null,"
                + "updated_at datetime(6) not null,"
                + "primary key(device_code,parameter_code),"
                + "key idx_device_parameter_lock(lock_mode,updated_at)"
                + ") engine=InnoDB default charset=utf8mb4 comment='设备字段级参数所有权、锁和版本'");
    }

    private void save(ParameterState value) {
        if (!persistenceEnabled) return;
        jdbcTemplate.update("insert into device_parameter_state(device_code,parameter_code,value_json,unit,owner_source,"
                        + "lock_mode,locked_by,locked_at,lock_reason,expires_at,parameter_version,atomic_group_id,updated_at) "
                        + "values(?,?,?,?,?,?,?,?,?,?,?,?,?) on duplicate key update value_json=values(value_json),"
                        + "unit=values(unit),owner_source=values(owner_source),lock_mode=values(lock_mode),"
                        + "locked_by=values(locked_by),locked_at=values(locked_at),lock_reason=values(lock_reason),"
                        + "expires_at=values(expires_at),parameter_version=values(parameter_version),"
                        + "atomic_group_id=values(atomic_group_id),updated_at=values(updated_at)",
                value.getDeviceCode(), value.getParameterCode(), JSON.toJSONString(value.getValue()), value.getUnit(),
                value.getOwnerSource(), value.getLockMode(), value.getLockedBy(), timestamp(value.getLockedAt()),
                value.getLockReason(), timestamp(value.getExpiresAt()), value.getParameterVersion(),
                value.getAtomicGroupId(), timestamp(value.getUpdatedAt()));
    }

    private LocalDateTime time(Timestamp value) {
        return value == null ? null : value.toLocalDateTime();
    }

    private Timestamp timestamp(LocalDateTime value) {
        return value == null ? null : Timestamp.valueOf(value);
    }

    private void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }
}
