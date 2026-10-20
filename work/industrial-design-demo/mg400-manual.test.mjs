import test from 'node:test';import assert from 'node:assert/strict';import net from 'node:net';
import {manualTarget,createManualControl} from './mg400-manual.mjs';
const f={enable_status:1,error_status:0,user_index:0,tool_index:0,robot_mode:5,q_actual:[0,0,0,0],tool_vector_actual:[250,0,0,0]};
test('manual axes use actual pose and reject malformed or out-of-range targets',()=>{
 assert.deepEqual(manualTarget(f,'Z',1,5).target,[250,0,5,0]);assert.deepEqual(manualTarget(f,'J4',-1,10).target,[0,0,0,-10]);
 for(const args of [['X);EnableRobot()',1,1],['X',0,1],['X',1,100]])assert.throws(()=>manualTarget(f,...args));
 assert.throws(()=>manualTarget({...f,q_actual:[160,0,0,0]},'J1',1,1));
});
test('deadman expiry stops jog; valid owner heartbeat extends lease; explicit stop resets',async()=>{
 const commands=[],sockets=new Set();const server=net.createServer(s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));s.on('data',c=>{const text=c.toString();commands.push(text);s.write('0,{},'+text+';');});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const robot={config:{host:'127.0.0.1'},status:()=>({online:true,receivedAt:Date.now(),feedback:f}),command:async c=>{commands.push(c);return {values:'0,0,0,0'};},event:()=>{}};
 const manual=createManualControl(robot,{motionPort:server.address().port});
 try{
  const run=await manual.start({confirmed:true,mode:'jog',axis:'X',direction:1,step:1},'owner');
  assert.match(commands[0],/^MoveJog\(X\+/);assert.equal(manual.heartbeat(run.id,'other').active,false);
  assert.equal(manual.heartbeat(run.id,'owner').active,true);
  await new Promise(r=>setTimeout(r,900));assert.ok(commands.includes('ResetRobot()'));assert.equal(manual.active,false);
  await manual.start({confirmed:true,mode:'jog',axis:'J1',direction:-1,step:1},'owner');await manual.stop();assert.equal(manual.active,false);assert.equal(commands.filter(c=>c==='ResetRobot()').length,2);
 }finally{await manual.stop();for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}
});
