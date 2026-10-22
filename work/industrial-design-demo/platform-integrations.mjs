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
 if(!['pass','review','reject'].includes(result.verdict))fail('整瓶判定无效。',502);
 if(result.verdict==='pass'&&(missing.length||result.cameras.some(c=>c.status!=='pass')||result.coverageComplete===false||result.modelsReady===false||[result.body,result.cap].some(r=>r&&r.status!=='pass')))fail('整瓶通过结果缺少完整检测依据，未入库。',502);
 for(const key of ['panoramaUrl','overlayUrl','heatmapUrl'])if(result[key]&&!/^https?:\/\//.test(result[key])&&!/^data:image\/(png|jpeg|webp);base64,/.test(result[key]))fail('检测证据图片地址无效。',502);
 return {...result,missing};
}

// Stored alongside the existing AI configuration in MySQL; uploaded files are private.
export function createIntegrations(ops,{uploadRoot=path.resolve('.runtime/handoffs'),fetcher=fetch}={}){
 let monitorPending=null,monitorAt=0,monitorError='';
 async function monitor(){
  if(!monitorPending&&Date.now()-monitorAt>2000){
   monitorPending=exclusive(async()=>{
    const {state}=await read(),job=state.visionJob,v=state.vision;
    monitorError='';
    if(!v.enabled||!job||!['starting','running','stopping'].includes(job.status))return;
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
  const {state}=await read();return {enabled:!!state.vision.enabled,records:state.records,job:state.visionJob?{jobId:state.visionJob.jobId,status:state.visionJob.status}:null,error:monitorError,checkedAt:monitorAt};
 }
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
   if(body.kind==='vision'&&state.visionJob&&!['stopped','completed','failed'].includes(state.visionJob.status)&&(baseUrl!==old.baseUrl||!body.enabled))fail('请先停止当前视觉任务，再停用或更换服务地址。',409);
   if(typeof body.enabled!=='boolean'||typeof body.workflowId!=='string'||body.workflowId.length>150)fail('配置格式错误。');
   if(body.botId!==undefined&&(typeof body.botId!=='string'||!/^\d{1,30}$|^$/.test(body.botId)))fail('智能体ID格式无效。');
   if(body.kind==='coze'&&body.enabled&&!body.workflowId.trim()&&!body.botId)fail('填写已发布智能体ID。');
   state[body.kind]={agentName:String(body.agentName||old.agentName||'').slice(0,100),...(body.kind==='vision'?{assets:old.assets||{},mode:body.mode==='whole-bottle'?'whole-bottle':'legacy',cameraMode:body.cameraMode==='individual'?'individual':'shared',cameras:body.cameras?normalizeVisionCameras(body.cameras,baseUrl,serviceUrl):old.cameras}:{}),botId:body.kind==='coze'?(body.botId??old.botId??''):'',baseUrl,enabled:body.enabled,workflowId:body.workflowId.trim(),version:String(body.version||'').slice(0,100),token:body.token|| (baseUrl===old.baseUrl?old.token:'')};
   await save(state);await ops.log(user,'保存'+body.kind+'服务配置','连接尚需测试');return publicState(state);
  });
  if(p.endsWith('/test')&&write){
   const {state,root}=await read();let detail;
   if(body.kind==='coze'){
    const out=state.coze.botId?await runNativeAgent({...state.coze,skills:readSkillConfig(root.skills)},req,'连接测试，请只回复连接成功，不调用工具。',{},[],fetcher):await runCoze({...state.coze,enabled:true},{question:'连接测试，请返回连接成功，不调用写入工具。',context:JSON.stringify({test:true,readOnly:true}),history:'[]'},fetcher);
    if(out.goalStatus==='incomplete')fail(out.answer,502);
    if(out.operation)fail('连接测试返回了写操作建议，未执行。',409);detail=out.answer;
   }else if(body.kind==='vision'){
    const selected=state.vision.mode==='whole-bottle'?null:state.vision.cameras?.find(c=>c.id===body.cameraId);const r=await requestService(selected?.baseUrl||state.vision.baseUrl,'/health',state.vision.token,undefined,fetcher);if(r.status!=='ready'||r.contract!=='bottleworks-vision-v1')fail('视觉服务未就绪或接口契约不匹配。',502);detail=`${r.engine||'视觉服务'} / ${r.version||'未报告版本'} · ${selected?.modelName||'整瓶检测'} · 仅连接测试，需图像识别验证`;
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
   const file=path.join(uploadRoot,item.id);const data=(await fs.readFile((await fs.stat(file)).isDirectory()?path.join(file,item.name):file)).toString('base64');
   const camera=state.vision.cameras?.find(c=>c.id===body.cameraId);const r=await requestService(camera?.baseUrl||state.vision.baseUrl,'/packages/load',state.vision.token,{name:item.name,version:item.version,data,modelName:camera?.modelName,cameraId:body.cameraId,slot:item.slot,packageId:item.id},fetcher);
   if(r.status!=='ready'||!r.version)fail('视觉服务未确认模型加载完成。',502);
   item.status='loaded';item.loadedVersion=r.version;state.vision.version=r.version;await save(state);await ops.log(user,'视觉成果加载',item.name+' / '+r.version);return item;
  });
  if(p.endsWith('/vision-job')&&write)return exclusive(async()=>{
   const {state}=await read(),v=state.vision;
   if(!v.enabled||v.mode!=='whole-bottle')fail('请先保存并启用整瓶视觉服务。',409);
   if(!['start','status','stop'].includes(body.action))fail('未知检测任务操作。');
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
