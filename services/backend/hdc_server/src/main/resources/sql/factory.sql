CREATE TABLE IF NOT EXISTS factory_run (
  trace_code VARCHAR(100) NOT NULL,
  batch_code VARCHAR(100) NOT NULL,
  bottle_type VARCHAR(100) NOT NULL,
  scenario VARCHAR(50) NOT NULL,
  current_stage VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL,
  voc DECIMAL(12,4) NULL,
  beverage_temperature DECIMAL(12,4) NULL,
  beverage_humidity DECIMAL(12,4) NULL,
  defect_type VARCHAR(100) NULL,
  box_code VARCHAR(100) NULL,
  agv_task_code VARCHAR(100) NULL,
  warehouse_location VARCHAR(100) NULL,
  started_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (trace_code),
  KEY idx_factory_run_status (status),
  KEY idx_factory_run_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产线批次当前状态';

CREATE TABLE IF NOT EXISTS factory_event (
  event_id VARCHAR(100) NOT NULL,
  trace_code VARCHAR(100) NOT NULL,
  stage VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL,
  message VARCHAR(500) NOT NULL,
  occurred_at DATETIME(6) NOT NULL,
  PRIMARY KEY (event_id),
  KEY idx_factory_event_trace (trace_code),
  CONSTRAINT fk_factory_event_run FOREIGN KEY (trace_code) REFERENCES factory_run (trace_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产线事件追踪';

CREATE TABLE IF NOT EXISTS sensor_reading (
  reading_id VARCHAR(100) NOT NULL,
  device_code VARCHAR(100) NOT NULL,
  sensor_type VARCHAR(80) NOT NULL,
  stage VARCHAR(80) NOT NULL,
  trace_code VARCHAR(100) NULL,
  value DECIMAL(16,4) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quality VARCHAR(30) NOT NULL,
  mode VARCHAR(30) NOT NULL,
  occurred_at DATETIME(6) NOT NULL,
  PRIMARY KEY (reading_id),
  KEY idx_sensor_device_type_time (device_code, sensor_type, occurred_at),
  KEY idx_sensor_trace (trace_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='传感器时序数据';

CREATE TABLE IF NOT EXISTS factory_alarm (
  alarm_id VARCHAR(100) NOT NULL,
  device_code VARCHAR(100) NOT NULL,
  trace_code VARCHAR(100) NULL,
  alarm_type VARCHAR(100) NOT NULL,
  level VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL,
  message VARCHAR(500) NOT NULL,
  value DECIMAL(16,4) NULL,
  limit_value DECIMAL(16,4) NULL,
  occurred_at DATETIME(6) NOT NULL,
  acknowledged_at DATETIME(6) NULL,
  PRIMARY KEY (alarm_id),
  KEY idx_alarm_status_time (status, occurred_at),
  KEY idx_alarm_trace (trace_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产线与仓储报警';

CREATE TABLE IF NOT EXISTS device_command (
  command_id VARCHAR(100) NOT NULL,
  client_request_id VARCHAR(100) NULL,
  client_type VARCHAR(50) NULL,
  line_id VARCHAR(100) NULL,
  stage_code VARCHAR(80) NULL,
  device_code VARCHAR(100) NOT NULL,
  command_type VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  source VARCHAR(50) NOT NULL,
  trace_code VARCHAR(100) NULL,
  operator_name VARCHAR(100) NULL,
  operator_role VARCHAR(50) NULL,
  reason VARCHAR(500) NULL,
  expected_state_version BIGINT NULL,
  accepted_state_version BIGINT NULL,
  expected_parameter_version BIGINT NULL,
  accepted_parameter_version BIGINT NULL,
  parameter_code VARCHAR(100) NULL,
  atomic_group_id VARCHAR(100) NULL,
  ai_decision_id VARCHAR(100) NULL,
  correlation_id VARCHAR(100) NULL,
  recipe_version VARCHAR(100) NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  safety_validation TEXT NULL,
  status VARCHAR(30) NOT NULL,
  message VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NULL,
  acknowledged_at DATETIME(6) NULL,
  edge_ack_id VARCHAR(100) NULL,
  PRIMARY KEY (command_id),
  KEY idx_command_status_time (status, created_at),
  KEY idx_command_trace (trace_code),
  KEY idx_command_ai_decision (ai_decision_id),
  UNIQUE KEY uk_device_command_client_request (client_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备控制命令及ACK';

CREATE TABLE IF NOT EXISTS ai_decision_audit (
  audit_id VARCHAR(100) NOT NULL,
  trace_code VARCHAR(100) NOT NULL,
  bottle_type VARCHAR(100) NOT NULL,
  stage VARCHAR(80) NOT NULL,
  request_json JSON NOT NULL,
  knowledge_version VARCHAR(100) NOT NULL,
  recommendation_json JSON NOT NULL,
  validation_status VARCHAR(30) NOT NULL,
  decision VARCHAR(50) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (audit_id),
  KEY idx_ai_trace_time (trace_code, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI建议、证据和后端校验审计';

CREATE TABLE IF NOT EXISTS ai_vision_recognition (
  inference_id VARCHAR(100) NOT NULL,
  task_type VARCHAR(80) NOT NULL,
  camera_code VARCHAR(100) NOT NULL,
  line_id VARCHAR(100) NOT NULL,
  stage_code VARCHAR(80) NOT NULL,
  trace_code VARCHAR(100) NULL,
  bottle_type_code VARCHAR(100) NULL,
  confidence DECIMAL(12,6) NULL,
  evidence_ref VARCHAR(500) NULL,
  model_version VARCHAR(100) NULL,
  status VARCHAR(30) NOT NULL,
  latency_ms BIGINT NULL,
  defects_json JSON NOT NULL,
  captured_at DATETIME(6) NOT NULL,
  received_at DATETIME(6) NOT NULL,
  PRIMARY KEY (inference_id),
  KEY idx_ai_vision_trace_time (trace_code, received_at),
  KEY idx_ai_vision_stage_time (stage_code, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI视觉结构化识别结果';

CREATE TABLE IF NOT EXISTS ai_command_intent (
  intent_id VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  decision_id VARCHAR(100) NOT NULL,
  correlation_id VARCHAR(100) NULL,
  source_app VARCHAR(30) NOT NULL,
  line_id VARCHAR(100) NOT NULL,
  stage_code VARCHAR(80) NULL,
  device_code VARCHAR(100) NULL,
  trace_code VARCHAR(100) NULL,
  operator_name VARCHAR(100) NOT NULL,
  operator_role VARCHAR(50) NOT NULL,
  context_state_version BIGINT NULL,
  status VARCHAR(50) NOT NULL,
  status_reason VARCHAR(500) NOT NULL,
  request_json JSON NOT NULL,
  command_ids JSON NOT NULL,
  blocked_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (intent_id),
  UNIQUE KEY uk_ai_command_intent_idempotency (idempotency_key),
  KEY idx_ai_command_intent_decision (decision_id),
  KEY idx_ai_command_intent_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI字段级命令意图和后端安全门结果';

CREATE TABLE IF NOT EXISTS agv_task (
  task_id VARCHAR(100) NOT NULL,
  agv_code VARCHAR(100) NOT NULL,
  box_code VARCHAR(100) NOT NULL,
  source_code VARCHAR(100) NOT NULL,
  destination_code VARCHAR(100) NOT NULL,
  total_distance_m DECIMAL(16,4) NOT NULL,
  completed_distance_m DECIMAL(16,4) NOT NULL,
  speed_mps DECIMAL(16,4) NOT NULL,
  load_kg DECIMAL(16,4) NOT NULL,
  obstacle_distance_cm DECIMAL(16,4) NOT NULL,
  status VARCHAR(30) NOT NULL,
  mode VARCHAR(30) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (task_id),
  KEY idx_agv_task_status_time (status, updated_at),
  UNIQUE KEY uk_agv_box (box_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AGV任务与超声波状态';

CREATE TABLE IF NOT EXISTS warehouse_zone (
  zone_code VARCHAR(100) NOT NULL,
  voc_ppm DECIMAL(16,4) NOT NULL,
  smoke DECIMAL(16,4) NOT NULL,
  temperature_c DECIMAL(16,4) NOT NULL,
  status VARCHAR(30) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (zone_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仓储安全区域状态';

CREATE TABLE IF NOT EXISTS warehouse_stock (
  box_code VARCHAR(100) NOT NULL,
  bottle_type VARCHAR(100) NOT NULL,
  zone_code VARCHAR(100) NOT NULL,
  location_code VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL,
  inbound_at DATETIME(6) NOT NULL,
  PRIMARY KEY (box_code),
  KEY idx_stock_location (zone_code, location_code, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仓储箱级库存';

CREATE TABLE IF NOT EXISTS admin_user (
  id BIGINT NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'VIEWER',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  last_login_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理端用户与角色';

CREATE TABLE IF NOT EXISTS admin_session (
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (token_hash),
  KEY idx_admin_session_user (user_id),
  KEY idx_admin_session_expire (expires_at),
  CONSTRAINT fk_admin_session_user FOREIGN KEY (user_id) REFERENCES admin_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理端登录会话';

CREATE TABLE IF NOT EXISTS factory_device_runtime (
  device_code VARCHAR(100) NOT NULL,
  stage_code VARCHAR(80) NOT NULL,
  state VARCHAR(30) NOT NULL,
  source VARCHAR(30) NOT NULL,
  speed_mps DECIMAL(16,6) NULL,
  progress DECIMAL(16,6) NULL,
  metrics JSON NOT NULL,
  occurred_at DATETIME(6) NOT NULL,
  received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (device_code),
  KEY idx_device_runtime_stage (stage_code),
  KEY idx_device_runtime_source_time (source, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备最后一次真实遥测，用于MQTT超时与重启恢复';

CREATE TABLE IF NOT EXISTS factory_stage_runtime (
  stage_code VARCHAR(80) NOT NULL,
  state VARCHAR(30) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  upstream_impact VARCHAR(500) NOT NULL,
  downstream_impact VARCHAR(500) NOT NULL,
  buffer_level INT NOT NULL DEFAULT 0,
  buffer_capacity INT NOT NULL DEFAULT 6,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (stage_code),
  KEY idx_stage_runtime_state (state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工位隔离、上下游影响和缓冲区当前状态';

CREATE TABLE IF NOT EXISTS factory_incident (
  incident_id VARCHAR(100) NOT NULL,
  trace_code VARCHAR(100) NULL,
  stage_code VARCHAR(80) NOT NULL,
  device_code VARCHAR(100) NULL,
  incident_type VARCHAR(100) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  strategy VARCHAR(50) NOT NULL,
  target_stage VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL,
  resolution_action VARCHAR(50) NULL,
  resolution_note VARCHAR(1000) NULL,
  affected_stages JSON NOT NULL,
  created_at DATETIME(6) NOT NULL,
  resolved_at DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (incident_id),
  KEY idx_incident_status_time (status, created_at),
  KEY idx_incident_stage_status (stage_code, status),
  KEY idx_incident_trace (trace_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异常上报、影响范围、路由策略和处置审计';

CREATE TABLE IF NOT EXISTS factory_line_state (
  line_id VARCHAR(100) NOT NULL,
  state_version BIGINT NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (line_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='三端共享单调状态版本';

INSERT IGNORE INTO factory_line_state(line_id,state_version,updated_at)
VALUES ('LINE-01',1,now(6));

CREATE TABLE IF NOT EXISTS factory_simulation_state (
  line_id VARCHAR(100) NOT NULL,
  scenario_code VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL,
  tick BIGINT NOT NULL DEFAULT 0,
  started_at DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (line_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='唯一中央模拟时钟和场景状态';

INSERT IGNORE INTO factory_simulation_state(line_id,scenario_code,status,tick,started_at,updated_at)
VALUES ('LINE-01','NORMAL','RUNNING',0,now(6),now(6));

CREATE TABLE IF NOT EXISTS device_parameter_state (
  device_code VARCHAR(100) NOT NULL,
  parameter_code VARCHAR(100) NOT NULL,
  value_json JSON NOT NULL,
  unit VARCHAR(30) NULL,
  owner_source VARCHAR(30) NOT NULL,
  lock_mode VARCHAR(30) NOT NULL,
  locked_by VARCHAR(100) NULL,
  locked_at DATETIME(6) NULL,
  lock_reason VARCHAR(500) NULL,
  expires_at DATETIME(6) NULL,
  parameter_version BIGINT NOT NULL,
  atomic_group_id VARCHAR(100) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (device_code, parameter_code),
  KEY idx_device_parameter_lock (lock_mode, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备字段级参数所有权、锁和版本';

CREATE TABLE IF NOT EXISTS production_order (
  order_id VARCHAR(100) NOT NULL,
  order_code VARCHAR(100) NOT NULL,
  batch_code VARCHAR(100) NOT NULL,
  bottle_type VARCHAR(100) NOT NULL,
  planned_quantity INT NOT NULL,
  status VARCHAR(30) NOT NULL,
  scheduled_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_production_order_code (order_code),
  KEY idx_production_order_status_time (status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='生产任务和排产状态';

CREATE TABLE IF NOT EXISTS factory_config_version (
  config_id VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  version VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL,
  payload JSON NOT NULL,
  operator_name VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (config_id),
  UNIQUE KEY uk_factory_config_category_version (category,version),
  KEY idx_factory_config_category_status (category,status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量规则、配方和安全阈值版本';

CREATE TABLE IF NOT EXISTS operation_audit (
  audit_id VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  operator_name VARCHAR(100) NOT NULL,
  detail JSON NOT NULL,
  occurred_at DATETIME(6) NOT NULL,
  PRIMARY KEY (audit_id),
  KEY idx_operation_audit_time (occurred_at),
  KEY idx_operation_audit_target (category,target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配置、工单和处置操作审计';
