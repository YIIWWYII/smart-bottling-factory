import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createMG400ConfigStore,mg400Files,validateMG400Files,trajectoryReplacementBlock,selectTrajectoryPreset} from './mg400-config-store.mjs';
import {applyMG400Files,MG400,defaultMG400} from './mg400.mjs';
test('file saves, external edits and stale drafts use a single source',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mg400-config-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const name of Object.values(mg400Files))fs.copyFileSync(new URL('./config/'+name,import.meta.url),path.join(dir,name));
 const store=createMG400ConfigStore(pathToFileURL(dir+path.sep)),initial=store.read();
 const updated=store.save('communication',{...initial.values.communication,host:'127.0.0.2',dashboardPort:29999,feedbackPort:30004,motionPort:30003},initial.raw.communication);
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
 c.communication={...c.communication,host:'127.0.0.3',dashboardPort:29999,feedbackPort:30004,motionPort:30003};c.trajectories.controller.defaultProject='example';c.motion.platform.defaultSpeedPercent=7;
 try{const config=applyMG400Files(c),robot=new MG400();assert.equal(config.host,'127.0.0.3');assert.equal(defaultMG400.project,'example');assert.equal(robot.config.speed,7);assert.equal(robot.status().connected,false);}finally{applyMG400Files(original);}
});
test('blank field-site address and ports allow platform startup but cannot connect',async()=>{
 const files=structuredClone(createMG400ConfigStore().read().values);
 files.communication.host='';for(const key of ['dashboardPort','feedbackPort','motionPort'])files.communication[key]=null;
 assert.doesNotThrow(()=>validateMG400Files(files));
 const partial=structuredClone(files);partial.communication.dashboardPort=29999;
 assert.throws(()=>validateMG400Files(partial),/全部留空/);
 const robot=new MG400();await assert.rejects(robot.connect(applyMG400Files(files)),/尚未配置/);
});
test('controller trajectory presets reference complete packaged projects',()=>{
 const presets=createMG400ConfigStore().read().values.trajectories.controller.presets;
 assert.deepEqual(presets.map(item=>item.projectName),['blockly_2026yibao','blockly_kkkl']);
 for(const preset of presets){
  const root=new URL('./config/'+preset.packagePath+'/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('prj.json',root),'utf8'));
  for(const file of [...manifest.cpus,manifest.global,manifest.teach_point])assert.ok(fs.existsSync(new URL(file,root)),`${preset.projectName}/${file}`);
 }
});

test('trajectory config can be replaced while powered on and enabled only with fresh idle feedback',()=>{
 const safe={connected:true,online:true,feedback:{enable_status:1,robot_mode:5},execution:{state:'已停止（反馈空闲）'}};
 assert.equal(trajectoryReplacementBlock(safe), '');
 assert.match(trajectoryReplacementBlock({...safe,feedback:{enable_status:0,robot_mode:4}}),/已上使能/);
 assert.match(trajectoryReplacementBlock({...safe,feedback:{enable_status:1,robot_mode:7}}),/已上使能/);
 assert.match(trajectoryReplacementBlock({...safe,online:false}),/反馈不可用/);
 assert.match(trajectoryReplacementBlock(safe,1),/待确认/);
 assert.match(trajectoryReplacementBlock({connected:false}),/先连接控制器/);
});

test('preset selection changes only next project without connecting or changing trajectories',()=>{
 const original=createMG400ConfigStore().read().values.trajectories;
 const before=structuredClone(original);
 const selected=selectTrajectoryPreset(original,'blockly_kkkl',{connected:false});
 assert.deepEqual(selected,{...original,controller:{...original.controller,defaultProject:'blockly_kkkl'}});
 assert.deepEqual(original,before);
 assert.throws(()=>selectTrajectoryPreset(original,'unregistered',{connected:false}),/已登记/);
 assert.throws(()=>selectTrajectoryPreset(original,'blockly_kkkl',{connected:false},1),/待确认/);
 const idle={connected:true,online:true,feedback:{enable_status:1,robot_mode:5}};
 assert.equal(selectTrajectoryPreset(original,'blockly_2026yibao',idle).controller.defaultProject,'blockly_2026yibao');
 assert.throws(()=>selectTrajectoryPreset(original,'blockly_kkkl',{...idle,feedback:{enable_status:1,robot_mode:7}}),/已上使能/);
 assert.throws(()=>selectTrajectoryPreset(original,'blockly_kkkl',{...idle,online:false}),/反馈不可用/);
});

test('folder import preserves complete controller projects, registers relative paths and rejects bad uploads',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mg400-projects-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const name of Object.values(mg400Files))fs.copyFileSync(new URL('./config/'+name,import.meta.url),path.join(dir,name));
 const store=createMG400ConfigStore(pathToFileURL(dir+path.sep));
 const source=new URL('./config/mg400-projects/blockly_kkkl/',import.meta.url);
 const files=fs.readdirSync(source).map(name=>({path:name,data:fs.readFileSync(new URL(name,source)).toString('base64')}));
 const expected=store.read().raw.trajectories;
 const saved=store.importProject({projectName:'blockly_new',name:'新轨迹',files,expected});
 const preset=saved.values.trajectories.controller.presets.find(p=>p.projectName==='blockly_new');assert.equal(preset.packagePath,'mg400-projects/blockly_new');
 assert.equal(saved.values.trajectories.controller.defaultProject,'');assert.equal(store.projectFolder('blockly_new'),path.join(dir,'mg400-projects','blockly_new')+path.sep);
 for(const file of files)assert.deepEqual(fs.readFileSync(path.join(store.projectFolder('blockly_new'),file.path)),Buffer.from(file.data,'base64'));
 const next=saved.raw.trajectories;
 assert.throws(()=>store.importProject({projectName:'blockly_new',name:'重复',files,expected:next}),/已存在/);
 assert.throws(()=>store.importProject({projectName:'bad',name:'测试',files:[...files,{path:'../escape.lua',data:''}],expected:next}),/路径/);
 assert.throws(()=>store.importProject({projectName:'bad',name:'测试',files:[...files,{path:'NUL',data:''}],expected:next}),/路径/);
 assert.throws(()=>store.importProject({projectName:'bad',name:'测试',files:files.filter(f=>f.path!=='point.json'),expected:next}),/缺少引用文件/);
 assert.throws(()=>store.importProject({projectName:'bad',name:'测试',files,expected}),/已更新/);
 assert.equal(fs.existsSync(path.join(dir,'mg400-projects','bad')),false);
});
