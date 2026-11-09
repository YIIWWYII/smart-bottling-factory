import {useEffect,useState} from 'react';
import {api} from './TwinState';
const labels={communication:'通信',protocol:'协议'};
export default function MG400ConfigFiles({canConfigure,connected=false,robotStatus=null,onSaved,scope='connection'}){
 const trajectoryMode=scope==='trajectory';
 const [files,setFiles]=useState([]),[key,setKey]=useState(trajectoryMode?'trajectories':'communication'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[projectName,setProjectName]=useState(''),[displayName,setDisplayName]=useState(''),[projectFiles,setProjectFiles]=useState([]);
 useEffect(()=>{
  if(!canConfigure)return;let active=true;
  api('/api/ops/mg400/files').then(data=>{if(active){setFiles(data.files);onSaved(data.config);}}).catch(error=>{if(active)setMessage(error.message);});
  return()=>{active=false;};
 },[canConfigure]);
 const file=files.find(f=>f.key===key);
 const presets=trajectoryMode&&file?(JSON.parse(file.content).controller?.presets||[]):[];
 const feedback=robotStatus?.feedback,execution=robotStatus?.execution?.state;
 const executionSettled=!execution||['已停止（反馈空闲）','运行结束（未核验取放结果）','报警中断','启动被拒绝'].includes(execution);
 const trajectoryReady=Boolean(connected&&robotStatus?.online&&Number(feedback?.enable_status)===1&&Number(feedback?.robot_mode)===5&&executionSettled);
 const projectBlocked=!!robotStatus?.externalControl||(connected&&!trajectoryReady);
 const uploadDisabled=busy||(trajectoryMode?projectBlocked:connected);
 const openFolder=async projectName=>{setBusy(true);setMessage('');try{
  const data=await api('/api/ops/mg400/open-folder',{key,...(typeof projectName==='string'?{projectName}:{})});setMessage(data.message||'已打开文件夹');
 }catch(error){setMessage(error.message);}finally{setBusy(false);}};
 const upload=async event=>{
  const selected=event.target.files?.[0];event.target.value='';if(!selected)return;
  if(!selected.name.toLowerCase().endsWith('.json')||selected.size>100000){setMessage('请选择100 KB以内的JSON配置文件');return;}
  setBusy(true);setMessage('');try{const content=await selected.text();JSON.parse(content);const result=await api('/api/ops/mg400/files',{key,content,expected:file.content});setFiles(result.files);onSaved(result.config);setMessage(result.message);}catch(error){setMessage(error.message);}finally{setBusy(false);}
 };
 const chooseProject=event=>{
  const selected=Array.from(event.target.files||[]);setProjectFiles(selected);setMessage('');
  if(selected.length){const folder=selected[0].webkitRelativePath.split('/')[0];setProjectName(folder);setDisplayName(folder);}
 };
 const importProject=async event=>{
  event.preventDefault();setBusy(true);setMessage('');
  try{
   if(!projectFiles.length)throw Error('请先选择包含 prj.json 的工程文件夹');
   if(projectFiles.length>100||projectFiles.reduce((sum,f)=>sum+f.size,0)>2*1024*1024)throw Error('最多100个文件，总大小不能超过2 MB');
   const files=await Promise.all(projectFiles.map(async f=>{const bytes=new Uint8Array(await f.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {path:f.webkitRelativePath.split('/').slice(1).join('/'),data:btoa(binary)};}));
   const result=await api('/api/ops/mg400/projects',{projectName,name:displayName,files,expected:file.content});
   setFiles(result.files);onSaved(result.config);setProjectFiles([]);setMessage(result.message);
  }catch(error){setMessage(error.message);}finally{setBusy(false);}
 };
 if(!canConfigure)return <p>仅管理员和工艺工程师可打开机械臂配置。</p>;
 if(trajectoryMode)return <section className="mg400-file-editor mg400-trajectory-editor">
  <header><h4>轨迹工程管理</h4><span>{connected?(trajectoryReady?'已上使能 · 空闲':'等待停止并确认空闲'):'未连接实机'}</span></header>
  <p>选择从 DobotStudio 导出的完整工程文件夹，根目录应包含 prj.json、Lua 程序和示教点。平台保存副本并登记工程名，控制器中的工程需另行通过 DobotStudio 导入。</p>
  <form onSubmit={importProject}>
   <label className="mg400-upload">选择工程文件夹<input type="file" aria-label="选择轨迹工程文件夹" webkitdirectory="" directory="" multiple disabled={uploadDisabled||!file} onChange={chooseProject}/></label>
   <div className="mg400-fields"><label>显示名称<input value={displayName} maxLength={100} required disabled={uploadDisabled} onChange={e=>setDisplayName(e.target.value)}/></label><label>控制器工程名<input value={projectName} maxLength={80} pattern="[A-Za-z][A-Za-z0-9_.-]{0,79}" required disabled={uploadDisabled} onChange={e=>setProjectName(e.target.value)}/></label></div>
   <p>工程名必须与控制器里保存的名称一致。保存目录：<code>config/mg400-projects/{projectName||'工程名'}/</code>，相对于平台项目目录。</p>
   {projectFiles.length>0&&<p>已选择 {projectFiles.length} 个文件，共 {(projectFiles.reduce((sum,f)=>sum+f.size,0)/1024).toFixed(1)} KB。</p>}
   <button type="submit" disabled={uploadDisabled||!file||!projectFiles.length}>{busy?'正在保存…':'添加轨迹工程'}</button>
  </form>
  <h4>已登记工程</h4>
  <ul className="mg400-preset-list">{presets.map(preset=><li key={preset.projectName}><div><strong>{preset.name}</strong><p>控制器工程名：{preset.projectName}</p><code>config/{preset.packagePath}/</code></div><button type="button" disabled={busy} onClick={()=>openFolder(preset.projectName)}>打开工程文件夹</button></li>)}</ul>
  {projectBlocked&&<p role="status">{robotStatus?.externalControl?'请先停止外部测试或手动动作。':'请停止工程并确认机械臂已上使能、反馈空闲后再添加；无需断电。'}</p>}
  {message&&<p role="status">{message}</p>}
 </section>;
 return <section className="mg400-file-editor">
  <nav aria-label="机械臂配置分类">{Object.entries(labels).map(([id,label])=><button key={id} aria-pressed={key===id} onClick={()=>setKey(id)}>{label}</button>)}</nav>
  {file&&<><p>当前文件：<strong>{file.name}</strong>。上传 JSON 会替换当前{labels[key]}配置。</p><code className="mg400-file-path">config/{file.name}</code><div className="mg400-actions"><label className="mg400-upload">上传 JSON 配置<input type="file" accept=".json,application/json" disabled={uploadDisabled} onChange={upload}/></label><button type="button" disabled={busy} onClick={()=>openFolder()}>{busy?'正在打开…':'打开配置文件夹'}</button></div></>}
  {connected&&<p>修改通信和协议前需先断开平台通信。</p>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
