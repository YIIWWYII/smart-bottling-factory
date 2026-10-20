import {secondaryMetrics,localSimulation} from './stationTelemetry';
import {materialProgress,gasInspectionCapacity,preprocessingPhase} from './materialFlow';
import {stages} from './data';
import {useTwin} from './TwinState';
// Measurement peers, not controller setpoints or management counters.
// Local SVG adaptation of data-organize sparkCell: gaps remain gaps, axes use observed values.
function MetricGraphic({metric:m,history}){
 const valid=Number.isFinite(m.value),percent=m.unit==='%'||m.unit==='%RH';
 if(percent)return <div className="core-graphic core-percent"><div className="core-percent-track" role="img" aria-label={valid?`${m.label} ${m.value}${m.unit}`:'暂无采集数据'}>{Array.from({length:20},(_,i)=><i key={i} style={{background:valid?`linear-gradient(90deg,var(--metric-accent) ${Math.max(0,Math.min(100,(m.value-i*5)*20))}%,#ffffff18 0)`:'#ffffff18'}}/>)}</div><div className="core-axis"><span>0</span><span>占比 / %</span><span>100</span></div></div>;
 const samples=m.id==='primary'&&valid?(history||[]):[],finite=samples.filter(Number.isFinite);
 if(finite.length>1){
 const low=Math.min(...finite),high=Math.max(...finite),range=high-low;
 let path='',open=false;
 samples.forEach((v,i)=>{if(!Number.isFinite(v)){open=false;return;}path+=`${open?'L':'M'}${4+i/(samples.length-1)*232},${range?44-(v-low)/range*36:26} `;open=true;});
 return <div className="core-graphic"><svg viewBox="0 0 240 52" role="img" aria-label={`${m.label}最近${samples.length}次采样，最低${low}，最高${high}`}><path d="M4 8H236M4 26H236M4 44H236" className="core-grid"/><path d={path} className="core-trace"/></svg><div className="core-axis"><span>{Number(low.toFixed(2))}–{Number(high.toFixed(2))} {m.unit}</span><span>最近 {samples.length} 次采样</span></div></div>;
 }
 if(m.id==='fillDeviation')return <div className="core-graphic core-deviation"><span>{valid?(m.value>0?'↑ 高于目标':m.value<0?'↓ 低于目标':'与目标一致'):'等待实测'}</span><small>实际灌装量 − 目标灌装量</small></div>;
 return <div className="core-graphic core-reading"><span>{valid?'当前采集值':'等待采集'}</span><span className="core-signal" aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i}/>)}</span></div>;
}
export default function StationCoreMetrics({stageIndex}){
 const twin=useTwin(),state=twin.states[stageIndex],stage=stages[stageIndex],offline=state.quality==='offline';
 const noProduct=state.material?.phase!=='unknown'&&[2,4,5].includes(stageIndex)&&state.material?.count===0;
 const metrics=[{id:'primary',label:stage.metric,unit:stage.unit,value:offline||noProduct?null:state.value,source:state.dataSource==='protocol'?'协议仿真回读':state.source==='real'?'真实遥测':'模拟读数'},...secondaryMetrics[stageIndex].map(m=>{
 let value=offline?null:state.measurements?.[m.id],source=state.dataSource==='protocol'?'协议仿真回读':state.source==='real'?'真实遥测':'模拟读数';
 if(!offline&&!noProduct&&m.id==='fillDeviation'&&Number.isFinite(state.value)&&Number.isFinite(state.target))value=Number((state.value-state.target).toFixed(1));
 if(!offline&&!noProduct&&state.source==='simulation'&&state.dataSource!=='protocol'){
 const id=m.id==='tankLevel'?'tank-':m.id==='obstacleDistance'?'agv-obstacle':null;
 const sample=id?twin.safetyCases?.filter(c=>c.id.startsWith(id)&&(m.id!=='tankLevel'||c.id!=='tank-hot')).sort((a,b)=>b.updatedAt-a.updatedAt)[0]:null;
 if(sample){value=sample.value;source=state.dataSource==='protocol'?'联动设备协议回读':'联动模拟传感器';}
 }
 return {...m,value,source};
 })];
 const local=localSimulation(twin),controls=twin.ops?.controls||{},phase=offline?null:local?preprocessingPhase(twin.materialFlow,controls):state.washPhase;
 const bottles=offline?null:local?(twin.materialFlow?.stages?.[1]||[]).map(b=>{const duration=Math.max(1,b.duration-4),elapsed=Math.max(0,Math.min(duration,materialProgress(twin.materialFlow,b)*b.duration-2));return {id:b.id,duration,elapsed,status:elapsed>=duration?'done':twin.materialFlow.running?'testing':'paused'};}):state.inspection?.bottles;
 const setting=(key,fallback)=>state.source==='real'?'未回传':Number.isFinite(controls[key])?`${controls[key]} 秒`:local?`${fallback} 秒`:'未提供';
 return <>{stageIndex===0&&<div className="pretreatment-status">{[['rinse','水洗','PT-WASH-01:washDuration',15],['air','风洗','PT-AIR-01:airDuration',10]].map(([id,name,key,fallback])=><article key={id}><strong>{name}</strong><span>{!phase?'阶段未提供':phase===id?(state.mode==='running'?'正在处理':'已暂停'):'当前未处理'}</span><small>设定时长 {setting(key,fallback)}</small></article>)}</div>}{stageIndex===1&&<section className="gas-bottle-status"><header><strong>逐瓶检测时间</strong><span>{bottles?`实际在位 ${bottles.length} / ${gasInspectionCapacity} 瓶`:'在位数量未提供'}</span></header>{bottles?.length?bottles.map((b,i)=><article key={b.id}><strong>瓶 {i+1}</strong><span>{({done:'检测完成 · 等待移交',testing:'检测中',paused:'已暂停'})[b.status]}</span><progress max={b.duration} value={b.elapsed}/><small>已用 {Math.floor(b.elapsed)} / {Math.ceil(b.duration)} 秒 · 剩余 {Math.max(0,Math.ceil(b.duration-b.elapsed))} 秒</small></article>):<p>{offline?'设备离线 · 检测状态未知':bottles?'当前无瓶体 · 等待来料':'当前来源未提供逐瓶检测反馈'}</p>}<small>设定：采样 {setting('GAS-PUMP-01:sampleDuration',30)} + 静置 {setting('GAS-CHAMBER-01:settleTime',60)}；{local?'计时不含移入移出时间':'时间以设备反馈为准'}。</small></section>}<div className="station-core-measurements">{metrics.map((m,i)=><article key={m.id} className="core-measurement" style={{'--metric-accent':['#67dbe9','#a6baff','#ffc887','#90deb0'][i%4]}} data-available={Number.isFinite(m.value)}><span>{m.label}</span><strong>{Number.isFinite(m.value)?Number(m.value.toFixed(2)):'—'}<small>{m.unit}</small></strong><MetricGraphic metric={m} history={state.history}/><small>{Number.isFinite(m.value)?m.source:offline?'设备离线':noProduct?'等待瓶体到位':'暂无采集数据'}</small></article>)}</div></>;
}
