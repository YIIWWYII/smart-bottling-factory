import {bindBlenderMG400} from './mg400Blender.js';
import * as THREE from 'three';
export const loadingAssetCode='MG400-TEACH-01';
// Authored MG400 cycle: pick at 2s, release at 6.2s. Coordinates in the wash station frame.
export function createLoadingZone(wash,gltf){
 if(!wash||!gltf)return null;
 const zone=new THREE.Group();zone.name='LoadingZone';wash.add(zone);
 const steel=new THREE.MeshStandardMaterial({color:0x8597a7,metalness:.72,roughness:.3});
 const blue=new THREE.MeshStandardMaterial({color:0x207caa,metalness:.15,roughness:.6});
 const dark=new THREE.MeshStandardMaterial({color:0x202d38,roughness:.6});
 function box(name,size,position,material=steel){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.name=name;m.position.set(...position);m.castShadow=true;m.receiveShadow=true;zone.add(m);return m;}
 box('Loader pedestal',[.7,.578,.7],[-4.243,.289,.553]);
 box('Bottle supply table',[1.15,.08,.85],[-3.3,.94,1.107]);
 for(const x of [-3.75,-2.85])for(const z of [.8,1.4])box('Supply table leg',[.06,.9,.06],[x,.45,z]);
 box('Loading conveyor extension',[1.95,.07,.6],[-2.6,.945,0],blue);
 for(const x of [-3.45,-1.75])for(const z of [-.24,.24])box('Conveyor extension leg',[.06,.9,.06],[x,.45,z]);
 for(const z of [-.34,.34])box('Loading belt side rail',[1.95,.06,.04],[-2.6,1.02,z]);
 box('Loading area footprint',[2.9,.015,2.1],[-3.25,.0075,.6],dark);
 const robot=gltf.scene;robot.name='Loading_MG400';robot.position.set(-4.243,.578,.553449);robot.scale.setScalar(3);zone.add(robot);
 const payload=robot.getObjectByName('Authored_Bottle001')||robot.getObjectByName('Authored_Bottle.001');
 const mixer=new THREE.AnimationMixer(robot);const clip=gltf.animations[0];const action=clip?mixer.clipAction(clip):null;action?.play();
 const variants=[],fingers=[],bottleTargets=[];
 const wrist=robot.getObjectByName('A_link5001')||robot.getObjectByName('A_link5.001');
 if(wrist){for(const sign of [-1,1]){const finger=new THREE.Mesh(new THREE.BoxGeometry(.007,.048,.012),steel);finger.position.set(sign*.027,-.137,0);wrist.add(finger);fingers.push({finger,sign});}}

 function bottle(kind){
  const g=new THREE.Group(),colors=[0x74d3a0,0xe88d33,0x99cddd];
  const points=(kind===1?[[.015,-.05],[.021,-.042],[.021,.019],[.011,.035],[.009,.05]]:kind===2?[[.017,-.05],[.017,.023],[.01,.038],[.009,.05]]:[[.016,-.05],[.018,-.037],[.018,.018],[.01,.038],[.009,.05]]).map(([r,y])=>new THREE.Vector2(r,y));
  const body=new THREE.Mesh(new THREE.LatheGeometry(points,20),new THREE.MeshStandardMaterial({color:colors[kind],metalness:.12,roughness:.23}));g.add(body);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.008,16),new THREE.MeshStandardMaterial({color:[0xf6f9f0,0x167332,0x2356b9][kind]}));cap.position.y=.052;g.add(cap);
  const label=new THREE.Mesh(new THREE.CylinderGeometry(kind===1?.0213:.0183,kind===1?.0213:.0183,.027,20),new THREE.MeshStandardMaterial({color:[0x08764e,0xffdc55,0xe9eef3][kind]}));label.position.y=-.01;g.add(label);return g;
 }
 if(payload){bottleTargets.push({object:payload,height:.1,bottom:-.05});payload.material=new THREE.MeshBasicMaterial({visible:false});for(let i=0;i<3;i++){const v=bottle(i);v.visible=i===0;payload.add(v);variants.push(v);}}
 for(let i=0;i<6;i++){const b=bottle(i%3);b.scale.setScalar(3);b.position.set(-3.65+(i%3)*.3,1.13,1.02+Math.floor(i/3)*.3);zone.add(b);bottleTargets.push({object:b,height:.1,bottom:-.05});}
 // Keep the editable origin at the robot base; move the whole loading cell together.
 const origin=robot.position.clone();for(const child of zone.children)child.position.sub(origin);zone.position.copy(origin);zone.userData.loadingCell=true;
 wash.updateWorldMatrix(true,true);if(wash.parent)wash.parent.attach(zone);
 let applyActual=null,mappingError='正在加载 Blender 映射',disposed=false,physicalMode=false;bindBlenderMG400(robot,{hidePayload:false}).then(fn=>{if(!disposed){applyActual=fn;mappingError='';}}).catch(e=>{mappingError=e.message;});
 let elapsed=0;
 return {zone,bottleTargets,update(delta,state,paused,enabled=true,material=null,physical=null){
  zone.visible=enabled;if(!enabled)return;
  const usePhysical=!!physical?.config?.host;robot.visible=true;
  if(usePhysical){if(!physicalMode){mixer.stopAllAction();robot.traverse(n=>{if(n.name.replaceAll('.','').startsWith('Authored_Bottle'))n.visible=false;});physicalMode=true;}const valid=applyActual?.(physical);zone.userData.phase=mappingError||(valid?physical.phase:"实机反馈中断 · 姿态保留");zone.userData.motionSource="MG400 实际关节反馈";return;}
  if(physicalMode){action?.reset().play();robot.traverse(n=>{if(n.name.replaceAll('.','').startsWith('Authored_Bottle'))n.visible=true;});physicalMode=false;}
  const online=state?.quality!=='offline'&&state?.source&&(!state.receivedAt||Date.now()-state.receivedAt<10000);
  const running=online&&!paused&&['running','warning'].includes(state.mode);
  if(material){mixer.setTime(Math.min((clip?.duration||8)-.001,material.progress*8));}else if(running){elapsed+=delta;mixer.update(delta);}
  const time=action?.time||0,variant=Math.floor(elapsed/(clip?.duration||8))%3;
  if(!payload?.children.some(o=>!variants.includes(o)))variants.forEach((v,i)=>v.visible=i===variant);for(const {finger,sign} of fingers)finger.position.x=sign*(time>=2&&time<6.2?.021:.029);
  if(payload){payload.visible=material?material.present:true;if(time>=6.2){payload.position.set(.314534+(time-6.2)*.30,.183954,-.184483);}}
  zone.userData.phase=material&&!material.present?'就绪 · 等待上料':!online?'数据离线':!running?'上料暂停':time<2?'定位取瓶':time<3.2?'夹取抬升':time<5.2?'搬运至入口':time<6.2?'放瓶':'输送入线';
  zone.userData.motionSource='状态驱动预设动作';zone.userData.cycleTime=time;
 },dispose(){disposed=true;mixer.stopAllAction();}};
}
