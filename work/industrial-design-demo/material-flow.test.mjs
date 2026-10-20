import test from 'node:test';
import assert from 'node:assert/strict';
import {createMaterialFlow,advanceMaterialFlow,materialStage,materialProgress,materialTravel,gasInspectionCapacity,stationRate,preprocessingPhase} from './src/materialFlow.js';
const task=(plan=12)=>({id:'test',plan,done:0});
const options={running:true,bottles:1000,liquid:1000,volume:.5,packSize:12};
const count=f=>(f.loader?.count||0)+f.stages.flat().reduce((n,t)=>n+t.count,0)+f.completed;
test('empty start, physical ordering and conservation through a complete carton',()=>{
 const f=createMaterialFlow(task());assert.equal(count(f),0);assert.equal(materialStage(f,4).processing,false);
 advanceMaterialFlow(f,{...options,seconds:2});assert.ok(f.loader);assert.ok(f.stages.every(q=>q.length===0));assert.equal(f.completed,0);
 const seen=new Set();for(let i=0;i<2000&&f.completed<12;i++){advanceMaterialFlow(f,options);assert.equal(count(f),f.issued);assert.ok(f.issued<=12);for(const stage of [0,1,2,4,5,6,7,8])if(f.stages[stage].length)seen.add(stage);if(!seen.has(1))assert.equal(f.stages[2].length,0);}
 assert.deepEqual([...seen].sort((a,b)=>a-b),[0,1,2,4,5,6,7,8]);assert.equal(f.completed,12);
});
test('pause and serialized restore retain exact material positions',()=>{
 const f=createMaterialFlow(task());advanceMaterialFlow(f,{...options,seconds:20});const before=JSON.stringify([f.loader,f.stages,f.prep]);advanceMaterialFlow(f,{...options,running:false,seconds:100});assert.equal(JSON.stringify([f.loader,f.stages,f.prep]),before);
 const restored=JSON.parse(JSON.stringify(f));advanceMaterialFlow(restored,options);advanceMaterialFlow(f,options);assert.deepEqual(restored.stages,f.stages);
});
test('short final carton remains at packing; limited supply cannot invent bottles',()=>{
 const f=createMaterialFlow(task(3));for(let i=0;i<500&&!f.completed;i++)advanceMaterialFlow(f,{...options,packSize:12});assert.equal(f.completed,0);assert.equal(f.stages[6].length,3);assert.equal(f.stages[7].length,0);assert.equal(f.stages[8].length,0);
 const empty=createMaterialFlow(task());assert.equal(advanceMaterialFlow(empty,{...options,bottles:0}).admitted,0);assert.equal(advanceMaterialFlow(empty,{...options,liquid:0}).admitted,0);
 const restarted=createMaterialFlow({...task(),id:'next'});assert.equal(count(restarted),0);
});
test('packing waits for complete batch; model dwells during processing and freezes on pause',()=>{
 const f=createMaterialFlow(task());f.stages[6].push({id:'a',count:1,elapsed:0,duration:8});f.issued=1;advanceMaterialFlow(f,{...options,bottles:0});assert.equal(f.stages[6][0].elapsed,0);assert.equal(materialStage(f,6).processing,false);
 const t={id:'b',count:1,elapsed:10,duration:30};f.stages[0]=[t];f.updated=100000;f.running=false;assert.equal(materialTravel(f,t,110000),.5);assert.equal(materialProgress(f,t,110000),1/3);
 assert.equal(materialStage(null,0).processing,false);
});
test('gas inspection processes several bottles concurrently and stops admission at capacity',()=>{
 const f=createMaterialFlow(task(12));f.stages[2].push({id:'blocked',count:1,elapsed:0,duration:1000});f.issued=1;
 let concurrent=false;
 for(let i=0;i<400;i++){
  advanceMaterialFlow(f,options);
  assert.ok(f.stages[1].length<=gasInspectionCapacity);
  assert.equal(count(f),f.issued);
  if(f.stages[1].length>=2&&f.stages[1].slice(0,2).every(t=>t.elapsed>0&&t.elapsed<t.duration)){
   concurrent=true;assert.match(materialStage(f,1).label,new RegExp(`${f.stages[1].filter(t=>t.elapsed<t.duration).length} 瓶检测中 / ${f.stages[1].length} 瓶在位`));
  }
 }
 assert.ok(concurrent);
 assert.equal(f.stages[1].length,gasInspectionCapacity);
 assert.equal(f.loader,null);
 assert.equal(f.stages[0].length,0);
 assert.equal(materialStage(f,1).label,'4 瓶待移交下游');
 const before=f.stages[1].map(t=>t.elapsed);advanceMaterialFlow(f,{...options,running:false,seconds:20});assert.deepEqual(f.stages[1].map(t=>t.elapsed),before);
 f.stages[2].length=0;f.issued--;for(let i=0;i<60&&f.stages[1].length===gasInspectionCapacity;i++)advanceMaterialFlow(f,options);
 assert.ok(f.stages[1].length<gasInspectionCapacity);
 assert.equal(f.stages[2].length,1);
});

test('pretreatment phases and per-station output follow actual material',()=>{
 const f=createMaterialFlow(task(4));f.running=true;f.updated=Date.now();
 assert.equal(preprocessingPhase(f),'waiting');assert.equal(stationRate(f,0),0);
 f.stages[0]=[{id:'wash',count:1,elapsed:3,duration:29}];f.issued=1;
 assert.equal(preprocessingPhase(f),'rinse');f.stages[0][0].elapsed=18;assert.equal(preprocessingPhase(f),'air');
 advanceMaterialFlow(f,{...options,seconds:12,bottles:0});assert.equal(stationRate(f,0),1);assert.equal(stationRate(f,4),0);
 advanceMaterialFlow(f,{...options,running:false});assert.equal(stationRate(f,0),0);
});


test('packing progresses bottle by bottle and full storage holds material',()=>{
 const f=createMaterialFlow(task(2));f.issued=2;f.stages[6]=[1,2].map(n=>({id:'test-'+n,count:1,elapsed:0,duration:5}));
 advanceMaterialFlow(f,{...options,packSize:2,seconds:7});assert.equal(f.stages[6][0].packedCount,1);assert.equal(f.stages[7].length,0);
 advanceMaterialFlow(f,{...options,packSize:2,seconds:7});assert.equal(f.stages[7][0].packedCount,2);
 advanceMaterialFlow(f,{...options,seconds:30,reserveStorage:()=>null});assert.equal(f.completed,0);assert.equal(materialStage(f,8).phase,'blocked');const t=f.stages[8][0];assert.equal(materialProgress(f,t,Date.now()+1000),0);
 let committed=0;advanceMaterialFlow(f,{...options,seconds:11,reserveStorage:()=> 'A-01',storeCarton:token=>{assert.equal(token.storageSlot,'A-01');committed++;return true;}});assert.equal(f.completed,2);assert.equal(committed,1);
});

test('legacy sealed cartons retain contents and partial cartons return to packing',()=>{
 const f=createMaterialFlow(task(4));f.issued=4;f.stages[7]=[{id:'legacy',count:2,packed:true,elapsed:0,duration:15}];
 advanceMaterialFlow(f,{...options,packSize:2,seconds:.1,bottles:0});assert.equal(f.stages[7][0].packedCount,2);
 f.stages[7]=[{id:'partial',count:1,packed:true,elapsed:0,duration:15}];
 advanceMaterialFlow(f,{...options,packSize:2,seconds:.1,bottles:0});assert.equal(f.stages[7].length,0);assert.equal(f.stages[6][0].count,1);assert.equal(f.stages[6][0].packed,false);
});
