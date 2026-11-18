import {animate} from 'animejs';
import {createRenderer,renderingProfile} from './renderingPolicy';
import {inspectionCaptureTime} from './materialFlow';
import {productionBottles} from './productionBottle';
import VisionInspectionResults from './VisionInspectionResults';
import './camera-feeds.css';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {api,useTwin} from './TwinState';
import {inspectionCameras,cameraPosition,inspectionTarget} from './visionCameras';
export default function VisionCameraMonitor({stageIndex=2}){
 const cameras=inspectionCameras(stageIndex),code=stageIndex===5?'secondary':'vision',finished=stageIndex===5;
 const twin=useTwin(),host=useRef(),live=useRef(),[error,setError]=useState(''),[ready,setReady]=useState(false),[stamp,setStamp]=useState('');
 const simulationLayer=useRef(),captureSeen=useRef(new Set());
 const [inspectionState,setInspectionState]=useState(null),[switchBusy,setSwitchBusy]=useState(false),[captureBusy,setCaptureBusy]=useState(false),[captureMessage,setCaptureMessage]=useState('');
 const rehearsalActive=!!inspectionState?.rehearsal?.active&&inspectionState.rehearsal.stageIndices?.includes(stageIndex);
 const canSwitch=['admin','engineer','operator'].includes(twin.ops?.user?.role),caseId=inspectionState?.rehearsal?.selectedSamples?.[stageIndex]||'normal';
 const manualFlow=inspectionState?.rehearsal?.manualFlows?.[stageIndex];
 const flash=(index,source)=>{
  const layer=simulationLayer.current,slot=layer?.querySelector('[data-camera-index="'+index+'"]');
  if(!slot)return;slot.dataset.captured=String(Date.now());
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  animate(slot.querySelector('.vision-shutter-flash'),{opacity:[.72,0],duration:480,ease:'out(3)'});
  animate(slot.querySelector('.vision-capture-mark'),{opacity:[1,0],scale:[.94,1],duration:850,ease:'out(3)'});
 };
 live.current={manualFlow,caseId,flash};
 const toggleSample=async()=>{
  setSwitchBusy(true);try{const next=caseId==='normal'?'defect':'normal';await api('/api/ai/integrations/vision-rehearsal-sample',{stageIndex,caseId:next});setInspectionState(v=>({...v,rehearsal:{...v?.rehearsal,selectedSamples:{...v?.rehearsal?.selectedSamples,[stageIndex]:next}}}));}catch(e){setCaptureMessage(e.message);}finally{setSwitchBusy(false);}
 };
 const beginInspection=async()=>{
  if(captureBusy||manualFlow)return;if(!ready){setCaptureMessage('模拟模型仍在加载，请稍后开始检测。');return;}setCaptureBusy(true);setCaptureMessage('');
  try{
   if(!rehearsalActive)throw Error('模拟检测正在准备，请稍后重试。');
   const result=await api('/api/ai/integrations/vision-rehearsal-start',{stageIndex,source:'simulation'});setInspectionState(result);
   setCaptureMessage('本轮已开始，瓶子到位后依次采集并显示处理结果。');
  }catch(e){setCaptureMessage(e.message);}finally{setCaptureBusy(false);}
 };
 useEffect(()=>{let disposed=false,renderer,environment,raf,root,last=0,stampAt=0,bottleModels;const el=host.current;setError('');setReady(false);
 const release=()=>root?.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});
 try{renderer=createRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),software=/Basic Render|SwiftShader|llvmpipe|Software/i.test(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'');renderer.setPixelRatio(Math.min(devicePixelRatio,software?1:1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;el.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#859aa7');
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
 const ambient=new THREE.HemisphereLight(0xf0f7ff,0x738998,.4);scene.add(ambient);
 const lights=[0,120,240].map(angle=>{const a=THREE.MathUtils.degToRad(angle),light=new THREE.DirectionalLight(0xffffff,2);light.position.set(Math.sin(a)*2,3,Math.cos(a)*2);scene.add(light);return light;});
 const views=cameras.map(spec=>{const camera=new THREE.PerspectiveCamera(48,1,.025,30);camera.position.copy(cameraPosition(spec));if(spec.angle===null)camera.up.set(0,0,-1);camera.lookAt(inspectionTarget);return camera;});
 new GLTFLoader().load(`/models/factory-realistic/${code}.glb?revision=reference-2`,g=>{root=g.scene;if(disposed){release();return;}const asset=root.getObjectByName('Asset_'+code);if(!asset){setError('检测位模型缺失');release();return;}asset.position.set(0,0,0);
 // Inspection feeds show the bottle and conveyor, omitting the enclosure that surrounds the lens.
 root.traverse(o=>{if(o.isMesh)o.visible=/Bottle body|Bottle closure|Bottle contents|Continuous hygienic PU belt/i.test(o.name.replaceAll('_',' '));});scene.add(root);
 const products=[];root.traverse(o=>{if(o.name.startsWith('Product_'+code+'_'))products.push({o,x:o.position.x});});bottleModels=productionBottles(products.map(p=>({object:p.o,height:.34})),()=>{});setReady(true);
 const tick=t=>{
  raf=requestAnimationFrame(tick);if(disposed||document.hidden||t-last<1000/Math.min(24,renderingProfile.fps))return;last=t;
  const data=live.current,run=data.manualFlow,now=Date.now(),simulationRun=run?.source==='simulation';
  const elapsed=simulationRun?Math.min(8,Math.max(0,(now-run.startedAt)/1000)):(t/1000)%8;
  const sourceCase=simulationRun?run.caseId:data.caseId;
  bottleModels?.update({id:'vision-'+sourceCase,name:sourceCase==='defect'?'异常瓶':'正常瓶',modelUrl:sourceCase==='defect'?'/models/beverage/yibao-peach-defect-bottle.glb':'/models/beverage/yibao-peach-bottle.glb'});
  for(let i=0;i<products.length;i++){
   const product=products[i];product.o.visible=i===0;
   if(i===0){const time=elapsed<2?elapsed/4:elapsed>6?.5+(elapsed-6)/4:.5;product.o.position.x=-1.1+2.2*time;}
  }
  const feed={online:true,cameras:Array(4).fill('running'),light:70,rate:30};
 const w=el.clientWidth||720,h=el.clientHeight||440;if(!w||!h)return;if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h);renderer.setScissorTest(true);
 const illumination=(feed.light??70)/100;ambient.intensity=.12+illumination*.55;lights.forEach(light=>light.intensity=illumination*3.2);scene.environmentIntensity=.08+illumination*1.4;scene.background.setRGB(.09+illumination*.43,.12+illumination*.46,.15+illumination*.48);el.dataset.lightIntensity=String(illumination*100);
 const indices=[0,1,2,3];
  indices.forEach((index,slot)=>{
   const cw=w/2,ch=h/2,x=slot%2*cw,y=h-(Math.floor(slot/2)+1)*ch;
   renderer.setViewport(x,y,cw,ch);renderer.setScissor(x,y,cw,ch);const camera=views[index];camera.aspect=cw/ch;camera.updateProjectionMatrix();renderer.render(scene,camera);
  });
  if(simulationRun){
   for(const index of indices){
    const key=run.bottleId+':'+index;
    if(elapsed<inspectionCaptureTime(8,index)+.05||captureSeen.current.has(key))continue;
    captureSeen.current.add(key);data.flash(index,'simulation');
    const image=document.createElement('canvas'),cw=renderer.domElement.width/2,ch=renderer.domElement.height/2;image.width=cw;image.height=ch;
    image.getContext('2d').drawImage(renderer.domElement, index%2*cw,Math.floor(index/2)*ch,cw,ch,0,0,cw,ch);
    void api('/api/ai/integrations/vision-rehearsal-capture',{stageIndex,bottleId:run.bottleId,cameraId:['top','side-0','side-120','side-240'][index],data:image.toDataURL('image/jpeg',.88)}).catch(e=>setCaptureMessage(e.message));
   }
  }
  while(captureSeen.current.size>400)captureSeen.current.delete(captureSeen.current.values().next().value);
  el.dataset.cameraCount=String(indices.length);el.dataset.frame=String(t);if(t-stampAt>1000){stampAt=t;setStamp(new Date().toLocaleTimeString('zh-CN',{hour12:false}));}};raf=requestAnimationFrame(tick);
 },undefined,()=>setError('三维监看画面加载失败'));

 }catch(e){setError('当前浏览器无法显示相机画面');}
 return()=>{disposed=true;cancelAnimationFrame(raf);bottleModels?.dispose();release();environment?.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();};
 },[stageIndex]);

 const shutterLayer=ref=><div className="vision-capture-layer" ref={ref} aria-hidden="true">{[0,1,2,3].map(i=><div className="vision-capture-slot" data-camera-index={i} key={i}><div className="vision-shutter-flash"/><div className="vision-capture-mark"><i/><span>已采集</span></div></div>)}</div>;
 return <section className="vision-monitor"><header><div><h3>四路联合检测</h3><p>{finished?'成品检测':'空瓶检测'} · 模拟演示 · 顶部及侧面 0° / 120° / 240°</p></div><div className="vision-monitor-controls"><time>{stamp}</time>{rehearsalActive&&canSwitch&&<button className="vision-sample-switch" type="button" aria-label="切换正常和异常瓶" aria-pressed={caseId==='defect'} title={caseId==='defect'?'当前异常瓶，点击切换正常瓶':'当前正常瓶，点击切换异常瓶'} disabled={switchBusy||!!manualFlow} onClick={()=>void toggleSample()}><span aria-hidden="true">◈</span></button>}</div></header>
 <div className="vision-detection-toolbar"><div><strong>{captureBusy?'正在检测':manualFlow?'检测中':'实时监看'}</strong><p>{manualFlow?'瓶子进入检测中心后依次采集，预览保持运行。':'模拟瓶体持续运行，点击开始记录一轮采集与处理结果。'}</p></div>{canSwitch&&<div className="vision-capture-actions"><button type="button" disabled={captureBusy||!!manualFlow||!ready} onClick={()=>void beginInspection()}>{captureBusy?'检测中…':manualFlow?'采集中…':'开始检测'}</button>{manualFlow&&<button type="button" onClick={()=>api('/api/ai/integrations/vision-rehearsal-stop',{stageIndex}).catch(e=>setCaptureMessage(e.message))}>结束本轮</button>}</div>}</div>
 {captureMessage&&<p className="vision-capture-message" role="status">{captureMessage}</p>}
 <div className="vision-feed quad"><div className="vision-render" ref={host}/>{shutterLayer(simulationLayer)}<div className="vision-feed-labels">{cameras.map(c=><div key={c.id}><strong>{c.label}</strong><span>{ready?'实时模拟':'加载模型…'}</span></div>)}</div>{error&&<p role="alert" className="camera-error">{error}</p>}</div>
 <VisionInspectionResults stageIndex={stageIndex} source="rehearsal" onState={setInspectionState}/>
 </section>;
}
