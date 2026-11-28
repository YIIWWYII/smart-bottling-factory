import {useEffect,useState} from 'react';
import {FolderOpen,Trash2} from 'lucide-react';
import {api} from './TwinState';
import {normalizeMG400ProjectName} from './mg400ProjectName.js';
const labels={communication:'通信',protocol:'协议'};
export default function MG400ConfigFiles({canConfigure,connected=false,robotStatus=null,onSaved,scope='connection'}){
 const trajectoryMode=scope==='trajectory';
 const [files,setFiles]=useState([]),[key,setKey]=useState(trajectoryMode?'trajectories':'communication'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[projectName,setProjectName]=useState(''),[displayName,setDisplayName]=useState(''),[projectFiles,setProjectFiles]=useState([]),[deleting,setDeleting]=useState(null);
 useEffect(()=>{
  if(!canConfigure)return;let active=true;
  api('/api/ops/mg400/files').then(data=>{if(active){setFiles(data.files);onSaved(data.config,data.files);}}).catch(error=>{if(active)setMessage(error.message);});
  return()=>{active=false;};
 },[canConfigure]);
 const file=files.find(f=>f.key===key);
 const [preserveName,setPreserveName]=useState(false);
 const savedProjectName=normalizeMG400ProjectName(projectName,preserveName);
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
  setBusy(true);setMessage('');try{const content=await selected.text();JSON.parse(content);const result=await api('/api/ops/mg400/files',{key,content,expected:file.content});setFiles(result.files);onSaved(result.config,result.files);setMessage(result.message);}catch(error){setMessage(error.message);}finally{setBusy(false);}
 };
 const chooseProject=event=>{
  const selected=Array.from(event.target.files||[]);setProjectFiles(selected);setPreserveName(false);setMessage('');
  if(selected.length){const folder=selected[0].webkitRelativePath.split('/')[0];setProjectName(folder);setDisplayName(folder);}
 };
 const importProject=async event=>{
  event.preventDefault();setBusy(true);setMessage('');
  try{
   if(!projectFiles.length)throw Error('请先选择包含 prj.json 的工程文件夹');
   if(projectFiles.length>100||projectFiles.reduce((sum,f)=>sum+f.size,0)>2*1024*1024)throw Error('最多100个文件，总大小不能超过2 MB');
   const files=await Promise.all(projectFiles.map(async f=>{const bytes=new Uint8Array(await f.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {path:f.webkitRelativePath.split('/').slice(1).join('/'),data:btoa(binary)};}));
   const result=await api('/api/ops/mg400/projects',{projectName,preserveName,name:displayName,files,expected:file.content});
   setFiles(result.files);onSaved(result.config,result.files);setProjectFiles([]);setMessage(result.message);
  }catch(error){setMessage(error.message);}finally{setBusy(false);}
 };
 const deleteProject=async preset=>{
  if(!file||uploadDisabled)return;
  setBusy(true);setMessage('');
  try{
   const result=await api('/api/ops/mg400/projects/delete',{projectName:preset.projectName,expected:file.content});
   setFiles(result.files);onSaved(result.config,result.files);setDeleting(null);setMessage(result.message);
  }catch(error){setMessage(error.message);}finally{setBusy(false);}
 };
 if(!canConfigure)return <p>仅管理员和工艺工程师可打开机械臂配置。</p>;
 if(trajectoryMode)return <section className="mg400-file-editor mg400-trajectory-editor">
  <header><h4>轨迹工程管理</h4><span>{connected?(trajectoryReady?'已上使能 · 空闲':'等待停止并确认空闲'):'未连接实机'}</span></header>
  <p>选择从 DobotStudio 导出的完整工程文件夹，根目录应包含 prj.json、Lua 程序和示教点。平台保存副本并登记工程名，控制器中的工程需另行通过 DobotStudio 导入。</p>
  <form onSubmit={importProject}>
   <label className="mg400-upload">选择工程文件夹<input type="file" aria-label="选择轨迹工程文件夹" webkitdirectory="" directory="" multiple disabled={uploadDisabled||!file} onChange={chooseProject}/></label>
   <div className="mg400-fields"><label>显示名称<input value={displayName} maxLength={100} required disabled={uploadDisabled} onChange={e=>setDisplayName(e.target.value)}/></label><label>控制器工程名<input value={projectName} maxLength={80} required disabled={uploadDisabled} onChange={e=>setProjectName(e.target.value)}/></label></div>
   <label><input type="checkbox" checked={preserveName} disabled={uploadDisabled} onChange={e=>setPreserveName(e.target.checked)}/> 保留原名（控制器已按原名登记）</label>
   <p>{savedProjectName?<>保存后的工程名：<code>{savedProjectName}</code>。请与控制器中的工程名保持一致。</>:'缺少 blockly_ 时会自动补齐。'}</p>
   {projectName&&!savedProjectName&&<p role="status" className="mg400-warn">工程名可用字母、数字、下划线、点或短横线，不能以点结尾；加前缀后最多80字。保留原名时须以字母开头。</p>}
   {projectFiles.length>0&&<p>已选择 {projectFiles.length} 个文件，共 {(projectFiles.reduce((sum,f)=>sum+f.size,0)/1024).toFixed(1)} KB。</p>}
   <button type="submit" disabled={uploadDisabled||!file||!projectFiles.length||!savedProjectName}>{busy?'正在保存…':'添加轨迹工程'}</button>
  </form>
  <h4>已登记工程</h4>
  {presets.length===0&&<p>{file?'暂无轨迹工程':'正在读取轨迹工程…'}</p>}
  <ul className="mg400-preset-list">{presets.map(preset=><li key={preset.projectName}>
   <div><strong>{preset.name}</strong>{robotStatus?.config?.project===preset.projectName&&<span className="mg400-current-preset">当前已选</span>}<p>控制器工程名：<code>{preset.projectName}</code></p></div>
   <div className="mg400-preset-actions">
    <button type="button" disabled={busy} title="打开工程文件夹" aria-label={`打开 ${preset.projectName} 工程文件夹`} onClick={()=>openFolder(preset.projectName)}><FolderOpen size={17}/></button>
    <button type="button" className="mg400-danger" disabled={uploadDisabled} title="删除轨迹工程" aria-label={`删除 ${preset.projectName}`} onClick={()=>{setDeleting(preset.projectName);setMessage('');}}><Trash2 size={17}/></button>
   </div>
   {deleting===preset.projectName&&<div className="mg400-delete-confirm"><p>删除 {preset.name} 的平台副本？控制器中的同名工程会保留。{robotStatus?.config?.project===preset.projectName?'删除后需重新选择运行工程。':''}</p><div className="mg400-preset-actions"><button type="button" disabled={busy} onClick={()=>setDeleting(null)}>取消</button><button type="button" className="mg400-danger" disabled={uploadDisabled} onClick={()=>deleteProject(preset)}>确认删除</button></div></div>}
  </li>)}</ul>
  {projectBlocked&&<p role="status">{robotStatus?.externalControl?'请先停止外部测试或手动动作。':'请停止工程并确认机械臂已上使能、反馈空闲后再管理轨迹；无需断电。'}</p>}
  {message&&<p role="status">{message}</p>}
 </section>;
 return <section className="mg400-file-editor">
  <nav aria-label="机械臂配置分类">{Object.entries(labels).map(([id,label])=><button key={id} aria-pressed={key===id} onClick={()=>setKey(id)}>{label}</button>)}</nav>
  {file&&<><p>当前文件：<strong>{file.name}</strong>。上传 JSON 会替换当前{labels[key]}配置。</p><code className="mg400-file-path">config/{file.name}</code><div className="mg400-actions"><label className="mg400-upload">上传 JSON 配置<input type="file" accept=".json,application/json" disabled={uploadDisabled} onChange={upload}/></label><button type="button" disabled={busy} onClick={()=>openFolder()}>{busy?'正在打开…':'打开配置文件夹'}</button></div></>}
  {connected&&<p>修改通信和协议前需先断开平台通信。</p>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
