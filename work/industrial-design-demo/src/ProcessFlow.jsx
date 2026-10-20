import {stages} from './data';
import {stateLabels} from './LineSchematic';
export const processLinks=[[0,1],[1,2],[2,4],[3,4],[4,5],[5,6],[6,7],[7,8]];
export const statusOf=s=>s.quality==='offline'?'离线':stateLabels[s.mode]||'未知';
export const equipmentImage=i=>`/images/equipment/stage-${i+1}.webp`;
const positions=[[125,137],[345,137],[565,137],[815,137],[1055,137],[1055,389],[815,389],[575,389],[335,389]];
const routes=['M205 133H261','M425 133H481','M565 220V252H1055V220','M897 133H973','M1142 137H1174V386H1142','M971 386H899','M731 386H659','M491 386H419'];
export default function ProcessFlow({states,selected,onSelect}){
 return <div className="process-diagram-scroll" tabIndex={0} aria-label="九工位工艺流程，可横向滚动"><svg className="process-diagram" viewBox="0 0 1210 505" role="group" aria-label="瓶体与料液汇合后灌装、质检、装箱、运输、入库"><defs><marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="currentColor" strokeWidth="1.4"/></marker><linearGradient id="machine-deck" x2="0" y2="1"><stop stopColor="#aacce4" stopOpacity=".36"/><stop offset="1" stopColor="#456880" stopOpacity=".08"/></linearGradient></defs>
 <rect className="process-zone zone-preparation" x="10" y="10" width="682" height="229" rx="24"/>
 <rect className="process-zone zone-filling" x="714" y="10" width="486" height="229" rx="24"/>
 <rect className="process-zone zone-finishing" x="10" y="276" width="1190" height="219" rx="24"/>
 <text className="zone-title" x="32" y="43">瓶体准备</text><text className="zone-caption" x="153" y="42">清洗 → 气体检测 → 外观检测</text>
 <text className="zone-title" x="739" y="43">供液与灌装</text><text className="zone-caption" x="902" y="42">瓶体与料液汇合</text>
 <text className="zone-title" x="35" y="311">成品流转</text><text className="zone-caption" x="35" y="337">复检 → 装箱</text><text className="zone-caption" x="35" y="358">运输 → 入库</text>
 {processLinks.map(([a,b],j)=>{const blocked=[a,b].some(i=>states[i].quality==='offline'||['stopped','fault'].includes(states[i].mode));return <path key={a+'-'+b} className={`process-connection ${blocked?'halted':''} ${a===3?'supply':''}`} d={routes[j]} markerEnd="url(#flow-arrow)"/>;})}
 {stages.map((s,i)=>{const [x,y]=positions[i],live=states[i];return <g key={s.id} transform={`translate(${x} ${y})`} role="button" tabIndex="0" aria-label={`切换工位 ${i+1} ${s.name}`} aria-pressed={selected===i} onClick={()=>onSelect(i)} onKeyDown={e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onSelect(i);}}} className={`process-machine state-${live.mode} ${selected===i?'selected':''}`}><rect className="machine-shadow" x="-91" y="-69" width="182" height="163" rx="18"/><ellipse className="machine-deck" cx="0" cy="33" rx="82" ry="18"/><image href={equipmentImage(i)} x="-96" y="-78" width="192" height="133"/><text className="process-machine-name" textAnchor="middle" y="69">{i+1} · {s.short}</text><text className="process-machine-state" textAnchor="middle" y="88">{statusOf(live)}</text><circle cx="77" cy="-56" r="5" className={live.quality==='offline'?'offline-dot':'live-dot'}/></g>;})}
 </svg></div>;
}
export function StationDiagram({states,selected}){
 const s=stages[selected],live=states[selected],up=processLinks.filter(([,b])=>b===selected).map(([a])=>stages[a].short),down=processLinks.filter(([a])=>a===selected).map(([,b])=>stages[b].short);
 return <div className={`station-diagram state-${live.mode}`} aria-label={`${s.name}二维设备状态图`}><div className="station-diagram-title"><strong>{s.name} · 二维状态</strong><span>{statusOf(live)} · {live.source==='real'?'真实遥测':'模拟数据'}</span></div><div className="station-diagram-body"><div><small>上游输入</small><strong>{up.join(' + ')||'产线入口'}</strong><span>→</span></div><img src={equipmentImage(selected)} alt={s.name+'设备示意'}/><div><small>下游输出</small><strong>{down.join(' + ')||'仓储入库'}</strong><span>→</span></div></div><div className="station-diagram-reading"><span>{s.metric}</span><strong>{live.quality==='offline'?'—':live.value.toFixed(s.precision)} <small>{s.unit}</small></strong><span>与三维设备、工艺控制共用当前工位数据</span></div></div>;
}
