import * as THREE from 'three';
import {materialProgress} from './materialFlow.js';
import {slots} from './logistics.js';
// One carton ID follows the authored MG400, the AGV and the confirmed storage slot.
export function createDownstream(root,gltf){
 const preserve=new Set(),bottleTargets=[],groups=[],steel=new THREE.MeshStandardMaterial({color:0x8a9ba9,metalness:.7,roughness:.3}),card=new THREE.MeshStandardMaterial({color:0xc09460,roughness:.9}),blue=new THREE.MeshStandardMaterial({color:0x236b95,metalness:.4,roughness:.4});
 const packing=root.getObjectByName('Asset_robot'),agv=root.getObjectByName('Asset_agv'),warehouse=root.getObjectByName('Asset_warehouse');
 const keep=o=>{o.traverse(n=>{preserve.add(n);if(n.isMesh){for(let p=n.parent;p;p=p.parent){const code=/^Asset_(robot|agv|warehouse)$/.exec(p.name)?.[1];if(code){n.userData.webDevice=code;break;}}}});return o;};
 const mesh=(parent,name,size,position,mat=steel)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.name=name;m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);keep(m);return m;};
 const group=(parent,name)=>{const g=new THREE.Group();g.name=name;parent.add(g);groups.push(g);keep(g);return g;};
 function bottle(parent,name){const g=new THREE.Group();g.name=name;parent.add(g);const m=new THREE.Mesh(new THREE.CylinderGeometry(.048,.063,.3,12),new THREE.MeshStandardMaterial({color:0x56be8a,roughness:.3}));m.position.y=.15;g.add(m);keep(g);bottleTargets.push({object:g,height:.3});return g;}
 function carton(parent,name,open=false){const g=group(parent,name),w=.7,d=.54,h=.24;mesh(g,'Carton base',[w,.018,d],[0,0,0],card);for(const x of [-1,1])mesh(g,'Carton wall',[.018,h,d],[x*w/2,h/2,0],card);for(const z of [-1,1])mesh(g,'Carton wall',[w,h,.018],[0,h/2,z*d/2],card);const lid=mesh(g,'Sealed carton lid',[w,.018,d],[0,h,0],card);lid.visible=!open;const tape=mesh(g,'Packing tape',[.09,.005,d],[0,h+.012,0],new THREE.MeshStandardMaterial({color:0xeac891,roughness:.65}));tape.visible=!open;return {g,lid,tape,resize(count){const cols=Math.max(1,Math.ceil(Math.sqrt(count))),rows=Math.ceil(count/cols);g.scale.set(Math.max(.3,cols*.14+.08)/w,1,Math.max(.3,rows*.14+.08)/d);return {cols,rows};}};}
 let mixer,clip,payload,packCell,packBox,infeed,filled=[],drop=new THREE.Vector3(),pick=new THREE.Vector3();
 if(packing&&gltf){
  packing.getObjectByName('Robot_Yaw')?.removeFromParent();
  // Remove the old arm-specific harness while retaining pedestal/controller.
  packing.getObjectByName('Robot umbilical')?.removeFromParent();
  packCell=group(packing,'MG400 packing cell');const robot=gltf.scene.clone(true);robot.position.set(0,.5,0);robot.scale.setScalar(3);packCell.add(robot);keep(robot);
  mixer=new THREE.AnimationMixer(robot);clip=gltf.animations.find(c=>c.name==='Robot_Loading_Cycle')||gltf.animations[0];if(clip)mixer.clipAction(clip).play();
  payload=robot.getObjectByName('Authored_Bottle001')||robot.getObjectByName('Authored_Bottle.001');
  const tcp=robot.getObjectByName('A_Payload001')||robot.getObjectByName('A_Payload.001');
  if(tcp){mixer.setTime(2);root.updateMatrixWorld(true);pick.copy(packCell.worldToLocal(tcp.getWorldPosition(new THREE.Vector3())));mixer.setTime(6.2);root.updateMatrixWorld(true);drop.copy(packCell.worldToLocal(tcp.getWorldPosition(new THREE.Vector3())));}
  mesh(packCell,'Incoming conveyor',[1.25,.08,.55],[pick.x,pick.y-.19,pick.z],blue);
  for(const x of [-.48,.48])mesh(packCell,'Conveyor support',[.06,Math.max(.1,pick.y-.23),.35],[pick.x+x,(pick.y-.23)/2,pick.z]);
  mesh(packCell,'Carton transfer table',[1.3,.08,.95],[drop.x,drop.y-.19,drop.z]);
  for(const x of [-.48,.48])mesh(packCell,'Carton table support',[.06,drop.y-.23,.65],[drop.x+x,(drop.y-.23)/2,drop.z]);
  infeed=bottle(packCell,'Bottle awaiting grip');infeed.position.copy(pick).add(new THREE.Vector3(0,-.15,0));
  packBox=carton(packCell,'Current packing carton',true);packBox.g.position.copy(drop).add(new THREE.Vector3(0,-.15,0));
  for(let i=0;i<24;i++){const b=bottle(packCell,'Packed bottle '+i);b.position.set(((i%4)-1.5)*.14,.018,(Math.floor(i/4)-1)*.14);filled.push(b);}
  if(payload)bottleTargets.push({object:payload,height:.1,bottom:-.05});
  mixer.setTime(0);
 }
 let cargo,agvBase=agv?.position.clone();if(agv){agv.traverse(o=>{if(o.isMesh&&/shipping.?carton|carton.?seam|packing.?tape|barcode|traceability.?label/i.test(o.name)){o.visible=false;keep(o);}});cargo=carton(agv,'Transported full carton');cargo.g.position.set(0,.79,0);}
 let inbound,carrier,rackBoxes=[];if(warehouse){
  warehouse.traverse(o=>{if(o.isMesh&&/shipping.?carton|carton.?seam|packing.?tape|barcode|traceability.?label/i.test(o.name)){o.visible=false;keep(o);}});
  const cell=group(warehouse,'Warehouse transfer cell');
  mesh(cell,'Transfer rail',[3.6,.04,.07],[0,.12,1.25]);carrier=group(cell,'Storage lift');mesh(carrier,'Lift chassis',[.75,.16,.65],[0,.2,0],blue);mesh(carrier,'Lift mast',[.08,3.2,.08],[-.38,1.65,.1]);
  for(const x of [-.22,.22])mesh(carrier,'Load bearing fork',[.06,.04,1.35],[x,.38,-.4]);
  inbound=carton(cell,'Incoming storage carton');
  for(let i=0;i<6;i++){const row=Math.floor(i/2),col=i%2;const g=group(cell,'Storage slot '+slots[i].id);g.position.set(col? .88:-.88,.665+row*1.16,0);const a=carton(g,'Stored carton '+slots[i].id);const b=carton(g,'Stored carton stack '+slots[i].id);b.g.position.y=.263;rackBoxes.push({g,a,b,slot:slots[i].id});}
 }
 function update(flow,logistics,paused){
  const pack=flow?.stages?.[6]?.[0],transit=flow?.stages?.[7]?.[0],store=flow?.stages?.[8]?.[0];
  if(packCell){const p=pack?.packed?materialProgress(paused?{...flow,running:false}:flow,pack)*pack.duration:0,step=(pack?.duration-4)/Math.max(1,pack?.count)||5,packed=pack?.packed?Math.min(pack.count,Math.floor(Math.max(0,p-2)/step)):0,cycle=Math.max(0,p-2)%step/step*8;
   mixer?.setTime(pack?.packed&&p<pack.duration-2?cycle:0);
   packBox.g.visible=!!pack;packBox.lid.visible=!!pack&&packed>=pack.count;packBox.tape.visible=packBox.lid.visible;
   const count=pack?.packed?pack.count:flow?.packSize||12,{cols,rows}=packBox.resize(count),slot=Math.min(packed,count-1);
   while(filled.length<count){const b=filled[0].clone(true);packCell.add(b);keep(b);filled.push(b);}
   packBox.g.position.copy(drop).add(new THREE.Vector3(-((slot%cols)-(cols-1)/2)*.14,-.15,-(Math.floor(slot/cols)-(rows-1)/2)*.14));
   filled.forEach((b,i)=>{b.visible=!!pack?.packed&&i<packed;b.position.copy(packBox.g.position).add(new THREE.Vector3(((i%cols)-(cols-1)/2)*.14,.018,(Math.floor(i/cols)-(rows-1)/2)*.14));});infeed.visible=!!pack&&(!pack.packed||cycle<2);
   if(payload)payload.visible=!!pack?.packed&&p>=2&&p<pack.duration-2&&cycle>=2&&cycle<6.2;
   packCell.userData.packedCount=packed;packCell.userData.cartonId=pack?.id||null;
  }
  if(agv){cargo.resize(transit?.count||12);cargo.g.visible=!!transit?.packed&&transit.packedCount===transit.count;const p=transit?materialProgress(paused?{...flow,running:false}:flow,transit):0;
   if(!root.userData.agvHome)root.userData.agvHome=agvBase.clone();const start=packing?packing.position.clone().add(new THREE.Vector3(2,0,1.6)):agvBase.clone().add(new THREE.Vector3(-2,0,0)),end=warehouse?warehouse.position.clone().add(new THREE.Vector3(-2.5,0,1.8)):agvBase.clone().add(new THREE.Vector3(2,0,0));
   agv.position.copy(transit?start.lerp(end,p):agvBase);cargo.g.userData.productTwin={kind:'product',id:transit?.id,name:'满箱成品',stageIndex:7,count:transit?.count||0};
  }
  if(inbound){const index=Math.max(0,slots.findIndex(s=>s.id===store?.storageSlot)),target=new THREE.Vector3(index%2?.88:-.88,.665+Math.floor(index/2)*1.16,0),p=store?materialProgress(paused?{...flow,running:false}:flow,store):0;
   inbound.resize(store?.count||12);inbound.g.visible=!!store?.storageSlot;const from=new THREE.Vector3(-2,.4,1.25),lift=new THREE.Vector3(target.x,target.y,1.25);
   inbound.g.position.copy(p<.7?from.lerp(lift,p/.7):lift.lerp(target,(p-.7)/.3));carrier.position.set(inbound.g.position.x,inbound.g.position.y-.4,1.25);
   for(const r of rackBoxes){const quantity=(logistics?.inventory||[]).filter(l=>l.slot===r.slot).reduce((n,l)=>n+l.quantity,0);r.a.g.visible=quantity>0;r.b.g.visible=quantity>1;r.g.userData.quantity=quantity;}
  }
 }
 return {preserve,bottleTargets,update,dispose(){mixer?.stopAllAction();groups.forEach(g=>g.removeFromParent());}};
}
