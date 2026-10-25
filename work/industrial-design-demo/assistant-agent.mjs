import {stages} from './src/data.js';
const beijingTime=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'})+'+08:00':null;

// Only these server-owned tools are reachable. The model cannot choose an HTTP route.
export const agentTools=[
 {name:'search_knowledge',description:'检索已审核资料，返回依据和版本',arguments:{query:'必填字符串',device_model:'可选设备编号/型号',alarm_code:'可选告警编码'}},
 {name:'query_products',description:'产品与当前批次、任务计划和完成量',arguments:{}},
 {name:'query_devices',description:'设备实测数据、设定参数及允许的参数编号；可按关键词筛选',arguments:{query:'可选设备或参数关键词'}},
 {name:'query_production',description:'按日期查询当前数据模式的历史产量和小时分布，缺记录不算零',arguments:{from:'必填 YYYY-MM-DD',to:'必填 YYYY-MM-DD'}},
 {name:'query_logs',description:'当前未恢复告警和近期记录；默认告警日志，可选控制或任务记录；不是完整历史',arguments:{category:'可选 alarm/control/task，默认alarm'}},
 {name:'query_tasks',description:'当前角色可见的工程任务及其进度',arguments:{}},
 {name:'query_configuration',description:'查看当前数据模式与设备连接状态，不提供凭证',arguments:{}},
 {name:'query_commands',description:'查询当前用户的确认单和执行回读结果',arguments:{}},
 {name:'propose_change',description:'仅生成待人工确认单，不执行。一次一项，先查当前值；确认后由后端执行并回读',arguments:{kind:'parameter | line | data_mode',controlId:'parameter 时必填查询获得的编号',value:'参数数字，或 line 的 pause/resume，或 data_mode 的 simulation/real',reason:'必填变更原因'}}
];

export async function runAgent({question,context={},history=[],decide,execute,maxTurns=6,deadlineMs=150000}){
 const trace=[],started=Date.now(),seen=new Set();let repeated=false;
 for(let turn=0;turn<maxTurns;turn++){
  if(Date.now()-started>deadlineMs)break;
  let out;
  try{out=await decide({agentProtocol:1,tools:agentTools,selection:context.selectionLocked?context.target:null,now:new Date().toISOString(),trace},history);}
  catch(e){trace.push({tool:'decision',at:new Date().toISOString(),status:'error',result:{error:'决策节点返回无效或失败，请按工具协议重试，不得声称已操作。'}});if(turn>=2)return {answer:'决策服务未能返回有效结果，本次已停止，没有自动执行控制。',trace,goalStatus:'blocked'};continue;}
  if(!Array.isArray(out.tool_calls))throw Error('智能体输出缺少工具协议，未执行任何控制。');
  if(!out.tool_calls.length){
   const needsEvidence=!!context.selectionLocked||(/(当前|今天|昨日|昨天|查询|查看|生产了|告警|暂停|启动|切换|调整)/.test(question)&&/(产线|工位|设备|产量|生产|VOC|告警|水洗|风洗|灌装|任务|批次|数据模式|数据来源)/i.test(question));
   if(needsEvidence&&!trace.some(t=>t.status==='success')){
    trace.push({tool:'evidence_check',at:new Date().toISOString(),status:'error',result:{error:'尚未查询到现场依据，不接受无依据的结论。请选择工具查询，无法查询就保持目标未完成。'}});continue;
   }
   return {answer:out.answer,trace,goalStatus:out.goalStatus==='completed'?'completed':'needs_information',model:'Coze Studio · 工具循环'};
  }
  if(out.tool_calls.length>3||out.tool_calls.some(c=>c.name==='propose_change')&&out.tool_calls.length!==1)throw Error('写入建议必须单独生成；只读工具单轮最多三个。');
  for(const call of out.tool_calls){
   const entry={tool:call.name,at:new Date().toISOString(),arguments:call.arguments||{}};
   const signature=JSON.stringify([call.name,entry.arguments]);
   if(seen.has(signature)){
    if(repeated||call.name==='propose_change')return {answer:'重复查询没有取得新进展，已停止。请补充条件或稍后重试。',trace,goalStatus:'blocked'};
    repeated=true;trace.push({...entry,status:'cached',result:{note:'相同查询已经返回，原结果在前面的trace中。请直接依据已有结果回答，或选择其他必要工具；不能无限重复。'}});continue;
   }
   seen.add(signature);
   try{
    if(!agentTools.some(t=>t.name===call.name))throw Error('工具不在允许列表内');
    const result=await execute(call.name,entry.arguments);entry.result=result;entry.status='success';trace.push(entry);
    if(call.name==='propose_change')return {answer:'已生成变更方案，请核对下方修改内容后确认。尚未执行。',operation:result,trace,goalStatus:'awaiting_confirmation',model:'Coze Studio · 工具循环'};
   }catch(e){entry.status='error';entry.result={error:e.message};trace.push(entry);}
  }
 }
 return {answer:'已达到本次查询上限，目标尚未完成。请查看查询记录并缩小范围后继续。',trace,goalStatus:'incomplete',model:'Coze Studio · 工具循环'};
}

export function createAgentTools(ops,req,{proposal,commands}){
 const get=url=>ops.route({headers:req.headers,url,method:'GET'},{},{});
 const task=t=>({id:t.id,name:t.name,productId:t.productId,status:t.status,plan:t.plan,done:t.done,version:t.version,updatedAt:t.updatedAt});
 return async(name,args)=>{
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('工具参数必须是对象');
  const spec=agentTools.find(t=>t.name===name);if(!spec)throw Error('未知工具');
  if(Object.keys(args).some(k=>!(k in spec.arguments)))throw Error('存在未知工具参数');
  switch(name){
   case 'search_knowledge':if(typeof args.query!=='string'||!args.query.trim()||args.query.length>500)throw Error('请提供检索关键词');{const r=await fetch('http://127.0.0.1:8891/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('知识检索服务不可用');return r.json();}
   case 'query_products':{const c=await get('/api/ops/context');return {products:c.products.slice(0,30).map(p=>({id:p.id,name:p.name,code:p.code,category:p.category,spec:p.spec,ingredients:p.ingredients,recipeId:p.recipeId,enabled:p.enabled,version:p.version})),materials:(c.materials||[]).slice(0,40).map(m=>({id:m.id,name:m.name,unit:m.unit,quantity:m.quantity})),recipes:(c.documents||[]).filter(d=>d.kind==='recipe'&&d.status==='published').slice(0,20).map(d=>({id:d.id,title:d.title,productCode:d.productCode,version:d.version,settings:d.settings})),activeTask:c.activeTask?task(c.activeTask):null,tasks:c.tasks.slice(0,30).map(task),coverage:'当前快照：最多30个产品、40种物料、20份已发布配方和30个任务；未填写的字段未知，不能按展示图猜测。'};}
   case 'query_devices':{
    if(args.query!==undefined&&typeof args.query!=='string')throw Error('关键词必须为字符串');
    const c=await get('/api/ops/context'),s=ops.snapshot(),normalize=v=>String(v).replace(/\s/g,'').toLowerCase(),q=normalize(args.query||'');
    const matches=(x,label)=>normalize(JSON.stringify(x)).includes(q)||q.includes(normalize(label));
    const setpoints=c.capabilities.filter(x=>x.type==='NUMBER').map(x=>({id:x.id,name:x.label,device:x.device,value:c.controls[x.id],unit:x.unit,min:x.min,max:x.max})).filter(x=>matches(x,x.name));
    return {at:s.updated,dataMode:s.dataMode,readings:s.states.map((x,i)=>({station:stages[i].name,metric:stages[i].metric,unit:stages[i].unit,value:x.value,source:x.source,quality:x.quality,mode:x.mode})).filter(x=>matches(x,x.metric)),setpoints:setpoints.slice(0,25),matched:setpoints.length,note:'最多返回25个参数，需要其他参数请提供更具体关键词。只返回当前来源，不能通过关键词把模拟值变成真实值。'};
   }
   case 'query_production':{
    const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
    if(!valid(args.from)||!valid(args.to)||args.from>args.to)throw Error('需要有效起止日期 YYYY-MM-DD');
    if(Date.parse(args.to)-Date.parse(args.from)>30*86400000)throw Error('单次最多31天，请分段查询');
    const data=await get('/api/ops/management'),rows=data.daily.filter(d=>d.day>=args.from&&d.day<=args.to).map(d=>({...d,hourlyRecords:(d.hourly||[]).flatMap((produced,hour)=>produced===null?[]:[{time:String(hour).padStart(2,'0')+':00',produced}])}));
    return {from:args.from,to:args.to,dataMode:ops.snapshot().dataMode,unit:'瓶',recordedDays:rows.length,produced:rows.length?rows.reduce((n,d)=>n+d.produced,0):null,rows,note:'北京时间；只累计已记录增量，未记录不是0，不代表全天完整覆盖；实采产量未接入时不能用模拟值补齐。'};
   }
   case 'query_logs':{
    const category=args.category||'alarm';if(!['alarm','control','task'].includes(category))throw Error('日志类别必须为alarm/control/task');
    const c=await get('/api/ops/context'),logs=await get('/api/ops/logs?limit=12&category='+category),active=c.alerts.filter(a=>!a.done&&!a.resolvedAt);
    return {activeCount:active.length,alerts:active.slice(0,12).map(a=>({id:a.id,title:a.title,detail:a.detail,time:a.time,timeBeijing:beijingTime(a.time),stageIndex:a.stageIndex,value:a.value,unit:a.unit,threshold:a.threshold})),logs:{category,total:logs.total,items:logs.items.map(x=>({id:x.id,time:x.time,timeBeijing:beijingTime(x.time),action:x.action,result:x.result,detail:String(x.detail||'').slice(0,160)}))},coverage:'当前未恢复告警与最多12条历史记录分开；历史事件不是当前故障；未返回全量遥测快照'};
   }
   case 'query_tasks':{const data=await get('/api/ops/tasks');return {total:data.items.length,items:data.items.slice(0,40).map(task),coverage:'当前角色可见任务，最多40条'};}
   case 'query_configuration':{const c=await get('/api/ops/context');return {dataMode:c.dataMode,connections:c.connectionStates?.map(x=>({stageIndex:x.stageIndex,deviceId:x.deviceId,status:x.status})),supportedChanges:['数值参数','整线启动/暂停（仅已接入的模式）','模拟/真实数据模式（管理员）'],unsupported:['数据库账号地址','任意配置代码','未接通的真实设备控制网关']};}
   case 'query_commands':return commands();
   case 'propose_change':if(typeof args.reason!=='string'||!args.reason.trim())throw Error('缺少变更原因');return proposal(args);
  }
 };
}
