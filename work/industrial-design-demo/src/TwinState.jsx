import { createContext,useContext,useEffect,useState,useCallback,useRef } from 'react';
import { stages } from './data';
import {retainSnapshot} from './retainSnapshot';
const Context=createContext(null);
export async function api(path,body,signal){const r=await fetch(path,{signal,...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json','X-Client-Page':location.hash.slice(1)},body:JSON.stringify(body)}:{})});const j=await r.json();if(!r.ok)throw Error(j.error||'操作失败');return j;}
export function recordEvent(type,detail,stageIndex){return api('/api/ops/events',{type,detail,...(stageIndex!==undefined?{stageIndex}:{})}).catch(e=>console.error('日志写入失败',e.message));}
export function TwinProvider({children}){
 const [state,setState]=useState({states:stages.map(s=>({mode:'stopped',value:s.value,rate:0,target:s.target,history:Array(16).fill(s.value)})),updated:Date.now(),tick:0,produced:8426,bottles:3574,liquid:1787,completed:0});
 const [ops,setOps]=useState(null),[error,setError]=useState('');
 const pendingRefresh=useRef(null);
 const refresh=useCallback(()=>{
  if(pendingRefresh.current)return pendingRefresh.current;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  pendingRefresh.current=(async()=>{try{const [s,o]=await Promise.all([api('/api/ops/state',undefined,controller.signal),api('/api/ops/context',undefined,controller.signal)]);setState(s);setOps(previous=>({...o,assets:retainSnapshot(previous?.assets,o.assets),controls:retainSnapshot(previous?.controls,o.controls)}));setError('');}catch(e){setError(e.name==='AbortError'?'连接超时，请检查服务器地址和网络。':e.message);}finally{clearTimeout(timeout);pendingRefresh.current=null;}})();
  return pendingRefresh.current;
 },[]);
 useEffect(()=>{const refreshVisible=()=>{if(!document.hidden)refresh();};refresh();const t=setInterval(refreshVisible,2000);document.addEventListener('visibilitychange',refreshVisible);return()=>{clearInterval(t);document.removeEventListener('visibilitychange',refreshVisible);};},[refresh]);
 const mutate=async(path,body)=>{const r=await api(path,body);await refresh();return r;};
 const setMode=async(index,mode)=>{try{await mutate('/api/ops/mode',{index,mode});return true;}catch(e){setError(e.message);return false;}};
 return <Context.Provider value={{...state,productName:ops?.documents.find(d=>d.productCode===state.activeProduct&&d.status==='published')?.productName||'当前产品',volume:ops?.controls['FIL-HEAD-01:fillVolume']||500,ops,refresh,mutate,setMode,error}}>{children}{error&&<div className="hub-connection" role="alert">{error}<button onClick={()=>setError('')}>关闭</button></div>}</Context.Provider>;
}
export function useTwin(){return useContext(Context);}
