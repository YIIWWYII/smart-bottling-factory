import {useEffect,useState} from 'react';
import {api} from './TwinState';
import './camera-feeds.css';
const labels={pass:'通过',review:'待复检',reject:'不合格',missing:'缺图',error:'检测异常'};
const cameras=[['top','顶部'],['side-0','侧面 0°'],['side-120','侧面 120°'],['side-240','侧面 240°']];
const maskText=c=>c?.codeMask?.status==='masked'?'条形码区已遮罩':c?.codeMask?.status==='not-required'?'此机位不含条形码区':c?.codeMask?.reason||'等待条形码区定位结果';
function ResultImage({row,name,kind}){
 const [failed,setFailed]=useState(false),url=kind==='yolo'?row?.overlayUrl:row?.heatmapUrl;
 useEffect(()=>setFailed(false),[url]);
 const empty=row?.status==='missing'?'未收到本机位图像':row?.reason||(kind==='yolo'?'等待 YOLO 检测图':'等待 PatchCore 热力图');
 return <article className="vision-branch-camera"><header><strong>{name}</strong><span>{labels[row?.status]||'等待检测'}</span></header>
 <div className="vision-evidence-image">{url&&!failed?<a href={url} target="_blank" rel="noreferrer" title="查看原尺寸检测图"><img src={url} alt={`${name} ${kind==='yolo'?'YOLO 标框图':'PatchCore 热力图'}`} onError={()=>setFailed(true)}/></a>:<p>{failed?'图片加载失败':empty}</p>}</div>
 <p className={row?.codeMask?.status==='masked'?'vision-mask-ok':'vision-mask-pending'}>{maskText(row)}</p>
 <small>{kind==='yolo'?(Array.isArray(row?.detections)?`检测框 ${row.detections.length} 个`:'尚无检测框结果'):(Number.isFinite(row?.anomalyScore)?`异常分数 ${row.anomalyScore.toFixed(3)}`:row?.patchcoreError||'尚无有效异常分数')}</small></article>;
}
export function VisionResultBoard({record}){
 const rows=cameras.map(([id,name])=>({name,row:record?.cameras?.find(c=>c.cameraId===id)}));
 return <div className="vision-result-board">
 <div className="vision-result-meta"><span>瓶号 <strong>{record?.bottleId||'—'}</strong></span><span>批次 {record?.batchId||'—'}</span><span>{record?.createdAt||record?.timestamp?new Date(record.createdAt||record.timestamp).toLocaleString():'等待本次检测'}</span></div>
 {[['yolo','YOLO 缺陷检测','四个机位分别标框'],['patchcore','PatchCore 外观异常检测','同一瓶子的四路热力图']].map(([kind,title,subtitle])=><section className="vision-branch" key={kind}><header><h3>{title}</h3><span>{subtitle}</span></header><div className="vision-branch-grid">{rows.map(({name,row})=><ResultImage key={name} name={name} row={row} kind={kind}/>)}</div></section>)}
 <section className={`vision-joint-conclusion verdict-${record?.verdict||'waiting'}`} aria-live="polite"><header><h3>最终联合识别结论</h3><strong>{record?labels[record.verdict]||'检测未完成':'等待检测'}{record?.demo?' · 演示数据':''}</strong></header><p>{record?.error||record?.reason||'四路检测结果返回后，在这里显示整瓶判定及原因。'}</p>{record&&<small>服务版本 {record.version||'未提供'} · 处理耗时 {Number.isFinite(record.durationMs)?record.durationMs+' ms':'未提供'}</small>}</section></div>;
}
export default function VisionInspectionResults({stageIndex=2,record=null,onLatest,onExport}){
 const [state,setState]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true,timer;const controller=new AbortController();
  const refresh=async()=>{try{if(!document.hidden){const data=await api('/api/ai/integrations/vision-monitor',undefined,controller.signal);if(alive){setState(data);setError('');}}}catch(e){if(alive)setError(e.message);}finally{if(alive)timer=setTimeout(refresh,2500);}};
  refresh();return()=>{alive=false;clearTimeout(timer);controller.abort();};
 },[]);
 const latest=(state?.records||[]).find(r=>(r.stageIndex??2)===stageIndex),shown=record||latest;
 return <section className="vision-shared-results"><header><h3>四机位联合检测</h3><span>{record?'正在查看选定记录':error||state?.error?'同步异常':state?.enabled?'自动同步最新结果':'视觉服务未启用'}</span><div>{record&&onLatest&&<button onClick={onLatest}>显示最新结果</button>}{shown&&onExport&&<button onClick={()=>onExport(shown)}>导出本次证据</button>}</div></header>{(error||state?.error)&&<p role="status">{error||state.error} · 保留上次结果</p>}<VisionResultBoard record={shown}/></section>;
}
