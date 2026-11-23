import {useState} from 'react';
import {visionCameras} from './visionCameras';
import {recognitionCameraId} from '../camera-sources.mjs';
function BrowserCameras({allowed,save,sources}){
 const [devices,setDevices]=useState([]),[selected,setSelected]=useState({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const discover=async()=>{setBusy(true);try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('请在摄像头所在电脑使用 localhost 打开平台，或使用 HTTPS 地址。');
  const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});stream.getTracks().forEach(t=>t.stop());
  const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'&&d.deviceId);
  setDevices(list);setSelected(Object.fromEntries([...visionCameras,{id:recognitionCameraId}].map(c=>[c.id,sources.find(s=>s.id===c.id&&s.type==='usb')?.url||''])));
  setMessage(list.length?'请选择各机位对应的摄像头。':'没有找到摄像头，请检查连接。');
 }catch(e){setMessage(e.message||'无法访问摄像头，请检查浏览器权限。');}finally{setBusy(false);}};
 const persist=async()=>{setBusy(true);try{
  const values=Object.values(selected).filter(Boolean);if(!values.length||new Set(values).size!==values.length)throw Error('请为机位选择不同的摄像头。');
  if(values.some(id=>!devices.some(d=>d.deviceId===id)))throw Error('摄像头列表已变化，请重新搜索。');
  const keepNetwork=c=>sources.find(source=>source.id===c.id&&source.type!=='usb');const items=visionCameras.map(c=>selected[c.id]?{id:c.id,type:'usb',url:selected[c.id]}:keepNetwork(c)||{id:c.id,type:'usb',url:''});const recognition=selected[recognitionCameraId]?{id:recognitionCameraId,type:'usb',url:selected[recognitionCameraId]}:keepNetwork({id:recognitionCameraId});items.push(recognition||{id:recognitionCameraId,type:'usb',url:''});await save(items);setMessage('四路检测相机和已分配的瓶型识别相机已保存。');
 }catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <section className="camera-source-settings"><h3>本机 USB 摄像头</h3><p>为四个检测机位和瓶型识别机位分配摄像头。</p><fieldset disabled={!allowed||busy}><button type="button" onClick={discover}>搜索本机摄像头</button>{devices.length>0&&<>{[...visionCameras,{id:recognitionCameraId,label:'瓶型识别相机（第五路）'}].map(c=><label key={c.id}>{c.label}<select value={selected[c.id]||''} onChange={e=>setSelected(s=>({...s,[c.id]:e.target.value}))}><option value="">未分配</option>{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||'摄像头 '+(i+1)}</option>)}</select></label>)}<button type="button" onClick={persist}>保存机位分配</button></>}</fieldset><p role="status">{message}</p></section>;
}
export default function CameraDiscovery({allowed,save,sources=[]}){
 return <BrowserCameras allowed={allowed} save={save} sources={sources}/>;
}
