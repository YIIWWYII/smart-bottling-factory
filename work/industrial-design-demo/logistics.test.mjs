import test from 'node:test';
import assert from 'node:assert/strict';
import {findPath,blocked,initialLogistics,planJob,advanceLogistics,slots,obstacleBlocked,rankQueue,comparePlans,planPicking,inventoryAnalysis,reserveProductionSlot,storeProductionCarton} from './src/logistics.js';
const input={kind:'inbound',product:'LIME-500',quantity:24,algorithm:'astar',strategy:'nearest',pick:'fifo',port:'in',expiry:'2099-12-31'};
test('all algorithms produce shortest traversable routes to every rack',()=>{
 for(const slot of slots){const routes=['astar','bfs','dijkstra'].map(a=>findPath([3,12],slot.access,a));assert.equal(new Set(routes.map(r=>r.distance)).size,1);for(const r of routes)r.path.forEach((p,i)=>{assert.equal(blocked(...p),false);if(i)assert.equal(Math.abs(p[0]-r.path[i-1][0])+Math.abs(p[1]-r.path[i-1][1]),1);});}
 assert.throws(()=>findPath([3,3],[17,4]));
});
test('no task and paused task keep position; inventory changes exactly once at delivery',()=>{
 const state=initialLogistics();advanceLogistics(state);assert.deepEqual(state.vehicle.position,[3,10]);const plan=planJob(state,input);state.jobs.push({...plan,id:'one',status:'paused',step:0});advanceLogistics(state);assert.deepEqual(state.vehicle.position,[3,10]);state.jobs[0].status='running';
 for(let i=0;i<plan.path.length-2;i++){advanceLogistics(state);assert.equal(state.inventory.length,0);}advanceLogistics(state);assert.equal(state.inventory[0].quantity,24);advanceLogistics(state);assert.equal(state.inventory[0].quantity,24);
 const out=planJob(state,{...input,kind:'outbound',quantity:10});state.jobs.push({...out,id:'two',status:'running',step:0});for(let i=0;i<out.path.length;i++)advanceLogistics(state);assert.equal(state.inventory[0].quantity,14);assert.equal(state.movements.length,2);
});
test('strategies, full warehouse and invalid quantities',()=>{
 const state=initialLogistics();assert.ok(planJob(state,{...input,product:'SODA-350',strategy:'classified'}).slot.startsWith('B'));
 for(const quantity of [0,-1,1.5,121,NaN])assert.throws(()=>planJob(state,{...input,quantity}));
 state.inventory=slots.map((s,i)=>({id:String(i),slot:s.id,product:'LIME-500',quantity:20,receivedAt:`2025-01-0${i+1}`,expiry:`2099-12-${20-i}`}));assert.throws(()=>planJob(state,input));
 assert.equal(planJob(state,{...input,kind:'outbound',quantity:10,pick:'fifo'}).lotId,'0');assert.equal(planJob(state,{...input,kind:'outbound',quantity:10,pick:'fefo'}).lotId,'5');assert.throws(()=>planJob(state,{...input,kind:'outbound',quantity:21}));
});
test('obstacle inflation and replanning preserve delivery, without crossing safety buffer',()=>{
 const state=initialLogistics(),plan=planJob(state,input);state.jobs.push({...plan,id:'detour',status:'running',step:0});
 state.obstacles=[{id:'barrier',x:10,z:12}];
 const original=[...state.vehicle.position];advanceLogistics(state);assert.equal(state.jobs[0].replans,1);assert.equal(state.jobs[0].status,'running');assert(!state.jobs[0].path.some(p=>obstacleBlocked(...p,state.obstacles)));assert.notDeepEqual(state.vehicle.position,original);
 for(let i=0;i<80&&state.jobs[0].status==='running';i++){advanceLogistics(state);assert(!obstacleBlocked(...state.vehicle.position,state.obstacles));}
 assert.equal(state.jobs[0].status,'completed');assert.equal(state.inventory[0].quantity,24);assert.equal(state.movements.length,1);
});
test('wait policy and unreachable destination stop, then resume after obstacle removal',()=>{
 for(const avoidance of ['wait','replan']){const state=initialLogistics(),plan=planJob(state,input);state.avoidance=avoidance;state.jobs.push({...plan,id:avoidance,status:'running',step:0});state.obstacles=[{x:plan.to[0],z:plan.to[1]}];advanceLogistics(state);assert.equal(state.jobs[0].status,'waiting');assert.deepEqual(state.vehicle.position,[3,10]);assert.equal(state.inventory.length,0);state.obstacles=[];advanceLogistics(state);assert.equal(state.jobs[0].status,'running');}
});
test('loaded replan never returns to pickup or creates duplicate stock',()=>{
 const state=initialLogistics(),plan=planJob(state,input);state.jobs.push({...plan,id:'loaded',status:'running',step:0});advanceLogistics(state);advanceLogistics(state);assert.equal(state.jobs[0].step,state.jobs[0].pickupIndex);state.obstacles=[{x:10,z:12}];advanceLogistics(state);assert.equal(state.jobs[0].pickupIndex,0);assert.deepEqual(state.jobs[0].path[0],[3,12]);
 for(let i=0;i<80;i++)advanceLogistics(state);assert.equal(state.inventory.length,1);assert.equal(state.inventory[0].quantity,24);
});
test('FIFO, priority, nearest pickup ordering and invalid queue candidates',()=>{
 const state=initialLogistics();state.queue=[{...input,id:'first',priority:3,createdAt:'2026-01-01'}, {...input,id:'urgent',port:'pack',priority:1,createdAt:'2026-01-02'}, {...input,id:'missing',kind:'outbound',priority:1,createdAt:'2025-01-01'}];
 assert.equal(rankQueue(state,'fifo')[0].id,'first');assert.equal(rankQueue(state,'priority')[0].id,'urgent');assert.equal(rankQueue(state,'nearest')[0].id,'first');assert.equal(rankQueue(state,'fifo').at(-1).available,false);
});
test('picking route visits all requested access points and 2-opt never worsens nearest-neighbour',()=>{
 const state=initialLogistics();state.obstacles=[{x:8,z:11}];const ids=['A-01','C-01','B-01'];const nearest=planPicking(state,ids,'nearest'),optimized=planPicking(state,ids,'twoopt');assert(optimized.distance<=nearest.distance);assert.equal(new Set(optimized.order).size,3);for(const id of ids){const s=slots.find(s=>s.id===id);assert(optimized.path.some(p=>p.join()===s.access.join()));}assert(!optimized.path.some(p=>obstacleBlocked(...p,state.obstacles)));assert.throws(()=>planPicking(state,[]));assert.throws(()=>planPicking(state,['invalid']));
 assert.equal(comparePlans(state,input).length,3);
});
test('ABC evidence and min-max suggestions exclude expired inventory and do not mutate stock',()=>{
 const state=initialLogistics();state.inventory=[{product:'LIME-500',quantity:5,expiry:'2099-01-01'},{product:'LIME-500',quantity:40,expiry:'2000-01-01'}];state.movements=[{kind:'outbound',product:'LIME-500',quantity:100}];const result=inventoryAnalysis(state,12,60);assert.equal(result[0].category,'A');assert.equal(result[0].replenish,55);assert.equal(result[0].expired,40);assert.equal(result[1].category,'未分类');assert.equal(state.inventory[0].quantity,5);assert.throws(()=>inventoryAnalysis(state,60,12));
});


test('production inventory requires full cartons and records each carton once',()=>{
 const state=initialLogistics(),t={id:'batch-1',storageSlot:'A-01',packed:true,count:12,packedCount:11};
 assert.equal(storeProductionCarton(state,t,'SPRITE','2099-01-01'),false);t.packedCount=12;
 assert.equal(storeProductionCarton(state,t,'SPRITE','2099-01-01'),true);assert.equal(storeProductionCarton(state,t,'SPRITE','2099-01-01'),true);assert.equal(state.movements.length,1);assert.equal(state.inventory[0].bottles,12);
 state.inventory=slots.map(s=>({slot:s.id,product:'SPRITE',quantity:120}));assert.equal(reserveProductionSlot(state,'SPRITE'),null);assert.equal(storeProductionCarton(state,{...t,id:'batch-2'},'SPRITE','2099-01-01'),false);
});
