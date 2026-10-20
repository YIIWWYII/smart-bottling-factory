import {DatabaseSync} from 'node:sqlite';
import {loadEnv} from 'vite';
import {openDatabase} from './database.mjs';
const target=await openDatabase(loadEnv('development',process.cwd(),''));
if(!target.read()){
 const old=new DatabaseSync('.local-factory.sqlite',{readOnly:true});
 const row=old.prepare('SELECT json FROM runtime_state WHERE id=1').get();
 const tasks=old.prepare('SELECT json FROM production_tasks').all().map(x=>JSON.parse(x.json));
 const events=old.prepare('SELECT json FROM event_logs').all().map(x=>JSON.parse(x.json));
 target.commit(JSON.parse(row.json),events,tasks);await target.flush();old.close();console.log(JSON.stringify({migratedTasks:tasks.length,migratedLogs:events.length}));
}else console.log('Target already contains data; migration skipped.');
await target.close();
