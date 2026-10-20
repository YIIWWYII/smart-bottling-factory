import {readSkillConfig} from './skill-config.mjs';
import {parseSkillCommand,configuredSkills} from './src/assistantSkills.js';
import http from 'node:http';
import fs from 'node:fs';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {agentTools} from './assistant-agent.mjs';

function readToolToken(){
 const configPath='F:/BottleAI/config/platform-agent.json';
 fs.mkdirSync('F:/BottleAI/config',{recursive:true});
 if(!fs.existsSync(configPath))fs.writeFileSync(configPath,JSON.stringify({toolToken:randomBytes(32).toString('hex')}));
 return JSON.parse(fs.readFileSync(configPath,'utf8')).toolToken;
}
const sessions=new Map();
const skillTools=[{name:'list_skills',description:'列出可自主选择的技能及适用场景；先发现再加载',arguments:{}},{name:'use_skill',description:'加载选定技能的说明与工具权限；随后按说明继续调用工具，不代表执行完成',arguments:{name:'必填技能名称'}}];
export const nativeToolSchemas=[...agentTools,...skillTools].map(t=>({name:t.name,description:t.description,parameters:{type:'object',properties:{scope:{type:'string',description:'平台请求的scope原样传入；Coze独立预览可留空，只读'},...Object.fromEntries(Object.entries(t.arguments).map(([k,v])=>[k,{type:'string',description:v}]))},required:t.name==='use_skill'?['name']:t.name==='propose_change'?['scope','kind','value','reason']:t.name==='query_production'?['from','to']:t.name==='search_knowledge'?['query']:[]}}));
nativeToolSchemas.find(t=>t.name==='search_knowledge').parameters.properties.device_model={type:'string',description:'可选，设备型号/平台设备编号，精确限制资料适用范围'};
nativeToolSchemas.find(t=>t.name==='search_knowledge').parameters.properties.alarm_code={type:'string',description:'可选，告警编码，优先精确匹配'};

export function startCozeTools(ops,integrations,{port=8094,token=readToolToken()}={}){
 const toolToken=token;
 const server=http.createServer(async(req,res)=>{
  const send=(status,j)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(j));};
  const supplied=(req.headers.authorization||'').replace(/^Bearer /,'');
  if(Buffer.byteLength(supplied)!==Buffer.byteLength(toolToken)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(toolToken)))return send(401,{error:'Tool authorization required'});
  try{
   if(req.method!=='POST'||!req.url.startsWith('/tools/'))return send(404,{error:'Not found'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16000)throw Error('工具参数过大');}
   const args=JSON.parse(raw||'{}'),name=req.url.slice(7),scope=args.scope;delete args.scope;
   const session=scope?sessions.get(scope):null;
   if(scope&&(!session||Date.now()>session.expires))throw Error('请求上下文已过期，请重新提问');
   if(name==='propose_change'&&!session)return send(200,{result:JSON.stringify({status:'preview_only',message:'独立预览不生成有效确认单，也不执行。请从平台助手生成绑定当前用户的确认单。'})});
   if(name==='query_commands'&&!session)return send(200,{result:'[]'});
   if(session&&++session.calls>12)throw Error('已达到本次工具调用上限');
   if(['list_skills','use_skill'].includes(name)){
    const catalog=readSkillConfig().filter(s=>s.enabled);
    let result;
    if(name==='list_skills')result=catalog.map(({name,description})=>({name,description}));
    else{const skill=catalog.find(s=>s.name===args.name||s.id===args.name);if(!skill)throw Error('技能不存在或已停用');if(session?.skill&&session.skill.name!==skill.name)throw Error('本次已选定技能，不允许切换以扩大工具权限');if(session)session.skill=skill;result={name:skill.name,instructions:skill.instructions,allowedTools:skill.tools,note:'按说明继续调用工具验证结果；写入仍需人工确认。'};}
    if(session)session.trace.push({tool:name,arguments:args,status:'success',at:new Date().toISOString(),result});
    return send(200,{result:JSON.stringify(result)});
   }
   if(session?.skill&&!session.skill.tools.includes(name))throw Error('当前技能不允许调用此工具');
   if(session?.skill?.name==='参数调整'&&name==='propose_change'&&args.kind!=='parameter')throw Error('参数调整技能只允许数值参数提案');
   if(name==='propose_change'&&session.operation)return send(200,{result:JSON.stringify(session.operation)});
   if(name==='propose_change'&&args.kind==='parameter'&&typeof args.value==='string'&&/^-?\d+(\.\d+)?$/.test(args.value))args.value=Number(args.value);
   const actorReq=session?.req||{headers:{cookie:'bw_demo_actor=viewer'}};
   const result=await ops.withRequest(actorReq,()=>integrations.agentTool(actorReq,name,args));
   if(session){session.trace.push({tool:name,arguments:args,at:new Date().toISOString(),status:'success',result});if(name==='propose_change')session.operation=result;}
   send(200,{result:JSON.stringify(result)});
  }catch(e){send(400,{error:e.status||e.message?e.message:'Tool failed'});}
 });
 const bridgeKey=Symbol.for('bottle.coze.bridge'),previous=globalThis[bridgeKey];globalThis[bridgeKey]=server;
 if(previous)previous.close(()=>server.listen(port,'0.0.0.0'));else server.listen(port,'0.0.0.0');server.on('error',e=>console.error('Coze tool bridge:',e.message));return server;
}

export async function runNativeAgent(config,req,question,context,history,fetcher=fetch){
 const command=parseSkillCommand(question,context,configuredSkills(config.skills));
 const scope=randomBytes(24).toString('hex'),session={req,expires:Date.now()+180000,calls:0,trace:[],operation:null,skill:command?.skill};sessions.set(scope,session);
 const base=config.baseUrl.replace(/\/$/,''),headers={'Content-Type':'application/json',Authorization:'Bearer '+config.token};
 let chat;
 const needsEvidence=!!command||context.selectionLocked||(/(当前|今天|查询|查看|告警|调整|切换|启动|暂停)/.test(question)&&/(工位|产线|设备|VOC|产量|生产|水洗|告警|模式|任务)/i.test(question));
 const requiresLive=command?.skill.name==='生产数据分析'||(/当前|今天|现在|实时|多少|剩余/.test(question)&&/产量|库存|设备|任务|参数|温度|浓度|告警|生产|水洗/.test(question)&&!/是什么|什么意思|含义|口径/.test(question));
 const hasLive=()=>session.trace.some(t=>t.status==='success'&&!['search_knowledge','list_skills','use_skill'].includes(t.tool));
 const request=async(path,body)=>{const r=await fetcher(base+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||j.code)throw Error('Coze智能体接口未完成：'+(j.msg||r.status));return j;};
 try{
  let selectionKnowledge=null;
  if(context.selectionLocked&&context.target){
   try{
    const query=String((context.selectionObject?.name||context.target.slice(0,180))+' '+question).slice(0,500);
    const response=await fetcher('http://127.0.0.1:8891/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(10000)});
    if(response.ok){selectionKnowledge=await response.json();if(selectionKnowledge.documents?.length)session.trace.push({tool:'search_knowledge',arguments:{query},at:new Date().toISOString(),status:'success',result:selectionKnowledge});}
   }catch{selectionKnowledge={message:'平台说明检索暂不可用，不能据此猜测功能。'};}
  }
  const userContent=JSON.stringify({question:command?.question||question,...(command?{skill:{name:command.skill.name,instructions:command.skill.instructions,allowedTools:command.skill.tools,toolCalling:'必须直接调用工具并将本次scope原样传入；取得结果后再回答。选中对象的时间范围优先于默认今天。'}}:{}),availableSkills:configuredSkills(config.skills).filter(s=>s.enabled!==false).map(({name,description})=>({name,description})),skillSelection:'根据问题从availableSkills自主选择匹配的技能，先直接调用use_skill工具，参数name填写技能名称、scope原样传入本次scope。收到说明后继续调用允许的工具。不要输出计划或内部推理；一般问题无须技能。',scope,context:{page:context.page,selectionObject:context.selectionObject,selectionKnowledge,answerRules:'选中内容是本平台对象，优先按平台资料解释用途和所在页面。资料仅作说明，查询当前值、产品配方、任务、产量、告警时必须再调用对应实时工具。引用资料标题和版本；没有匹配资料明确缺少什么，不编造功能，不把平台标题一律当成设备型号。修改仍仅生成待人工确认单。',selection:context.selectionLocked?context.target:null,now:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'})+'+08:00',timeZone:'Asia/Shanghai'},history:history.slice(-4)});
  for(let attempt=0;attempt<2;attempt++){
  const content=attempt===0?userContent:userContent+'\n上次未取得本次查询结果。先根据问题选择可用技能并调用use_skill，已加载则继续调用允许的查询工具，scope必须原样使用上述scope。不要输出内部思考或虚构结果。';
  const started=await request('/v3/chat',{bot_id:config.botId,user_id:'platform-'+scope,stream:false,auto_save_history:true,additional_messages:[{role:'user',content,content_type:'text'}]});chat=started.data;
  while(chat.status!=='completed'){
   if(['failed','cancelled','requires_action'].includes(chat.status))throw Error('智能体未完成：'+(chat.last_error?.msg||chat.status));
   if(Date.now()>session.expires)throw Error('智能体查询超时，没有自动执行控制');
   await new Promise(r=>setTimeout(r,500));chat=(await request('/v3/chat/retrieve?conversation_id='+chat.conversation_id+'&chat_id='+chat.id)).data;
  }
  const listed=await request('/v3/chat/message/list?conversation_id='+chat.conversation_id+'&chat_id='+chat.id);
  const messages=listed.data||listed.Messages||[];
  const answer=messages.filter(m=>m.type==='answer'&&m.role==='assistant').map(m=>m.content).join('\n');
  if(attempt===0&&session.skill&&!session.skill.tools.includes('propose_change')&&(!session.trace.some(t=>!['list_skills','use_skill'].includes(t.tool))||(requiresLive&&!hasLive()))&&!session.operation)continue;
  if(!answer&&attempt===0)continue;
  if(!answer)throw Error('技能查询未完成，智能体没有返回分析结果。请稍后重试。');
  if((needsEvidence||session.skill)&&!session.trace.some(t=>!['list_skills','use_skill'].includes(t.tool)))throw Error('本次没有获得绑定当前请求的工具依据，不能确认平台状态。请重新提问。');
  if(requiresLive&&!hasLive())throw Error('已取得说明资料，但尚未查到本次实时或历史业务数据，不能确认当前数值。');
  return {answer,trace:session.trace,operation:session.operation,goalStatus:session.operation?'awaiting_confirmation':'completed',model:'Coze 自主规划智能体 · Qwen3.5-4B',snapshotAt:context.updated,workflowRunId:chat.id};
  }
 }catch(e){
  if(chat?.id)await request('/v3/chat/cancel',{conversation_id:chat.conversation_id,chat_id:chat.id}).catch(()=>{});
  return {answer:e.message,trace:session.trace,operation:session.operation,goalStatus:session.operation?'awaiting_confirmation':'incomplete',model:'Coze 自主规划智能体'};
 }finally{sessions.delete(scope);}
}
