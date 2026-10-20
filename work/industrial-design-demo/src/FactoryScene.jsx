import {createRenderer,renderingProfile} from './renderingPolicy';
import {enableTouchOrbit} from './touchInteraction';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { stages } from './data';

export function createMachine(stage, materials, addAnimated) {
  const group = new THREE.Group();
  const box = (w,h,d,x,y,z,mat=materials.steel,round=false) => {
    const mesh = new THREE.Mesh(round ? new RoundedBoxGeometry(w,h,d,2,.07) : new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh); return mesh;
  };
  const cylinder = (r,h,x,y,z,mat=materials.steel,r2=r) => { const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r2,h,24),mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; group.add(m); return m; };
  const belt = () => {
    box(5.7,.24,1.2,0,.92,0,materials.dark); box(5.7,.12,.12,0,1.13,.65); box(5.7,.12,.12,0,1.13,-.65);
    [-2.3,2.3].forEach(x=>[-.45,.45].forEach(z=>box(.1,.9,.1,x,.45,z)));
    for(let x=-2.5;x<2.6;x+=.38){const roller=cylinder(.095,1.04,x,1.04,0,materials.roller); roller.rotation.x=Math.PI/2;}
    for(let i=0;i<8;i++){
      const bottle=new THREE.Group();
      const body=new THREE.Mesh(new THREE.CylinderGeometry(.115,.14,.43,12),materials.bottle);body.position.y=.24;
      const neck=new THREE.Mesh(new THREE.CylinderGeometry(.055,.09,.16,12),materials.bottle);neck.position.y=.51;
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.07,12),materials.white);cap.position.y=.615;
      bottle.add(body,neck,cap);bottle.position.set(-2.6+i*.7,1.1,0);group.add(bottle);
      addAnimated(t=>{bottle.position.x=((t*.5+i*.7)%5.4)-2.7;});
    }
  };
  const screen = (x=1.65,y=1.9,z=.95) => {
    box(.55,.48,.11,x,y,z,materials.dark,true);box(.43,.31,.015,x,y+.02,z+.065,materials.screen);
    box(.15,.025,.02,x-.09,y+.08,z+.075,materials.mint);box(.24,.025,.02,x,y-.02,z+.075,materials.mint);
    cylinder(.045,.04,x-.12,y-.18,z+.07,materials.red).rotation.x=Math.PI/2;
  };
  const tower = (x,z) => {cylinder(.045,.5,x,3.1,z);cylinder(.09,.16,x,3.4,z,stage.id==='QC'?materials.amber:materials.mint);};
  if(stage.id==='MIX'){
    [-1.1,1.1].forEach((x,i)=>{cylinder(.86,2.8,x,1.75,0);cylinder(.18,.25,x,3.3,0,materials.dark);cylinder(.86,.36,x,.22,0,materials.steel,.3);[-.5,.5].forEach(z=>box(.1,.7,.1,x,.35,z));box(.22,1.6,.05,x,1.7,.86,materials.screen);});
    box(2.2,.12,.12,0,3.2,0);screen(2.1,1.7,.2);cylinder(.16,1.4,2.1,.7,.1,materials.dark);
  } else if(stage.id==='PK') {
    belt();cylinder(.7,.35,0,.18,-1.45,materials.dark);cylinder(.46,.5,0,.58,-1.45,materials.amber);
    const arm=new THREE.Group();arm.position.set(0,.85,-1.45);group.add(arm);
    const segment=(w,h,d,x,y,z,rot=0)=>{const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,.08),materials.amber);m.position.set(x,y,z);m.rotation.z=rot;m.castShadow=true;arm.add(m);};
    segment(.55,1.5,.55,-.25,.5,0,-.5);segment(1.6,.42,.46,.28,1.35,0,.18);segment(.3,.8,.3,1,1.15,0);segment(.6,.15,.5,1,.72,0);
    addAnimated(t=>{arm.rotation.y=Math.sin(t*.65)*.45;});
    box(1.2,.8,1.2,1.7,.5,1.6,materials.cardboard);box(1.3,.15,1.3,1.7,.1,1.6,materials.dark);
  } else if(stage.id==='AGV') {
    box(4.8,.03,2.7,0,.02,0,materials.path);const agv=new THREE.Group();group.add(agv);
    const unit=new THREE.Mesh(new RoundedBoxGeometry(2.7,.48,1.9,2,.12),materials.steel);unit.position.y=.45;unit.castShadow=true;agv.add(unit);
    const top=new THREE.Mesh(new THREE.BoxGeometry(2.35,.12,1.55),materials.amber);top.position.y=.75;agv.add(top);
    for(let i=0;i<4;i++){const c=new THREE.Mesh(new THREE.BoxGeometry(.85,.68,.6),materials.cardboard);c.position.set(i%2-.5,1.12,Math.floor(i/2)*.7-.35);c.castShadow=true;agv.add(c);}
    [-1,1].forEach(x=>[-.83,.83].forEach(z=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.18,16),materials.dark);w.rotation.x=Math.PI/2;w.position.set(x,.25,z);agv.add(w);}));
    addAnimated(t=>{agv.position.x=Math.sin(t*.5)*.8;});
  } else if(stage.id==='WH') {
    [-1.5,1.5].forEach(x=>[-.8,.8].forEach(z=>box(.14,3.6,.14,x,1.8,z,materials.orange)));
    [.2,1.3,2.4].forEach(y=>{box(3.3,.12,1.9,0,y,0,materials.steel);[-.95,0,.95].forEach(x=>{box(.8,.85,1.15,x,y+.49,0,materials.cardboard);box(.1,.86,1.16,x,y+.5,0,materials.tape);});});
  } else {
    belt();
    if(stage.id==='FIL') {
      box(3.8,.65,1.65,0,.55,0,materials.steel,true);
      [-1.75,1.75].forEach(x=>[-.8,.8].forEach(z=>box(.1,2.8,.1,x,1.8,z)));
      box(3.9,.4,1.85,0,3.25,0,materials.steel,true);box(3.4,1.65,.03,0,2.15,-.78,materials.glass);
      [-1.2,-.4,.4,1.2].forEach(x=>{cylinder(.1,.75,x,2.62,0);cylinder(.16,.3,x,3.55,0);});
      box(3.5,.07,.07,0,2.9,0,materials.blue);screen();tower(-1.75,-.8);
    } else if(stage.id==='PRE') {
      box(3.5,1.75,1.75,0,2.04,0,materials.steel,true);box(2.6,.78,.04,0,2.16,.9,materials.glass);box(3.5,.3,1.9,0,3.05,0);
      [-1,1].forEach(x=>cylinder(.18,.6,x,3.5,0));screen(2,1.7,.8);tower(-1.5,-.7);
    } else {
      [-1.4,1.4].forEach(x=>box(.15,2.2,1.6,x,2.15,0));box(3,.3,1.65,0,3.2,0,materials.steel,true);
      if(stage.id==='VIS'){box(.7,.6,.55,0,2.8,0,materials.dark,true);cylinder(.2,.18,0,2.38,0,materials.blue);box(.04,.015,1.1,0,1.16,0,materials.mint);}
      if(stage.id==='GAS'){box(2.5,1.5,.04,0,2,-.7,materials.glass);cylinder(.23,.9,.75,2.2,0,materials.mint);}
      if(stage.id==='QC'){box(2,.13,1.2,0,1.17,0,materials.amber);box(.5,.4,.5,-1,1.5,-.7,materials.dark);}
      screen(1.75,2,.85);tower(-1.4,-.65);
    }
  }
  return group;
}

export default function FactoryScene({ variant='line', selected=4, paused=false, mode='3d', resetKey=0, onSelect }) {
  const root=useRef(null), live=useRef({paused,selected,onSelect}), [failed,setFailed]=useState(false);
  live.current={paused,selected,onSelect};
  useEffect(()=>{
    const container=root.current;
    if(mode==='2d') return;
    let renderer;
    try {renderer=createRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});} catch {setFailed(true);return;}
    const light=variant==='station';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x000000,0);renderer.domElement.setAttribute('aria-label',light?'当前工序三维设备':'九工序三维装瓶生产线');renderer.domElement.setAttribute('role','img');
    container.prepend(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(light?34:36,1,.1,180);
    const target=light?new THREE.Vector3(0,1.4,0):new THREE.Vector3(0,0.4,1.5);
    camera.position.set(...(light?[7,5.8,8.8]:[28,27,33]));camera.lookAt(target);
    const controls=new OrbitControls(camera,renderer.domElement);const releaseTouch=enableTouchOrbit(controls,renderer.domElement);controls.target.copy(target);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=light?7:24;controls.maxDistance=light?20:75;controls.maxPolarAngle=Math.PI*.46;controls.minPolarAngle=.25;controls.enableZoom=true;
    scene.add(new THREE.HemisphereLight(light?0xffffff:0xe2fff3,light?0x8b938f:0x647a70,3));
    const sun=new THREE.DirectionalLight(0xfff5df,4);sun.position.set(-9,24,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;sun.shadow.normalBias=.035;scene.add(sun);
    const rim=new THREE.DirectionalLight(0xb2dfff,2);rim.position.set(12,10,-12);scene.add(rim);
    const mat=(color,metalness=.2,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
    const materials={steel:mat('#b2c1bc',.65,.32),white:mat('#dce5df'),dark:mat('#2a3a35',.4,.55),roller:mat('#657c73',.7,.4),mint:mat('#9ce7ba',.2,.4),amber:mat('#dfa955',.4,.4),orange:mat('#bf7444'),red:mat('#cf6659'),blue:mat('#729fa6'),screen:mat('#1a4644'),bottle:mat('#559980',.3,.18),cardboard:mat('#b9a079',0,.9),tape:mat('#ddd0aa',0,.9),path:mat(light?'#d8ded5':'#40594a',0,.8),glass:new THREE.MeshPhysicalMaterial({color:'#6f9892',metalness:.2,roughness:.12,transparent:true,opacity:.4,side:THREE.DoubleSide})};
    const floorMaterial=light?new THREE.ShadowMaterial({color:'#798475',opacity:.2}):mat('#24362e',.1,.92);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(light?20:37,light?20:27),floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.set(0,-.03,light?0:2);floor.receiveShadow=true;scene.add(floor);
    const grid=new THREE.GridHelper(light?16:36,light?16:36,light?'#c7cec7':'#3d5147',light?'#d4d9d2':'#30443a');grid.position.set(0,.002,light?0:2);scene.add(grid);
    const animations=[], machines=[];
    const active=light?[stages[selected]]:stages;
    active.forEach(stage=>{
      const model=createMachine(stage,materials,fn=>animations.push(fn));if(!light)model.position.set(stage.x,0,stage.z);model.userData.stage=stages.indexOf(stage);scene.add(model);machines.push(model);
      if(!light){const base=new THREE.Mesh(new THREE.BoxGeometry(6.8,.06,4.7),mat('#354a3e',.1,.95));base.position.set(stage.x,.025,stage.z);scene.add(base);}
    });
    if(!light){
      const points=stages.map(s=>new THREE.Vector3(s.x,.09,s.z));
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#9fbea7',transparent:true,opacity:.55}));scene.add(line);
      for(let x=-15;x<=15;x+=30){for(let z=-8;z<=12;z+=20){const p=new THREE.Mesh(new THREE.BoxGeometry(.14,.025,2),materials.amber);p.position.set(x,.015,z);scene.add(p);}}
    }
    const selection=new THREE.Mesh(new THREE.RingGeometry(light?2.9:3.5,light?2.93:3.54,64),new THREE.MeshBasicMaterial({color:light?'#d16642':'#bbecd0',transparent:true,opacity:.55,side:THREE.DoubleSide}));selection.rotation.x=-Math.PI/2;selection.position.y=.11;scene.add(selection);
    const raycaster=new THREE.Raycaster();let down=null;
    const pointerDown=e=>{down=[e.clientX,e.clientY];};
    const pointerUp=e=>{if(light||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=raycaster.intersectObjects(machines,true);if(hits.length){let obj=hits[0].object;while(obj.parent && obj.userData.stage===undefined)obj=obj.parent;if(obj.userData.stage!==undefined)live.current.onSelect?.(obj.userData.stage);}};
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
    const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;if(!light){const scale=Math.max(1,1.35/camera.aspect);camera.position.set(28*scale,27*scale,33*scale);}camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    let frame,time=0,last=performance.now();const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const loop=now=>{const dt=Math.min((now-last)/1000,.05);last=now;if(!live.current.paused&&!reduced.matches)time+=dt;animations.forEach(fn=>fn(time));if(!light){const s=stages[live.current.selected];selection.position.x=s.x;selection.position.z=s.z;}controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(loop);};frame=requestAnimationFrame(loop);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();releaseTouch();controls.dispose();scene.traverse(obj=>{obj.geometry?.dispose();if(obj.material){(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
  },[variant,mode,resetKey,variant==='station'?selected:null]);
  return <div className={`factory-scene ${variant}`} ref={root}>
    {mode==='2d'&&<div className="process-plan">{stages.map((s,i)=><button key={s.id} onClick={()=>onSelect(i)} className={`plan-machine ${selected===i?'selected':''}`}><span className="mono">{String(i+1).padStart(2,'0')}</span><div className={`machine-glyph glyph-${i}`}><i/><i/><i/></div><strong>{s.short}</strong><small><b className={`dot ${i===5?'amber':''}`}/>{s.rate} 瓶/min</small></button>)}</div>}
    {failed&&mode!=='2d'&&<div className="scene-fallback">当前浏览器无法启用 3D 图形，请使用 2D 工艺视图。</div>}
  </div>;
}
