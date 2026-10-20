import {createRenderer,renderingProfile} from '../renderingPolicy';
import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TwinProvider, useTwin, api} from '../TwinState';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import StatusCard from './StatusCard';
import AssistantResult from './AssistantResult';
import {mapDevice} from './deviceMapping';
import {advanceAnimation} from './animationLink';
import './practice.css';

// 已准备的基础框架：模型加载、相机、灯光与页面轮询不在现场重写。
function Model({url, protocol}) {
  const host=useRef(null), live=useRef(protocol);
  const [error,setError]=useState(''); live.current=protocol;
  useEffect(()=>{
    if(!url)return;
    const el=host.current, scene=new THREE.Scene();scene.background=new THREE.Color('#eaf0f2');
    const camera=new THREE.PerspectiveCamera(40,1,.01,1000);
    const renderer=createRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));el.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0x566373,3));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,5,4);scene.add(light);
    let mixer,model,frame,closed=false;setError('');
    const release=g=>g.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean)){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});
    new GLTFLoader().load(url,g=>{
      if(closed){release(g.scene);return;}
      model=g.scene;scene.add(model);
      const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=Math.max(box.getSize(new THREE.Vector3()).length(),.1);
      controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.65,1).normalize().multiplyScalar(size*1.7));controls.update();
      mixer=new THREE.AnimationMixer(model);if(g.animations[0])mixer.clipAction(g.animations[0]).play();
      el.dataset.loaded='true';if(!g.animations.length)setError('模型没有动画，请上传上一课导出的平台版 GLB。');
    },undefined,e=>{if(!closed)setError('模型加载失败：'+e.message);});
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const clock=new THREE.Clock();
    const render=()=>{frame=requestAnimationFrame(render);const dt=Math.min(clock.getDelta(),.1);
      const state=mapDevice(live.current);
      if(mixer){advanceAnimation(mixer,dt,state);el.dataset.animationTime=String(mixer.time);}
      el.dataset.online=String(state.online);el.dataset.running=String(state.running);
      renderer.render(scene,camera);
    };render();
    return()=>{closed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();mixer?.stopAllAction();if(model)release(model);renderer.dispose();renderer.domElement.remove();};
  },[url]);
  return <section><div className="model" ref={host}/>{error&&<p role="alert">{error}</p>}{!url&&<p role="alert">未找到 MG400-TEACH-01 的模型。请先完成模型导入课。</p>}</section>;
}
function ReceiptExercise(){
  const [execution,setExecution]=useState(null),[error,setError]=useState('');
  const load=async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      const result=JSON.parse((await file.text()).replace(/^\uFEFF/,'')),e=result.execution;
      if(!e||typeof e.id!=='string'||!Array.isArray(e.operations)||!e.operations.every(o=>o&&typeof o.id==='string'&&typeof o.title==='string'&&['number','string'].includes(typeof o.value)&&['undefined','number','string'].includes(typeof o.readback)))throw Error('请选择包含 execution 和 operations 的助手返回 JSON。');
      setExecution(e);setError('');
    }catch(err){setExecution(null);setError(err.message);}
  };
  return <section className="receipt-exercise"><h2>助手接入 · 结果展示练习</h2><p>读取所选文件中的执行记录，不重新发指令，也不代表设备当前状态。展示历史文件时应明确说明是历史回执。</p><label>选择助手返回的 JSON 文件 <input type="file" accept=".json" onChange={load}/></label>{error&&<p role="alert">{error}</p>}<AssistantResult execution={execution}/></section>;
}
function Practice(){
  const {ops,error}=useTwin();
  const [backendState,setBackendState]=useState(null);
  useEffect(()=>{let alive=true;const refresh=()=>api('/api/ops/demo/device-status').then(v=>{if(alive)setBackendState(v);}).catch(()=>{if(alive)setBackendState(null);});refresh();const timer=setInterval(refresh,2000);return()=>{alive=false;clearInterval(timer);};},[]);
  // Keep freshness visible even when requests fail and the last snapshot stays unchanged.
  const [,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  if(!ops)return <main><h1>读取平台数据</h1><p>{error||'等待现有平台服务返回…'}</p></main>;
  const state=mapDevice(ops.protocol),asset=ops.assets.find(a=>a.code==='MG400-TEACH-01');
  return <main><header><a href="/#admin">返回正式平台</a><p>瓶安智慧工厂 / 平台开发练习</p><h1>编写页面，接入数据，驱动模型</h1><p>本页使用现有平台接口与已上传模型。通信调试请在正式平台“设备配置”中完成。</p></header><div className="workspace"><StatusCard state={backendState||{deviceId:state.deviceId,online:false,running:false,rate:null,gripForce:null}}/><Model url={asset?.modelUrl} protocol={ops.protocol}/></div><ReceiptExercise/><footer>教学映射：PK-ARM-01 模拟设备 → MG400 上料动画。按节拍推进预制动作，不代表真实关节姿态。React 页面开发；鸿蒙应用入口另用 ArkTS。</footer></main>;
}
createRoot(document.getElementById('root')).render(<TwinProvider><Practice/></TwinProvider>);
