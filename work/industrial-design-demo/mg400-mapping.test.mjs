import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindMG400Mapping} from './src/mg400Mapping.js';
const config=JSON.parse(readFileSync(new URL('./public/config/mg400-model-mapping.json',import.meta.url)));
const targets=()=>Object.fromEntries(['j1','j2','j3','wrist','j4'].map(name=>[name,{rotation:{x:0,y:0,z:0}}]));
const status=q=>({online:true,receivedAt:1000,feedback:{q_actual:q}});
test('default config preserves previous four-axis and wrist mapping',()=>{
 const nodes=targets(),update=bindMG400Mapping(config,nodes);
 assert.equal(update(status([30,20,10,40]),1100),true);
 for(const [name,axis,degree] of [['j1','y',30],['j2','z',-20],['j3','z',-10],['wrist','z',30],['j4','y',40]])assert.ok(Math.abs(nodes[name].rotation[axis]-degree*Math.PI/180)<1e-12);
});
test('file controls source, axis, coefficient, offset and timeout',()=>{
 const custom=structuredClone(config);custom.feedbackField='custom_angles';custom.staleAfterMs=200;
 Object.assign(custom.bindings[0],{axis:'x',weights:[-1,0,0,0],offsetDeg:10});
 const nodes=targets(),update=bindMG400Mapping(custom,nodes);
 const frame={online:true,receivedAt:1000,feedback:{custom_angles:[30,0,0,0]}};
 assert.equal(update(frame,1100),true);assert.equal(nodes.j1.rotation.x,-20*Math.PI/180);
 assert.equal(update(frame,1201),false);
});
test('invalid or stale frames preserve all joints; actual angles are not clamped',()=>{
 const nodes=targets(),update=bindMG400Mapping(config,nodes);
 assert.equal(update(status([170,0,0,370]),1100),true);assert.equal(nodes.j4.rotation.y,370*Math.PI/180);
 const before=JSON.stringify(nodes);
 for(const frame of [status([0,NaN,0,0]),status([0,0]),{...status([0,0,0,0]),online:false},{...status([0,0,0,0]),receivedAt:undefined}])assert.equal(update(frame,1100),false);
 assert.equal(update(status([0,0,0,0]),3000),false);assert.equal(JSON.stringify(nodes),before);
});
test('invalid configuration cannot partially apply',()=>{
 for(const mutate of [c=>c.bindings[0].target='unknown',c=>c.bindings[0].axis='w',c=>c.bindings[0].weights=[1],c=>c.bindings[0].offsetDeg='10',c=>c.bindings.pop(),c=>c.bindings.push(c.bindings[0]),c=>c.version=2]){
  const c=structuredClone(config);mutate(c);assert.throws(()=>bindMG400Mapping(c,targets()),/MG400/);
 }
});
