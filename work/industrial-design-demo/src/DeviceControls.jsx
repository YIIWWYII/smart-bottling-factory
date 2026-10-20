import {deviceName} from './controlCapabilities';
import { useEffect,useState } from 'react';
import { useTwin } from './TwinState';
import { stages } from './data';
import { Modal } from './ui';
import DeviceSettingPreview from './DeviceSettingPreview';
import PanelActuator from './PanelActuator';
import ActivityFeed from './ActivityFeed';
import MachineConsole from './MachineConsole';
import consoleProfiles from './machineConsoleProfiles.json';
import './operator-panel.css';
const controlText=v=>({RUNNING:'运行',PAUSED:'暂停',REQUEST:'请求执行',READY:'待命',ON:'开启',OFF:'关闭'})[v]||(v==null?'未回报':String(v));
function controlKind(c){
 if(c.type==='ACTION')return 'push';
 if(c.type==='ENUM')return c.options?.includes('RUNNING')&&c.options?.includes('PAUSED')?'run-buttons':'lever';
 if(c.type==='TEXT')return 'keys';
 if(/mixSpeed|flowRate|gripForce/.test(c.control))return 'handwheel';
 if(/Speed|speed|Intensity|pickRate/.test(c.control))return 'fader';
 return 'keypad';
}
function PhysicalControl({cap:c,value,disabled,changed,onChange,onPreview,surface='deck'}){
 const kind=controlKind(c), numeric=c.type==='NUMBER';
 const ratio=numeric?Math.max(0,Math.min(1,(Number(value)-c.min)/(c.max-c.min))):Math.max(0,(c.options||[]).indexOf(value));
 const update=n=>onChange(Number(Math.max(c.min,Math.min(c.max,c.min+Math.round((n-c.min)/c.step)*c.step)).toFixed(6)));
 return <div className={'panel-control control-'+kind}>
  <div className="control-engraving"><strong>{c.label}</strong><small>{deviceName(c.device)} · {c.device}{c.role==='ENGINEER'?' · 工程师':''}</small></div>
  {surface==='deck'&&['handwheel','fader','lever','push'].includes(kind)&&<PanelActuator kind={kind} ratio={ratio||0} label={c.label+(numeric?'：上下拖动调节':'：按下切换')} disabled={disabled} onChange={numeric?r=>update(c.min+r*(c.max-c.min)):undefined} onActivate={kind==='push'?onPreview:kind==='lever'?()=>onChange(c.options[value===c.options[0]?1:0]):undefined}/>}
  {numeric?(surface==='settings'?<><label className="panel-value"><input aria-label={c.label} type="number" min={c.min} max={c.max} step={c.step} disabled={disabled} value={value??''} onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))}/><span>{c.unit}</span></label><div className="panel-trim"><button disabled={disabled} aria-label={c.label+'减少'} onClick={()=>update(Number(value)-c.step)}>−</button><span>{c.min}–{c.max} {c.unit}</span><button disabled={disabled} aria-label={c.label+'增加'} onClick={()=>update(Number(value)+c.step)}>+</button></div><small>{kind==='keypad'?'数字设定 · 按键微调':'上下拖动 · 按键微调'}</small></>:<output className="deck-parameter-value">{value} <small>{c.unit}</small></output>):c.type==='ENUM'?<div className={"panel-position-keys "+(kind==='run-buttons'?'physical-run-buttons':'')}>{c.options.map(v=><button key={v} className={v==='RUNNING'?'run-key':'pause-key'} disabled={disabled} aria-label={c.label+'：'+controlText(v)} aria-pressed={v===value} onClick={()=>onChange(v)}><span className="physical-key-face"><span aria-hidden="true">{v==='RUNNING'?'▶':'Ⅱ'}</span><strong>{controlText(v)}</strong></span><i/></button>)}</div>:c.type==='TEXT'?<div className="panel-location-keys">{['A-01-01','A-01-02','A-02-01','A-03-01'].map(v=><button key={v} disabled={disabled} aria-pressed={value===v} onClick={()=>onChange(v)}>{v}</button>)}</div>:<small>按下按钮核对动作</small>}
  {c.type!=='ACTION'&&<button className="panel-send" disabled={disabled||!changed||(numeric&&(value===''||!Number.isFinite(Number(value))||Number(value)<c.min||Number(value)>c.max))} onClick={onPreview}>保存</button>}

 </div>;
}
export default function DeviceControls({stageIndex}){
 const {ops,mutate}=useTwin(),[index,setIndex]=useState(stageIndex??0),[draft,setDraft]=useState({}),[deviceChoice,setDeviceChoice]=useState(null),[previewDevice,setPreviewDevice]=useState(null),[pending,setPending]=useState(null),[reason,setReason]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(stageIndex!==undefined)setIndex(stageIndex);setDraft({});setDeviceChoice(null);setPreviewDevice(null);},[stageIndex]);
 if(!ops)return <p>正在读取设备能力…</p>;
 const allowed=c=>['admin','engineer','operator'].includes(ops.user.role)&&(ops.user.role==='admin'||ops.user.stages.includes(c.stageIndex))&&(c.role!=='ENGINEER'||['admin','engineer'].includes(ops.user.role));
 const submit=async()=>{setBusy(true);try{await mutate('/api/ops/control',{id:pending.id,value:pending.value,confirmed:true,reason});setMessage(`${pending.label}：虚拟设备已确认。自动调参已关闭，由人工接管。`);setDraft(d=>{const next={...d};delete next[pending.id];return next;});setPending(null);}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const caps=ops.capabilities.filter(c=>c.stageIndex===index),devices=[...new Set(caps.map(c=>c.device))];
 const changed=c=>draft[c.id]!==undefined&&draft[c.id]!==ops.controls[c.id];
 const device=devices.includes(deviceChoice)?deviceChoice:null,deviceCaps=device?caps.filter(c=>c.device===device):caps,profile=consoleProfiles[index];
 const focusedDevice=device;
 const focusedCaps=device?caps.filter(c=>c.device===device):caps;
 const screen=<div className="console-screen" aria-label="设备数据屏幕"><header><strong>{device?deviceName(device):stages[index].name}</strong><span>{ops.interlock?'联锁锁定':'模拟控制'}</span></header><div className="hmi-body"><DeviceSettingPreview stageIndex={index} device={focusedDevice} caps={focusedCaps} values={ops.controls} draft={draft} allValues={ops.controls}/><div className="console-screen-scroll"><table><thead><tr><th>参数</th><th>已确认</th><th>待设定</th></tr></thead>{(device?[device]:devices).map(d=><tbody key={d}><tr className="device-table-group"><th colSpan="3">{deviceName(d)}</th></tr>{deviceCaps.filter(c=>c.device===d).map(c=><tr key={c.id} className={changed(c)?'is-pending':''}><th>{c.label}</th><td>{controlText(ops.controls[c.id])} <small>{c.unit}</small></td><td>{changed(c)?<>{controlText(draft[c.id])} <small>{c.unit}</small></>:'—'}</td></tr>)}</tbody>)}</table></div></div><footer>系统回执 / 待设定 {deviceCaps.filter(changed).length} 项</footer></div>;
 const renderControl=(c,surface)=><PhysicalControl key={c.id} surface={surface} cap={c} value={draft[c.id]??ops.controls[c.id]} disabled={!allowed(c)||busy} changed={changed(c)} onChange={v=>{setPreviewDevice(c.device);setDraft(d=>({...d,[c.id]:v}));}} onPreview={()=>{setReason('');setPending({...c,value:c.type==='ACTION'?'REQUEST':draft[c.id]??ops.controls[c.id]});setMessage('');}}/>;
 const controls=<div className="manual-device-groups">{(device?[device]:devices).map(d=>{const items=deviceCaps.filter(c=>c.device===d&&!['keypad','keys'].includes(controlKind(c)));return <section className="manual-device-group" key={d}><header><strong>{deviceName(d)}</strong><span>{items.length?'人工控制':'数值参数在上方设定'}</span></header><div className="machine-controls">{items.map(c=>renderControl(c,'deck'))}</div></section>;})}</div>;
 const settings=<section className="console-settings" aria-label="参数设定"><header><strong>参数设定</strong><span>调整后点击保存</span></header><div className="console-settings-fields">{(device?[device]:devices).map(d=>{const items=deviceCaps.filter(c=>c.device===d&&['NUMBER','TEXT'].includes(c.type));return items.length?<fieldset className="device-settings-group" key={d}><legend>{deviceName(d)}</legend><div>{items.map(c=>renderControl(c,'settings'))}</div></fieldset>:null;})}{!deviceCaps.some(c=>['NUMBER','TEXT'].includes(c.type))&&<p>此设备无需数值设定，请使用下方操作台。</p>}</div><p className="machine-operation-note">调节不会立即执行。核对后下发至模拟设备，权限、联锁与操作记录沿用现有规则。</p></section>;
 const navigation=<div className="machine-device-tabs" role="group" aria-label="操作台设备选择"><button aria-pressed={!device} onClick={()=>setDeviceChoice(null)}><strong>整台操作</strong></button>{devices.map(d=><button key={d} aria-pressed={d===device} onClick={()=>setDeviceChoice(d)}><strong>{deviceName(d)}</strong><small>{d}</small>{caps.some(c=>c.device===d&&changed(c))&&<i>待设定</i>}</button>)}</div>;
 return <section className="manual-controls equipment-console machine-console-section" id="station-manual-controls">
 {stageIndex===undefined&&<label>工位<select value={index} onChange={e=>{setIndex(Number(e.target.value));setDraft({});setDeviceChoice(null);setPreviewDevice(null);}}>{stages.map((s,i)=><option key={s.id} value={i}>{s.name}</option>)}</select></label>}

 {ops.interlock&&<p className="hub-warning">联锁锁定：仅允许暂停；排查后需工程师或管理员解除。</p>}
 <MachineConsole aiActivity={<ActivityFeed key={index} stageIndex={index} aiOnly/>} key={profile.id} profile={profile} device={device?deviceName(device):stages[index].name} screen={screen} controls={controls} settings={settings} navigation={navigation} pendingCount={caps.filter(changed).length}/>

  <p role="status">{message}</p>{pending&&<Modal title={pending.type==='ACTION'?'确认人工控制':'保存设备参数'} onClose={()=>!busy&&setPending(null)} eyebrow={pending.device}><p>{stages[pending.stageIndex].name} / {pending.label}</p><div className="hub-command-preview"><span>{String(ops.controls[pending.id])}</span><b>→</b><strong>{String(pending.value)} {pending.unit}</strong></div><label>操作原因{pending.reason?'（必填）':'（选填）'}<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：换批次前人工校准"/></label><p>本次只操作虚拟设备，同时关闭自动调参，保留操作记录。</p><p role="alert">{message}</p><div className="modal-actions"><button className="secondary" disabled={busy} onClick={()=>setPending(null)}>取消</button><button className="primary" disabled={busy||(pending.reason&&reason.trim().length<2)} onClick={submit}>{pending.type==='ACTION'?'确认执行（演示）':'确认保存（演示）'}</button></div></Modal>}</section>;
}
