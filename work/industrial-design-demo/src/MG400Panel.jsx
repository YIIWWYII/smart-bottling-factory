import MG400ModelMapping from './MG400ModelMapping.jsx';
import MG400ConfigFiles from './MG400ConfigFiles.jsx';
import {bindBlenderMG400} from './mg400Blender.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {useEffect,useRef,useState} from 'react';
import {api,useTwin} from './TwinState';
import {Modal} from './ui';
import * as THREE from 'three';
import {createRenderer} from './renderingPolicy';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import './mg400.css';

function JointView({status,modelUrl,mapping}){
 const host=useRef(),caption=useRef(),latest=useRef(status);latest.current=status;
 useEffect(()=>{
  if(!modelUrl){if(caption.current)caption.current.textContent='现场导入机械臂模型后显示';return;}
  const el=host.current,scene=new THREE.Scene();scene.background=new THREE.Color(getComputedStyle(host.current).getPropertyValue('--mg400-canvas').trim()||'#e3edf3');
  const renderer=createRenderer({antialias:true});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;el.appendChild(renderer.domElement);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.8;room.dispose();pmrem.dispose();
  const camera=new THREE.PerspectiveCamera(38,1,.01,10);camera.position.set(.65,.52,.75);const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(.13,.2,0);orbit.update();
  scene.add(new THREE.HemisphereLight(0xffffff,0x8795a1,.9));const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(1,2,1);scene.add(light);
  const themeObserver=new MutationObserver(()=>{scene.background.set(getComputedStyle(el).getPropertyValue('--mg400-canvas').trim()||'#e3edf3');});themeObserver.observe(document.querySelector('.demo-shell')||document.documentElement,{attributes:true,attributeFilter:['data-color-mode','class']});
  let model=null,apply=null,disposed=false,modelError='正在加载 Blender 模型';
  if(modelUrl)new GLTFLoader().loadAsync(modelUrl).then(async gltf=>{if(disposed)return;model=gltf.scene;scene.add(model);const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),distance=Math.max(size.x,size.y,size.z)*2.1;if(Number.isFinite(distance)&&distance>0){orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.65,.4,1).normalize().multiplyScalar(distance));camera.near=Math.max(.0001,distance/1000);camera.far=Math.max(10,distance*100);camera.updateProjectionMatrix();orbit.update();}try{apply=await bindBlenderMG400(model,{mapping});modelError='';}catch(e){modelError=e.message;}}).catch(e=>{modelError=e.message;});else modelError='设备资产未配置 Blender 模型';
  const grid=new THREE.GridHelper(1,10,0xa2b5c2,0xc8d5de);scene.add(grid);
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();let raf,last=0;
  const draw=time=>{raf=requestAnimationFrame(draw);if(document.hidden||time-last<50)return;last=time;const valid=apply?.(latest.current);if(caption.current)caption.current.textContent=modelError||(valid?(latest.current?.source==='simulation'?'Blender 模型 · 模拟关节数据':'Blender 模型 · 实际关节反馈'):'等待有效反馈 · 姿态保留');el.dataset.feedbackAt=valid?String(latest.current.receivedAt):'';renderer.render(scene,camera);};raf=requestAnimationFrame(draw);
  return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();themeObserver.disconnect();orbit.dispose();scene.traverse(o=>{o.geometry?.dispose();});model?.traverse(o=>{const materials=Array.isArray(o.material)?o.material:[o.material];materials.filter(Boolean).forEach(m=>m.dispose());});grid.material.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();};
 },[modelUrl,mapping]);
 return <div className="mg400-model" ref={host}><span ref={caption}>正在读取模型映射</span></div>;
}
const actions=[['enable','使能'],['disable','下使能'],['run','运行工程'],['pause','暂停工程'],['resume','继续工程'],['stop','停止工程'],['clear','清除报警']];
const requiredModes={enable:[4,'仅未使能时可用'],run:[5,'仅已使能且空闲时可用'],pause:[7,'仅运行中可暂停'],resume:[10,'仅暂停后可继续']};
export default function MG400Panel({asset=null,onStatus}){
 const twin=useTwin(),[status,setStatus]=useState(null),[draft,setDraft]=useState(null),[trajectoryFile,setTrajectoryFile]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(null),[message,setMessage]=useState(''),[speed,setSpeed]=useState(20),[view,setView]=useState('operate');
 useEffect(()=>{onStatus?.(status);},[status,onStatus]);
 const roles=twin.ops?.user?.roles||[],canConfigure=roles.some(r=>['admin','engineer'].includes(r)),canOperate=roles.some(r=>['admin','engineer','operator'].includes(r));
 const trajectoryConfig=(()=>{try{return trajectoryFile?JSON.parse(trajectoryFile.content):null;}catch{return null;}})();
 const trajectoryPresets=trajectoryConfig?.controller?.presets||[];
 const trajectoryIdle=Boolean(status?.connected&&status?.online&&Number(status.feedback?.enable_status)===1&&Number(status.feedback?.robot_mode)===5&&(!status.execution?.state||['已停止（反馈空闲）','运行结束（未核验取放结果）','报警中断','启动被拒绝'].includes(status.execution.state)));
 const trajectorySelectable=Boolean(status&&!status.externalControl&&(!status.connected||trajectoryIdle));
 useEffect(()=>{let active=true,timer;const poll=async()=>{try{if(!document.hidden){const s=await api('/api/ops/mg400');if(active){setStatus(s);setDraft(d=>{if(!d)setSpeed(s.feedback?.speed_scaling??s.config.speed??20);return d||s.config;});}}}catch(e){if(active){setError(e.message);setStatus(null);}}finally{if(active)timer=setTimeout(poll,100);}};poll();return()=>{active=false;clearTimeout(timer);};},[]);
 useEffect(()=>{if(!canConfigure)return;let active=true;api('/api/ops/mg400/files').then(data=>{if(!active)return;const file=data.files?.find(item=>item.key==='trajectories');if(file)setTrajectoryFile(file);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[canConfigure]);
 const send=async(path,body)=>{setBusy(true);setError('');setMessage('');try{const r=await api('/api/ops/mg400/'+path,body);if(r.error){const latest=await api('/api/ops/mg400');setStatus(latest);throw Error(r.error);}if(r.config)setStatus(r);if(path==='execute'&&r.accepted){speedEdited.current=false;const latest=await api('/api/ops/mg400');setStatus(latest);}setMessage(r.message||(path==='prepare'?'请在确认窗口核对后下发':'操作完成'));return r;}catch(e){setError(e.message);}finally{setBusy(false);}};
 const selectTrajectory=async projectName=>{
  const preset=trajectoryPresets.find(item=>item.projectName===projectName);
  if(!preset||!trajectoryFile||!trajectorySelectable){setError('已连接实机时，请先停止工程并确认已上使能且空闲。');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const result=await api('/api/ops/mg400/trajectory',{projectName:preset.projectName,expected:trajectoryFile.content});
   const file=result.files?.find(item=>item.key==='trajectories');if(file)setTrajectoryFile(file);
   setStatus(previous=>previous?{...previous,config:result.config}:previous);
   setMessage(`已选择 ${preset.name}。只更新后续运行工程，没有启动机械臂；请确认该工程已导入控制器。`);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const prepare=async(action,value)=>{if(action==='speed'&&status?.externalControl){if(!Number.isInteger(value)||value<1||value>100){setError('速度比例须为1–100%');return;}setConfirm({host:status.config.host,command:`SpeedFactor(${value})`,externalSpeed:value});return;}const r=await send('prepare',{action,value});if(r)setConfirm(r);};
 const [measuredSpeed,setMeasuredSpeed]=useState(null),previousPose=useRef(null);
 useEffect(()=>{
  const sample=status?.display??status,pose=sample?.feedback?.tool_vector_actual,at=sample?.receivedAt;
  if(!sample?.online||!pose||!Number.isFinite(at)){previousPose.current=null;setMeasuredSpeed(null);return;}
  const previous=previousPose.current;
  if(!previous){previousPose.current={pose,at};return;}
  const dt=at-previous.at;if(dt<80)return;
  setMeasuredSpeed(dt>1500?null:{linear:Math.hypot(...pose.slice(0,3).map((v,i)=>v-previous.pose[i]))*1000/dt,angular:((pose[3]-previous.pose[3]+540)%360-180)*1000/dt});
  previousPose.current={pose,at};
 },[status?.display?.receivedAt,status?.receivedAt,status?.display?.online,status?.online]);
 const display=status?.display??status,simulated=display?.source==='simulation';
 const f=display?.feedback;
 const speedEdited=useRef(false);
 const reportedSpeed=status?.online?status.feedback?.speed_scaling:status?.config?.speed;
 useEffect(()=>{if(!speedEdited.current&&Number.isFinite(reportedSpeed))setSpeed(Math.round(reportedSpeed));},[reportedSpeed]);
 return <section className="mg400-panel"><header><div><h3>{asset?.name||'MG400 机械臂'}</h3><span>预处理入口 · {simulated?'平台模拟数据':'TCP 实机接入'}</span></div><strong className={simulated||status?.online?'online':''}>{display?.phase||'读取状态'}</strong></header>
 <nav className="mg400-tabs" aria-label="机械臂工作区"><button aria-pressed={view==='operate'} onClick={()=>setView('operate')}>设备操作</button><button aria-pressed={view==='config'} onClick={()=>setView('config')}>通信与协议</button><button aria-pressed={view==='trajectory'} onClick={()=>setView('trajectory')}>轨迹工程</button><button aria-pressed={view==='model'} onClick={()=>setView('model')}>模型与关节</button></nav>
 {view==='model'&&<MG400ModelMapping asset={asset||twin.ops?.assets?.find(a=>a.code==='MG400-TEACH-01')} canConfigure={canConfigure} onSaved={twin.refresh}/>}
 {view==='operate'&&simulated&&<div className="mg400-actions"><button disabled={busy||!canOperate||display.simulationRunning} onClick={()=>send('simulation',{running:true})}>开始模拟</button><button disabled={busy||!canOperate||!display.simulationRunning} onClick={()=>send('simulation',{running:false})}>暂停模拟</button><span>模拟关节数据驱动模型；混合模式收到有效实机反馈后自动切换。</span></div>}
 {view==='config'&&<MG400ConfigFiles key="connection" scope="connection" canConfigure={canConfigure} connected={status?.connected} onSaved={config=>{setDraft(config);setSpeed(config.speed);setStatus(previous=>({...previous,config}));}}/>}
 {view==='trajectory'&&<MG400ConfigFiles key="trajectory" scope="trajectory" canConfigure={canConfigure} connected={status?.connected} robotStatus={status} onSaved={config=>{setDraft(config);setStatus(previous=>({...previous,config}));api('/api/ops/mg400/files').then(data=>setTrajectoryFile(data.files?.find(item=>item.key==='trajectories')||null)).catch(e=>setError(e.message));}}/>}
 {view==='operate'&&<div className="mg400-console"><section className="mg400-visual"><header><h4>数字孪生</h4><span>{simulated?(display.fallback?'模拟替代':'模拟关节数据'):status?.online?'实机反馈':'等待设备连接'}</span></header>{(simulated||status?.connected)?<JointView status={display} mapping={(asset||twin.ops?.assets?.find(a=>a.code==='MG400-TEACH-01'))?.mg400Mapping} modelUrl={asset?asset.modelUrl:twin.ops?.assets?.find(a=>a.code==='MG400-TEACH-01')?.modelUrl}/>:<div className="mg400-model mg400-empty"><div><strong>MG400 机械臂</strong><p>连接后显示实际关节姿态</p><button onClick={()=>setView('config')}>配置连接</button></div></div>}</section><div className="mg400-lower"><section className="mg400-operation"><header><h4>运行操作</h4><span>{simulated?(display.fallback?'未接入实机 · 模拟替代':'模拟模式 · 未使用实机'):status?.config?.host||'未连接'}</span></header><div className="mg400-project"><label>轨迹工程<select aria-label="轨迹工程" value={status?.config?.project||''} disabled={!canConfigure||busy||!trajectorySelectable||!trajectoryPresets.length} onChange={event=>void selectTrajectory(event.target.value)}><option value="" disabled>请选择已导入工程</option>{trajectoryPresets.map(preset=><option key={preset.projectName} value={preset.projectName}>{preset.name}</option>)}</select></label>{canConfigure&&<button onClick={()=>setView('trajectory')}>管理轨迹</button>}</div>{status&&!status.connected&&<p className="mg400-project-hint">未连接实机，可先选择后续运行工程；连接后需确认工程已导入控制器。</p>}{canConfigure&&!trajectoryPresets.length&&<p className="mg400-project-hint">尚未配置轨迹预设，请在配置中登记工程。</p>}{status?.connected&&!trajectoryIdle&&<p className="mg400-project-hint">请停止当前工程，并确认机械臂“已上使能 · 空闲”后再切换。</p>}{status?.connected&&trajectoryIdle&&<p className="mg400-project-hint">选择只更新后续运行工程，不会启动运动；工程须已导入控制器。</p>}<div className="mg400-actions">{twin.dataMode==='simulation'&&<span role="status">模拟反馈已接入，模型随下方关节角度变化</span>}{twin.dataMode!=='simulation'&&<button disabled={!canConfigure||busy||status?.connected||!status?.config?.host} onClick={()=>send('connect',{})}>连接实机</button>}<button title="只断开平台通信，不会停止或断电机械臂" disabled={!canConfigure||busy||!status?.connected} onClick={()=>send('disconnect',{})}>断开实机</button>{status?.connected&&<small className="mg400-disconnect-hint">断开仅结束平台通信，不会停止或断电机械臂。</small>}{status?.externalControl&&<button className="mg400-stop" disabled={busy||!canOperate} onClick={()=>send('test-stop',{})}>停止空载测试</button>}{actions.map(([action,label])=><button className={action==='stop'?'mg400-stop':''} key={action} title={requiredModes[action]?.[1]} disabled={busy||!canOperate||!status?.online||status?.externalControl||twin.dataMode==='simulation'||(requiredModes[action]&&Number(status?.feedback?.robot_mode)!==requiredModes[action][0])||(action==='run'&&(!status?.config?.project||['正在下发运行工程','已受理 · 等待运行反馈','启动结果未知'].includes(status?.execution?.state)))} onClick={()=>prepare(action)}>{label}</button>)}</div>{twin.dataMode==='simulation'&&<p className="mg400-result">当前为模拟数据模式，实机改速和点动已禁用。{canConfigure&&<button disabled={busy} onClick={async()=>{setBusy(true);try{await api('/api/ops/data-mode',{mode:'mixed'});await twin.refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}}>切换真实＋模拟，启用实机控制</button>}</p>}<div className="mg400-speed"><label>下发速度比例 <input type="number" min="1" max="100" value={speed} onChange={e=>{speedEdited.current=true;setSpeed(Number(e.target.value));}}/> %</label><button disabled={busy||!canOperate||!status?.online||twin.dataMode==='simulation'} onClick={()=>prepare('speed',speed)}>设置速度</button><small>填写后需确认下发，实际比例以右侧控制器回读为准。</small></div><p className="mg400-result">本次工程：{status?.execution?.project||status?.config?.project||'未选择'} · {status?.execution?.state||'未下发'}</p>{status?.execution?.error&&<p role="alert">{status.execution.error}</p>}{status?.lastAction&&<p className="mg400-project-hint">最近指令：{status.lastAction.command} · {status.lastAction.state}</p>}</section><section className="mg400-readouts"><header><h4>实时数据</h4><span>{simulated?'模拟反馈':status?.online?'反馈在线':'暂无有效反馈'}</span></header><p>来源：{simulated?(display.fallback?'混合模式 · 模拟替代':'平台模拟数据'):status?.externalControl?'实机 TCP · 测试执行器共享反馈':'实机 TCP'} · 吸气：{f?(BigInt(f.digital_outputs)&2n?'开':'关'):'—'} · 吹气：{f?(BigInt(f.digital_outputs)&1n?'开':'关'):'—'}</p><h5>速度反馈</h5><dl><div><dt>整机速度比例</dt><dd>{f?f.speed_scaling.toFixed(0)+'%':'—'}</dd></div><div><dt>{simulated?'模拟线速度（位置差分）':'实测线速度（位置差分）'}</dt><dd>{measuredSpeed?measuredSpeed.linear.toFixed(2)+' mm/s':'—'}</dd></div><div><dt>{simulated?'模拟旋转速度（位置差分）':'实测旋转速度（位置差分）'}</dt><dd>{measuredSpeed?measuredSpeed.angular.toFixed(2)+' °/s':'—'}</dd></div></dl><h5>关节角度</h5><dl>{['J1','J2','J3','J4'].map((n,i)=><div key={n}><dt>{n}</dt><dd>{f?f.q_actual[i].toFixed(2)+'°':'—'}</dd></div>)}</dl><h5>末端位置</h5><dl>{['X','Y','Z','R'].map((n,i)=><div key={n}><dt>{n}</dt><dd>{f?f.tool_vector_actual[i].toFixed(2)+(i===3?'°':' mm'):'—'}</dd></div>)}</dl><p>报警：{f?(f.error_status||f.robot_mode===9?'存在报警':'未报故障'):'未知'} · 编码：{status?.alarmCodes||'—'}</p><details><summary>全部反馈字段</summary><pre>{f?JSON.stringify(f,null,2):'暂无有效反馈'}</pre></details></section></div></div>}

 {message&&<p role="status">{message}</p>}{(error||status?.error)&&<p role="alert">{error||status.error}{error&&<button type="button" onClick={()=>setError('')}>关闭提示</button>}</p>}
 {confirm&&<Modal title="确认机械臂控制" onClose={()=>setConfirm(null)}><p>目标：{confirm.host}</p><p>将发送：<code>{confirm.command}</code></p>{confirm.command?.startsWith('RunScript(')&&<p>当前实机速度比例：{status?.feedback?.speed_scaling??'未知'}%。程序中的固定等待时间不会随比例缩短。</p>}<p>确认现场允许执行此操作。确认有效期 30 秒。</p><button disabled={busy} onClick={async()=>{if(confirm.externalSpeed!==undefined)await send('test-speed',{value:confirm.externalSpeed,confirmed:true});else await send('execute',{token:confirm.token,confirmed:true});setConfirm(null);await twin.refresh();}}>确认下发</button><button onClick={()=>setConfirm(null)}>取消</button></Modal>}
 </section>;
}
