import {createRenderer,renderingProfile} from './renderingPolicy';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Each station mounts only its own controls; idle models render no frames.
export default function PanelActuator({kind,ratio=0,label,disabled,onChange,onActivate}) {
 const host=useRef(null),animate=useRef(null),position=useRef(ratio),drag=useRef(null),[error,setError]=useState(false);
 position.current=ratio;
 useEffect(()=>{
  let alive=true,frame=0,renderer,root,mixer,observer;
  const element=host.current;
  const dispose=()=>{if(root)root.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material]))m?.dispose();});};
  try {
   renderer=createRenderer({alpha:true,antialias:true});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));renderer.setClearColor(0,0);
   renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   element.appendChild(renderer.domElement);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,30);
   camera.position.set(0,5.7,1.0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.zoom=1.2;camera.updateProjectionMatrix();
   scene.add(new THREE.HemisphereLight(0xeaf6ff,0x394652,1.5));
   const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(-3,6,4);key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.bias=-.001;scene.add(key);
   const rim=new THREE.DirectionalLight(0x9acfff,2);rim.position.set(4,3,-2);scene.add(rim);
   let current=position.current,duration=1;
   const render=()=>renderer.render(scene,camera);
   animate.current=(target,immediate=false)=>{
    cancelAnimationFrame(frame);const start=current,time=performance.now();
    const tick=()=>{if(!alive)return;const t=immediate||matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,(performance.now()-time)/130);current=start+(target-start)*(1-(1-t)**3);mixer?.setTime(Math.max(0,Math.min(.99999,current))*duration);render();if(t<1)frame=requestAnimationFrame(tick);};tick();
   };
   observer=new ResizeObserver(()=>{const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render();});observer.observe(element);
   new GLTFLoader().load(`/models/operator-panel/${kind}.glb`,g=>{
    root=g.scene;if(!alive){dispose();return;}root.traverse(o=>{if(o.isMesh){if(/_mount$|^mount.screw|^screw.slot/.test(o.name))o.visible=false;o.castShadow=true;o.receiveShadow=true;}});scene.add(root);
    if(g.animations.length){mixer=new THREE.AnimationMixer(root);const clip=g.animations[0];duration=clip.duration;mixer.clipAction(clip).play();}
    animate.current(position.current,true);
   },undefined,()=>{if(alive)setError(true);});
  } catch {setError(true);}
  return()=>{alive=false;cancelAnimationFrame(frame);animate.current=null;observer?.disconnect();mixer?.stopAllAction();dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();};
 },[kind]);
 useEffect(()=>{animate.current?.(ratio);},[ratio]);
 const step=(delta)=>onChange?.(Math.min(1,Math.max(0,ratio+delta)));
 return <div className={`panel-actuator actuator-${kind}`} role={onActivate?'button':'slider'} tabIndex={disabled?-1:0} aria-label={label} aria-disabled={disabled} aria-valuemin={onActivate?undefined:0} aria-valuemax={onActivate?undefined:100} aria-valuenow={onActivate?undefined:Math.round(ratio*100)}
 onPointerDown={e=>{if(disabled||!e.isPrimary||e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={y:e.clientY,x:e.clientX,ratio};if(kind==='push')animate.current?.(1);}}
 onPointerMove={e=>{if(!drag.current||disabled||onActivate)return;onChange?.(Math.max(0,Math.min(1,drag.current.ratio+(drag.current.y-e.clientY)/140)));}}
 onPointerUp={e=>{if(!drag.current)return;const moved=Math.abs(e.clientY-drag.current.y)+Math.abs(e.clientX-drag.current.x);drag.current=null;if(kind==='push')animate.current?.(0);if(!disabled&&moved<12)onActivate?.();}}
 onPointerCancel={()=>{drag.current=null;animate.current?.(ratio);}} onLostPointerCapture={()=>{drag.current=null;if(kind==='push')animate.current?.(0);}}
 onKeyDown={e=>{if(disabled)return;if(onActivate&&['Enter',' '].includes(e.key)){e.preventDefault();onActivate();}else if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='Home')onChange?.(0);else if(e.key==='End')onChange?.(1);else step(['ArrowUp','ArrowRight'].includes(e.key)?.025:-.025);}}}>
 <div ref={host} className="panel-actuator-canvas" aria-hidden="true"/>{error&&<span className="actuator-error">模型未加载，请使用下方按键</span>}
 </div>;
}
