import {inspectionCameras} from './visionCameras.js';
// Resolve viewer inputs without substituting local settings for device feedback.
export function visionFeed(twin, now=Date.now(),stageIndex=2) {
 const s=twin.states?.[stageIndex], protocol=twin.ops?.protocol, controls=twin.ops?.controls||{};
 const source=protocol?.enabled?'protocol':s?.source;
 const timeout=(twin.ops?.connectionStates?.find(c=>c.stageIndex===stageIndex)?.timeoutSeconds||10)*1000;
 const fresh=(time,limit)=>Number.isFinite(time)&&now>=time&&now-time<limit;
 const online=!!s&&s.quality!=='offline'&&fresh(source==='simulation'?twin.updated:s.receivedAt,source==='real'?timeout:10000);
 const read=(id,key)=>{
  if(source==='protocol'){
   const d=protocol.devices?.find(d=>d.id===id);
   return d?.online&&fresh(d.receivedAt,10000)?d.points?.find(p=>p.name===key)?.value:undefined;
  }
  return source==='simulation'?controls[id+':'+key]:s?.measurements?.[id+':'+key];
 };
 const light=read(stageIndex===5?'SEC-LIGHT-01':'VIS-LIGHT-01','lightIntensity');
 const cameraIds=inspectionCameras(stageIndex).map(c=>c.id);
 return {source,online,rate:online&&['running','warning'].includes(s.mode)&&Number.isFinite(s.rate)?Math.max(0,s.rate):0,
  light:online&&typeof light==='number'&&Number.isFinite(light)?Math.max(0,Math.min(100,light)):null,
  cameras:cameraIds.map(id=>{const v=read(id,'cameraState');return !online?'offline':v==='PAUSED'||v===0?'paused':v==='RUNNING'||v===1?'running':'unknown';})};
}
