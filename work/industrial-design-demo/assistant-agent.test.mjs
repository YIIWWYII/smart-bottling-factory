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

test('production hours carry explicit Beijing labels and preserve recorded zero',async()=>{
 const hourly=Array(24).fill(null);hourly[9]=0;hourly[17]=72;
 const run=createAgentTools({route:async()=>({daily:[{day:'2026-10-22',produced:72,hourly}]}),snapshot:()=>({dataMode:'simulation'})},{headers:{}},{});
 const r=await run('query_production',{from:'2026-10-22',to:'2026-10-22'});
 assert.deepEqual(r.rows[0].hourlyRecords,[{time:'09:00',produced:0},{time:'17:00',produced:72}]);
 assert.equal(r.rows[0].hourly[10],null);
});

test('device queries resolve the displayed asset name and device code to its current parameters',async()=>{
 const context={assets:[{name:'多头灌装机',code:'FIL-HEAD-01',stageIndex:4}],capabilities:[{id:'FIL-HEAD-01:fillVolume',label:'单瓶灌装量',device:'FIL-HEAD-01',stageIndex:4,type:'NUMBER',unit:'mL',min:100,max:1000},{id:'AGV-01:speedLimit',label:'速度',device:'AGV-01',stageIndex:7,type:'NUMBER',unit:'m/s'}],controls:{'FIL-HEAD-01:fillVolume':500,'AGV-01:speedLimit':1}};
 const run=createAgentTools({route:async()=>context,snapshot:()=>({updated:1,dataMode:'mixed',states:Array.from({length:9},()=>({value:500,source:'simulation',quality:'simulated',mode:'running'}))})},{headers:{}},{});
 for(const query of ['多头灌装机','FIL-HEAD-01','单瓶灌装量']){
  const result=await run('query_devices',{query});assert.equal(result.matched,1);assert.equal(result.setpoints[0].value,500);assert.equal(result.setpoints[0].deviceName,'多头灌装机');
 }
 const byName=await run('query_devices',{query:'多头灌装机'});assert.equal(byName.readings.length,1);assert.equal(byName.readings[0].station,'精密灌装');assert.equal(byName.readings[0].source,'simulation');
 assert.equal((await run('query_devices',{query:'不存在的设备'})).matched,0);
});
