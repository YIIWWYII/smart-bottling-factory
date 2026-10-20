import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createIntegrations,validateInspection,runCoze,cameraIds,commandLogMeta} from './platform-integrations.mjs';
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
