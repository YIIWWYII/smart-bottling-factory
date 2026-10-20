import {useEffect,useState} from 'react';
import {api} from './TwinState';
const labels={communication:'① 通信',protocol:'② 协议与字段',acquisition:'③ 数据接收',trajectories:'④ 下发 · 轨迹',motion:'④ 下发 · 运行参数'};
export default function MG400ConfigFiles({canConfigure,onSaved}){
 const [files,setFiles]=useState([]),[key,setKey]=useState('communication'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  if(!canConfigure)return;
  let active=true;
  api('/api/ops/mg400/files').then(data=>{
   if(!active)return;
   if(data.error)throw Error(data.error);
   setFiles(data.files.map(({key,name})=>({key,name})));onSaved(data.config);
  }).catch(error=>{if(active)setMessage(error.message);});
  return()=>{active=false;};
 },[canConfigure]);
 const file=files.find(f=>f.key===key);
 const openFolder=async()=>{setBusy(true);setMessage('');try{
  const data=await api('/api/ops/mg400/open-folder',{key});if(data.error)throw Error(data.error);
  setMessage(data.message||'已请求打开配置文件夹，请查看资源管理器窗口');
 }catch(e){setMessage(e.message);}finally{setBusy(false);}};
 if(!canConfigure)return <p>仅管理员和工艺工程师可打开机械臂配置。</p>;
 return <section className="mg400-file-editor">
  <nav aria-label="机械臂配置分类">{Object.entries(labels).map(([id,label])=><button key={id} aria-pressed={key===id} onClick={()=>setKey(id)}>{label}</button>)}</nav>
  {file&&<div className="mg400-actions"><strong>{file.name}</strong><button type="button" disabled={busy} onClick={openFolder}>{busy?'正在打开…':'打开所在文件夹'}</button>{key==='trajectories'&&<a href={`${import.meta.env.BASE_URL}trajectory-planner.html`} target="_blank" rel="noreferrer">取放点位生成器</a>}</div>}
  {message&&<p role="alert">{message}</p>}
 </section>;
}
