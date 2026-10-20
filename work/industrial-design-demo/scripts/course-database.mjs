// Portable logical backup for the course. Existing databases are never replaced.
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import {loadEnv} from 'vite';
const [mode,file]=process.argv.slice(2),env=loadEnv('development',process.cwd(),'');
if(!['export','import'].includes(mode)||!file)throw Error('Usage: node scripts/course-database.mjs export|import file.json');
const db=await mysql.createConnection({host:env.MYSQL_HOST||'127.0.0.1',port:Number(env.MYSQL_PORT||3307),user:env.MYSQL_USER||'bottleworks',password:env.MYSQL_PASSWORD,database:env.MYSQL_DATABASE||'bottleworks',charset:'utf8mb4'});
const names=['runtime_state','production_tasks','event_logs'];
try{
 if(mode==='export'){
  await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');const data=[];
  for(const name of names){const [[schema]]=await db.query(`SHOW CREATE TABLE \`${name}\``);const [rows]=await db.query(`SELECT * FROM \`${name}\``);data.push({name,schema:schema['Create Table'],rows});}
  await db.commit();fs.writeFileSync(file,JSON.stringify(data));console.log('Exported platform state, tasks and logs; model API keys excluded.');
 }else{
  const [tables]=await db.query('SHOW TABLES');if(tables.length)throw Error('Database is not empty. Restore cancelled to preserve existing data.');
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const {name,schema,rows} of data){
   if(!names.includes(name))throw Error('Unknown table');await db.query(schema);
   if(!rows.length)continue;const columns=Object.keys(rows[0]);
   await db.beginTransaction();
   try{
    for(let i=0;i<rows.length;i+=100){
     const batch=rows.slice(i,i+100).map(row=>columns.map(k=>row[k]));
     await db.query(`INSERT INTO \`${name}\` (${columns.map(k=>'`'+k+'`').join(',')}) VALUES ?`,[batch]);
    }
    await db.commit();
   }catch(e){await db.rollback();throw e;}
  }
  console.log('Course platform database restored.');
 }
}finally{await db.end();}
