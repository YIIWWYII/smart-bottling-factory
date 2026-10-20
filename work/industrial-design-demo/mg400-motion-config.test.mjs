import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadMotionConfig,validateMotionConfig,renderPickPlace} from './handoff-examples/mg400-motion-config.mjs';
test('separate files preserve existing trajectory and speed',()=>{
 const c=loadMotionConfig();assert.deepEqual(c.smallPaths.paths.vertical10,[[0,0,10],[0,0,0]]);
 assert.equal(c.smallPaths.speedFactorPercent,5);assert.equal(c.pickPlace.vacuum.pressureKPa,null);
});
test('reject unsupported pressure, unsafe test range and script injection',()=>{
 for(const change of [c=>c.pickPlace.vacuum.pressureKPa=-50,c=>c.smallPaths.speedLPercent=50,c=>c.smallPaths.paths.vertical=[[0,0,100]],c=>c.pickPlace.points.start='P1);MovL(P2)',c=>c.pickPlace.vacuum.mode='proportional']){
  const c=loadMotionConfig();change(c);assert.throws(()=>validateMotionConfig(c));
 }
});
test('export consumes parameters but always resets execution checks to preview',()=>{
 const c=loadMotionConfig();c.pickPlace.speedLPercent=4;c.pickPlace.points.pick='P9';
 Object.assign(c.pickPlace.vacuum,{mode:'digital-output',output:2,onLevel:1,offLevel:0,pickWaitMs:700});
 const template=readFileSync(new URL('./handoff-examples/mg400_pick_place.lua',import.meta.url),'utf8').replace('local PREVIEW_ONLY = true','local PREVIEW_ONLY = false');
 const lua=renderPickPlace(template,c);
 for(const text of ['local PREVIEW_ONLY = true','local SITE_CHECKED = false','local IO_CHECKED = false','local SPEED_PERCENT = 4','pick=P9','local VACUUM_DO = 2','local VACUUM_ON = ON','local PICK_WAIT_MS = 700'])assert.ok(lua.includes(text),text);
});

test('live test speed and timing are loaded from configuration and validated',()=>{
 const c=loadMotionConfig();assert.equal(c.liveTest.speedFactorPercent,80);assert.equal(c.liveTest.blowPulseMs,300);
 c.liveTest.speedFactorPercent=55;c.liveTest.pickWaitMs=1200;assert.equal(validateMotionConfig(c).liveTest.speedFactorPercent,55);
 c.liveTest.speedFactorPercent=101;assert.throws(()=>validateMotionConfig(c));
});
