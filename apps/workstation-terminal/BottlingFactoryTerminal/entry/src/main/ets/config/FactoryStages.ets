import { DeviceDefinition, StageDefinition } from '../model/FactoryModels'

function device(code: string, name: string, role: string): DeviceDefinition {
  return { code: code, name: name, role: role }
}

export const FACTORY_STAGES: Array<StageDefinition> = [
  {
    code: 'PRETREATMENT', name: '预处理', description: '冷却静置、水洗和风洗，去除 PLA 瓶残留物。',
    devices: [device('PT-CV-01', '预处理输送机', '连续输送瓶体'), device('PT-WASH-01', '水洗设备', '清洗瓶体内外表面'), device('PT-AIR-01', '风洗设备', '吹除水分和颗粒'), device('PT-PLC-01', '工位控制器', '执行工艺联锁')],
    qualityRules: ['清洗与风洗记录完整', '设备联锁正常']
  },
  {
    code: 'GAS_INSPECTION', name: '气体检测', description: '密封采样并检测 VOC，有害气体低于阈值才放行。',
    devices: [device('GAS-CHAMBER-01', '密封检测舱', '提供稳定采样环境'), device('GAS-VERIFY-01', 'VOC 气体传感器', '检测有害气体浓度'), device('GAS-PUMP-01', '采样泵', '输送检测气体'), device('GAS-LAMP-01', '报警指示灯', '显示放行和报警状态')],
    qualityRules: ['VOC <= 10 ppm 且无开放报警', '设备联锁正常']
  },
  {
    code: 'APPEARANCE_INSPECTION', name: '外观检测', description: '检测瓶盖、瓶身和瓶底缺陷并剔除不合格品。',
    devices: [device('VIS-TOP-01', '顶部相机', '检测瓶盖和瓶口'), device('VIS-SIDE-01', '侧面相机', '检测瓶身缺陷'), device('VIS-BOTTOM-01', '底部相机', '检测瓶底缺陷'), device('VIS-LIGHT-01', '视觉光源', '提供稳定照明'), device('VIS-REJECT-01', '剔除机构', '隔离不合格品')],
    qualityRules: ['瓶盖、瓶身、瓶底判定通过', '剔除通道可用']
  },
  {
    code: 'BEVERAGE_READY', name: '饮料准备', description: '完成混合调配、高温杀菌和温湿度监控。',
    devices: [device('BEV-MIX-01', '混合调配设备', '执行配方混合'), device('BEV-HT-01', '高温处理设备', '执行杀菌处理'), device('BEV-TEMP-01', '温度传感器', '监测饮料温度'), device('BEV-HUM-01', '湿度传感器', '监测生产环境湿度')],
    qualityRules: ['饮料温度 20-30 °C', '杀菌与配方记录完整']
  },
  {
    code: 'FILLING', name: '灌装', description: '按瓶型配方完成定位、定量灌装和液位复核。',
    devices: [device('FIL-POS-01', '定位机构', '固定瓶体位置'), device('FIL-PUMP-01', '灌装泵', '定量输送饮料'), device('FIL-HEAD-01', '灌装头', '完成饮料注入'), device('FIL-FLOW-01', '流量计', '复核累计体积'), device('FIL-LEVEL-01', '液位传感器', '判定灌装液位')],
    qualityRules: ['配方经本地数据库校验', '液位和灌装量满足规格']
  },
  {
    code: 'SECONDARY_INSPECTION', name: '二次检测', description: '复核瓶盖、液位、瓶身和封装状态。',
    devices: [device('SEC-CAM-01', '二检工业相机', '复核外观和封装'), device('SEC-LEVEL-01', '液位检测相机', '复核液位'), device('SEC-LIGHT-01', '封装检测光源', '提供检测照明'), device('SEC-REJECT-01', '二检剔除机构', '隔离不合格品')],
    qualityRules: ['瓶盖、液位与封装判定通过', '不合格品已隔离']
  },
  {
    code: 'PACKING', name: '机械臂装箱', description: '按瓶型和箱体尺寸计算排列并完成装箱。',
    devices: [device('PK-ARM-01', '六轴机械臂', '抓取并排列瓶体'), device('PK-GRIP-01', '柔性夹爪', '适配不同瓶型'), device('PK-CAM-01', '箱体定位相机', '识别箱体空间'), device('PK-PRINT-01', '箱码打印机', '打印箱级追踪码'), device('PK-COUNT-01', '装箱计数器', '记录箱内数量')],
    qualityRules: ['箱内排列和数量正确', '箱码与产品追踪绑定']
  },
  {
    code: 'AGV_TRANSPORT', name: 'AGV 运输', description: '调度小车运输成品箱并用超声波传感器避障。',
    devices: [device('AGV-01', 'AGV 小车', '运输成品箱'), device('AGV-US-01', '超声波传感器', '检测障碍距离'), device('AGV-ODO-01', '里程计', '记录任务进度'), device('AGV-LOAD-01', '负载检测', '监测车辆负载'), device('AGV-DISPATCH-01', '调度服务', '分配任务和路线')],
    qualityRules: ['障碍距离 >= 20 cm', '车辆负载 <= 30 kg']
  },
  {
    code: 'WAREHOUSE_INBOUND', name: '仓储入库', description: '确认仓区安全，分配库位并登记箱级库存。',
    devices: [device('WH-VOC-01', '仓储 VOC 传感器', '监测仓区气体'), device('WH-SMOKE-01', '烟雾传感器', '监测火灾风险'), device('WH-LAMP-01', '库位指示灯', '显示目标库位'), device('WH-WMS-01', '库存管理服务', '登记库存和库位')],
    qualityRules: ['仓区 VOC <= 10 ppm', '烟雾 <= 0.5%', '库位状态 SAFE']
  }
]

export function findStage(stageCode: string): StageDefinition {
  let match: StageDefinition = FACTORY_STAGES[0]
  FACTORY_STAGES.forEach((stage: StageDefinition) => {
    if (stage.code === stageCode) {
      match = stage
    }
  })
  return match
}
