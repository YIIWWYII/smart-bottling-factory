import mysql from 'mysql2/promise';

// The operations queue commits each mutation before its HTTP acknowledgement.
export async function openDatabase(env=process.env){
 const pool=mysql.createPool({host:env.MYSQL_HOST||'127.0.0.1',port:Number(env.MYSQL_PORT||3307),user:env.MYSQL_USER||'bottleworks',password:env.MYSQL_PASSWORD,database:env.MYSQL_DATABASE||'bottleworks',charset:'utf8mb4',connectionLimit:4});
 try{
 await pool.query(`CREATE TABLE IF NOT EXISTS runtime_state(id INT PRIMARY KEY,json LONGTEXT NOT NULL)`);
 await pool.query(`CREATE TABLE IF NOT EXISTS production_tasks(id VARCHAR(100) PRIMARY KEY,status VARCHAR(40) NOT NULL,deleted TINYINT NOT NULL DEFAULT 0,updated VARCHAR(30) NOT NULL,json LONGTEXT NOT NULL)`);
 await pool.query(`CREATE TABLE IF NOT EXISTS event_logs(id VARCHAR(100) PRIMARY KEY,time VARCHAR(30) NOT NULL,category VARCHAR(40) NOT NULL,source VARCHAR(40) NOT NULL,actor VARCHAR(100) NOT NULL,result VARCHAR(40) NOT NULL,stage INT NULL,action VARCHAR(200) NOT NULL,detail TEXT NOT NULL,json LONGTEXT NOT NULL,INDEX logs_time(time),INDEX logs_stage_time(stage,time),INDEX logs_category_time(category,time))`);
 await pool.query('CREATE TABLE IF NOT EXISTS service_settings(id VARCHAR(60) PRIMARY KEY,json LONGTEXT NOT NULL)');
 const [runtime]=await pool.query('SELECT json FROM runtime_state WHERE id=1');
 const [rows]=await pool.query('SELECT json FROM production_tasks ORDER BY updated DESC,id');
 let pending=[];
 const commit=(state,events=[],tasks=[])=>{const {audit,tasks:ignored,...rest}=state;pending.push({state:JSON.stringify(rest),events:structuredClone(events),tasks:structuredClone(tasks)});};
 const flush=async()=>{if(!pending.length)return;const batch=pending;pending=[];const c=await pool.getConnection();try{await c.beginTransaction();for(const item of batch){if(item.remove){await c.execute('DELETE FROM production_tasks WHERE id=?',[item.remove]);continue;}await c.execute('INSERT INTO runtime_state VALUES(1,?) ON DUPLICATE KEY UPDATE json=VALUES(json)',[item.state]);for(const t of item.tasks)await c.execute('INSERT INTO production_tasks VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),deleted=VALUES(deleted),updated=VALUES(updated),json=VALUES(json)',[t.id,t.status,t.deletedAt?1:0,t.updatedAt,JSON.stringify(t)]);for(const e of item.events)await c.execute('INSERT IGNORE INTO event_logs VALUES(?,?,?,?,?,?,?,?,?,?)',[e.id,e.time,e.category||'system',e.source||'system',e.actor||'系统',e.result||'成功',e.stageIndex??null,e.action||'',e.detail||'',JSON.stringify(e)]);}await c.commit();}catch(e){await c.rollback();throw e;}finally{c.release();}};
 const logs=async(params=new URLSearchParams())=>{
  const where=[],args=[];
  if(params.get('business')==='1')where.push("category NOT IN ('interface','telemetry','access') AND action NOT IN ('查看任务','导出任务','服务启动','服务停止','显示设置变更','切换演示身份')");
  if(params.get('activity')==='1')where.push("category IN ('ai','alarm','control','task')");
  if(params.get('mode')){where.push("JSON_UNQUOTE(JSON_EXTRACT(json,'$.dataMode'))=?");args.push(params.get('mode'));}
  for(const name of ['category','source','result'])if(params.get(name)){where.push(`${name}=?`);args.push(params.get(name));}
  const origin=params.get('origin');
  if(origin==='ai')where.push("category='ai'");
  if(origin==='human')where.push("category<>'ai' AND JSON_UNQUOTE(JSON_EXTRACT(json,'$.actorId')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(json,'$.actorId'))<>'null'");
  if(origin==='system')where.push("category<>'ai' AND (JSON_UNQUOTE(JSON_EXTRACT(json,'$.actorId')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(json,'$.actorId'))='null')");
  const stage=params.get('stage');if(stage!==null&&stage!==''){const n=Number(stage);if(!Number.isInteger(n)||n<0||n>8)throw Object.assign(Error('工位筛选无效。'),{status:400});where.push(params.get('strictStage')==='1'?'stage=?':'(stage=? OR stage IS NULL)');args.push(n);}
  if(params.get('q')){where.push('(actor LIKE ? OR action LIKE ? OR detail LIKE ?)');const q='%'+params.get('q').slice(0,120).replace(/[\\%_]/g,'')+'%';args.push(q,q,q);}
  for(const [name,op]of [['from','>='],['to','<=']])if(params.get(name)){const d=new Date(params.get(name));if(!Number.isFinite(d.getTime()))throw Object.assign(Error('日期筛选无效。'),{status:400});where.push(`time${op}?`);args.push(d.toISOString());}
  const page=Math.max(1,Math.min(100000,Number.parseInt(params.get('page'))||1)),limit=Math.max(1,Math.min(100,Number.parseInt(params.get('limit'))||20)),filter=where.length?' WHERE '+where.join(' AND '):'';
  const [[{n}]]=await pool.query('SELECT COUNT(*) AS n FROM event_logs'+filter,args);
  const [items]=await pool.query('SELECT json FROM event_logs'+filter+' ORDER BY time DESC,id DESC LIMIT ? OFFSET ?',[...args,limit,(page-1)*limit]);
  return {items:items.map(r=>JSON.parse(r.json)),total:Number(n),page,limit};
 };
 const getAIConfig=async()=>{const [rows]=await pool.query("SELECT json FROM service_settings WHERE id='ai'");return rows[0]?JSON.parse(rows[0].json):null;};
 const setAIConfig=async c=>{await pool.execute("INSERT INTO service_settings VALUES('ai',?) ON DUPLICATE KEY UPDATE json=VALUES(json)",[JSON.stringify(c)]);};
 return {getAIConfig,setAIConfig,read:()=>runtime[0]?JSON.parse(runtime[0].json):null,tasks:()=>rows.map(r=>JSON.parse(r.json)),commit,flush,discard:()=>{pending=[];},removeTask:id=>pending.push({remove:id}),logs,close:()=>pool.end()};
 }catch(e){await pool.end();throw e;}
}
