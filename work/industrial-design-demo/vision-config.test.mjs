import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVisionCameras,inspectCameraServices,visionCameraIds} from './vision-config.mjs';
const cameras=visionCameraIds.map((id,i)=>({id,baseUrl:i?'http://shared':'http://top',modelName:i?'side':'top',connection:'bottleworks-http'}));
const input={requestId:'one',bottleId:'b',batchId:'batch',images:visionCameraIds.map(cameraId=>({cameraId,data:'image'}))};

test('incomplete capture returns review before any service call',async()=>{
 let calls=0;
 const result=await inspectCameraServices({cameras},{...input,images:input.images.slice(0,3)},async()=>{calls++;});
 assert.equal(calls,0);assert.equal(result.verdict,'review');assert.equal(result.preflight.inferenceSkipped,true);
});
test('independent camera services receive assigned frames and combine actual results',async()=>{
 const calls=[];const result=await inspectCameraServices({cameras},input,async(url,route,token,body)=>{calls.push({url,body});return {...body,cameras:body.images.map(i=>({cameraId:i.cameraId,status:i.cameraId==='top'?'reject':'pass'})),demo:false};});
 assert.equal(calls.length,2);assert.equal(calls[0].body.images.length,1);assert.equal(calls[1].body.images.length,3);assert.equal(result.verdict,'reject');assert.equal(result.cameras.length,4);
});
test('missing camera never passes and wrong request is rejected',async()=>{
 const result=await inspectCameraServices({cameras},input,async()=>({...input,cameras:[]}));assert.equal(result.verdict,'review');
 await assert.rejects(inspectCameraServices({cameras},input,async()=>({...input,requestId:'wrong',cameras:[]})),/不同请求/);
 assert.throws(()=>normalizeVisionCameras(cameras.slice(1),'',x=>x),/四个/);
 assert.throws(()=>normalizeVisionCameras(cameras.map(c=>({...c,connection:'unknown'})),'',x=>x),/接口/);
});
