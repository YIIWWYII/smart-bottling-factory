import {useState} from 'react';
import {useTwin} from './TwinState';
import './protocol-devices.css';
export default function ProtocolDevices({stageIndex}){
 const twin=useTwin(),[open,setOpen]=useState(false);if(!twin.protocol?.enabled)return null;
 const devices=twin.protocol.devices.filter(d=>d.stageIndex===stageIndex);
 return <section className="protocol-devices"><button className="protocol-summary" onClick={()=>setOpen(!open)} aria-expanded={open}><strong>协议设备 · {devices.filter(d=>d.online).length}/{devices.length} 在线</strong><span>Modbus TCP · {open?'收起回读':'查看各设备回读'}</span></button>{open&&<div className="protocol-device-grid">{devices.map(d=><article key={d.id}><header><strong>{d.name.replace('（仿真）','')}</strong><span>{d.online?'在线':'离线'}</span></header><small>{d.id}</small>{!d.online?<p role="status">{d.error||'数据过期'}</p>:<dl>{d.points.map(p=><div key={p.name}><dt>{p.label}</dt><dd>{Number.isFinite(p.value)?Number(p.value.toFixed(3)):'—'} <small>{p.unit}</small></dd></div>)}</dl>}</article>)}</div>}<small>设备协议仿真；相机画面为三维视角，产量和库存尚未接入。</small></section>;
}
