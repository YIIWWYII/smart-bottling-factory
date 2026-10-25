import React from 'react';
import {Activity} from 'lucide-react';
import './mg400-status-card.css';

// 只显示现有面板的反馈，不建立连接、不发送运动命令。
export default function MG400StatusCard({status}) {
 const display=status?.display??status;
 const simulated=display?.source==='simulation';
 const age=Date.now()-display?.receivedAt;
 const valid=simulated?Boolean(display?.feedback):Boolean(display?.online && Number.isFinite(age) && age>=0 && age<=1500);
 const f=valid?display.feedback:null;
 const mode=f?.robot_mode;
 const fault=Boolean(f&&(f.error_status||mode===9));
 const label=simulated?(display.fallback?'模拟替代':'模拟数据'):!valid?(display?.connected?'反馈过期':'未连接'):fault?'故障':({4:'未使能',5:'就绪',6:'拖拽',7:'运行中',10:'暂停',11:'点动'})[mode]||'状态待确认';
 const number=(v,unit)=>Number.isFinite(v)?`${v.toFixed(1)} ${unit}`:'—';
 return <section className="mg400-status-card" aria-label="上料机械臂状态">
  <header><Activity size={20}/><div><h3>上料机械臂</h3><small>MG400-TEACH-01 · Dobot MG400</small></div><span className={`mg400-state ${simulated?'simulated':fault?'fault':valid?'online':'offline'}`} role="status">{label}</span></header>
  <div className="mg400-status-metrics"><div><span>速度比例</span><strong>{number(f?.speed_scaling,'%')}</strong></div><div><span>末端高度 Z</span><strong>{number(f?.tool_vector_actual?.[2],'mm')}</strong></div><div><span>设备告警</span><strong>{!f?'未知':fault?'存在告警':'未报故障'}</strong></div></div>
  <details><summary>查看关节角度</summary><dl>{['J1','J2','J3','J4'].map((name,i)=><div key={name}><dt>{name}</dt><dd>{number(f?.q_actual?.[i],'°')}</dd></div>)}</dl></details>
  <footer>来源：{simulated?(display.fallback?'平台模拟数据 · 未接入实机':'平台模拟数据'):'实机 TCP 反馈'} · {simulated?'教学样例':valid?'反馈有效':'等待有效反馈'}</footer>
 </section>;
}