import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createIntegrations,validateInspection,runCoze,cameraIds,commandLogMeta,createInferenceQueue,isBatchAlarmQuestion,runAlarmWorkflow} from './platform-integrations.mjs';
import {inspectDemo} from './vision-demo-server.mjs';
import {mapDevice} from './src/course-coding/deviceMapping.js';
import {advanceAnimation} from './src/course-coding/animationLink.js';
const image='data:image/png;base64,aGVsbG8=';
const input={requestId:'r1',bottleId:'b1',batchId:'batch1',images:cameraIds.map(cameraId=>({cameraId,data:image}))};
test('VIS-01: missing top => review; add top => pass; defect => reject',()=>{
 for(const [images,rejectCamera,expected] of [[input.images.slice(1),null,'review'],[input.images,null,'pass'],[input.images,'side-120','reject']]){
  const data={...input,images};const result=validateInspection(data,inspectDemo(data,{version:'demo',rejectCamera}));
  assert.equal(result.verdict,expected);assert.equal(result.demo,true);
 }
});
test('wrong bottle and incorrect whole-bottle verdict rejected',()=>{
 const r=inspectDemo(input,{version:'demo',rejectCamera:null});
 assert.throws(()=>validateInspection(input,{...r,bottleId:'wrong'}));
 assert.throws(()=>validateInspection({...input,images:[]},r));
 assert.throws(()=>validateInspection(input,{...r,cameras:[r.cameras[0],r.cameras[0]]}));
});
function mock(){
 let config={integrations:{coze:{enabled:true,baseUrl:'http://localhost:8888',workflowId:'wf',token:'private'},vision:{enabled:true,baseUrl:'http://localhost:8093',token:'private'},packages:[],records:[],commands:[]}},writes=0;
 const context={capabilities:[{id:'arm:rate',type:'NUMBER',min:1,max:20,label:'抓取节拍',unit:'瓶/min'}],controls:{'arm:rate':8},dataMode:'simulation',protocol:{enabled:false}};
 const ops={getAIConfig:async()=>structuredClone(config),setAIConfig:async c=>{config=structuredClone(c);},actor:r=>({id:r.headers.actor||'admin',role:r.headers.actor==='viewer'?'viewer':'admin'}),requireRole:(u,roles)=>{if(!roles.includes(u.role))throw Error('role denied');},log:async()=>{},route:async(req,res,body)=>{if(req.url==='/api/ops/context')return context;if(req.headers.actor==='viewer')throw Error('role denied');writes++;context.controls[body.id]=body.value;return {};}};
 const fetcher=async(url,options)=>({ok:true,json:async()=>url.endsWith('/inspect')?inspectDemo(JSON.parse(options.body),{version:'demo',rejectCamera:null}):{code:0,data:JSON.stringify({answer:'建议调整',tool_calls:[{name:'propose_change',arguments:{kind:'parameter',controlId:'arm:rate',value:12,reason:'用户要求'}}]})}});
 return {ops,fetcher,context,get writes(){return writes;}};
}
const req=(suffix,method='POST',actor='admin')=>({url:'/api/ai/integrations'+suffix,method,headers:{actor}});
test('camera discovery validates capture contract, builds stream addresses and denies viewers',async()=>{
 const m=mock();const integration=createIntegrations(m.ops,{fetcher:async url=>({ok:true,json:async()=>url.endsWith('/health')?{contract:'bottleworks-capture-v1'}:{devices:[{id:'0',name:'USB camera'},{id:'../bad',name:'invalid'}]}})});
 const r=await integration.route(req('/capture-discover'),{baseUrl:'http://localhost:8097'});
 assert.deepEqual(r.devices,[{id:'0',name:'USB camera',previewUrl:'http://localhost:8097/cameras/0/stream'}]);
 await assert.rejects(integration.route(req('/capture-discover','POST','viewer'),{baseUrl:'http://localhost:8097'}));
 const wrong=createIntegrations(m.ops,{fetcher:async()=>({ok:true,json:async()=>({contract:'other'})})});
 await assert.rejects(wrong.route(req('/capture-discover'),{baseUrl:'http://localhost:8097'}),/不是摄像头/);
});
test('global review is retained despite passing individual cameras; incomplete evidence cannot pass',()=>{
 const r=inspectDemo(input,{version:'demo',rejectCamera:null});
 assert.equal(validateInspection(input,{...r,verdict:'review',reason:'展开失败'}).verdict,'review');
 assert.throws(()=>validateInspection(input,{...r,coverageComplete:false}));
 assert.throws(()=>validateInspection(input,{...r,cap:{status:'review'}}));
 assert.throws(()=>validateInspection(input,{...r,panoramaUrl:'javascript:alert(1)'}));
});
test('legacy external job uses explicit status; simulation display never polls external inference',async()=>{
 const m=mock();const routes=[];
 const i=createIntegrations(m.ops,{fetcher:async(url,options)=>{
  routes.push(url);const job={jobId:'j1',batchId:'batch1',status:'running'};
  return {ok:true,json:async()=>url.endsWith('/health')?{contract:'bottleworks-vision-v1',capabilities:['inspection-jobs-v1']}:url.endsWith('/start')?job:url.endsWith('/stop')?{...job,status:'stopped'}:{...job,results:[inspectDemo(input,{version:'demo',rejectCamera:null})]}};
 }});
 await i.route(req('/config'),{kind:'vision',mode:'whole-bottle',baseUrl:'http://external',enabled:true,workflowId:'',version:'v1'});
 await i.route(req('/vision-job'),{action:'start',batchId:'batch1'});
 assert.equal((await i.route(req('','GET'),{})).visionJob.jobId,'j1');
 await i.route(req('/vision-job'),{action:'status'});
 const monitor=await i.route(req('/vision-monitor','GET','viewer'),{});
 assert.equal(monitor.records.length,1);assert.equal(monitor.records[0].bottleId,'b1');
 assert.equal(monitor.job.jobId,'j1');assert.ok(!JSON.stringify(monitor).includes('private'));
 const callsBefore=routes.length;
 await Promise.all([i.route(req('/vision-monitor','GET','viewer'),{}),i.route(req('/vision-monitor','GET','operator'),{})]);
 assert.equal(routes.length,callsBefore,'two displays reuse recent synchronization');
 await assert.rejects(i.route(req('/vision-job'),{action:'start',batchId:'batch1'}),/已有/);
 await i.route(req('/vision-job'),{action:'status'});await i.route(req('/vision-job'),{action:'status'});
 assert.equal((await i.route(req('','GET'),{})).records.length,1);
 assert.equal((await i.route(req('/vision-job'),{action:'stop'})).status,'stopped');
 const unsupported=createIntegrations(m.ops,{fetcher:async()=>({ok:true,json:async()=>({contract:'bottleworks-vision-v1'})})});
 await assert.rejects(unsupported.route(req('/vision-job'),{action:'start',batchId:'batch1'}),/尚未提供/);
});
test('Coze output contract and request body',async()=>{
 let sent;
 const r=await runCoze({enabled:true,baseUrl:'http://localhost',workflowId:'wf'},{question:'问'},async(u,o)=>{sent=JSON.parse(o.body);return {ok:true,json:async()=>({code:0,data:'{"answer":"答"}'})};});
 assert.equal(sent.workflow_id,'wf');assert.equal(r.answer,'答');
 await assert.rejects(runCoze({enabled:true,baseUrl:'http://localhost',workflowId:'wf'},{},async()=>({ok:true,json:async()=>({code:0,data:'not-json'})})));
});
test('suggestion needs confirmation; duplicate confirmation writes once; cancel writes nothing',async()=>{
 const m=mock(),i=createIntegrations(m.ops,{fetcher:m.fetcher});
 const a=await i.chat(req(''),'请调整抓取节拍到12',m.context);assert.equal(m.writes,0);
 const result=await i.route(req('/command'),{id:a.operation.id,action:'confirm'});assert.equal(result.status,'completed');assert.equal(m.writes,1);
 await i.route(req('/command'),{id:a.operation.id,action:'confirm'});assert.equal(m.writes,1);
 const b=await i.chat(req(''),'请调整抓取节拍到12',m.context);await i.route(req('/command'),{id:b.operation.id,action:'cancel'});assert.equal(m.writes,1);
 const safe=await i.route(req('','GET'),{});assert.ok(!JSON.stringify(safe).includes('private'));
});
test('changed setpoint and wrong actor cannot execute; permissions rechecked on write',async()=>{
 const m=mock(),i=createIntegrations(m.ops,{fetcher:m.fetcher});const a=await i.chat(req(''),'请调整抓取节拍到12',m.context);
 await assert.rejects(i.route(req('/command','POST','someone'),{id:a.operation.id,action:'confirm'}));
 m.context.controls['arm:rate']=10;await assert.rejects(i.route(req('/command'),{id:a.operation.id,action:'confirm'}));assert.equal(m.writes,0);
 const b=await i.chat(req('','POST','viewer'),'请调整抓取节拍到12',m.context);const result=await i.route(req('/command','POST','viewer'),{id:b.operation.id,action:'confirm'});assert.equal(result.status,'failed');assert.equal(m.writes,0);
});
test('inspection idempotency, changed input conflict, uploaded package not implicitly activated',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bottle-handoff-'));try{
  const m=mock(),i=createIntegrations(m.ops,{fetcher:m.fetcher,uploadRoot:dir});
  const r=await i.route(req('/inspect'),input);assert.equal(r.verdict,'pass');assert.deepEqual(await i.route(req('/inspect'),input),r);
  await assert.rejects(i.route(req('/inspect'),{...input,images:[]}));
  const item=await i.route(req('/package'),{kind:'vision',name:'manifest.json',data:Buffer.from('{}').toString('base64')});assert.equal(item.status,'uploaded');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('timeout preserves a failed inspection, never a fabricated pass',async()=>{
 const m=mock(),i=createIntegrations(m.ops,{fetcher:async()=>{throw Error('timeout');}});
 const r=await i.route(req('/inspect'),input);assert.equal(r.status,'failed');assert.equal(r.verdict,null);
});
test('shared animation uses feedback speed and freezes when stale/stopped',()=>{
 const protocol={enabled:true,devices:[{id:'arm',online:true,receivedAt:1000,points:[{name:'run',value:1},{name:'speed',value:15}]}]};
 const binding={deviceId:'arm',runPoint:'run',ratePoint:'speed',baseRate:7.5};let elapsed=0;const mixer={update:t=>elapsed+=t};
 advanceAnimation(mixer,1,mapDevice(protocol,1001,binding));assert.equal(elapsed,2);
 advanceAnimation(mixer,1,mapDevice(protocol,20000,binding));assert.equal(elapsed,2);
 protocol.devices[0].points[0].value=0;advanceAnimation(mixer,1,mapDevice(protocol,1001,binding));assert.equal(elapsed,2);
});

test('line and configuration proposals require confirmation, enforce roles and read back',async()=>{
 let config={integrations:{coze:{enabled:true,baseUrl:'http://localhost',workflowId:'wf'},commands:[]}},writes=0;
 const ctx={capabilities:[],controls:{},lineMode:'running',dataMode:'simulation',protocol:{enabled:false}};
 const ops={getAIConfig:async()=>structuredClone(config),setAIConfig:async c=>{config=structuredClone(c);},actor:r=>({id:r.headers.actor,role:r.headers.actor}),requireRole:(u,roles)=>{if(!roles.includes(u.role))throw Error('denied');},log:async()=>{},route:async(r,res,b)=>{if(r.url==='/api/ops/context')return ctx;if(r.headers.actor!=='admin')throw Error('denied');writes++;if(r.url.endsWith('/data-mode'))ctx.dataMode=b.mode;else ctx.lineMode=b.action==='pause'?'paused':'running';return {};}};
 let operation={kind:'line',value:'pause',reason:'用户要求'};
 const i=createIntegrations(ops,{fetcher:async()=>({ok:true,json:async()=>({code:0,data:JSON.stringify({answer:'建议',tool_calls:[{name:'propose_change',arguments:operation}]})})})});
 const a=await i.chat(req(''),'暂停整线',{});assert.equal(writes,0);
 const done=await i.route(req('/command'),{id:a.operation.id,action:'confirm'});assert.equal(done.readback,'paused');assert.equal(done.status,'completed');assert.equal(writes,1);
 await i.route(req('/command'),{id:a.operation.id,action:'confirm'});assert.equal(writes,1);
 operation={kind:'data_mode',value:'real',reason:'用户要求'};
 const denied=await i.chat(req('','POST','viewer'),'切换模式',{});assert.equal(denied.operation,undefined);assert.equal(writes,1);
 const b=await i.chat(req(''),'切换模式',{});await i.route(req('/command'),{id:b.operation.id,action:'cancel'});assert.equal(ctx.dataMode,'simulation');
 const c=await i.chat(req(''),'切换模式',{});const result=await i.route(req('/command'),{id:c.operation.id,action:'confirm'});assert.equal(result.readback,'real');assert.equal(result.status,'completed');
});

test('confirmed assistant outcome carries station, before/after, reason and failure truth',()=>{
 const capabilities=[{id:'wash:time',stageIndex:0,device:'水洗单元'}];
 const cmd={id:'confirmation',kind:'parameter',controlId:'wash:time',title:'水洗时间',before:15,value:30,readback:30,unit:'s',reason:'用户要求',status:'completed',result:'回读一致'};
 const meta=commandLogMeta(cmd,capabilities);
 assert.equal(meta.stageIndex,0);assert.equal(meta.category,'ai');assert.equal(meta.requestId,cmd.id);
 assert.equal(meta.after.changes[0].before,15);assert.equal(meta.after.changes[0].after,30);assert.equal(meta.after.command.reason,'用户要求');
 const failed=commandLogMeta({...cmd,status:'failed',readback:undefined,result:'写入失败'},capabilities);
 assert.equal(failed.after.changes[0].after,15);assert.equal(failed.after.changes[0].requested,30);
 assert.equal(commandLogMeta({...cmd,kind:'line',controlId:undefined},capabilities).stageIndex,null);
});

test('vision asset slots persist and reject a mismatched model',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'vision-slots-'));
 try{
  const m=mock(),i=createIntegrations(m.ops,{fetcher:m.fetcher,uploadRoot:dir});
  const model=await i.route(req('/package'),{kind:'vision',slot:'yolo',name:'model.onnx',data:Buffer.from('fixture').toString('base64')});
  await i.route(req('/vision-assets'),{yolo:model.id});
  await assert.rejects(i.route(req('/vision-assets'),{patchcore:model.id}));
  await assert.rejects(i.route(req('/package-folder'),{id:model.id}));
  assert.equal(model.status,'uploaded');
  const custom=await i.route(req('/package'),{kind:'vision',slot:'model',name:'custom.onnx',data:Buffer.from('fixture').toString('base64')});
  const program=await i.route(req('/package'),{kind:'vision',slot:'program',name:'detector.zip',data:Buffer.from('fixture').toString('base64')});
  const selections={models:[{id:'m1',name:'自选模型',packageId:custom.id},{id:'m2',name:'旧模型',packageId:model.id}],programs:[{id:'p1',name:'检测程序',packageId:program.id}]};
  await i.route(req('/vision-assets'),selections);
  assert.deepEqual((await m.ops.getAIConfig()).integrations.vision.assets,selections);
  await assert.rejects(i.route(req('/vision-assets'),{...selections,models:[{id:'m1',name:'错误类别',packageId:program.id}]}));
  await assert.rejects(i.route(req('/vision-assets'),{...selections,programs:[{id:'m1',name:'重复标识',packageId:program.id}]}));
  await i.route(req('/vision-assets'),{models:[],programs:[]});
  assert.deepEqual((await m.ops.getAIConfig()).integrations.vision.assets,{models:[],programs:[]});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('model queue serializes jobs, starts deadlines inside the job and recovers after failure',async()=>{
 const queue=createInferenceQueue(),events=[];let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const first=queue.run(async()=>{events.push('first');await gate;throw Error('first failed');});
 const rejected=assert.rejects(first,/first failed/);
 const second=queue.run(async()=>{events.push('second');return 2;});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,['first']);assert.deepEqual(queue.status(),{running:true,waiting:1});release();await rejected;assert.equal(await second,2);assert.deepEqual(queue.status(),{running:false,waiting:0});
});
test('batch workflow uses existing published contract and never interprets clearing as analysis',async()=>{
 assert.equal(isBatchAlarmQuestion('汇总当前告警，生成批量报告'),true);assert.equal(isBatchAlarmQuestion('批量清除告警'),false);assert.equal(isBatchAlarmQuestion('介绍批量告警功能'),false);
 const alarms=[{id:'a',done:false},{id:'b',done:true}];
 const result=await runAlarmWorkflow({enabled:true,baseUrl:'http://coze',alarmWorkflowId:'123',token:'t'},alarms,async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.workflow_id,'123');assert.deepEqual(JSON.parse(body.parameters.alarms_json),alarms);return {ok:true,json:async()=>({code:0,data:JSON.stringify({report:'总数2，未恢复1'})})};});
 assert.equal(result.goalStatus,'completed');assert.match(result.answer,/总数2/);
 await assert.rejects(runAlarmWorkflow({enabled:true},alarms),/工作流 ID/);
});
test('selected object is prequeried using the current actor without generating a proposal',async(t)=>{
 const m=mock();m.context.capabilities[0].device='ARM-01';m.context.capabilities[0].stageIndex=0;m.context.assets=[{code:'ARM-01',name:'上料设备',stageIndex:0}];
 m.ops.snapshot=()=>({updated:Date.now(),dataMode:'simulation',states:[]});
 await m.ops.setAIConfig({integrations:{coze:{enabled:true,baseUrl:'http://coze',botId:'b',token:'t'},commands:[]}});
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({documents:[{title:'说明',text:'范围1到20'}]})}));
 const integration=createIntegrations(m.ops,{fetcher:async(url,options)=>{
  if(url.endsWith('/v3/chat')){const content=JSON.parse(JSON.parse(options.body).additional_messages[0].content);assert.equal(content.platformEvidence.find(x=>x.tool==='query_devices').result.setpoints[0].value,8);return {ok:true,json:async()=>({data:{id:'r',conversation_id:'c',status:'completed'}})};}
  return {ok:true,json:async()=>({Messages:[{type:'answer',role:'assistant',content:'当前参数8'}]})};
 }});
 const result=await integration.chat(req('/chat'),'当前参数是多少，只查询不修改',{selectionLocked:true,target:'上料设备 ARM-01'},[]);
 assert.equal(result.goalStatus,'completed');assert.equal(m.writes,0);assert.deepEqual(result.trace.map(x=>x.tool),['query_devices','search_knowledge']);
});

test('automatic event reporting keeps factual lookups and uses the existing read-only report workflow',async(t)=>{
 const m=mock();m.context.capabilities[0].device='ARM-01';m.context.capabilities[0].stageIndex=0;m.context.assets=[];m.context.alerts=[];
 m.ops.snapshot=()=>({updated:Date.now(),dataMode:'simulation',states:[]});
 await m.ops.setAIConfig({integrations:{coze:{enabled:true,baseUrl:'http://coze',botId:'b',alarmWorkflowId:'wf',token:'t'},commands:[]}});
 const originalRoute=m.ops.route;m.ops.route=async(req,res,body)=>req.url.startsWith('/api/ops/logs')?{total:0,items:[]}:originalRoute(req,res,body);
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({documents:[]})}));
 const integration=createIntegrations(m.ops,{fetcher:async(url,options)=>{assert.ok(url.endsWith('/v1/workflow/run'));const p=JSON.parse(options.body);assert.equal(JSON.parse(p.parameters.alarms_json)[0].done,true);return {ok:true,json:async()=>({code:0,data:JSON.stringify({report:'未恢复0条。所有问题均已闭环处理。'})})};}});
 const result=await integration.chat(req('/chat'),'分析事件',{automaticAlarm:true,alarm:{id:'a',title:'抓取节拍异常',time:'2026-11-04T06:00:00Z'},eventResolvedAt:'2026-11-04T07:00:00Z'},[]);
 assert.equal(result.goalStatus,'completed');assert.match(result.answer,/历史事件/);assert.doesNotMatch(result.answer,/闭环处理/);assert.equal(m.writes,0);assert.deepEqual(result.trace.map(t=>t.tool),['query_logs','query_devices','search_knowledge','batch_alarm_workflow']);
});
test('batch reports persist in the platform and current-only questions do not mix ended events',async()=>{
 const m=mock();await m.ops.setAIConfig({integrations:{coze:{enabled:true,baseUrl:'http://coze',alarmWorkflowId:'wf',token:'t'},commands:[]}});
 const integration=createIntegrations(m.ops,{fetcher:async()=>({ok:true,json:async()=>({code:0,data:JSON.stringify({report:'告警总数1，未恢复0'})})})});
 integration.setAlarmSource(()=>[{alarm:{id:'old',title:'温度告警',time:'2026-11-04T00:00:00Z'},resolvedAt:'2026-11-04T01:00:00Z'}]);
 const empty=await integration.chat(req('/chat'),'汇总当前未恢复告警',{},[]);assert.equal(empty.count,0);
 const report=await integration.chat(req('/chat'),'复盘2026-11-04的告警',{},[]);assert.equal(report.count,1);assert.match(report.coverage,/2026-11-04/);assert.equal((await integration.read()).state.alarmReports[0].id,report.id);assert.equal(m.writes,0);
});

test('selected write requests still reach the agent as proposals rather than read-only summaries',async()=>{
 const m=mock();await m.ops.setAIConfig({integrations:{coze:{enabled:true,baseUrl:'http://coze',botId:'b',token:'t'},commands:[]}});
 const integration=createIntegrations(m.ops,{fetcher:async(url,options)=>{
  if(url.endsWith('/v3/chat')){const p=JSON.parse(JSON.parse(options.body).additional_messages[0].content);assert.equal(p.question,'把所选参数修改为12，仅生成确认单');assert.equal(p.platformEvidence,undefined);return {ok:true,json:async()=>({data:{id:'r',conversation_id:'c',status:'completed'}})};}
  return {ok:true,json:async()=>({Messages:[{type:'answer',role:'assistant',content:'需要查询后生成提案'}]})};
 }});
 await integration.chat(req('/chat'),'把所选参数修改为12，仅生成确认单',{selectionLocked:true,target:'抓取节拍'},[]);assert.equal(m.writes,0);
});

import {rehearsalDefaults} from './vision-rehearsal.mjs';
test('rehearsal configuration persists independently of real vision settings and rejects stale saves and viewers',async()=>{
 const m=mock(),i=createIntegrations(m.ops);const before=await i.route(req('', 'GET'),{});
 let draft=await i.route(req('/vision-rehearsal','GET'),{});assert.equal(draft.cases.length,2);assert.equal(draft.enabled,true);
 await assert.rejects(i.route(req('/vision-rehearsal','POST','viewer'),draft),/role denied/);
 const saved=await i.route(req('/vision-rehearsal'),draft);assert.equal(saved.revision,1);assert.deepEqual((await i.route(req('/vision-rehearsal','GET'),{})).cases,saved.cases);
 await assert.rejects(i.route(req('/vision-rehearsal'),draft),/已变化/);
 const enabled=await i.route(req('/vision-rehearsal'),{...saved,enabled:true});assert.equal(enabled.enabled,true);
 const after=await i.route(req('', 'GET'),{});assert.deepEqual(after.vision,before.vision);assert.deepEqual(after.coze,before.coze);
});
test('preset monitor keeps stages scoped and does not call a real vision job or replace actual mode results',async()=>{
 const m=mock();let calls=0;const flow={taskId:'t',running:true,updated:1000,simulatedStages:Array(9).fill(true),stages:Array.from({length:9},()=>[])};flow.stages[2]=[{id:'b1',elapsed:0,duration:8}];
 m.ops.snapshot=()=>({dataMode:'simulation',materialFlow:flow,states:Array.from({length:9},()=>({source:'simulation'}))});const i=createIntegrations(m.ops,{fetcher:async()=>{calls++;throw Error('unexpected external call');}});
 await i.route(req('/vision-rehearsal'),{...rehearsalDefaults(),enabled:true});flow.updated=Date.now();await i.route(req('/vision-monitor','GET'),{});flow.stages[2][0].elapsed=7;const monitor=await i.route(req('/vision-monitor','GET'),{});
 assert.equal(monitor.rehearsal.active,true);assert.equal(monitor.records[0].bottleId,'b1');assert.equal(monitor.records[0].verdict,'pass');assert.equal(calls,0);
 m.ops.snapshot=()=>({dataMode:'real'});const real=await i.route(req('/vision-monitor','GET'),{});assert.equal(real.rehearsal.active,true);assert.equal(real.records.length,1);
});

test('persistent sample selection enforces role, mode and station, then locks the next run',async()=>{
 const m=mock();m.ops.snapshot=()=>({dataMode:'mixed',materialFlow:null,states:Array.from({length:9},()=>({source:'simulation'}))});const i=createIntegrations(m.ops);
 await i.route(req('/vision-rehearsal-sample'),{stageIndex:2,caseId:'defect'});
 await i.route(req('/vision-rehearsal'),{...rehearsalDefaults(),enabled:true});
 await assert.rejects(i.route(req('/vision-rehearsal-sample','POST','viewer'),{stageIndex:2,caseId:'defect'}),/role denied/);
 await assert.rejects(i.route(req('/vision-rehearsal-sample'),{stageIndex:0,caseId:'defect'}),/有效工位/);
 await i.route(req('/vision-rehearsal-sample'),{stageIndex:2,caseId:'defect'});const result=await i.route(req('/vision-rehearsal-start'),{stageIndex:2});assert.equal(result.rehearsal.manualFlows[2].caseId,'defect');
 const monitor=await i.route(req('/vision-monitor','GET'),{});assert.equal(monitor.rehearsal.selectedSamples[2],'defect');
 m.ops.snapshot=()=>({dataMode:'real'});await i.route(req('/vision-rehearsal-sample'),{stageIndex:2,caseId:'normal'});
});

test('single rehearsal start needs no production task and rejects viewers or real-mode stations',async()=>{
 const m=mock();m.ops.snapshot=()=>({dataMode:'mixed',materialFlow:null,states:Array.from({length:9},()=>({source:'simulation'}))});const i=createIntegrations(m.ops);
 await i.route(req('/vision-rehearsal'),{...rehearsalDefaults(),enabled:true});
 await assert.rejects(i.route(req('/vision-rehearsal-start','POST','viewer'),{stageIndex:2}),/role denied/);
 const r=await i.route(req('/vision-rehearsal-start'),{stageIndex:2});assert.ok(r.bottleId.startsWith('CAP-'));assert.equal(r.records[0].capturedCount,0);assert.ok(r.rehearsal.manualFlows[2]);
 await assert.rejects(i.route(req('/vision-rehearsal-start'),{stageIndex:2}),/正在检测/);
 m.ops.snapshot=()=>({dataMode:'real'});assert.equal((await i.route(req('/vision-monitor','GET'),{})).rehearsal.active,true);
});
test('actual detection keeps exact submitted camera frames even on service failure',async()=>{
 const m=mock(),i=createIntegrations(m.ops,{fetcher:async()=>{throw Error('service down');}});await i.route(req('/config'),{kind:'vision',baseUrl:'http://127.0.0.1:8093',enabled:true,workflowId:'',version:'test'});
 const r=await i.route(req('/inspect'),{...input,requestId:'raw-frame-check',stageIndex:5});assert.equal(r.status,'failed');assert.equal(r.stageIndex,5);assert.equal(r.source,'camera-capture');
 for(const camera of r.cameras){assert.equal(camera.originalUrl,input.images.find(frame=>frame.cameraId===camera.cameraId).data);assert.equal(camera.status,'error');}
});

test('simulation snapshots are bound to the active bottle and preserve supplied image data',async()=>{
 const m=mock();m.ops.snapshot=()=>({dataMode:'simulation',materialFlow:null});const i=createIntegrations(m.ops);await i.route(req('/vision-rehearsal'),{...rehearsalDefaults(),enabled:true});
 const start=await i.route(req('/vision-rehearsal-start'),{stageIndex:2,source:'simulation'});const body={stageIndex:2,bottleId:start.bottleId,cameraId:'top',data:'data:image/png;base64,AAAA'};
 await assert.rejects(i.route(req('/vision-rehearsal-capture','POST','viewer'),body),/role denied/);
 await assert.rejects(i.route(req('/vision-rehearsal-capture'),{...body,cameraId:'wrong'}),/无效/);
 await assert.rejects(i.route(req('/vision-rehearsal-capture'),{...body,bottleId:'wrong'}),/结束/);
 await i.route(req('/vision-rehearsal-capture'),body);await new Promise(resolve=>setTimeout(resolve,2100));const r=await i.route(req('/vision-monitor','GET'),{});assert.equal(r.records[0].cameras[0].originalUrl,body.data);assert.equal(r.records[0].cameras[1].originalUrl,null);
 await i.route(req('/vision-rehearsal-stop'),{stageIndex:2});assert.equal((await i.route(req('/vision-monitor','GET'),{})).records[0].verdict,'review');
});

test('fresh and previously disabled installations use bundled simulation in both vision stations without network services',async()=>{
 const m=mock();let calls=0;m.ops.snapshot=()=>({dataMode:'real',protocol:{enabled:true},states:Array.from({length:9},()=>({source:'real'})),materialFlow:null});
 const i=createIntegrations(m.ops,{fetcher:async()=>{calls++;throw Error('external dependency must not be used');}});
 const c=await i.route(req('/vision-rehearsal','GET'),{});assert.equal(c.enabled,true);assert.deepEqual(c.stageIndices,[2,5]);
 await i.route(req('/vision-rehearsal'),{...c,enabled:false,stageIndices:[2]});
 const s=await i.route(req('/vision-monitor','GET'),{});assert.equal(s.rehearsal.active,true);assert.deepEqual(s.rehearsal.stageIndices,[2,5]);
 await assert.rejects(i.route(req('/vision-rehearsal-start'),{stageIndex:2,source:'camera'}),/仅提供模拟/);
 const run=await i.route(req('/vision-rehearsal-start'),{stageIndex:5});assert.equal(run.rehearsal.manualFlows[5].source,'simulation');assert.equal(calls,0);
});
test('missing migrated upload is replaced with a bundled picture',async()=>{
 const m=mock(),i=createIntegrations(m.ops);const c=await i.route(req('/vision-rehearsal','GET'),{});
 c.cases[0].cameras[0].images.opencv='/uploads/vision-demo/missing-migration.webp';c.cases[0].cameras[1].images.yolo='';c.enabled=false;
 const stored=await i.read();await m.ops.setAIConfig({...stored.root,integrations:{...stored.state,visionRehearsal:c}});
 const normalized=await i.route(req('/vision-rehearsal','GET'),{});assert.equal(normalized.cases[0].cameras[0].images.opencv,'/images/vision-demo/normal-opencv-top.webp');assert.equal(normalized.cases[0].cameras[1].images.yolo,'/images/vision-demo/normal-yolo-side-0.webp');
});
