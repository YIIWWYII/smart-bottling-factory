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

import {productDefaults,prepareProductCatalog,productResourceDocuments} from './src/product-resources.js';
test('product catalog starts with Yibao then cola; upgrades preserve user models, custom products and documents',()=>{
 assert.deepEqual(productDefaults.slice(0,2).map(p=>p.id),['yibao','cola']);
 const docs=[{id:'custom-doc',content:'keep'}],original=[{id:'custom',name:'Custom'},{id:'cola',name:'可乐',modelUrl:'/custom.glb',backgroundUrl:'/images/beverages/cola.webp',recipeId:'user-recipe',documentIds:['custom-doc']}];
 const result=prepareProductCatalog(original,docs);
 assert.deepEqual(result.slice(0,2).map(p=>p.id),['yibao','cola']);assert.equal(result[1].modelUrl,'/custom.glb');assert.equal(result[1].recipeId,'user-recipe');assert.equal(result[1].backgroundUrl,'/images/beverages/cola-lovart.webp');assert.ok(result[1].documentIds.includes('custom-doc'));assert.equal(result[2].id,'custom');
 assert.equal(original[1].backgroundUrl,'/images/beverages/cola.webp');assert.equal(docs.length,3);
 const again=prepareProductCatalog(result,docs);assert.deepEqual(again,result);assert.equal(docs.length,3);
 for(const d of productResourceDocuments)assert.ok(d.content&&docs.some(x=>x.id===d.id));
});
