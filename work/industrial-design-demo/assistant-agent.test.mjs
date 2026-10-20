import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent,createAgentTools} from './assistant-agent.mjs';
const call=(name,args={})=>({answer:'查询',tool_calls:[{name,arguments:args}]});
test('results feed the next decision; two queries then final answer',async()=>{
 const executed=[];
 const result=await runAgent({question:'分析产量和告警',decide:async c=>c.trace.length===0?call('query_production'):c.trace.length===1?call('query_logs'):{answer:'有记录支持的分析',goalStatus:'completed',tool_calls:[]},execute:async n=>{executed.push(n);return {count:2};}});
 assert.deepEqual(executed,['query_production','query_logs']);assert.equal(result.goalStatus,'completed');assert.equal(result.trace.length,2);
});
test('unknown tools never execute; failure returned to model',async()=>{
 let count=0;
 const r=await runAgent({question:'x',decide:async c=>c.trace.length?{answer:'不支持',tool_calls:[]}:call('arbitrary_http'),execute:async()=>{count++;}});
 assert.equal(count,0);assert.equal(r.trace[0].status,'error');
});
test('proposal stops loop awaiting confirmation; it is not completed',async()=>{
 let turns=0;
 const r=await runAgent({question:'暂停',decide:async()=>{turns++;return call('propose_change',{kind:'line',value:'pause',reason:'用户请求'});},execute:async()=>({id:'c1',status:'pending'})});
 assert.equal(turns,1);assert.equal(r.goalStatus,'awaiting_confirmation');assert.equal(r.operation.status,'pending');
});
test('repeated calls and turn budget stop without claiming completion',async()=>{
 const r=await runAgent({question:'x',decide:async()=>call('query_tasks'),execute:async()=>[]});assert.equal(r.goalStatus,'blocked');
 const b=await runAgent({question:'x',maxTurns:1,decide:async()=>call('query_tasks'),execute:async()=>[]});assert.equal(b.goalStatus,'incomplete');
});
test('missing historical records return null, not zero; invalid dates rejected',async()=>{
 const run=createAgentTools({route:async()=>({daily:[]}),snapshot:()=>({dataMode:'real'})},{headers:{}},{});
 const r=await run('query_production',{from:'2026-10-17',to:'2026-10-18'});assert.equal(r.produced,null);assert.equal(r.dataMode,'real');
 await assert.rejects(run('query_production',{from:'2026-02-31',to:'2026-10-18'}));
 await assert.rejects(run('query_tasks',{url:'/api/ops/control'}));
});
