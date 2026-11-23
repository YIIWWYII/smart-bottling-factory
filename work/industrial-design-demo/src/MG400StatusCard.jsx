import React from 'react';
import {Activity} from 'lucide-react';
import './mg400-status-card.css';
const readNumber=(value,unit,places=1)=>Number.isFinite(value)?`${value.toFixed(places)} ${unit}`:'—';
function DataCard({label,value,unit,accent='#67dbe9',detail}){return <article className="mg400-status-value" style={{'--status-accent':accent}}><span>{label}</span><strong>{value}{unit&&<small>{unit}</small>}</strong>{detail&&<small>{detail}</small>}</article>;}
function JointAngleCards({feedback}){return <section className="mg400-status-group"><h4>关节角度</h4><div className="mg400-status-grid four">{['J1','J2','J3','J4'].map((joint,index)=><DataCard key={joint} label={joint} value={readNumber(feedback?.q_actual?.[index],'°',2)} unit="" accent={['#67dbe9','#a6baff','#ffc887','#90deb0'][index]}/>)}</div></section>;}
function EndPositionCards({feedback}){return <section className="mg400-status-group"><h4>末端位置</h4><div className="mg400-status-grid four">{['X','Y','Z','R'].map((axis,index)=><DataCard key={axis} label={axis} value={readNumber(feedback?.tool_vector_actual?.[index],index===3?'°':'mm',2)} unit="" accent={['#67dbe9','#a6baff','#ffc887','#90deb0'][index]}/>)}</div></section>;}
function SignalCards({feedback,fault}){const bits=feedback?BigInt(feedback.digital_outputs):null;return <section className="mg400-status-grid signals"><DataCard label="吸气" value={bits===null?'—':bits&2n?'开':'关'} unit="" accent="#67dbe9"/><DataCard label="吹气" value={bits===null?'—':bits&1n?'开':'关'} unit="" accent="#a6baff"/><DataCard label="设备报警" value={feedback?(fault?'存在告警':'未报故障'):'未知'} unit="" accent={fault?'#ff9ca7':'#90deb0'}/></section>;}
export default function MG400StatusCard({status,lineSpeed=null,rotationSpeed=null}){
 const display=status?.display??status,simulated=display?.source==='simulation',age=Date.now()-display?.receivedAt,valid=simulated?Boolean(display?.feedback):Boolean(display?.online&&Number.isFinite(age)&&age>=0&&age<=1500),feedback=valid?display.feedback:null,mode=feedback?.robot_mode,fault=Boolean(feedback&&(feedback.error_status||mode===9));
 const label=simulated?(display.fallback?'模拟替代':'模拟数据'):!valid?(display?.connected?'反馈过期':'未连接'):fault?'故障':({4:'未使能',5:'就绪',6:'拖拽',7:'运行中',10:'暂停',11:'点动'})[mode]||'状态待确认';
 const speed=readNumber(feedback?.speed_scaling,'%');
 return <section className="mg400-status-card" aria-label="上料机械臂状态">
  <header><Activity size={20}/><div><h3>上料机械臂</h3><small>MG400-TEACH-01 · Dobot MG400</small></div><span className={`mg400-state ${simulated?'simulated':fault?'fault':valid?'online':'offline'}`} role="status">{label}</span></header>
  <section className="mg400-status-group"><h4>速度反馈</h4><div className="mg400-status-grid three"><DataCard label="整机速度比例" value={speed} unit="" accent="#67dbe9" detail="控制器反馈"/><DataCard label="线速度" value={readNumber(lineSpeed,'mm/s',2)} unit="" accent="#a6baff" detail="位置差分"/><DataCard label="旋转速度" value={readNumber(rotationSpeed,'°/s',2)} unit="" accent="#ffc887" detail="位置差分"/></div></section>
  <JointAngleCards feedback={feedback}/><EndPositionCards feedback={feedback}/><SignalCards feedback={feedback} fault={fault}/>
  <footer>来源：{simulated?(display.fallback?'平台模拟数据 · 未接入实机':'平台模拟数据'):'实机 TCP 反馈'} · {simulated?'教学样例':valid?'反馈有效':'等待有效反馈'}</footer>
 </section>;
}
