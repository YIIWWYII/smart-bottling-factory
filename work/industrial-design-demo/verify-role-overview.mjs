import assert from 'node:assert/strict';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import {loadEnv} from 'vite';
import {createOperations} from './operations-server.mjs';
// Isolated schema; no live project tasks or telemetry are modified.
const setup=fs.readFileSync('../../.runtime/scripts/setup-mysql.ps1','utf8');
const env={...loadEnv('development',process.cwd(),''),MYSQL_USER:'root',MYSQL_PASSWORD:setup.match(/'-p([^']+)'/)[1],MYSQL_DATABASE:'bottleworks_role_verify_'+Date.now(),TELEMETRY_TOKEN:'isolated-test-token'};
const root=await mysql.createConnection({host:env.MYSQL_HOST,port:Number(env.MYSQL_PORT),user:env.MYSQL_USER,password:env.MYSQL_PASSWORD});
await root.query('CREATE DATABASE ?? CHARACTER SET utf8mb4',[env.MYSQL_DATABASE]);
let ops;
const res={setHeader(){}};
const call=(path,body,headers={})=>ops.route({url:'/api/ops/'+path,method:body===undefined?'GET':'POST',headers},res,body||{});
try{
 ops=await createOperations(env);
 await call('data-mode',{mode:'simulation'});
 await call('auto',{enabled:false,minConfidence:.95});
 const decision=await call('recognize',{productCode:'LIME-500',confidence:.99});
 assert.equal(decision.status,'ready');
 const ready=await call('logs?stage=4&strictStage=1&category=ai');
 assert(ready.items.length>0);assert(ready.items.every(e=>e.stageIndex===4));
 assert.equal(ready.items[0].after.execution,'未下发参数');assert.deepEqual(ready.items[0].after.changes,[]);
 await call('auto',{enabled:true,minConfidence:.95});
 const applied=await call('recognize',{productCode:'SODA-350',confidence:.99});assert.equal(applied.status,'applied');
 const log=await call('logs?stage=4&strictStage=1&category=ai');assert.equal(log.items[0].after.decision.status,'applied');assert(log.items[0].after.changes.some(c=>c.parameter==='单瓶灌装量'&&c.after===350));
 await call('recognize',{productCode:'UNKNOWN',confidence:.4});const review=await call('logs?stage=8&strictStage=1&category=ai');assert.equal(review.items[0].after.execution,'已暂停，转人工');
 await call('recognize',{productCode:'LIME-500',confidence:.99,emergency:true});assert.equal((await call('logs?stage=8&strictStage=1&category=ai')).items[0].after.execution,'已触发暂停联锁');
 const start=ops.snapshot().daily.startedAt;await ops.tick();
 await ops.close();ops=await createOperations(env);assert.equal(ops.snapshot().daily.startedAt,start);
 assert((await call('logs?stage=4&strictStage=1&category=ai')).items.some(e=>e.after?.decision?.status==='applied'));
 await call('data-mode',{mode:'real'});assert.equal((await call('logs?stage=4&strictStage=1&category=ai')).total,0);
 console.log('PASS: AI proposal vs execution, per-station parameter changes, strict scope, mode isolation, MySQL restart persistence.');
}finally{if(ops)await ops.close();await root.query('DROP DATABASE ??',[env.MYSQL_DATABASE]);await root.end();}
