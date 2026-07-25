import { DeviceDefinition, FactoryBundle, RuntimeDevice, RuntimeStage, StageDefinition } from '../model/FactoryModels'
import { FACTORY_STAGES } from '../config/FactoryStages'

const now = '2026-07-21T12:00:00'

function runtimeStateFor(deviceCode: string): string {
  if (deviceCode === 'VIS-REJECT-01') return 'ALARM'
  if (deviceCode === 'AGV-DISPATCH-01') return 'STANDBY'
  if (deviceCode === 'WH-LAMP-01') return 'STANDBY'
  return 'RUNNING'
}

function runtimeSourceFor(deviceCode: string): string {
  if (deviceCode === 'PT-PLC-01' || deviceCode === 'GAS-VERIFY-01' || deviceCode === 'BEV-TEMP-01' || deviceCode === 'AGV-US-01' || deviceCode === 'WH-SMOKE-01') {
    return 'MQTT'
  }
  return 'SIMULATION'
}

function runtimeFallbackFor(deviceCode: string): boolean {
  return !(deviceCode === 'PT-PLC-01' || deviceCode === 'GAS-VERIFY-01' || deviceCode === 'BEV-TEMP-01' || deviceCode === 'AGV-US-01' || deviceCode === 'WH-SMOKE-01')
}

export function createMockBundle(): FactoryBundle {
  const devices: Array<RuntimeDevice> = []
  FACTORY_STAGES.forEach((stage: StageDefinition, stageIndex: number) => stage.devices.forEach((item: DeviceDefinition) => {
    devices.push({
      deviceCode: item.code,
      stageCode: stage.code,
      state: runtimeStateFor(item.code),
      source: runtimeSourceFor(item.code),
      fallback: runtimeFallbackFor(item.code),
      speedMps: stage.code === 'AGV_TRANSPORT' ? 1.05 : 0.12,
      progress: Math.min(92, 18 + stageIndex * 7),
      occurredAt: now
    })
  }))

  const stages: Array<RuntimeStage> = []
  FACTORY_STAGES.forEach((stage: StageDefinition, index: number) => stages.push({
    stageCode: stage.code,
    state: stage.code === 'SECONDARY_INSPECTION' ? 'HOLD' : 'RUNNING',
    bufferLevel: index % 3 === 0 ? 1 : index % 3 === 1 ? 3 : 2,
    bufferCapacity: 6,
    upstreamImpact: index === 0 ? '起始工序，无上游阻塞' : '上游传递到 ' + stage.name,
    downstreamImpact: index === FACTORY_STAGES.length - 1 ? '终点工序，输出到仓储' : '继续流向下一工序',
    updatedAt: now
  }))

  return {
    stateVersion: 1,
    dashboard: {
      total: 28,
      running: 12,
      completed: 11,
      rejected: 2,
      holding: 3,
      runs: [
        { traceCode: 'BOT-HARMONY-001', batchCode: 'BATCH-DEMO-01', bottleType: 'PLA-500', scenario: 'NORMAL', currentStage: 'PRETREATMENT', status: 'RUNNING', updatedAt: now, startedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-002', batchCode: 'BATCH-DEMO-01', bottleType: 'PLA-500', scenario: 'NORMAL', currentStage: 'GAS_INSPECTION', status: 'RUNNING', voc: 4.6, updatedAt: now, startedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-003', batchCode: 'BATCH-DEMO-01', bottleType: 'PLA-500', scenario: 'NORMAL', currentStage: 'APPEARANCE_INSPECTION', status: 'HOLD', defectType: 'BODY_DENT', updatedAt: now, startedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-004', batchCode: 'BATCH-DEMO-02', bottleType: 'PLA-330', scenario: 'SLOW_LINE', currentStage: 'BEVERAGE_READY', status: 'RUNNING', beverageTemperature: 25, beverageHumidity: 45, updatedAt: now, startedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-005', batchCode: 'BATCH-DEMO-02', bottleType: 'PLA-330', scenario: 'SLOW_LINE', currentStage: 'FILLING', status: 'RUNNING', updatedAt: now, startedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-006', batchCode: 'BATCH-DEMO-02', bottleType: 'PLA-330', scenario: 'SLOW_LINE', currentStage: 'SECONDARY_INSPECTION', status: 'HOLD', defectType: 'CAP_DEFECT', updatedAt: now, startedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-007', batchCode: 'BATCH-DEMO-03', bottleType: 'PLA-600', scenario: 'FULL_CASE', currentStage: 'PACKING', status: 'RUNNING', boxCode: 'BOX-DEMO-007', updatedAt: now, startedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-008', batchCode: 'BATCH-DEMO-03', bottleType: 'PLA-600', scenario: 'FULL_CASE', currentStage: 'AGV_TRANSPORT', status: 'RUNNING', boxCode: 'BOX-DEMO-008', agvTaskCode: 'AGV-DEMO-001', updatedAt: now, startedAt: now, events: [] },
        { traceCode: 'BOT-HARMONY-009', batchCode: 'BATCH-DEMO-03', bottleType: 'PLA-600', scenario: 'FULL_CASE', currentStage: 'WAREHOUSE_INBOUND', status: 'COMPLETED', boxCode: 'BOX-DEMO-009', warehouseLocation: 'A-01-01', updatedAt: now, startedAt: now, events: [] }
      ]
    },
    operations: {
      latestReadings: [
        { readingId: 'READ-DEMO-VOC', deviceCode: 'GAS-VERIFY-01', sensorType: 'VOC', value: 4.6, unit: 'ppm', quality: 'GOOD', mode: 'MQTT', stage: 'GAS_INSPECTION', occurredAt: now },
        { readingId: 'READ-DEMO-TEMP', deviceCode: 'BEV-TEMP-01', sensorType: 'TEMPERATURE', value: 25, unit: '°C', quality: 'GOOD', mode: 'MQTT', stage: 'BEVERAGE_READY', occurredAt: now },
        { readingId: 'READ-DEMO-HUM', deviceCode: 'BEV-HUM-01', sensorType: 'HUMIDITY', value: 45, unit: '%RH', quality: 'GOOD', mode: 'SIMULATION', stage: 'BEVERAGE_READY', occurredAt: now },
        { readingId: 'READ-DEMO-FLOW', deviceCode: 'FIL-FLOW-01', sensorType: 'FLOW', value: 9.8, unit: 'L/min', quality: 'GOOD', mode: 'SIMULATION', stage: 'FILLING', occurredAt: now },
        { readingId: 'READ-DEMO-AGV', deviceCode: 'AGV-US-01', sensorType: 'AGV_DISTANCE', value: 100, unit: 'cm', quality: 'GOOD', mode: 'MQTT', stage: 'AGV_TRANSPORT', occurredAt: now },
        { readingId: 'READ-DEMO-WH', deviceCode: 'WH-SMOKE-01', sensorType: 'SMOKE', value: 0.1, unit: '%', quality: 'GOOD', mode: 'MQTT', stage: 'WAREHOUSE_INBOUND', occurredAt: now }
      ],
      alarms: [
        { alarmId: 'ALARM-DEMO-001', alarmType: 'VISUAL_DEFECT', deviceCode: 'VIS-REJECT-01', stage: 'APPEARANCE_INSPECTION', traceCode: 'BOT-HARMONY-003', value: 1, unit: 'pcs', limitValue: 0, status: 'OPEN', message: '检测到瓶身凹陷，剔除机构已接收待处理信号', occurredAt: now }
      ],
      commands: [
        { commandId: 'CMD-DEMO-001', deviceCode: 'VIS-REJECT-01', commandType: 'REJECT', source: 'DISPLAY', traceCode: 'BOT-HARMONY-003', status: 'ACKNOWLEDGED', message: '剔除机构已执行', createdAt: now, acknowledgedAt: now }
      ],
      aiAudits: [
        { auditId: 'AI-AUDIT-001', traceCode: 'BOT-HARMONY-005', bottleType: 'PLA-330', stage: 'FILLING', knowledgeVersion: 'v1.2', validationStatus: 'PASS', decision: 'APPLY_FILLING_PROFILE_A', reason: '瓶型与配方校验通过', createdAt: now }
      ]
    },
    runtime: {
      generatedAt: now,
      stages: stages,
      devices: devices,
      incidents: [
        { incidentId: 'INC-DEMO-001', stageCode: 'APPEARANCE_INSPECTION', deviceCode: 'VIS-REJECT-01', strategy: 'REJECT_AND_CONTINUE', status: 'OPEN', message: '外观缺陷触发剔除，未影响后续工位', downstreamImpact: '只影响当前产品，不阻断整线', createdAt: now }
      ]
    },
    logistics: {
      tasks: [
        { taskId: 'AGV-DEMO-001', agvCode: 'AGV-01', boxCode: 'BOX-DEMO-008', source: 'PACKING', destination: 'A-01-01', totalDistanceM: 10, completedDistanceM: 5, speedMps: 1, loadKg: 5, obstacleDistanceCm: 100, status: 'RUNNING', mode: 'MQTT', updatedAt: now },
        { taskId: 'AGV-DEMO-002', agvCode: 'AGV-01', boxCode: 'BOX-DEMO-009', source: 'WAREHOUSE_INBOUND', destination: 'A-01-01', totalDistanceM: 3, completedDistanceM: 3, speedMps: 0, loadKg: 5, obstacleDistanceCm: 80, status: 'WAIT', mode: 'SIMULATION', updatedAt: now }
      ],
      zones: [
        { zoneCode: 'A-01', vocPpm: 3, smoke: .1, temperatureC: 25, status: 'SAFE', updatedAt: now },
        { zoneCode: 'A-02', vocPpm: 4, smoke: .1, temperatureC: 24, status: 'SAFE', updatedAt: now }
      ],
      stock: [
        { boxCode: 'BOX-DEMO-003', bottleType: 'PLA-500', zoneCode: 'A-01', locationCode: 'A-01-01', status: 'IN_STOCK', inboundAt: now },
        { boxCode: 'BOX-DEMO-009', bottleType: 'PLA-600', zoneCode: 'A-01', locationCode: 'A-01-02', status: 'IN_STOCK', inboundAt: now }
      ]
    },
    source: 'LOCAL DEMO',
    online: false,
    updatedAt: now,
    errorMessage: '后端暂不可用，当前显示本地演示数据'
  }
}
