import fs from 'node:fs';
import path from 'node:path';

export function createAlarmNotifications({file,analyze}){
 let rows=[];
 if(file&&fs.existsSync(file))rows=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const row of rows)if(row.status==='analyzing')row.status='pending';
 let working=false,closed=false;
 const save=()=>{if(!file)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(rows));fs.renameSync(file+'.tmp',file);};
 async function drain(){
  if(working||closed)return;working=true;
  try{for(let row;!closed&&(row=rows.find(r=>r.status==='pending'));){
   row.status='analyzing';save();
   try{const result=await analyze(row);if(!result?.answer||result.goalStatus!=='completed')throw Error(result?.answer||'智能体未完成分析');row.answer=result.answer;row.trace=result.trace;row.status='completed';}
   catch(e){row.status='failed';row.error=e.message;}
   row.finishedAt=new Date().toISOString();save();
  }}finally{working=false;}
 }
 return {
  observe(alerts,mode){
   const previous=JSON.stringify(rows);
   const active=alerts.filter(a=>!a.done&&!a.resolvedAt);
   for(const row of rows)if(row.mode===mode&&!row.resolvedAt&&!active.some(a=>String(a.id)===row.alarmId))row.resolvedAt=new Date().toISOString();
   for(const a of active){const id=JSON.stringify([mode,a.id,a.createdAt||a.time||'']);if(rows.some(r=>r.id===id))continue;
    rows.push({id,alarmId:String(a.id),mode,alarm:{id:a.id,title:a.title,detail:a.detail,stageIndex:a.stageIndex,severity:a.severity,value:a.value,unit:a.unit,threshold:a.threshold,time:a.time},status:'pending',createdAt:new Date().toISOString()});
   }
   if(JSON.stringify(rows)!==previous)save();void drain();
  },
  list:mode=>rows.filter(r=>r.mode===mode).slice(-100).reverse(),
  retry(id){const row=rows.find(r=>r.id===id);if(row?.status==='failed'){row.status='pending';row.error='';save();void drain();}},
  close(){closed=true;}
 };
}
