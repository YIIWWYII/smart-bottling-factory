import {createManualControl} from './mg400-manual.mjs';
import {readTestFeedback,stopTest,requestTestSpeed} from './mg400-test-feedback.mjs';
import {MG400,defaultMG400,validateMG400,applyMG400Files} from './mg400.mjs';
import {createMG400ConfigStore,mg400Files} from './mg400-config-store.mjs';
import {spawn} from 'node:child_process';
import {secondaryMetrics,validateStationFeedback} from './src/stationTelemetry.js';
import {createMaterialFlow,advanceMaterialFlow,materialStage,preprocessingPhase,stationRate} from './src/materialFlow.js';
import {validateCameraSources} from './camera-sources.mjs';
import {createProtoforge} from './protoforge-adapter.mjs';
import {safetyScenarios,scenarioById,createSafetyCase,advanceSafetyCases,clearSafetyCase,resetSafetyCase,safetyHolds,safetyAlarms,safetyDocument} from './src/safetyScenarios.js';
import {evaluateAlarms,alarmChanges,alarmDocument} from './src/alarmRules.js';
import {managementRoute} from './management-domain.mjs';
import {workflow} from './knowledge-workflow.mjs';
import {standardTools} from './standard-mcp.mjs';
import {productDefaults} from './src/product-resources.js';
import {dailyRecord,recordProduction} from './daily-metrics.mjs';
import {initialLogistics,reserveProductionSlot,storeProductionCarton,planJob,advanceLogistics,blocked,obstacleBlocked,avoidanceStrategies,rankQueue,comparePlans,planPicking,inventoryAnalysis} from './src/logistics.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { capabilities } from './src/controlCapabilities.js';
import { stages,initialTasks,initialAlerts,equipmentAssets } from './src/data.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { openDatabase } from './database.mjs';
import {defaultConnections,validateConnection,telemetryFresh,connectionStatus} from './device-connections.mjs';

export const roles = {admin:'管理员',engineer:'工艺工程师',operator:'操作员',viewer:'观察员'};
const defaultRoleSettings={admin:{label:'管理员',description:'模型配置、员工管理、全线控制、知识审核与联锁解除',canControl:true,canReview:true},engineer:{label:'工艺工程师',description:'知识与配方审核、自动策略配置、负责工位的工程参数控制',canControl:true,canReview:true},operator:{label:'操作员',description:'仅负责授权工位中的运行操作，不能修改工程参数',canControl:true,canReview:false},viewer:{label:'观察员',description:'查看运行状态与资料、AI 问答，无设备控制权限',canControl:false,canReview:false}};
const file=path.resolve('.local-operations.json');
const now=()=>new Date().toISOString();
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const recipe=(id,name,volume)=>({id,title:name+' · 工艺配方',kind:'recipe',status:'published',version:1,content:`${name}，${volume} mL。演示工艺，仅用于虚拟设备。`,productCode:id,productName:name,volume,updated:now(),owner:'系统演示',settings:{'PT-CV-01:conveyorSpeed':volume===500?120:100,'PT-WASH-01:washDuration':15,'PT-AIR-01:airDuration':10,'GAS-PUMP-01:sampleDuration':30,'GAS-CHAMBER-01:settleTime':60,'VIS-LIGHT-01:lightIntensity':70,'BEV-MIX-01:mixSpeed':120,'BEV-HT-01:targetTemperature':85,'FIL-PUMP-01:flowRate':120,'FIL-HEAD-01:fillVolume':volume,'SEC-LEVEL-01:exposure':1200,'PK-ARM-01:pickRate':12,'PK-GRIP-01:gripForce':25,'AGV-01:speedLimit':.8,'WH-LAMP-01:targetLocation':'A-01-01'}});
function initial(){return {employees:[{id:'admin',name:'本机管理员',role:'admin',enabled:true,stages:[0,1,2,3,4,5,6,7,8]},{id:'engineer',name:'工艺工程师（演示）',role:'engineer',enabled:true,stages:[0,1,2,3,4,5,6,7,8]},{id:'operator',name:'灌装操作员（演示）',role:'operator',enabled:true,stages:[4]},{id:'viewer',name:'观察员（演示）',role:'viewer',enabled:true,stages:[]}],documents:[recipe('LIME-500','青柠气泡水',500),recipe('SODA-350','原味苏打水',350),{id:'LINE-GUIDE',title:'产线能力与数据说明',kind:'document',status:'published',version:1,owner:'系统演示',updated:now(),content:'当前产线有九工序：瓶体预处理、气体安全检测、瓶体外观检测、饮料准备、精密灌装、成品二次检测、智能装箱、AGV 运输、智能仓储。数字模型与状态为模拟，不是真实遥测。模型服务不能绕过设备联锁；换配方后保持暂停，人工核对后恢复。'+capabilities.map(c=>`${stages[c.stageIndex].name} / ${c.device}：${c.label} ${c.min??''} 至 ${c.max??''} ${c.unit}`).join('\n')}],audit:[],controls:Object.fromEntries(capabilities.map(c=>[c.id,c.type==='NUMBER'?Number(c.initial):c.initial])),auto:{enabled:false,minConfidence:.95,obstacleLimit:.3},interlock:false,lastDecision:null,activeProduct:'LIME-500',tick:0,updated:Date.now(),produced:8426,bottles:3574,liquid:1787,completed:0,states:stages.map(s=>({mode:'running',value:s.value,rate:s.rate,target:s.target,history:Array(16).fill(s.value)}))};}
export async function createOperations(env=process.env){
 const storage=await openDatabase(env),requestContext=new AsyncLocalStorage();
 const existing=storage.read();let db=existing||(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):initial());
 db.tasks=existing?storage.tasks():initialTasks.map(t=>({...t,line:'当前产线',version:1,createdAt:now(),updatedAt:now(),deletedAt:null,archivedAt:null}));db.tasks.forEach(t=>{t.archivedAt??=null;t.deletedAt??=null;t.dataMode??='simulation';});db.employees.forEach(e=>{e.roles=Array.isArray(e.roles)&&e.roles.length?e.roles:[e.role];e.role=e.roles[0];});db.roleSettings={...defaultRoleSettings,...(db.roleSettings||{})};db.alerts??=initialAlerts;db.preferences??={dense:false,notifications:true};
 db.products??=structuredClone(productDefaults);db.materials??=[];db.assets??=equipmentAssets.map((a,i)=>({...a,id:'asset-'+i,code:stages[i].code,version:1,enabled:true}));
 db.materialFlow??=null;
 db.logisticsByMode??={};
 const logistics=()=>{const ls=db.logisticsByMode[db.dataMode]??=initialLogistics();ls.obstacles??=[];ls.queue??=[];ls.avoidance??='replan';return ls;};
 const planLogistics=input=>{try{return planJob(logistics(),input);}catch(e){fail(e.message);}};
 const mg400=new MG400(),mg400Store=createMG400ConfigStore();
 const manualMG400=createManualControl(mg400);
 // Preserve the previous device settings once, then the files are authoritative.
 let mgFiles=mg400Store.read();
 if(!mgFiles.values.communication.platformManaged){
  const old=db.mg400?.host?validateMG400(db.mg400):null;
  if(old){
   mgFiles=mg400Store.save('trajectories',{...mgFiles.values.trajectories,controller:{...mgFiles.values.trajectories.controller,defaultProject:old.project}},mgFiles.raw.trajectories);
   mgFiles=mg400Store.save('motion',{...mgFiles.values.motion,platform:{...mgFiles.values.motion.platform,defaultSpeedPercent:old.speed}},mgFiles.raw.motion);
  }
  mgFiles=mg400Store.save('communication',{...mgFiles.values.communication,...(old?{host:old.host,dashboardPort:old.dashboardPort,feedbackPort:old.feedbackPort}:{}),platformManaged:true},mgFiles.raw.communication);
 }
 delete db.mg400;
 mg400.config=applyMG400Files(mgFiles.values);
 const saveMG400Speed=value=>{const current=mg400Store.read();const motion={...current.values.motion,platform:{...current.values.motion.platform,defaultSpeedPercent:value},liveTest:{...current.values.motion.liveTest,speedFactorPercent:value}};mg400Store.save('motion',motion,current.raw.motion);mg400.config.speed=value;};
 const mg400FileView=()=>{const data=mg400Store.read();if(!mg400.status().connected)mg400.config=applyMG400Files(data.values);return {files:Object.entries(mg400Files).map(([key,name])=>({key,name,path:mg400Store.path(key),content:data.raw[key]})),config:mg400.config};};
 db.dataMode??='simulation';db.realStages??=[];db.profiles??={};
 for(const c of capabilities)db.controls[c.id]??=c.type==='NUMBER'?Number(c.initial):c.initial;
 db.safetyCases??=[];db.connections??=defaultConnections();db.telemetry??={};db.sourceStates??={};
 db.protocolConnection??={host:'127.0.0.1',port:15020};
 let protocol=createProtoforge(db.protocolConnection);
 db.deviceLinks??=protocol.status().devices.map(d=>({id:'modbus-'+d.id,deviceId:d.id,stageIndex:d.stageIndex,protocol:'modbus',host:db.protocolConnection.host,port:db.protocolConnection.port,unitId:d.points[0].unitId,enabled:true,note:''}));
 const protocolOn=()=>db.dataMode==='simulation'&&db.protocolEnabled===true;
 const activeCases=()=>protocolOn()?protocol.cases():db.safetyCases;
 const activeControls=()=>protocolOn()?protocol.controls():db.controls;
 const runtimeKeys=['materialFlow','states','telemetry','produced','bottles','liquid','completed','tick','updated','activeProduct','controls','interlock','auto','lastDecision'];
 // A configured physical target stays protected even when its display falls back.
 const isReal=i=>db.dataMode==='real'||(db.dataMode==='mixed'&&db.connections[i]?.enabled);
 const taskVisible=t=>(t.dataMode||'simulation')===db.dataMode;
 const fresh=i=>telemetryFresh(db.telemetry[i],db.connections[i]);
 const currentStates=()=>protocolOn()?protocol.states():db.states.map((s,i)=>{
  const sample=db.telemetry[i],config=db.connections[i],live=db.dataMode!=='simulation'&&fresh(i);
  const reason=db.dataMode==='simulation'?'模拟模式':live?'实体网关遥测':!config.enabled?'未启用设备接收':sample?'真实数据过期，使用模拟':'暂无真实数据，使用模拟';
  if(live)return {...sample,target:null,source:'real',quality:'live',fallback:false,sourceReason:reason};
  if(db.dataMode==='real')return {value:null,mode:'stopped',rate:0,target:null,measurements:{},history:[],source:'real',quality:'offline',fallback:false,receivedAt:sample?.receivedAt||null,sourceReason:!config.enabled?'未启用设备接收':'未连接 / 数据过期，物理状态未知'};
  return {...s,source:'simulation',quality:'simulated',fallback:db.dataMode==='mixed',sourceReason:reason,receivedAt:sample?.receivedAt||null,physicalState:sample?'unknown':'unconnected'};
 });
 let queue=Promise.resolve();
 const atomic=fn=>{const job=queue.then(async()=>{const before=structuredClone(db);try{const result=await fn();syncThresholdAlarms();await storage.flush();return result;}catch(e){db=before;storage.discard();throw e;}});queue=job.catch(()=>{});return job;};
 const categoryFor=action=>/采样/.test(action)?'telemetry':/任务/.test(action)?'task':/异常|联锁/.test(action)?'alarm':/控制|工位状态/.test(action)?'control':/知识|审核/.test(action)?'knowledge':/员工|身份/.test(action)?'access':/模型|AI|自动/.test(action)?'ai':/页面|视图|工位切换|主题/.test(action)?'interface':'system';
 const sourceFor=req=>['display','station','admin'].includes(req.headers['x-client-page'])?req.headers['x-client-page']:'system';
 const save=()=>storage.commit(db,[],db.tasks);
 if(!existing){storage.commit(db,(db.audit||[]).map(e=>({...e,category:categoryFor(e.action),source:'legacy'})),db.tasks);}
 await storage.flush();db.audit=(await storage.logs(new URLSearchParams({limit:'20'}))).items;
 // 孪生运行态必须由生产任务驱动：没有生产中任务时，产线初始化为空闲。
 if(!db.tasks.some(t=>taskVisible(t)&&!t.deletedAt&&!t.archivedAt&&t.status==='生产中')) db.states=db.states.map(s=>({...s,mode:'stopped',rate:0}));
 const log=(actor,action,detail,result='成功',meta={})=>{const context=requestContext.getStore()||{};const event={id:randomUUID(),time:now(),actor:actor?.name||'自动策略',actorId:actor?.id||null,role:actor?.role||'automation',dataMode:db.dataMode,action,detail:String(detail).slice(0,1200),result,category:meta.category||categoryFor(action),source:meta.source||context.source||'system',stageIndex:meta.stageIndex??context.stageIndex??null,...meta};storage.commit(db,[event],db.tasks);db.audit=[event,...db.audit].slice(0,20);return event;};
 const thresholdEvents=()=>db.alerts.filter(a=>a.ruleId&&!a.done&&a.dataMode===db.dataMode);
 const thresholdStates=()=>currentStates().map((s,i)=>{const alarms=thresholdEvents().filter(a=>a.stageIndex===i);const held=db.dataMode==='simulation'&&safetyHolds(activeCases()).includes(i);return {...s,...(held?{mode:'stopped',rate:0,simulationHold:true}:{}),alarms,alarmLevel:alarms.some(a=>a.level==='critical')?'critical':alarms.length?'warning':null};});
 const syncThresholdAlarms=()=>{
  const states=currentStates(),next=protocolOn()?protocol.alarms():[...evaluateAlarms({states,controls:db.controls}),...(db.dataMode==='simulation'?safetyAlarms(db.safetyCases):[])];
  const scope=protocolOn()?'protocol':db.dataMode;const sameScope=db.thresholdScope===scope;
  const previous=db.thresholdActive||[];
  const changes=alarmChanges(sameScope?previous:[],next);
  if(!sameScope)for(const old of previous)changes.unshift({kind:'clear',before:old,after:null,scopeChanged:true});
  db.thresholdActive=next;db.thresholdScope=scope;
  for(const change of changes){
   const a=change.after||change.before,stage=stages[a.stageIndex].name;
   if(change.before)for(const e of db.alerts.filter(e=>e.ruleId===a.id&&!e.done&&(change.scopeChanged||e.dataMode===db.dataMode))){e.done=true;e.resolvedAt=now();}
   const valid=states[a.stageIndex]?.quality!=='offline'&&!(a.source!=='setting'&&a.source!=='scenario'&&states[a.stageIndex]?.source!=='real'&&states[a.stageIndex]?.mode==='stopped');
   const action=change.kind==='clear'?(change.scopeChanged||!valid?'告警判定结束':'告警恢复'):change.kind==='change'?'告警状态变化':'阈值告警触发';
   const detail=change.kind==='clear'?`${stage} / ${a.metric} / ${change.scopeChanged?'切换数据模式':!valid?'离线或停机，当前读数不可判定':'已回到正常区间'}`:`${stage} / ${a.metric} ${a.value} ${a.unit} / ${a.direction==='low'?'≤':'≥'} ${a.threshold} ${a.unit} / ${a.level==='critical'?'严重':'预警'} / ${a.dataSource==='protocol'?'协议仿真回读':a.source==='setting'?'模拟设定值':a.dataSource==='real'?'真实遥测':'模拟读数'} / ${a.advice}`;
   if(change.after)db.alerts.unshift({...a,id:randomUUID(),ruleId:a.id,stage,stageIndex:a.stageIndex,title:a.title+(a.direction==='low'?' · 偏低':' · 偏高'),severity:a.level==='critical'?'严重':'关注',detail,time:now(),done:false,dataMode:db.dataMode});
   log(null,action,detail,'成功',{category:'alarm',source:'system',stageIndex:a.stageIndex,before:change.before,after:change.after});
  }
  for(const a of next){const event=db.alerts.find(e=>e.ruleId===a.id&&!e.done&&e.dataMode===db.dataMode);if(event){event.value=a.value;event.threshold=a.threshold;}}
  if(changes.length)save();
 };
 for(let i=0;i<stages.length;i++){const content=safetyDocument(i);if(content&&!db.documents.some(d=>d.id==='SAFETY-DEMO-'+i))db.documents.push({id:'SAFETY-DEMO-'+i,title:stages[i].name+' · 常见异常与设施联动（模拟）',kind:'document',status:'published',version:1,owner:'系统演示',updated:now(),content:'演示用阈值及响应，不是实机安全认证逻辑。演示传感器独立于正常遥测。\n'+content});const doc=alarmDocument(i),existing=db.documents.find(d=>d.id===doc.id);if(!existing)db.documents.push({...doc,updated:now()});else if(existing.owner==='系统演示'&&existing.content!==doc.content){Object.assign(existing,{content:doc.content,version:existing.version+1,updated:now()});}const safety=db.documents.find(d=>d.id==='SAFETY-DEMO-'+i);if(safety?.owner==='系统演示'&&content&&!safety.content.endsWith(content)){safety.content='演示用阈值及响应，不是实机安全认证逻辑。演示传感器独立于正常遥测。\n'+content;safety.version++;safety.updated=now();}}
 const recordSources=()=>{currentStates().forEach((s,i)=>{const key=db.dataMode+':'+i,next=s.source+':'+s.quality,previous=db.sourceStates[key];db.sourceStates[key]=next;if(previous&&previous!==next)log(null,'设备数据来源切换',`${stages[i].name} / ${previous} → ${next} / ${s.sourceReason}`,'成功',{category:'telemetry',stageIndex:i});});};
 const withRequest=(req,fn)=>requestContext.run({source:sourceFor(req)},fn);
 const actor=req=>db.employees.find(e=>e.id===decodeURIComponent((req.headers.cookie||'').match(/(?:^|; )bw_demo_actor=([^;]+)/)?.[1]||'admin')&&e.enabled)||{id:'none',name:'已停用身份',role:'viewer',stages:[]};
 const hasRole=(user,role)=>Array.isArray(user.roles)?user.roles.includes(role):user.role===role;
 const requireRole=(user,allowed)=>{if(!allowed.some(role=>hasRole(user,role)))fail('当前角色没有此操作权限。',403);};
 const canControl=(user,index)=>['admin','engineer','operator'].some(role=>hasRole(user,role))&&(hasRole(user,'admin')||user.stages.includes(index));
 const activeTask=()=>db.tasks.find(t=>taskVisible(t)&&!t.deletedAt&&!t.archivedAt&&['生产中','暂停中'].includes(t.status))||null;
 const lineMode=()=>{if(protocolOn()){const states=protocol.states();return states.some(s=>s.quality==='offline')?'offline':states.some(s=>s.mode==='running')?'running':'paused';}if(db.dataMode!=='simulation'){const live=currentStates();return live.some(s=>s.quality==='offline')?'offline':live.some(s=>s.mode==='running')?'running':'idle';}const task=activeTask();if(!task)return 'idle';if(db.interlock||safetyHolds(db.safetyCases).length||currentStates().some(s=>['stopped','fault'].includes(s.mode)))return 'paused';return 'running';};
 const flowView=()=>{const task=activeTask();if(db.dataMode!=='simulation'||protocolOn())return null;return task&&db.materialFlow?.taskId===task.id?{...db.materialFlow,running:lineMode()==='running'&&task.status==='生产中'}:null;};
 const taskPackSize=()=>Math.max(1,Number(activeTask()?.spec?.match(/(\d+)\s*瓶\s*\//)?.[1]||12));
 const snapshot=()=>({materialFlow:flowView(),protocol:protocolOn()?protocol.status():{enabled:false},safetyCases:db.dataMode==='simulation'?activeCases():[],daily:dailyRecord(db),logistics:logistics(),dataMode:db.dataMode,realStages:db.connections.filter(c=>c.enabled).map(c=>c.stageIndex),storage:'MySQL',states:thresholdStates().map((s,i)=>{const material=s.source==='real'&&s.quality!=='offline'&&s.material?s.material:materialStage(flowView(),i),idle=db.dataMode==='simulation'&&!protocolOn()&&[2,4,5].includes(i)&&material.count===0;const simulated=s.source==='simulation'&&s.dataSource!=='protocol',controls=db.controls,phase=preprocessingPhase(flowView(),controls),active=flowView()?.running,osc=Math.sin(db.tick*.31+i)*.02;
const defaults=[
 {washPressure:active&&phase==='rinse'?.3+osc:0,washFlow:active&&phase==='rinse'?Number(controls['PT-WASH-01:washFlow']??6):0,airFlow:active&&phase==='air'?Number(controls['PT-AIR-01:airFlow']??80):0},
 {chamberPressure:101.3+osc,gasTemperature:24+osc},
 {inspectionPassRate:idle?null:99.5,inspectionIlluminance:Number(controls['VIS-LIGHT-01:lightIntensity']??70)*12},
 {tankLevel:Math.min(100,db.liquid/2000*100),mixConcentration:10.5+osc},
 {fillDeviation:idle?null:Number((s.value-s.target).toFixed(1)),actualFillFlow:idle?0:Number(controls['FIL-PUMP-01:flowRate']??120)},
 {actualLiquidLevel:idle?null:150+osc,sealPressure:idle?null:101.3+osc},
 {gripperVacuum:active&&material.processing?-60:0,actualGripForce:active&&material.processing?Number(controls['PK-GRIP-01:gripForce']??25):0},
 {batteryLevel:85,obstacleDistance:2.5},
 {warehouseTemperature:24+osc,warehouseHumidity:48+osc,warehouseGas:0,warehouseSmoke:0}
][i];if(i===8&&simulated)for(const c of activeCases()){const spec=scenarioById(c.id);if(spec?.stageIndex===8&&spec.measurement)defaults[spec.measurement]=c.value;}return {...s,...(simulated&&i===6?{value:taskPackSize(),target:taskPackSize(),history:Array(16).fill(taskPackSize())}:{}),...(idle?{value:null,history:[]}:{}),...(simulated?{...(db.dataMode==='simulation'?{rate:stationRate(flowView(),i)}:{}),measurements:defaults}:{}),material};}),updated:db.updated,tick:db.tick,produced:protocolOn()?0:db.produced,bottles:protocolOn()?0:db.bottles,liquid:protocolOn()?0:db.liquid,completed:protocolOn()?0:db.completed,activeProduct:db.activeProduct,interlock:db.interlock,lineMode:lineMode(),activeTask:activeTask()});
 const pause=()=>{db.states.forEach(s=>{s.mode='stopped';s.rate=0;});db.updated=Date.now();};
 const validate=(c,value)=>{if(!c)fail('设备不支持此控制能力。');if(c.type==='NUMBER'){if(typeof value!=='number'||!Number.isFinite(value)||value<c.min||value>c.max||Math.abs((value-c.min)/c.step-Math.round((value-c.min)/c.step))>1e-6)fail(`${c.label}须为 ${c.min}–${c.max}，步长 ${c.step}。`);}else if(c.type==='TEXT'){if(typeof value!=='string'||!/^A-0[1-3]-0[1-6]$/.test(value))fail('请选择有效库位。');}else if(!c.options?.includes(value))fail('控制选项无效。');};
 const setControl=(c,value)=>{if(protocolOn())fail('协议仿真请使用设备指令入口；本地自动配方尚未接入协议执行。',409);if(isReal(c.stageIndex))fail('真实工位未配置命令网关，未发送控制。',409);db.controls[c.id]=value;const s=db.states[c.stageIndex];if(c.command==='SET_RUN_STATE'&&!(c.stageIndex===2&&c.control==='cameraState')){s.mode=value==='PAUSED'?'stopped':'running';s.rate=value==='PAUSED'?0:stages[c.stageIndex].rate;}if(c.control==='fillVolume'){s.target=value;s.value=value;}if(c.control==='speedLimit'){s.target=value;s.value=value;}db.updated=Date.now();};
 const tick=async()=>{
  for(const event of mg400.drain())log(null,'MG400 状态',event.detail,event.result,{category:event.result==='告警'?'alarm':'control',stageIndex:0,device:'MG400-TEACH-01'});
 if(protocolOn()){const before=protocol.cases();await protocol.poll();db.updated=Date.now();for(const c of protocol.cases()){const old=before.find(x=>x.id===c.id);if(c.phase!==old?.phase&&c.phase!=='resolved'||old&&old.phase!==c.phase){const spec=scenarioById(c.id);if(spec.action)log(null,c.phase==='active'?'设施联动回读':c.phase==='resolved'?'设施联动恢复':'设施保护保持',spec.title+' / '+(c.phase==='active'?spec.action:spec.restore)+' / ProtoForge 设备回读','成功',{category:'control',stageIndex:spec.stageIndex,after:c});}}recordSources();syncThresholdAlarms();save();return;}

 if(db.dataMode==='simulation'){
  const previous=db.safetyCases;db.safetyCases=advanceSafetyCases(previous,Date.now());
  // Record the cause transition before its independent actuator completion.
  syncThresholdAlarms();
  for(const c of db.safetyCases){if(c.phase==='resolved'&&previous.find(p=>p.id===c.id)?.phase==='active'){const s=scenarioById(c.id);log(null,'设施联动完成',s.restore+' / '+c.value+' '+s.unit,'成功',{category:'control',stageIndex:s.stageIndex,after:c});}}
 }
 recordSources();const ls=logistics(),job=ls.jobs.find(j=>['running','waiting'].includes(j.status));if(job){if(db.interlock||isReal(7)||isReal(8)||safetyHolds(db.dataMode==='simulation'?db.safetyCases:[]).includes(7)){job.status='paused';log(null,'物流任务暂停','联锁或设备模式变化，保持当前位置','成功',{category:'task'});}else{const previousStatus=job.status,previousReplans=job.replans||0;const done=advanceLogistics(ls);if((job.replans||0)!==previousReplans)log(null,'物流避障重规划',job.id+' / 从当前位置重新计算路线','成功',{category:'task',after:{path:job.path,replans:job.replans}});if(job.status==='waiting'&&previousStatus!=='waiting')log(null,'物流障碍停车',job.waitReason,'成功',{category:'task'});if(previousStatus==='waiting'&&job.status==='running')log(null,'物流障碍解除恢复',job.id,'成功',{category:'task'});if(done)log(null,'物流任务完成',done.id+' / '+done.kind+' / '+done.quantity+' 箱','成功',{category:'task',after:done});}}if(db.dataMode==='real'){return;}db.tick++;const task=activeTask();const operational=!!task&&!safetyHolds(db.dataMode==='simulation'?db.safetyCases:[]).length&&currentStates().every(s=>s.mode!=='stopped'&&s.mode!=='fault')&&!db.interlock;if(task&&task.status==='生产中'&&!operational){task.status='暂停中';task.version++;task.updatedAt=now();log(null,'任务进入暂停中',task.id,'成功',{category:'task',source:'system',after:{...task}});}else if(task&&task.status==='暂停中'&&operational){task.status='生产中';task.version++;task.updatedAt=now();log(null,'任务恢复生产',task.id,'成功',{category:'task',source:'system',after:{...task}});}const canProduce=!!task&&task.status==='生产中'&&operational;const volume=Number(db.controls['FIL-HEAD-01:fillVolume'])/1000;let count=0;if(db.dataMode==='simulation'&&task){if(db.materialFlow?.taskId!==task.id)db.materialFlow=createMaterialFlow(task);const beforeTransport=db.materialFlow.stages[7]?.[0]?.id,beforeStorage=db.materialFlow.stages[8]?.[0]?.id;const moved=advanceMaterialFlow(db.materialFlow,{seconds:2,running:canProduce,controls:db.controls,bottles:db.bottles,liquid:db.liquid,volume,packSize:taskPackSize(),reserveStorage:()=>reserveProductionSlot(ls,task.productId||task.productCode||db.activeProduct),storeCarton:token=>{const product=task.productId||task.productCode||db.activeProduct,id='production:'+token.id,existed=ls.movements.some(m=>m.id===id);const ok=storeProductionCarton(ls,token,product,new Date(Date.now()+180*86400000).toISOString().slice(0,10));if(ok&&!existed)log(null,'成品箱入库',`满箱 ${token.count} 瓶 / ${token.storageSlot} / ${token.id}`,'成功',{category:'task',source:'system',stageIndex:8,after:{carton:token.id,slot:token.storageSlot,bottles:token.count,quantity:1}});return ok;}});for(const [stageIndex,before,action] of [[7,beforeTransport,'满箱交接运输'],[8,beforeStorage,'到达仓库待入库']]){const token=db.materialFlow.stages[stageIndex]?.[0];if(token&&token.id!==before)log(null,action,`${token.id} / ${token.count} 瓶 / ${stageIndex===7?'装箱完成，开始运输':'等待货位分配与移载'}`,'成功',{category:'task',source:'system',stageIndex,after:{carton:token.id,bottles:token.count}});}count=moved.completed;db.bottles-=moved.admitted;db.liquid=Number((db.liquid-moved.admitted*volume).toFixed(3));}recordProduction(db,count);db.produced+=count;db.completed+=count;db.updated=Date.now();db.states=db.states.map((s,i)=>{const def=stages[i],halted=!task||['stopped','fault'].includes(s.mode),base=i===4?Number(db.controls['FIL-HEAD-01:fillVolume']):i===7?Number(db.controls['AGV-01:speedLimit']):def.value;const value=halted||i===6?s.value:Number((base+Math.sin(db.tick*.53+i)*Math.max(base*.002,10**(-def.precision))).toFixed(def.precision));return {...s,value,mode:!task?'stopped':s.mode,rate:halted?0:def.rate,history:[...s.history.slice(-15),value]};});if(task&&task.status==='生产中'){task.done=Math.min(task.plan,task.done+count);task.updatedAt=now();if(task.done===task.plan){task.status='已完成';dailyRecord(db).completedTasks.push(task.id);task.version++;log(null,'任务生产完成',task.id,'成功',{category:'task',source:'system',after:{...task}});}}if(db.tick%15===0)log(null,'运行数据采样','九工位读数、物料和产量快照（每 30 秒）','成功',{category:'telemetry',source:'system',after:snapshot()});else save();};
 const retrieval=(question)=>{const normalized=question.toLowerCase();const terms=[...new Set(normalized.match(/[a-z0-9_-]+|[\u4e00-\u9fff]{2}/g)||[])];return db.documents.filter(d=>d.status==='published').flatMap(d=>{const text=d.content+(d.settings?'\n工艺参数：'+JSON.stringify(d.settings):'');const chunks=[];for(let i=0;i<text.length;i+=700){const content=text.slice(i,i+1000);const full=(d.title+' '+content).toLowerCase();const score=terms.reduce((n,t)=>n+(full.includes(t)?1:0),0);if(score)chunks.push({id:d.id,title:d.title,version:d.version,excerpt:content,score});}return chunks;}).sort((a,b)=>b.score-a.score).slice(0,5);};
 const evaluate=(detection,user,source)=>{const executionSteps=[],operations=[];if(protocolOn())fail('协议联调暂不自动应用配方，请在控制台人工确认参数。',409);if(db.dataMode!=='simulation')fail('真实和混合模式暂不执行演示自动调参。',409);requireRole(user,['admin','engineer']);const before={controls:{...db.controls},interlock:db.interlock};const d={productCode:String(detection.productCode||''),confidence:Number(detection.confidence),obstacleDistance:detection.obstacleDistance===undefined?null:Number(detection.obstacleDistance),emergency:detection.emergency===true};if(!Number.isFinite(d.confidence)||d.confidence<0||d.confidence>1)fail('识别置信度必须为 0–1。');if(d.obstacleDistance!==null&&(!Number.isFinite(d.obstacleDistance)||d.obstacleDistance<0))fail('障碍距离无效。');executionSteps.push({title:'识别输入',time:now()});const product=db.documents.find(x=>x.kind==='recipe'&&x.productCode===d.productCode&&x.status==='published');if(product)executionSteps.push({title:'匹配配方',time:now()});let status='review',reason='产品未知、无已审核配方，或识别置信度不足。';const emergency=d.emergency||(d.obstacleDistance!==null&&d.obstacleDistance<db.auto.obstacleLimit);if(emergency){pause();db.interlock=true;status='stopped';reason='演示安全规则触发：暂停全线并锁定恢复。';}else if(product&&d.confidence>=db.auto.minConfidence){Object.entries(product.settings).forEach(([id,v])=>{const c=capabilities.find(c=>c.id===id);validate(c,v);if(!canControl(user,c.stageIndex))fail('当前工程师没有配方涉及的全部工位权限。',403);});status='ready';reason='已找到审核配方，参数范围校验通过。';if(db.auto.enabled&&!db.interlock){if(product.standardId)callTool('apply_recipe',{recordId:product.standardId,version:product.version,requestId:randomUUID(),confidence:d.confidence},user);else{pause();Object.entries(product.settings).forEach(([id,v])=>{const c=capabilities.find(c=>c.id===id),previous=db.controls[id];setControl(c,v);operations.push({id,title:'设置'+c.label,before:previous,value:v,unit:c.unit,time:now(),basis:product.title+' · V'+product.version,result:'已应用'});});db.activeProduct=product.productCode;}status='applied';reason='已向虚拟设备应用审核配方，全线保持暂停，等待人工核对恢复。';}}else if(db.auto.enabled){pause();reason+=' 自动模式已暂停，等待人工检查。';}if(status==='applied'&&!operations.length){const completed=now();for(const [id,value] of Object.entries(product.settings)){const c=capabilities.find(c=>c.id===id);operations.push({id,title:'设置'+c.label,before:before.controls[id],value,unit:c.unit,time:completed,timeKind:'batch',basis:product.title+' · V'+product.version,result:'已应用'});}}executionSteps.push({title:status==='stopped'?'安全处置':'参数执行',time:now()});db.lastDecision={id:randomUUID(),time:now(),steps:executionSteps,operations,...d,source,status,reason,recipe:product?{id:product.id,title:product.title,version:product.version,settings:product.settings}:null};log(user,'自动识别与调参',`${source} / ${d.productCode} / ${reason}`,'成功',{before,after:{decision:db.lastDecision,controls:{...db.controls},interlock:db.interlock}});const affected=emergency||status==='applied'||(status==='review'&&db.auto.enabled)?stages.map((_,i)=>i):[...new Set(Object.keys(product?.settings||{}).map(id=>capabilities.find(c=>c.id===id)?.stageIndex).filter(Number.isInteger))];for(const i of affected){const changes=capabilities.filter(c=>c.stageIndex===i&&before.controls[c.id]!==db.controls[c.id]).map(c=>({device:c.device,parameter:c.label,before:before.controls[c.id],after:db.controls[c.id],unit:c.unit}));log(user,'AI 工位决策',reason,'成功',{category:'ai',stageIndex:i,before:{controls:Object.fromEntries(capabilities.filter(c=>c.stageIndex===i).map(c=>[c.id,before.controls[c.id]]))},after:{decision:db.lastDecision,changes,execution:status==='applied'?'已应用参数并暂停':status==='stopped'?'已触发暂停联锁':status==='review'&&db.auto.enabled?'已暂停，转人工':'未下发参数'}});}return db.lastDecision;};
 async function handleRoute(req,res,body){const user=actor(req),url=new URL(req.url,'http://localhost'),p=url.pathname,write=req.method==='POST';
  if(write){const context=requestContext.getStore(),stageIndex=Number.isInteger(body.index)?body.index:capabilities.find(c=>c.id===body.id)?.stageIndex;if(context&&stageIndex!==undefined)context.stageIndex=stageIndex;}
  if(p.startsWith('/api/ops/mg400')){
   if(write){requireRole(user,['admin','engineer','operator']);if(!canControl(user,0))fail('需要预处理工位操作权限',403);}
   for(const event of mg400.drain())log(null,'MG400 状态',event.detail,event.result,{category:event.result==='告警'?'alarm':'control',stageIndex:0,device:'MG400-TEACH-01'});
   if(p==='/api/ops/mg400'&&!write)return readTestFeedback()||mg400.status();
   if(p==='/api/ops/mg400/test-stop'&&write)return stopTest();
   if(p==='/api/ops/mg400/test-speed'&&write){if(body.confirmed!==true||db.dataMode==='simulation'||db.interlock)fail('请确认真实模式及速度修改');const result=await requestTestSpeed(body.value);saveMG400Speed(body.value);log(user,'MG400 测试改速',String(body.value),'已受理',{stageIndex:0});return result;}
   if(write&&readTestFeedback()&&['connect','prepare','execute','disconnect'].some(action=>p==='/api/ops/mg400/'+action))fail('空载测试正在独占通信，请先停止测试',409);
   if(p==='/api/ops/mg400/manual/stop'&&write)return await manualMG400.stop();
   if(p==='/api/ops/mg400/manual/heartbeat'&&write)return manualMG400.heartbeat(body.id,user.id);
   if(p==='/api/ops/mg400/manual/start'&&write){
    if(readTestFeedback()||db.dataMode==='simulation'||db.interlock)fail('请停止测试并确认真实数据模式及联锁状态',409);
    const result=await manualMG400.start(body,user.id);log(user,'手动调试 MG400',result.command,'已受理',{stageIndex:0});return result;
   }
   if(write&&manualMG400.active&&['connect','disconnect','prepare','execute'].some(action=>p==='/api/ops/mg400/'+action))fail('请先停止手动动作',409);
   if(p==='/api/ops/mg400/open-folder'&&write){
    requireRole(user,['admin','engineer']);
    if(process.platform!=='win32'||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))fail('请在运行平台服务的 Windows 电脑上打开配置目录');
    const target=path.dirname(mg400Store.path(body.key));
    await new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; $info=New-Object System.Diagnostics.ProcessStartInfo; $info.FileName=Join-Path $env:WINDIR 'explorer.exe'; $info.Arguments='/n,'+[char]34+$env:MG400_CONFIG_TARGET+[char]34; $info.UseShellExecute=$true; $info.WindowStyle=[System.Diagnostics.ProcessWindowStyle]::Normal; [System.Diagnostics.Process]::Start($info) | Out-Null"],{stdio:'ignore',windowsHide:true,env:{...process.env,MG400_CONFIG_TARGET:target}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('无法打开配置文件夹')));});
    return {message:'已打开配置文件所在文件夹'};
   }
   if(p==='/api/ops/mg400/files'&&!write){requireRole(user,['admin','engineer']);return mg400FileView();}
   if(p==='/api/ops/mg400/files'&&write){
    requireRole(user,['admin','engineer']);
    if(mg400.status().connected)fail('请先断开机械臂通信再保存配置；断开不会停止实机',409);
    if(typeof body.content!=='string'||body.content.length>100000)fail('配置内容无效或过大');
    const saved=mg400Store.save(body.key,JSON.parse(body.content),body.expected);
    mg400.config=applyMG400Files(saved.values);
    log(user,'保存 MG400 配置',mg400Files[body.key],'成功',{stageIndex:0});
    return {...mg400FileView(),message:'已保存到配置文件，未连接或下发设备指令'};
   }
   if(p==='/api/ops/mg400/config'&&write)fail('MG400 已改为文件配置，请在配置文件页面保存');
   if(p==='/api/ops/mg400/connect'&&write){requireRole(user,['admin','engineer']);if(mg400.status().connected)fail('请先断开现有连接',409);const config=applyMG400Files(mg400Store.read().values);return await mg400.connect(config);}
   if(p==='/api/ops/mg400/disconnect'&&write){mg400.close();log(user,'断开 MG400','仅断开通信，不停止机械臂','成功',{stageIndex:0});return mg400.status();}
   if(p==='/api/ops/mg400/prepare'&&write){if(db.dataMode==='simulation')fail('请切换真实或混合数据模式后控制实机',409);if(db.interlock&&!['stop','pause','disable'].includes(body.action))fail('平台联锁尚未解除',409);return mg400.prepare(body.action,body.value,user.id);}
   if(p==='/api/ops/mg400/execute'&&write){if(db.dataMode==='simulation'||(db.interlock&&!['stop','pause','disable'].includes(mg400.pending.get(body.token)?.action)))fail('当前模式或联锁不允许下发',409);if(body.confirmed!==true)fail('请人工确认');try{const pending=mg400.pending.get(body.token);const result=await mg400.execute(body.token,user.id);if(pending?.action==='speed')saveMG400Speed(pending.value);log(user,'人工 MG400 控制',result.raw,'已受理',{category:'control',stageIndex:0,device:'MG400-TEACH-01',after:result});return result;}catch(e){log(user,'人工 MG400 控制',e.message,'失败或结果未知',{category:'control',stageIndex:0,device:'MG400-TEACH-01'});return {error:e.message,ok:false};}}
   fail('未知机械臂接口',404);
  }
  if(p==='/api/ops/logistics/analysis'&&write){
   try{const ls=logistics();switch(body.kind){case 'schedule':return rankQueue(ls,body.strategy);case 'storage':return comparePlans(ls,body.input||{});case 'picking':return planPicking(ls,body.slots,body.algorithm);case 'inventory':return inventoryAnalysis(ls,body.min,body.target);default:fail('无效分析类型');}}catch(e){fail(e.message);}
  }
  if(p==='/api/ops/logistics/obstacles'&&write){
   requireRole(user,['admin','engineer','operator']);if(!canControl(user,7))fail('需要物流工位权限',403);if(isReal(7)||isReal(8))fail('这里只能编辑模拟障碍，真实车辆未接入',409);
   const ls=logistics();if(body.action==='remove'){const obstacle=ls.obstacles.find(o=>o.id===body.id);if(!obstacle)fail('障碍已不存在',404);ls.obstacles=ls.obstacles.filter(o=>o.id!==body.id);log(user,'移除模拟障碍',obstacle.id,'成功',{category:'task'});return ls;}
   if(body.action!=='add'||!Number.isInteger(body.x)||!Number.isInteger(body.z)||blocked(body.x,body.z))fail('请在可通行的整数网格上放置障碍');
   if(ls.obstacles.length>=20)fail('最多放置 20 个临时障碍');if(ls.obstacles.some(o=>o.x===body.x&&o.z===body.z))fail('该位置已有障碍');
   const obstacle={id:randomUUID(),x:body.x,z:body.z,source:'simulation'};if(obstacleBlocked(...ls.vehicle.position,[obstacle]))fail('不能在车辆所在位置及其安全区放置障碍');
   ls.obstacles.push(obstacle);log(user,'添加模拟障碍',`坐标 ${body.x}, ${body.z}；含 1 格安全膨胀`,'成功',{category:'task',after:obstacle});return ls;
  }
  if(p==='/api/ops/logistics/avoidance'&&write){requireRole(user,['admin','engineer','operator']);if(!canControl(user,7))fail('需要物流工位权限',403);if(isReal(7)||isReal(8))fail('真实车辆策略未接入',409);if(!Object.hasOwn(avoidanceStrategies,body.strategy))fail('无效避障策略');logistics().avoidance=body.strategy;log(user,'设置物流避障策略',avoidanceStrategies[body.strategy],'成功',{category:'task'});return logistics();}
  if(p==='/api/ops/logistics/queue'&&write){
   requireRole(user,['admin','engineer','operator']);if(!canControl(user,7)||!canControl(user,8))fail('需要物流与仓储工位权限',403);
   const ls=logistics();if(body.action==='remove'){if(!ls.queue.some(q=>q.id===body.id))fail('调度候选不存在',404);ls.queue=ls.queue.filter(q=>q.id!==body.id);log(user,'移除物流调度候选',body.id,'成功',{category:'task'});return ls;}
   if(body.action!=='add'||![1,2,3].includes(body.priority))fail('请选择有效优先级');if(ls.queue.length>=30)fail('最多保存 30 个调度候选');
   const plan=planLogistics(body.input||{}),draft={...plan,id:randomUUID(),priority:body.priority,createdAt:now()};ls.queue.push(draft);log(user,'新增物流调度候选',draft.id+' / 未下发','成功',{category:'task'});return ls;
  }
  if(p==='/api/ops/logistics'&&!write)return logistics();
  if(p==='/api/ops/logistics/preview'&&write){requireRole(user,['admin','engineer','operator']);return planLogistics(body);}
  if(p==='/api/ops/logistics/jobs'&&write){
   requireRole(user,['admin','engineer','operator']);if(!canControl(user,7)||!canControl(user,8))fail('需要物流与仓储工位的操作权限',403);
   if(isReal(7)||isReal(8))fail('未接入真实物流定位与命令网关，当前模式只支持路线预览',409);
   if(db.interlock)fail('安全联锁未解除',409);
   const ls=logistics();if(ls.jobs.some(j=>['running','paused','waiting'].includes(j.status)))fail('车辆正在执行任务，请先完成或取消',409);
   const queued=body.queueId?ls.queue.find(q=>q.id===body.queueId):null;if(body.queueId&&!queued)fail('调度候选已不存在',409);const plan=planLogistics(queued||body),job={...plan,id:randomUUID(),status:'running',step:0,createdAt:now(),source:'simulation'};
   ls.jobs.unshift(job);if(queued)ls.queue=ls.queue.filter(q=>q.id!==queued.id);log(user,'下发物流任务',job.kind+' / '+job.quantity+' 箱 / '+job.slot,'成功',{category:'task',after:job});return job;
  }
  if(p==='/api/ops/logistics/action'&&write){
   requireRole(user,['admin','engineer','operator']);if(!canControl(user,7)||!canControl(user,8))fail('需要物流与仓储工位的操作权限',403);
   const job=logistics().jobs.find(j=>j.id===body.id);if(!job||!['running','paused','waiting'].includes(job.status))fail('任务不可操作',409);
   if(!['pause','resume','cancel'].includes(body.action))fail('无效操作');
   if(body.action==='resume'&&(isReal(7)||isReal(8)||db.interlock))fail('当前设备模式或联锁不允许恢复',409);
   if(body.action==='cancel'&&job.step>=job.pickupIndex)fail('货物已装车，请完成配送后再创建新任务',409);
   job.status=({pause:'paused',resume:'running',cancel:'cancelled'})[body.action];log(user,'物流任务状态变更',job.id+' / '+job.status,'成功',{category:'task',after:job});return job;
  }
  if(p==='/api/ops/protocol'&&write){
   requireRole(user,['admin']);if(typeof body.enabled!=='boolean')fail('请选择设备来源');
   if(body.enabled&&db.dataMode!=='simulation')fail('请先选择模拟数据工作区');
   await protocol.poll();
   if(body.enabled&&protocol.status().online!==47)fail('ProtoForge 设备未全部在线，请先启动平台');
   if(!body.enabled&&protocolOn()&&protocol.states().some(s=>s.mode==='running'))fail('请先暂停协议设备再切换来源');
   db.protocolEnabled=body.enabled;db.auto.enabled=false;
   log(user,'切换仿真设备来源',body.enabled?'ProtoForge Modbus TCP · 47台设备':'本地任务模拟');save();return snapshot();
  }
  if(protocolOn()&&write&&(p.startsWith('/api/ops/logistics/')||p==='/api/ops/tasks'))fail('协议联调模式请通过设备控制台操作；任务与物流业务仍属于本地模拟。',409);
  if(p==='/api/ops/safety-demo'&&write){
   requireRole(user,['admin','engineer','operator']);if(db.dataMode!=='simulation')fail('异常演示只允许在模拟模式使用。',409);
   const spec=scenarioById(body.id);if(!spec)fail('未知异常演示。');if(!canControl(user,spec.stageIndex))fail('无此工位权限。',403);
   if(protocolOn()){const result=await protocol.safety(body.id,body.action);if(spec.action)log(null,body.action==='trigger'?'设施联动回读':body.action==='reset'||spec.automatic?'设施联动恢复':'设施保护保持',spec.title+' / '+(body.action==='trigger'?spec.action:body.action==='clear'&&!spec.automatic?'异常恢复，等待人工复位':spec.restore),'成功',{category:'linkage',stageIndex:spec.stageIndex,after:result});log(user,'协议异常操作',spec.title+' / '+body.action+' / Modbus写入与回读','成功',{category:'control',stageIndex:spec.stageIndex,after:result});syncThresholdAlarms();save();return {ok:true,case:result};}
   const current=db.safetyCases.find(c=>c.id===body.id),time=Date.now();let next;
   if(body.action==='trigger'){
    if(current&&current.phase!=='resolved')fail('该异常尚未结束。',409);
    if(db.safetyCases.some(c=>c.phase!=='resolved'&&spec.facility&&scenarioById(c.id).facility===spec.facility))fail('该设施已有演示正在执行，请先结束。',409);
    next=createSafetyCase(body.id,time);
   }else if(body.action==='clear'){if(!current||current.phase!=='active')fail('没有待排除的异常。',409);next=clearSafetyCase(current,time);}
   else if(body.action==='reset'){if(!current||current.phase!=='awaiting-reset')fail('先排除异常，再人工复位。',409);next=resetSafetyCase(current,time);}
   else fail('未知演示操作。');
   db.safetyCases=db.safetyCases.filter(c=>c.id!==body.id);db.safetyCases.push(next);syncThresholdAlarms();
   log(user,body.action==='trigger'?'触发异常演示':body.action==='clear'?'模拟排除异常':'人工复位联动',spec.title,'成功',{category:'control',stageIndex:spec.stageIndex,before:current||null,after:next});
   if(spec.action&&(body.action==='trigger'||next.phase==='resolved'))log(null,body.action==='trigger'?'设施联动执行':'设施联动完成',body.action==='trigger'?spec.action:spec.restore,'成功',{category:'control',stageIndex:spec.stageIndex,after:{...next,facility:spec.facility,simulation:true}});
   save();return {ok:true,case:next};
  }
  if(p==='/api/ops/device-links'&&!write){requireRole(user,['admin','engineer']);return {items:db.deviceLinks,devices:protocol.status().devices,connection:db.protocolConnection};}
  if(p==='/api/ops/device-links'&&write){
   requireRole(user,['admin','engineer']);const old=db.deviceLinks.find(l=>l.id===body.id);
   if(body.action==='delete'){if(!old)fail('配置不存在');if(old.protocol==='modbus')fail('内置点位连接请编辑地址，不删除');if(old.protocol==='http'&&db.connections[old.stageIndex]?.deviceId===old.deviceId)db.connections[old.stageIndex].enabled=false;db.deviceLinks=db.deviceLinks.filter(l=>l.id!==old.id);log(user,'删除设备协议配置',old.deviceId+' / '+old.protocol);save();return {ok:true};}
   if(old&&(body.deviceId!==old.deviceId||body.protocol!==old.protocol))fail('修改设备或协议请另建配置');
   const d=protocol.status().devices.find(d=>d.id===body.deviceId)||db.assets.find(a=>a.code===body.deviceId);
   if(!d||!['tcp','modbus','http','mqtt','opcua'].includes(body.protocol))fail('请选择设备及通信协议');
   const link={id:old?.id||randomUUID(),deviceId:body.deviceId,stageIndex:d.stageIndex,protocol:body.protocol,host:String(body.host||'').trim(),port:Number(body.port),unitId:Number(body.unitId||1),topic:String(body.topic||'').slice(0,200),nodeId:String(body.nodeId||'').slice(0,200),enabled:body.enabled===true,note:String(body.note||'').slice(0,500)};
   if(link.protocol==='tcp'&&(!/^[a-zA-Z0-9.:-]{1,200}$/.test(link.host)||!Number.isInteger(link.port)||link.port<1||link.port>65535))fail('请填写有效 TCP 地址与端口');
   if(link.protocol==='modbus'){
    if(!protocol.status().devices.some(d=>d.id===link.deviceId))fail('该资产尚无 Modbus 点位表，请选择已配置点位的设备');
    if(!/^[a-zA-Z0-9.:-]{1,200}$/.test(link.host)||!Number.isInteger(link.port)||link.port<1||link.port>65535||!Number.isInteger(link.unitId)||link.unitId<1||link.unitId>247)fail('地址、端口或站号无效');
    if(db.deviceLinks.some(l=>l.id!==link.id&&l.deviceId===link.deviceId&&l.protocol==='modbus'))fail('该设备已有 Modbus 配置，请编辑现有配置');
    const connection={...db.protocolConnection,devices:{...db.protocolConnection.devices,[link.deviceId]:{host:link.host,port:link.port,unitId:link.unitId}}};
    const probe=createProtoforge(connection);
    if(body.action==='test')return await probe.inspect(link.deviceId);
    if(link.enabled){await probe.inspect(link.deviceId);if(protocolOn()&&protocol.states()[link.stageIndex]?.mode==='running')fail('请先暂停所属工序再修改通信配置',409);}
    else fail('Modbus 停用请在协议数据源中操作；本页保存的是设备连接地址');
    db.protocolConnection=connection;protocol=probe;
   }else{
    if(body.action==='test')fail(link.protocol==='http'?'HTTP 为被动接收，请由网关向遥测接口上报，再查看接收状态':'此协议尚未安装运行驱动，目前仅保存配置',409);
    if(link.protocol==='http'&&link.enabled){
     if(db.deviceLinks.some(l=>l.id!==link.id&&l.protocol==='http'&&l.enabled&&l.stageIndex===link.stageIndex))fail('同一工序只允许一个启用的 HTTP 主读数来源');
     db.connections[link.stageIndex]={...db.connections[link.stageIndex],deviceId:link.deviceId,protocol:'http',enabled:true,timeoutSeconds:15};
    }
    if(link.protocol==='http'&&!link.enabled&&db.connections[link.stageIndex]?.deviceId===link.deviceId)db.connections[link.stageIndex].enabled=false;
    if(['tcp','mqtt','opcua'].includes(link.protocol))link.enabled=false;
   }
   if(body.action!=='save')fail('无效操作');
   if(old)Object.assign(old,link);else db.deviceLinks.push(link);log(user,'保存设备协议配置',link.deviceId+' / '+link.protocol);save();return link;
  }
  if(p==='/api/ops/protocol/connection'&&!write){requireRole(user,['admin','engineer']);return {connection:db.protocolConnection,active:protocolOn(),status:protocol.status()};}
  if(p==='/api/ops/protocol/connection'&&write){
   requireRole(user,['admin','engineer']);
   const host=String(body.host||'').trim(),port=Number(body.port);
   if(!/^[a-zA-Z0-9.:-]{1,200}$/.test(host)||!Number.isInteger(port)||port<1||port>65535)fail('请填写有效主机和端口。');
   const probe=createProtoforge({host,port});await probe.poll({readOnly:true});const result=probe.status();
   if(body.action==='save'){
    if(protocolOn()&&protocol.states().some(s=>s.mode==='running'))fail('请先暂停产线，再修改通信连接。',409);
    if(result.online!==result.total)fail('设备未全部在线，未替换现有连接。',409);
    db.protocolConnection={host,port};protocol=probe;db.auto.enabled=false;log(user,'保存 Modbus 连接',host+':'+port);save();
   }else if(body.action!=='test')fail('无效操作');
   return {connection:{host,port},status:result,saved:body.action==='save'};
  }
  if(p==='/api/ops/assets/placement'&&write){
   requireRole(user,['admin','engineer']);const asset=db.assets.find(a=>a.id===body.id);if(!asset||(!asset.modelUrl&&asset.id!=='asset-'+asset.stageIndex))fail('请先上传设备 GLB 模型。');
   const v=body.placement;if(!v||typeof v.enabled!=='boolean')fail('场景配置无效');
   for(const key of ['x','y','z','rotation','scale','baseRate'])if(typeof v[key]!=='number'||!Number.isFinite(v[key]))fail('位置、角度及倍率必须是数值');
   if(['x','y','z'].some(k=>Math.abs(v[k])>100)||Math.abs(v.rotation)>360||v.scale<.001||v.scale>100||v.baseRate<=0||v.baseRate>10000)fail('场景参数超出范围');
   const d=protocol.status().devices.find(d=>d.id===v.deviceId);
   if(v.deviceId&&(!d||![v.runPoint,v.ratePoint].filter(Boolean).every(k=>d.points.some(p=>p.name===k))))fail('绑定设备或点位无效');
   if(v.animationName!==undefined&&(typeof v.animationName!=='string'||v.animationName.length>150))fail('动画片段名称无效');
   asset.placement={animationName:v.animationName||'',enabled:v.enabled,x:v.x,y:v.y,z:v.z,rotation:v.rotation,scale:v.scale,baseRate:v.baseRate,deviceId:v.deviceId||'',runPoint:v.runPoint||'',ratePoint:v.ratePoint||''};asset.updatedAt=now();asset.version++;log(user,'保存产线模型摆放',asset.code);save();return asset;
  }
  if(p==='/api/ops/connections'&&!write){requireRole(user,['admin','engineer']);return {items:db.connections.map(c=>({...c,...connectionStatus(c,db.telemetry[c.stageIndex],!!env.TELEMETRY_TOKEN,db.dataMode)})),tokenConfigured:!!env.TELEMETRY_TOKEN,mode:db.dataMode};}
  if(p==='/api/ops/connections'&&write){
   requireRole(user,['admin']);const index=body.stageIndex,previous=db.connections[index];
   if(!Number.isInteger(index)||index<0||index>8)fail('工序无效。');
   const next=validateConnection(body,previous);
   if(db.connections.some((c,i)=>i!==index&&c.deviceId===next.deviceId))fail('设备编号已绑定其他工序。');
   if(next.enabled&&!env.TELEMETRY_TOKEN)fail('请先在服务端配置 TELEMETRY_TOKEN，再启用接收。');
   db.connections[index]=next;delete db.telemetry[index];
   log(user,'保存设备接入配置',`${stages[index].name} / ${next.deviceId} / ${next.protocol} / ${next.enabled?'接收启用':'接收停用'}；未连接或控制硬件`,'成功',{category:'system',stageIndex:index,before:previous,after:next});
   recordSources();return next;
  }
  if(p==='/api/ops/connections/diagnose'&&write){requireRole(user,['admin','engineer']);const c=db.connections[body.stageIndex];if(!Number.isInteger(body.stageIndex)||!c)fail('工序无效。');const result=connectionStatus(c,db.telemetry[c.stageIndex],!!env.TELEMETRY_TOKEN,db.dataMode);log(user,'设备接入本地诊断',`${c.deviceId} / ${result.status}；仅检查配置与最近接收记录，未向设备发包`,'成功',{stageIndex:c.stageIndex});return result;}
  if(p==='/api/ops/data-mode'&&write){
   requireRole(user,['admin']);if(protocolOn()&&body.mode!==db.dataMode)fail('请先暂停协议设备并退出 ProtoForge 接入。');if(!['simulation','real','mixed'].includes(body.mode))fail('请选择有效的数据模式。');
   const indices=body.realStages||[];if(!Array.isArray(indices)||indices.some(i=>!Number.isInteger(i)||i<0||i>8))fail('真实工位范围无效。');

   if(body.mode!==db.dataMode){
    const transport=logistics().jobs.find(j=>['running','waiting'].includes(j.status));if(transport){transport.status='paused';log(user,'物流任务暂停','切换数据模式，保留车辆与货物位置','成功',{category:'task',after:transport});}
    db.profiles[db.dataMode]=Object.fromEntries(runtimeKeys.map(k=>[k,structuredClone(db[k])]));
    const previousMode=db.dataMode;db.dataMode=body.mode;db.realStages=[];
    const defaults={...initial(),telemetry:{},materialFlow:null};const saved=db.profiles[db.dataMode];for(const k of runtimeKeys)db[k]=structuredClone(saved?.[k]??defaults[k]);
    if(!saved){db.produced=0;db.completed=0;db.bottles=0;db.liquid=0;db.states=db.states.map(s=>({...s,mode:'stopped',value:0,rate:0,history:[]}));}
    db.auto.enabled=false;
    for(const c of db.safetyCases.filter(c=>c.phase!=='resolved')){const spec=scenarioById(c.id);if(spec?.action)log(user,'设施联动演示结束',spec.title+' / 切换数据模式，退出模拟联动','成功',{category:'control',stageIndex:spec.stageIndex,after:{simulation:true,reason:'data-mode-change'}});}
    db.telemetry={};db.sourceStates={};db.safetyCases=[];
    if(!activeTask())db.states=db.states.map(s=>({...s,mode:'stopped',rate:0}));
    log(user,'切换数据模式',previousMode+' → '+db.dataMode,'成功',{realStages:db.realStages});
   }return snapshot();
  }
  if(p==='/api/ops/telemetry'&&write){
   const provided=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,'')),expected=Buffer.from(env.TELEMETRY_TOKEN||'');
   if(!expected.length||provided.length!==expected.length||!timingSafeEqual(provided,expected))fail('遥测网关认证失败。',401);
   if(body.mode!==db.dataMode||db.dataMode==='simulation')fail('遥测模式与当前运行模式不一致。',409);
   if(body.origin!=='physical')fail('真实入口仅接收实体设备数据；协议模拟请使用模拟模式。');
   const i=body.stageIndex,t=Date.parse(body.timestamp);if(!Number.isInteger(i)||i<0||i>8||!db.connections[i].enabled||db.connections[i].protocol!=='http')fail('请在运营管理的设备接入中启用标准遥测接收。');
   if(body.deviceId!==db.connections[i].deviceId)fail('设备编号与工序绑定不匹配。',403);
   if(!Number.isFinite(t)||Math.abs(Date.now()-t)>15000||t<=(db.telemetry[i]?.sampleTime||0))fail('数据过期、重复或乱序。',409);
   if(!Number.isFinite(body.value)||!Number.isFinite(body.rate)||body.rate<0||!['running','stopped','warning','fault'].includes(body.state)||typeof body.deviceId!=='string'||!body.deviceId.trim()||body.deviceId.length>100)fail('遥测字段无效。');
   const measurements={};
   if(body.measurements!==undefined){
    if(!body.measurements||typeof body.measurements!=='object'||Array.isArray(body.measurements))fail('遥测附加点位格式无效。');
    for(const [key,value] of Object.entries(body.measurements)){
     const c=capabilities.find(c=>c.stageIndex===i&&c.id===key);if(c)validate(c,value);else if(!secondaryMetrics[i].some(m=>m.id===key))fail('未知遥测附加点位。');measurements[key]=value;
    }
   }
   const feedback=validateStationFeedback(i,body);
   db.telemetry[i]={...feedback,measurements,value:body.value,rate:body.rate,mode:body.state,deviceId:body.deviceId,receivedAt:Date.now(),sampleTime:t,history:[...(db.telemetry[i]?.history||[]).slice(-15),body.value]};
   db.updated=Date.now();log({name:body.deviceId},'真实设备采样',stages[i].name,'成功',{category:'telemetry',stageIndex:i,after:{...db.telemetry[i]}});recordSources();return {ok:true};
  }
  if(p==='/api/ops/logs'&&!write){url.searchParams.set('mode',db.dataMode);return storage.logs(url.searchParams);}
  if(p==='/api/ops/tasks'&&!write){const view=url.searchParams.get('view');return {items:db.tasks.filter(taskVisible).filter(t=>view==='deleted'?!!t.deletedAt:view==='archived'?!!t.archivedAt&&!t.deletedAt:!t.deletedAt&&!t.archivedAt)};}
  if(p==='/api/ops/state'&&!write)return snapshot();
  if(p.startsWith('/api/ops/standard/')){const action=p.split('/').pop();if(!write&&action!=='list')fail('需要 POST 请求。',405);if(['extract','audit'].includes(action))fail('请通过 AI 提取接口提交。',403);return standard(user).route(action,body);}
  if(['/api/ops/management','/api/ops/formulas','/api/ops/strategies','/api/ops/material-usage'].includes(p)){if(p!=='/api/ops/management'&&!write)fail('需要 POST。',405);return managementRoute({db,p,body,write,user,requireRole,log});}
  if(p==='/api/ops/context'&&!write)return {user,roles,roleSettings:db.roleSettings,employees:db.employees,capabilities,controls:activeControls(),protocol:protocolOn()?protocol.status():{enabled:false},auto:db.auto,interlock:db.interlock,lastDecision:db.lastDecision,products:db.products,assets:db.assets,materials:db.materials,documents:db.documents,audit:db.audit,tasks:db.tasks.filter(t=>taskVisible(t)&&!t.deletedAt&&!t.archivedAt),alerts:db.alerts.filter(a=>a.ruleId?a.dataMode===db.dataMode:db.dataMode==='simulation'),preferences:db.preferences,connectionStates:db.connections.map(c=>connectionStatus(c,db.telemetry[c.stageIndex],!!env.TELEMETRY_TOKEN,db.dataMode)),storage:'MySQL',simulation:db.dataMode==='simulation',dataMode:db.dataMode,realStages:db.realStages,lineMode:lineMode(),activeTask:activeTask()};
  if(p==='/api/ops/tasks'&&write){
   requireRole(user,['admin','engineer']);const action=body.action||'create',old=db.tasks.find(t=>t.id===body.id);if(action!=='create'&&(!old||!taskVisible(old)))fail('任务不存在。',404);if(old&&body.version!==old.version)fail('任务已被其他人修改，请关闭后重新打开。',409);
   const before=old?{...old}:null;
   if(action==='create'||action==='update'){
    if(old&&(old.deletedAt||!['待排程','排程中'].includes(old.status)))fail('仅未开始的任务可编辑。',409);
    const f=body.task||{};if(typeof f.name!=='string'||!f.name.trim()||f.name.length>60||!['500 mL · 12 瓶 / 箱','350 mL · 24 瓶 / 箱'].includes(f.spec)||!Number.isInteger(f.plan)||f.plan<1||f.plan>100000||typeof f.owner!=='string'||!f.owner.trim()||f.owner.length>40||!['常规','优先'].includes(f.priority))fail('请填写有效的产品、规格、计划数量和负责人。');
    if(!/^\d{2}:\d{2}$/.test(f.start||'')||!/^\d{2}:\d{2}$/.test(f.end||'')||f.start>=f.end||Number(f.end.slice(0,2))>23||Number(f.start.slice(0,2))>23||Number(f.start.slice(3))>59||Number(f.end.slice(3))>59)fail('计划结束时间须晚于开始时间（同一天）。');
    const task={...(old||{}),dataMode:db.dataMode,id:old?.id||'MO-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID().slice(0,8),name:f.name.trim(),spec:f.spec,plan:f.plan,owner:f.owner.trim(),priority:f.priority,start:f.start,end:f.end,line:'当前产线',done:old?.done||0,status:old?.status||'待排程',version:(old?.version||0)+1,createdAt:old?.createdAt||now(),updatedAt:now(),deletedAt:null,archivedAt:null};
    if(old)db.tasks[db.tasks.indexOf(old)]=task;else db.tasks.unshift(task);log(user,old?'编辑生产任务':'新建生产任务',task.id+' / '+task.name,'成功',{category:'task',before,after:task});return task;
   }
   if(action==='schedule'){if(old.deletedAt||old.archivedAt||old.status!=='待排程')fail('只能排程待排程任务。',409);old.status='排程中';}
   else if(action==='confirmSchedule'){if(old.deletedAt||old.archivedAt||old.status!=='排程中')fail('只能确认排程中的任务。',409);old.status='已排程';}
   else if(action==='start'||action==='dispatch'){if(db.dataMode==='real')fail('真实模式尚未配置设备命令网关，不能确认下发成功。',409);if(old.deletedAt||old.archivedAt||old.status!=='待生产')fail('只能下发待生产任务。',409);if(activeTask())fail('已有生产中任务，请先完成或取消当前任务。',409);old.status='生产中';db.materialFlow=createMaterialFlow(old);db.states=db.states.map((s,i)=>({...s,mode:s.mode==='fault'?'fault':'running',rate:s.mode==='fault'?0:stages[i].rate}));if(db.auto.enabled)pause();}
   else if(action==='release'){if(old.deletedAt||old.archivedAt||old.status!=='已排程')fail('只能转入待生产的已排程任务。',409);old.status='待生产';}
   else if(action==='cancel'){if(old.deletedAt||old.archivedAt||!['待排程','排程中','已排程','待生产','暂停中'].includes(old.status))fail('仅未开始或已暂停的任务可以取消。',409);const wasActive=activeTask()?.id===old.id;if(wasActive)pause();old.status='已取消';}
   else if(action==='archive'){if(old.deletedAt||old.archivedAt)fail('任务已不在有效列表。',409);if(['生产中','暂停中'].includes(old.status))fail('运行中的任务不能归档。',409);old.archivedAt=now();old.archiveType=body.archiveType==='abnormal'?'异常归档':'正常归档';}
   else if(action==='unarchive'){if(!old.archivedAt||old.deletedAt)fail('任务未归档。',409);old.archivedAt=null;}
   else if(action==='delete'){if(old.deletedAt||['生产中','暂停中'].includes(old.status))fail('运行中的任务不能删除。',409);if(body.confirmed!==true)fail('请确认删除任务。');old.deletedAt=now();old.archivedAt=null;old.deleteStatus='待彻底删除';}
   else if(action==='purge'){if(!old.deletedAt)fail('只能彻底删除垃圾箱中的任务。',409);if(body.confirmed!==true)fail('请确认彻底删除。');log(user,'彻底删除任务',old.id+' / '+old.name+(db.dataMode==='mixed'?'；仅启动模拟工位，真实工位只读遥测':''),'成功',{category:'task',before,after:{purged:true}});db.tasks=db.tasks.filter(t=>t.id!==old.id);storage.removeTask(old.id);return {id:old.id,purged:true};}
   else if(action==='restore'){if(!old.deletedAt)fail('任务未被删除。');old.deletedAt=null;old.archivedAt=null;}
   else fail('不支持的任务动作。');
   old.updatedAt=now();old.version++;log(user,({schedule:'进入排程中',confirmSchedule:'确认已排程',release:'转入待生产',start:'开始生产',dispatch:'下发并启动生产',cancel:'取消任务',archive:'归档任务',unarchive:'取消归档',delete:'移入垃圾箱',restore:'恢复任务'})[action],old.id+' / '+old.name+(db.dataMode==='mixed'?'；仅启动模拟工位，真实工位只读遥测':''),'成功',{category:'task',before,after:{...old}});return old;
  }
  if(p==='/api/ops/alerts/resolve'&&write){requireRole(user,['admin','engineer','operator']);const a=db.alerts.find(x=>x.id===body.id);if(!a)fail('异常不存在。',404);if(a.done)fail('异常已处理，请刷新。',409);if(a.ruleId)fail('阈值告警仍在触发；请恢复对应参数或读数，系统自动记录恢复。',409);const i=stages.findIndex(s=>s.name===a.stage);if(hasRole(user,'operator')&&!user.stages.includes(i))fail('无此工位的处理权限。',403);const before={...a};a.done=true;a.resolvedAt=now();a.resolvedBy=user.name;log(user,'处理异常',a.title,'成功',{stageIndex:i>=0?i:null,before,after:{...a}});return a;}
  if(p==='/api/ops/assets'&&write){
   requireRole(user,['admin','engineer']);const old=db.assets.find(a=>a.id===body.id);
   if(body.id&&!old)fail('设备资产不存在。',404);if(old&&body.version!==old.version)fail('设备已更新，请重新打开。',409);
   if(body.action==='delete'){if(!old)fail('请选择设备。');if(body.confirmed!==true)fail('请确认删除资产。');db.assets=db.assets.filter(a=>a.id!==old.id);log(user,'删除设备资产',old.name,'成功',{before:old});return {ok:true};}
   for(const k of ['name','code'])if(typeof body[k]!=='string'||!body[k].trim()||body[k].length>100)fail('请填写有效的设备名称和编号。');
   if(!Number.isInteger(body.stageIndex)||body.stageIndex<0||body.stageIndex>8)fail('请选择所属工序。');
   if(db.assets.some(a=>a.id!==old?.id&&a.code===body.code.trim()))fail('设备编号已存在。');
   let modelUrl=old?.modelUrl||'',modelName=old?.modelName||'';
   if(body.removeModel){modelUrl='';modelName='';}
   if(body.modelData){
    if(typeof body.modelData!=='string'||body.modelData.length>28000000||!/^data:application\/octet-stream;base64,[A-Za-z0-9+/=]+$/.test(body.modelData))fail('模型文件无效或超过 20 MB。');
    const bytes=Buffer.from(body.modelData.split(',')[1],'base64');
    if(bytes.length<12||bytes.length>20*1024*1024||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)fail('请上传有效的 GLB 2.0 模型（可包含动画）。');
    const dir=path.resolve('public/uploads/equipment');fs.mkdirSync(dir,{recursive:true});const filename=randomUUID()+'.glb';fs.writeFileSync(path.join(dir,filename),bytes);modelUrl='/uploads/equipment/'+filename;modelName=String(body.modelName||'设备模型.glb').slice(0,150);
   }
   const imageUrl=body.imageUrl??old?.imageUrl??'';if(typeof imageUrl!=='string'||imageUrl.length>2000000||(imageUrl&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$|^\/(?!\/)/.test(imageUrl)))fail('图片请使用 PNG/JPEG/WebP，最大 1.4 MB。');const item={placement:old?.placement,imageUrl,modelUrl,modelName,id:old?.id||randomUUID(),version:(old?.version||0)+1,name:body.name.trim(),code:body.code.trim(),stageIndex:body.stageIndex,enabled:body.enabled!==false,note:String(body.note||'').slice(0,2000),updatedAt:now()};
   if(old)db.assets[db.assets.indexOf(old)]=item;else db.assets.push(item);log(user,old?'修改设备资产':'新增设备资产',item.name,'成功',{before:old||null,after:item});return item;
  }
  if(['/api/ops/products','/api/ops/materials'].includes(p)&&write){
   requireRole(user,['admin','engineer']);const key=p.endsWith('products')?'products':'materials',list=db[key],old=list.find(x=>x.id===body.id);
   if(body.id&&!old)fail('资源不存在。',404);if(old&&body.version!==old.version)fail('资源已更新，请重新打开。',409);
   if(body.action==='delete'){if(!old)fail('请选择资源。');if(key==='materials'&&(db.formulas||[]).some(f=>f.ingredients.some(i=>i.materialId===old.id)))fail('该物料被产品配方引用，请先调整配方或停用物料。',409);list.splice(list.indexOf(old),1);log(user,'删除资源',old.name,'成功',{before:old});return {ok:true};}
   const str=(k,max=500)=>{const v=body[k]??'';if(typeof v!=='string'||v.length>max)fail('字段无效：'+k);return v.trim();};
   const name=str('name',60),category=str('category',40);if(!name||!category)fail('请填写名称和种类。');if(list.some(x=>x.id!==old?.id&&x.name===name))fail('名称已存在。');
   const item={id:old?.id||randomUUID(),name,category,version:(old?.version||0)+1,updatedAt:now(),enabled:body.enabled!==false};
   if(key==='products'){
    const asset=k=>{const v=str(k,1500);if(v&&!/^\/(?!\/)|^https?:\/\//i.test(v))fail('素材须为站内路径或 HTTP(S) 地址。');return v;};
    Object.assign(item,{flavor:str('flavor',120),description:str('description',3000),ingredients:str('ingredients',1500),spec:str('spec',120),aliases:str('aliases',300).split(/[,，]/).map(v=>v.trim()).filter(Boolean),recipeId:str('recipeId',100),modelUrl:asset('modelUrl'),backgroundUrl:asset('backgroundUrl'),modelSource:asset('modelSource'),modelNote:str('modelNote',300),backgroundNote:str('backgroundNote',300)});
    const documentIds=body.documentIds??old?.documentIds??[];
    if(!Array.isArray(documentIds)||documentIds.length>100||documentIds.some(id=>typeof id!=='string'||!db.documents.some(d=>d.id===id)))fail('请选择有效的关联文档。');
    item.documentIds=[...new Set(documentIds)];
    if(item.recipeId&&!db.documents.some(d=>d.id===item.recipeId&&d.kind==='recipe'&&d.status==='published'))fail('请选择已发布配方。');
    if(item.modelUrl&&!/\.glb(?:[?#]|$)/i.test(item.modelUrl))fail('模型请使用 GLB 文件。');
    if(old&&old.name!==name&&!item.aliases.includes(old.name))item.aliases.push(old.name);const names=[name,...item.aliases];if(list.some(x=>x.id!==old?.id&&[x.name,...(x.aliases||[])].some(n=>names.includes(n))))fail('名称或任务别名已被其他产品使用。');
   }else{const productIds=body.productIds??old?.productIds??[];if(!Array.isArray(productIds)||productIds.some(id=>!db.products.some(p=>p.id===id)))fail('关联产品无效。');item.productIds=[...new Set(productIds)];const quantity=Number(body.quantity),minimum=Number(body.minimum);if(!Number.isFinite(quantity)||quantity<0||!Number.isFinite(minimum)||minimum<0)fail('数量须为非负数。');Object.assign(item,{unit:str('unit',20),quantity,minimum,note:str('note',1000)});if(!item.unit)fail('请填写单位。');}
   if(old)list[list.indexOf(old)]=item;else list.push(item);log(user,old?'更新资源':'新增资源',name,'成功',{before:old||null,after:item});return item;
  }
  if(p==='/api/ops/cameras'&&write){requireRole(user,['admin','engineer']);let sources;try{sources=validateCameraSources(body.items);}catch(e){fail(e.message);}db.preferences.cameraSources=[...(db.preferences.cameraSources||[]).filter(s=>!sources.some(c=>c.id===s.id)),...sources];log(user,'修改相机画面接口','四路实际相机地址','成功');save();return {items:sources};}
  if(p==='/api/ops/preferences'&&write){for(const k of ['dense','notifications'])if(typeof body[k]==='boolean')db.preferences[k]=body[k];log(user,'显示设置变更','工作区显示与通知偏好','成功',{after:{...db.preferences}});return db.preferences;}
  if(p==='/api/ops/events'&&write){
   const labels={page:'打开页面',view:'切换视图',station:'切换工位',theme:'切换主题',export:'导出任务',read:'查看任务'};
   if(!labels[body.type]||typeof body.detail!=='string'||body.detail.length>160)fail('界面事件无效。');
   if(body.stageIndex!==undefined&&(!Number.isInteger(body.stageIndex)||body.stageIndex<0||body.stageIndex>8))fail('工位无效。');
   log(user,labels[body.type],body.detail,'成功',{category:body.type==='export'||body.type==='read'?'task':'interface',stageIndex:body.stageIndex??null});return {ok:true};
  }
  if(p==='/api/ops/session'&&write){const next=db.employees.find(e=>e.id===body.id&&e.enabled);if(!next)fail('该演示身份不可用。');res.setHeader('Set-Cookie',`bw_demo_actor=${encodeURIComponent(next.id)}; HttpOnly; SameSite=Strict; Path=/`);log(user,'切换演示身份',next.name);return {ok:true};}
  if(p==='/api/ops/employees'&&write){requireRole(user,['admin']);const employeeRoles=Array.isArray(body.roles)?[...new Set(body.roles)]:[body.role];if(typeof body.name!=='string'||!body.name.trim()||body.name.length>40||!employeeRoles.length||employeeRoles.some(r=>!roles[r])||!Array.isArray(body.stages)||body.stages.some(x=>!Number.isInteger(x)||x<0||x>8)||typeof body.enabled!=='boolean')fail('请填写姓名、有效工种和工位范围。');const old=db.employees.find(e=>e.id===body.id),before=old?structuredClone(old):null;if(old?.id==='admin'&&(!employeeRoles.includes('admin')||!body.enabled))fail('本机管理员须保持管理员且启用。');const employee={id:old?.id||randomUUID(),name:body.name.trim(),roles:employeeRoles,role:employeeRoles[0],stages:[...new Set(body.stages)],enabled:body.enabled};if(old)Object.assign(old,employee);else db.employees.push(employee);log(user,old?'更新员工':'新增员工',`${employee.name} / ${employeeRoles.map(r=>roles[r]).join('、')} / 工位 ${employee.stages.map(x=>x+1).join(',')}`,'成功',{before,after:employee});return employee;}
  if(p==='/api/ops/role-settings'&&write){requireRole(user,['admin']);if(!body.role||!db.roleSettings[body.role]||typeof body.description!=='string'||body.description.length>200)fail('工种权限配置无效。');db.roleSettings[body.role]={...db.roleSettings[body.role],description:body.description.trim(),canControl:Boolean(body.canControl),canReview:Boolean(body.canReview)};log(user,'工种权限配置',roles[body.role],'成功',{after:db.roleSettings[body.role]});return db.roleSettings[body.role];}
  if(p==='/api/ops/process-retire'&&write){requireRole(user,['admin','engineer']);const d=db.documents.find(x=>x.id===body.id&&x.kind==='recipe');if(!d||d.version!==body.version)fail('工艺版本已变化。',409);if(body.confirmed!==true)fail('请确认停用工艺。');if(activeTask()&&db.activeProduct===d.productCode)fail('当前任务正在使用该产品，请先完成或取消任务。',409);d.status='retired';for(const product of db.products)if(product.recipeId===d.id){product.recipeId='';product.version++;}log(user,'停用产品工艺',d.title,'成功',{after:d});return d;}
  if(p==='/api/ops/documents'&&write){requireRole(user,['admin','engineer']);if(typeof body.title!=='string'||!body.title.trim()||body.title.length>120||typeof body.content!=='string'||!body.content.trim()||body.content.length>300000)fail('资料须含标题和正文，正文最多 30 万字符。');if(body.kind==='recipe'){if(!/^[A-Za-z0-9_-]{1,40}$/.test(body.productCode||'')||!body.settings||!Object.keys(body.settings).length)fail('配方需要产品编码和设备参数。');for(const [id,v]of Object.entries(body.settings)){const c=capabilities.find(c=>c.id===id);validate(c,v);if(!['NUMBER','TEXT'].includes(c.type))fail('配方仅允许数值或库位参数，不包含启动、剔除等动作。');}}
   const old=db.documents.find(d=>d.id===body.id);if(old?.standardId)fail('标准配方请在标准数据中创建修订。',409);if(old){db.documentHistory??=[];db.documentHistory.push(structuredClone(old));}const doc={id:old?.id||randomUUID(),title:body.title.trim(),content:body.content,kind:body.kind==='recipe'?'recipe':'document',status:'pending',version:(old?.version||0)+1,owner:user.name,updated:now(),...(body.kind==='recipe'?{productCode:body.productCode,productName:body.title,settings:body.settings}:{})};if(old)db.documents[db.documents.indexOf(old)]=doc;else db.documents.unshift(doc);log(user,'提交知识审核',doc.title);return doc;}
  if(p==='/api/ops/review'&&write){requireRole(user,['admin','engineer']);const d=db.documents.find(d=>d.id===body.id);if(!d||d.status!=='pending'||!['published','rejected'].includes(body.status))fail('请选择待审核资料。');if(body.status==='published'&&d.kind==='recipe'&&db.documents.some(x=>x.id!==d.id&&x.kind==='recipe'&&x.productCode===d.productCode&&x.status==='published'))fail('该产品已有已发布配方，请编辑已有版本，避免多个生效版本。');d.status=body.status;d.reviewer=user.name;d.updated=now();log(user,'知识审核',`${d.title} / ${body.status}`);return d;}
  if((p==='/api/ops/control'||p==='/api/ops/protocol/control')&&write){if(p==='/api/ops/protocol/control'&&!protocolOn())fail('协议数据源未启用，未发送指令。',409);const c=capabilities.find(c=>c.id===body.id);if(!c)fail('未知设备控制。');if(!canControl(user,c.stageIndex)||(c.role==='ENGINEER'&&!['admin','engineer'].includes(user.role)))fail('当前角色或工位范围不允许此控制。',403);validate(c,body.value);if(body.confirmed!==true)fail('请确认控制内容。');if(c.reason&&(!body.reason||String(body.reason).trim().length<2))fail('该操作需要填写原因。');if(db.interlock&&body.value!=='PAUSED')fail('安全联锁已触发，请先排查并人工解除。',409);db.auto.enabled=false;const before=activeControls()[c.id];if(protocolOn()){const result=await protocol.control(c,body.value);log(user,'人工协议设备控制',c.label+'：'+before+' → '+result.value+' / '+result.message,'成功',{stageIndex:c.stageIndex,device:c.device,before:{value:before},after:result});return {ok:true,message:result.message,snapshot:snapshot()};}setControl(c,body.value);log(user,'人工设备控制',`${c.device} ${c.label}: ${before} → ${body.value}；${body.reason||'人工确认'}；自动调参已关闭`,'成功',{stageIndex:c.stageIndex,device:c.device,before:{value:before},after:{value:body.value}});return {ok:true,message:'虚拟设备已确认',snapshot:snapshot()};}
  if(p==='/api/ops/line-control'&&write){
   requireRole(user,['admin','engineer','operator']);
   if(!stages.every((_,i)=>canControl(user,i)))fail('整线控制需要全部工位的操作权限。',403);
   if(db.dataMode!=='simulation')fail('整线控制尚未接入实体命令网关。',409);
   if(body.confirmed!==true||!['resume','pause','supply'].includes(body.action))fail('请确认有效的整线操作。');
   if(protocolOn()){
    if(body.action==='supply')fail('协议设备未接入库存，不能补造物料');
    await protocol.poll();const receipts=await Promise.all(stages.map(async(_,i)=>{try{await protocol.stageCommand(i,body.action==='resume');return {stageIndex:i,ok:true};}catch(e){return {stageIndex:i,ok:false,error:e.message};}}));
    await protocol.poll();log(user,'协议整线'+(body.action==='resume'?'启动':'暂停'),JSON.stringify(receipts),receipts.every(r=>r.ok)?'成功':'部分失败',{category:'control',after:{receipts}});return {...snapshot(),receipts};
   }
   const task=activeTask(),volume=Number(db.controls['FIL-HEAD-01:fillVolume'])/1000;
   if(body.action==='supply'){
    if(!task)fail('没有需要补料的生产任务。',409);
    if(lineMode()==='running')fail('请先暂停整线再补充模拟物料。',409);
    if(!(volume>0))fail('请先设定有效灌装量。',409);
    const before={bottles:db.bottles,liquid:db.liquid},remaining=Math.max(0,task.plan-task.done);
    db.bottles=Math.max(db.bottles,remaining);db.liquid=Math.max(db.liquid,Number((remaining*volume).toFixed(3)));
    log(user,'补充模拟物料',`${task.name} / 补齐剩余 ${remaining} 瓶所需物料；仅模拟库存`,'成功',{category:'control',before,after:{bottles:db.bottles,liquid:db.liquid}});return snapshot();
   }
   if(body.action==='resume'){
    if(!task)fail('暂无已下发的生产任务，请先在任务管理下发任务。',409);
    if(db.interlock||safetyHolds(db.safetyCases).length)fail('请先排除异常并复位安全联锁。',409);
    if(db.states.some(s=>s.mode==='fault'))fail('仍有故障工位，请先处理故障。',409);
    const alarms=evaluateAlarms({states:currentStates().map(s=>({...s,mode:'running'})),controls:db.controls});
    if(alarms.some(a=>a.level==='critical'))fail('仍有严重告警，请先恢复对应参数或读数。',409);
    if(!(volume>0)||db.bottles<1||db.liquid<volume)fail('模拟物料不足，请先补充瓶体与料液。',409);
   }
   const running=body.action==='resume',before={lineMode:lineMode(),taskStatus:task?.status};
   db.auto.enabled=false;
   for(let i=0;i<stages.length;i++){
    const previous={...db.states[i]};
    db.states[i].mode=!running&&previous.mode==='fault'?'fault':running?'running':'stopped';db.states[i].rate=running?stages[i].rate:0;
    for(const c of capabilities.filter(c=>c.stageIndex===i&&c.command==='SET_RUN_STATE'&&c.control!=='cameraState'))db.controls[c.id]=running?'RUNNING':'PAUSED';
    log(user,running?'整线恢复运行':'整线人工暂停',`${stages[i].name} / ${task?.name||'无任务'}；人工接管`,'成功',{category:'control',stageIndex:i,before:previous,after:{...db.states[i]}});
   }
   for(const job of logistics().jobs){
    if(!running&&['running','waiting'].includes(job.status)){job.status='paused';job.pausedByLine=true;}
    else if(running&&job.status==='paused'&&job.pausedByLine){job.status='running';delete job.pausedByLine;}
   }
   if(task){task.status=running?'生产中':'暂停中';task.version++;task.updatedAt=now();}
   db.updated=Date.now();log(user,running?'整线恢复运行':'整线人工暂停',`${task?.name||'无任务'} / 全部九工位；自动调参已关闭`,'成功',{category:'control',before,after:{lineMode:lineMode(),taskStatus:task?.status}});
   return snapshot();
  }
  if(p==='/api/ops/mode'&&write){const i=body.index;if(isReal(i))fail('真实工位不能通过演示按钮改写状态。',409);if(!Number.isInteger(i)||i<0||i>8||!canControl(user,i))fail('无此工位的操作权限。',403);if(!['running','stopped','warning','fault'].includes(body.mode))fail('状态无效。');if(db.interlock&&body.mode==='running')fail('安全联锁未解除。',409);if(protocolOn()){if(!['running','stopped'].includes(body.mode))fail('协议模式只允许启停');await protocol.stageCommand(i,body.mode==='running');await protocol.poll();log(user,'协议工位启停',stages[i].name+' / '+body.mode,'成功',{stageIndex:i});return snapshot();}const before={...db.states[i]};db.auto.enabled=false;db.states[i].mode=body.mode;db.states[i].rate=['stopped','fault'].includes(body.mode)?0:stages[i].rate;db.updated=Date.now();log(user,'工位状态变更',`${stages[i].name} → ${body.mode}`,'成功',{stageIndex:i,before,after:{...db.states[i]}});return snapshot();}
  if(p==='/api/ops/auto'&&write){if(db.dataMode!=='simulation'&&body.enabled)fail('真实或混合模式尚未接入自动控制网关。',409);requireRole(user,['admin','engineer']);if(typeof body.enabled!=='boolean'||![.9,.95,.99].includes(body.minConfidence))fail('自动模式配置无效。');if(db.interlock&&body.enabled)fail('请先排查安全联锁。');if(body.enabled&&hasRole(user,'engineer')&&!hasRole(user,'admin')&&user.stages.length!==9)fail('开启全线自动调参需要全部工位权限。',403);db.auto={...db.auto,enabled:body.enabled,minConfidence:body.minConfidence};log(user,'自动调参设置',body.enabled?'开启（仅虚拟设备）':'关闭');return db.auto;}
  if(p==='/api/ops/recognize'&&write)return evaluate(body,user,'注入的摄像头识别演示事件');
  if(p==='/api/ops/unlock'&&write){requireRole(user,['admin','engineer']);if(!body.reason||String(body.reason).trim().length<2)fail('请填写已排查的情况。');db.interlock=false;db.auto.enabled=false;pause();log(user,'人工解除演示联锁',body.reason+'；保持暂停');return {ok:true};}
  fail('接口不存在。',404);
 }
 const executeProtocol=async(r,b,user)=>{
  await protocol.poll();
  if(protocol.status().online!==protocol.status().total)fail('协议设备未全部在线，未执行配方。',409);
  if(safetyHolds(protocol.cases()).length)fail('设备保护未解除，未执行配方。',409);
  const current=protocol.controls();
  // 先检查全部映射，再发送第一条指令，避免中途才发现不支持的库位。
  for(const f of r.fields){
   if(!Object.hasOwn(current,f.key))fail('配方缺少协议点位：'+f.key,409);
   const c=capabilities.find(c=>c.id===f.key);
   if(c.type==='TEXT'&&!['A-01-01','A-01-02','A-01-03'].includes(f.value))fail('协议库位不支持：'+f.value,409);
  }
  const before=Object.fromEntries(r.fields.map(f=>[f.key,current[f.key]])),operations=[];
  let failure=null;
  try{
   // 暂停反馈全部确认后才调参，换品不自动恢复产线。
   for(let i=0;i<stages.length;i++){await protocol.poll();await protocol.stageCommand(i,false);}
   await protocol.poll();
   for(const f of r.fields){
    const c=capabilities.find(c=>c.id===f.key),time=now();
    try{const receipt=await protocol.control(c,f.value);operations.push({id:f.key,title:'设置'+c.label,time,before:before[f.key],value:f.value,readback:receipt.value,unit:f.unit,basis:r.title+' / V'+r.version,result:'回读确认'});}
    catch(e){operations.push({id:f.key,title:'设置'+c.label,time,value:f.value,unit:f.unit,result:'未确认',error:e.message});throw e;}
   }
  }catch(e){failure=e.message;db.auto.enabled=false;}
  await protocol.poll();
  const after=Object.fromEntries(r.fields.map(f=>[f.key,protocol.controls()[f.key]??null]));
  const execution={id:randomUUID(),requestId:b.requestId,recordId:r.id,version:r.version,targetId:r.targetId,time:now(),status:failure?'failed_partial':'applied_paused',reason:failure?'执行未全部确认；停止自动调参，请检查设备：'+failure:'审核配方已写入 Modbus，逐项回读确认；全线保持暂停。',source:'protocol',actor:user.name,before,after,operations};
  if(!failure)db.activeProduct=r.targetId;
  db.standardExecutions.push(execution);
  db.lastDecision={id:execution.id,time:execution.time,productCode:r.targetId,status:failure?'review':'applied',source:'ProtoForge / Modbus TCP',reason:execution.reason,operations,recipe:{id:r.id,title:r.title,version:r.version,settings:after}};
  // 部分失败也保存证据，不把已经发出的设备写入伪装成数据库回滚。
  log(user,'AI 协议配方执行',execution.reason,failure?'部分失败':'成功',{category:'ai',before,after:execution});save();return execution;
 };
 const standard=user=>workflow({db,user,requireRole,log,capabilities,canControl,validate,setControl,pause,activeTask,executeProtocol});
 const callTool=(name,args,user)=>{
  requireRole(user,['admin','engineer']);
  const tool=standardTools.find(t=>t.name===name);if(!tool)fail('未知 MCP 工具。');
  const schema=tool.inputSchema;if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!Object.hasOwn(schema.properties,k))||(schema.required||[]).some(k=>!(k in args)))fail('工具参数无效。');
  if(name==='list_standard_data'){const records=standard(user).list().records;return records.filter(r=>!records.some(x=>x.kind===r.kind&&x.targetId===r.targetId&&x.version>r.version)).map(({id,kind,targetId,title,version,fields})=>({id,kind,targetId,title,version,fields}));}
  if(name==='get_execution')return (db.standardExecutions||[]).find(e=>e.requestId===args.requestId)||null;
  if(!db.auto.enabled)fail('请由工程师开启模拟自动调参。',409);
  if(!Number.isFinite(args.confidence)||args.confidence<db.auto.minConfidence||args.confidence>1)fail('识别置信度不足。',409);
  return standard(user).apply({...args,confirmed:true});
 };
 const route=(req,res,body)=>req.method==='GET'&&new URL(req.url,'http://localhost').pathname==='/api/ops/mg400'?Promise.resolve(readTestFeedback()||mg400.status()):atomic(()=>handleRoute(req,res,body));
 const holdFailure=reason=>{if(db.auto.enabled){pause();db.auto.enabled=false;log(null,'自动识别中断',reason+'；已暂停，转人工');for(let i=0;i<stages.length;i++)log(null,'AI 工位暂停',reason+'；已暂停，转人工','成功',{category:'ai',stageIndex:i,after:{execution:'已暂停，转人工'}});}};
 syncThresholdAlarms();save();
 log(null,'服务启动','MySQL 数据库已连接','成功',{source:'system'});
 await storage.flush();
 const close=async()=>{await manualMG400.stop();mg400.close();await atomic(()=>log(null,'服务停止','保存状态并关闭 MySQL','成功',{source:'system'}));await storage.close();};
 return {auditStandard:(body,user)=>atomic(()=>standard(user).route('audit',body)),callMcpTool:(name,args,user)=>atomic(()=>callTool(name,args,user)),extractStandard:(body,user)=>atomic(()=>standard(user).route('extract',body)),getAIConfig:storage.getAIConfig,setAIConfig:storage.setAIConfig,withRequest,close,holdFailure:(...args)=>atomic(()=>holdFailure(...args)),route,actor,requireRole,log:(...args)=>atomic(()=>log(...args)),snapshot,tick:()=>atomic(tick),retrieval,evaluate:(...args)=>atomic(()=>evaluate(...args)),recipes:()=>db.documents.filter(d=>d.kind==='recipe'&&d.status==='published'),save:()=>atomic(save)};
}
