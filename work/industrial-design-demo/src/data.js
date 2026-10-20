export const stages = [
  { id: 'PRE', name: '瓶体预处理', short: '预处理', en: 'PRE-TREATMENT', code: 'PT-CV-01', status: '运行中', value: 42, unit: '°C', metric: '清洗温度', target: 45, min: 30, max: 60, precision: 0, rate: 126, quality: 99.8, x: -8, z: -5 },
  { id: 'GAS', name: '气体安全检测', short: '气体检测', en: 'GAS INSPECTION', code: 'GAS-VERIFY-01', status: '运行中', value: 0.12, unit: 'ppm', metric: 'VOC 浓度', target: 0.5, min: 0.1, max: 1, precision: 2, rate: 124, quality: 99.9, x: 0, z: -5 },
  { id: 'VIS', name: '瓶体外观检测', short: '外观检测', en: 'VISION INSPECTION', code: 'VIS-CAM-01', status: '运行中', value: 98.6, unit: '%', metric: '识别置信度', target: 97, min: 90, max: 100, precision: 1, rate: 125, quality: 99.6, x: 8, z: -5 },
  { id: 'MIX', name: '饮料准备', short: '饮料准备', en: 'BEVERAGE PREPARATION', code: 'MIX-TANK-01', status: '运行中', value: 24.6, unit: '°C', metric: '料液温度', target: 25, min: 15, max: 40, precision: 1, rate: 128, quality: 99.9, x: 8, z: 2 },
  { id: 'FIL', name: '精密灌装', short: '灌装', en: 'PRECISION FILLING', code: 'FIL-HEAD-01', status: '运行中', value: 500.2, unit: 'mL', metric: '实际灌装量', target: 500, min: 350, max: 650, precision: 1, rate: 120, quality: 99.7, x: 0, z: 2 },
  { id: 'QC', name: '成品二次检测', short: '二次检测', en: 'FINAL INSPECTION', code: 'QC-WEIGH-01', status: '需关注', value: 0.8, unit: 'g', metric: '重量偏差', target: 2, min: 0.5, max: 5, precision: 1, rate: 118, quality: 98.9, x: -8, z: 2 },
  { id: 'PK', name: '智能装箱', short: '装箱', en: 'ROBOTIC PACKING', code: 'PK-ARM-01', status: '运行中', value: 12, unit: '瓶/箱', metric: '装箱规格', target: 12, min: 6, max: 24, precision: 0, rate: 120, quality: 100, x: -8, z: 9 },
  { id: 'AGV', name: 'AGV 运输', short: 'AGV 运输', en: 'AUTONOMOUS LOGISTICS', code: 'AGV-01', status: '运行中', value: 0.8, unit: 'm/s', metric: '运行速度', target: 1, min: 0.2, max: 1.5, precision: 1, rate: 120, quality: 100, x: 0, z: 9 },
  { id: 'WH', name: '智能仓储', short: '仓储入库', en: 'SMART WAREHOUSING', code: 'WH-RACK-01', status: '运行中', value: 72, unit: '%', metric: '库位占用', target: 85, min: 60, max: 95, precision: 0, rate: 120, quality: 100, x: 8, z: 9 },
];
export const initialTasks = [
  { id: 'MO-260920-01', name: '青柠气泡水', spec: '500 mL · 12 瓶 / 箱', line: '01 号装瓶线', plan: 12000, done: 8426, status: '生产中', priority: '常规', owner: '张明', start: '08:00', end: '12:00' },
  { id: 'MO-260920-02', name: '原味苏打水', spec: '350 mL · 24 瓶 / 箱', line: '01 号装瓶线', plan: 8000, done: 0, status: '待生产', priority: '优先', owner: '李欣', start: '13:00', end: '15:00' },
  { id: 'MO-260920-03', name: '白桃气泡水', spec: '500 mL · 12 瓶 / 箱', line: '01 号装瓶线', plan: 6000, done: 0, status: '待生产', priority: '常规', owner: '王磊', start: '15:00', end: '17:00' },
  { id: 'MO-260919-08', name: '柚香气泡水', spec: '500 mL · 12 瓶 / 箱', line: '01 号装瓶线', plan: 10000, done: 10000, status: '已完成', priority: '常规', owner: '张明', start: '16:00', end: '20:00' },
  { id: 'MO-260919-07', name: '原味苏打水', spec: '350 mL · 24 瓶 / 箱', line: '01 号装瓶线', plan: 12000, done: 12000, status: '已完成', priority: '常规', owner: '李欣', start: '12:00', end: '16:00' },
];
export const initialAlerts = [
  { id: 'EV-0621', title: '检重偏差接近预警阈值', stage: '成品二次检测', time: '10:42:08', severity: '关注', detail: '最近 30 个样本的重量偏差均值为 0.8 g，尚在 ±2.0 g 的允许范围内。建议检查称重台清洁度，并复核下一组样本。', done: false },
  { id: 'EV-0620', title: 'AGV 电量低于 30%', stage: 'AGV 运输', time: '10:36:24', severity: '提示', detail: 'AGV-01 当前电量 28%，预计可完成当前运输任务。建议本批次完成后返回充电位。', done: false },
  { id: 'EV-0619', title: '预处理滤芯维护到期', stage: '瓶体预处理', time: '09:18:12', severity: '维护', detail: '滤芯已累计运行 198 小时。建议在交班后更换滤芯，并登记维护记录。', done: false },
];
export const hourly = [52, 68, 73, 63, 82, 89, 87, 95, 82, 90, 94, 89, 96, 88, 99, 94, 90, 98, 102, 95, 104, 99, 102, 107];
export const formatNumber = value => new Intl.NumberFormat('zh-CN').format(value);

// Functional groups; beverage preparation supplies filling as a separate branch.
export const processGroups = [
 {id:'bottle',mark:'A',name:'瓶体准备',note:'清洗 → 气检 → 外观检测',indices:[0,1,2]},
 {id:'liquid',mark:'B',name:'料液准备',note:'独立供液 → 5 灌装',indices:[3]},
 {id:'fill',mark:'C',name:'灌装与质检',note:'接收瓶体与料液 → 成品检测',indices:[4,5]},
 {id:'logistics',mark:'D',name:'包装与仓储',note:'装箱 → 运输 → 入库',indices:[6,7,8]},
];

// Demo equipment units correspond to the nine integrated model assets, not a verified physical inventory.
export const equipmentAssets = [
 {stageIndex:0,name:'瓶体清洗机',type:'清洗设备'},
 {stageIndex:1,name:'气体检测机',type:'气体检测设备'},
 {stageIndex:2,name:'机器视觉检测机',type:'视觉检测设备'},
 {stageIndex:3,name:'双罐配液单元',type:'配液设备'},
 {stageIndex:4,name:'多头灌装机',type:'灌装设备'},
 {stageIndex:5,name:'在线检重机',type:'称重检测设备'},
 {stageIndex:6,name:'装箱机械臂',type:'机器人'},
 {stageIndex:7,name:'AGV 运输车',type:'移动运输设备'},
 {stageIndex:8,name:'立体仓储单元',type:'仓储设备'},
];
