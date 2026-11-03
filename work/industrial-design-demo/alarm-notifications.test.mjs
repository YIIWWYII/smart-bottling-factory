import test from 'node:test';
import assert from 'node:assert/strict';
import {createAlarmNotifications} from './alarm-notifications.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('repeated polling analyzes an alarm once and records its resolution',async()=>{
 let calls=0;const n=createAlarmNotifications({analyze:async()=>{calls++;return {answer:'检查传感器',goalStatus:'completed'};}});
 const alerts=[{id:'a',title:'温度告警',time:'10:00'}];
 n.observe(alerts,'simulation');n.observe(alerts,'simulation');await settle();
 assert.equal(calls,1);assert.equal(n.list('simulation')[0].status,'completed');
 n.observe([],'simulation');assert.ok(n.list('simulation')[0].resolvedAt);
 n.observe([{...alerts[0],time:'11:00'}],'simulation');await settle();assert.equal(calls,2);
});
test('failure is visible, does not auto-loop, and can be retried',async()=>{
 let calls=0;const n=createAlarmNotifications({analyze:async()=>{calls++;if(calls===1)throw Error('服务离线');return {answer:'建议核查',goalStatus:'completed'};}});
 const alerts=[{id:'b'}];n.observe(alerts,'real');await settle();n.observe(alerts,'real');await settle();
 assert.equal(calls,1);assert.equal(n.list('real')[0].error,'服务离线');
 n.retry(n.list('real')[0].id);await settle();assert.equal(calls,2);assert.equal(n.list('real')[0].status,'completed');
 assert.deepEqual(n.list('simulation'),[]);
});
