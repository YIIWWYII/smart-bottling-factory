import * as THREE from 'three';
import {alarmRules} from './alarmRules';
const codes=['wash','gas','vision','beverage','filler','secondary','robot','agv','warehouse'];
// Local overlays preserve the Blender geometry and do not change physical control state.
export function createAlarmIndicators(root,{stageIndex=null,device=null}={}){
 root.updateMatrixWorld(true);
 const nodes=[];root.traverse(o=>{if(o.isMesh)nodes.push(o);});
 const group=new THREE.Group();group.name='ThresholdAlarmIndicators';root.add(group);
 const entries=[],preserve=new Set([group]);
 const lamps=nodes.filter(o=>o.visible&&/^StatusLamp_[012]/.test(o.name)&&!Array.isArray(o.material)).map(o=>{preserve.add(o);return {mesh:o,index:Number(o.name.match(/^StatusLamp_(\d)/)[1]),stage:codes.indexOf(o.userData.webDevice),color:o.material.color.clone()};});
 for(const rule of alarmRules){
  if(stageIndex!==null&&rule.stageIndex!==stageIndex||device&&rule.device!==device)continue;
  const candidates=nodes.filter(o=>o.visible&&(o.userData.webDevice===codes[rule.stageIndex]||stageIndex===rule.stageIndex));if(!candidates.length)continue;
  const matched=candidates.filter(o=>new RegExp(rule.part,'i').test(o.name.replaceAll('_',' ')));
  const bounds=new THREE.Box3();for(const o of matched.length?matched:candidates)bounds.union(new THREE.Box3().setFromObject(o));
  const point=root.worldToLocal(bounds.getCenter(new THREE.Vector3())),size=bounds.getSize(new THREE.Vector3());
  const radius=Math.max(.12,Math.min(.65,size.length()*.18));
  const material=new THREE.MeshBasicMaterial({color:0xffb342,transparent:true,opacity:.85,depthWrite:false});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,6,32),material);ring.position.copy(point);ring.rotation.x=Math.PI/2;
  const beacon=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),material);beacon.position.copy(point);beacon.position.y+=radius+.12;
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,radius+.12,6),material);pillar.position.copy(point);pillar.position.y+=(radius+.12)/2;
  for(const mesh of [ring,beacon,pillar]){group.add(mesh);preserve.add(mesh);mesh.visible=false;}
  entries.push({id:rule.id,ring,beacon,pillar,material});
 }
 return {preserve,update(time,alarms,reduced=false,states=[]){
 for(const lamp of lamps){const alerts=alarms.filter(a=>a.stageIndex===lamp.stage),state=states[lamp.stage];const level=alerts.some(a=>a.level==='critical')?2:alerts.length?1:0;const on=lamp.index===level&&state?.quality!=='offline'&&(level>0||state?.mode==='running');const m=lamp.mesh.material;m.color.copy(lamp.color).multiplyScalar(on?1:.22);m.emissive.copy(lamp.color);m.emissiveIntensity=on?(reduced?1.2:1.1+.25*Math.sin(time*3)):0;}
 const active=new Map(alarms.map(a=>[a.ruleId||a.id,a]));for(const e of entries){const a=active.get(e.id);for(const m of [e.ring,e.beacon,e.pillar])m.visible=!!a;if(!a)continue;e.material.color.set(a.level==='critical'?0xff4860:0xffb342);const pulse=reduced?1:.9+.1*Math.sin(time*(a.level==='critical'?4:2));e.ring.scale.setScalar(pulse);e.material.opacity=reduced?.9:.7+.25*pulse;}},dispose(){for(const e of entries){for(const m of [e.ring,e.beacon,e.pillar])m.geometry.dispose();e.material.dispose();}group.removeFromParent();}};
}
