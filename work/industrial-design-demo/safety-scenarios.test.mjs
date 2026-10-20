import test from 'node:test';import assert from 'node:assert/strict';
import {createSafetyCase,advanceSafetyCases,clearSafetyCase,resetSafetyCase,safetyHolds,safetyAlarms,safetyScenarios} from './src/safetyScenarios.js';
test('all cases have alarms; fill quality has no actuator',()=>{for(const s of safetyScenarios)assert.equal(safetyAlarms([createSafetyCase(s.id,0)])[0].title,s.title);assert.deepEqual(safetyHolds([createSafetyCase('fill-error',0)]),[]);});
test('cooling is gradual and stops at recovery threshold',()=>{let c=createSafetyCase('cabinet-hot',0);c=advanceSafetyCases([c],2000)[0];assert.equal(c.value,68);assert.equal(c.phase,'active');for(let t=4000;t<=14000;t+=2000)c=advanceSafetyCases([c],t)[0];assert.equal(c.value,50);assert.equal(c.phase,'resolved');});
test('manual hazards hold through clear and require reset',()=>{for(const id of ['tank-low','conveyor-jam','motor-overload','agv-obstacle']){let c=createSafetyCase(id,0);assert.throws(()=>resetSafetyCase(c,1));const holds=safetyHolds([c]);assert.ok(holds.length);c=clearSafetyCase(c,2);assert.equal(safetyAlarms([c]).length,0);assert.deepEqual(safetyHolds([c]),holds);c=resetSafetyCase(c,3);assert.deepEqual(safetyHolds([c]),[]);}});

test('2D shows alarm source, stopped downstream and reset hold separately',async()=>{
 const {planEquipmentState}=await import('./src/safetyScenarios.js');
 const live={quality:'simulated',source:'simulation',mode:'running'};
 const active=createSafetyCase('tank-low',0);
 assert.equal(planEquipmentState(live,3,[active]).tone,'alarm');
 assert.equal(planEquipmentState(live,4,[active]).tone,'linked');
 assert.equal(planEquipmentState(live,4,[active]).moving,false);
 const cleared=clearSafetyCase(active,1);
 assert.equal(planEquipmentState(live,4,[cleared]).tone,'holding');
 assert.equal(planEquipmentState(live,4,[resetSafetyCase(cleared,2)]).moving,true);
 assert.equal(planEquipmentState({...live,quality:'offline'},3,[active]).tone,'offline');
});
