import {createRenderer,renderingProfile} from './renderingPolicy';
import {enableTouchOrbit} from './touchInteraction';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export default function ExhibitModel({kind='drink',onSelect,selected,modelUrl,motion}){
 const host=useRef(),callbacks=useRef(),highlight=useRef(()=>{});callbacks.current={onSelect,selected};const liveMotion=useRef(motion);liveMotion.current=motion;
 useEffect(()=>{highlight.current(selected);},[selected]);
 const [clips,setClips]=useState([]),[playing,setPlaying]=useState(false),animation=useRef(()=>{}),clipIndex=useRef(0);
 const [status,setStatus]=useState('loading'),[retry,setRetry]=useState(0),reset=useRef(()=>{});
 useEffect(()=>{
  let dead=false,renderer,root,env,mixer,frame;let running=false;const clock=new THREE.Clock();setClips([]);setPlaying(false);const el=host.current,disposables=[];setStatus('loading');
  try{renderer=createRenderer({antialias:true,alpha:true});}catch{setStatus('error');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label',kind==='process'?'可旋转的三维工艺产线':kind==='asset'?'可旋转的设备模型':'可旋转的饮料包装样例');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,500),controls=new OrbitControls(camera,renderer.domElement);const releaseTouch=enableTouchOrbit(controls,renderer.domElement);
  controls.enableDamping=false;controls.maxPolarAngle=kind==='process'?Math.PI*.48:Math.PI;controls.enablePan=kind==='process';
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0x667788,2));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(6,10,8);scene.add(light);
  const render=()=>{if(!dead)renderer.render(scene,camera);};controls.addEventListener('change',render);
  let selectionOutline;
  highlight.current=index=>{if(selectionOutline){scene.remove(selectionOutline);selectionOutline.geometry.dispose();selectionOutline.material.dispose();selectionOutline=null;}if(root&&index!==null&&index!==undefined){const box=new THREE.Box3();root.traverse(o=>{if(o.isMesh&&o.userData.stageIndex===index)box.expandByObject(o);});if(!box.isEmpty()){box.expandByScalar(.07);selectionOutline=new THREE.Box3Helper(box,0xd56815);scene.add(selectionOutline);}}render();};
  const fit=()=>{if(!root)return;const b=new THREE.Box3().setFromObject(root),center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());const halfFov=THREE.MathUtils.degToRad(camera.fov/2);const distance=Math.max(size.y,size.x/camera.aspect,size.z)/2/Math.tan(halfFov)*1.4;controls.target.copy(center);camera.position.copy(center).add(kind==='process'?new THREE.Vector3(distance*.12,distance*.55,distance):new THREE.Vector3(distance*.65,distance*.18,distance));camera.near=.01;camera.far=500;camera.updateProjectionMatrix();controls.update();render();};reset.current=fit;
  const resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();fit();render();});resize.observe(el);
  new GLTFLoader().load(kind==='process'?'/models/process.glb':(modelUrl||'/models/beverage/water-bottle.glb'),g=>{
   if(dead){g.scene.traverse(o=>{o.geometry?.dispose();});return;}root=g.scene;
   if(kind==='process'){
    root.updateMatrixWorld(true);const groups=new Map();
    root.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;let anchor=o;while(anchor.parent&&anchor.userData.stageIndex===undefined)anchor=anchor.parent;const stage=anchor.userData.stageIndex??-1,key=stage+':'+o.material.uuid;const geom=o.geometry.clone();geom.applyMatrix4(o.matrixWorld);for(const attr of Object.keys(geom.attributes))if(!['position','normal','uv'].includes(attr))geom.deleteAttribute(attr);if(!geom.attributes.uv)geom.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geom.attributes.position.count*2),2));if(!groups.has(key))groups.set(key,{material:o.material,stage,geo:[]});groups.get(key).geo.push(geom);disposables.push(o.geometry);});
    const batched=new THREE.Group();for(const {material,stage,geo} of groups.values()){const merged=mergeGeometries(geo);geo.forEach(g=>g.dispose());if(merged){const m=new THREE.Mesh(merged,material);m.userData.stageIndex=stage;batched.add(m);}}root=batched;
   }
   if(kind==='asset'&&g.animations.length){mixer=new THREE.AnimationMixer(root);setClips(g.animations.map(c=>c.name||'动画'));let action;animation.current=index=>{if(index<0){running=false;cancelAnimationFrame(frame);return;}action?.stop();action=mixer.clipAction(g.animations[index]);action.reset().play();if(!running){running=true;clock.getDelta();const tick=()=>{if(dead||!running)return;const m=liveMotion.current;const rate=m?(m.online&&m.running&&(!m.expiresAt||Date.now()<m.expiresAt)?m.rate:0):1;mixer.update(Math.min(clock.getDelta(),.1)*rate);el.dataset.animationTime=String(mixer.time);el.dataset.motionRate=String(rate);render();frame=requestAnimationFrame(tick);};tick();}};}scene.add(root);setStatus('ready');fit();highlight.current(callbacks.current.selected);
  },undefined,()=>{if(!dead)setStatus('error');});
  let down;const start=e=>down=[e.clientX,e.clientY];const pick=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||!root)return;const r=el.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObject(root,true).find(h=>h.object.userData.stageIndex>=0);if(hit)callbacks.current.onSelect?.(hit.object.userData.stageIndex);};
  el.addEventListener('pointerdown',start);el.addEventListener('pointerup',pick);
  return()=>{dead=true;cancelAnimationFrame(frame);mixer?.stopAllAction();animation.current=()=>{};highlight.current=()=>{};resize.disconnect();releaseTouch();controls.dispose();el.removeEventListener('pointerdown',start);el.removeEventListener('pointerup',pick);scene.traverse(o=>{o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.filter(Boolean).forEach(m=>{for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();});});disposables.forEach(g=>g.dispose());env?.dispose();renderer.dispose();renderer.domElement.remove();};
 },[kind,retry,modelUrl]);
 useEffect(()=>{if(status==='ready'&&motion){animation.current(0);setPlaying(true);}},[status,!!motion]);
 return <div className="exhibit-model"><div ref={host} className="exhibit-canvas"/>{status==='loading'&&<p className="model-message">正在加载三维模型…</p>}{status==='error'&&<div className="model-message">三维模型未能加载<button onClick={()=>setRetry(v=>v+1)}>重试</button></div>}<button className="model-reset" onClick={()=>reset.current()}>复位视角</button>{kind==='asset'&&status==='ready'&&(clips.length?<div className="asset-animation-controls"><button disabled={!!motion} onClick={()=>{animation.current(playing?-1:clipIndex.current);setPlaying(!playing);}}>{motion?'设备回读驱动':playing?'暂停动画':'播放动画'}</button><select aria-label="模型动画" onChange={e=>{clipIndex.current=Number(e.target.value);animation.current(clipIndex.current);setPlaying(true);}}>{clips.map((c,i)=><option key={i} value={i}>{c}</option>)}</select></div>:<span className="asset-animation-controls">此模型不含动画</span>)}<span className="model-hint">拖动旋转 · 滚轮缩放</span></div>;
}
