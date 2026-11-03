import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Bell,ChevronRight,X} from 'lucide-react';
import {api,useTwin} from './TwinState';
import './alarm-notifications.css';

const modeLabel={simulation:'模拟数据',real:'真实数据',mixed:'混合数据'};
const statusLabel=row=>row.resolvedAt?'已结束':'待处理';
function AnalysisText({text}){
 return String(text||'暂无分析结果').split(/\n\s*\n/).map((paragraph,i)=><p key={i}>{paragraph.split(/(\*\*[^*]+\*\*)/g).map((part,j)=>part.startsWith('**')?<strong key={j}>{part.slice(2,-2)}</strong>:part)}</p>);
}

export default function AlarmNotifications(){
 const {ops,dataMode}=useTwin(),[rows,setRows]=useState([]),[expanded,setExpanded]=useState(false),[selectedId,setSelectedId]=useState(null),[error,setError]=useState('');
 const container=useRef(null),toggle=useRef(null);
 useEffect(()=>{let live=true,pending=false;setRows([]);setExpanded(false);setSelectedId(null);const load=async()=>{if(pending)return;pending=true;try{const result=await api('/api/ai/alarm-notifications');if(live){setRows(result);setError('');}}catch(e){if(live)setError(e.message);}finally{pending=false;}};load();const timer=setInterval(load,2000);return()=>{live=false;clearInterval(timer);};},[dataMode]);
 useEffect(()=>{if(!expanded)return;const outside=e=>{if(!container.current?.contains(e.target))setExpanded(false);};const escape=e=>{if(e.key==='Escape'){setExpanded(false);toggle.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[expanded]);
 const activeCount=rows.filter(r=>!r.resolvedAt).length,row=rows.find(r=>r.id===selectedId);
 if(!ops)return null;
 return <div className="alarm-notifications" ref={container} data-ai-ignore>
  <button ref={toggle} className="alarm-notifications-toggle" aria-label="告警通知" aria-expanded={expanded} aria-controls="alarm-notifications-panel" title={error?'告警同步失败':`${activeCount} 条待处理，${rows.length} 条记录`} onClick={()=>{setExpanded(v=>!v);setSelectedId(null);}}><Bell size={18}/><span className="alarm-notifications-label">告警</span>{activeCount>0&&<span className="alarm-notifications-count">{activeCount>99?'99+':activeCount}</span>}{error&&<span className="alarm-notifications-sync">!</span>}</button>
  {expanded&&<section id="alarm-notifications-panel" className="alarm-notifications-panel" aria-label="告警通知列表">
   <header className="alarm-notifications-header"><div>{row?<button className="alarm-notifications-back" onClick={()=>setSelectedId(null)}><ArrowLeft size={16}/>返回列表</button>:<><strong>告警通知</strong><span>{activeCount} 条待处理</span></>}</div><button className="alarm-notifications-close" aria-label="关闭告警通知" onClick={()=>{setExpanded(false);toggle.current?.focus();}}><X size={18}/></button></header>
   {error&&<p className="alarm-notifications-error" role="status">同步失败：{error}</p>}
   <div className="alarm-notifications-body">{row?<article className="alarm-notifications-detail">
    <div className="alarm-notifications-meta"><span data-active={!row.resolvedAt}>{statusLabel(row)}</span><span>{modeLabel[row.mode]||'混合数据'}</span></div>
    <h3>{row.alarm.title||'设备告警'}</h3><time>{new Date(row.createdAt).toLocaleString('zh-CN',{hour12:false})}</time><p className="alarm-notifications-description">{row.alarm.detail}</p>
    <div className="alarm-notifications-analysis"><h4>智能体分析</h4>{row.status==='completed'?<AnalysisText text={row.answer}/>:row.status==='failed'?<><p>分析未完成：{row.error}</p><button className="alarm-notifications-retry" onClick={async()=>{try{await api('/api/ai/alarm-notifications/retry',{id:row.id});setRows(s=>s.map(r=>r.id===row.id?{...r,status:'pending'}:r));}catch(e){setError(e.message);}}}>重试分析</button></>:<p role="status">{row.status==='pending'?'等待智能体分析…':'智能体正在查询数据并分析…'}</p>}</div>
   </article>:rows.length?<ul className="alarm-notifications-list">{rows.map(item=><li key={item.id}><button onClick={()=>setSelectedId(item.id)}><div><span className="alarm-notifications-meta"><span data-active={!item.resolvedAt}>{statusLabel(item)}</span><span>{modeLabel[item.mode]||'混合数据'}</span></span><strong>{item.alarm.title||'设备告警'}</strong><time>{new Date(item.createdAt).toLocaleString('zh-CN',{hour12:false})}</time></div><ChevronRight size={16}/></button></li>)}</ul>:<p className="alarm-notifications-empty">暂无告警通知</p>}</div>
  </section>}
 </div>;
}
