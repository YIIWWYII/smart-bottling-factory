import {createRenderer,renderingProfile} from './renderingPolicy';
import {materialTravel} from './materialFlow';
import {productionProduct} from './productionProduct';
import {productionBottles} from './productionBottle';
import ActualCameraFeeds from './ActualCameraFeeds';
import VisionInspectionResults from './VisionInspectionResults';
import './camera-feeds.css';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {useTwin} from './TwinState';
import {visionFeed} from './visionFeed';
import {inspectionCameras,cameraPosition,inspectionTarget} from './visionCameras';
export default function VisionCameraMonitor({stageIndex=2}){
 const cameras=inspectionCameras(stageIndex),code=stageIndex===5?'secondary':'vision',finished=stageIndex===5;
 const twin=useTwin(),host=useRef(),live=useRef(),[selected,setSelected]=useState(null),[error,setError]=useState(''),[ready,setReady]=useState(false),[stamp,setStamp]=useState('');
 const [viewMode,setViewMode]=useState('actual');
 const sources=twin.ops?.preferences?.cameraSources||[];

 const feed=visionFeed(twin,Date.now(),stageIndex);
 live.current={twin,selected,viewMode};
 useEffect(()=>{if(viewMode!=='simulation')return;let disposed=false,renderer,environment,raf,root,observer,visible=true,last=0,stampAt=0,lastView='',lastFlow=null,bottleModels;const el=host.current;setError('');setReady(false);
 const release=()=>root?.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});
 try{renderer=createRenderer({antialias:true,alpha:false});const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),software=/Basic Render|SwiftShader|llvmpipe|Software/i.test(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'');renderer.setPixelRatio(Math.min(devicePixelRatio,software?1:1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;el.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#859aa7');
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
 const ambient=new THREE.HemisphereLight(0xf0f7ff,0x738998,.4);scene.add(ambient);
 const lights=[0,120,240].map(angle=>{const a=THREE.MathUtils.degToRad(angle),light=new THREE.DirectionalLight(0xffffff,2);light.position.set(Math.sin(a)*2,3,Math.cos(a)*2);scene.add(light);return light;});
 const views=cameras.map(spec=>{const camera=new THREE.PerspectiveCamera(48,1,.025,30);camera.position.copy(cameraPosition(spec));if(spec.angle===null)camera.up.set(0,0,-1);camera.lookAt(inspectionTarget);return camera;});
 new GLTFLoader().load(`/models/factory-realistic/${code}.glb?revision=reference-2`,g=>{root=g.scene;if(disposed){release();return;}const asset=root.getObjectByName('Asset_'+code);if(!asset){setError('检测位模型缺失');release();return;}asset.position.set(0,0,0);
 // Inspection feeds show the bottle and conveyor, omitting the enclosure that surrounds the lens.
 root.traverse(o=>{if(o.isMesh)o.visible=/Bottle body|Bottle closure|Bottle contents|Continuous hygienic PU belt/i.test(o.name.replaceAll('_',' '));});scene.add(root);
 const products=[];root.traverse(o=>{if(o.name.startsWith('Product_'+code+'_'))products.push({o,x:o.position.x});});bottleModels=productionBottles(products.map(p=>({object:p.o,height:.34})),()=>{lastView='';});setReady(true);
 const tick=t=>{raf=requestAnimationFrame(tick);if(disposed||!visible||live.current.viewMode!=='simulation'||document.hidden||t-last<1000/Math.min(30,renderingProfile.fps))return;last=t;const data=live.current,feed=visionFeed(data.twin,Date.now(),stageIndex);bottleModels?.update(productionProduct(data.twin));for(let i=0;i<products.length;i++){const p=products[i],token=data.twin.materialFlow?.stages[stageIndex]?.[i];p.o.visible=!!token;if(token)p.o.position.x=-1.1+2.2*materialTravel(data.twin.materialFlow,token);}
 const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;const view=JSON.stringify([feed,data.selected,w,h]);if(feed.rate===0&&view===lastView&&lastFlow===data.twin.materialFlow)return;lastView=view;lastFlow=data.twin.materialFlow;if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h);renderer.setScissorTest(true);
 const illumination=(feed.light??70)/100;ambient.intensity=.12+illumination*.55;lights.forEach(light=>light.intensity=illumination*3.2);scene.environmentIntensity=.08+illumination*1.4;scene.background.setRGB(.09+illumination*.43,.12+illumination*.46,.15+illumination*.48);el.dataset.lightIntensity=String(illumination*100);
 const indices=data.selected==null?[0,1,2,3]:[data.selected];indices.forEach((index,slot)=>{const cols=data.selected==null?2:1,rows=data.selected==null?2:1,cw=w/cols,ch=h/rows,x=slot%cols*cw,y=h-(Math.floor(slot/cols)+1)*ch;renderer.setViewport(x,y,cw,ch);renderer.setScissor(x,y,cw,ch);const camera=views[index];camera.aspect=cw/ch;camera.updateProjectionMatrix();if(!feed.online||feed.cameras[index]==='paused'){renderer.setClearColor('#142632');renderer.clear();}else{renderer.render(scene,camera);}});el.dataset.cameraCount=String(indices.length);el.dataset.frame=String(t);if(t-stampAt>1000){stampAt=t;setStamp(new Date().toLocaleTimeString('zh-CN',{hour12:false}));}};raf=requestAnimationFrame(tick);
 },undefined,()=>setError('三维监看画面加载失败'));
 observer=new IntersectionObserver(([e])=>visible=e.isIntersecting);observer.observe(el);
 }catch(e){setError('当前浏览器无法显示相机画面');}
 return()=>{disposed=true;cancelAnimationFrame(raf);observer?.disconnect();bottleModels?.dispose();release();environment?.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();};
 },[stageIndex,viewMode]);
 const indices=selected==null?[0,1,2,3]:[selected];
 return <section className="vision-monitor"><header><div><h3>{finished?'成品检测 · 四路相机':'空瓶检测 · 四路相机'}</h3><p>顶部 + 环绕瓶身 0° / 120° / 240° · 数据驱动三维监看 · {feed.source==='protocol'?'协议回读':feed.source==='real'?'真实遥测':'模拟数据'}</p></div><time>{feed.online?stamp:'数据离线'}</time></header><nav aria-label="画面来源"><button aria-pressed={viewMode==='simulation'} onClick={()=>setViewMode('simulation')}>模拟画面</button><button aria-pressed={viewMode==='actual'} onClick={()=>setViewMode('actual')}>实际画面</button></nav><nav aria-label="相机画面选择"><button aria-pressed={selected===null} onClick={()=>setSelected(null)}>四路同屏</button>{cameras.map((c,i)=><button key={c.id} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{c.label}</button>)}</nav>{viewMode==='actual'&&<ActualCameraFeeds cameras={cameras} indices={indices} sources={sources}/>}<div hidden={viewMode!=='simulation'}><div className={'vision-feed '+(selected==null?'quad':'single')}><div className="vision-render" ref={host}/><div className="vision-feed-labels">{indices.map(i=>{const c=cameras[i],paused=feed.cameras[i]==='paused';return <div key={c.id} data-paused={paused}><strong>{c.label}<small>{c.id}</small></strong><span>{!feed.online?'等待有效数据':paused?'相机已暂停':ready?feed.cameras[i]==='unknown'?'三维预览 · 相机状态未回传':'三维监看中':'加载中'}</span><small className="camera-inspection-target">{finished?(i===0?'瓶盖到位 / 封口外观':'灌装液位 / 成品外观'):(i===0?'瓶口 / 口沿完整性':'瓶身 / 污渍 / 裂纹')} · 未接入缺陷识别</small></div>;})}</div>{error&&<p role="alert" className="camera-error">{error}</p>}</div></div><VisionInspectionResults stageIndex={stageIndex}/><footer><strong>照明单元：{feed.light===null?'未回传（预览照明）':feed.light+'%'}</strong> · 本工位到料数据驱动模型运动，照明数据同步四个视角。</footer></section>;
}
