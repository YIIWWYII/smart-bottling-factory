import test from 'node:test';
import assert from 'node:assert/strict';
import {createMG400Simulation} from './mg400-simulation.mjs';

const offline={online:false,connected:false,feedback:null,receivedAt:null,phase:'未连接'};
const stopped={mode:'stopped',quality:'simulated'};
const running={mode:'running',quality:'simulated'};

test('simulation advances with elapsed time and preserves physical connection state',()=>{
 const sim=createMG400Simulation();
 const first=sim.status('simulation',offline,running,false,1000);
 const next=sim.status('simulation',offline,running,false,2000);
 assert.equal(next.online,false);
 assert.equal(next.connected,false);
 assert.equal(next.feedback,null);
 assert.equal(next.display.source,'simulation');
 assert.equal(next.display.online,true);
 assert.equal(next.display.receivedAt,2000);
 assert.notDeepEqual(first.display.feedback.q_actual,next.display.feedback.q_actual);
});

test('manual simulation runs while the line is idle and pause retains its pose',()=>{
 const sim=createMG400Simulation();
 sim.status('simulation',offline,stopped,false,1000);
 sim.setRunning(true);
 sim.status('simulation',offline,stopped,false,1000);
 const moving=sim.status('simulation',offline,stopped,false,2000);
 assert.equal(moving.display.simulationRunning,true);
 sim.setRunning(false);
 const paused=sim.status('simulation',offline,stopped,false,2000);
 const later=sim.status('simulation',offline,stopped,false,5000);
 assert.equal(later.display.simulationRunning,false);
 assert.deepEqual(later.display.feedback.q_actual,paused.display.feedback.q_actual);
 sim.setRunning(true);
 assert.deepEqual(sim.status('simulation',offline,stopped,false,5000).display.feedback.q_actual,paused.display.feedback.q_actual);
 assert.notDeepEqual(sim.status('simulation',offline,stopped,false,6000).display.feedback.q_actual,paused.display.feedback.q_actual);
});

test('mixed mode switches to exact live feedback and resumes simulation on loss',()=>{
 const sim=createMG400Simulation();
 sim.status('mixed',offline,stopped,false,1000);
 sim.setRunning(true);
 const fallback=sim.status('mixed',offline,stopped,false,1000);
 assert.equal(fallback.display.fallback,true);
 const live={online:true,connected:true,receivedAt:2000,phase:'实机运行',feedback:{q_actual:[87,12,-6,45]}};
 const actual=sim.status('mixed',live,stopped,false,2000);
 assert.equal(actual.display.source,'real');
 assert.equal(actual.display.feedback,live.feedback);
 assert.equal(actual.display.receivedAt,live.receivedAt);
 assert.equal(sim.status('mixed',live,stopped,false,9000).display.feedback,live.feedback);
 const restored=sim.status('mixed',offline,stopped,false,10000);
 assert.equal(restored.display.source,'simulation');
 assert.equal(restored.display.simulationRunning,true);
 assert.notDeepEqual(sim.status('mixed',offline,stopped,false,11000).display.feedback.q_actual,restored.display.feedback.q_actual);
});

test('simulation ignores physical feedback; real mode never fabricates an offline frame',()=>{
 const sim=createMG400Simulation();
 const live={online:true,feedback:{q_actual:[87,12,-6,45]}};
 const simulated=sim.status('simulation',live,running,false,1000);
 assert.equal(simulated.display.source,'simulation');
 assert.notDeepEqual(simulated.display.feedback.q_actual,live.feedback.q_actual);
 const real=sim.status('real',offline,running,false,2000);
 assert.equal(real.display.source,'real');
 assert.equal(real.display.online,false);
 assert.equal(real.display.feedback,null);
});

test('interlocks stop simulated motion and changing mode clears manual start',()=>{
 const sim=createMG400Simulation();
 sim.status('simulation',offline,stopped,false,1000);
 sim.setRunning(true);
 sim.status('simulation',offline,stopped,false,1000);
 const held=sim.status('simulation',offline,stopped,true,2000);
 assert.equal(held.display.simulationRunning,false);
 assert.deepEqual(sim.status('simulation',offline,stopped,true,5000).display.feedback.q_actual,held.display.feedback.q_actual);
 assert.equal(sim.status('mixed',offline,stopped,false,6000).display.simulationRunning,false);
});
