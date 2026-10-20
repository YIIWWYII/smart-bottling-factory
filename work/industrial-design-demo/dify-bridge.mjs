import fs from 'node:fs';

// Configuration is server-only. Never include application tokens in the browser.
export function createDifyBridge(env) {
 const config=()=>env.BOTTLEAI_SERVICE_FILE?JSON.parse(fs.readFileSync(env.BOTTLEAI_SERVICE_FILE,'utf8')):null;
 const enabled=()=>!!config()?.platform_apps;
 async function models(){
  const c=config();
  const r=await fetch((c.model_url||'http://127.0.0.1:8000/v1')+'/models',{headers:{Authorization:`Bearer ${c.model_api_key}`},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Object.assign(Error('本地模型服务未连接。'),{status:502});
  const value=await r.json();return {models:(value.data||[]).map(m=>({id:m.id,name:m.id})),workflow:true};
 }
 async function run(kind,inputs,user='platform') {
  const c=config(),app=c?.platform_apps?.[kind];
  if(!app?.key)throw Object.assign(Error('该 Dify 工作流尚未配置。'),{status:503});
  const r=await fetch((c.dify_url||'http://127.0.0.1:8088')+'/v1/workflows/run',{method:'POST',headers:{Authorization:`Bearer ${app.key}`,'Content-Type':'application/json'},body:JSON.stringify({inputs,response_mode:'blocking',user}),signal:AbortSignal.timeout(180000)});
  if(!r.ok)throw Object.assign(Error(`Dify 请求失败（${r.status}），未确认执行。`),{status:502});
  const {data}=await r.json();
  if(data?.status!=='succeeded')throw Object.assign(Error('Dify 工作流失败：'+(data?.error||'无有效结果')),{status:502});
  return {...data.outputs,runId:data.id};
 }
 async function completion(body) {
  const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  const kind=system.includes('工业原始资料')?'standardize':system.includes('审核已填好的')?'audit':'chat';
  const out=await run(kind,{instructions:system,conversation:JSON.stringify(body.messages.filter(m=>m.role!=='system')),style:'按指令回答'},'platform-'+kind);
  return {choices:[{message:{content:out.answer}}],workflowRunId:out.runId};
 }
 return {enabled,run,completion,models};
}
