// Daily production increments; existing cumulative totals are never backfilled.
export function chinaDay(at=Date.now()){return new Date(at+8*3600000).toISOString().slice(0,10);}
export function dailyRecord(db,at=Date.now()){
 const day=chinaDay(at),key=db.dataMode+':'+day;db.dailyMetrics??={};
 return db.dailyMetrics[key]??=( {day,mode:db.dataMode,startedAt:new Date(at).toISOString(),produced:0,hourly:Array(24).fill(null),completedTasks:[]} );
}
export function recordProduction(db,count,at=Date.now()){
 const d=dailyRecord(db,at);if(db.dataMode!=='simulation')return d;
 const hour=new Date(at+8*3600000).getUTCHours();d.hourly[hour]=(d.hourly[hour]??0)+count;d.produced+=count;return d;
}
