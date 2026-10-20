const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
export function productionReports(trace=[]){
 return trace.filter(t=>t.tool==='query_production'&&t.status==='success').flatMap(t=>{
  const d=t.result;if(!d||!Array.isArray(d.rows)||!/^\d{4}-\d{2}-\d{2}$/.test(d.from)||!/^\d{4}-\d{2}-\d{2}$/.test(d.to))return [];
  const start=Date.parse(d.from),end=Date.parse(d.to);if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>30*86400000)return [];
  const days=[];
  for(let time=start;time<=end;time+=86400000){
   const day=new Date(time).toISOString().slice(0,10),row=d.rows.find(r=>r.day===day);
   days.push({day,produced:number(row?.produced),hourly:Array.from({length:24},(_,i)=>number(row?.hourly?.[i])),startedAt:row?.startedAt});
  }
  const known=days.filter(d=>d.produced!==null);
  return [{from:d.from,to:d.to,mode:d.dataMode,at:t.at,days,total:known.length?known.reduce((n,d)=>n+d.produced,0):null,recorded:known.length,note:d.note}];
 });
}
