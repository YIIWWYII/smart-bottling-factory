import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// One shared geometry/material set per viewer; clones retain existing conveyor transforms.
export function productionBottles(targets,onStatus=()=>{}){
 let key,version=0,disposed=false,template=null,copies=[];
 const originals=targets.map(t=>({target:t,children:t.object.children.map(o=>({o,visible:o.visible})),visible:t.object.material?.visible}));
 const release=()=>{copies.forEach(o=>o.removeFromParent());copies=[];if(template){const geometries=new Set(),materials=new Set(),textures=new Set();template.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [o.material].flat().filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());template=null;}};
 const restore=()=>originals.forEach(({target,children,visible})=>{children.forEach(({o,visible})=>o.visible=visible);if(target.object.material)target.object.material.visible=visible;});
 return {update(product){const next=product?product.id+'|'+(product.modelUrl||''):'';if(next===key)return;key=next;const token=++version;release();restore();
 if(!product?.modelUrl){onStatus(product?'当前产品未配置模型 · 通用瓶体':'任务未绑定产品 · 通用瓶体');return;}
 onStatus('加载 '+product.name+' 模型');
 new GLTFLoader().load(product.modelUrl,g=>{
  const model=g.scene;
  if(disposed||token!==version){model.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean)){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});return;}
  template=model;const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0){release();onStatus('产品模型尺寸无效 · 通用瓶体');return;}
  for(const {target,children} of originals){children.forEach(({o})=>o.visible=false);if(target.object.material)target.object.material.visible=false;
   const wrapper=new THREE.Group(),clone=model.clone(true),scale=target.height/size.y;clone.scale.multiplyScalar(scale);clone.position.sub(new THREE.Vector3(center.x,box.min.y,center.z).multiplyScalar(scale));wrapper.add(clone);wrapper.position.y=target.bottom||0;target.object.add(wrapper);copies.push(wrapper);
  }
  onStatus(product.name+' · 任务产品模型');
 },undefined,()=>{if(token===version&&!disposed)onStatus('产品模型加载失败 · 通用瓶体');});
 },dispose(){disposed=true;version++;release();restore();}};
}
