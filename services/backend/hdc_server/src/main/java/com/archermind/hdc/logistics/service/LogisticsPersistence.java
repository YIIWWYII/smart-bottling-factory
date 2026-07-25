package com.archermind.hdc.logistics.service;

import com.archermind.hdc.logistics.model.AgvTask;
import com.archermind.hdc.logistics.model.WarehouseStock;
import com.archermind.hdc.logistics.model.WarehouseZone;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

@Service
public class LogisticsPersistence {
    @Value("${factory.persistence.enabled:false}")
    private boolean enabled;
    private final JdbcTemplate jdbc;

    public LogisticsPersistence(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public boolean isEnabled() { return enabled; }

    public List<AgvTask> loadTasks() {
        if (!enabled) return new ArrayList<>();
        return jdbc.query("select * from agv_task", (rs, row) -> {
            AgvTask v = new AgvTask();
            v.setTaskId(rs.getString("task_id")); v.setAgvCode(rs.getString("agv_code"));
            v.setBoxCode(rs.getString("box_code")); v.setSource(rs.getString("source_code"));
            v.setDestination(rs.getString("destination_code")); v.setTotalDistanceM(rs.getDouble("total_distance_m"));
            v.setCompletedDistanceM(rs.getDouble("completed_distance_m")); v.setSpeedMps(rs.getDouble("speed_mps"));
            v.setLoadKg(rs.getDouble("load_kg")); v.setObstacleDistanceCm(rs.getDouble("obstacle_distance_cm"));
            v.setStatus(rs.getString("status")); v.setMode(rs.getString("mode"));
            v.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime()); v.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime());
            return v;
        });
    }

    public List<WarehouseZone> loadZones() {
        if (!enabled) return new ArrayList<>();
        return jdbc.query("select * from warehouse_zone", (rs, row) -> {
            WarehouseZone v = new WarehouseZone();
            v.setZoneCode(rs.getString("zone_code")); v.setVocPpm(rs.getDouble("voc_ppm"));
            v.setSmoke(rs.getDouble("smoke")); v.setTemperatureC(rs.getDouble("temperature_c"));
            v.setStatus(rs.getString("status")); v.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime());
            return v;
        });
    }

    public List<WarehouseStock> loadStock() {
        if (!enabled) return new ArrayList<>();
        return jdbc.query("select * from warehouse_stock", (rs, row) -> {
            WarehouseStock v = new WarehouseStock();
            v.setBoxCode(rs.getString("box_code")); v.setBottleType(rs.getString("bottle_type"));
            v.setZoneCode(rs.getString("zone_code")); v.setLocationCode(rs.getString("location_code"));
            v.setStatus(rs.getString("status")); v.setInboundAt(rs.getTimestamp("inbound_at").toLocalDateTime());
            return v;
        });
    }

    public void save(AgvTask v) {
        if (!enabled) return;
        jdbc.update("insert into agv_task(task_id,agv_code,box_code,source_code,destination_code,total_distance_m,completed_distance_m,speed_mps,load_kg,obstacle_distance_cm,status,mode,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?) on duplicate key update completed_distance_m=values(completed_distance_m),speed_mps=values(speed_mps),load_kg=values(load_kg),obstacle_distance_cm=values(obstacle_distance_cm),status=values(status),updated_at=values(updated_at)",
                v.getTaskId(), v.getAgvCode(), v.getBoxCode(), v.getSource(), v.getDestination(), v.getTotalDistanceM(),
                v.getCompletedDistanceM(), v.getSpeedMps(), v.getLoadKg(), v.getObstacleDistanceCm(), v.getStatus(),
                v.getMode(), Timestamp.valueOf(v.getCreatedAt()), Timestamp.valueOf(v.getUpdatedAt()));
    }

    public void save(WarehouseZone v) {
        if (!enabled) return;
        jdbc.update("insert into warehouse_zone(zone_code,voc_ppm,smoke,temperature_c,status,updated_at) values(?,?,?,?,?,?) on duplicate key update voc_ppm=values(voc_ppm),smoke=values(smoke),temperature_c=values(temperature_c),status=values(status),updated_at=values(updated_at)",
                v.getZoneCode(), v.getVocPpm(), v.getSmoke(), v.getTemperatureC(), v.getStatus(), Timestamp.valueOf(v.getUpdatedAt()));
    }

    public void save(WarehouseStock v) {
        if (!enabled) return;
        jdbc.update("insert into warehouse_stock(box_code,bottle_type,zone_code,location_code,status,inbound_at) values(?,?,?,?,?,?) on duplicate key update bottle_type=values(bottle_type),zone_code=values(zone_code),location_code=values(location_code),status=values(status),inbound_at=values(inbound_at)",
                v.getBoxCode(), v.getBottleType(), v.getZoneCode(), v.getLocationCode(), v.getStatus(), Timestamp.valueOf(v.getInboundAt()));
    }
}
