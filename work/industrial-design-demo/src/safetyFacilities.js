import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {scenarioById} from './safetyScenarios';
const placements=[['cabinet','vision'],['cooler','beverage'],['tank','beverage'],['stopper','wash'],['obstacle','agv'],['warehouseVent','warehouse'],['warehouseDryer','warehouse'],['warehouseFire','warehouse']];
const cache=new Map();
export async function loadFacilities(device){return Promise.all(placements.filter(([,code])=>!device||code===device).map(async([name,code])=>{if(!cache.has(name))cache.set(name,new GLTFLoader().loadAsync('/models/safety-facilities/'+name+'.glb').catch(e=>{cache.delete(name);throw e;}));return {name,code,template:(await cache.get(name)).scene};}));}
export function attachFacilities(root,assets){
 const entries=[],preserve=new Set();root.updateMatrixWorld(true);
 const boxes=new Map();for(const {code} of assets){const asset=root.getObjectByName('Asset_'+code)||root;boxes.set(code,new THREE.Box3().setFromObject(asset));}
 for(const {name,code,template} of assets){const box=boxes.get(code),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const model=template.clone(true);model.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=o.material.clone();}preserve.add(o);});
 const warehouse=code==='warehouse',offset=['warehouseVent','warehouseDryer','warehouseFire'].indexOf(name),x=warehouse?center.x+(offset-1)*1.1:name==='tank'?box.min.x-.7:box.max.x+.65,z=warehouse?box.max.z+.65:center.z;model.position.copy(root.worldToLocal(new THREE.Vector3(x,box.min.y,z)));root.add(model);model.name='Auxiliary_'+name;preserve.add(model);
 const start=root.worldToLocal(new THREE.Vector3(center.x,box.max.y+.35,center.z));
 const end=model.position.clone().add(new THREE.Vector3(0,1.9,0));if(name==='tank'){start.copy(model.position).add(new THREE.Vector3(0,1.1,0));end.copy(model.position).add(new THREE.Vector3(.55,.3,0));}
 const direction=end.clone().sub(start);const arrow=new THREE.ArrowHelper(direction.clone().normalize(),start,direction.length(),0x269dff,.24,.13);arrow.visible=false;arrow.renderOrder=10;arrow.traverse(o=>{preserve.add(o);if(o.material){o.material.depthTest=false;o.material.transparent=true;}});root.add(arrow);
 // A solid blue route stays readable at presentation distance.
 const route=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,direction.length(),8),new THREE.MeshBasicMaterial({color:0x269dff,depthTest:false}));route.position.copy(start).add(end).multiplyScalar(.5);route.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());route.visible=false;route.renderOrder=11;root.add(route);preserve.add(route);
 const sourceDot=new THREE.Mesh(new THREE.SphereGeometry(.075,12,8),new THREE.MeshBasicMaterial({color:0xff526b,depthTest:false}));sourceDot.position.copy(start);sourceDot.visible=false;sourceDot.renderOrder=12;root.add(sourceDot);preserve.add(sourceDot);
 const targetRing=new THREE.Mesh(new THREE.TorusGeometry(.18,.025,8,24),new THREE.MeshBasicMaterial({color:0x39aaff,depthTest:false}));targetRing.position.copy(end);targetRing.visible=false;targetRing.renderOrder=12;root.add(targetRing);preserve.add(targetRing);
 const packet=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),new THREE.MeshBasicMaterial({color:0xcceeff,depthTest:false}));packet.visible=false;packet.renderOrder=12;root.add(packet);preserve.add(packet);
 const entry={name,model,arrow,route,sourceDot,targetRing,packet,start,end};entries.push(entry);
 if(name==='stopper'){
  entry.bottles=[];
  for(let i=0;i<5;i++){const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,.28,10),new THREE.MeshStandardMaterial({color:0x94d9ca,transparent:true,opacity:.7,roughness:.2}));bottle.position.copy(root.worldToLocal(new THREE.Vector3(box.max.x-.3-i*.15,box.min.y+.96,center.z)));root.add(bottle);preserve.add(bottle);entry.bottles.push(bottle);}
 }

 if(name==='cooler'){
  const a=new THREE.Vector3(x,box.min.y+1.65,center.z),b=new THREE.Vector3(box.max.x,box.min.y+Math.min(size.y*.6,1.6),center.z);
  const curve=new THREE.CatmullRomCurve3([a,a.clone().add(new THREE.Vector3(0,.3,0)),b.clone().add(new THREE.Vector3(.2,.3,0)),b].map(p=>root.worldToLocal(p)));
  const hose=new THREE.Mesh(new THREE.TubeGeometry(curve,20,.025,6,false),new THREE.MeshStandardMaterial({color:0x257f9d,metalness:.5,roughness:.3}));root.add(hose);preserve.add(hose);entry.hose=hose;entry.curve=curve;entry.drops=[];
  for(let i=0;i<6;i++){const drop=new THREE.Mesh(new THREE.SphereGeometry(.045,6,4),new THREE.MeshBasicMaterial({color:0x87ecff}));root.add(drop);preserve.add(drop);entry.drops.push(drop);}
 }
 }
 let clock=0;
 return {preserve,project(facility,camera){const e=entries.find(e=>e.name===facility);if(!e)return null;return e.targetRing.getWorldPosition(new THREE.Vector3()).project(camera);},update(dt,cases){clock+=dt;for(const e of entries){const c=cases.find(c=>scenarioById(c.id)?.facility===e.name&&c.phase!=='resolved'),running=c?.phase==='active'&&!(e.name==='warehouseVent'&&cases.some(c=>c.id==='warehouse-smoke'&&c.phase!=='resolved'));e.model.visible=e.name!=='obstacle'||!!c;e.arrow.visible=!!c;for(const o of [e.route,e.sourceDot,e.targetRing,e.packet])o.visible=!!c;e.sourceDot.material.color.set(c?.phase==='awaiting-reset'?0xffbf5b:0xff526b);e.packet.position.lerpVectors(e.start,e.end,(clock*.55)%1);e.targetRing.scale.setScalar(1+Math.sin(clock*4)*.12);
 for(const bottle of e.bottles||[])bottle.visible=c?.id==='conveyor-jam'&&c.phase==='active';
 let rotor;e.model.traverse(o=>{if(/^FanRotor/.test(o.name))rotor=o;});if(rotor&&running)rotor.rotation.y+=dt*15;
 let beacon;e.model.traverse(o=>{if(/^AlarmBeacon/.test(o.name))beacon=o;});if(beacon){beacon.material.emissive.set(running?0xff2233:0x000000);beacon.material.emissiveIntensity=running?1+Math.sin(clock*9)*.6:0;}
 const level=e.model.getObjectByName('LiquidLevel');if(level)level.scale.y=c?Math.max(.03,c.value/100):.6;
 const gate=e.model.getObjectByName('StopperGate');if(gate)gate.rotation.z=c?0:Math.PI/2;
 const valve=e.model.getObjectByName('CoolingValve');if(valve)valve.rotation.y=running?Math.PI/2:0;
 const inlet=e.model.getObjectByName('InletValve');if(inlet)inlet.rotation.y=c?.id==='tank-high'?Math.PI/2:0;
 for(const [i,d] of (e.drops||[]).entries()){d.visible=!!running;d.position.copy(e.curve.getPoint((clock*.3+i/6)%1));}
 }},dispose(){for(const e of entries){for(const o of [e.route,e.sourceDot,e.targetRing,e.packet]){o.removeFromParent();o.geometry.dispose();o.material.dispose();}e.arrow.line.geometry.dispose();e.arrow.line.material.dispose();e.arrow.cone.geometry.dispose();e.arrow.cone.material.dispose();e.arrow.removeFromParent();e.model.removeFromParent();e.hose?.removeFromParent();for(const d of [...(e.drops||[]),...(e.bottles||[])])d.removeFromParent();}}};
}
