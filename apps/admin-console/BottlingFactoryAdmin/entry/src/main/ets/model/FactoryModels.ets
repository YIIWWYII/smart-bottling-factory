export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
  success: boolean
}

export interface AuthUser {
  id: number
  username: string
  displayName: string
  role: string
  status: string
  lastLoginAt?: string
  createdAt?: string
}

export interface LoginResult {
  token: string
  expiresAt?: string
  user: AuthUser
}

export interface FactoryEvent {
  eventId: string
  traceCode: string
  stage: string
  status: string
  message: string
  occurredAt: string
}

export interface FactoryRun {
  traceCode: string
  batchCode?: string
  bottleType?: string
  scenario?: string
  currentStage: string
  status: string
  voc?: number
  beverageTemperature?: number
  beverageHumidity?: number
  defectType?: string
  boxCode?: string
  agvTaskCode?: string
  warehouseLocation?: string
  startedAt?: string
  updatedAt?: string
  events: Array<FactoryEvent>
}

export interface FactoryDashboard {
  total: number
  running: number
  completed: number
  rejected: number
  holding: number
  runs: Array<FactoryRun>
}

export interface SensorReading {
  readingId: string
  deviceCode: string
  sensorType: string
  value: number
  unit: string
  quality: string
  mode: string
  stage?: string
  traceCode?: string
  occurredAt: string
}

export interface AlarmRecord {
  alarmId: string
  alarmType: string
  deviceCode: string
  stage?: string
  traceCode?: string
  value?: number
  unit?: string
  limitValue?: number
  status: string
  message: string
  occurredAt?: string
}

export interface DeviceCommand {
  commandId: string
  deviceCode: string
  commandType: string
  source: string
  traceCode?: string
  status: string
  message?: string
  createdAt?: string
  acknowledgedAt?: string
}

export interface AiAudit {
  auditId: string
  traceCode: string
  bottleType: string
  stage: string
  knowledgeVersion: string
  validationStatus: string
  decision: string
  reason: string
  createdAt: string
}

export interface OperationsOverview {
  latestReadings: Array<SensorReading>
  alarms: Array<AlarmRecord>
  commands: Array<DeviceCommand>
  aiAudits: Array<AiAudit>
}

export interface AdminAuditRecord {
  auditId: string
  actor: string
  action: string
  target: string
  result: string
  message: string
  occurredAt: string
}

export interface SystemPolicy {
  policyCode: string
  name: string
  value: string
  unit: string
  version: string
  status: string
  updatedAt: string
}

export interface RuntimeDevice {
  deviceCode: string
  stageCode: string
  state: string
  source: string
  fallback: boolean
  speedMps?: number
  progress?: number
  occurredAt?: string
}

export interface RuntimeStage {
  stageCode: string
  state: string
  bufferLevel: number
  bufferCapacity: number
  upstreamImpact?: string
  downstreamImpact?: string
  updatedAt?: string
}

export interface FactoryIncident {
  incidentId: string
  stageCode: string
  deviceCode?: string
  strategy: string
  status: string
  message: string
  targetStage?: string
  upstreamImpact?: string
  downstreamImpact?: string
  createdAt?: string
  resolvedAt?: string
}

export interface RuntimeSnapshot {
  stateVersion?: number
  generatedAt?: string
  devices: Array<RuntimeDevice>
  stages: Array<RuntimeStage>
  incidents: Array<FactoryIncident>
}

export interface AgvTask {
  taskId: string
  agvCode: string
  boxCode: string
  source: string
  destination: string
  totalDistanceM: number
  completedDistanceM: number
  speedMps: number
  loadKg: number
  obstacleDistanceCm: number
  status: string
  mode: string
  updatedAt?: string
}

export interface WarehouseZone {
  zoneCode: string
  vocPpm: number
  smoke: number
  temperatureC: number
  status: string
  updatedAt?: string
}

export interface StockItem {
  boxCode: string
  bottleType: string
  zoneCode: string
  locationCode: string
  status: string
  inboundAt?: string
}

export interface LogisticsOverview {
  tasks: Array<AgvTask>
  zones: Array<WarehouseZone>
  stock: Array<StockItem>
}

export interface FactoryBundle {
  dashboard: FactoryDashboard
  operations: OperationsOverview
  runtime: RuntimeSnapshot
  logistics: LogisticsOverview
  source: string
  online: boolean
  updatedAt: string
  errorMessage: string
}

export interface StageDefinition {
  code: string
  name: string
  description: string
  devices: Array<DeviceDefinition>
  qualityRules: Array<string>
}

export interface DeviceDefinition {
  code: string
  name: string
  role: string
}

export interface QualityGateView {
  label: string
  standard: string
  actual: string
  status: string
  source: string
}
