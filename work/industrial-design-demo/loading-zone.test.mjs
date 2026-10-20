import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLoadingZone} from './src/loadingZone.js';
test('authored MG400 bottle reaches belt, preserves pause and hides disabled asset',async()=>{
 const bytes=await fs.readFile('public/uploads/equipment/d1adc589-9bff-4065-b7e0-01a4d41b9395.glb');
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const wash=new THREE.Group(),zone=createLoadingZone(wash,gltf);
 const bottle=gltf.scene.getObjectByName('Authored_Bottle001');assert.ok(bottle);
 const state={source:'simulation',quality:'simulated',mode:'running'};
 zone.update(6.2,state,false);wash.updateMatrixWorld(true);const p=bottle.getWorldPosition(new THREE.Vector3());
 assert.ok(Math.abs(p.y-.15-.98)<.01);assert.ok(Math.abs(p.z)<.001);assert.ok(Math.abs(p.x+3.3)<.01);
 const before=zone.zone.userData.cycleTime;zone.update(.5,state,true);assert.equal(zone.zone.userData.cycleTime,before);
 zone.update(.5,{...state,quality:'offline'},false);assert.equal(zone.zone.userData.cycleTime,before);
 zone.update(.5,state,false);assert.ok(bottle.position.x>.314534);
 zone.update(.1,state,false,false);assert.equal(zone.zone.visible,false);zone.dispose();
});
