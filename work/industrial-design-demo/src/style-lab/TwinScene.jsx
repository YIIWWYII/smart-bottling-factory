import {createRenderer,renderingProfile} from '../renderingPolicy';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMachine } from '../FactoryScene';
import { stages } from '../data';

export default function TwinScene({theme, selected, onSelect, paused, resetKey, view, material}) {
  const host = useRef(null), live = useRef({}), api = useRef(null);
  const [failed,setFailed] = useState(false);
  live.current = {selected,onSelect,paused,theme,view};
  useEffect(()=>{
    if(view==='process') return;
    const el=host.current;
    let renderer;
    try { renderer=createRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.25;
    renderer.domElement.setAttribute('aria-label','九工序装瓶产线三维场景');
    renderer.domElement.setAttribute('role','img');
    el.append(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,.1,180);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(0,.6,2);
    controls.enableDamping=true;controls.enablePan=false;controls.minDistance=10;controls.maxDistance=100;
    controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.1;
    const hemi=new THREE.HemisphereLight('#eef7ff','#6a786d',3);scene.add(hemi);
    const sun=new THREE.DirectionalLight('#fff2de',4.6);sun.position.set(-12,28,14);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24});sun.shadow.normalBias=.04;scene.add(sun);
    const rim=new THREE.DirectionalLight('#b5e5ff',2.6);rim.position.set(15,10,-12);scene.add(rim);
    const mat=(color,metalness=.2,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
    const materials={steel:mat('#c9d6d9',.65,.3),white:mat('#f8fcfa'),dark:mat('#34444f',.5,.5),roller:mat('#7a8e92',.7,.3),mint:mat('#64c6b0'),amber:mat('#ecae59'),orange:mat('#d08553'),red:mat('#ce665b'),blue:mat('#609eb9'),screen:mat('#193a43'),bottle:mat('#6caeae',.25,.22),cardboard:mat('#c3a77b',0,.9),tape:mat('#f0deb0'),path:mat('#ccd9d9',0,.9),glass:new THREE.MeshPhysicalMaterial({color:'#a9d9df',transparent:true,opacity:.34,roughness:.1,metalness:.1,side:THREE.DoubleSide})};
    const groundMat=mat('#d6e0de',.05,.88),baseMat=mat('#e5ebe9',.1,.7);
    const floor=new THREE.Mesh(new THREE.BoxGeometry(33,.23,25),groundMat);floor.position.set(0,-.22,2);floor.receiveShadow=true;scene.add(floor);
    const grid=new THREE.GridHelper(32,32,'#bacac9','#c7d4d2');grid.position.set(0,-.08,2);scene.add(grid);
    const animations=[], machines=[],bases=[];
    stages.forEach((s,i)=>{
      const m=createMachine(s,materials,fn=>animations.push(fn));m.position.set(s.x,0,s.z);m.userData.stage=i;machines.push(m);scene.add(m);
      const base=new THREE.Mesh(new THREE.BoxGeometry(6.9,.09,4.8),baseMat);base.position.set(s.x,-.015,s.z);base.receiveShadow=true;bases.push(base);scene.add(base);
      const texCanvas=document.createElement('canvas');texCanvas.width=256;texCanvas.height=64;
      const ctx=texCanvas.getContext('2d');ctx.fillStyle='#203946';ctx.fillRect(0,0,256,64);ctx.fillStyle='#ffffff';ctx.font='bold 25px sans-serif';ctx.textAlign='center';ctx.fillText(`${String(i+1).padStart(2,'0')}  ${s.id}`,128,42);
      const tex=new THREE.CanvasTexture(texCanvas);
      const label=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.45),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));label.rotation.x=-Math.PI/2;label.position.set(s.x,.048,s.z+1.95);scene.add(label);
    });
    const routeMat=new THREE.MeshBasicMaterial({color:'#3e9d9e'});
    for(let i=0;i<stages.length-1;i++){
      const a=stages[i],b=stages[i+1],dx=b.x-a.x,dz=b.z-a.z;
      const lane=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(dx)||.13,.018,Math.abs(dz)||.13),routeMat);
      lane.position.set((a.x+b.x)/2,.055,(a.z+b.z)/2);scene.add(lane);
    }
    const ring=new THREE.Mesh(new THREE.RingGeometry(3.35,3.4,72),new THREE.MeshBasicMaterial({color:'#237fe6',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.1;scene.add(ring);
    const ray=new THREE.Raycaster();let down;
    const pd=e=>{down=[e.clientX,e.clientY];};
    const pu=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=el.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObjects(machines,true)[0];if(hit){let o=hit.object;while(o&&o.userData.stage===undefined)o=o.parent;if(o)live.current.onSelect(o.userData.stage);}};
    renderer.domElement.addEventListener('pointerdown',pd);renderer.domElement.addEventListener('pointerup',pu);
    const home=()=>{
      const product=live.current.theme.layout==='product';
      const s=stages[live.current.selected];
      const scale=Math.max(1,1.45/(el.clientWidth/el.clientHeight));
      if(product){camera.position.set(s.x+9,7,s.z+11);controls.target.set(s.x,1.3,s.z);}
      else {camera.position.set(28*scale,28*scale,35*scale);controls.target.set(0,.6,2);}
      if(live.current.view==='top'){camera.position.set(0,52*scale,2.1);controls.target.set(0,0,2);}
      controls.update();
    };
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();home();};
    const apply=()=>{
      const t=live.current.theme,dark=t.dark,paper=['eink','raw','film'].includes(t.key),wire=t.key==='hud'||material==='wire';
      groundMat.color.set(dark?'#20333a':paper?'#d6d6c9':'#d7e2e2');
      baseMat.color.set(dark?'#2d4247':paper?'#e6e5d9':'#e6eeed');
      materials.steel.color.set(paper?'#c4c5b5':['clay','tactile'].includes(t.key)?'#eac2d8':t.key==='organic'?'#b6c6a3':'#c0d2d8');
      materials.amber.color.set(t.secondary);materials.mint.color.set(t.accent);materials.bottle.color.set(paper?'#899483':t.accent);routeMat.color.set(t.accent);ring.material.color.set(t.accent);
      Object.values(materials).forEach(m=>{m.wireframe=wire;if(m.metalness!==undefined)m.metalness=material==='matte'||['clay','flat','tactile','organic','nature'].includes(t.key)?0:.45;});
      const pixel=t.key==='pixel';renderer.setPixelRatio(pixel?.38:Math.min(devicePixelRatio,1.6));renderer.domElement.style.imageRendering=pixel?'pixelated':'auto';
      scene.fog=null;renderer.toneMappingExposure=t.key==='realistic'?1.05:1.25;
      resize();
    };
    api.current={home,apply};
    const observer=new ResizeObserver(resize);observer.observe(el);apply();
    let frame,last=performance.now(),time=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const loop=now=>{
      if(!live.current.paused&&!reduced.matches)time+=Math.min((now-last)/1000,.08);last=now;
      animations.forEach(fn=>fn(time));const s=stages[live.current.selected];ring.position.set(s.x,.1,s.z);
      controls.update();renderer.render(scene,camera);renderer.domElement.dataset.frames=String(Math.floor(time*60));frame=requestAnimationFrame(loop);
    };frame=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.map?.dispose();m.dispose();});});renderer.dispose();renderer.domElement.remove();api.current=null;};
  },[view==='process',material]);
  useEffect(()=>{api.current?.apply();},[theme.id,view]);
  useEffect(()=>{api.current?.home();},[resetKey,theme.layout==='product'?selected:null]);
  if(view==='process'||failed) return <div className="process-view">{stages.map((s,i)=><button key={s.id} className={selected===i?'chosen':''} onClick={()=>onSelect(i)}><span>{String(i+1).padStart(2,'0')}</span><strong>{s.short}</strong><small>{s.rate} 瓶/min</small><i className={i===5?'warning-dot':'status-dot'}/></button>)}</div>;
  return <div className="twin-canvas" ref={host}/>;
}
