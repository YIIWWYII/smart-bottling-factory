import {useEffect,useState} from 'react';
import {api} from './TwinState';
const labels={communication:'通信',protocol:'协议'};
export default function MG400ConfigFiles({canConfigure,connected=false,robotStatus=null,onSaved,scope='connection'}){
 const trajectoryMode=scope==='trajectory';
 const [files,setFiles]=useState([]),[key,setKey]=useState(trajectoryMode?'trajectories':'communication'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
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
 const feedback=robotStatus?.feedback,execution=robotStatus?.execution?.state;
 const executionSettled=!execution||['已停止（反馈空闲）','运行结束（未核验取放结果）','报警中断'].includes(execution);
 const trajectoryReady=Boolean(connected&&robotStatus?.online&&Number(feedback?.enable_status)===1&&Number(feedback?.robot_mode)===5&&executionSettled);
 const uploadDisabled=busy||(trajectoryMode?!trajectoryReady:connected);
 const openFolder=async()=>{setBusy(true);setMessage('');try{
  const data=await api('/api/ops/mg400/open-folder',{key});if(data.error)throw Error(data.error);
  setMessage(data.message||'已请求打开配置文件夹，请查看资源管理器窗口');
 }catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const upload=async event=>{
  const selected=event.target.files?.[0];event.target.value='';if(!selected)return;
  if(!selected.name.toLowerCase().endsWith('.json')||selected.size>100000){setMessage('请选择 100 KB 以内的 JSON 文件');return;}
  setBusy(true);setMessage('');
  try{
   const content=await selected.text();JSON.parse(content);
   const result=await api(trajectoryMode?'/api/ops/mg400/trajectory':'/api/ops/mg400/files',{key,content,expected:file.content});
   setFiles(result.files);onSaved(result.config);setMessage(result.message||`${file.name} 已上传并校验。`);
  }catch(error){setMessage(`上传失败：${error.message}`);}finally{setBusy(false);}
 };
 if(!canConfigure)return <p>仅管理员和工艺工程师可打开机械臂配置。</p>;
 return <section className={'mg400-file-editor'+(trajectoryMode?' mg400-trajectory-editor':'')}>
  {trajectoryMode?<header><h4>替换轨迹配置</h4><span>{connected?(trajectoryReady?'已上使能 · 空闲':'等待停止并确认空闲'): '机械臂未连接'}</span></header>:<nav aria-label="机械臂配置分类">{Object.entries(labels).map(([id,label])=><button key={id} aria-pressed={key===id} onClick={()=>setKey(id)}>{label}</button>)}</nav>}
  {file&&<><p>当前文件：<strong>{file.name}</strong>。{trajectoryMode?'机械臂保持上电、通信和上使能；连接时须收到“已上使能 · 空闲”状态才能替换。更改轨迹点后，需将对应 Lua 工程导入控制器，运行时选择控制器内已存在的工程名。平台上传 JSON 不会把程序传到控制器。':key==='communication'?'现场 IP 和三个端口可先留空；平台照常启动，模拟模式可用。填写完整并上传后才能连接机械臂。':'上传 JSON 会替换当前配置文件。'}</p><div className="mg400-actions"><label className="mg400-upload">{trajectoryMode?'上传轨迹 JSON':'上传 JSON 配置'}<input type="file" accept=".json,application/json" disabled={uploadDisabled} onChange={upload}/></label><button type="button" disabled={busy} onClick={openFolder}>{busy?'正在打开…':'打开所在文件夹'}</button></div></>}
  {trajectoryMode&&!trajectoryReady&&<p role="status">{!connected?'请先连接控制器并读取新鲜状态。':!robotStatus?.online?'反馈不可用，暂不能替换。':'请先停止当前工程并确认机械臂已上使能且处于空闲状态；保持上电和通信连接。'}</p>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
