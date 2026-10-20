import {loadingAssetCode} from './loadingZone';
import {mapDevice} from './course-coding/deviceMapping';
import {advanceAnimation} from './course-coding/animationLink';
import {builtinPlacements,isBuiltinAsset} from './builtinPlacements';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Uploaded GLBs use Y-up. Positions are measured from the existing scene origin.
export function createSceneAssets(root,device,codes,scene,camera,renderer,orbit,onChange,onSelect){
 const entries=new Map();let disposed=false,selected=null,focused=null,lastAssets=null,active=[],lastMode=null;
 const transform=new TransformControls(camera,renderer.domElement);transform.setSpace('world');scene.add(transform.getHelper());
 transform.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;if(!e.value&&transform.object){const o=transform.object;onChange?.({x:o.position.x,y:o.position.y,z:o.position.z,rotation:THREE.MathUtils.radToDeg(o.rotation.y),scale:o.scale.x*(o.userData.loadingCell?3:1)});}});
 const outline=new THREE.BoxHelper(new THREE.Object3D(),0xffb547);outline.visible=false;scene.add(outline);
 let press=null;
 const down=e=>{press={x:e.clientX,y:e.clientY,axis:transform.axis};};
 const up=e=>{if(!press||press.axis||transform.dragging||Math.hypot(e.clientX-press.x,e.clientY-press.y)>5)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const models=[...entries.values()].map(e=>e.model).filter(m=>m?.visible);const hit=ray.intersectObjects(models,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});if(hit){let o=hit.object;while(o){const entry=[...entries].find(([,e])=>e.model===o);if(entry){onSelect?.(entry[0]);return;}o=o.parent;}}};
 renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
 transform.addEventListener('objectChange',()=>{if(transform.mode==='scale'&&transform.object){const o=transform.object;const v=Math.max(.001,Math.min(100,o.scale.x));o.scale.setScalar(v);}});
 const release=e=>{if(e.builtin)return;e.model?.removeFromParent();e.mixer?.stopAllAction();e.model?.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean)){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});};
 return {
  update(assets,protocol,delta,paused,editId,mode,canProcess=()=>true){
   if(selected!==editId){selected=editId;focused=null;transform.detach();}
   if(lastMode!==mode){lastMode=mode;transform.setMode(mode||'translate');}transform.showX=mode!=='rotate';transform.showZ=mode==='translate';transform.showY=mode!=='scale';outline.visible=false;
   if(lastAssets!==assets){lastAssets=assets;active=assets.filter(a=>(isBuiltinAsset(a)||(a.enabled&&a.modelUrl&&a.placement?.enabled))&&(!device||codes[a.stageIndex]===device));
   for(const [id,e] of entries)if(!active.some(a=>a.id===id&&a.modelUrl===e.url)){if(transform.object===e.model)transform.detach();release(e);entries.delete(id);}
   }
   for(const a of active){
    let e=entries.get(a.id);
    if(!e&&a.code===loadingAssetCode){const model=root.getObjectByName('LoadingZone');if(!model)continue;e={builtin:true,loading:true,model,url:a.modelUrl};entries.set(a.id,e);}
    if(!e&&isBuiltinAsset(a)){
     const original=root.getObjectByName('Asset_'+codes[a.stageIndex]);if(!original)continue;
     const wrapper=new THREE.Group();wrapper.position.copy(original.position);original.parent.add(wrapper);wrapper.add(original);original.position.set(0,0,0);e={builtin:true,model:wrapper,url:a.modelUrl};entries.set(a.id,e);
    }
    if(!e){e={url:a.modelUrl};entries.set(a.id,e);new GLTFLoader().load(a.modelUrl,g=>{
      e.model=g.scene;
      if(disposed||entries.get(a.id)!==e){release(e);return;}
      e.model.name='PlacedAsset_'+a.id;e.model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.webDevice=codes[a.stageIndex];}});
      root.add(e.model);e.mixer=new THREE.AnimationMixer(e.model);e.clips=g.animations;e.actions=g.animations.map(c=>e.mixer.clipAction(c));
     },undefined,err=>{e.error=String(err);console.error('场景资产加载失败',a.name,err);});}
    if(!e.model)continue;
    const p=a.placement||builtinPlacements[a.stageIndex];e.model.visible=a.enabled&&p.enabled;if(!e.model.visible&&transform.object===e.model)transform.detach();if(!transform.dragging){e.model.position.set(p.x,p.y,p.z);e.model.rotation.y=THREE.MathUtils.degToRad(p.rotation);e.model.scale.setScalar(e.loading?p.scale/3:p.scale);}
    if(a.id===editId&&e.model.visible){outline.setFromObject(e.model);outline.visible=true;if(transform.object!==e.model)transform.attach(e.model);if(focused!==a.id){focused=a.id;root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(e.model),center=box.getCenter(new THREE.Vector3()),distance=Math.max(5,box.getSize(new THREE.Vector3()).length()*2);orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.8,1).normalize().multiplyScalar(distance));orbit.update();}}
    if(e.builtin)continue;
    const state=mapDevice(protocol,Date.now(),p);
    const clip=p.animationName||e.clips?.[0]?.name;
    if(e.activeClip!==clip){e.mixer.stopAllAction();const action=e.actions?.find(x=>x.getClip().name===clip);action?.reset().play();e.activeClip=clip;e.clipMissing=!!clip&&!action;}
    if(p.deviceId&&p.runPoint&&!paused&&!e.clipMissing&&canProcess(codes[a.stageIndex]))advanceAnimation(e.mixer,delta,state);
    e.model.userData.binding={deviceId:p.deviceId,online:state.online,running:state.running,time:e.mixer.time,animationName:clip,clipMissing:e.clipMissing};
   }
   root.userData.placedAssets=[...entries].map(([id,e])=>({id,loaded:!!e.model,error:e.error,...e.model?.userData.binding}));
  },
  dispose(){disposed=true;renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);scene.remove(outline);outline.geometry.dispose();outline.material.dispose();transform.detach();scene.remove(transform.getHelper());transform.dispose();entries.forEach(release);entries.clear();}
 };
}
