import ConfigurationHelp from './ConfigurationHelp';
import DataModeSelector,{modeLabels} from './DataModeSelector';
import {stages} from './data';
import {useEffect,useState} from 'react';
import {api,useTwin} from './TwinState';
import './standard-data.css';
function StandardRecords(){const {ops}=useTwin();const labels={name:'名称',category:'种类',flavor:'口味',ingredients:'配料',spec:'包装规格',description:'介绍'};const [data,setData]=useState(null),[error,setError]=useState(''),[tab,setTab]=useState('records'),[q,setQ]=useState('');const load=()=>api('/api/ops/standard/list').then(d=>{setData(d);setError('');}).catch(e=>setError(e.message));useEffect(()=>{load();},[]);return <section className="hub-panel standard-panel"><div className="hub-section-heading"><div><h2>标准资料</h2></div><button className="secondary" onClick={load}>刷新</button></div><nav className="hub-tabs">{[['records','正式标准数据'],['drafts','审核草稿']].map(([k,v])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{v}（{data?.[k].length||0}）</button>)}</nav><input placeholder="按产品或设备名称筛选" aria-label="筛选数据库记录" value={q} onChange={e=>setQ(e.target.value)}/><p role="status">{error}</p>{data&&<div className="standard-records">{data[tab].filter(r=>r.title.includes(q)).map(r=><article key={r.id}><h3>{r.title}</h3><small>{tab==='records'?'已入库标准版本':'审核草稿'} · V{r.version} · {r.publishedBy||r.status}</small>{r.aiReview&&<p>AI 审核：{r.aiReview.passed?'通过':'待纠正'} · {r.aiReview.model}</p>}<dl>{r.fields.map(f=><div key={f.key}><dt>{labels[f.key]||ops?.capabilities.find(c=>c.id===f.key)?.label||f.key}</dt><dd>{String(f.value)} {f.unit}</dd></div>)}</dl><details><summary>来源及审核历史</summary>{r.sources.map(s=><details key={s.id}><summary>{s.title} · V{s.version}</summary><pre>{s.content}</pre></details>)}{r.history.map((h,i)=><p key={i}>{new Date(h.time).toLocaleString('zh-CN')} · {h.actor} · {h.action}</p>)}</details><small>记录编号：{r.id}</small></article>)}</div>}{data&&!data[tab].length&&<p>{tab==='records'?'暂无正式标准数据，请在产品资源中完成填写、审核和入库。':'暂无审核草稿。'}</p>}</section>;}

export default function DatabasePanel(){
 const twin=useTwin();
 const mode=twin.protocol?.enabled?'协议仿真':modeLabels[twin.dataMode]||'等待连接';
 return <><section className="hub-panel standard-panel data-source-panel">
 <div className="hub-section-heading"><div><h2>产线数据来源</h2></div><div className="configuration-header-actions"><DataModeSelector autoOpen={false}/><ConfigurationHelp title="数据配置说明"><h3>数据来源</h3> <dl className="data-source-guide"><div><dt>模拟数据</dt><dd>由生产任务生成模拟数据，无需连接现场设备。</dd></div><div><dt>真实数据</dt><dd>使用现场设备上报的数据，未接入或断线时显示离线。</dd></div><div><dt>真实 + 模拟</dt><dd>优先使用真实数据；数据缺失或过期时使用模拟数据，并标注来源。</dd></div><div><dt>协议仿真</dt><dd>读取本机协议模拟器的设备数据，用于测试通信与读写。</dd></div></dl><p>数据来源应用于数字展板、工位终端和管理页面。设备地址、协议及连接测试在设备配置中管理。</p><h3>存储与资料</h3><p>操作记录、任务和标准资料保存在本机 MySQL。本页不支持修改数据库地址和账号。产品与工艺资料在产品资源中维护；下方可查看已发布版本、审核草稿及来源记录。</p></ConfigurationHelp></div></div>
 <p><strong>当前来源：{mode}</strong></p>

 <details><summary>各工位当前数据来源</summary><div className="data-source-table"><table><thead><tr><th>工位</th><th>当前来源</th><th>说明</th></tr></thead><tbody>{stages.map((s,i)=>{const v=twin.states[i];return <tr key={s.id}><th scope="row">{s.name}</th><td>{!v?.source?'等待数据':v.source==='real'?'设备数据':'模拟数据'}</td><td>{v?.sourceReason||(v?.quality==='offline'?'离线，等待设备上报':'等待来源状态')}</td></tr>;})}</tbody></table></div></details>
 <div className="data-storage-status"><span>存储</span><strong>本机 MySQL</strong><small>任务 · 操作记录 · 标准资料</small></div>
 </section><StandardRecords/></>;
}
