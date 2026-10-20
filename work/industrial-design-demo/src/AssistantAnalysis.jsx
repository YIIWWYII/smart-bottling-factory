import {useState} from 'react';
import {Modal} from './ui';
import {productionReports} from './assistantReport';

const format=v=>v===null?'暂无记录':v.toLocaleString('zh-CN');
function Bars({values,labels,label}){
 const max=Math.max(1,...values.filter(v=>v!==null)),width=Math.max(640,values.length*32),step=(width-72)/values.length;
 return <div className="analysis-chart-scroll"><svg viewBox={`0 0 ${width} 250`} style={{minWidth:width}} role="img" aria-label={label+'；精确值见下方数据表。'}>
  {[0,.5,1].map(r=><g key={r}><line x1="55" x2={width-10} y1={210-r*170} y2={210-r*170} stroke="#dbe5ee"/><text x="48" y={214-r*170} textAnchor="end">{Math.round(max*r).toLocaleString()}</text></g>)}
  {values.map((v,i)=><g key={i}><title>{labels[i]}：{v===null?'暂无记录':v+' 瓶'}</title>{v===null?<text x={55+step*(i+.5)} y="201" textAnchor="middle">—</text>:<rect x={55+step*i+step*.18} y={210-v/max*170} width={step*.64} height={Math.max(v===0?1:0,v/max*170)} rx="3" fill="#327bc7"/>}{(values.length<12||i%Math.ceil(values.length/10)===0||i===values.length-1)&&<text x={55+step*(i+.5)} y="234" textAnchor="middle">{labels[i]}</text>}</g>)}
  <text x="8" y="20">瓶</text>
 </svg></div>;
}
function ProductionSection({data}){
 const [day,setDay]=useState(data.days.find(d=>d.produced!==null)?.day||data.days[0].day),[detail,setDetail]=useState('daily');
 const selected=data.days.find(d=>d.day===day)||data.days[0],hourly=detail==='hourly';
 const values=hourly?selected.hourly:data.days.map(d=>d.produced),labels=hourly?selected.hourly.map((_,i)=>String(i).padStart(2,'0')+':00'):data.days.map(d=>d.day.slice(5));
 return <section className="analysis-section"><h3>{data.from} 至 {data.to}</h3><p className="analysis-source">{({simulation:'模拟数据',real:'真实数据',mixed:'混合数据'})[data.mode]||'来源未标明'} · 北京时间 · 查询于 {new Date(data.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}</p>
 <div className="analysis-summary"><div><span>已记录产量</span><strong>{format(data.total)}{data.total!==null&&<small> 瓶</small>}</strong></div><div><span>有记录日期</span><strong>{data.recorded}<small> / {data.days.length} 天</small></strong></div><div><span>缺少记录</span><strong>{data.days.length-data.recorded}<small> 天</small></strong></div></div>
 <div className="analysis-switch" aria-label="统计粒度"><button aria-pressed={!hourly} onClick={()=>setDetail('daily')}>每日产量</button><button aria-pressed={hourly} onClick={()=>setDetail('hourly')}>小时分布</button>{hourly&&<label>日期 <select value={day} onChange={e=>setDay(e.target.value)}>{data.days.map(d=><option key={d.day}>{d.day}</option>)}</select></label>}</div>
 <Bars values={values} labels={labels} label={hourly?day+'小时产量':'每日产量'}/>
 <p className="analysis-note">— 表示暂无记录，0 表示已记录为零。记录可能只覆盖部分时段，不能视为完整全天产量。</p>
 <div className="analysis-table"><table><caption>{hourly?day+'小时数据':'每日数据'} · 单位：瓶</caption><thead><tr><th>{hourly?'小时（北京时间）':'日期'}</th><th>已记录产量</th><th>记录情况</th></tr></thead><tbody>{values.map((v,i)=><tr key={i}><th scope="row">{hourly?labels[i]:data.days[i].day}</th><td>{format(v)}</td><td>{v===null?'缺少记录':'已有记录，覆盖范围有限'}</td></tr>)}</tbody></table></div>
 </section>;
}
export default function AssistantAnalysis({report,onClose}){
 const datasets=productionReports(report.trace),tasks=report.trace?.filter(t=>t.tool==='query_tasks'&&t.status==='success').at(-1)?.result;
 return <Modal className="assistant-analysis" title="生产数据分析" eyebrow="助手分析报告" onClose={onClose}>
 <p className="analysis-question">{report.question}</p>
 {datasets.map((data,i)=><ProductionSection key={i} data={data}/>)}
 {!datasets.length&&<p className="analysis-note">本次没有取得可绘图的产量记录，暂不生成产量图。请指定日期范围重新查询。</p>}
 {tasks&&<section className="analysis-section"><h3>当前任务完成情况</h3><p>当前角色可见任务快照，不限定为上述统计日期内的任务。{tasks.coverage}</p><div className="analysis-table"><table><thead><tr><th>任务</th><th>状态</th><th>完成 / 计划（瓶）</th><th>完成进度</th></tr></thead><tbody>{tasks.items?.map(t=><tr key={t.id}><th scope="row">{t.name}</th><td>{t.status}</td><td>{t.done??'—'} / {t.plan??'—'}</td><td>{Number.isFinite(t.done)&&Number.isFinite(t.plan)&&t.plan>0?<><progress max={t.plan} value={t.done}/><span> {Math.round(t.done/t.plan*100)}%</span></>:'暂无比例'}</td></tr>)}</tbody></table></div></section>}
 <section className="analysis-section"><h3>分析结论</h3><p className="analysis-conclusion">{report.answer}</p></section><p className="analysis-note">图表根据本次工具查询结果生成。关闭后可从聊天中的“查看分析图表”重新打开本次快照。</p>
 </Modal>;
}
