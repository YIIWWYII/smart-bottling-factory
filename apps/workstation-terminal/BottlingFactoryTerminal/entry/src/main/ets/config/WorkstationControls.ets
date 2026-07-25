export class ParameterControlDefinition {
  deviceCode: string
  label: string
  parameterCode: string
  commandType: string
  unit: string
  min: number
  max: number
  step: number
  currentValue: number
  targetValue: number
  source: string
  role: string
  interlock: string
  risk: string

  constructor(deviceCode: string, label: string, parameterCode: string, commandType: string, unit: string,
    min: number, max: number, step: number, currentValue: number, targetValue: number,
    source: string, role: string, interlock: string, risk: string) {
    this.deviceCode = deviceCode
    this.label = label
    this.parameterCode = parameterCode
    this.commandType = commandType
    this.unit = unit
    this.min = min
    this.max = max
    this.step = step
    this.currentValue = currentValue
    this.targetValue = targetValue
    this.source = source
    this.role = role
    this.interlock = interlock
    this.risk = risk
  }
}

export class ActionControlDefinition {
  deviceCode: string
  label: string
  commandType: string
  intent: string
  risk: string
  interlock: string
  dangerous: boolean

  constructor(deviceCode: string, label: string, commandType: string, intent: string, risk: string,
    interlock: string, dangerous: boolean) {
    this.deviceCode = deviceCode
    this.label = label
    this.commandType = commandType
    this.intent = intent
    this.risk = risk
    this.interlock = interlock
    this.dangerous = dangerous
  }
}

export class WorkstationStageControls {
  stageCode: string
  parameters: Array<ParameterControlDefinition>
  actions: Array<ActionControlDefinition>

  constructor(stageCode: string, parameters: Array<ParameterControlDefinition>, actions: Array<ActionControlDefinition>) {
    this.stageCode = stageCode
    this.parameters = parameters
    this.actions = actions
  }
}

function parameter(deviceCode: string, label: string, parameterCode: string, commandType: string, unit: string,
  min: number, max: number, step: number, currentValue: number, targetValue: number,
  role: string, interlock: string, risk: string): ParameterControlDefinition {
  return new ParameterControlDefinition(deviceCode, label, parameterCode, commandType, unit, min, max, step,
    currentValue, targetValue, '设备能力/后端契约', role, interlock, risk)
}

function action(deviceCode: string, label: string, commandType: string, intent: string, risk: string,
  interlock: string, dangerous: boolean): ActionControlDefinition {
  return new ActionControlDefinition(deviceCode, label, commandType, intent, risk, interlock, dangerous)
}

export function controlsForStage(stageCode: string): WorkstationStageControls {
  switch (stageCode) {
    case 'PRETREATMENT':
      return new WorkstationStageControls(stageCode, [
        parameter('PT-WASH-01', '水洗时长', 'washSeconds', 'SET_WASH_SECONDS', 's', 20, 120, 5, 45, 60, '清洗瓶体残留', '水洗设备在线且无水压报警', '过短会影响 PLA 残留去除，过长会降低节拍'),
        parameter('PT-AIR-01', '风洗压力', 'airPressure', 'SET_AIR_PRESSURE', 'MPa', 0.2, 0.6, 0.05, 0.35, 0.4, '吹除水分和颗粒', '风洗设备在线且安全门关闭', '压力过高可能导致轻瓶偏移'),
        parameter('PT-PLC-01', '静置时间', 'settleMinutes', 'SET_SETTLE_MINUTES', 'min', 3, 30, 1, 8, 10, '等待残留挥发', '上游缓冲未阻塞', '缩短静置会影响后续气检')
      ], [
        action('PT-WASH-01', '启动清洗循环', 'START_WASH_CYCLE', '对当前批次执行水洗和风洗', '会占用本站设备并影响输出缓冲', '质量门未 FAIL 且设备在线', true),
        action('PT-PLC-01', '本站暂停', 'HOLD_STAGE', '暂停预处理输送与出站', '下游可能出现缺料', '需要确认缓冲容量', true)
      ])
    case 'GAS_INSPECTION':
      return new WorkstationStageControls(stageCode, [
        parameter('GAS-PUMP-01', '采样时长', 'sampleSeconds', 'SET_SAMPLE_SECONDS', 's', 5, 45, 1, 12, 15, '稳定抽取密封舱气体', '检测舱关闭且采样泵在线', '过短会造成读数不稳定'),
        parameter('GAS-VERIFY-01', 'VOC 阈值', 'vocLimit', 'SET_VOC_LIMIT', 'ppm', 2, 15, 0.5, 10, 10, '安全放行阈值', '仅工艺员允许调整', '调高阈值会影响安全放行')
      ], [
        action('GAS-PUMP-01', '重新采样', 'RESAMPLE_GAS', '对当前密封样本重新采样', '当前产品会停留在气检缓冲', 'VOC 传感器在线', false),
        action('GAS-LAMP-01', '保持待检', 'HOLD_STAGE', '禁止本站自动放行', '下游外观检测可能缺料', '质量门 WAIT/FAIL 时可用', true)
      ])
    case 'APPEARANCE_INSPECTION':
      return new WorkstationStageControls(stageCode, [
        parameter('VIS-LIGHT-01', '光源亮度', 'lightLevel', 'SET_LIGHT_LEVEL', '%', 35, 100, 5, 70, 75, '稳定瓶身成像', '相机在线且无过温报警', '亮度过高会导致反光误判'),
        parameter('VIS-REJECT-01', '剔除延迟', 'rejectDelay', 'SET_REJECT_DELAY', 'ms', 80, 420, 10, 180, 190, '对齐剔除机构节拍', '剔除通道可用', '延迟错误会剔错产品')
      ], [
        action('VIS-TOP-01', '重新拍照', 'RECAPTURE_IMAGE', '重新触发顶部/侧面/底部检测', '当前产品会短暂停留', '三相机在线且光源稳定', false),
        action('VIS-REJECT-01', '剔除当前产品', 'REJECT_CURRENT_PRODUCT', '把当前异常产品导入隔离通道', '该追踪号会进入不合格记录', '质量门 FAIL 或人工确认', true)
      ])
    case 'BEVERAGE_READY':
      return new WorkstationStageControls(stageCode, [
        parameter('BEV-MIX-01', '搅拌转速', 'mixRpm', 'SET_MIX_RPM', 'rpm', 60, 320, 10, 180, 200, '配方混合均匀', '搅拌设备在线', '过快会引入气泡'),
        parameter('BEV-HT-01', '杀菌目标温度', 'sterilizeTemp', 'SET_STERILIZE_TEMP', '°C', 70, 95, 1, 82, 85, '高温杀菌处理', '加热设备在线且温度传感器有效', '温度不足影响质量，过高影响口感')
      ], [
        action('BEV-MIX-01', '启动配方混合', 'START_MIXING', '执行当前瓶型对应配方混合', '会影响灌装上游供料', 'AI/数据库配方校验通过', true),
        action('BEV-HT-01', '保持保温', 'HOLD_TEMPERATURE', '维持当前杀菌温度', '能耗上升且影响节拍', '温度传感器质量 GOOD', false)
      ])
    case 'FILLING':
      return new WorkstationStageControls(stageCode, [
        parameter('FIL-PUMP-01', '泵速', 'pumpSpeed', 'SET_PUMP_SPEED', '%', 20, 95, 5, 60, 65, '稳定灌装流量', '泵和阀在线', '泵速过高易产生泡沫'),
        parameter('FIL-FLOW-01', '目标灌装量', 'fillVolume', 'SET_FILL_VOLUME', 'mL', 250, 1000, 10, 500, 500, '匹配瓶型容量', '瓶型已识别且配方校验通过', '错误容量会导致液位不合格'),
        parameter('FIL-HEAD-01', '灌装节拍', 'fillBeat', 'SET_FILL_BEAT', '瓶/min', 8, 36, 1, 18, 20, '控制整站产能', '下游二检未阻塞', '节拍过快会影响液位稳定')
      ], [
        action('FIL-HEAD-01', '启动灌装循环', 'START_FILLING_CYCLE', '对到位瓶体执行定量灌装', '错误执行会造成撒漏或不合格液位', '气检/外观检测均已通过', true),
        action('FIL-POS-01', '定位复位', 'RESET_POSITIONER', '复位瓶体定位机构', '当前瓶体会停留等待', '无机械卡滞报警', false)
      ])
    case 'SECONDARY_INSPECTION':
      return new WorkstationStageControls(stageCode, [
        parameter('SEC-LIGHT-01', '二检光源', 'secondaryLight', 'SET_SECONDARY_LIGHT', '%', 35, 100, 5, 68, 72, '复核瓶盖、瓶身、液位', '相机在线', '亮度不稳会影响二检一致性'),
        parameter('SEC-REJECT-01', '二检剔除延迟', 'secondaryRejectDelay', 'SET_SECONDARY_REJECT_DELAY', 'ms', 80, 420, 10, 170, 180, '同步剔除动作', '剔除机构在线', '延迟错误会影响追踪准确性')
      ], [
        action('SEC-CAM-01', '复核拍照', 'RECHECK_IMAGE', '重新获取当前产品二检图像', '当前产品进入本站等待', '二检相机和光源在线', false),
        action('SEC-REJECT-01', '二检剔除', 'REJECT_CURRENT_PRODUCT', '隔离二检失败产品', '该产品不会进入装箱', '质量门 FAIL 或人工确认', true)
      ])
    case 'PACKING':
      return new WorkstationStageControls(stageCode, [
        parameter('PK-ARM-01', '机械臂速度', 'armSpeed', 'SET_ARM_SPEED', '%', 20, 85, 5, 55, 60, '抓取与摆放瓶体', '箱体定位相机可用', '速度过快会降低摆放稳定性'),
        parameter('PK-GRIP-01', '夹爪力度', 'gripForce', 'SET_GRIP_FORCE', 'N', 8, 35, 1, 18, 20, '适配不同瓶型', '瓶型尺寸已识别', '力度过大可能压伤瓶身')
      ], [
        action('PK-ARM-01', '执行装箱方案', 'START_PACKING_PLAN', '按箱型和瓶型执行摆放', '影响箱级追踪绑定', '箱体定位和产品队列有效', true),
        action('PK-PRINT-01', '补打箱码', 'PRINT_BOX_CODE', '补打当前箱码标签', '错误标签会影响仓储追踪', '箱码已由后端分配', false)
      ])
    case 'AGV_TRANSPORT':
      return new WorkstationStageControls(stageCode, [
        parameter('AGV-01', '速度上限', 'agvSpeedLimit', 'SET_AGV_SPEED_LIMIT', 'm/s', 0.2, 1.5, 0.1, 0.8, 1.0, '控制运输安全速度', '超声波避障距离合格', '速度过高会降低避障余量'),
        parameter('AGV-LOAD-01', '负载上限', 'agvLoadLimit', 'SET_AGV_LOAD_LIMIT', 'kg', 5, 30, 1, 25, 25, '限制成品箱负载', '负载传感器有效', '错误上限会影响小车安全')
      ], [
        action('AGV-DISPATCH-01', '请求调度', 'REQUEST_AGV_DISPATCH', '向后端申请运输任务', '会占用车辆运力', '目标仓区可用且无安全报警', false),
        action('AGV-01', '本站急停', 'EMERGENCY_STOP', '立即暂停当前 AGV 任务', '会阻塞运输路径并需要人工确认', '障碍距离 FAIL 或人工确认', true)
      ])
    case 'WAREHOUSE_INBOUND':
      return new WorkstationStageControls(stageCode, [
        parameter('WH-WMS-01', '目标库位列', 'targetColumn', 'SET_TARGET_COLUMN', '列', 1, 12, 1, 3, 4, '分配入库库位', '仓区安全 SAFE', '错误库位会影响库存追踪'),
        parameter('WH-VOC-01', '仓区 VOC 阈值', 'warehouseVocLimit', 'SET_WAREHOUSE_VOC_LIMIT', 'ppm', 2, 15, 0.5, 10, 10, '仓储安全阈值', '仅安全员允许调整', '调高阈值会降低安全余量')
      ], [
        action('WH-WMS-01', '确认入库', 'CONFIRM_WAREHOUSE_INBOUND', '登记箱码和库位库存', '会生成库存事实记录', '仓区安全且箱码有效', true),
        action('WH-LAMP-01', '点亮库位', 'LIGHT_WAREHOUSE_SLOT', '提示当前目标库位', '仅影响库位指示', '库位已分配', false)
      ])
    default:
      return new WorkstationStageControls(stageCode, [], [])
  }
}
