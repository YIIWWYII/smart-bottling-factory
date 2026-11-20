import {createVisionRehearsal,rehearsalDefaults,validateRehearsal,rehearsalCameraIds,rehearsalBranches} from './vision-rehearsal.mjs';
import {normalizeVisionCameras,inspectCameraServices} from './vision-config.mjs';
import {readSkillConfig} from './skill-config.mjs';
import {parseSkillCommand} from './src/assistantSkills.js';
import {runNativeAgent} from './coze-agent.mjs';
import {runAgent,createAgentTools} from './assistant-agent.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
async function withHandoffDeadline(fetcher,attempt){
 const controller=new AbortController(),{signal}=controller;
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
  controller.abort(new Error('外部服务未在 2 秒内返回结果。'));reject(signal.reason);
 },2000);});
 const request=(url,options={})=>{
  signal.throwIfAborted();
  return fetcher(url,{...options,signal:options.signal?AbortSignal.any([signal,options.signal]):signal});
 };
 try{return await Promise.race([attempt(request,signal),timeout]);}finally{clearTimeout(timer);}
}
export const cameraIds=['top','side-0','side-120','side-240'];
export function serviceUrl(value){
 let u;try{u=new URL(value);}catch{fail('请输入完整的服务地址。');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)fail('服务地址只支持 HTTP / HTTPS，不应包含账号、查询参数或密钥。');
 return u.toString().replace(/\/$/,'');
}
export async function requestService(base,route,token,body,fetcher=fetch){
 const started=Date.now(),requestId=randomUUID();let r;
 try{
 r=await fetcher(serviceUrl(base)+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(60000)});
 }catch(error){
  console.warn('[integration-request]',JSON.stringify({requestId,route,durationMs:Date.now()-started,error:error.name}));
  if(error.name==='TimeoutError')fail(`接入服务在 60 秒内未响应（${route.includes('workflow')?'Coze 工作流':'外部服务'}）。未自动执行设备操作，请稍后重试。请求编号：${requestId}`,504);
  throw error;
 }

 if(!r.ok)fail(`接入服务返回 HTTP ${r.status}，请检查服务地址、授权和运行日志。`,502);
 let j;try{j=await r.json();}catch{fail('服务没有返回 JSON。',502);}return j;
}
export async function preferredService(config,fetcher=fetch){
 if(!config.backupBaseUrl)return config;
 try{const response=await fetcher(serviceUrl(config.baseUrl),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(2000)});if(response.status>=500)throw Error('service unavailable');return config;}
 catch{return {...config,baseUrl:config.backupBaseUrl,botId:config.backupBotId||config.botId,workflowId:config.backupWorkflowId||config.workflowId,alarmWorkflowId:config.backupAlarmWorkflowId||config.alarmWorkflowId,token:config.backupToken||config.token,usingBackup:true};}
}
export async function runCoze(config,parameters,fetcher=fetch){
 if(!config?.enabled||!config.workflowId)fail('Coze Studio 尚未启用或未填写已发布的工作流标识。',409);
 const r=await requestService(config.baseUrl,'/v1/workflow/run',config.token,{workflow_id:config.workflowId,parameters,is_async:false},fetcher);
 if(r.code!==0)fail('Coze 工作流未完成，请检查发布状态、参数和运行日志。',502);
 let data=r.data;try{if(typeof data==='string')data=JSON.parse(data);}catch{fail('Coze 输出应是包含 answer 的 JSON 对象。',502);}
 // Text-output LLM nodes may return the structured suggestion inside answer.
 if(typeof data?.answer==='string'){
  try{const nested=JSON.parse(data.answer.replace(/^```(?:json)?\s*|\s*```$/g,''));if(typeof nested.answer==='string')data={...data,...nested};}catch{}
 }
 if(!data||typeof data.answer!=='string'||!data.answer.trim())fail('工作流缺少 answer 文本输出。',502);
 return {...data,workflowRunId:r.execute_id||r.debug_url||null};
}
export function validateInspection(input,result){
 if(result.requestId!==input.requestId||result.bottleId!==input.bottleId||result.batchId!==input.batchId)fail('检测结果的请求、瓶子或批次编号不一致，未入库。',502);
 if(!Array.isArray(result.cameras)||result.cameras.length>4)fail('检测服务机位结果无效。',502);
 const ids=result.cameras.map(c=>c.cameraId);
 if(new Set(ids).size!==ids.length||ids.some(id=>!cameraIds.includes(id)))fail('检测服务返回重复或未知机位。',502);
 const supplied=input.images.map(i=>i.cameraId);
 for(const c of result.cameras){
  if(!['pass','review','reject','error','missing'].includes(c.status))fail('检测服务机位状态无效。',502);
  if(!supplied.includes(c.cameraId)&&!['missing','error'].includes(c.status))fail('缺少输入图像的机位不能产生有效检测结果。',502);
  for(const key of ['imageUrl','originalUrl','alignedUrl','preprocessedUrl','opencvUrl','heatmapUrl','overlayUrl'])if(c[key]&&!/^https?:\/\//.test(c[key])&&!/^data:image\/(png|jpeg|webp);base64,/.test(c[key]))fail('检测证据图片地址无效。',502);
 }
 const missing=cameraIds.filter(id=>!supplied.includes(id)||!ids.includes(id)||result.cameras.find(c=>c.cameraId===id)?.status==='missing');
 if(!['pass','review','reject'].includes(result.verdict))fail('整瓶判定无效。',502);
 if(result.verdict==='pass'&&(missing.length||result.cameras.some(c=>c.status!=='pass')||result.coverageComplete===false||result.modelsReady===false||[result.body,result.cap].some(r=>r&&r.status!=='pass')))fail('整瓶通过结果缺少完整检测依据，未入库。',502);
 for(const key of ['panoramaUrl','overlayUrl','heatmapUrl'])if(result[key]&&!/^https?:\/\//.test(result[key])&&!/^data:image\/(png|jpeg|webp);base64,/.test(result[key]))fail('检测证据图片地址无效。',502);
 return {...result,missing};
}

export function createInferenceQueue(){
 let tail=Promise.resolve(),running=false,waiting=0;
 return {status:()=>({running,waiting}),run(fn){waiting++;const job=tail.then(async()=>{waiting--;running=true;try{return await fn();}finally{running=false;}});tail=job.catch(()=>{});return job;}};
}
export function isBatchAlarmQuestion(question){return /(?:批量|汇总|复盘|统计|多条|一批).*(?:告警|报警)|(?:告警|报警).*(?:批量|汇总|复盘|统计)/.test(question)&&!/清除|解除|删除|复位|是什么|什么意思|介绍|功能|如何|怎么/.test(question);}
export async function runAlarmWorkflow(config,alarms,fetcher=fetch){
 if(!config.enabled||!config.alarmWorkflowId)fail('请在平台 AI 配置中填写已发布的批量告警工作流 ID。',409);
 const r=await requestService(config.baseUrl,'/v1/workflow/run',config.token,{workflow_id:config.alarmWorkflowId,parameters:{alarms_json:JSON.stringify(alarms)},is_async:false},fetcher);
 let data=r.data;try{if(typeof data==='string')data=JSON.parse(data);}catch{}
 if(r.code!==0||typeof data?.report!=='string'||!data.report.trim())fail('批量告警工作流没有返回完整报告，请检查运行记录。',502);
 const report=data.report.replace(/所有(?:告警|问题)均已(?:闭环处理|处理完毕)[。！]?/g,'所统计的告警事件均已结束。');
 return {answer:report,goalStatus:'completed',workflowRunId:r.execute_id||null,model:'Coze · 批量告警复盘',trace:[{tool:'batch_alarm_workflow',status:'success',at:new Date().toISOString(),result:{count:alarms.length,workflowId:config.alarmWorkflowId}}]};
}

// Stored alongside the existing AI configuration in MySQL; uploaded files are private.
export function createIntegrations(ops,{uploadRoot=path.resolve('.runtime/handoffs'),fetcher=fetch,handoffDemo=false,localFallback=handoffDemo,presetVision=false}={}){
 const inference=createInferenceQueue();
 const rehearsal=createVisionRehearsal();
 const updateVisionDemo=async()=>{
  const {state}=await read(),snapshot=ops.snapshot?.()||{};
  const visualSnapshot=presetVision?{...snapshot,dataMode:'simulation',protocol:{enabled:false},states:snapshot.states?.map(s=>({...s,source:'simulation'})),materialFlow:snapshot.materialFlow?{...snapshot.materialFlow,simulatedStages:Array(9).fill(true)}:null}:snapshot;
  return rehearsal.observe(state.visionRehearsal||rehearsalDefaults(),visualSnapshot);
 };
 let alarmSource=()=>[];
 let monitorPending=null,monitorAt=0,monitorError='';
 async function monitor(){
  if(!monitorPending&&Date.now()-monitorAt>2000){
   monitorPending=exclusive(async()=>{
    const {state}=await read(),job=state.visionJob,v=state.vision;
    monitorError='';
    if(presetVision||!v.enabled||!job||!['starting','running','stopping'].includes(job.status))return;
    if(job.baseUrl!==v.baseUrl){monitorError='检测任务的服务地址已变化';return;}
    try{
     const response=await requestService(v.baseUrl,'/jobs/'+encodeURIComponent(job.jobId),v.token,undefined,fetcher);
     if(response.jobId!==job.jobId||response.batchId!==job.batchId||!['starting','running','stopping','stopped','completed','failed'].includes(response.status)||!Array.isArray(response.results))throw Error('视觉任务返回格式或编号不一致');
     const checked=response.results.map(raw=>{
      if(raw.batchId!==job.batchId||typeof raw.requestId!=='string'||!raw.requestId||typeof raw.bottleId!=='string'||!raw.bottleId)throw Error('检测记录编号无效');
      return validateInspection({...raw,images:cameraIds.map(cameraId=>({cameraId}))},raw);
     });
     for(const row of checked)if(!state.records.some(r=>r.requestId===row.requestId))state.records.unshift({...row,status:'completed',createdAt:new Date().toISOString(),jobId:job.jobId});
     state.records=state.records.slice(0,200);state.visionJob={...job,status:response.status};await save(state);
    }catch(e){monitorError=e.message;}
   }).finally(()=>{monitorAt=Date.now();monitorPending=null;});
  }
  if(monitorPending)await monitorPending;
  const {state}=await read(),demo=await updateVisionDemo();return {rehearsal:{enabled:!!state.visionRehearsal?.enabled,active:demo.active,stageIndices:demo.stageIndices,selectedSamples:demo.selectedSamples,manualFlows:demo.manualFlows,message:demo.message},enabled:demo.active||!!state.vision.enabled,records:demo.active?[...demo.records,...state.records].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)):state.records,job:state.visionJob?{jobId:state.visionJob.jobId,status:state.visionJob.status}:null,error:monitorError,checkedAt:monitorAt};
 }
 let queue=Promise.resolve();
 const exclusive=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const read=async()=>{
  const root=await ops.getAIConfig()||{},state={coze:{enabled:false},vision:{enabled:false},packages:[],records:[],commands:[],...root.integrations};
  if(handoffDemo){
   const visionUrl='http://127.0.0.1:8093',localVisionUrl='http://127.0.0.1:18093',agentUrl='http://127.0.0.1:8887',botId='123456789012';
   state.vision={enabled:true,mode:'whole-bottle',baseUrl:visionUrl,workflowId:'',version:'',...root.integrations?.vision,backupBaseUrl:root.integrations?.vision?.backupBaseUrl||localVisionUrl};
   state.coze={enabled:true,baseUrl:agentUrl,botId,token:'demo-token',workflowId:'',version:'',...root.integrations?.coze,backupBaseUrl:root.integrations?.coze?.backupBaseUrl||agentUrl,backupBotId:root.integrations?.coze?.backupBotId||botId,backupToken:root.integrations?.coze?.backupToken||'demo-token'};
  }
  if(localFallback)state.visionRehearsal??={...rehearsalDefaults(),enabled:true,stageIndices:[2,5]};
  if(presetVision)state.visionRehearsal={...(state.visionRehearsal||rehearsalDefaults()),enabled:true,stageIndices:[2,5]};
  return {root,state};
 };
 const save=async(state,signal)=>{const latest=await ops.getAIConfig()||{};signal?.throwIfAborted();await ops.setAIConfig({...latest,integrations:state});};
 const publicState=s=>({...s,presetVision,coze:{...s.coze,token:undefined,backupToken:undefined,tokenConfigured:!!s.coze.token,backupTokenConfigured:!!s.coze.backupToken},vision:{...s.vision,token:undefined,backupToken:undefined,tokenConfigured:!!s.vision.token,backupTokenConfigured:!!s.vision.backupToken},commands:undefined});
 const context=async req=>ops.route({headers:req.headers,url:'/api/ops/context',method:'GET'},{},{});
 async function proposal(req,out,signal){
  if(!out.operation)return null;
  const ctx=await context(req),o=out.operation,kind=o.kind||'parameter';
  let details;
  if(kind==='parameter'){
   const c=ctx.capabilities.find(c=>c.id===o.controlId);
   if(!c||c.type!=='NUMBER'||typeof o.value!=='number'||!Number.isFinite(o.value)||o.value<c.min||o.value>c.max)fail('参数或目标值不在允许范围内。',409);
   details={controlId:c.id,stageIndex:c.stageIndex,device:c.device,title:c.label,unit:c.unit,before:ctx.controls[c.id]};
  }else if(kind==='line'){
   ops.requireRole(ops.actor(req),['admin','engineer','operator']);
   if(!['pause','resume'].includes(o.value))fail('仅支持整线暂停或启动。');
   details={title:'整线'+(o.value==='pause'?'暂停':'启动'),before:ctx.lineMode,unit:'',taskId:ctx.activeTask?.id||null,taskVersion:ctx.activeTask?.version??null};
  }else if(kind==='data_mode'){
   ops.requireRole(ops.actor(req),['admin']);
   if(!['simulation','real'].includes(o.value))fail('混合模式需在数据配置中指定真实工位。');
   details={title:'切换数据来源',before:ctx.dataMode,unit:''};
  }else fail('未开放此类写入操作。');
  const cmd={id:randomUUID(),actor:ops.actor(req).id,...details,kind,reason:String(o.reason||'用户请求').slice(0,500),value:o.value,status:'pending',createdAt:Date.now(),mode:ctx.dataMode,protocol:!!ctx.protocol?.enabled};
  await exclusive(async()=>{const {state}=await read();state.commands=[cmd,...state.commands||[]].slice(0,200);await save(state,signal);});
  await ops.log(ops.actor(req),'AI 提出参数调整',`${cmd.device} / ${cmd.title} → ${cmd.value}，等待人工确认`,'待确认',{category:'ai',requestId:cmd.id});return cmd;
 }
 async function batchAlarmReport(req,question='',config=null,request=fetcher){
  const {state}=await read();const coze=config||state.coze;
  const context=await ops.route({headers:req.headers,url:'/api/ops/context',method:'GET'},{},{});
  let alarms=alarmSource(context.dataMode).map(row=>({...row.alarm,resolvedAt:row.resolvedAt,done:!!row.resolvedAt}));
  const day=at=>new Date(at+8*3600000).toISOString().slice(0,10),dates=question.match(/\d{4}-\d{2}-\d{2}/g)||[];
  if(!dates.length&&/今天|昨日|昨天/.test(question))dates.push(day(Date.now()-(/昨天|昨日/.test(question)?86400000:0)));
  if(dates.some(d=>!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)||dates.length>2||dates.length===2&&dates[0]>dates[1])fail('请输入有效的告警起止日期。');
  if(!dates.length&&/本周|上周|本月|上月|最近.*(?:天|周|月)/.test(question))fail('请用 YYYY-MM-DD 写出需要复盘的起止日期。');
  if(dates.length)alarms=alarms.filter(a=>{const at=Date.parse(a.time);return Number.isFinite(at)&&day(at)>=dates[0]&&day(at)<=(dates[1]||dates[0]);});
  const activeOnly=/当前|未恢复|待处理/.test(question);if(activeOnly)alarms=alarms.filter(a=>!a.done);
  const coverage=(dates.length?dates.join(' 至 '):'最近100条已记录事件')+(activeOnly?' · 未恢复告警':'');
  if(!alarms.length)return {answer:'统计范围：'+coverage+'。当前数据模式没有符合条件的告警记录。',goalStatus:'completed',trace:[],count:0};
  let result;
  try{
   const analyze=async(send,signal)=>{
    const service=config||await preferredService(coze,send);
    return inference.run(()=>{signal?.throwIfAborted();return runAlarmWorkflow(service,alarms,send);});
   };
   if(localFallback&&(!coze.enabled||!coze.baseUrl||!coze.alarmWorkflowId))throw Error('未配置告警工作流');
   result=localFallback?await withHandoffDeadline(request,analyze):await analyze(request);
  }catch(error){
   if(!localFallback||error.status===403)throw error;
   result={answer:'告警记录汇总：\n'+alarms.map(a=>`- ${a.title||'未命名告警'}：${a.done?'已恢复':'待核对'}`).join('\n'),goalStatus:'completed',serviceSource:'local-demo',trace:[]};
  }
  const report={id:randomUUID(),mode:context.dataMode,createdAt:new Date().toISOString(),count:alarms.length,coverage,...result,answer:'统计范围：'+coverage+'。\n\n'+result.answer};
  await exclusive(async()=>{const {state:latest}=await read();latest.alarmReports=[report,...latest.alarmReports||[]].slice(0,20);await save(latest);});
  await ops.log(ops.actor(req),'生成批量告警复盘',String(alarms.length)+' 条','成功',{category:'ai'});return report;
 }
 async function chat(req,question,ctx,history=[]){
  if(!localFallback)return connectedChat(req,question,ctx,history);
  if(isBatchAlarmQuestion(question)&&!ctx.automaticAlarm)return batchAlarmReport(req,question);
  const {state}=await read(),config=state.coze;
  const canned=config.botId==='123456789012'&&config.token==='demo-token';
  if(config.enabled&&config.baseUrl&&!canned&&(config.botId||config.workflowId||(ctx.automaticAlarm&&config.alarmWorkflowId))){
   try{
    const result=await withHandoffDeadline(fetcher,(request,signal)=>connectedChat(req,question,ctx,history,config,request,signal));
    if(result?.operation||['completed','needs_information','awaiting_confirmation'].includes(result?.goalStatus))return result;
   }catch(error){if([400,403].includes(error.status))throw error;}
  }
  const {questions}=JSON.parse(await fs.readFile(new URL('./config/demo-questions.json',import.meta.url),'utf8'));
  const normalize=value=>value.trim().toLowerCase().replace(/[\s，。！？、,.!?]/g,'');
  const match=ctx.automaticAlarm?null:questions.find(row=>row.questions.some(text=>normalize(text)===normalize(question))&&(!row.target||(ctx.selectionLocked&&String(ctx.target||'').includes(row.target))));
  const answer=match?.answer||(ctx.automaticAlarm?'可先核对告警记录与对应工位的读数，再检查设备状态和阈值。此处仅提供检查步骤，未判定故障原因。':'当前未连接到可回答此问题的智能体。可试用演示题：'+questions.filter(row=>!row.target).map(row=>row.questions[0]).join('；')+'。');
  return {answer,serviceSource:'local-demo',goalStatus:match||ctx.automaticAlarm?'completed':'needs_information',trace:[],snapshotAt:ctx.updated};
 }
 async function connectedChat(req,question,ctx,history=[],config=null,request=fetcher,signal){
  const {state,root}=await read();if(!state.coze.enabled)return null;state.coze=config||await preferredService(state.coze,fetcher);
  if(isBatchAlarmQuestion(question)&&!ctx.automaticAlarm)return batchAlarmReport(req,question,state.coze,request);
  if(ctx.automaticAlarm&&!state.coze.botId&&state.coze.alarmWorkflowId){
   return inference.run(()=>{signal?.throwIfAborted();return runAlarmWorkflow(state.coze,[{...ctx.alarm,done:!!ctx.eventResolvedAt,resolvedAt:ctx.eventResolvedAt}],request);});
  }
  if(state.coze.botId)return inference.run(async()=>{
   signal?.throwIfAborted();
   const prepared=[];
   const readingSelected=ctx.selectionLocked&&!/调整|改为|设为|修改|设置为|设置到|写入|启动|暂停|停止|切换/.test(question.replace(/(?:不|不要|无需|禁止|不能)(?:修改|调整|设置|写入|启动|暂停|停止|切换)/g,''));
   if(ctx.automaticAlarm||readingSelected){
    const context=await ops.route({headers:req.headers,url:'/api/ops/context',method:'GET'},{},{});
    const tools=createAgentTools(ops,req,{commands:async()=>[],proposal:()=>{throw Error('预查询不允许生成提案');}});
    const capture=async(tool,args)=>{try{const result=await tools(tool,args);prepared.push({tool,arguments:args,status:'success',at:new Date().toISOString(),source:'platform',result});}catch(error){prepared.push({tool,arguments:args,status:'error',at:new Date().toISOString(),result:{error:error.message}});}};
    const target=String(ctx.automaticAlarm?ctx.alarm?.title||'':ctx.target||ctx.selectionObject?.text||'');
    const parameter=context.capabilities?.find(c=>target.includes(c.id)||target.includes(c.label));
    const asset=context.assets?.find(a=>target.includes(a.code)||target.includes(a.name));
    const device=parameter?.device||asset?.code;
    if(ctx.automaticAlarm)await capture('query_logs',{});
    if(device||parameter)await capture('query_devices',{query:parameter?.id||device});
    else if(ctx.automaticAlarm)await capture('query_devices',{query:(ctx.alarm?.title||'').split('异常')[0]});
    await capture('search_knowledge',{query:(ctx.automaticAlarm?ctx.alarm?.title:ctx.selectionObject?.name||target).slice(0,200),...(device?{device_model:device}:{})});
   }
   if(ctx.automaticAlarm&&state.coze.alarmWorkflowId){
    const event={...ctx.alarm,done:!!ctx.eventResolvedAt,resolvedAt:ctx.eventResolvedAt};
    const result=await runAlarmWorkflow(state.coze,[event],request);
    const evidence=prepared.filter(t=>t.status==='success').map(t=>t.tool==='query_devices'?'设备设定参数：'+(t.result.setpoints||[]).map(p=>(p.deviceName||p.device)+' / '+p.name+' '+p.value+' '+p.unit+'（允许 '+p.min+'～'+p.max+' '+p.unit+'）').join('；')+'。当前读数：'+((t.result.readings||[]).map(r=>r.station+' '+r.metric+' '+(r.value??'未提供')+' '+r.unit+'，来源 '+r.source).join('；')||'本次未返回对应实测读数'):t.tool==='query_logs'?'当前未恢复告警：'+t.result.activeCount+' 条':t.tool==='search_knowledge'?'参考资料：'+(t.result.documents||[]).map(d=>(d.title||d.id)+' '+(d.version||'')).join('、'):'').filter(Boolean).join('\n');
    return {...result,model:'Coze · 告警分析报告',answer:'事件：'+event.title+'\n事件时间：'+(Number.isFinite(Date.parse(event.time))?new Date(event.time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'未提供')+'\n'+(ctx.eventResolvedAt?'此事件已结束，以下为历史事件复盘。':'此事件尚未标记恢复。')+'\n事件记录：'+(event.detail||'')+'\n\n'+result.answer+'\n\n核对依据（查询时刻）：\n'+evidence,trace:[...prepared,...result.trace],snapshotAt:ctx.updated};
   }
   signal?.throwIfAborted();
   return runNativeAgent({...state.coze,skills:readSkillConfig(root.skills)},req,question,ctx,history,request,prepared,signal);
  });
  if(parseSkillCommand(question,ctx,readSkillConfig(root.skills)))throw Error('技能需要配置已发布的原生智能体 ID。');
  const result=await runAgent({question,context:ctx,history,
   decide:(agentContext,h)=>runCoze(state.coze,{question,context:JSON.stringify(agentContext),history:JSON.stringify(h)},request),
   execute:createAgentTools(ops,req,{commands:async()=>{const {state}=await read();return state.commands.filter(c=>c.actor===ops.actor(req).id).slice(0,20);},proposal:o=>proposal(req,{operation:o},signal)})});
  await ops.log(ops.actor(req),'智能体工具查询',JSON.stringify(result.trace.map(t=>({tool:t.tool,status:t.status,at:t.at}))),result.goalStatus,{category:'ai'});
  return {...result,snapshotAt:ctx.updated};
 }

 async function route(req,body){
  const p=req.url.split('?')[0],write=req.method==='POST',user=ops.actor(req);
  if(!p.startsWith('/api/ai/integrations'))return undefined;
  if(!['GET','POST'].includes(req.method))fail('不支持的请求方法。',405);
  if(p.endsWith('/vision-rehearsal')&&!write){const {state}=await read();return validateRehearsal(state.visionRehearsal||rehearsalDefaults());}
  if(p.endsWith('/vision-rehearsal')&&write)return exclusive(async()=>{
   ops.requireRole(user,['admin','engineer']);const {state}=await read(),old=state.visionRehearsal||rehearsalDefaults();
   if(body.revision!==old.revision)fail('演示素材配置已变化，请重新读取后保存。',409);
   let config;try{config=validateRehearsal(body);}catch(e){fail(e.message);}
   if(config.enabled)for(const sample of config.cases)for(const camera of sample.cameras)for(const url of Object.values(camera.images))try{await fs.access(path.resolve('public','.'+url));}catch{fail('素材文件不存在，请重新上传：'+url);}
   if(!presetVision&&state.visionJob&&['running','starting','stopping'].includes(state.visionJob.status)&&config.enabled)fail('请先停止真实视觉任务，再启用预设演示。',409);
   config.revision=old.revision+1;state.visionRehearsal=config;await save(state);await ops.log(user,'保存视觉演示素材',config.enabled?'启用预设演示':'保存素材，未启用','成功',{category:'interface'});return config;
  });
  if(p.endsWith('/vision-rehearsal-image')&&write){
   ops.requireRole(user,['admin','engineer']);
   if(!['normal','defect'].includes(body.caseId)||!rehearsalCameraIds.includes(body.cameraId)||!rehearsalBranches.includes(body.branch))fail('请选择有效的瓶型、机位和图片组。');
   const match=typeof body.data==='string'&&body.data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
   if(!match||body.data.length>7000000)fail('请上传 PNG、JPEG 或 WebP 图片，单张不超过 5 MB。');
   const bytes=Buffer.from(match[2],'base64');
   const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
   if(!valid||bytes.length>5*1024*1024)fail('图片内容或大小无效。');
   const directory=path.resolve('public/uploads/vision-demo');await fs.mkdir(directory,{recursive:true});const file=randomUUID()+'.'+(match[1]==='jpeg'?'jpg':match[1]);await fs.writeFile(path.join(directory,file),bytes);return {url:'/uploads/vision-demo/'+file};
  }
  if(p.endsWith('/vision-rehearsal-start')&&write)return exclusive(async()=>{
   ops.requireRole(user,['admin','engineer','operator']);
   const demo=await updateVisionDemo();
   if(![2,5].includes(body.stageIndex)||!demo.active||!demo.stageIndices.includes(body.stageIndex))fail('当前工位未启用离线回放。',409);
   const id='CAP-'+randomUUID();
   if(!['camera','simulation'].includes(body.source||'simulation'))fail('请选择实际画面或模拟画面。');
   try{rehearsal.start(body.stageIndex,id,Date.now(),body.source||'simulation');}catch(e){fail(e.message,409);}
   const result=await updateVisionDemo();
   await ops.log(user,'启动单次视觉回放',id,'成功',{category:'vision',stageIndex:body.stageIndex});
   return {bottleId:id,records:result.records,rehearsal:{active:result.active,stageIndices:result.stageIndices,selectedSamples:result.selectedSamples,manualFlows:result.manualFlows}};
  });
  if(p.endsWith('/vision-rehearsal-sample')&&write)return exclusive(async()=>{
   ops.requireRole(user,['admin','engineer','operator']);
   if(![2,5].includes(body.stageIndex)||!['normal','defect'].includes(body.caseId))fail('请选择有效工位和瓶体样本。');
   const demo=await updateVisionDemo();if(!demo.active||!demo.stageIndices.includes(body.stageIndex))fail('当前工位未启用离线回放。',409);
   rehearsal.selectSample(body.stageIndex,body.caseId);
   await ops.log(user,'选择视觉演示瓶体',body.caseId,'成功',{category:'interface',stageIndex:body.stageIndex});
   return {ok:true,caseId:body.caseId};
  });
  if(p.endsWith('/vision-rehearsal-capture')&&write){
   ops.requireRole(user,['admin','engineer','operator']);
   const demo=await updateVisionDemo();if(!demo.active||!demo.stageIndices.includes(body.stageIndex))fail('当前工位未启用离线回放。',409);
   if(!rehearsalCameraIds.includes(body.cameraId)||typeof body.data!=='string'||body.data.length>2000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(body.data))fail('采集图像无效或过大。');
   const {state}=await read();let serviceResult=null;
   if(!presetVision&&state.vision?.enabled&&state.vision.baseUrl){
    const inspect=async send=>{
     const service=await preferredService(state.vision,send),flow=demo.manualFlows?.[body.stageIndex];
     const response=await send(serviceUrl(service.baseUrl)+'/inspect',{method:'POST',headers:{'Content-Type':'application/json',...(service.token?{Authorization:'Bearer '+service.token}:{})},body:JSON.stringify({requestId:body.bottleId+'-'+body.cameraId,bottleId:body.bottleId,batchId:'camera',caseId:flow?.caseId||'normal',images:[{cameraId:body.cameraId,data:body.data}]}),signal:AbortSignal.timeout(3000)});
     if(response.ok){const data=await response.json();const row=data?.demo===true&&data.bottleId===body.bottleId&&data.requestId===body.bottleId+'-'+body.cameraId?data.cameras?.find(c=>c.cameraId===body.cameraId):null;
      if(row&&['pass','reject'].includes(row.status)&&['opencvUrl','overlayUrl','heatmapUrl'].every(k=>typeof row[k]==='string'&&/^data:image[/](png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(row[k])))return {status:row.status,defects:row.defects||[],opencvUrl:row.opencvUrl,overlayUrl:row.overlayUrl,heatmapUrl:row.heatmapUrl,source:service.usingBackup?'backup':'primary'};
     }
    };
    try{serviceResult=localFallback?await withHandoffDeadline(fetcher,inspect):await inspect(fetcher);}catch{}
   }
   const current=await updateVisionDemo();if(!current.active||!current.stageIndices.includes(body.stageIndex))fail('当前工位未启用离线回放。',409);
   try{rehearsal.capture(body.stageIndex,body.bottleId,body.cameraId,body.data,Date.now(),serviceResult);}catch(e){fail(e.message,409);}
   return {ok:true,serviceSource:serviceResult?.source||'local-materials'};
  }
  if(p.endsWith('/vision-rehearsal-stop')&&write)return exclusive(async()=>{
   ops.requireRole(user,['admin','engineer','operator']);
   if(![2,5].includes(body.stageIndex))fail('请选择有效工位。');
   rehearsal.stop(body.stageIndex);await updateVisionDemo();return {ok:true};
  });
  if(p.endsWith('/vision-rehearsal-reset')&&write){ops.requireRole(user,['admin','engineer']);rehearsal.reset();return {ok:true};}
  if(p.endsWith('/vision-monitor')&&!write){ops.requireRole(user,['admin','engineer','operator','viewer']);return monitor();}
  if(p.endsWith('/commands')&&!write){const {state}=await read();return state.commands.filter(c=>c.actor===user.id);}
  if(p.endsWith('/command')&&write)return exclusive(async()=>{
   const {state}=await read(),cmd=state.commands?.find(c=>c.id===body.id);
   if(!cmd||cmd.actor!==user.id)fail('操作不存在或不属于当前用户。',403);
   if(cmd.status!=='pending')return cmd;
   if(body.action==='cancel'){cmd.status='cancelled';await save(state);await ops.log(user,'取消 AI 参数调整',cmd.title,'已取消',{category:'ai',requestId:cmd.id});return cmd;}
   if(body.action!=='confirm')fail('请选择确认或取消。');
   if(Date.now()-cmd.createdAt>300000){cmd.status='expired';await save(state);fail('确认已过期，请重新提问。',409);}
   const ctx=await context(req);
   if((cmd.kind==='line'?ctx.lineMode:cmd.kind==='data_mode'?ctx.dataMode:ctx.controls[cmd.controlId])!==cmd.before||ctx.dataMode!==cmd.mode||!!ctx.protocol?.enabled!==cmd.protocol){cmd.status='expired';await save(state);fail('设备参数或数据来源已变化，请重新提问。',409);}
   if(cmd.kind==='line'&&(cmd.taskId!==(ctx.activeTask?.id||null)||cmd.taskVersion!==(ctx.activeTask?.version??null))){cmd.status='expired';await save(state);fail('生产任务已变化，请重新生成整线控制方案。',409);}
   cmd.status='processing';await save(state);
   try{
    if(cmd.kind==='line'){
     const result=await ops.route({headers:req.headers,url:'/api/ops/line-control',method:'POST'},{},{action:cmd.value,confirmed:true});
     if(result.receipts?.some(r=>!r.ok))throw Error('部分设备未确认，请查看整线状态');
     const after=await context(req);cmd.readback=after.lineMode;
     if(cmd.value==='resume'?cmd.readback!=='running':cmd.readback==='running')throw Error('整线状态未达到目标：'+cmd.readback);
     cmd.status='completed';cmd.result='整线请求已处理，当前状态：'+cmd.readback+'；不代表生产任务已完成。';
    }else if(cmd.kind==='data_mode'){
     await ops.route({headers:req.headers,url:'/api/ops/data-mode',method:'POST'},{},{mode:cmd.value});
     cmd.readback=(await context(req)).dataMode;if(cmd.readback!==cmd.value)throw Error('数据模式回读不一致');
     cmd.status='completed';cmd.result='数据模式修改并回读一致。';
    }else{
     await ops.route({headers:req.headers,url:cmd.protocol?'/api/ops/protocol/control':'/api/ops/control',method:'POST'},{},{id:cmd.controlId,value:cmd.value,confirmed:true,reason:'人工确认 AI 建议 '+cmd.id+' / '+cmd.reason});
     const after=await context(req);cmd.readback=after.controls[cmd.controlId];
     if(typeof cmd.readback!=='number'||Math.abs(cmd.readback-cmd.value)>Math.max(.001,Math.abs(cmd.value)*1e-5))throw Error('参数回读不一致');
     cmd.status='completed';cmd.result='设定参数写入并回读一致；不代表机械动作已完成。';
    }
   }catch(e){cmd.status='failed';cmd.result=e.message;}
   cmd.finishedAt=Date.now();await save(state);await ops.log(user,'AI 建议参数调整结果',`${cmd.title} / ${cmd.reason} / ${cmd.result}`,cmd.status,commandLogMeta(cmd,ctx.capabilities));return cmd;
  });
  ops.requireRole(user,['admin','engineer']);
  if(p.endsWith('/capture-start')&&write){
   const base='http://127.0.0.1:8097';
   const ready=async()=>{try{const r=await fetcher(base+'/health',{signal:AbortSignal.timeout(800)});return r.ok&&(await r.json()).contract==='bottleworks-capture-v1';}catch{return false;}};
   if(await ready())return {baseUrl:base};
   let startupError='';
   const child=spawn(process.env.CAPTURE_PYTHON||'python',[fileURLToPath(new URL('./vision/camera_capture.py',import.meta.url))],{windowsHide:true,stdio:['ignore','ignore','pipe']});
   child.on('error',e=>{startupError=e.message;});child.stderr.on('data',data=>{startupError=(startupError+data.toString()).slice(-800);});child.unref();
   for(let i=0;i<12;i++){await new Promise(resolve=>setTimeout(resolve,500));if(await ready())return {baseUrl:base};}
   fail('采集服务未启动。请确认平台电脑的Python已安装opencv-python，可设置CAPTURE_PYTHON指定环境。'+(startupError.includes('Address already in use')?'端口8097被占用。':''),502);
  }
  if(p.endsWith('/capture-discover')&&write){
   const base=serviceUrl(body.baseUrl);
   const health=await requestService(base,'/health','',undefined,fetcher);
   if(health.contract!=='bottleworks-capture-v1')fail('此地址不是摄像头采集服务，请检查端口8097。',502);
   const data=await requestService(base,'/cameras','',undefined,fetcher);
   if(!Array.isArray(data.devices))fail('采集服务未返回设备列表。',502);
   return {devices:data.devices.filter(d=>/^\d{1,2}$/.test(d.id)).map(d=>({id:d.id,name:String(d.name||d.id),previewUrl:base+'/cameras/'+d.id+'/stream'}))};
  }
  if(p==='/api/ai/integrations'&&!write){const {state}=await read();return publicState(state);}
  if(p.endsWith('/config')&&write)return exclusive(async()=>{
   ops.requireRole(user,['admin']);if(!['coze','vision'].includes(body.kind))fail('未知接入类型。');
   const {state}=await read(),old=state[body.kind]||{},baseUrl=serviceUrl(body.baseUrl);
   if(!presetVision&&body.kind==='vision'&&state.visionJob&&!['stopped','completed','failed'].includes(state.visionJob.status)&&(baseUrl!==old.baseUrl||!body.enabled))fail('请先停止当前视觉任务，再停用或更换服务地址。',409);
   if(typeof body.enabled!=='boolean'||typeof body.workflowId!=='string'||body.workflowId.length>150)fail('配置格式错误。');
   if(body.botId!==undefined&&(typeof body.botId!=='string'||!/^\d{1,30}$|^$/.test(body.botId)))fail('智能体ID格式无效。');
   if(body.alarmWorkflowId!==undefined&&(typeof body.alarmWorkflowId!=='string'||!/^\d{1,30}$|^$/.test(body.alarmWorkflowId)))fail('批量告警工作流ID格式无效。');
   if(body.kind==='coze'&&body.enabled&&!body.workflowId.trim()&&!body.botId)fail('填写已发布智能体ID。');
   state[body.kind]={...(body.kind==='coze'?{alarmWorkflowId:body.alarmWorkflowId??old.alarmWorkflowId??''}:{}),agentName:String(body.agentName||old.agentName||'').slice(0,100),...(body.kind==='vision'?{assets:old.assets||{},mode:body.mode==='whole-bottle'?'whole-bottle':'legacy',cameraMode:body.cameraMode==='individual'?'individual':'shared',cameras:body.cameras?normalizeVisionCameras(body.cameras,baseUrl,serviceUrl):old.cameras}:{}),botId:body.kind==='coze'?(body.botId??old.botId??''):'',baseUrl,backupBaseUrl:body.backupBaseUrl?serviceUrl(body.backupBaseUrl):'',backupBotId:String(body.backupBotId||'').slice(0,30),backupWorkflowId:String(body.backupWorkflowId||'').slice(0,150),backupAlarmWorkflowId:String(body.backupAlarmWorkflowId||'').slice(0,30),backupToken:body.backupToken||(body.backupBaseUrl===old.backupBaseUrl?old.backupToken:''),enabled:body.enabled,workflowId:body.workflowId.trim(),version:String(body.version||'').slice(0,100),token:body.token|| (baseUrl===old.baseUrl?old.token:'')};
   await save(state);await ops.log(user,'保存'+body.kind+'服务配置','连接尚需测试');return publicState(state);
  });
  if(p.endsWith('/test')&&write){
   const {state,root}=await read();let detail;
   if(body.kind==='coze'){
    const out=state.coze.botId?await runNativeAgent({...state.coze,skills:readSkillConfig(root.skills)},req,'连接测试，请只回复连接成功，不调用工具。',{},[],fetcher):await runCoze({...state.coze,enabled:true},{question:'连接测试，请返回连接成功，不调用写入工具。',context:JSON.stringify({test:true,readOnly:true}),history:'[]'},fetcher);
    if(out.goalStatus==='incomplete')fail(out.answer,502);
    if(out.operation)fail('连接测试返回了写操作建议，未执行。',409);detail=out.answer;
   }else if(body.kind==='vision'){
    const selected=state.vision.mode==='whole-bottle'?null:state.vision.cameras?.find(c=>c.id===body.cameraId);const r=await requestService(selected?.baseUrl||state.vision.baseUrl,'/health',state.vision.token,undefined,fetcher);if(r.status!=='ready'||r.contract!=='bottleworks-vision-v1')fail('视觉服务未就绪或接口契约不匹配。',502);detail=`${r.engine||'视觉服务'} / ${r.version||'未报告版本'} · ${selected?.modelName||'整瓶检测'} · 连接测试通过`;
   }else fail('未知接入类型。');
   await ops.log(user,'服务连接测试',body.kind+' / '+detail);return {ok:true,detail,time:new Date().toISOString()};
  }
  if(p.endsWith('/package-folder')&&write){
   ops.requireRole(user,['admin']);
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress))fail('请在平台电脑上打开文件夹。',403);
   const {state}=await read(),item=state.packages.find(x=>x.id===body.id);if(!item)fail('文件不存在。',404);
   const target=path.join(uploadRoot,item.id);await fs.access(target);
   if(process.platform!=='win32')fail('当前系统不支持资源管理器。',409);
   await new Promise((resolve,reject)=>{const child=spawn('explorer.exe',[target],{windowsHide:true});child.once('error',reject);child.once('spawn',resolve);});
   return {ok:true};
  }
  if(p.endsWith('/vision-assets')&&write)return exclusive(async()=>{
   ops.requireRole(user,['admin']);const {state}=await read();
   if(state.visionJob&&!['stopped','completed','failed'].includes(state.visionJob.status))fail('先停止检测，再更换模型或程序。',409);
   const selections={};
   if(Array.isArray(body.models)&&Array.isArray(body.programs)){
    const ids=new Set();for(const group of ['models','programs']){
     if(body[group].length>32)fail('每类最多添加32项。');
     selections[group]=body[group].map(row=>{
      if(!row||typeof row.id!=='string'||!row.id||row.id.length>100||ids.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>100)fail('请为每项填写名称，且条目标识不能重复。');ids.add(row.id);
      if(!state.packages.some(p=>p.id===row.packageId&&p.kind==='vision'&&(group==='programs'?p.slot==='program':['model','yolo','patchcore'].includes(p.slot))))fail('请选择对应类别的文件。');
      return {id:row.id,name:row.name.trim(),packageId:row.packageId};
     });
    }
   }else{
    for(const slot of ['yolo','patchcore','program']){const id=body[slot]||'';if(id&&!state.packages.some(x=>x.id===id&&x.kind==='vision'&&x.slot===slot))fail('请选择对应槽位的文件。');selections[slot]=id;}
   }
   state.vision.assets=selections;await save(state);return {ok:true};
  });
  if(p.endsWith('/package')&&write)return exclusive(async()=>{
   if(!['coze','vision'].includes(body.kind)||typeof body.name!=='string'||!body.name.trim()||body.name.length>180||typeof body.data!=='string'||!body.data.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data))fail('请选择有效的交付文件。');
   const bytes=Buffer.from(body.data,'base64');if(bytes.length>24*1024*1024)fail('单个交付文件不能超过24MB。',413);
   if(body.kind==='vision'&&body.slot!==undefined&&!['model','yolo','patchcore','program'].includes(body.slot))fail('请选择模型或程序槽位。');
   if(['.','..',''].includes(path.basename(body.name)))fail('文件名无效。');
   const item={id:randomUUID(),slot:body.slot,kind:body.kind,name:path.basename(body.name),size:bytes.length,version:String(body.version||'未标注').slice(0,100),status:'uploaded',createdAt:new Date().toISOString()};
   await fs.mkdir(uploadRoot,{recursive:true});await fs.mkdir(path.join(uploadRoot,item.id),{recursive:true});await fs.writeFile(path.join(uploadRoot,item.id,item.name),bytes);
   const {state}=await read();state.packages=[item,...state.packages||[]];await save(state);
   await ops.log(user,'上传交付成果',item.kind+' / '+item.name+'；文件已保存，尚未在服务中加载');return item;
  });
  if(p.endsWith('/activate')&&write)return exclusive(async()=>{
   const {state}=await read(),item=state.packages.find(x=>x.id===body.id);if(!item)fail('交付文件不存在。',404);
   if(item.kind==='coze')fail('Coze 原生工作流请在 Coze Studio 中导入并发布，然后在本页填写工作流标识并测试连接。文件保存不代表已发布。',409);
   if(presetVision)fail('视觉交付文件可保存，四路联合检测使用预置处理图。',409);
   const file=path.join(uploadRoot,item.id);const data=(await fs.readFile((await fs.stat(file)).isDirectory()?path.join(file,item.name):file)).toString('base64');
   const camera=state.vision.cameras?.find(c=>c.id===body.cameraId);const r=await requestService(camera?.baseUrl||state.vision.baseUrl,'/packages/load',state.vision.token,{name:item.name,version:item.version,data,modelName:camera?.modelName,cameraId:body.cameraId,slot:item.slot,packageId:item.id},fetcher);
   if(r.status!=='ready'||!r.version)fail('视觉服务未确认模型加载完成。',502);
   item.status='loaded';item.loadedVersion=r.version;state.vision.version=r.version;await save(state);await ops.log(user,'视觉成果加载',item.name+' / '+r.version);return item;
  });
  if(p.endsWith('/vision-job')&&write)return exclusive(async()=>{
   if(presetVision)fail('请在工位终端的四路联合检测中开始检测。',409);
   const {state}=await read(),v=state.vision;
   if(!v.enabled||v.mode!=='whole-bottle')fail('请先保存并启用整瓶视觉服务。',409);
   if(!['start','status','stop'].includes(body.action))fail('未知检测任务操作。');
   if(body.action==='start'&&state.visionRehearsal?.enabled&&(!localFallback||(await updateVisionDemo()).active))fail('请先关闭预置结果展示，再启动真实视觉检测任务。',409);
   const health=await requestService(v.baseUrl,'/health',v.token,undefined,fetcher);
   if(health.contract!=='bottleworks-vision-v1'||!health.capabilities?.includes('inspection-jobs-v1'))fail('外部视觉服务尚未提供连续采集任务接口；仍可上传图片测试。',409);
   let job=state.visionJob;
   if(body.action==='start'){
    if(job&&!['stopped','completed','failed'].includes(job.status))fail('已有检测任务，请先查询或停止。',409);
    if(typeof body.batchId!=='string'||!body.batchId.trim()||body.batchId.length>120)fail('请填写批次编号。');
    job=await requestService(v.baseUrl,'/jobs/start',v.token,{requestId:randomUUID(),batchId:body.batchId.trim(),assets:v.assets||{}},fetcher);
    if(typeof job.jobId!=='string'||!job.jobId||job.batchId!==body.batchId.trim())fail('服务未返回有效任务编号和批次。',502);
    job={...job,baseUrl:v.baseUrl};
   }else{
    if(!job?.jobId)fail('没有已保存的检测任务。',409);
    if(job.baseUrl!==v.baseUrl)fail('服务地址已变化，请恢复原地址管理原任务。',409);
    const response=await requestService(v.baseUrl,'/jobs/'+encodeURIComponent(job.jobId)+(body.action==='stop'?'/stop':''),v.token,body.action==='stop'?{}:undefined,fetcher);
    if(response.jobId!==job.jobId||response.batchId!==job.batchId)fail('返回的任务编号或批次不一致。',502);
    if(response.results!==undefined&&!Array.isArray(response.results))fail('任务结果格式无效。',502);
    for(const raw of response.results||[]){
     if(raw.batchId!==job.batchId||!raw.requestId||!raw.bottleId)fail('任务检测记录缺少编号或批次不一致。',502);
     const checked=validateInspection({...raw,images:cameraIds.map(cameraId=>({cameraId}))},raw);
     if(!state.records.some(r=>r.requestId===checked.requestId))state.records.unshift({...checked,status:'completed',createdAt:new Date().toISOString(),jobId:job.jobId});
    }
    job={...job,...response,results:undefined};state.records=state.records.slice(0,200);
   }
   if(!['running','stopped','completed','failed','starting','stopping'].includes(job.status))fail('服务返回任务状态无效。',502);
   state.visionJob=job;await save(state);await ops.log(user,'外部视觉任务',body.action+' / '+job.jobId);return job;
  });
  if(p.endsWith('/inspect')&&write){
   for(const k of ['requestId','bottleId','batchId'])if(typeof body[k]!=='string'||!body[k].trim()||body[k].length>120)fail('填写有效的请求、瓶子与批次编号。');
   if(!Array.isArray(body.images)||body.images.length>4||new Set(body.images.map(i=>i.cameraId)).size!==body.images.length||body.images.some(i=>!cameraIds.includes(i.cameraId)||typeof i.data!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(i.data)||i.data.length>2000000))fail('每个机位上传一张不超过1.4MB的PNG/JPEG/WebP图片。');
   return exclusive(async()=>{
    const {state:latest}=await read(),prior=latest.records.find(r=>r.requestId===body.requestId);
    const stageIndex=body.stageIndex===5?5:2,snapshot=ops.snapshot?.();
    const local=presetVision||(localFallback&&!snapshot?.protocol?.enabled&&(snapshot?.dataMode==='simulation'||(snapshot?.dataMode==='mixed'&&snapshot.states?.[stageIndex]?.source==='simulation')));
    const online=latest.vision.enabled&&latest.vision.baseUrl;
    if(!local&&!online)fail('请先配置并启用视觉服务。',409);
    const caseId=body.caseId==='defect'?'defect':'normal';
    const fingerprint=createHash('sha256').update(JSON.stringify({bottleId:body.bottleId,batchId:body.batchId,...(caseId==='defect'?{caseId}:{}),images:[...body.images].sort((a,b)=>a.cameraId.localeCompare(b.cameraId))})).digest('hex');
    if(prior){if(prior.fingerprint!==fingerprint||(!local&&prior.serviceSource==='local-materials')||(presetVision&&prior.serviceSource!=='local-materials'))fail('请求编号已用于不同输入或检测模式，复测请使用新编号。',409);return prior;}
    const input={requestId:body.requestId,bottleId:body.bottleId,batchId:body.batchId,images:body.images,caseId,version:latest.vision.version};
    const record={fingerprint,requestId:input.requestId,bottleId:input.bottleId,batchId:input.batchId,createdAt:new Date().toISOString(),version:input.version};
    const inspect=async send=>{
     const service=await preferredService(latest.vision,send),result=await inspectCameraServices(service,input,(...args)=>requestService(...args,send));
     return {...validateInspection(input,result),status:'completed',serviceSource:service.usingBackup?'backup':'primary'};
    };
    if(!presetVision)try{
     if(!online)throw Error('未配置视觉服务');
     Object.assign(record,local?await withHandoffDeadline(fetcher,inspect):await inspect(fetcher));
    }catch(e){
     if(!local){record.status='failed';record.verdict=null;record.error=e.message;}
    }
    if(local&&record.status!=='completed'){
      const preset=validateRehearsal(latest.visionRehearsal||rehearsalDefaults()).cases.find(row=>row.id===caseId);
      const cameras=preset.cameras.map(c=>input.images.some(i=>i.cameraId===c.cameraId)?{cameraId:c.cameraId,status:c.status,defects:c.defects,opencvUrl:c.images.opencv,overlayUrl:c.images.yolo,heatmapUrl:c.images.patchcore}:{cameraId:c.cameraId,status:'missing'});
      Object.assign(record,{cameras,status:'completed',verdict:cameras.some(c=>c.status==='reject')?'reject':cameras.some(c=>c.status==='missing')?'review':'pass',reason:presetVision?'四路检测结果已汇总。':'外部检测未返回结果，已显示本地预置检测素材。',version:'rehearsal-1',demo:true,serviceSource:'local-materials'});
    }
    record.stageIndex=stageIndex;record.source='camera-capture';
    record.cameras=cameraIds.map(cameraId=>{const result=record.cameras?.find(c=>c.cameraId===cameraId),frame=input.images.find(i=>i.cameraId===cameraId);return {...(result||{cameraId,status:frame?'error':'missing',reason:record.error||'未收到本机位图像'}),originalUrl:frame?.data||null,capturedAt:frame?record.createdAt:null};});
    latest.records=[record,...latest.records].slice(0,200);await save(latest);await ops.log(user,'四机位检测',`${record.batchId} / ${record.bottleId} / ${record.verdict||record.error}`,record.status,{category:'vision',requestId:record.requestId});return record;
   });
  }
  fail('接入接口不存在。',404);
 }
 const agentTool=(req,name,args,signal)=>createAgentTools(ops,req,{commands:async()=>{const {state}=await read();return state.commands.filter(c=>c.actor===ops.actor(req).id).slice(0,20);},proposal:o=>proposal(req,{operation:o},signal)})(name,args);
 return {route,chat,read,agentTool,batchAlarmReport,updateVisionDemo,runtime:inference.status,setAlarmSource:fn=>{alarmSource=fn;}};
}

// Keep assistant confirmations in the same station audit stream as automatic decisions.
export function commandLogMeta(cmd,capabilities){
 const c=capabilities.find(c=>c.id===cmd.controlId);
 return {category:'ai',source:'assistant',requestId:cmd.id,stageIndex:c?.stageIndex??cmd.stageIndex??null,
  before:{value:cmd.before},after:{command:{id:cmd.id,status:cmd.status,reason:cmd.reason,value:cmd.value,readback:cmd.readback},execution:cmd.result,
   changes:cmd.kind==='parameter'?[{device:cmd.device||c?.device,parameter:cmd.title,before:cmd.before,after:cmd.readback??cmd.before,requested:cmd.value,unit:cmd.unit}]:[]}};
}
