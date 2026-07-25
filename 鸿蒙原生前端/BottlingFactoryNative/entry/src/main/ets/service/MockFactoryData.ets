import { FactoryBundle, RuntimeDevice, RuntimeStage } from '../model/FactoryModels'
import { FACTORY_STAGES } from '../config/FactoryStages'

const now = '2026-07-21T12:00:00'

export function createMockBundle(): FactoryBundle {
  const devices: Array<RuntimeDevice> = []
  FACTORY_STAGES.forEach(stage => stage.devices.forEach(item => devices.push({ deviceCode: item.code, stageCode: stage.code, state: 'RUNNING', source: 'SIMULATION', fallback: true, speedMps: .12, occurredAt: now })))
  const stages: Array<RuntimeStage> = []
  FACTORY_STAGES.forEach(stage => stages.push({ stageCode: stage.code, state: 'RUNNING', bufferLevel: 0, bufferCapacity: 6, upstreamImpact: '无', downstreamImpact: '无', updatedAt: now }))
  return {
    dashboard: {
      total: 16, running: 3, completed: 11, rejected: 2, holding: 3,
      runs: [
        { traceCode: 'BOT-HARMONY-001', batchCode: 'BATCH-DEMO-01', bottleType: 'PLA-500', currentStage: 'FILLING', status: 'RUNNING', voc: 4.6, updatedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-002', bottleType: 'PLA-500', currentStage: 'APPEARANCE_INSPECTION', status: 'HOLD', defectType: 'BODY_DENT', updatedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-003', bottleType: 'PLA-500', currentStage: 'COMPLETED', status: 'COMPLETED', boxCode: 'BOX-DEMO-003', warehouseLocation: 'A-01-01', updatedAt: now, events: [] }
      ]
    },
    operations: {
      latestReadings: [
        { readingId: 'READ-DEMO-VOC', deviceCode: 'GAS-VERIFY-01', sensorType: 'VOC', value: 4.6, unit: 'ppm', quality: 'GOOD', mode: 'SIMULATION', stage: 'GAS_INSPECTION', occurredAt: now },
        { readingId: 'READ-DEMO-TEMP', deviceCode: 'BEV-TEMP-01', sensorType: 'TEMPERATURE', value: 25, unit: '°C', quality: 'GOOD', mode: 'SIMULATION', stage: 'BEVERAGE_READY', occurredAt: now },
        { readingId: 'READ-DEMO-HUM', deviceCode: 'BEV-HUM-01', sensorType: 'HUMIDITY', value: 45, unit: '%RH', quality: 'GOOD', mode: 'SIMULATION', stage: 'BEVERAGE_READY', occurredAt: now },
        { readingId: 'READ-DEMO-AGV', deviceCode: 'AGV-01', sensorType: 'AGV_DISTANCE', value: 100, unit: 'cm', quality: 'GOOD', mode: 'SIMULATION', stage: 'AGV_TRANSPORT', occurredAt: now }
      ],
      alarms: [],
      commands: [],
      aiAudits: []
    },
    runtime: {
      generatedAt: now,
      stages: stages,
      devices: devices,
      incidents: []
    },
    logistics: {
      tasks: [{ taskId: 'AGV-DEMO-001', agvCode: 'AGV-01', boxCode: 'BOX-DEMO-003', source: 'PACKING', destination: 'A-01-01', totalDistanceM: 10, completedDistanceM: 5, speedMps: 1, loadKg: 5, obstacleDistanceCm: 100, status: 'RUNNING', mode: 'SIMULATION', updatedAt: now }],
      zones: [{ zoneCode: 'A-01', vocPpm: 3, smoke: .1, temperatureC: 25, status: 'SAFE', updatedAt: now }],
      stock: [{ boxCode: 'BOX-DEMO-003', bottleType: 'PLA-500', zoneCode: 'A-01', locationCode: 'A-01-01', status: 'IN_STOCK', inboundAt: now }]
    },
    source: 'LOCAL DEMO', online: false, updatedAt: now, errorMessage: '后端暂不可用，当前显示本地演示数据'
  }
}
