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
  user: AuthUser
  expiresAt?: string
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
  stageCode?: string
  laneCode?: string
  stageProgressPct?: number
  speed?: number
  speedUnit?: string
  animationState?: string
  estimated?: boolean
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
  payload?: string
  source: string
  traceCode?: string
  status: string
  message?: string
  createdAt?: string
  acknowledgedAt?: string
  auditNo?: string
  clientRequestId?: string
}

export class DeviceCommandParameters {
  parameterCode: string = ''
  value: number = 0
  unit: string = ''
}

export class DeviceCommandRequestPayload {
  clientRequestId: string = ''
  lineId: string = 'LINE-01'
  stageCode: string = ''
  deviceCode: string = ''
  commandType: string = ''
  parameters: DeviceCommandParameters = new DeviceCommandParameters()
  expectedStateVersion: number = 0
  recipeVersion: string = ''
  reason: string = ''
  // 兼容现有后端，目标接口迁移完成后删除以下三项。
  payload: DeviceCommandParameters = new DeviceCommandParameters()
  source: string = 'WORKSTATION_TERMINAL'
  traceCode: string = ''
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

export interface RuntimeDevice {
  deviceCode: string
  stageCode: string
  state: string
  source: string
  fallback: boolean
  speedMps?: number
  progress?: number
  occurredAt?: string
  name?: string
  role?: string
  actionCode?: string
  cycleProgressPct?: number
  speed?: number
  speedUnit?: string
  parameters?: Array<DeviceParameterValue>
  lastSeenAt?: string
}

export interface DeviceParameterValue {
  parameterCode: string
  value: number
  unit: string
  source?: string
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

export interface StageBufferSnapshot {
  inputLevel: number
  outputLevel: number
  capacity: number
  blockedReason?: string
}

export interface StageLink {
  stageCode: string
  stageName?: string
  state: string
  materialFlow?: string
}

export interface StageWorkOrder {
  orderCode: string
  batchCode?: string
  productName?: string
  plannedQuantity?: number
}

export interface StageSnapshot {
  lineId: string
  stageCode: string
  stageName: string
  state: string
  stateReason: string
  stateVersion: number
  generatedAt: string
  dataMode: string
  workOrder?: StageWorkOrder
  devices: Array<RuntimeDevice>
  products: Array<FactoryRun>
  sensors: Array<SensorReading>
  qualityGates: Array<QualityGateView>
  buffer: StageBufferSnapshot
  incidents: Array<FactoryIncident>
  alarms: Array<AlarmRecord>
  upstream: Array<StageLink>
  downstream: Array<StageLink>
  capabilityVersion: string
  recipeVersion?: string
}

export interface DeviceCapability {
  deviceCode: string
  capabilityVersion: string
  controlId: string
  commandType: string
  displayName: string
  valueType: string
  unit: string
  min?: number
  max?: number
  step?: number
  currentValue?: number
  requiredRole: string
  riskLevel: string
  confirmationRequired: boolean
  reasonRequired: boolean
  interlocks: Array<string>
  writable: boolean
  disabledReason?: string
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
  result?: string
  ruleVersion?: string
}
