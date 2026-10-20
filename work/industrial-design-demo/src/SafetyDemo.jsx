import {useState} from 'react';
import {useTwin} from './TwinState';
import {safetyScenarios} from './safetyScenarios';
export default function SafetyDemo({stageIndex}){
 const {ops,dataMode,safetyCases=[],mutate}=useTwin(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(dataMode!=='simulation')return null;
 const rules=safetyScenarios.filter(s=>stageIndex==null||s.stageIndex===stageIndex);if(!rules.length)return null;
 const user=ops?.user,roles=user?.roles||[user?.role];
 const allowed=s=>roles?.includes('admin')||roles?.some(r=>['engineer','operator'].includes(r))&&user?.stages?.includes(s.stageIndex);
 const run=async(id,action)=>{setBusy(true);setError('');try{await mutate('/api/ops/safety-demo',{id,action});}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <details className="safety-demo"><summary>异常演示与设施联动 <small>仅模拟 · {rules.length} 个场景</small></summary><p>演示传感器独立于正常读数。告警与联动分别记录，保护停止需排除异常后人工复位。</p><div className="safety-demo-grid">{rules.map(s=>{const c=safetyCases.find(c=>c.id===s.id),phase=c?.phase||'ready';return <article key={s.id} data-phase={phase}><header><h3>{s.title}</h3><span>{({ready:'待演示',active:'异常处理中','awaiting-reset':'等待复位',resolved:'已恢复'})[phase]}</span></header><strong>{c?.value??s.normal}<small> {s.unit}</small></strong><p>{s.metric} · {s.direction==='low'?'≤':'≥'} {s.limit} {s.unit} 告警</p><div className="safety-action"><b>{s.action?'联动设备':'仅告警'}</b><span>{phase==='awaiting-reset'?'保护保持，等待人工复位':phase==='resolved'?s.restore||'告警已恢复':s.action||'检查计量结果，不执行其他设备动作'}</span></div><button disabled={busy||!allowed(s)} onClick={()=>run(s.id,phase==='active'?'clear':phase==='awaiting-reset'?'reset':'trigger')}>{phase==='active'?'模拟排除异常':phase==='awaiting-reset'?'人工复位':'触发演示'}</button></article>;})}</div>{error&&<p role="alert">{error}</p>}</details>;
}
