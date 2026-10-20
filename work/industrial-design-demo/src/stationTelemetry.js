import {stationRate} from './materialFlow.js';
export const secondaryMetrics=[
 [{id:'washPressure',label:'清洗水压',unit:'MPa'},{id:'washFlow',label:'水洗流量',unit:'L/min'},{id:'airFlow',label:'风洗流量',unit:'L/min'}],
 [{id:'chamberPressure',label:'检测舱压力',unit:'kPa'},{id:'gasTemperature',label:'采样气体温度',unit:'°C'}],
 [{id:'inspectionPassRate',label:'外观合格率',unit:'%'},{id:'inspectionIlluminance',label:'检测区照度',unit:'lx'}],
 [{id:'tankLevel',label:'储液罐液位',unit:'%'},{id:'mixConcentration',label:'料液浓度',unit:'°Bx'}],
 [{id:'fillDeviation',label:'灌装偏差',unit:'mL'},{id:'actualFillFlow',label:'实际灌装流量',unit:'mL/s'}],
 [{id:'actualLiquidLevel',label:'实际液位',unit:'mm'},{id:'sealPressure',label:'密封压力',unit:'kPa'}],
 [{id:'gripperVacuum',label:'夹爪真空度',unit:'kPa'},{id:'actualGripForce',label:'实际夹持力',unit:'N'}],
 [{id:'batteryLevel',label:'电池电量',unit:'%'},{id:'obstacleDistance',label:'最近障碍距离',unit:'m'}],
 [{id:'warehouseTemperature',label:'仓储温度',unit:'°C'},{id:'warehouseHumidity',label:'仓储湿度',unit:'%RH'},{id:'warehouseGas',label:'可燃气体浓度',unit:'%LEL'},{id:'warehouseSmoke',label:'烟雾报警信号',unit:''}]
];

export const localSimulation=twin=>twin.dataMode==='simulation'&&!twin.protocol?.enabled;
export function stationOutput(twin,index){
 const state=twin.states[index],local=localSimulation(twin);
 const value=index===3?(local?(twin.materialFlow?Math.round(100*Math.min(1,twin.materialFlow.prep/twin.materialFlow.prepDuration)):null):state.prepProgress):local?stationRate(twin.materialFlow,index):state.rate;
 return {value:state.quality==='offline'||!Number.isFinite(value)?null:value,label:index===3?'料液准备进度':local?'本工位近一分钟产出':state.source==='simulation'&&state.dataSource!=='protocol'?'模拟工位速率':'工位回传速率',unit:index===3?'%':'瓶/min'};
}
// Optional process feedback is a current sample, never a local timer extrapolation.
export function validateStationFeedback(index,body){
 const reject=message=>{throw Object.assign(new Error(message),{status:400});};
 const feedback={};
 const measurements=body.measurements??{};
 if(!measurements||typeof measurements!=='object'||Array.isArray(measurements))reject('遥测附加点位格式无效。');
 for(const m of secondaryMetrics[index])if(Object.hasOwn(measurements,m.id)){
  const v=measurements[m.id];
  if(!Number.isFinite(v)||((m.unit==='%'||m.unit==='%RH')&&(v<0||v>100)))reject(m.label+'数值无效。');
 }
 if(body.prepProgress!==undefined){if(index!==3||!Number.isFinite(body.prepProgress)||body.prepProgress<0||body.prepProgress>100)reject('备液进度须为 0–100。');feedback.prepProgress=body.prepProgress;}
 if(body.washPhase!==undefined){if(index!==0||!['waiting','arriving','rinse','air','leaving'].includes(body.washPhase))reject('水风洗阶段无效。');feedback.washPhase=body.washPhase;}
 if(body.inspection!==undefined){
  const v=body.inspection;
  if(index!==1||!v||!Array.isArray(v.bottles)||v.bottles.length>4)reject('气检逐瓶反馈须为最多四瓶。');
  const ids=new Set();
  feedback.inspection={bottles:v.bottles.map(b=>{
   if(!b||typeof b.id!=='string'||!b.id.trim()||b.id.length>100||ids.has(b.id)||!Number.isFinite(b.duration)||b.duration<=0||!Number.isFinite(b.elapsed)||b.elapsed<0||b.elapsed>b.duration||!['testing','paused','done'].includes(b.status))reject('逐瓶检测编号、时间或状态无效。');
   ids.add(b.id);return {id:b.id,duration:b.duration,elapsed:b.elapsed,status:b.status};
  })};
 }
 if(body.material!==undefined){
  const m=body.material;
  if(!m||!Number.isInteger(m.count)||m.count<0||m.count>10000||typeof m.processing!=='boolean'||(m.processing&&m.count===0)||!['waiting','processing','holding','leaving'].includes(m.phase))reject('在制物料反馈无效。');
  feedback.material={count:m.count,processing:m.processing,phase:m.phase,label:({waiting:'等待来料',processing:'正在处理',holding:'等待移交',leaving:'移交中'})[m.phase]};
 }
 return feedback;
}
