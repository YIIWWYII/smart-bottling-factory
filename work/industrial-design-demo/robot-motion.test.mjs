import test from 'node:test';
import assert from 'node:assert/strict';
import {robotMotion} from './src/robotMotion.js';
const now=100000;
function fixture(rate=12,feedback=1){return {enabled:true,devices:[{id:'PK-ARM-01',online:true,receivedAt:now,points:[{name:'pickRate',value:rate},{name:'runState_feedback',value:feedback}]}]};}
test('robot follows matching feedback and cycle period',()=>{
 assert.equal(robotMotion(fixture(),now).rate,1.6);
 assert.equal(robotMotion(fixture(18),now).rate,2.4);
 assert.equal(robotMotion(fixture(12,0),now).rate,0);
});
test('missing, offline, stale and invalid data cannot run the model',()=>{
 assert.equal(robotMotion(null,now).running,false);
 let p=fixture();p.devices[0].id='another-device';assert.equal(robotMotion(p,now).running,false);
 p=fixture();p.devices[0].online=false;assert.equal(robotMotion(p,now).running,false);
 assert.equal(robotMotion(fixture(),now+10001).running,false);
 assert.equal(robotMotion(fixture(999),now).running,false);
 assert.equal(robotMotion({...fixture(),enabled:false},now).running,false);
});
