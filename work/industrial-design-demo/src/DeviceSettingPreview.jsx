import {createRenderer,renderingProfile} from './renderingPolicy';
import {enableTouchOrbit} from './touchInteraction';
import {installVisionCameras} from './visionCameras';
import {alarmRules,classifyAlarm} from './alarmRules';
import {createAlarmIndicators} from './alarmIndicators';
import {stages} from './data';
import {deviceName} from './controlCapabilities';
import {isParameterDrivenPart,createDeviceMechanics,mechanismRate} from './deviceMechanics';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const codes=['wash','gas','vision','beverage','filler','secondary','robot','agv','warehouse'];
const parts={
 'PT-CV-01':/belt|Conveyor|drum|Guide rail|Bearing|Folded side channel|Motor terminal|Cooling fin|Lower cross-member|levell/i,
 'PT-WASH-01':/Rinse jet|Water header|Nozzle feed|Drain tray|pump|TEFC motor|Cooling fin|Lift actuator|Cylinder rod|Pneumatic bridge|Rinser chassis|Stainless square tube/i,
 'PT-AIR-01':/Air hose|Pneumatic bridge|Cylinder rod|Lift actuator|Guard support|Stainless square tube/i,
 'GAS-PUMP-01':/pump|TEFC motor|Test manifold|Cooling fin|Motor terminal|Pneumatic loop|Gauge|Dial rating/i,
 'GAS-CHAMBER-01':/Sealing bell|Test nest|Test manifold|Pneumatic|Gauge|Dial rating|Leak tester top|Stainless square tube/i,
 'VIS-TOP-01':/Top camera|Top lens|Folded optical hood|Guard support/i,
 'VIS-SIDE-01':/Side camera|Folded optical hood|Guard support/i,
 'VIS-LIGHT-01':/Diffused LED|Folded optical hood|Guard support|Continuous hygienic PU belt|Bottle body|Bottle closure/i,
 'VIS-REJECT-01':/Reject|Guide rail|Continuous hygienic PU belt|Optical base top/i,
 'BEV-MIX-01':/Agitator|Dished sanitary vessel|Inspection manway|Manway retaining|Vessel|Tank|Sanitary skid|CIP|Butterfly valve|Valve handle|Sight tube|Gauge/i,
 'BEV-HT-01':/Dished sanitary vessel|Tank|Sanitary skid|Sight tube|Vessel|Inspection manway|Manway retaining|Butterfly valve|Valve handle|pump|TEFC motor|Cooling fin|Gauge|CIP/i,
 'FIL-PUMP-01':/Metering valve|Product manifold|Sanitary.*hose|Buffer|Tank access|Filling nozzle|Nozzle carrier|Tri-clamp|Valve clamp|Precision axis|Linear bearing/i,
 'FIL-HEAD-01':/Filling nozzle|Nozzle carrier|Sanitary.*hose|Metering valve|Product manifold|Tri-clamp|Valve clamp|Precision axis|Linear bearing/i,
 'FIL-POS-01':/Linear bearing|Precision axis|Guide rail|Nozzle carrier|Continuous hygienic PU belt|Belt slider|Conveyor support/i,
 'SEC-CAM-01':/camera|lens|Folded optical hood|Guard support/i,
 'SEC-LIGHT-01':/Fill-level illuminator|camera|lens|Bottle body|Continuous hygienic PU belt/i,
 'SEC-LEVEL-01':/Fill-level illuminator|Side camera|Folded optical hood|Guard support|Bottle body|Continuous hygienic PU belt/i,
 'SEC-REJECT-01':/Reject|Guide rail|Continuous hygienic PU belt|Optical base top/i,
 'PK-ARM-01':/arm|Shoulder|Elbow|Wrist|Slew|Robot pedestal|Robot mounting|Foundation stud|Service cover|Tool flange|Vacuum|Suction|Robot umbilical/i,
 'PK-GRIP-01':/Vacuum|Suction|Tool flange|Wrist motor|Service cover/i,
 'AGV-01':/AMR|wheel|Lidar|Lift top|bumper|Emergency stop|Status strip|AGV name/i,
 'AGV-DISPATCH-01':/AMR|wheel|Lidar|Lift top|bumper|Emergency stop|Status strip|AGV name/i
};
const label=v=>({RUNNING:'运行',PAUSED:'暂停',READY:'待命',REQUEST:'请求执行'})[v]??v??'未回报';
export default function DeviceSettingPreview({stageIndex,device,caps,values,draft,allValues}){
 const cycleLabel=useRef(null),host=useRef(null),paint=useRef(null),current=useRef(null),[status,setStatus]=useState('正在加载局部模型…'),[previewAction,setPreviewAction]=useState(0);
 const pending=caps.some(c=>draft[c.id]!==undefined&&draft[c.id]!==values[c.id]);
 current.current={caps,values,draft,allValues,previewAction};
 useEffect(()=>{
  let releaseTouch,alive=true,renderer,root,orbit,resize,mechanics,alarmIndicators,mixer,observer,frame=0,inView=true,last=0,elapsed=0,fitCamera=null,userMoved=false;
  const el=host.current;setStatus('正在加载局部模型…');setPreviewAction(0);
  const release=()=>root?.traverse(o=>{o.geometry?.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!m)return;Object.values(m).forEach(v=>{if(v?.isTexture)v.dispose();});m.dispose();});});
  try{
   renderer=createRenderer({alpha:true,antialias:true});const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),software=/Basic Render|SwiftShader|llvmpipe|Software/i.test(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'');renderer.setPixelRatio(Math.min(devicePixelRatio,software?1:1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;el.appendChild(renderer.domElement);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.001,1000);
   scene.add(new THREE.HemisphereLight(0xe3f4ff,0x354550,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,5,4);scene.add(light);
   orbit=new OrbitControls(camera,renderer.domElement);releaseTouch=enableTouchOrbit(orbit,renderer.domElement);orbit.enablePan=false;orbit.addEventListener('start',()=>{userMoved=true;});orbit.addEventListener('change',()=>renderer.render(scene,camera));
   paint.current=()=>{if(!alive)return;const data=current.current;const values={...data.allValues,...data.values,...data.draft,__previewAction:data.previewAction};const paused=data.caps.some(c=>['runState','cameraState'].includes(c.control)&&values[c.id]==='PAUSED');mechanics?.update(0,values,()=>!paused);alarmIndicators?.update(performance.now()/1000,alarmRules.filter(r=>r.device===device&&r.source==='setting').flatMap(r=>{const a=classifyAlarm(r,Number(values[r.id]));return a?[{...r,...a}]:[];}),matchMedia('(prefers-reduced-motion: reduce)').matches);renderer.render(scene,camera);};
   resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(!userMoved)fitCamera?.();paint.current?.();});resize.observe(el);
   new GLTFLoader().load(`/models/factory-realistic/${codes[stageIndex]}.glb?revision=reference-2`,g=>{
    root=g.scene;if(!alive){release();return;}installVisionCameras(root);root.updateMatrixWorld(true);
    const pattern=/^(VIS-(TOP|SIDE)|SEC-(CAM|SIDE))-/.test(device||'')?new RegExp(device+'|Bottle body|Bottle closure|Bottle contents'):parts[device],box=new THREE.Box3();let matched=0;
    root.traverse(o=>{if(o.isMesh){o.visible=pattern?pattern.test(o.name.replaceAll('_',' ')):o.name!=='Cube';if(o.visible){box.expandByObject(o);matched++;}}});
    if(!matched){root.traverse(o=>{if(o.isMesh){o.visible=o.name!=='Cube';if(o.visible)box.expandByObject(o);}});}
    const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z,.1);
    alarmIndicators=createAlarmIndicators(root,{stageIndex,device});
    mechanics=createDeviceMechanics(root,{focus:device,stage:codes[stageIndex]});
    scene.add(root);
    fitCamera=()=>{camera.aspect=el.clientWidth/Math.max(1,el.clientHeight);const half=THREE.MathUtils.degToRad(camera.fov/2),lim=Math.min(half,Math.atan(Math.tan(half)*camera.aspect)),distance=size.length()*.5/Math.sin(lim)*1.12;camera.position.copy(center).add(new THREE.Vector3(1,.65,1.25).normalize().multiplyScalar(Math.max(distance,radius)));camera.near=radius/1000;camera.far=radius*100;camera.updateProjectionMatrix();orbit.target.copy(center);orbit.minDistance=radius*.65;orbit.maxDistance=radius*10;orbit.update();el.dataset.framing=JSON.stringify({center:center.toArray(),size:size.toArray(),aspect:camera.aspect,whole:!device});};fitCamera();

    setStatus(pattern&&matched?'设备组件 · 含配套结构':device==='VIS-BOTTOM-01'?'当前模型未包含独立底部相机，显示完整工位参考':'完整工位参考');paint.current?.();
    // Reuse authored joint tracks for arms, positioning assemblies and mobile equipment.
    fetch('/models/factory/motion.json?revision=no-people').then(r=>r.json()).then(data=>{if(!alive)return;const nodes=new Map();root.traverse(o=>{if(o.userData.webId)nodes.set(o.userData.webId,o);});const tracks=[];for(const t of data.tracks){const o=nodes.get(t.id);if(!o||o.name.startsWith('Product_')||isParameterDrivenPart(o.name))continue;tracks.push(new THREE.VectorKeyframeTrack(o.uuid+'.position',data.times,t.positions),new THREE.QuaternionKeyframeTrack(o.uuid+'.quaternion',data.times,t.quaternions));}if(tracks.length&&!/REJECT/.test(device)){mixer=new THREE.AnimationMixer(root);mixer.clipAction(new THREE.AnimationClip('local-device',data.duration,tracks)).play();}}).catch(()=>{});
    const tick=time=>{frame=requestAnimationFrame(tick);if(!inView||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches){last=time;return;}if(time-elapsed<1000/Math.min(30,renderingProfile.fps))return;const dt=Math.min((time-last)/1000,.1);last=time;elapsed=time;const data=current.current,values={...data.allValues,...data.values,...data.draft,__previewAction:data.previewAction};const rate=mechanismRate(codes[stageIndex],values);const paused=data.caps.some(c=>['runState','cameraState'].includes(c.control)&&values[c.id]==='PAUSED');if(!paused)mixer?.update(dt*rate);const result=mechanics.update(dt,values,()=>!paused);el.dataset.mechanismState=JSON.stringify(result);if(cycleLabel.current){cycleLabel.current.textContent=paused?'预演暂停':result.fillSeconds?`灌装预演 · ${result.filling?'出液':'换瓶'} · ${Math.round(result.deliveredMl)} ml / 单瓶 ${result.fillSeconds.toFixed(1)} s`:result.rinseSeconds?`清洗预演 · ${Math.min(result.cycleTime,result.rinseSeconds).toFixed(1)} / ${result.rinseSeconds} s`:result.sampleSeconds?`采样预演 · ${Math.min(result.sampleElapsed,result.sampleSeconds).toFixed(1)} / ${result.sampleSeconds} s`:result.settleSeconds?`密封静置预演 · ${result.settleElapsed.toFixed(1)} / ${result.settleSeconds} s`:result.temperature?`目标温度色示 · ${result.temperature} °C（非实测温度）`:result.gripForce?`吸附力强度示意 · ${result.gripForce} N（非形变仿真）`:result.airSeconds?`风洗预演 · ${Math.min(result.cycleTime,result.airSeconds).toFixed(1)} / ${result.airSeconds} s`:result.beltSpeed?`输送预演 · ${result.beltSpeed} mm/s`:'';}el.dataset.animationRate=String(rate);paint.current?.();};frame=requestAnimationFrame(tick);
    observer=new IntersectionObserver(([e])=>{inView=e.isIntersecting;});observer.observe(el);
   },undefined,()=>{if(alive)setStatus('模型加载失败，请查看参数数据');});
  }catch{setStatus('当前设备无法显示 3D，请查看参数数据');}
  return()=>{alive=false;cancelAnimationFrame(frame);observer?.disconnect();mixer?.stopAllAction();mechanics?.dispose();alarmIndicators?.dispose();paint.current=null;resize?.disconnect();releaseTouch?.();orbit?.dispose();release();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();};
 },[stageIndex,device]);
 useEffect(()=>{paint.current?.();},[draft,values]);
 return <section className="setting-device-preview" aria-label="局部设备参数预览"><div className="setting-preview-title"><strong>{device?deviceName(device):stages[stageIndex].name+' · 整台设备'} <small>{device||''}</small></strong><span>{pending?'待保存预览':'已保存参数'}</span></div><div className="setting-preview-model" ref={host}/><div className="setting-preview-cycle" ref={cycleLabel}/>{/REJECT/.test(device)&&<button className="setting-preview-action" onClick={()=>setPreviewAction(v=>v+1)}>预演剔除动作（不下发）</button>}<small className="setting-preview-caption">{status} · 拖动旋转 / 滚轮缩放</small><div className="setting-preview-alarm" role="status">{caps.map(c=>{const rule=alarmRules.find(r=>r.id===c.id),value=Number(draft[c.id]??values[c.id]),a=rule&&classifyAlarm(rule,value);return a?<p key={c.id} data-level={a.level}>{pending?'未保存预演':'模拟设定'} · {a.level==='critical'?'严重':'预警'}：{c.label} {value} {c.unit}（{a.direction==='low'?'≤':'≥'} {a.threshold} {c.unit}）</p>:null;})}</div>{device&&<div className="setting-preview-values">{caps.filter(c=>c.type!=='ACTION').map(c=>{const value=draft[c.id]??values[c.id],ratio=c.type==='NUMBER'?Math.max(0,Math.min(100,(Number(value)-c.min)/(c.max-c.min)*100)):null;return <div key={c.id}><span>{c.label}</span><strong>{label(value)} {c.unit}</strong>{ratio!==null&&<meter min="0" max="100" value={Number.isFinite(ratio)?ratio:0} aria-label={c.label+'设定范围'}/>}</div>;})}</div>}<small className="setting-preview-note">模拟动作预演 · 按设定值演示，不代表设备实测或已经执行</small></section>;
}
