import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutomaticAlarmAnalysis} from './automatic-alarms.mjs';

const event=(id='occurrence-1',time='2026-10-23T09:00:00Z')=>({id,time,ruleId:'demo:fill-error',dataMode:'simulation',value:-6,threshold:-2,done:false});
test('one occurrence is analyzed once while polling or another browser reads results',async()=>{
 let finish,calls=0;
 const feed=createAutomaticAlarmAnalysis({analyze:async()=>{calls++;return new Promise(resolve=>{finish=resolve;});}});
 feed.observe([event()],true);const pending=feed.process();
 feed.observe([{...event(),value:-7}],true);await feed.process();
 assert.equal(calls,1);assert.equal(feed.list().records.length,1);assert.equal(feed.list().records[0].status,'running');
 finish({answer:'灌装量不足，检查计量数据',goalStatus:'completed',trace:[{tool:'query_logs',status:'success'}]});await pending;
 feed.observe([event()],true);await feed.process();assert.equal(calls,1);assert.equal(feed.list().records[0].status,'completed');
});
test('event ends, then the same rule can produce a new occurrence and analysis',async()=>{
 const ids=[];const feed=createAutomaticAlarmAnalysis({analyze:async e=>{ids.push(e.id);return {answer:e.id,goalStatus:'completed'};}});
 feed.observe([event()],true);await feed.process();feed.observe([],true);
 assert.equal(feed.list().records[0].eventEnded,true);
 feed.observe([event('occurrence-2','2026-10-23T09:05:00Z')],true);await feed.process();
 assert.deepEqual(ids,['occurrence-1','occurrence-2']);assert.equal(feed.list().records[0].eventEnded,false);
});
test('startup and disabled periods do not replay old alarms; failed calls remain visible',async()=>{
 let calls=0;const feed=createAutomaticAlarmAnalysis({initialEvents:[event()],analyze:async()=>{calls++;throw Error('Coze unavailable');}});
 feed.observe([event(),event('disabled')],false);await feed.process();
 feed.observe([event(),event('disabled')],true);await feed.process();assert.equal(calls,0);
 feed.observe([event('fresh')],true);await feed.process();assert.equal(calls,1);
 assert.equal(feed.list().records[0].status,'incomplete');assert.match(feed.list().records[0].answer,/Coze unavailable/);
 feed.observe([event('fresh')],true);await feed.process();assert.equal(calls,1);
});
test('unscoped historical records are ignored and proposal results cannot be shown as success',async()=>{
 const feed=createAutomaticAlarmAnalysis({analyze:async()=>({answer:'待写入',operation:{id:'unexpected'},goalStatus:'awaiting_confirmation'})});
 feed.observe([{id:'seed',time:'2026-01-01'}, {...event('done'),done:true},event()],true);await feed.process();
 assert.equal(feed.list().records.length,1);assert.equal(feed.list().records[0].status,'incomplete');
 assert.match(feed.list().records[0].answer,/只读/);assert.equal(feed.list().records[0].operation,undefined);
});
test('missing answers and unfinished goal states are not reported as completed',async()=>{
 for(const result of [{answer:' ',goalStatus:'completed'},{answer:'还需查询',goalStatus:'needs_information'},{answer:'无法完成',goalStatus:'blocked'},{answer:'状态缺失'}]){
  const feed=createAutomaticAlarmAnalysis({analyze:async()=>result});
  feed.observe([event()],true);await feed.process();
  assert.equal(feed.list().records[0].status,'incomplete');
 }
});
