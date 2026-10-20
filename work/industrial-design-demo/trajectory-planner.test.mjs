import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePlan} from './public/trajectory-planner.mjs';
const input={name:'可乐',pick:[256.24,-.01,-52.4,102.98],place:[300,40,-40,102.98],height:155};
test('contact heights stay unchanged and travel clears both endpoints',()=>{
 const plan=generatePlan(input);
 assert.equal(plan.travelZ,10);assert.deepEqual(plan.points.P2,input.pick);assert.deepEqual(plan.points.P5,input.place);
 assert.deepEqual(plan.points.P1,[256.24,-.01,10,102.98]);assert.deepEqual(plan.points.P4,[300,40,10,102.98]);
 assert.deepEqual(plan.points.P7,[256.24,-.01,-2.4,102.98]);assert.equal(plan.steps.at(-1).point,'P7');assert.equal(plan.entry.initialLiftMm,0);
 assert.equal(plan.executionEnabled,false);assert.equal(plan.status,'draft');
 assert.deepEqual(plan.steps.filter(s=>s.operation==='output').map(s=>[s.output,s.value]),[[2,1],[2,0],[1,1],[1,0]]);
});
test('manual transit height and invalid inputs',()=>{
 assert.equal(generatePlan({...input,travelZ:80}).travelZ,80);
 for(const changes of [{height:0},{height:NaN},{pick:[1,2,3]},{place:[0,0,NaN,0]},{travelZ:-40},{clearance:-1},{clearance:30},{travelZ:5}])assert.throws(()=>generatePlan({...input,...changes}));
});
test('recess does not change taught contact coordinates or add bottle height twice',()=>{
 const plan=generatePlan({...input,recess:10});
 assert.equal(plan.effectiveHeightMm,145);assert.equal(plan.travelZ,10);
 assert.deepEqual(plan.points.P2,input.pick);assert.deepEqual(plan.points.P5,input.place);
 for(const recess of [-1,155,NaN])assert.throws(()=>generatePlan({...input,recess}));
});
