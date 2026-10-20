import {useEffect,useState} from 'react';
import {visionCameras} from './visionCameras';
function Feed({camera,source,capture}){
 const [status,setStatus]=useState('loading');
 useEffect(()=>{setStatus('loading');const timer=setTimeout(()=>setStatus(s=>s==='loading'?'error':s),15000);return()=>clearTimeout(timer);},[source?.url,source?.type]);
 const missing=!source?.url||status==='error';
 return <article className="actual-camera"><strong>{camera.label}</strong>{!missing&&(source.type==='mjpeg'?<img crossOrigin={capture?'anonymous':undefined} src={source.url} alt={camera.label+'实际画面'} onLoad={()=>setStatus('ready')} onError={()=>setStatus('error')}/>:<video crossOrigin={capture?'anonymous':undefined} src={source.url} autoPlay muted playsInline controls onPlaying={()=>setStatus('ready')} onError={()=>setStatus('error')}/>)}{(missing||status==='loading')&&<div className="actual-camera-empty">{missing?'暂无实际画面':'正在连接实际画面…'}{source?.url&&status==='error'&&<small>地址无法播放或设备未连接</small>}</div>}</article>;
}
export default function ActualCameraFeeds({indices,sources,cameras=visionCameras,capture=false}){return <div className={'actual-camera-grid '+(indices.length===1?'single':'')}>{indices.map(i=><Feed capture={capture} key={cameras[i].id} camera={cameras[i]} source={sources.find(s=>s.id===cameras[i].id)}/>)}</div>;}
export function CameraSourceSettings({sources,save,allowed,cameras=visionCameras}){
 const [draft,setDraft]=useState(()=>cameras.map(c=>sources.find(s=>s.id===c.id)||{id:c.id,type:'video',url:''})),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <details className="camera-source-settings"><summary>实际摄像头接口</summary><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await save(draft);setError('已保存');}catch(e){setError(e.message);}finally{setBusy(false);}}}><p>填写 HTTP/HTTPS 视频或 MJPEG 网关地址。RTSP、需专用鉴权的摄像头请先由网关转换；留空显示暂无实际画面。</p><fieldset disabled={!allowed||busy}>{cameras.map((c,i)=><label key={c.id}><strong>{c.label}</strong><select aria-label={c.label+'格式'} value={draft[i].type} onChange={e=>setDraft(draft.map((d,j)=>j===i?{...d,type:e.target.value}:d))}><option value="video">浏览器视频</option><option value="mjpeg">MJPEG / 图片流</option></select><input aria-label={c.label+'地址'} type="url" placeholder="https://摄像头网关/画面" value={draft[i].url} onChange={e=>setDraft(draft.map((d,j)=>j===i?{...d,url:e.target.value}:d))}/></label>)}<button type="submit">{busy?'保存中…':'保存接口'}</button></fieldset><p role="status">{error||(!allowed?'仅管理员和工程师可修改接口':'')}</p></form></details>;
}
