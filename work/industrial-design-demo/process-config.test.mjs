import test from 'node:test';
import assert from 'node:assert/strict';
import {capabilities,deviceNames} from './src/controlCapabilities.js';
import {alarmRules,alarmDocument} from './src/alarmRules.js';
import {stages} from './src/data.js';

test('device definitions have unique IDs, valid defaults and station references',()=>{
 assert.equal(new Set(capabilities.map(c=>c.id)).size,capabilities.length);
 for(const c of capabilities){
  assert.equal(c.id,`${c.device}:${c.control}`);assert.ok(deviceNames[c.device],c.device);
  assert.ok(Number.isInteger(c.stageIndex)&&stages[c.stageIndex],c.id);
  if(c.type==='NUMBER'){
   assert.ok(Number.isFinite(c.min)&&Number.isFinite(c.max)&&c.min<=c.max,c.id);
   assert.ok(Number.isFinite(Number(c.initial))&&Number(c.initial)>=c.min&&Number(c.initial)<=c.max,c.id);
   assert.ok(c.step>0,c.id);
  }
  if(c.type==='ENUM')assert.ok(c.options.includes(c.initial),c.id);
 }
});
test('alarm definitions keep references and threshold order consistent',()=>{
 assert.equal(new Set(alarmRules.map(r=>r.id)).size,alarmRules.length);
 for(const r of alarmRules){
  assert.ok(Number.isInteger(r.stageIndex)&&stages[r.stageIndex],r.id);
  if(r.source==='setting'){
   const c=capabilities.find(c=>c.id===r.id);assert.ok(c,r.id);
   assert.equal(r.stageIndex,c.stageIndex);assert.equal(r.device,c.device);assert.equal(r.unit,c.unit);
  }
  const thresholds=['criticalLow','low','high','criticalHigh'].map(k=>r[k]).filter(v=>v!=null);
  assert.ok(thresholds.every(Number.isFinite),r.id);
  assert.ok(thresholds.every((v,i)=>i===0||thresholds[i-1]<v),r.id);
  assert.doesNotThrow(()=>new RegExp(r.part));
 }
});
test('startup alarm documents resolve every station and its configured rules',()=>{
 for(const [index,stage] of stages.entries()){
  const document=alarmDocument(index);
  assert.ok(document.title.startsWith(stage.name));
  for(const rule of alarmRules.filter(r=>r.stageIndex===index))assert.ok(document.content.includes(rule.metric));
 }
});
