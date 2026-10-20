import test from 'node:test';
import assert from 'node:assert/strict';
import {visionCameras,cameraPosition,inspectionTarget} from './src/visionCameras.js';
import {capabilities} from './src/controlCapabilities.js';
test('one overhead camera and three 120 degree side cameras have independent controls',()=>{
 assert.equal(visionCameras.length,4);const side=visionCameras.filter(c=>c.angle!==null);
 assert.deepEqual(side.map(c=>c.angle),[0,120,240]);
 for(const c of side){const p=cameraPosition(c);assert.ok(Math.abs(Math.hypot(p.x,p.z)-.66)<1e-9);assert.equal(p.y,1.15);}
 assert.ok(cameraPosition(visionCameras[0]).y>inspectionTarget.y);
 for(const c of visionCameras)assert.equal(capabilities.filter(x=>x.id===c.id+':cameraState').length,1);
 assert.ok(!capabilities.some(c=>c.device==='VIS-BOTTOM-01'));
});

import {visionFeed} from './src/visionFeed.js';
test('camera views consume simulation, protocol and real telemetry without local fallback',()=>{
 const now=100000;
 const twin={updated:now,states:[{},{},{source:'simulation',mode:'running',rate:120,receivedAt:now}],ops:{controls:{'VIS-LIGHT-01:lightIntensity':60,'VIS-TOP-01:cameraState':'PAUSED'}}};
 assert.equal(visionFeed(twin,now).light,60);
 assert.equal(visionFeed(twin,now).cameras[0],'paused');
 twin.states[2].source='real';
 assert.equal(visionFeed(twin,now).rate,120);
 assert.equal(visionFeed(twin,now).light,null);
 assert.equal(visionFeed(twin,now).cameras[0],'unknown');
 assert.equal(visionFeed(twin,now+11000).rate,0);
 twin.ops.protocol={enabled:true,devices:[{id:'VIS-LIGHT-01',online:true,receivedAt:now,points:[{name:'lightIntensity',value:35}]}]};
 assert.equal(visionFeed(twin,now).light,35);
 twin.ops.protocol.devices[0].online=false;
 assert.equal(visionFeed(twin,now).light,null);
 twin.states[2].quality='offline';assert.equal(visionFeed(twin,now).rate,0);
});

import {secondaryCameras,installVisionCameras} from './src/visionCameras.js';
import * as THREE from 'three';
test('secondary four-camera rig and telemetry stay separate from empty-bottle inspection',()=>{
 const root=new THREE.Group(),asset=new THREE.Group();asset.name='Asset_secondary';root.add(asset);
 for(const name of ['Side_camera001','Side_camera_lens001','Top_camera001','Top_lens001']){const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());mesh.name=name;asset.add(mesh);}
 installVisionCameras(root);assert.equal(asset.children.filter(o=>o.name.startsWith('VisionRig_')).length,4);
 for(const camera of secondaryCameras)assert.equal(capabilities.find(c=>c.device===camera.id).stageIndex,5);
 const now=100000,states=Array.from({length:6},()=>({source:'simulation',quality:'good',mode:'running',rate:120}));
 const twin={updated:now,states,ops:{controls:{'VIS-LIGHT-01:lightIntensity':20,'SEC-LIGHT-01:lightIntensity':85,'SEC-SIDE-02:cameraState':'PAUSED'}}};
 assert.equal(visionFeed(twin,now,5).light,85);assert.equal(visionFeed(twin,now,5).cameras[2],'paused');assert.equal(visionFeed(twin,now,2).light,20);
});
