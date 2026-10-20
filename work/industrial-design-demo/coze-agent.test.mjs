import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {startCozeTools,runNativeAgent} from './coze-agent.mjs';

test('native agent tool bridge: authenticated reads, preview cannot write, scoped proposal bound to caller',async()=>{
 let writes=0,actor;
 const server=startCozeTools({withRequest:(req,fn)=>{actor=req.headers.cookie;return fn();}},{agentTool:async(req,name,args)=>{if(name==='propose_change'){writes++;return {id:'proposal',actor:actor,status:'pending',value:args.value};}return {value:0.12};}},{port:0,token:'secret'});
 await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const call=async(name,args={},token='secret')=>fetch(base+'/tools/'+name,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)});
 try{
  assert.equal((await call('query_devices',{},'wrong')).status,401);
  assert.equal((await call('query_devices',{},'ÿÿÿÿÿÿ')).status,401);
  const preview=await(await call('propose_change')).json();assert.equal(JSON.parse(preview.result).status,'preview_only');assert.equal(writes,0);
  assert.equal((await call('propose_change',{scope:'invented'})).status,400);
  const fetcher=async(url,options)=>{
   if(url.endsWith('/v3/chat')){
    const request=JSON.parse(options.body),context=JSON.parse(request.additional_messages[0].content);
    const args={scope:context.scope,kind:'parameter',controlId:'test',value:'20',reason:'request'};
    await call('propose_change',args);await call('propose_change',args);
    return {ok:true,json:async()=>({code:0,data:{id:'run',conversation_id:'conversation',status:'completed'}})};
   }
   return {ok:true,json:async()=>({code:0,Messages:[{type:'answer',role:'assistant',content:'等待人工确认'}]})};
  };
  const result=await runNativeAgent({baseUrl:'http://coze',botId:'bot',token:'token'},{headers:{cookie:'bw_demo_actor=engineer'}},'调整',{updated:new Date().toISOString()},[],fetcher);
  assert.equal(writes,1);assert.equal(result.operation.actor,'bw_demo_actor=engineer');assert.equal(result.operation.value,20);assert.equal(result.goalStatus,'awaiting_confirmation');assert.equal(result.trace.length,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('native failure never falls back to a fabricated answer',async()=>{
 const r=await runNativeAgent({baseUrl:'http://coze',botId:'bot',token:'token'},{headers:{}},'查询',{},[],async()=>({ok:true,json:async()=>({code:1,msg:'offline'})}));
 assert.equal(r.goalStatus,'incomplete');assert.match(r.answer,/offline/);assert.equal(r.operation,null);
});
import {parseSkillCommand} from './src/assistantSkills.js';

test('platform documentation cannot establish current production values',async()=>{
 const fetcher=async url=>{
  if(url.endsWith('/knowledge'))return {ok:true,json:async()=>({documents:[{title:'产量口径',content:'产量以生产记录为准'}]})};
  if(url.endsWith('/v3/chat'))return {ok:true,json:async()=>({data:{id:'run',conversation_id:'conversation',status:'completed'}})};
  return {ok:true,json:async()=>({Messages:[{type:'answer',role:'assistant',content:'当前产量是1000瓶'}]})};
 };
 const result=await runNativeAgent({baseUrl:'http://coze',botId:'bot',token:'token'},{headers:{}},'当前产量是多少',{selectionLocked:true,target:'当前产量'},[],fetcher);
 assert.equal(result.goalStatus,'incomplete');
 assert.match(result.answer,/尚未查到/);
 assert.doesNotMatch(result.answer,/1000/);
 assert.equal(result.trace[0].tool,'search_knowledge');
});

test('slash skills resolve exact commands without inventing a write target',()=>{
 assert.equal(parseSkillCommand('普通问题'),null);
 assert.equal(parseSkillCommand('／告警分析 当前VOC').question,'当前VOC');
 assert.match(parseSkillCommand('/参数调整').question,/不生成提案/);
 assert.throws(()=>parseSkillCommand('/不存在'),/有效技能/);
});

test('selected read-only skill is sent to Coze and cannot create proposals',async()=>{
 let writes=0;
 const server=startCozeTools({withRequest:(_req,fn)=>fn()},{agentTool:async(_req,name)=>{if(name==='propose_change')writes++;return {activeCount:0};}},{port:0,token:'secret'});
 await once(server,'listening');
 try{
  const fetcher=async(url,options)=>{
   if(url.endsWith('/v3/chat')){
    const payload=JSON.parse(JSON.parse(options.body).additional_messages[0].content);
    assert.equal(payload.skill.name,'告警分析');assert.equal(payload.question,'检查当前告警');
    const call=name=>fetch('http://127.0.0.1:'+server.address().port+'/tools/'+name,{method:'POST',headers:{Authorization:'Bearer secret','Content-Type':'application/json'},body:JSON.stringify({scope:payload.scope,kind:'parameter',value:'20'})});
    assert.equal((await call('propose_change')).status,400);
    assert.equal((await call('query_logs')).status,200);
    return {ok:true,json:async()=>({data:{id:'run',conversation_id:'conversation',status:'completed'}})};
   }
   return {ok:true,json:async()=>({Messages:[{type:'answer',role:'assistant',content:'当前没有未恢复告警'}]})};
  };
  const result=await runNativeAgent({baseUrl:'http://coze',botId:'bot',token:'token'},{headers:{}},'/告警分析 检查当前告警',{},[],fetcher);
  assert.equal(result.goalStatus,'completed');assert.equal(writes,0);assert.equal(result.trace[0].tool,'query_logs');
 }finally{await new Promise(resolve=>server.close(resolve));}
});


test('bare skill uses locked selection, explicit question wins, unselected keeps default',()=>{
 const context={selectionLocked:true,target:'产出走势 2026-10'};
 assert.match(parseSkillCommand('/生产数据分析',context).question,/2026-10-01至2026-10-31/);
 assert.match(parseSkillCommand('/生产数据分析',{selectionLocked:true,target:'2024-02'}).question,/2024-02-01至2024-02-29/);
 assert.match(parseSkillCommand('/生产数据分析',{selectionLocked:true,target:'2026-10-18'}).question,/2026-10-18至2026-10-18/);
 assert.equal(parseSkillCommand('/生产数据分析 分析昨天',context).question,'分析昨天');
 assert.equal(parseSkillCommand('/生产数据分析',{...context,selectionLocked:false}).question,'分析今天的生产情况');
 assert.match(parseSkillCommand('/参数调整',context).question,/不生成提案/);
});

test('read skill without bound evidence retries once and still refuses unsupported success',async()=>{
 let calls=0;
 const fetcher=async(url,options)=>{
  if(url.endsWith('/v3/chat')){
   calls++;
   const content=JSON.parse(options.body).additional_messages[0].content;
   if(calls===1){const payload=JSON.parse(content);assert.match(payload.question,/选中对象/);assert.equal(payload.context.selection,'产出走势 2026-10');assert.match(payload.context.now,/\+08:00$/);}
   else assert.match(content,/上次未取得/);
   return {ok:true,json:async()=>({data:{id:'run',conversation_id:'conversation',status:'completed'}})};
  }
  return {ok:true,json:async()=>({Messages:[{type:'answer',role:'assistant',content:'已分析'}]})};
 };
 const result=await runNativeAgent({baseUrl:'http://coze',botId:'bot',token:'token'},{headers:{}},'/生产数据分析',{selectionLocked:true,target:'产出走势 2026-10'},[],fetcher);
 assert.equal(calls,2);assert.equal(result.goalStatus,'incomplete');assert.deepEqual(result.trace,[]);
});

test('agent autonomously loads a skill and its tool permissions apply to this request',async()=>{
 const server=startCozeTools({withRequest:(_r,fn)=>fn()},{agentTool:async()=>({alarms:[]})},{port:0,token:'secret'});await once(server,'listening');
 try{
  const fetcher=async(url,options)=>{
   if(url.endsWith('/v3/chat')){
    const payload=JSON.parse(JSON.parse(options.body).additional_messages[0].content);
    assert.ok(payload.availableSkills.some(s=>s.name==='告警分析'));
    const call=(name,args={})=>fetch('http://127.0.0.1:'+server.address().port+'/tools/'+name,{method:'POST',headers:{Authorization:'Bearer secret','Content-Type':'application/json'},body:JSON.stringify({scope:payload.scope,...args})});
    assert.equal((await call('use_skill',{name:'告警分析'})).status,200);
    assert.equal((await call('propose_change',{kind:'line',value:'pause'})).status,400);
    assert.equal((await call('query_logs')).status,200);
    return {ok:true,json:async()=>({data:{id:'run',conversation_id:'conversation',status:'completed'}})};
   }
   return {ok:true,json:async()=>({Messages:[{type:'answer',role:'assistant',content:'当前无告警'}]})};
  };
  const result=await runNativeAgent({baseUrl:'http://coze',botId:'bot',token:'token'},{headers:{}},'分析告警',{},[],fetcher);
  assert.equal(result.goalStatus,'completed');assert.deepEqual(result.trace.map(t=>t.tool),['use_skill','query_logs']);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
