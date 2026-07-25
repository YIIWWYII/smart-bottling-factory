import {
  AlarmRecord,
  FactoryBundle,
  FactoryIncident,
  FactoryRun,
  QualityGateView,
  RuntimeDevice,
  RuntimeStage,
  SensorReading,
  StageBufferSnapshot,
  StageDefinition,
  StageLink,
  StageSnapshot
} from '../model/FactoryModels'

function normalizedStage(stage: StageDefinition, runtime: RuntimeStage | undefined): RuntimeStage {
  if (runtime !== undefined) return runtime
  return {
    stageCode: stage.code,
    state: 'OFFLINE',
    bufferLevel: 0,
    bufferCapacity: 0,
    upstreamImpact: '等待后端快照',
    downstreamImpact: '等待后端快照'
  }
}

function link(code: string, impact: string): StageLink {
  return { stageCode: code, state: 'UNKNOWN', materialFlow: impact }
}

export function adaptLegacyStageSnapshot(bundle: FactoryBundle, stage: StageDefinition): StageSnapshot {
  const runtime: RuntimeStage = normalizedStage(stage,
    bundle.runtime.stages.find((item: RuntimeStage) => item.stageCode === stage.code))
  const devices: Array<RuntimeDevice> = bundle.runtime.devices.filter((item: RuntimeDevice) => item.stageCode === stage.code)
  const products: Array<FactoryRun> = bundle.dashboard.runs.filter((item: FactoryRun) =>
    item.currentStage === stage.code || item.stageCode === stage.code)
  const sensors: Array<SensorReading> = bundle.operations.latestReadings.filter((item: SensorReading) =>
    item.stage === stage.code || (stage.code === 'WAREHOUSE_INBOUND' && item.stage === 'WAREHOUSE_SAFETY'))
  const alarms: Array<AlarmRecord> = bundle.operations.alarms.filter((item: AlarmRecord) =>
    item.status === 'OPEN' && (item.stage === stage.code || (stage.code === 'WAREHOUSE_INBOUND' && item.stage === 'WAREHOUSE_SAFETY')))
  const incidents: Array<FactoryIncident> = bundle.runtime.incidents.filter((item: FactoryIncident) =>
    item.stageCode === stage.code && item.status !== 'RESOLVED')
  const buffer: StageBufferSnapshot = {
    inputLevel: runtime.bufferLevel,
    outputLevel: runtime.bufferLevel,
    capacity: runtime.bufferCapacity,
    blockedReason: runtime.state === 'BLOCKED' ? runtime.downstreamImpact : ''
  }
  const upstream: Array<StageLink> = [link('', runtime.upstreamImpact || '等待数据')]
  const downstream: Array<StageLink> = [link('', runtime.downstreamImpact || '等待数据')]
  return {
    lineId: 'LINE-01',
    stageCode: stage.code,
    stageName: stage.name,
    state: runtime.state || 'OFFLINE',
    stateReason: '旧接口适配，仅供只读展示',
    stateVersion: 0,
    generatedAt: runtime.updatedAt || bundle.runtime.generatedAt || bundle.updatedAt,
    dataMode: bundle.source === 'BACKEND' ? 'LEGACY' : 'LOCAL_DEMO',
    devices: devices,
    products: products,
    sensors: sensors,
    qualityGates: [],
    buffer: buffer,
    incidents: incidents,
    alarms: alarms,
    upstream: upstream,
    downstream: downstream,
    capabilityVersion: ''
  }
}

export function normalizeStageSnapshot(snapshot: StageSnapshot, stage: StageDefinition): StageSnapshot {
  const buffer: StageBufferSnapshot = snapshot.buffer === undefined
    ? { inputLevel: 0, outputLevel: 0, capacity: 0, blockedReason: '等待缓冲数据' }
    : snapshot.buffer
  const qualityGates: Array<QualityGateView> = (snapshot.qualityGates || []).map((gate: QualityGateView): QualityGateView => ({
    label: gate.label || '质量门',
    standard: gate.standard || '--',
    actual: gate.actual || '--',
    status: gate.status || gate.result || 'WAIT',
    source: gate.source || 'StageSnapshot',
    result: gate.result,
    ruleVersion: gate.ruleVersion
  }))
  return {
    lineId: snapshot.lineId || 'LINE-01',
    stageCode: snapshot.stageCode || stage.code,
    stageName: snapshot.stageName || stage.name,
    state: snapshot.state || 'OFFLINE',
    stateReason: snapshot.stateReason || '',
    stateVersion: snapshot.stateVersion || 0,
    generatedAt: snapshot.generatedAt || '',
    dataMode: snapshot.dataMode || 'SIMULATION',
    workOrder: snapshot.workOrder,
    devices: snapshot.devices || [],
    products: snapshot.products || [],
    sensors: snapshot.sensors || [],
    qualityGates: qualityGates,
    buffer: buffer,
    incidents: snapshot.incidents || [],
    alarms: snapshot.alarms || [],
    upstream: snapshot.upstream || [],
    downstream: snapshot.downstream || [],
    capabilityVersion: snapshot.capabilityVersion || '',
    recipeVersion: snapshot.recipeVersion
  }
}
