import {createRenderer,renderingProfile} from './renderingPolicy';
import {createDownstream} from './downstreamMechanics';
import {materialStage,materialProgress,materialTravel,preprocessingPhase} from './materialFlow';
import {productionProduct} from './productionProduct';
import {productionBottles} from './productionBottle';
import {createLoadingZone,loadingAssetCode} from './loadingZone';
import {createSceneAssets} from './sceneAssets';
import {enableTouchOrbit} from './touchInteraction';
import {installVisionCameras} from './visionCameras';
import {linkageInfo} from './safetyScenarios';
import {loadFacilities,attachFacilities} from './safetyFacilities';
import {createAlarmIndicators} from './alarmIndicators';
import {isParameterDrivenPart,createDeviceMechanics,mechanismRate,stationCanAnimate} from './deviceMechanics';
import {useTwin,api} from './TwinState';
import { prepareProductTrack, sampleProduct, sampleMaterialPass } from './productMotion';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Pause, Play, RotateCcw } from 'lucide-react';

export const deviceCodes=['wash','gas','vision','beverage','filler','secondary','robot','agv','warehouse'];
const models=new Map();
let motion;
function loadModel(code){
 if(!models.has(code))models.set(code,new GLTFLoader().loadAsync(`/models/factory-realistic/${code}.glb?revision=reference-2`).catch(e=>{models.delete(code);throw e;}));
 return models.get(code);
}
function loadMotion(){return motion??=fetch('/models/factory/motion.json?revision=no-people').then(r=>{if(!r.ok)throw Error('动作文件加载失败');return r.json();}).catch(e=>{motion=null;throw e;});}

// Merge fixed parts within each device/moving assembly, keeping animated joints intact.
function batchStatic(root,animated){
 root.updateMatrixWorld(true);
 const groups=new Map(),dispose=[];
 root.traverse(o=>{
  if(!o.isMesh||Array.isArray(o.material)||animated.has(o))return;
  let anchor=o.parent;
  while(anchor!==root&&!animated.has(anchor)&&!anchor.name.startsWith('Asset_'))anchor=anchor.parent;
  const key=anchor.uuid+o.material.uuid;
  if(!groups.has(key))groups.set(key,{anchor,material:o.material,geometries:[],device:o.userData.webDevice});
  const g=o.geometry.clone();
  for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
  if(!g.attributes.normal)g.computeVertexNormals();
  if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  g.applyMatrix4(new THREE.Matrix4().copy(anchor.matrixWorld).invert().multiply(o.matrixWorld));
  groups.get(key).geometries.push(g);dispose.push(o);
 });
 for(const o of dispose)o.removeFromParent();
 for(const {anchor,material,geometries,device} of groups.values()){
  const geo=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  if(geo){const mesh=new THREE.Mesh(geo,material);mesh.userData.webDevice=device;anchor.add(mesh);}
 }
}

export default function BlenderScene({stationFraming=false,device=null,paused=false,onDeviceSelect,compact=false,selected=null,autoFocus=false,deviceStates=null,showMarkers=false,onTwinSelect,sceneAssets=null,editAssetId=null,onAssetSelect,onPlacementChange,transformMode="translate"}){
 const twin=useTwin();
 const mg400State=useRef(null);
 useEffect(()=>{let alive=true,timer;mg400State.current=null;if(twin?.dataMode==='simulation'||(device&&device!=='wash'))return;const poll=async()=>{try{if(!document.hidden){const result=await api('/api/ops/mg400');if(alive)mg400State.current=result;}}catch{if(mg400State.current)mg400State.current={...mg400State.current,online:false,feedback:null};}finally{if(alive)timer=setTimeout(poll,100);}};poll();return()=>{alive=false;clearTimeout(timer);};},[twin?.dataMode,device]);
 const markerRefs=useRef([]),linkageRefs=useRef({});
 const activeLinks=(twin?.safetyCases||[]).map(linkageInfo).filter(s=>s&&s.action&&s.phase!=='resolved'&&(!device||deviceCodes[s.stageIndex]===device));
 const host=useRef(),state=useRef({paused,onDeviceSelect}),reset=useRef(()=>{});
 const [status,setStatus]=useState('loading'),[running,setRunning]=useState(true),[retry,setRetry]=useState(0);
 deviceStates=deviceStates||twin?.states||[];
 state.current={logistics:twin?.logistics,materialFlow:twin?.materialFlow,product:productionProduct(twin),onAssetSelect,editAssetId,onPlacementChange,transformMode,assets:sceneAssets||twin?.ops?.assets||[],protocol:twin?.ops?.protocol,safetyCases:twin?.safetyCases||[],controls:twin?.ops?.controls||{},paused:paused||!running,onDeviceSelect,selected,autoFocus,deviceStates,onTwinSelect};
 useEffect(()=>{
  const el=host.current;let disposed=false,raf,renderer,controls,environment,root,mixer,resize,visibilityObserver;
  let inViewport=true,mechanics,loadingZone,bottleModels;
  let alarmIndicators,facilities,placedAssets,downstream;
  const geometries=new Set(),materials=new Set(),beltUniforms=[],actions=[],deviceMeshes=[],deviceAnchors=[],products=[];
  let focusGoal=null,lastFocus=null,lastLook=null,viewportFit=null,userMoved=false,dirty=true,lastRender=0,lastState=null;
  const colors={running:0x51dcb8,warning:0xffa447,fault:0xff4f62,stopped:0x7d8b9f};
  setStatus('loading');
  try{renderer=createRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setStatus('error');return;}
  const gl=renderer.getContext(),debug=gl.getExtension("WEBGL_debug_renderer_info");const gpu=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):"";const softwareGPU=/Basic Render|SwiftShader|llvmpipe|Software/i.test(gpu);el.dataset.gpu=gpu;el.dataset.renderProfile=softwareGPU?"software-balanced":"hardware";
  let pixelRatio=Math.min(Math.max(window.devicePixelRatio||1,1),Math.min(renderingProfile.dpr,softwareGPU?1:2));renderer.setPixelRatio(pixelRatio);el.dataset.pixelRatio=String(pixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=device?.95:.85;renderer.shadowMap.enabled=!softwareGPU;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  renderer.domElement.setAttribute('aria-label',device?'Blender 设备交互模型':'Blender 完整产线交互模型');el.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(device?36:38,1,.05,400);
  const coverTarget=new THREE.Vector3();
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.75;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf2f6ff,0x647787,device?.65:.65));const sun=new THREE.DirectionalLight(device?0xffe8d3:0xffffff,device?2.2:1.65);sun.position.set(...(device?[8,20,12]:[-6,14,9]));sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;sun.shadow.camera.far=80;sun.shadow.normalBias=.035;scene.add(sun);
  // Cover softboxes in Blender Z-up converted to Three.js Y-up; only the key casts shadows.
  if(!device){const fill=new THREE.DirectionalLight(0xf1f6ff,.5);fill.position.set(8,12,0);scene.add(fill);const strip=new THREE.DirectionalLight(0xffffff,.7);strip.position.set(-1,10,-8);scene.add(strip);sun.shadow.radius=3;}
  controls=new OrbitControls(camera,renderer.domElement);const releaseTouch=enableTouchOrbit(controls,renderer.domElement);controls.addEventListener('change',()=>{dirty=true;});controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=device?1:3;controls.maxDistance=device?30:95;controls.enablePan=true;controls.minZoom=.55;controls.maxZoom=6;controls.addEventListener("start",()=>{focusGoal=null;userMoved=true;});
  const size=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;const nextRatio=Math.min(Math.max(window.devicePixelRatio||1,1),Math.min(renderingProfile.dpr,softwareGPU?1:2));if(nextRatio!==pixelRatio){pixelRatio=nextRatio;renderer.setPixelRatio(pixelRatio);el.dataset.pixelRatio=String(pixelRatio);}dirty=true;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(stationFraming&&!userMoved)viewportFit?.();};
  resize=new ResizeObserver(size);resize.observe(el);size();
  visibilityObserver=new IntersectionObserver(([entry])=>{inViewport=entry.isIntersecting;});visibilityObserver.observe(el);
  let pointer;
  const down=e=>{pointer={x:e.clientX,y:e.clientY};};
  const up=e=>{
   if(!root||!pointer||Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>6)return;
   const rect=el.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
   const hits=ray.intersectObject(root,true);const hit=hits.find(h=>{let p=h.object,product=false;while(p){if(!p.visible)return false;if(p.userData.productTwin)product=true;p=p.parent;}const m=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex||0]:h.object.material;if(!product&&m?.transparent&&m.opacity<.65)return false;return product||!!h.object.userData.webDevice;});
   if(hit){let node=hit.object;while(node&&!node.userData.productTwin)node=node.parent;if(node?.userData.productTwin){state.current.onTwinSelect?.({...node.userData.productTwin});return;}state.current.onDeviceSelect?.(deviceCodes.indexOf(hit.object.userData.webDevice),{x:e.clientX,y:e.clientY});}
  };
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
  const contextLost=e=>{e.preventDefault();setStatus('error');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  const loadingAsset=state.current.assets.find(a=>a.code===loadingAssetCode&&a.enabled&&a.modelUrl);
  const loadingModel=loadingAsset&&(!device||device==='wash'||device==='robot')?new GLTFLoader().loadAsync(loadingAsset.modelUrl):Promise.resolve(null);
  Promise.all([loadModel(device||'hall'),loadMotion(),loadFacilities(device),loadingModel]).then(([gltf,data,auxiliary,loader])=>{
   if(disposed)return;
   dirty=true;root=gltf.scene.clone(true);downstream=createDownstream(root,loader);installVisionCameras(root);el.dataset.visionCameraCount=String(root.getObjectByName('Asset_vision')?.children.filter(o=>o.name.startsWith('VisionRig_')).length||0);
   const equipmentBounds=stationFraming?new THREE.Box3():null;
   if(equipmentBounds){root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;for(let n=o;n;n=n.parent)if(n.name.startsWith('Product_'))return;let visible=true;for(let n=o;n;n=n.parent)if(!n.visible)visible=false;if(visible){o.geometry.computeBoundingBox();equipmentBounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});}
   facilities=attachFacilities(root,auxiliary);if(equipmentBounds)for(const name of auxiliary.map(a=>a.name))equipmentBounds.expandByObject(root.getObjectByName('Auxiliary_'+name));
   // Own GPU resources per mounted viewer; the cached template stays immutable.
   const clonedMaterials=new Map();
   root.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();geometries.add(o.geometry);const clone=m=>{if(!clonedMaterials.has(m)){const c=m.clone();
// Thin machine guards keep transparency without a full-scene transmission pass.
if(softwareGPU&&c.clearcoat)c.clearcoat=0;
if(c.transmission>0){c.transmission=0;c.transparent=true;c.opacity=Math.min(c.opacity,.28);c.depthWrite=false;}
if(c.name.startsWith('FactoryHD.beltblue')){
 const time={value:0,code:o.userData.webDevice};beltUniforms.push(time);
 c.onBeforeCompile=shader=>{shader.uniforms.beltTime=time;shader.vertexShader='varying float vBeltX;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBeltX=position.x;');shader.fragmentShader='uniform float beltTime; varying float vBeltX;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.1,0.25,fract(vBeltX*9.0-beltTime*1.17));');};
 c.customProgramCacheKey=()=> 'factory-belt-v1';
}
clonedMaterials.set(m,c);materials.add(c);}return clonedMaterials.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}});
   const nodes=new Map();root.traverse(o=>{if(o.userData.webId)nodes.set(o.userData.webId,o);});
   const trackGroups=new Map();const animated=new Set([...facilities.preserve,...downstream.preserve]);
   for(const t of data.tracks){const o=nodes.get(t.id);if(!o||isParameterDrivenPart(o.name))continue;animated.add(o);const group=trackGroups.get(t.controller)||[];
    if(o.name.startsWith('Product_')){products.push({object:o,track:prepareProductTrack(t,data.times,data.duration),code:t.controller,loops:0,lastTime:0,baseScale:o.scale.clone()});o.userData.productTwin={kind:'product',id:o.name+'-0',name:'在制瓶 · '+o.name,stageIndex:deviceCodes.indexOf(t.controller)};}
    else group.push(new THREE.VectorKeyframeTrack(o.uuid+'.position',data.times,t.positions));
    group.push(new THREE.QuaternionKeyframeTrack(o.uuid+'.quaternion',data.times,t.quaternions),new THREE.VectorKeyframeTrack(o.uuid+'.scale',data.times,t.scales));trackGroups.set(t.controller,group);}
   const gasProducts=products.filter(p=>p.code===deviceCodes[1]);
   if(gasProducts.length){
    const source=gasProducts[0];
    for(let slot=gasProducts.length;slot<4;slot++){
     const object=source.object.clone(true);object.name=source.object.name+'_'+slot;object.userData.productTwin={...source.object.userData.productTwin,id:object.name+'-0'};
     source.object.parent.add(object);animated.add(object);
     products.push({...source,object,baseScale:object.scale.clone()});
    }
   }
   alarmIndicators=createAlarmIndicators(root);for(const o of alarmIndicators.preserve)animated.add(o);
   mechanics=createDeviceMechanics(root);for(const o of mechanics.preserve)animated.add(o);
   batchStatic(root,animated);loadingZone=createLoadingZone(root.getObjectByName('Asset_wash'),loader);if(loadingZone){loadingZone.zone.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())materials.add(m);});if(equipmentBounds)equipmentBounds.expandByObject(loadingZone.zone);}
   bottleModels=productionBottles([...products.filter(p=>!['robot','agv','warehouse'].includes(p.code)).map(p=>({object:p.object,height:.34})),...(loadingZone?.bottleTargets||[]),...downstream.bottleTargets],text=>{el.dataset.productModel=text;dirty=true;});
   root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);o.castShadow=!o.material.transparent;o.receiveShadow=!o.material.transparent;}});
   const bounds=equipmentBounds||new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3());
   el.dataset.bounds=JSON.stringify({size:extent.toArray(),center:center.toArray()});
   coverTarget.set(0,0,1).sub(center);
   const wrapper=new THREE.Group();wrapper.add(root);wrapper.position.copy(center).negate();scene.add(wrapper);placedAssets=createSceneAssets(root,device,deviceCodes,scene,camera,renderer,controls,p=>state.current.onPlacementChange?.(p),id=>state.current.onAssetSelect?.(id));
   if(device){const groundGeometry=new THREE.PlaneGeometry(extent.length()*2.2,extent.length()*2.2);const groundMaterial=new THREE.ShadowMaterial({color:0x091426,opacity:.28});const ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-extent.y/2-.01;ground.receiveShadow=true;scene.add(ground);geometries.add(groundGeometry);materials.add(groundMaterial);}

   mixer=new THREE.AnimationMixer(root);for(const [code,group] of trackGroups){const action=mixer.clipAction(new THREE.AnimationClip(code,data.duration,group));action.play();actions.push({code,action});}
   scene.updateMatrixWorld(true);
   for(const code of deviceCodes){
    const asset=root.getObjectByName('Asset_'+code);if(!asset)continue;
    const box=new THREE.Box3().setFromObject(asset),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    deviceAnchors.push({code,asset,local:asset.worldToLocal(center.clone()),size});
   }
   root.traverse(o=>{if(!o.isMesh||!o.userData.webDevice||Array.isArray(o.material))return;const old=o.material;const m=old.clone();m.onBeforeCompile=old.onBeforeCompile;m.customProgramCacheKey=old.customProgramCacheKey;materials.add(m);o.material=m;deviceMeshes.push({mesh:o,material:m,base:m.color.clone(),emission:m.emissive.clone(),code:o.userData.webDevice});});
   const selectionBox=new THREE.Box3Helper(new THREE.Box3(),0x6badff);selectionBox.visible=false;scene.add(selectionBox);geometries.add(selectionBox.geometry);materials.add(selectionBox.material);
   root.userData.selectionBox=selectionBox;
   const fit=()=>{if(!device){camera.zoom=1;const angle=THREE.MathUtils.degToRad(camera.fov/2);const distance=Math.max(30,16/Math.tan(angle)/Math.min(camera.aspect,1.8));camera.position.copy(coverTarget).add(new THREE.Vector3(12,20,29).normalize().multiplyScalar(distance));controls.target.copy(coverTarget);camera.updateProjectionMatrix();controls.update();return;}if(stationFraming){
    const direction=new THREE.Vector3(.25,.22,1.8).normalize();
    camera.position.copy(direction);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    const framingCenter=equipmentBounds.getCenter(new THREE.Vector3()).sub(center);
    const rotation=camera.quaternion.clone().invert(),tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    let distance=1;
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
     const corner=new THREE.Vector3(x*extent.x/2,y*extent.y/2,z*extent.z/2).applyQuaternion(rotation);
     distance=Math.max(distance,corner.z+Math.abs(corner.x)/(tanY*camera.aspect*.84),corner.z+Math.abs(corner.y)/(tanY*.84));
    }
    camera.position.copy(framingCenter).add(direction.multiplyScalar(distance));controls.target.copy(framingCenter);controls.update();return;
   }const radius=extent.length()*.5;const angle=THREE.MathUtils.degToRad(camera.fov/2);const distance=radius/Math.sin(Math.min(angle,Math.atan(Math.tan(angle)*camera.aspect)))*(device ? .83 : camera.aspect<1 ? 1.05 : .9);camera.position.copy(new THREE.Vector3(device?.25:1.15,device?.22:1.05,device?1.8:1.3).normalize().multiplyScalar(distance));controls.target.set(0,0,0);controls.update();};
   viewportFit=fit;reset.current=()=>{focusGoal=null;userMoved=false;fit();};fit();setStatus('ready');el.dataset.model=device||'hall';el.dataset.motionTracks=String(animated.size);
  }).catch(e=>{if(!disposed){console.error('Blender model load:',e);setStatus('error');}});
  const clock=new THREE.Clock();let statsAt=0,shadowAt=-1,boxAt=-1,frames=0,frameMs=0,markerAt=-1;
  const render=()=>{if(disposed)return;raf=requestAnimationFrame(render);const elapsed=clock.getDelta();if(document.hidden||!inViewport||el.closest("[hidden]")||!el.clientWidth||!el.clientHeight){return;}if(clock.elapsedTime-lastRender<1/Math.min(renderingProfile.fps,softwareGPU?30:60))return;const snapshot=state.current;
   const changed=lastState?.deviceStates!==snapshot.deviceStates||lastState?.controls!==snapshot.controls||lastState?.assets!==snapshot.assets||lastState?.selected!==snapshot.selected||lastState?.paused!==snapshot.paused||lastState?.editAssetId!==snapshot.editAssetId||lastState?.transformMode!==snapshot.transformMode;
   lastState=snapshot;if(changed){dirty=true;renderer.shadowMap.needsUpdate=true;}
   const liveWash=snapshot.deviceStates[0],washPhase=liveWash?.washPhase??(snapshot.materialFlow?(liveWash?.measurements?.washFlow>0?'rinse':liveWash?.measurements?.airFlow>0?'air':preprocessingPhase(snapshot.materialFlow,snapshot.controls)):'waiting'),washActive=liveWash?.quality!=='offline'&&liveWash?.mode==='running'&&['rinse','air'].includes(washPhase)&&((liveWash.measurements?.washFlow||0)>0||(liveWash.measurements?.airFlow||0)>0);
   const moving=!!mg400State.current?.online||!snapshot.paused&&(snapshot.deviceStates.some((s,i)=>(!device||deviceCodes[i]===device)&&stationCanAnimate(s,false))||(!device||device==='wash')&&washActive);
   const effects=snapshot.safetyCases.some(c=>c.phase!=='resolved')||snapshot.deviceStates.some(s=>s.alarms?.length);
   controls.update();
   if(!dirty&&!moving&&!effects&&!focusGoal&&clock.elapsedTime-lastRender<.25)return;
   const flow=snapshot.materialFlow;const processes=code=>{const index=deviceCodes.indexOf(code);return flow?materialStage(flow,index).processing:state.current.deviceStates[index]?.material?.processing===true;};
   const frameElapsed=clock.elapsedTime-lastRender,delta=Math.min(frameElapsed,.1);lastRender=clock.elapsedTime;dirty=false;frames++;frameMs+=frameElapsed;for(const {code,action} of actions){const mode=state.current.deviceStates?.[deviceCodes.indexOf(code)]?.mode;action.paused=!processes(code)||!stationCanAnimate(state.current.deviceStates?.[deviceCodes.indexOf(code)],state.current.paused);action.timeScale=mechanismRate(code,state.current.controls);
    if(flow){const index=deviceCodes.indexOf(code),token=flow.stages[index]?.[0];action.paused=true;
     const progress=index===3?flow.prep/flow.prepDuration:token?Math.max(0,Math.min(1,(materialProgress(flow,token)*token.duration-2)/Math.max(1,token.duration-4))):0;
     action.time=Math.min(action.getClip().duration-.001,progress*action.getClip().duration);
    }}
   if(flow)mixer?.update(0);if(!state.current.paused){if(!flow)mixer?.update(delta);for(const u of beltUniforms){const mode=state.current.deviceStates?.[deviceCodes.indexOf(u.code)]?.mode;if(stationCanAnimate(state.current.deviceStates?.[deviceCodes.indexOf(u.code)]))u.value+=delta*mechanismRate(u.code,state.current.controls);}}
   const used=new Map();
   for(const product of products){
    const index=deviceCodes.indexOf(product.code),slot=used.get(index)||0;used.set(index,slot+1);
    const token=flow?.stages[index]?.[slot];product.object.visible=!!token&&!['robot','agv','warehouse'].includes(product.code);
    if(!token)continue;
    const progress=materialTravel(flow,token);product.object.position.fromArray(sampleMaterialPass(product.track,progress));if(index===1)product.object.position.x+=(slot-1.5)*.28;product.object.scale.copy(product.baseScale);
    product.object.userData.productTwin={...product.object.userData.productTwin,id:token.id,name:state.current.product?.name||'在制物料',count:token.count};
   }
   if(root){
    const current=state.current,selectedCode=deviceCodes[current.selected];
    const look=JSON.stringify([current.selected,current.deviceStates?.map(s=>[s.mode,s.alarmLevel])]);
    if(look!==lastLook){lastLook=look;
     for(const item of deviceMeshes){const itemState=current.deviceStates?.[deviceCodes.indexOf(item.code)],mode=itemState?.alarmLevel==='critical'?'fault':itemState?.alarmLevel==='warning'?'warning':itemState?.mode||'running',chosen=item.code===selectedCode;
      item.material.color.copy(item.base).multiplyScalar(current.selected!==null && !chosen ? .92 : 1);
      item.material.emissive.set(mode==='fault'||mode==='warning'||mode==='stopped'?colors[mode]:chosen?0x277aff:0x000000);item.material.emissiveIntensity=mode==='fault'?.18:mode==='warning'?.1:mode==='stopped'?0:chosen?.08:0;
     }
     el.dataset.selected=selectedCode||'';el.dataset.states=JSON.stringify(current.deviceStates?.map(s=>[s.mode,s.alarmLevel])||[]);
    }
    const anchor=deviceAnchors.find(a=>a.code===selectedCode);
    const focusKey=current.autoFocus?selectedCode:null;
    if(focusKey!==lastFocus){lastFocus=focusKey;if(anchor&&current.autoFocus){const target=anchor.asset.localToWorld(anchor.local.clone());const d=Math.max(5,anchor.size.length()*1.65);focusGoal={target,position:target.clone().add(new THREE.Vector3(1,.85,1.25).normalize().multiplyScalar(d))};}}
    if(focusGoal){const t=window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:1-Math.exp(-delta*5);camera.position.lerp(focusGoal.position,t);controls.target.lerp(focusGoal.target,t);if(camera.position.distanceTo(focusGoal.position)<.02)focusGoal=null;}
    const selectionBox=root.userData.selectionBox;selectionBox.visible=!!anchor;if(anchor&&(look!==el.dataset.boxLook||clock.elapsedTime-boxAt>.15)){selectionBox.box.setFromObject(anchor.asset).expandByScalar(.12);boxAt=clock.elapsedTime;el.dataset.boxLook=look;}
    if(clock.elapsedTime-markerAt>1/30){markerAt=clock.elapsedTime;for(const a of deviceAnchors){const i=deviceCodes.indexOf(a.code),marker=markerRefs.current[i];if(!marker)continue;const pos=a.asset.localToWorld(a.local.clone());pos.y+=a.size.y*.6;pos.project(camera);marker.style.left=((pos.x+1)*.5*el.clientWidth)+'px';marker.style.top=((-pos.y+1)*.5*el.clientHeight)+'px';marker.style.visibility=pos.z>1||pos.z< -1||Math.abs(pos.x)>.95||Math.abs(pos.y)>.85?'hidden':'visible';}}
   }
   downstream?.update(flow,state.current.logistics,state.current.paused);
   bottleModels?.update(state.current.product);
   loadingZone?.update(delta,state.current.deviceStates[0],state.current.paused,state.current.assets.some(a=>a.code===loadingAssetCode&&a.enabled),flow?{present:!!flow.loader,progress:materialProgress(flow,flow.loader),running:flow.running}: {present:false,progress:0,running:false},mg400State.current);if(loadingZone){el.dataset.loadingPhase=loadingZone.zone.userData.phase;el.dataset.loadingTime=String(loadingZone.zone.userData.cycleTime);}
   placedAssets?.update(state.current.assets,state.current.protocol,delta,state.current.paused,state.current.editAssetId,state.current.transformMode,code=>processes(code));
   facilities?.update(delta,state.current.safetyCases);
   alarmIndicators?.update(clock.elapsedTime,state.current.deviceStates.flatMap(s=>s.alarms||[]),window.matchMedia('(prefers-reduced-motion: reduce)').matches,state.current.deviceStates);
   const washState=state.current.deviceStates[0],washFeedback={'PT-WASH-01:washFlow':washState?.measurements?.washFlow??(flow?state.current.controls['PT-WASH-01:washFlow']:0),'PT-AIR-01:airFlow':washState?.measurements?.airFlow??(flow?state.current.controls['PT-AIR-01:airFlow']:0),'PT-WASH-01:runState':washActive?'RUNNING':'PAUSED','PT-AIR-01:runState':washActive?'RUNNING':'PAUSED'};
   const washEffects=mechanics?.update(delta,{...state.current.controls,...washFeedback,__washPhase:washPhase},code=>code==='wash'&&washActive?!state.current.paused:processes(code)&&stationCanAnimate(state.current.deviceStates?.[deviceCodes.indexOf(code)],state.current.paused));
   el.dataset.mechanismState=JSON.stringify(washEffects);
   controls.update();for(const c of state.current.safetyCases){const info=linkageInfo(c),label=linkageRefs.current[c.id];if(!label||!info)continue;const p=facilities?.project(info.facility,camera);if(!p)continue;label.style.left=Math.max(8,Math.min(el.clientWidth-250,(p.x+1)*.5*el.clientWidth+16))+'px';label.style.top=Math.max(8,Math.min(el.clientHeight-110,(-p.y+1)*.5*el.clientHeight-90))+'px';label.style.visibility=p.z>1||p.z< -1?'hidden':'visible';}const renderStart=performance.now();if(clock.elapsedTime-shadowAt>.15&&(moving||effects||shadowAt<0)){renderer.shadowMap.needsUpdate=true;shadowAt=clock.elapsedTime;}if(el.clientWidth&&el.clientHeight)renderer.render(scene,camera);if(clock.elapsedTime-statsAt>1){statsAt=clock.elapsedTime;el.dataset.renderMs=(performance.now()-renderStart).toFixed(1);el.dataset.fps=String(Math.round(frames/Math.max(frameMs,.001)));frames=0;frameMs=0;el.dataset.pixelRatio=String(pixelRatio);el.dataset.motionTime=String(mixer?.time||0);el.dataset.productCount=String(products.length);el.dataset.productPositions=JSON.stringify(products.slice(0,5).map(p=>({id:p.object.userData.productTwin.id,position:p.object.position.toArray(),visible:p.object.visible,screen:p.object.getWorldPosition(new THREE.Vector3()).project(camera).toArray()})));el.dataset.actionTimes=JSON.stringify(Object.fromEntries(actions.map(({code,action})=>[code,action.time])));el.dataset.placedAssets=JSON.stringify(root?.userData.placedAssets||[]);el.dataset.camera=JSON.stringify(camera.position.toArray());el.dataset.drawCalls=String(renderer.info.render.calls);el.dataset.triangles=String(renderer.info.render.triangles);}};render();
  return()=>{disposed=true;cancelAnimationFrame(raf);resize.disconnect();visibilityObserver.disconnect();releaseTouch();controls.dispose();mixer?.stopAllAction();mechanics?.dispose();loadingZone?.dispose();downstream?.dispose();bottleModels?.dispose();alarmIndicators?.dispose();facilities?.dispose();placedAssets?.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();renderer.domElement.remove();};
 },[device,retry,stationFraming]);
 return <div className={`blender-view ${compact?'compact':''}`}>
  <div className="blender-canvas" ref={host}/>
  {showMarkers&&status==='ready'&&deviceCodes.map((code,i)=><button key={code} ref={e=>markerRefs.current[i]=e} className={`device-marker ${selected===i?'selected':''} state-${deviceStates?.[i]?.alarmLevel==='critical'?'fault':deviceStates?.[i]?.alarmLevel==='warning'?'warning':deviceStates?.[i]?.mode||'running'}`} aria-label={`选择 ${['预处理','气体检测','外观检测','饮料准备','灌装','二次检测','装箱','AGV 运输','仓储'][i]}`} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();onDeviceSelect?.(i,{x:r.right,y:r.top});}}><b>{String(i+1).padStart(2,'0')}</b>{deviceStates?.[i]?.alarms?.length>0&&<span className="marker-alarm-count">! {deviceStates[i].alarms.length}</span>}</button>)}
  {status!=='ready'&&<div className="model-loading" role="status">{status==='loading'?<><span className="model-spinner"/>正在加载 {device?'设备':'产线'}模型</>:<>模型加载失败<button onClick={()=>setRetry(v=>v+1)}>重新加载</button></>}</div>}
  <div className="model-controls"><button onClick={()=>reset.current()} aria-label="复位模型视角" title="复位视角"><RotateCcw size={17}/></button>{!device&&<button onClick={()=>setRunning(v=>!v)} aria-label={running?'暂停产线动画':'恢复产线动画'}>{running?<Pause size={17}/>:<Play size={17}/>}</button>}</div>
  {deviceStates.some((s,i)=>(!device||deviceCodes[i]===device)&&s.alarms?.length>0)&&<details className="model-alarm-panel" open={!!device}><summary>设备告警 · {deviceStates.filter((s,i)=>!device||deviceCodes[i]===device).reduce((n,s)=>n+(s.alarms?.length||0),0)} 项</summary><div>{deviceStates.flatMap((s,i)=>(!device||deviceCodes[i]===device)?(s.alarms||[]):[]).map(a=><article key={a.id} data-level={a.level}><strong>{a.level==='critical'?'严重':'预警'} · {a.title}</strong><span>{a.metric}：{a.value} {a.unit} / {a.direction==='low'?'≤':'≥'} {a.threshold} {a.unit}</span><small>{a.dataSource==='protocol'?'协议仿真回读':a.source==='setting'?'模拟设定值':a.dataSource==='real'?'真实遥测':'模拟读数'} · {a.advice}</small></article>)}</div></details>}
  {activeLinks.map(s=><div key={s.id} ref={e=>linkageRefs.current[s.id]=e} className="model-linkage-label"><strong>{s.target}</strong><span>{s.sourceName} → {s.phase==='awaiting-reset'?'保护保持':'联动已触发'}</span><small>原因：{s.reason}</small><small>结果：{s.outcome}（模拟）</small></div>)}<span className="model-caption">设备现场 · {device==='warehouse'?'移载入库 · 库位库存同步':paused||!running?'动画暂停':'状态驱动示意'}<small>拖动旋转 · 滚轮缩放 · 点击瓶体查看在制品</small></span>
 </div>;
}
