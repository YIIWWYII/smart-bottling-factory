// Uses the real HTTP inference service and real platform route, with isolated test storage.
// Four unrelated images exercise transport only, not a physical same-bottle acceptance test.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createIntegrations,cameraIds} from '../platform-integrations.mjs';
const root='F:/BottleAI/vision';
const manifest=JSON.parse(await fs.readFile(root+'/datasets/confirmed-normal.json','utf8'));
const files=[0,1,2,3].map(i=>manifest.files[i]);
let config={integrations:{vision:{enabled:true,baseUrl:'http://127.0.0.1:8095',version:'experimental'},records:[],packages:[],commands:[]}};
const logs=[];
const ops={getAIConfig:async()=>structuredClone(config),setAIConfig:async c=>{config=structuredClone(c);},
 actor:()=>({id:'integration-test',role:'admin'}),requireRole:()=>{},log:async(...args)=>logs.push(args)};
const integration=createIntegrations(ops);
const req={url:'/api/ai/integrations/inspect',method:'POST',headers:{}};
const images=await Promise.all(files.map(async(f,i)=>({cameraId:cameraIds[i],data:'data:image/jpeg;base64,'+(await fs.readFile(f)).toString('base64')})));
const body={requestId:'transport-'+Date.now(),bottleId:'TRANSPORT-ONLY-NOT-SAME-BOTTLE',batchId:'ISOLATED-TEST',images};
const result=await integration.route(req,body);
assert.equal(result.status,'completed');assert.notEqual(result.verdict,'pass');
assert.equal(config.integrations.records[0].requestId,body.requestId);
assert.equal(logs.length,1);
const missing=await integration.route(req,{...body,requestId:body.requestId+'-missing',images:images.slice(0,1)});
assert.equal(missing.verdict,'review');
await fs.writeFile(root+'/verification/platform-joint-record.json',JSON.stringify({scope:'Real service and route; isolated storage; input views are unrelated transport fixtures',result,missing},null,2));
console.log('PASS: real HTTP -> platform validation -> isolated record -> log; missing views skipped');
