import ActualCameraFeeds from './ActualCameraFeeds';
import {animate} from 'animejs';
import {useEffect,useRef,useState} from 'react';
import {api} from './TwinState';
import './camera-feeds.css';
const labels={pass:'通过',review:'待复检',reject:'不合格',missing:'缺图',error:'检测异常',pending:'等待到位'};
const cameras=[['top','顶部'],['side-0','侧面 0°'],['side-120','侧面 120°'],['side-240','侧面 240°']];
const branches=[['original','原始画面'],['opencv','OpenCV 打码'],['yolo','YOLO 检测'],['patchcore','PatchCore 异常检测']];
function ResultImage({row,name,kind,title,previewCamera,actual=false}){
 const imageHost=useRef();
 const [failed,setFailed]=useState(false),url=kind==='original'?(row?.originalUrl||row?.alignedUrl||row?.imageUrl):kind==='opencv'?(row?.opencvUrl||row?.preprocessedUrl):kind==='yolo'?row?.overlayUrl:row?.heatmapUrl;
 useEffect(()=>setFailed(false),[url]);
 useEffect(()=>{if(!url||!row?.capturedAt||Date.now()-Date.parse(row.capturedAt)>5000||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const animation=animate(imageHost.current,{opacity:[.15,1],translateY:[5,0],duration:350,ease:'out(3)'});return()=>animation.revert();},[url,row?.capturedAt]);
 const status=row?.[kind+'Status']||row?.status;
 const caption=kind==='original'?(row?.capturedAt?new Date(row.capturedAt).toLocaleTimeString():'采集帧'):kind==='opencv'?(row?.codeMask?.status==='not-required'?'此机位无条码区域':'条码区域遮罩'):kind==='yolo'?(Array.isArray(row?.detections)?'检测框 '+row.detections.length+' 个':(row?.defects?.length?row.defects.join('、'):'缺陷位置与类别')):(Number.isFinite(row?.anomalyScore)?'异常分数 '+row.anomalyScore.toFixed(3):'外观异常热力分布');
 return <article className="vision-branch-camera" data-branch={kind} data-ready={!!url}><header><strong>{title}</strong><span>{url?(kind==='original'?'已采集':kind==='opencv'?'已处理':labels[status]||'已返回'):previewCamera&&kind==='original'?'实时预览':actual?'等待检测':'等待到位'}</span></header>
 <div className="vision-evidence-image" ref={imageHost}>{!url&&kind==='original'&&previewCamera?<ActualCameraFeeds capture suspended cameras={[previewCamera.camera]} indices={[0]} sources={previewCamera.sources}/>:url&&!failed?<a href={url} target="_blank" rel="noreferrer" title="查看原尺寸图像"><img src={url} alt={name+' '+title} onError={()=>setFailed(true)}/></a>:<p>{failed?'图片加载失败':row?.status==='missing'?'未收到本机位图像':row?.capturedAt?'等待处理结果':actual?'点击“开始检测”后生成结果':'等待瓶子到达本机位'}</p>}</div>
 {url&&<small>{caption}</small>}</article>;
}
export function VisionResultBoard({record,cameraIndices,actualCameras,sources}){
 const rows=cameras.filter((_,index)=>!cameraIndices||cameraIndices.includes(index)).map(([id,name])=>({id,name,index:cameras.findIndex(c=>c[0]===id),row:record?.cameras?.find(c=>c.cameraId===id)}));
 return <div className="vision-result-board">
 <div className="vision-result-meta"><span>瓶号 <strong>{record?.bottleId||'—'}</strong></span><span>批次 {record?.batchId||'—'}</span>{record?.caseName&&<span>{record.caseName}</span>}<span>{record?.createdAt||record?.timestamp?new Date(record.createdAt||record.timestamp).toLocaleString():'等待本次检测'}</span></div>
 {rows.map(({id,name,index,row})=><section className="vision-branch vision-camera-evidence" data-camera={id} key={id}><header><h3>{name}机位</h3><span>{row?.capturedAt?'采集时间 '+new Date(row.capturedAt).toLocaleTimeString():actualCameras?'尚未采集':'等待本瓶到位'}</span></header><div className="vision-branch-grid">{branches.map(([kind,title])=><ResultImage key={kind} name={name} row={row} kind={kind} title={title} actual={!!actualCameras} previewCamera={!record&&actualCameras?{camera:actualCameras[index],sources}:null}/>)}</div></section>)}
 <section className={'vision-joint-conclusion verdict-'+(record?.verdict||'waiting')} aria-live="polite"><header><h3>联合检测结论</h3><strong>{record?.status==='failed'?'检测失败':record?labels[record.verdict]||'检测未完成':'等待检测'}</strong></header><p>{record?.error||record?.reason||'四个机位检测完成后，显示整瓶判定及原因。'}</p>{record&&record.demoSource!=='preset-upload'&&<small>服务版本 {record.version||'未提供'} · 处理耗时 {Number.isFinite(record.durationMs)?record.durationMs+' ms':'未提供'}</small>}</section></div>;
}
export default function VisionInspectionResults({stageIndex=2,record=null,onLatest,onExport,onState,cameraIndices,source,actualCameras,sources}){
 const [state,setState]=useState(null),[error,setError]=useState(''),[historyId,setHistoryId]=useState('');
 useEffect(()=>{let alive=true,timer;const controller=new AbortController();
  const refresh=async()=>{try{if(!document.hidden){const data=await api('/api/ai/integrations/vision-monitor',undefined,controller.signal);if(alive){setState(data);onState?.(data);setError('');}}}catch(e){if(alive)setError(e.message);}finally{if(alive)timer=setTimeout(refresh,1000);}};
  refresh();return()=>{alive=false;clearTimeout(timer);controller.abort();};
 },[onState]);
 const records=(state?.records||[]).filter(r=>(r.stageIndex??2)===stageIndex&&(!source||(source==='rehearsal')===(r.demoSource==='preset-upload'))),latest=records[0],shown=record||(historyId?records.find(r=>r.requestId===historyId):latest)||latest;
 return <section className="vision-shared-results"><header><h3>采集与处理结果</h3><span>{record?'正在查看选定记录':error||state?.error?'同步异常':source!=='actual'&&state?.rehearsal?.active?'演示 · 按机位到位时间展示':state?.enabled?'自动同步最新结果':'视觉服务未启用'}</span><div>{state?.rehearsal?.active&&records.length>0&&<label>瓶号记录<select aria-label="查看瓶号记录" value={historyId} onChange={e=>setHistoryId(e.target.value)}><option value="">当前最新瓶子</option>{records.map(r=><option key={r.requestId} value={r.requestId}>{r.caseName} · {r.bottleId}</option>)}</select></label>}{record&&onLatest&&<button onClick={onLatest}>显示最新结果</button>}{shown&&onExport&&<button onClick={()=>onExport(shown)}>导出本次证据</button>}</div></header>{(error||state?.error)&&<p role="status">{error||state.error} · 保留上次结果</p>}<VisionResultBoard record={shown} cameraIndices={cameraIndices} actualCameras={actualCameras} sources={sources}/></section>;
}
