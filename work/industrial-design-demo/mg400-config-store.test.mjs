import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createMG400ConfigStore,mg400Files,validateMG400Files} from './mg400-config-store.mjs';
import {applyMG400Files,MG400,defaultMG400} from './mg400.mjs';
test('file saves, external edits and stale drafts use a single source',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mg400-config-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const name of Object.values(mg400Files))fs.copyFileSync(new URL('./config/'+name,import.meta.url),path.join(dir,name));
 const store=createMG400ConfigStore(pathToFileURL(dir+path.sep)),initial=store.read();
 const updated=store.save('communication',{...initial.values.communication,host:'127.0.0.2'},initial.raw.communication);
 assert.equal(store.read().values.communication.host,'127.0.0.2');
 assert.throws(()=>store.save('communication',initial.values.communication,initial.raw.communication),/已被修改/);
 assert.throws(()=>store.save('../outside',{},''));
 const modified={...updated.values.acquisition,feedbackStaleAfterMs:2500};
 fs.writeFileSync(store.path('acquisition'),JSON.stringify(modified));
 assert.equal(store.read().values.acquisition.feedbackStaleAfterMs,2500);
 assert.throws(()=>store.save('communication',{...updated.values.communication,host:'bad'},updated.raw.communication));
 assert.equal(store.read().values.communication.host,'127.0.0.2');
});
test('core protocol and unsupported suction pressure cannot bypass validation',()=>{
 const original=createMG400ConfigStore().read().values;
 for(const change of [c=>c.protocol.commands.enable.template='RunScript(x)',c=>c.protocol.feedback.fields.find(f=>f[0]==='enable_status')[1]=0,c=>c.motion.pickPlace.vacuum.pressureKPa=10,c=>c.communication.transport='udp']){
  const c=structuredClone(original);change(c);assert.throws(()=>validateMG400Files(c));
 }
});
test('apply file settings updates driver defaults without connecting',()=>{
 const original=createMG400ConfigStore().read().values,c=structuredClone(original);
 c.communication.host='127.0.0.3';c.trajectories.controller.defaultProject='example';c.motion.platform.defaultSpeedPercent=7;
 try{const config=applyMG400Files(c),robot=new MG400();assert.equal(config.host,'127.0.0.3');assert.equal(defaultMG400.project,'example');assert.equal(robot.config.speed,7);assert.equal(robot.status().connected,false);}finally{applyMG400Files(original);}
});
