import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createModelProxy,normalizeToolReply} from './model-tool-proxy.mjs';
test('tool calls retain arguments and omit only the accompanying preamble',()=>{
 const call={id:'tool',type:'function',function:{name:'use_skill',arguments:'{"name":"告警分析"}'}};
 const r=normalizeToolReply({choices:[{message:{content:'让我先查询',tool_calls:[call]}}]});assert.equal(r.choices[0].message.content,null);assert.deepEqual(r.choices[0].message.tool_calls,[call]);
 assert.equal(normalizeToolReply({choices:[{message:{content:'正常回答'}}]}).choices[0].message.content,'正常回答');
});
test('compatibility stream emits executable tool delta and completion',async()=>{
 const server=createModelProxy({fetcher:async(url,options)=>{assert.equal(JSON.parse(options.body).stream,false);return {ok:true,status:200,json:async()=>({id:'a',choices:[{index:0,message:{content:'先思考',tool_calls:[{id:'call',type:'function',function:{name:'list_skills',arguments:'{}'}}]},finish_reason:'tool_calls'}]})};}});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/v1/chat/completions',{method:'POST',body:JSON.stringify({stream:true})});const text=await r.text();assert.match(text,/list_skills/);assert.match(text,/\[DONE\]/);assert.doesNotMatch(text,/先思考/);}finally{await new Promise(r=>server.close(r));}
});
