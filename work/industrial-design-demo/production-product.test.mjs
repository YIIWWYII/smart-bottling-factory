import test from 'node:test';
import assert from 'node:assert/strict';
import {productionProduct} from './src/productionProduct.js';
import {productionBottles} from './src/productionBottle.js';
import * as THREE from 'three';
import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
test('task selects product, never substitutes old recipe product',()=>{
 const twin={activeProduct:'lime',activeTask:{name:'Soda'},ops:{products:[{id:'lime',name:'Lime'},{id:'soda',name:'Soda',aliases:['Soda alias'],recipeId:'r'}],documents:[{id:'r',productCode:'SODA-350'}]}};
 assert.equal(productionProduct(twin).id,'soda');twin.activeTask.name='unknown';assert.equal(productionProduct(twin),null);
 twin.activeTask.productCode='SODA-350';assert.equal(productionProduct(twin).id,'soda');twin.activeTask=null;assert.equal(productionProduct(twin),null);
});
test('configured GLB replaces bottle with normalized base and restores on task removal',async()=>{
 globalThis.ProgressEvent??=class ProgressEvent{};
 const original=GLTFLoader.prototype.load;
 GLTFLoader.prototype.load=function(url,done){fs.readFile('public/models/beverage/water-bottle.glb').then(b=>(()=>{const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());gltf.materials=(gltf.materials||[]).map(()=>({}));const binStart=28+b.readUInt32LE(12);gltf.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(binStart).toString('base64');return this.parseAsync(JSON.stringify(gltf),'');})()).then(done);};
 try{const parent=new THREE.Group(),old=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());parent.add(old);
 let finish;const ready=new Promise(r=>finish=r);const binding=productionBottles([{object:parent,height:.34}],s=>{if(s.includes('任务产品模型'))finish();});binding.update({id:'soda',name:'Soda',modelUrl:'test.glb'});await ready;
 assert.equal(old.visible,false);const box=new THREE.Box3().setFromObject(parent.children[1]);assert.ok(Math.abs(box.getSize(new THREE.Vector3()).y-.34)<.0001);assert.ok(Math.abs(box.min.y)<.0001);
 binding.update(null);assert.equal(old.visible,true);assert.equal(parent.children.length,1);binding.dispose();
 }finally{GLTFLoader.prototype.load=original;}
});
