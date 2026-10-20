import net from 'node:net';
import fs from 'node:fs';
import {stages} from './src/data.js';
import {capabilities} from './src/controlCapabilities.js';
import {alarmRules} from './src/alarmRules.js';
import {safetyScenarios,safetyHolds,safetyAlarms} from './src/safetyScenarios.js';

const config=JSON.parse(fs.readFileSync(new URL('./protoforge-config.json',import.meta.url),'utf8'));
const points=config.points,index=new Map(points.map(p=>[p.device+':'+p.point,p]));
const devices=[...new Set(points.map(p=>p.device))].map(id=>({id,points:points.filter(p=>p.device===id)}));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const error=message=>Object.assign(new Error(message),{status:409});
export function packet(unit,pdu){const b=Buffer.alloc(7);b.writeUInt16BE(1,0);b.writeUInt16BE(pdu.length+1,4);b[6]=unit;return Buffer.concat([b,pdu]);}
export function createProtoforge(connection={host:'127.0.0.1',port:15020}){
function exchange(unit,pdu,target=connection){return new Promise((resolve,reject)=>{
 const socket=net.createConnection({host:target.host||connection.host,port:target.port||connection.port});let data=Buffer.alloc(0),done=false;
 const finish=(err,value)=>{if(done)return;done=true;socket.destroy();err?reject(err):resolve(value);};
 socket.setTimeout(1200,()=>finish(error('ProtoForge 响应超时')));socket.on('error',e=>finish(error('ProtoForge 连接失败：'+e.code)));
 socket.on('connect',()=>socket.write(packet(unit,pdu)));socket.on('end',()=>{if(!done)finish(error('ProtoForge 提前断开'));});
 socket.on('data',chunk=>{data=Buffer.concat([data,chunk]);if(data.length<7)return;const length=data.readUInt16BE(4);if(length>260||length<2)return finish(error('无效 Modbus 长度'));if(data.length<6+length)return;
  if(data.readUInt16BE(0)!==1||data.readUInt16BE(2)!==0||data[6]!==unit)return finish(error('Modbus 响应标识不匹配'));
  const reply=data.subarray(7,6+length);if(reply[0]&128)return finish(error('设备拒绝指令，Modbus 异常 '+reply[1]));if(reply[0]!==pdu[0])return finish(error('功能码不匹配'));finish(null,reply);
 });
});}
async function readDevice(d){const count=Math.max(...d.points.map(p=>p.address+2)),pdu=Buffer.alloc(5);pdu[0]=3;pdu.writeUInt16BE(count,3);const r=await exchange(connection.devices?.[d.id]?.unitId??d.points[0].unitId,pdu,connection.devices?.[d.id]||connection);if(r[1]!==count*2||r.length!==2+count*2)throw error('寄存器长度不匹配');return Object.fromEntries(d.points.map(p=>{const v=r.readFloatBE(2+p.address*2);if(!Number.isFinite(v))throw error('设备返回无效数值');return [p.point,v];}));}
async function writePoint(device,key,value){const p=index.get(device+':'+key);if(!p||!Number.isFinite(value))throw error('设备点位或数值无效');const b=Buffer.alloc(10);b[0]=16;b.writeUInt16BE(p.address,1);b.writeUInt16BE(2,3);b[5]=4;b.writeFloatBE(value,6);const r=await exchange(connection.devices?.[device]?.unitId??p.unitId,b,connection.devices?.[device]||connection);if(!r.equals(b.subarray(0,5)))throw error('设备写入响应不匹配');}


 let values={},health={},histories=stages.map(()=>[]),cases=[],alarms=[],updated=0;
 const value=(id,key)=>values[id]?.[key];
 const stageOnline=i=>devices.filter(d=>d.points[0].stageIndex===i).every(d=>health[d.id]?.online&&Date.now()-health[d.id].receivedAt<10000);
 const status=()=>({enabled:true,label:'ProtoForge 协议仿真',updated,online:devices.filter(d=>health[d.id]?.online&&Date.now()-health[d.id].receivedAt<10000).length,total:devices.length,devices:devices.map(d=>({id:d.id,name:d.points[0].name,stageIndex:d.points[0].stageIndex,...health[d.id],online:!!health[d.id]?.online&&Date.now()-health[d.id].receivedAt<10000,points:d.points.map(p=>({name:p.point,label:p.label,unit:p.unit,value:value(d.id,p.point),kind:p.kind,address:p.address,unitId:connection.devices?.[d.id]?.unitId??p.unitId}))}))});
 const controls=()=>Object.fromEntries(capabilities.flatMap(c=>{let v=value(c.device,c.control);if(v===undefined)return [];if(c.type==='ENUM')v=v===1?'RUNNING':'PAUSED';else if(c.type==='ACTION')v=v===1?'REQUEST':'READY';else if(c.type==='TEXT')v=['','A-01-01','A-01-02','A-01-03'][v]||'未知库位';return [[c.id,v]];}));
 function derive(){
  const previous=cases;
  cases=safetyScenarios.flatMap(s=>{const id='SAFE-'+s.id.toUpperCase();if(!stageOnline(s.stageIndex))return [];const active=value(id,'alarm')===1,held=value(id,'hold')===1,old=previous.find(c=>c.id===s.id);if(!active&&!held&&!old)return [];
   return [{id:s.id,value:value(id,'value'),phase:active?'active':held?'awaiting-reset':'resolved',startedAt:old?.startedAt||Date.now(),updatedAt:Date.now(),actionState:active?'running':held?'holding':'completed',dataSource:'protocol'}];});
  alarms=alarmRules.flatMap((r,n)=>{if(!stageOnline(r.stageIndex))return [];const level=value(r.device,'alarm_'+n);if(!level)return [];const key=r.source==='setting'?r.id.split(':')[1]:r.source==='deviation'?'deviation':'reading',v=value(r.device,key),critical=level===2;
   const low=critical?r.criticalLow:r.low,high=critical?r.criticalHigh:r.high,direction=low!=null&&v<=low+1e-5?'low':'high';return [{...r,value:v,level:critical?'critical':'warning',direction,threshold:direction==='low'?low:high,dataSource:'protocol',signature:level+':'+direction}];});
  alarms.push(...safetyAlarms(cases).map(a=>({...a,dataSource:'protocol'})));
 }
 async function poll({readOnly=false}={}){
  // Bound parallel traffic to the independent local protocol server.
  for(let i=0;i<devices.length;i+=8)await Promise.all(devices.slice(i,i+8).map(async d=>{try{values[d.id]=await readDevice(d);health[d.id]={online:true,receivedAt:Date.now()};}catch(e){delete values[d.id];health[d.id]={online:false,error:e.message};}}));
  updated=Date.now();derive();const holds=safetyHolds(cases);
  for(const i of holds)if(!readOnly&&stageOnline(i)&&value(stages[i].code,'run_feedback')!==0){await stageCommand(i,false);}
  stages.forEach((s,i)=>{if(stageOnline(i))histories[i]=[...histories[i].slice(-29),i===3?value('SAFE-TANK-HOT','value'):value(s.code,'reading')];});
  return status();
 }
 const states=()=>stages.map((s,i)=>{const online=stageOnline(i),held=safetyHolds(cases).includes(i),running=value(s.code,'run_feedback')===1;
  return {value:online?(i===3?value('SAFE-TANK-HOT','value'):value(s.code,'reading')):0,measurements:online?(i===3?{tankLevel:value(value('SAFE-TANK-HIGH','alarm')===1?'SAFE-TANK-HIGH':'SAFE-TANK-LOW','value')}:i===7?{obstacleDistance:value('SAFE-AGV-OBSTACLE','value')}:{ }):{},target:online?value(s.code,'target'):0,rate:online?value(s.code,'rate'):0,mode:online&&running&&!held?'running':'stopped',history:online?histories[i]:[],source:'simulation',dataSource:'protocol',quality:online?'protocol':'offline',receivedAt:health[s.code]?.receivedAt,sourceReason:online?'ProtoForge · Modbus TCP 设备回读':'ProtoForge 通信中断；不以本地模拟补位',alarms:alarms.filter(a=>a.stageIndex===i),simulationHold:held};});
 async function verifiedWrite(id,key,v){await writePoint(id,key,v);const d=devices.find(d=>d.id===id);const reply=await readDevice(d);if(Math.abs(reply[key]-v)>Math.max(.001,Math.abs(v)*1e-5))throw error('写入后回读不一致');values[id]=reply;return reply[key];}
 async function feedback(id,key,v){for(let n=0;n<15;n++){const d=devices.find(d=>d.id===id);values[id]=await readDevice(d);if(value(id,key)===v)return;await delay(200);}throw error('指令已写入，但反馈等待超时；请检查设备当前状态');}
 async function stageCommand(i,running){if(!stageOnline(i))throw error('本工位设备未全部在线');if(running&&safetyHolds(cases).includes(i))throw error('工位保护尚未解除');const id=stages[i].code;await verifiedWrite(id,'run_command',running?1:0);await feedback(id,'run_feedback',running?1:0);await Promise.all(capabilities.filter(c=>c.stageIndex===i&&c.type==='ENUM').map(async c=>{await verifiedWrite(c.device,c.control,running?1:0);await feedback(c.device,c.control+'_feedback',running?1:0);}));}
 async function control(c,v){if(!stageOnline(c.stageIndex))throw error('设备离线，未发送控制');if(safetyHolds(cases).includes(c.stageIndex)&&v!=='PAUSED')throw error('工位处于保护保持，先恢复并复位');let wire=v;
  if(c.type==='ENUM')wire=v==='RUNNING'?1:0;else if(c.type==='ACTION'){wire=1;await verifiedWrite(c.device,c.control,0);await feedback(c.device,c.control+'_feedback',0);}else if(c.type==='TEXT'){wire=['','A-01-01','A-01-02','A-01-03'].indexOf(v);if(wire<1)throw error('当前协议模块只配置了 A-01-01 至 A-01-03');}
  await verifiedWrite(c.device,c.control,wire);if(c.type!=='NUMBER')await feedback(c.device,c.control+'_feedback',wire);
  if(c.type==='ENUM'&&c.control==='runState')await stageCommand(c.stageIndex,v==='RUNNING');await poll();return {value:controls()[c.id],message:c.type==='ACTION'?'设备请求已回读；模拟响应已收到，不代表物理动作完成':'Modbus 写入与回读确认'};
 }
 async function safety(id,action){const s=safetyScenarios.find(s=>s.id===id);if(!s||!stageOnline(s.stageIndex))throw error('工位不存在或设备离线');const sensor='SAFE-'+id.toUpperCase();
  if(action==='trigger'||action==='clear'){await verifiedWrite(sensor,'value',action==='trigger'?s.trigger:s.normal);await feedback(sensor,'alarm',action==='trigger'?1:0);}
  else if(action==='reset'){
   for(const c of config.cases.filter(c=>c.kind==='safety'&&c.scenario.stageIndex===s.stageIndex)){const spec=c.scenario,v=value(c.device,'value');if(spec.direction==='low'?v<spec.release:v>spec.release)throw error('本工位仍有未恢复异常，拒绝复位');}
   for(const c of config.cases.filter(c=>c.kind==='safety'&&c.scenario.stageIndex===s.stageIndex)){await verifiedWrite(c.device,'hold',0);for(const [d,,p,,rv] of c.actions)await verifiedWrite(d,p,rv??0);}
  }else throw error('无效异常操作');await poll();return cases.find(c=>c.id===id);
 }
 return {inspect:async id=>{const d=devices.find(d=>d.id===id);if(!d)throw error('未知协议设备');return {deviceId:id,values:await readDevice(d),receivedAt:Date.now()};},poll,status,states,controls,control,stageCommand,safety,alarms:()=>alarms,cases:()=>cases};
}
