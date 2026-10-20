import {normalizeVisionCameras,inspectCameraServices} from './vision-config.mjs';
import {readSkillConfig} from './skill-config.mjs';
import {parseSkillCommand} from './src/assistantSkills.js';
import {runNativeAgent} from './coze-agent.mjs';
import {runAgent,createAgentTools} from './assistant-agent.mjs';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
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
  for(const key of ['imageUrl','heatmapUrl','overlayUrl'])if(c[key]&&!/^https?:\/\//.test(c[key])&&!/^data:image\/(png|jpeg|webp);base64,/.test(c[key]))fail('检测证据图片地址无效。',502);
 }
 const missing=cameraIds.filter(id=>!supplied.includes(id)||!ids.includes(id)||result.cameras.find(c=>c.cameraId===id)?.status==='missing');
 const verdict=result.cameras.some(c=>c.status==='reject')?'reject':missing.length||result.cameras.some(c=>c.status!=='pass')?'review':'pass';
 if(result.verdict!==verdict)fail('整瓶判定不符合四机位规则，未按通过结果入库。',502);
 return {...result,missing,verdict};
}

// Stored alongside the existing AI configuration in MySQL; uploaded files are private.
export function createIntegrations(ops,{uploadRoot=path.resolve('.runtime/handoffs'),fetcher=fetch}={}){
 let queue=Promise.resolve();
 const exclusive=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const read=async()=>{const root=await ops.getAIConfig()||{};return {root,state:{coze:{enabled:false},vision:{enabled:false},packages:[],records:[],commands:[],...root.integrations}};};
 const save=async state=>{const latest=await ops.getAIConfig()||{};await ops.setAIConfig({...latest,integrations:state});};
 const publicState=s=>({...s,coze:{...s.coze,token:undefined,tokenConfigured:!!s.coze.token},vision:{...s.vision,token:undefined,tokenConfigured:!!s.vision.token},commands:undefined});
 const context=async req=>ops.route({headers:req.headers,url:'/api/ops/context',method:'GET'},{},{});
 async function proposal(req,out){
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
  await exclusive(async()=>{const {state}=await read();state.commands=[cmd,...state.commands||[]].slice(0,200);await save(state);});
  await ops.log(ops.actor(req),'AI 提出参数调整',`${cmd.device} / ${cmd.title} → ${cmd.value}，等待人工确认`,'待确认',{category:'ai',requestId:cmd.id});return cmd;
 }
 async function chat(req,question,ctx,history=[]){
  const {state,root}=await read();if(!state.coze.enabled)return null;
  if(state.coze.botId)return runNativeAgent({...state.coze,skills:readSkillConfig(root.skills)},req,question,ctx,history,fetcher);
  if(parseSkillCommand(question,ctx,readSkillConfig(root.skills)))throw Error('技能需要配置已发布的原生智能体 ID。');
  const result=await runAgent({question,context:ctx,history,
   decide:(agentContext,h)=>runCoze(state.coze,{question,context:JSON.stringify(agentContext),history:JSON.stringify(h)},fetcher),
   execute:createAgentTools(ops,req,{commands:async()=>{const {state}=await read();return state.commands.filter(c=>c.actor===ops.actor(req).id).slice(0,20);},proposal:o=>proposal(req,{operation:o})})});
  await ops.log(ops.actor(req),'智能体工具查询',JSON.stringify(result.trace.map(t=>({tool:t.tool,status:t.status,at:t.at}))),result.goalStatus,{category:'ai'});
  return {...result,snapshotAt:ctx.updated};
 }
 async function route(req,body){
  const p=req.url.split('?')[0],write=req.method==='POST',user=ops.actor(req);
  if(!p.startsWith('/api/ai/integrations'))return undefined;
  if(!['GET','POST'].includes(req.method))fail('不支持的请求方法。',405);
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
  if(p==='/api/ai/integrations'&&!write){const {state}=await read();return publicState(state);}
  if(p.endsWith('/config')&&write)return exclusive(async()=>{
   ops.requireRole(user,['admin']);if(!['coze','vision'].includes(body.kind))fail('未知接入类型。');
   const {state}=await read(),old=state[body.kind]||{},baseUrl=serviceUrl(body.baseUrl);
   if(typeof body.enabled!=='boolean'||typeof body.workflowId!=='string'||body.workflowId.length>150)fail('配置格式错误。');
   if(body.botId!==undefined&&(typeof body.botId!=='string'||!/^\d{1,30}$|^$/.test(body.botId)))fail('智能体ID格式无效。');
   if(body.kind==='coze'&&body.enabled&&!body.workflowId.trim()&&!body.botId)fail('填写已发布智能体ID。');
   state[body.kind]={agentName:String(body.agentName||old.agentName||'').slice(0,100),...(body.kind==='vision'?{cameraMode:body.cameraMode==='individual'?'individual':'shared',cameras:body.cameras?normalizeVisionCameras(body.cameras,baseUrl,serviceUrl):old.cameras}:{}),botId:body.kind==='coze'?(body.botId??old.botId??''):'',baseUrl,enabled:body.enabled,workflowId:body.workflowId.trim(),version:String(body.version||'').slice(0,100),token:body.token|| (baseUrl===old.baseUrl?old.token:'')};
   await save(state);await ops.log(user,'保存'+body.kind+'服务配置','连接尚需测试');return publicState(state);
  });
  if(p.endsWith('/test')&&write){
   const {state,root}=await read();let detail;
   if(body.kind==='coze'){
    const out=state.coze.botId?await runNativeAgent({...state.coze,skills:readSkillConfig(root.skills)},req,'连接测试，请只回复连接成功，不调用工具。',{},[],fetcher):await runCoze({...state.coze,enabled:true},{question:'连接测试，请返回连接成功，不调用写入工具。',context:JSON.stringify({test:true,readOnly:true}),history:'[]'},fetcher);
    if(out.goalStatus==='incomplete')fail(out.answer,502);
    if(out.operation)fail('连接测试返回了写操作建议，未执行。',409);detail=out.answer;
   }else if(body.kind==='vision'){
    const selected=state.vision.cameras?.find(c=>c.id===body.cameraId);const r=await requestService(selected?.baseUrl||state.vision.baseUrl,'/health',state.vision.token,undefined,fetcher);if(r.status!=='ready'||r.contract!=='bottleworks-vision-v1')fail('视觉服务未就绪或接口契约不匹配。',502);detail=`${r.engine||'视觉服务'} / ${r.version||'未报告版本'} · ${selected?.modelName||'默认模型'} · 仅连接测试，需图像识别验证`;
   }else fail('未知接入类型。');
   await ops.log(user,'服务连接测试',body.kind+' / '+detail);return {ok:true,detail,time:new Date().toISOString()};
  }
  if(p.endsWith('/package')&&write)return exclusive(async()=>{
   if(!['coze','vision'].includes(body.kind)||typeof body.name!=='string'||!body.name.trim()||body.name.length>180||typeof body.data!=='string'||!body.data.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data))fail('请选择有效的交付文件。');
   const bytes=Buffer.from(body.data,'base64');if(bytes.length>24*1024*1024)fail('单个交付文件不能超过24MB。',413);
   const item={id:randomUUID(),kind:body.kind,name:path.basename(body.name),size:bytes.length,version:String(body.version||'未标注').slice(0,100),status:'uploaded',createdAt:new Date().toISOString()};
   await fs.mkdir(uploadRoot,{recursive:true});await fs.writeFile(path.join(uploadRoot,item.id),bytes);
   const {state}=await read();state.packages=[item,...state.packages||[]];await save(state);
   await ops.log(user,'上传交付成果',item.kind+' / '+item.name+'；文件已保存，尚未在服务中加载');return item;
  });
  if(p.endsWith('/activate')&&write)return exclusive(async()=>{
   const {state}=await read(),item=state.packages.find(x=>x.id===body.id);if(!item)fail('交付文件不存在。',404);
   if(item.kind==='coze')fail('Coze 原生工作流请在 Coze Studio 中导入并发布，然后在本页填写工作流标识并测试连接。文件保存不代表已发布。',409);
   const data=(await fs.readFile(path.join(uploadRoot,item.id))).toString('base64');
   const camera=state.vision.cameras?.find(c=>c.id===body.cameraId);const r=await requestService(camera?.baseUrl||state.vision.baseUrl,'/packages/load',state.vision.token,{name:item.name,version:item.version,data,modelName:camera?.modelName,cameraId:body.cameraId},fetcher);
   if(r.status!=='ready'||!r.version)fail('视觉服务未确认模型加载完成。',502);
   item.status='loaded';item.loadedVersion=r.version;state.vision.version=r.version;await save(state);await ops.log(user,'视觉成果加载',item.name+' / '+r.version);return item;
  });
  if(p.endsWith('/inspect')&&write){
   const {state}=await read();if(!state.vision.enabled)fail('请先配置并启用视觉服务。',409);
   for(const k of ['requestId','bottleId','batchId'])if(typeof body[k]!=='string'||!body[k].trim()||body[k].length>120)fail('填写有效的请求、瓶子与批次编号。');
   if(!Array.isArray(body.images)||body.images.length>4||new Set(body.images.map(i=>i.cameraId)).size!==body.images.length||body.images.some(i=>!cameraIds.includes(i.cameraId)||typeof i.data!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(i.data)||i.data.length>2000000))fail('每个机位上传一张不超过1.4MB的PNG/JPEG/WebP图片。');
   return exclusive(async()=>{
    const {state:latest}=await read(),prior=latest.records.find(r=>r.requestId===body.requestId);
    const fingerprint=createHash('sha256').update(JSON.stringify({bottleId:body.bottleId,batchId:body.batchId,images:[...body.images].sort((a,b)=>a.cameraId.localeCompare(b.cameraId))})).digest('hex');
    if(prior){if(prior.fingerprint!==fingerprint)fail('请求编号已用于不同输入，复测请使用新编号。',409);return prior;}
    const input={requestId:body.requestId,bottleId:body.bottleId,batchId:body.batchId,images:body.images,version:latest.vision.version};
    const record={fingerprint,requestId:input.requestId,bottleId:input.bottleId,batchId:input.batchId,createdAt:new Date().toISOString(),version:input.version};
    try{const result=await inspectCameraServices(latest.vision,input,(...args)=>requestService(...args,fetcher));Object.assign(record,validateInspection(input,result),{status:'completed'});}catch(e){record.status='failed';record.verdict=null;record.error=e.message;}
    latest.records=[record,...latest.records].slice(0,200);await save(latest);await ops.log(user,'四机位检测',`${record.batchId} / ${record.bottleId} / ${record.verdict||record.error}`,record.status,{category:'vision',requestId:record.requestId});return record;
   });
  }
  fail('接入接口不存在。',404);
 }
 const agentTool=(req,name,args)=>createAgentTools(ops,req,{commands:async()=>{const {state}=await read();return state.commands.filter(c=>c.actor===ops.actor(req).id).slice(0,20);},proposal:o=>proposal(req,{operation:o})})(name,args);
 return {route,chat,read,agentTool};
}

// Keep assistant confirmations in the same station audit stream as automatic decisions.
export function commandLogMeta(cmd,capabilities){
 const c=capabilities.find(c=>c.id===cmd.controlId);
 return {category:'ai',source:'assistant',requestId:cmd.id,stageIndex:c?.stageIndex??cmd.stageIndex??null,
  before:{value:cmd.before},after:{command:{id:cmd.id,status:cmd.status,reason:cmd.reason,value:cmd.value,readback:cmd.readback},execution:cmd.result,
   changes:cmd.kind==='parameter'?[{device:cmd.device||c?.device,parameter:cmd.title,before:cmd.before,after:cmd.readback??cmd.before,requested:cmd.value,unit:cmd.unit}]:[]}};
}
