import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisionRehearsal,rehearsalDefaults,validateRehearsal} from './vision-rehearsal.mjs';
const config=()=>({...rehearsalDefaults(),enabled:true,revision:1,stageIndices:[2,5]});
function snapshot(id='batch-1-1',stage=2,elapsed=0,running=true){const stages=Array.from({length:9},()=>[]);if(id)stages[stage]=[{id,elapsed,duration:8}];return {dataMode:'simulation',states:Array.from({length:9},()=>({source:'simulation'})),materialFlow:{taskId:'batch-1',stages,running,updated:1000,simulatedStages:Array(9).fill(true)}};}
const arrive=(e,c,id,stage=2)=>{e.observe(c,snapshot(id,stage,0),1000);return e.observe(c,snapshot(id,stage,7),1000);};
test('each camera arrival reveals original and three results together; no images before arrival',()=>{
 const e=createVisionRehearsal(),c=config();let r=e.observe(c,snapshot('one'),1000).records[0];assert.equal(r.capturedCount,0);assert.equal(r.verdict,'pending');
 r=e.observe(c,snapshot('one',2,1.99),1000).records[0];assert.equal(r.capturedCount,0);
 for(const [time,count] of [[2,1],[2.8,2],[3.6,3],[4.4,4]]){
  const now=1000+time*1000,s=snapshot('one',2,time);s.materialFlow.updated=now;r=e.observe(c,s,now).records[0];assert.equal(r.capturedCount,count);
  r.cameras.forEach((row,i)=>{for(const key of ['imageUrl','originalUrl','opencvUrl','overlayUrl','heatmapUrl'])assert.equal(!!row[key],i<count);});
 }
 assert.notEqual(r.cameras[0].imageUrl,r.cameras[0].opencvUrl);assert.equal(r.verdict,'pass');assert.equal(new Set(r.cameras.map(row=>row.capturedAt)).size,4);assert.ok(r.demo);assert.ok(!('anomalyScore' in r.cameras[0]));assert.ok(r.createdAt);
});
test('normal is the default; selected defect persists and stays consistent across stages',()=>{
 const e=createVisionRehearsal(),c=config();arrive(e,c,'one');e.selectSample(2,'defect');let r=arrive(e,c,'two');assert.equal(r.records[0].caseId,'defect');assert.equal(r.records[0].verdict,'reject');assert.equal(r.records[1].caseId,'normal');
 r=arrive(e,c,'two',5);assert.equal(r.records[0].caseId,'defect');assert.equal(r.records[0].stageIndex,5);
 e.selectSample(2,'normal');r=arrive(e,c,'three');assert.equal(r.records[0].caseId,'normal');assert.equal(new Set(r.records.map(x=>x.requestId)).size,4);
 e.reset();assert.equal(arrive(e,c,'two').records[0].caseId,'normal');
});
test('pause freezes acquisition; real and protocol modes never use preset results',()=>{
 const c=config(),e=createVisionRehearsal();e.observe(c,snapshot('x'),1000);let r=e.observe(c,snapshot('x',2,2,false),5000).records[0];assert.equal(r.capturedCount,1);const at=r.cameras[0].capturedAt;
 r=e.observe(c,snapshot('x',2,2,false),8000).records[0];assert.equal(r.cameras[0].capturedAt,at);assert.equal(r.capturedCount,1);
 assert.equal(e.observe(c,{...snapshot(),dataMode:'real'},1000).active,false);assert.equal(e.observe(c,{...snapshot(),protocol:{enabled:true}},1000).active,false);
 const mixed=snapshot();mixed.dataMode='mixed';mixed.states[2].source='real';assert.deepEqual(e.observe(c,mixed,1000).stageIndices,[5]);
});
test('new task resets sequence; completed records survive task completion',()=>{
 const e=createVisionRehearsal(),c=config();arrive(e,c,'one');arrive(e,c,'two');const s=snapshot('next');s.materialFlow.taskId='batch-2';assert.equal(e.observe(c,s,1000).records[0].caseId,'normal');
 s.materialFlow.stages[2][0].elapsed=7;e.observe(c,s,1000);
 const idle={dataMode:'simulation',states:Array.from({length:9},()=>({source:'simulation'})),materialFlow:null};const state=e.observe(c,idle,5000);assert.equal(state.records.length,1);assert.equal(state.records[0].verdict,'pass');assert.equal(e.observe({...c,enabled:false},s,1000).active,false);
});
test('saving replacement images keeps current bottle unchanged and applies to the next arrival',()=>{
 const e=createVisionRehearsal(),c=config();e.observe(c,snapshot('one'),1000);
 const changed=structuredClone(c);changed.revision++;for(const sample of changed.cases)sample.cameras[0].images.opencv='/uploads/vision-demo/replacement.webp';
 let r=e.observe(changed,snapshot('one',2,2),1000).records[0];assert.equal(r.cameras[0].opencvUrl,c.cases[0].cameras[0].images.opencv);
 e.selectSample(2,'defect');r=arrive(e,changed,'two').records[0];assert.equal(r.caseId,'defect');assert.equal(r.cameras[0].opencvUrl,'/uploads/vision-demo/replacement.webp');
 r=arrive(e,changed,'one',5).records[0];assert.equal(r.cameras[0].opencvUrl,c.cases[0].cameras[0].images.opencv);
});
test('enabling after the current bottle arrival waits for the next bottle',()=>{
 const e=createVisionRehearsal(),c=config();assert.equal(e.observe(c,snapshot('late',2,3),1000).records.length,0);assert.equal(e.observe(c,snapshot('late',2,7),1000).records.length,0);
 const r=arrive(e,c,'next').records[0];assert.equal(r.caseId,'normal');assert.equal(r.verdict,'pass');
});
test('32 picture validation rejects missing frames, unsafe paths, duplicate cameras and invalid conclusions',()=>{
 const c=config();assert.deepEqual(validateRehearsal(c),c);
 for(const mutate of [v=>v.cases[0].cameras[0].images.original='',v=>v.cases[0].cameras[0].images.opencv='',v=>v.cases[0].cameras[0].images.original='https://other/site.jpg',v=>v.cases[0].cameras[0].images.yolo='/uploads/vision-demo/../../secret.png',v=>v.cases[0].cameras[1].cameraId='top',v=>v.cases[1].cameras.forEach(row=>row.status='pass'),v=>v.cases[0].cameras[0].status='reject',v=>v.stageIndices=[0],v=>v.stageIndices=[2,2]]){const v=structuredClone(c);mutate(v);assert.throws(()=>validateRehearsal(v));}
 const draft=config();draft.enabled=false;draft.cases[0].cameras[0].images.original='';assert.equal(validateRehearsal(draft).enabled,false);
});
test('earlier three-group configuration keeps uploaded pictures and fills separate original slots',()=>{
 const old=config();for(const sample of old.cases)for(const row of sample.cameras)delete row.images.original;old.cases[0].cameras[0].images.opencv='/uploads/vision-demo/existing.webp';
 const c=validateRehearsal(old);assert.equal(c.cases[0].cameras[0].images.opencv,'/uploads/vision-demo/existing.webp');assert.equal(c.cases[0].cameras[0].images.original,'/images/vision-demo/normal-original-top.webp');
});


test('selection persists across bottles and is locked at capture start',()=>{
 const e=createVisionRehearsal(),c=config();e.selectSample(2,'defect');e.observe(c,snapshot('approaching'),1000);e.selectSample(2,'normal');
 const r=e.observe(c,snapshot('approaching',2,7),1000).records[0];assert.equal(r.caseId,'defect');assert.equal(r.verdict,'reject');
 assert.equal(arrive(e,c,'next').records[0].caseId,'normal');e.selectSample(2,'defect');assert.equal(arrive(e,c,'another').records[0].caseId,'defect');assert.equal(arrive(e,c,'persistent').records[0].caseId,'defect');
});
test('sample choice is station-scoped; a previously assigned bottle retains its sample',()=>{
 const e=createVisionRehearsal(),c=config();e.selectSample(2,'defect');assert.equal(arrive(e,c,'one',5).records[0].caseId,'normal');assert.equal(arrive(e,c,'one',2).records[0].caseId,'normal');assert.equal(arrive(e,c,'two').records[0].caseId,'defect');
 e.reset();assert.equal(arrive(e,c,'after-reset').records[0].caseId,'normal');
});
test('camera mode never fabricates raw frames, holds one shot per camera and reports missing cameras at timeout',()=>{
 const e=createVisionRehearsal(),c=config(),idle={dataMode:'mixed',states:Array.from({length:9},()=>({source:'simulation'})),materialFlow:null};
 e.selectSample(2,'defect');e.start(2,'actual-one',1000,'camera');let r=e.observe(c,idle,1000);assert.equal(r.records[0].capturedCount,0);
 r=e.observe(c,idle,6000);assert.equal(r.records[0].capturedCount,0);assert.ok(r.records[0].cameras.every(row=>row.originalUrl===null&&row.overlayUrl===null));
 e.capture(2,'actual-one','top','data:image/png;base64,AAAA',6100);e.capture(2,'actual-one','top','data:image/png;base64,BBBB',6200);r=e.observe(c,idle,6300);
 assert.equal(r.records[0].cameras[0].originalUrl,'data:image/png;base64,AAAA');assert.equal(r.records[0].caseId,'defect');assert.equal(r.records[0].capturedCount,1);
 r=e.observe(c,idle,21000);assert.equal(r.records[0].verdict,'review');assert.equal(r.records[0].status,'completed');assert.equal(r.manualFlows[2],undefined);assert.equal(r.records[0].cameras[1].status,'missing');
 assert.throws(()=>e.capture(2,'actual-one','side-0','late',22000),/结束/);
});
test('explicit simulation capture runs without a production task and retains the selected defect until changed',()=>{
 const e=createVisionRehearsal(),c=config(),idle={dataMode:'mixed',states:Array.from({length:9},()=>({source:'simulation'})),materialFlow:null};
 e.selectSample(2,'defect');e.start(2,'manual-1',1000);let r=e.observe(c,idle,1000);assert.equal(r.records[0].capturedCount,0);assert.equal(r.manualFlows[2].caseId,'defect');
 assert.throws(()=>e.start(2,'duplicate',1500),/正在检测/);
 r=e.observe(c,idle,3000);assert.equal(r.records[0].capturedCount,1);assert.equal(r.records[0].caseId,'defect');
 r=e.observe(c,idle,9000);assert.equal(r.records[0].verdict,'reject');assert.equal(r.manualFlows[2],undefined);
 e.start(2,'manual-2',10000);e.observe(c,idle,10000);r=e.observe(c,idle,18000);assert.equal(r.records[0].caseId,'defect');
 e.selectSample(2,'normal');e.start(2,'manual-3',19000);e.observe(c,idle,19000);r=e.observe(c,idle,27000);assert.equal(r.records[0].verdict,'pass');
});
test('all four actual frames complete the record; explicit stop retains partial evidence',()=>{
 const e=createVisionRehearsal(),c=config(),idle={dataMode:'simulation',materialFlow:null};e.start(2,'one',1000,'camera');e.observe(c,idle,1000);
 for(const cameraId of ['top','side-0','side-120','side-240'])e.capture(2,'one',cameraId,'data:image/png;base64,AAAA',2000);
 let r=e.observe(c,idle,2100);assert.equal(r.records[0].capturedCount,4);assert.equal(r.records[0].verdict,'pass');assert.equal(r.manualFlows[2],undefined);
 e.start(2,'two',3000,'camera');e.observe(c,idle,3000);e.stop(2);r=e.observe(c,idle,3500);assert.equal(r.records[0].verdict,'review');
});
