import {useEffect,useState} from 'react';
import {api} from './TwinState';
import ConfigurationHelp from './ConfigurationHelp';
export default function VisionAssets({state,refresh,allowed}){
 const [selected,setSelected]=useState({models:[],programs:[]}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const key=JSON.stringify(state?.vision?.assets||{});
 useEffect(()=>{const a=state?.vision?.assets||{};setSelected({models:a.models||['yolo','patchcore'].filter(k=>a[k]).map(k=>({id:crypto.randomUUID(),name:k,packageId:a[k]})),programs:a.programs||(a.program?[{id:crypto.randomUUID(),name:'检测程序',packageId:a.program}]:[])});},[key]);
 const patch=(group,id,change)=>setSelected(s=>({...s,[group]:s[group].map(r=>r.id===id?{...r,...change}:r)}));
 const run=async fn=>{setBusy(true);try{await fn();await refresh();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const upload=async(group,row,file)=>{if(!file)return;await run(async()=>{
  if(file.size>24*1024*1024)throw Error('当前上传接口最多支持 24 MB；大文件请由检测程序部署后接入。');
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});
  const item=await api('/api/ai/integrations/package',{kind:'vision',slot:group==='models'?'model':'program',name:file.name,data});
  patch(group,row.id,{packageId:item.id});setMessage('文件已保存，请保存选择，再加载到检测程序。');
 });};
 return <section className="vision-pane"><div className="vision-section-heading"><h3>模型与程序</h3><ConfigurationHelp title="模型和程序接入"><p>按需要添加模型和程序，自定义名称并选择已有文件或上传新文件。先保存选择，再由已连接的检测服务加载验证。</p><p>上传不等于部署，平台不会直接执行上传的脚本。检测服务应支持所选模型格式与程序；单文件上传上限 24 MB。打开所在文件夹需在平台电脑使用。</p></ConfigurationHelp></div>
 {['models','programs'].map(group=><section key={group}><div className="vision-section-heading"><h4>{group==='models'?'模型':'程序'}</h4><button disabled={busy||!allowed} onClick={()=>setSelected(s=>({...s,[group]:[...s[group],{id:crypto.randomUUID(),name:'',packageId:''}]}))}>{group==='models'?'添加模型':'添加程序'}</button></div>
 {!selected[group]?.length&&<p>尚未添加{group==='models'?'模型':'程序'}</p>}
 <div className="vision-asset-grid">{(selected[group]||[]).map(row=>{
 const items=(state?.packages||[]).filter(p=>p.kind==='vision'&&(group==='programs'?p.slot==='program':['model','yolo','patchcore'].includes(p.slot))),item=items.find(p=>p.id===row.packageId);
 return <article key={row.id}><label>名称<input value={row.name} disabled={busy||!allowed} placeholder={group==='models'?'填写模型名称':'填写程序名称'} onChange={e=>patch(group,row.id,{name:e.target.value})}/></label><label>文件<select disabled={busy||!allowed} value={row.packageId} onChange={e=>patch(group,row.id,{packageId:e.target.value})}><option value="">请选择文件</option>{items.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>上传文件<input type="file" disabled={busy||!allowed} onChange={e=>{upload(group,row,e.target.files[0]);e.target.value='';}}/></label><small>{item?(item.status==='loaded'?'服务已确认加载':'已上传，尚未加载'):'暂无文件'}</small><div className="service-actions"><button disabled={!item||busy||!allowed} onClick={()=>run(async()=>{await api('/api/ai/integrations/package-folder',{id:item.id});setMessage('已打开所在文件夹');})}>打开所在文件夹</button><button disabled={!item||busy||!allowed||!state?.vision?.baseUrl} onClick={()=>run(async()=>{await api('/api/ai/integrations/activate',{id:item.id});setMessage('检测服务已确认加载');})}>加载并验证</button><button disabled={busy||!allowed} onClick={()=>setSelected(s=>({...s,[group]:s[group].filter(r=>r.id!==row.id)}))}>移除此项</button></div></article>;
 })}</div></section>)}<button className="primary" disabled={busy||!allowed} onClick={()=>run(async()=>{await api('/api/ai/integrations/vision-assets',selected);setMessage('模型和程序选择已保存');})}>保存选择</button><p role="status">{message}</p></section>;
}
