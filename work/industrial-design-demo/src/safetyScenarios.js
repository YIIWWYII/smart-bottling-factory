// Additional sensors and cross-device actions for the explicitly simulated line.
export const safetyScenarios=[
 {id:'cabinet-hot',stageIndex:2,title:'电控柜超温',metric:'柜内温度',unit:'°C',normal:35,trigger:72,limit:60,release:50,direction:'high',facility:'cabinet',action:'启动柜体散热风扇',restore:'停止散热风扇',automatic:true,cooling:2},
 {id:'tank-hot',stageIndex:3,title:'料液温度过高',metric:'罐内温度',unit:'°C',normal:25,trigger:40,limit:32,release:28,direction:'high',facility:'cooler',action:'打开冷却水阀并启动循环泵',restore:'停止循环泵并关闭冷却水阀',automatic:true,cooling:1},
 {id:'tank-low',stageIndex:3,title:'储液罐液位过低',metric:'储液罐液位',unit:'%',normal:60,trigger:10,limit:20,release:30,direction:'low',facility:'tank',action:'停止供液泵，暂停灌装取液',restore:'解除供液泵保护',holds:[4]},
 {id:'tank-high',stageIndex:3,title:'储液罐液位过高',metric:'储液罐液位',unit:'%',normal:60,trigger:96,limit:90,release:80,direction:'high',facility:'tank',action:'关闭进液电磁阀',restore:'解除进液阀保护'},
 {id:'conveyor-jam',stageIndex:0,title:'输送带堵料',metric:'堵料持续时间',unit:'s',normal:0,trigger:8,limit:5,release:0,direction:'high',facility:'stopper',action:'停止上游送料并升起挡瓶器',restore:'放下挡瓶器，解除上游送料保护',holds:[0]},
 {id:'motor-overload',stageIndex:0,title:'输送电机过载',metric:'额定电流占比',unit:'%',normal:65,trigger:135,limit:120,release:90,direction:'high',facility:'stopper',action:'驱动保护停机，停止关联送料',restore:'解除驱动及送料保护',holds:[0]},
 {id:'fill-error',stageIndex:4,title:'单瓶灌装量不足',metric:'灌装量偏差',unit:'%',normal:0,trigger:-6,limit:-2,release:0,direction:'low',facility:null,action:null,restore:null},
 {id:'warehouse-hot',stageIndex:8,title:'仓库温度过高',measurement:'warehouseTemperature',metric:'仓储温度',unit:'°C',normal:24,trigger:38,limit:35,release:30,direction:'high',facility:'warehouseVent',action:'启动仓库排热风机',restore:'停止排热风机',automatic:true,cooling:.4},
 {id:'warehouse-humid',stageIndex:8,title:'仓库湿度过高',measurement:'warehouseHumidity',metric:'仓储湿度',unit:'%RH',normal:48,trigger:82,limit:75,release:65,direction:'high',facility:'warehouseDryer',action:'启动除湿机，保护纸箱与标签',restore:'停止除湿机',automatic:true,cooling:.6},
 {id:'warehouse-gas',stageIndex:8,title:'仓库可燃气体告警',measurement:'warehouseGas',metric:'可燃气体浓度',unit:'%LEL',normal:0,trigger:25,limit:20,release:10,direction:'high',facility:'warehouseFire',action:'停止运输与入库，启动声光报警，等待人员排查',restore:'解除入库保护；人工确认后恢复运输',holds:[7,8]},
 {id:'warehouse-smoke',stageIndex:8,title:'仓库烟雾告警',measurement:'warehouseSmoke',metric:'烟雾报警信号',unit:'',normal:0,trigger:1,limit:1,release:0,direction:'high',facility:'warehouseFire',action:'停止运输与入库，关闭排热风机，启动声光报警',restore:'解除消防保护；人工确认后恢复运输',holds:[7,8]},
 {id:'agv-obstacle',stageIndex:7,title:'AGV 前方有障碍',metric:'最近障碍距离',unit:'m',normal:2,trigger:.25,limit:.5,release:1,direction:'low',facility:'obstacle',action:'车辆保护停车，开启声光提示',restore:'解除车辆保护停车',holds:[7]}
];
export function scenarioById(id){return safetyScenarios.find(s=>s.id===id);}
export function createSafetyCase(id,time){const s=scenarioById(id);if(!s)throw Error('未知演示场景');return {id,value:s.trigger,phase:'active',startedAt:time,updatedAt:time,actionState:s.action?'running':'none'};}
export function advanceSafetyCases(cases,time){return cases.map(c=>{const s=scenarioById(c.id);if(c.phase!=='active'||!s.automatic)return c;const seconds=Math.min(5,Math.max(0,(time-c.updatedAt)/1000));const value=Math.max(s.release,c.value-seconds*s.cooling);return {...c,value:Number(value.toFixed(1)),phase:value<=s.release?'resolved':'active',actionState:value<=s.release?'completed':'running',updatedAt:time};});}
export function clearSafetyCase(c,time){const s=scenarioById(c.id);return {...c,value:s.normal,phase:s.action&&!s.automatic?'awaiting-reset':'resolved',actionState:s.action&&!s.automatic?'holding':'completed',updatedAt:time};}
export function resetSafetyCase(c,time){if(c.phase!=='awaiting-reset')throw Error('先排除异常，再人工复位');return {...c,phase:'resolved',actionState:'completed',updatedAt:time};}
export function safetyHolds(cases){return [...new Set(cases.filter(c=>c.phase!=='resolved').flatMap(c=>scenarioById(c.id).holds||[]))];}
export function safetyAlarms(cases){return cases.filter(c=>c.phase==='active').map(c=>{const s=scenarioById(c.id);return {id:'demo:'+s.id,stageIndex:s.stageIndex,device:s.facility||s.id,metric:s.metric,unit:s.unit,title:s.title,source:'scenario',dataSource:'simulation',value:c.value,level:s.action?'critical':'warning',direction:s.direction,threshold:s.limit,signature:(s.action?'critical':'warning')+':'+s.direction,advice:s.action||'核对灌装目标及计量结果；本项仅告警，不执行设施联动'};});}
export function safetyDocument(stageIndex){const rules=safetyScenarios.filter(s=>s.stageIndex===stageIndex);return rules.map(s=>`${s.title}：${s.metric} ${s.direction==='low'?'≤':'≥'} ${s.limit} ${s.unit}触发。${s.action?`联动：${s.action}。恢复：${s.automatic?`回落至 ${s.release} ${s.unit} 自动退出联动`:'排除异常后人工复位；阈值恢复不等于设备自动重启'}`:'仅记录告警，不联动其他设施'}。`).join('\n');}

export const facilityLabels={cabinet:'柜体散热风扇',cooler:'冷却水阀 / 循环泵',tank:'储液罐阀门 / 供液泵',stopper:'上游送料 / 挡瓶器',obstacle:'AGV 保护停车 / 提示灯',warehouseVent:'仓库排热风机',warehouseDryer:'仓库除湿机',warehouseFire:'烟感 / 气体探头 / 声光报警器'};
export function linkageInfo(c){const s=scenarioById(c.id);if(!s)return null;return {...s,sourceName:({'cabinet-hot':'电控柜','tank-hot':'料液罐','tank-low':'储液罐','tank-high':'储液罐','conveyor-jam':'输送带','motor-overload':'输送电机','agv-obstacle':'AGV 障碍传感器'})[s.id]||s.title,phase:c.phase,reason:`${s.metric} ${c.value} ${s.unit}；触发阈值 ${s.direction==='low'?'≤':'≥'} ${s.limit} ${s.unit}`,target:facilityLabels[s.facility],outcome:c.phase==='resolved'?s.restore:c.phase==='awaiting-reset'?'异常已排除，保护保持，等待人工复位':s.action};}

export function planEquipmentState(live,index,cases=[]){
 if(live.quality==='offline')return {tone:'offline',label:'离线',moving:false};
 const related=cases.filter(c=>c.phase!=='resolved'&&(scenarioById(c.id)?.stageIndex===index||scenarioById(c.id)?.holds?.includes(index)));
 const held=related.some(c=>scenarioById(c.id).holds?.includes(index));
 const waiting=related.some(c=>c.phase==='awaiting-reset');
 const alarm=live.alarms?.length>0||related.some(c=>c.phase==='active'&&scenarioById(c.id).stageIndex===index);
 return {tone:alarm?'alarm':waiting?'holding':held?'linked':live.mode,label:alarm?(held?'告警 · 保护停机':'设备告警'):waiting?'保护保持 · 待复位':held?'联动保护停机':({running:'运行',warning:'预警',stopped:'停止',fault:'故障'})[live.mode]||'待机',moving:!held&&['running','warning'].includes(live.mode)&&live.source==='simulation'};
}
