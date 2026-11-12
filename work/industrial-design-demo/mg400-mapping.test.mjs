import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindMG400Mapping} from './src/mg400Mapping.js';
import {bindBlenderMG400} from './src/mg400Blender.js';
import {Bone,Group} from 'three';
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

test('uploaded practice skeleton follows simulated J1 without moving its base',async()=>{
 const root=new Group(),base=new Group();base.name='base_link';root.add(base);
 for(const binding of config.practiceBindings){const bone=new Bone();bone.name=binding.target.replaceAll('.','');root.add(bone);}
 const update=await bindBlenderMG400(root,{config});
 const j1=root.getObjectByName('P_j1001');
 root.updateMatrixWorld(true);const before=base.matrixWorld.clone();
 assert.equal(update({online:true,receivedAt:Date.now(),feedback:{q_actual:[20,25,-15,60]}}),true);
 root.updateMatrixWorld(true);
 assert.ok(Math.abs(j1.rotation.y-20*Math.PI/180)<1e-12);
 assert.ok(base.matrixWorld.equals(before));
});

test('rigid Empty joints may omit or change Blender numeric suffixes; ambiguous names are rejected',async()=>{
 const root=new Group();for(const item of config.practiceBindings){const node=new Group();node.name=item.target.replace(/\.\d+$/,'');root.add(node);}
 const apply=await bindBlenderMG400(root,{config});assert.equal(apply({online:true,receivedAt:Date.now(),feedback:{q_actual:[25,5,10,0]}}),true);assert.ok(Math.abs(root.getObjectByName('P_j1').rotation.y-25*Math.PI/180)<1e-10);
 for(const node of root.children)node.name+='002';await bindBlenderMG400(root,{config});
 const duplicate=new Group();duplicate.name='P_j1.003';root.add(duplicate);await assert.rejects(bindBlenderMG400(root,{config}),/尚未匹配模型关节/);
});

import {validateAssetMG400Mapping} from './src/mg400Mapping.js';
import {Quaternion,Vector3} from 'three';
test('per-asset mapping drives arbitrary Empty hierarchy relative to exported rest pose; stale input freezes',async()=>{
 const root=new Group(),base=new Group(),turn=new Group(),arm=new Group(),tip=new Group();
 base.name='FixedBase';turn.name='Turntable';arm.name='MainArm';tip.name='Tool';root.add(base);base.add(turn);turn.add(arm);arm.add(tip);
 turn.rotation.set(.25,0,.1);arm.rotation.x=.5;tip.position.set(1,0,0);
 const rest=turn.quaternion.clone(),baseBefore=base.quaternion.clone();
 const mapping={version:1,feedbackField:'q_actual',staleAfterMs:1500,relativeToRest:true,bindings:[{target:'Turntable',axis:'y',weights:[1,0,0,0],offsetDeg:0},{target:'MainArm',axis:'x',weights:[0,1,0,0],offsetDeg:0}]};
 const apply=await bindBlenderMG400(root,{mapping});assert.equal(apply(status([0,0,0,0]),1100),true);assert.ok(turn.quaternion.angleTo(rest)<1e-7);
 assert.equal(apply(status([30,15,0,0]),1100),true);const expected=rest.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/6));assert.ok(turn.quaternion.angleTo(expected)<1e-7);assert.ok(base.quaternion.equals(baseBefore));
 const current=turn.quaternion.clone();assert.equal(apply(status([80,0,0,0]),3000),false);assert.ok(turn.quaternion.equals(current));assert.equal(apply.mapping.bindings[0].target,'Turntable');
});
test('custom mapping rejects duplicate nodes, unrecognised targets, malformed coefficients and unsafe types',async()=>{
 const mapping={version:1,feedbackField:'q_actual',staleAfterMs:1500,relativeToRest:true,bindings:[{target:'Turntable',axis:'y',weights:[1,0,0,0],offsetDeg:0}]};
 assert.deepEqual(validateAssetMG400Mapping(mapping),mapping);assert.equal(validateAssetMG400Mapping(null),null);
 for(const mutate of [m=>m.bindings.push({...m.bindings[0]}),m=>m.relativeToRest='true',m=>m.bindings[0].weights=[1],m=>m.bindings[0].weights[0]=Infinity,m=>m.bindings[0].target='',m=>m.feedbackField='arbitrary',m=>m.bindings[0].axis='w']){const m=structuredClone(mapping);mutate(m);assert.throws(()=>validateAssetMG400Mapping(m));}
 await assert.rejects(bindBlenderMG400(new Group(),{mapping}),/尚未匹配模型关节/);
});
