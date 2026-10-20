import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {readFileSync} from 'node:fs';
import {MG400,parseMG400,validateMG400} from './mg400.mjs';
import {createMG400Model} from './src/mg400Model.js';
import {formatMG400Command} from './mg400-protocol.mjs';
test('protocol templates validate parameters and preserve controller syntax',()=>{
 assert.equal(formatMG400Command('run',{project:'blockly_test01'}),'RunScript(blockly_test01)');
 assert.equal(formatMG400Command('speed',{value:5}),'SpeedFactor(5)');
 assert.equal(formatMG400Command('stop'),'StopScript()');
 assert.throws(()=>formatMG400Command('run',{project:'x);EnableRobot()'}));
 assert.throws(()=>formatMG400Command('speed',{value:101}));
 assert.throws(()=>formatMG400Command('speed',{value:'5'}));
 assert.throws(()=>formatMG400Command('unknown'));
});
test('joint model changes with feedback and freezes when stale',async(t)=>{
 const mapping=JSON.parse(readFileSync(new URL('./public/config/mg400-model-mapping.json',import.meta.url),'utf8'));
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>mapping}));
 const rig=createMG400Model(),status={online:true,receivedAt:Date.now(),feedback:{q_actual:[30,20,15,10]}};
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(rig.update(status),true);const before=rig.root.children[1].rotation.y;assert.ok(Math.abs(before-Math.PI/6)<1e-10);
 assert.equal(rig.update({...status,receivedAt:Date.now()-2000,feedback:{q_actual:[90,0,0,0]}}),false);assert.equal(rig.root.children[1].rotation.y,before);rig.dispose();
});
const frame=(mode=5)=>{const b=Buffer.alloc(1440);b.writeUInt16LE(1440);b.writeBigUInt64LE(0x0123456789abcdefn,48);b.writeBigUInt64LE(BigInt(mode),24);b.writeDoubleLE(12.5,432);b.writeDoubleLE(250,624);return b;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('feedback decodes LE doubles, retains 64-bit IO without precision loss, rejects invalid frames',()=>{
 const b=frame();b.writeBigUInt64LE(0xffffffffffffffffn,8);const data=parseMG400(b);assert.equal(data.q_actual[0],12.5);assert.equal(data.tool_vector_actual[0],250);assert.equal(data.digital_inputs,'18446744073709551615');assert.throws(()=>parseMG400(b.subarray(0,1439)));b[48]=0;assert.throws(()=>parseMG400(b));
});
test('configuration rejects protocol injection and invalid speed',()=>{assert.throws(()=>validateMG400({host:'127.0.0.1',project:'x);EnableRobot()'}));assert.throws(()=>validateMG400({host:'127.0.0.1',speed:101}));assert.equal(validateMG400({host:'127.0.0.1',project:'blockly_test01'}).dashboardPort,29999);});
test('local TCP controller: split/coalesced frames, confirmations, unquoted RunScript, execution feedback, errors and stale data',async()=>{
 const sockets=new Set(),commands=[];let feed;
 const dashboard=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('data',chunk=>{const command=chunk.toString();commands.push(command);const response=(command==='ClearError()'?'-1':'0')+',{},'+command+';';socket.write(response.slice(0,4));setTimeout(()=>socket.write(response.slice(4)),5);});});
 const feedback=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));feed=socket;const b=frame();socket.write(Buffer.concat([Buffer.from([3,5,7]),b.subarray(0,31)]));setTimeout(()=>socket.write(Buffer.concat([b.subarray(31),b])),5);});
 const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));await listen(dashboard);await listen(feedback);const robot=new MG400();
 try{await robot.connect({host:'127.0.0.1',dashboardPort:dashboard.address().port,feedbackPort:feedback.address().port,project:'blockly_test01',speed:20});await wait(50);assert.equal(robot.status().feedback.q_actual[0],12.5);assert.equal(commands.length,0);
  await assert.rejects(robot.command('Sync()',{timeoutMs:60001}),/超时/);assert.equal(commands.length,0);
  const wrong=robot.prepare('run',null,'admin');await assert.rejects(robot.execute(wrong.token,'other'));assert.equal(commands.length,0);
  const expired=robot.prepare('run',null,'admin');robot.pending.get(expired.token).expires=0;await assert.rejects(robot.execute(expired.token,'admin'));
  const ready=robot.prepare('run',null,'admin');await robot.execute(ready.token,'admin');assert.equal(commands[0],'RunScript(blockly_test01)');assert.equal(robot.execution.started,false);robot.accept(parseMG400(frame(5)));assert.match(robot.execution.state,/等待/);feed.write(frame(7));await wait(30);assert.equal(robot.execution.state,'运行中');robot.accept(parseMG400(frame(5)));assert.match(robot.execution.state,/未核验/);
  assert.equal((await robot.command('Sync()',{timeoutMs:30000})).raw,'0,{},Sync();');
  await assert.rejects(robot.execute(ready.token,'admin'));await assert.rejects(robot.command('ClearError()'),/拒绝/);robot.receivedAt=Date.now()-2000;assert.equal(robot.status().feedback,null);assert.throws(()=>robot.prepare('run',null,'admin'),/反馈/);
 }finally{robot.close();for(const s of sockets)s.destroy();await Promise.all([new Promise(r=>dashboard.close(r)),new Promise(r=>feedback.close(r))]);}
});
