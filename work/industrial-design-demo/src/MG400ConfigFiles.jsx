import {useEffect,useState} from 'react';
import {api} from './TwinState';
const labels={communication:'① 通信',protocol:'② 协议与字段',acquisition:'③ 数据接收',trajectories:'④ 下发 · 轨迹',motion:'⑤ 下发 · 运行参数'};
export default function MG400ConfigFiles({canConfigure,connected,onSaved}){
 const [files,setFiles]=useState([]),[key,setKey]=useState('communication'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  if(!canConfigure)return;
  let active=true;
  api('/api/ops/mg400/files').then(data=>{
   if(!active)return;
   if(data.error)throw Error(data.error);
   setFiles(data.files);onSaved(data.config);
  }).catch(error=>{if(active)setMessage(error.message);});
  return()=>{active=false;};
 },[canConfigure]);
 const file=files.find(f=>f.key===key);
 const openFolder=async()=>{setBusy(true);setMessage('');try{
  const data=await api('/api/ops/mg400/open-folder',{key});if(data.error)throw Error(data.error);
  setMessage(data.message||'已请求打开配置文件夹，请查看资源管理器窗口');
 }catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const upload=async event=>{
  const selected=event.target.files?.[0];event.target.value='';if(!selected)return;
  if(!selected.name.toLowerCase().endsWith('.json')||selected.size>100000){setMessage('请选择 100 KB 以内的 JSON 配置文件');return;}
  setBusy(true);setMessage('');
  try{
   const content=await selected.text();JSON.parse(content);
   const result=await api('/api/ops/mg400/files',{key,content,expected:file.content});
   setFiles(result.files);onSaved(result.config);setMessage(`${file.name} 上传并校验成功。未向机械臂下发指令。`);
  }catch(error){setMessage(`上传失败：${error.message}`);}finally{setBusy(false);}
 };
 if(!canConfigure)return <p>仅管理员和工艺工程师可打开机械臂配置。</p>;
 return <section className="mg400-file-editor">
  <nav aria-label="机械臂配置分类">{Object.entries(labels).map(([id,label])=><button key={id} aria-pressed={key===id} onClick={()=>setKey(id)}>{label}</button>)}</nav>
  {file&&<><p>当前已加载：<strong>{file.name}</strong>。平台自带初始配置；上传用于替换当前文件，文件选择框不会回显已保存的文件。</p><div className="mg400-actions"><label className="mg400-upload">上传 JSON 配置文件<input type="file" accept=".json,application/json" disabled={busy||connected} onChange={upload}/></label><button type="button" disabled={busy} onClick={openFolder}>{busy?'正在打开…':'打开所在文件夹'}</button>{key==='trajectories'&&<a href={`${import.meta.env.BASE_URL}trajectory-planner.html`} target="_blank" rel="noreferrer">取放点位生成器</a>}</div></>}
  {connected&&<p>机械臂通信已连接。先断开通信，再上传配置文件。</p>}
  {message&&<p role="alert">{message}</p>}
 </section>;
}
