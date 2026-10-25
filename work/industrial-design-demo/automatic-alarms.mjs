// One server queue serves every browser. An occurrence is identified by its
// persisted alarm id and time, not by a fluctuating measurement.
export function createAutomaticAlarmAnalysis({initialEvents=[],analyze,onResult=async()=>{}}){
 const key=e=>`${e.id}|${e.time}`;
 const valid=e=>e?.ruleId&&e.id&&e.time&&!e.done;
 const seen=new Set(initialEvents.filter(valid).map(key));
 const records=[],queue=[];let running=false,enabled=false;
 function observe(events,isEnabled){
  enabled=!!isEnabled;
  const active=new Set(events.filter(valid).map(key));
  for(const row of records)row.eventEnded=!active.has(row.key);
  for(const event of events.filter(valid)){
   const id=key(event);if(seen.has(id))continue;seen.add(id);
   if(!enabled)continue;
   const row={key:id,event:structuredClone(event),status:'queued',createdAt:new Date().toISOString(),eventEnded:false,answer:'',trace:[]};
   records.unshift(row);queue.push(row);
  }
 }
 async function process(){
  if(running||!enabled||!queue.length)return;
  running=true;const row=queue.shift();row.status='running';
  try{
   const result=await analyze(row.event);
   if(!result||result.operation)throw Error('自动告警分析未返回只读结果。');
   const answer=typeof result.answer==='string'?result.answer.trim():'';
   row.status=result.goalStatus==='completed'&&answer?'completed':'incomplete';
   row.answer=answer||'本次未返回分析正文。';row.trace=result.trace||[];
   row.model=result.model;row.workflowRunId=result.workflowRunId;
  }catch(e){row.status='incomplete';row.answer=e.message||'告警分析服务连接失败。';}
  finally{row.completedAt=new Date().toISOString();running=false;}
  await onResult(row);
 }
 return {observe,process,list:()=>({enabled,records:structuredClone(records.slice(0,30))})};
}
