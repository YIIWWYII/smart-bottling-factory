import {useEffect,useState,useRef} from 'react';
import {visionCameras} from './visionCameras';
function Feed({camera,source,capture,hidden=false}){
 const host=useRef();
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{const media=host.current?.querySelector('img,video');return()=>{if(!media)return;if(media.tagName==='VIDEO')media.pause();media.removeAttribute('src');if(media.tagName==='VIDEO')media.load();};},[source?.url,source?.type,attempt]);
 const [status,setStatus]=useState('loading');
 useEffect(()=>{
  setStatus('loading');
  const started=Date.now();
  // MJPEG is a never-ending response: onLoad is not a reliable first-frame signal.
  const timer=setInterval(()=>{
   const media=host.current?.querySelector('img,video');
   if(media&&(media.naturalWidth>0||media.videoWidth>0)){setStatus('ready');clearInterval(timer);}
   else if(Date.now()-started>30000){setStatus('error');clearInterval(timer);}
  },250);
  return()=>clearInterval(timer);
 },[source?.url,source?.type,attempt]);
 useEffect(()=>{if(status!=='error'||!source?.url||attempt>=2)return;const timer=setTimeout(()=>{setStatus('loading');setAttempt(n=>n+1);},2000);return()=>clearTimeout(timer);},[status,source?.url,attempt]);
 const retry=()=>{setStatus('loading');setAttempt(n=>n+1);};
 const missing=!source?.url||status==='error';
 return <article hidden={hidden} ref={host} className="actual-camera" data-camera-id={camera.id}><strong>{camera.label}</strong>{!missing&&(source.type==='mjpeg'?<img key={source.url+':'+attempt} crossOrigin={capture?'anonymous':undefined} src={source.url} alt={camera.label+'实际画面'} onLoad={()=>setStatus('ready')} onError={()=>setStatus('error')}/>:<video key={source.url+':'+attempt} crossOrigin={capture?'anonymous':undefined} src={source.url} autoPlay muted playsInline controls onPlaying={()=>setStatus('ready')} onError={()=>setStatus('error')}/>)}{(missing||status==='loading')&&<div className="actual-camera-empty">{!source?.url?'未分配摄像头':status==='error'?'该机位连接失败':'正在连接实际画面…'}{source?.url&&status==='error'&&<><small>{attempt<2?'正在自动重新连接…':'请检查相机连接或是否被其他软件占用'}</small><button type="button" onClick={retry}>重新连接此机位</button></>}</div>}</article>;
}
export default function ActualCameraFeeds({indices,sources,cameras=visionCameras,capture=false,visibleIndices=indices}){return <div className={'actual-camera-grid '+(visibleIndices.length===1?'single':'')}>{indices.map(i=><Feed hidden={!visibleIndices.includes(i)} capture={capture} key={cameras[i].id+':' +(sources.find(s=>s.id===cameras[i].id)?.url||'')} camera={cameras[i]} source={sources.find(s=>s.id===cameras[i].id)}/>)}</div>;}
export function CameraSourceSettings({sources,save,allowed,cameras=visionCameras}){
 const [draft,setDraft]=useState(()=>cameras.map(c=>sources.find(s=>s.id===c.id)||{id:c.id,type:'video',url:''})),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const sourceKey=JSON.stringify(sources);
 useEffect(()=>{setDraft(cameras.map(c=>sources.find(s=>s.id===c.id)||{id:c.id,type:'video',url:''}));},[sourceKey]);
 return <details className="camera-source-settings"><summary>网络相机 / 手动填写地址</summary><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await save(draft);setError('已保存');}catch(e){setError(e.message);}finally{setBusy(false);}}}><p>填写 HTTP/HTTPS 视频或 MJPEG 网关地址。RTSP、需专用鉴权的摄像头请先由网关转换；留空显示暂无实际画面。</p><fieldset disabled={!allowed||busy}>{cameras.map((c,i)=><label key={c.id}><strong>{c.label}</strong><select aria-label={c.label+'格式'} value={draft[i].type} onChange={e=>setDraft(draft.map((d,j)=>j===i?{...d,type:e.target.value}:d))}><option value="video">浏览器视频</option><option value="mjpeg">MJPEG / 图片流</option></select><input aria-label={c.label+'地址'} type="url" placeholder="https://摄像头网关/画面" value={draft[i].url} onChange={e=>setDraft(draft.map((d,j)=>j===i?{...d,url:e.target.value}:d))}/></label>)}<button type="submit">{busy?'保存中…':'保存接口'}</button></fieldset><p role="status">{error||(!allowed?'仅管理员和工程师可修改接口':'')}</p></form></details>;
}

// Read the exact camera by device id, including when another view is selected.
export function cameraFrame(host,camera){
 const el=host?.querySelector('[data-camera-id="'+camera.id+'"] img,[data-camera-id="'+camera.id+'"] video');
 const width=el?.videoWidth||el?.naturalWidth,height=el?.videoHeight||el?.naturalHeight;
 if(!width||!height)return null;
 const canvas=document.createElement('canvas');canvas.width=Math.min(width,960);canvas.height=Math.round(height*canvas.width/width);
 try{const context=canvas.getContext('2d');context.translate(canvas.width,0);context.scale(-1,1);context.drawImage(el,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.85);}catch{throw Error(camera.label+'无法截帧，请检查摄像头跨域访问设置。');}
}
export function captureCameraFrames(host,cameras){
 const frames=[],missing=[];
 cameras.forEach((camera,index)=>{const data=cameraFrame(host,camera);if(data)frames.push({cameraId:['top','side-0','side-120','side-240'][index],data});else missing.push(camera.label);});
 if(missing.length)throw Error('以下机位尚未就绪：'+missing.join('、')+'。请先连接四路相机，再开始实际检测。');
 return frames;
}
