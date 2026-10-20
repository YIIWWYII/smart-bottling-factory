// Demonstration material flow; a token represents an actual simulated bottle, not a timer-only animation.
export const bottleRoute=[0,1,2,4,5,6,7,8];
export const gasInspectionCapacity=4;
const number=(c,k,d)=>Number.isFinite(c?.[k])&&c[k]>0?c[k]:d;
export function createMaterialFlow(task){return {taskId:task.id,remaining:Math.max(0,task.plan-task.done),issued:0,completed:0,sequence:0,loader:null,stages:Array.from({length:9},()=>[]),stationDepartures:Array.from({length:9},()=>[]),elapsed:0,prep:0,prepDuration:20,running:false,stored:[],updated:Date.now()};}
function packDuration(c){return 60/number(c,'PK-ARM-01:pickRate',12);}
function duration(i,c){return ({0:number(c,'PT-WASH-01:washDuration',15)+number(c,'PT-AIR-01:airDuration',10)+4,1:number(c,'GAS-PUMP-01:sampleDuration',30)+number(c,'GAS-CHAMBER-01:settleTime',60)+4,2:8,4:Math.max(4,number(c,'FIL-HEAD-01:fillVolume',500)/number(c,'FIL-PUMP-01:flowRate',120))+4,5:6,6:packDuration(c),7:12/number(c,'AGV-01:speedLimit',.8),8:10})[i];}
export function advanceMaterialFlow(flow,{seconds=2,running=false,controls={},bottles=0,liquid=0,volume=.5,packSize=12,reserveStorage=()=>true,storeCarton=()=>true}={}){
 flow.running=running;flow.updated=Date.now();let admitted=0,completed=0;
 if(!running)return {admitted,completed};
 const pack=Math.max(1,Math.floor(packSize));flow.packSize=pack;
 // Upgrade already sealed legacy cartons; partial legacy cartons return to packing.
 for(const i of [7,8])for(const token of [...flow.stages[i]])if(token.packed&&token.packedCount==null){
  if(token.count===pack){token.packSize=pack;token.packedCount=token.count;}
  else {flow.stages[i].splice(flow.stages[i].indexOf(token),1);for(let n=0;n<token.count;n++)flow.stages[6].push({id:token.id+'-repack-'+n,count:1,packed:false,elapsed:0,duration:packDuration(controls)});}
 }
 // Small deterministic steps prevent skipping stations even when called with a larger delta.
 flow.stationDepartures??=Array.from({length:9},()=>[]);flow.elapsed??=0;
 for(let left=Math.max(0,seconds);left>1e-7;){const dt=Math.min(.1,left);left-=dt;flow.elapsed+=dt;flow.prep=Math.min(flow.prepDuration,flow.prep+dt);
  for(const i of [...bottleRoute].reverse()){
   const queue=flow.stages[i];if(!queue.length)continue;
   if(i===6&&queue[0].count===1&&!queue[0].packed){
    if(queue.length<pack)continue;
    const group=queue.splice(0,pack),count=group.reduce((n,t)=>n+t.count,0);
    queue.unshift({...group[0],count,packed:true,packSize:pack,packedCount:0,bottleIds:group.map(t=>t.id),elapsed:0,duration:pack*packDuration(controls)+4});
   }
   if(i===4&&flow.prep<flow.prepDuration)continue;
   for(const token of [...(i===1?queue:queue.slice(0,1))]){
    if(i===8&&!token.storageSlot){const slot=reserveStorage(token);if(!slot)continue;token.storageSlot=slot===true?'DEMO':slot;}
    token.elapsed=Math.min(token.duration,token.elapsed+dt);
    if(i===6&&token.packed)token.packedCount=Math.min(token.count,Math.floor(Math.max(0,token.elapsed-2+1e-6)/((token.duration-4)/token.count)));
    if(token.elapsed+1e-6<token.duration)continue;
    const next=bottleRoute[bottleRoute.indexOf(i)+1];
    if(next===undefined){if(!storeCarton(token))continue;flow.stored??=[];flow.stored.push({...token,storedAt:flow.elapsed});flow.stationDepartures[i].push({time:flow.elapsed,count:token.count});queue.splice(queue.indexOf(token),1);flow.completed+=token.count;completed+=token.count;continue;}
    const target=flow.stages[next],room=next===1?target.length<gasInspectionCapacity:next===6?target.length<pack&&!target.some(t=>t.packed):target.length===0;
    if(room){flow.stationDepartures[i].push({time:flow.elapsed,count:token.count});queue.splice(queue.indexOf(token),1);target.push({...token,elapsed:0,duration:duration(next,controls),packed:next>6});}
   }
  }
  if(flow.loader){flow.loader.elapsed=Math.min(8,flow.loader.elapsed+dt);if(flow.loader.elapsed>=8-1e-6&&!flow.stages[0].length){flow.stages[0].push({...flow.loader,elapsed:0,duration:duration(0,controls)});flow.loader=null;}}
  if(!flow.loader&&!flow.stages[0].length&&flow.stages[1].length<gasInspectionCapacity&&flow.issued<flow.remaining&&bottles-admitted>=1&&liquid-admitted*volume>=volume){flow.loader={id:flow.taskId+'-'+(++flow.sequence),count:1,elapsed:0,duration:8};flow.issued++;admitted++;}
 }
 for(const departures of flow.stationDepartures)while(departures.length&&departures[0].time<flow.elapsed-60)departures.shift();
 return {admitted,completed};
}
export function stationRate(flow,index){return flow?.running?(flow.stationDepartures?.[index]||[]).reduce((n,t)=>n+t.count,0):0;}
export function preprocessingPhase(flow,controls={},now=Date.now()){
 const token=flow?.stages?.[0]?.[0];if(!token)return 'waiting';
 const time=materialProgress(flow,token,now)*token.duration;
 return time<2?'arriving':time<2+number(controls,'PT-WASH-01:washDuration',15)?'rinse':time<token.duration-2?'air':'leaving';
}
export function materialStage(flow,index){
 if(!flow)return {phase:'unknown',label:'等待到料反馈',count:0,processing:false};
 if(index===3){const ready=flow.prep>=flow.prepDuration,processing=!ready&&flow.running;return {phase:ready?'ready':processing?'processing':'waiting',label:ready?'料液就绪':processing?'备液中':'备液待机',count:0,processing};}
 const items=flow.stages[index]||[],first=items[0],count=items.reduce((n,t)=>n+t.count,0);
 const detecting=index===1?items.filter(t=>t.elapsed<t.duration-1e-6):[];
 const active=index===1?detecting[0]:first;
 const phase=!first?'waiting':index===8&&!first.storageSlot?'blocked':index===6&&!first.packed?'collecting':index===1&&active?'processing':first.elapsed>=first.duration-1e-6?'blocked':first.elapsed<2?'arriving':first.elapsed>first.duration-2?'leaving':'processing';
 const remaining=active&&index===1?` · ${detecting.length} 瓶检测中 / ${count} 瓶在位 · 最快剩余约 ${Math.ceil(Math.min(...detecting.map(t=>t.duration-t.elapsed)))} 秒`:'';
 return {phase,label:!flow.running&&first?'已暂停 · 物料保留':({waiting:'就绪 · 等待来料',collecting:'待装箱 · 尾箱未满不运输',blocked:index===8&&!first?.storageSlot?'库位不足 · 等待可用货位':index===1?`${count} 瓶待移交下游`:'等待下游接料',arriving:'物料到达',leaving:'移交下游',processing:index===6?`逐瓶装箱 · ${first?.packedCount||0} / ${first?.count||0} 瓶`:index===8?`货位 ${first?.storageSlot||'待分配'} · 移载入库`:index===1?'检测中'+remaining:'加工中'})[phase],count,processing:!!flow.running&&phase==='processing'};
}
// Interpolate only inside the current station; ownership changes remain server-authoritative.
export function materialProgress(flow,token,now=Date.now()){if(!token)return 0;const stage=flow?.stages?.findIndex(q=>q.includes(token));const canAdvance=stage===undefined||stage<0||!['collecting','blocked'].includes(materialStage(flow,stage).phase);const extra=flow?.running&&canAdvance?Math.min(2,Math.max(0,(now-flow.updated)/1000)):0;return Math.min(1,(token.elapsed+extra)/token.duration);}

export function materialTravel(flow,token,now=Date.now()){
 if(!token)return 0;
 const stage=flow?.stages?.findIndex(q=>q.includes(token));if(stage===6&&!token.packed)return .5;
 const progress=materialProgress(flow,token,now),time=progress*token.duration;
 // Arrive, hold at the processing point, then leave after processing finishes.
 return time<2?time/4:time>token.duration-2?.5+(time-(token.duration-2))/4:.5;
}
