import * as THREE from 'three';

// These parts are reparented to a parameter-driven pivot; exported local tracks no longer apply.
export const isParameterDrivenPart=name=>/Animated agitator shaft/i.test(name.replaceAll('_',' '));

export const stationCodes=['wash','gas','vision','beverage','filler','secondary','robot','agv','warehouse'];
const number=(values,id,fallback)=>{const v=values?.[id];return v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):fallback;};
export function mechanismRate(code,values={}){
 const main={wash:'PT-CV-01',gas:'GAS-PUMP-01',beverage:'BEV-MIX-01',filler:'FIL-POS-01',robot:'PK-ARM-01'}[code];
 if(main&&values[main+':runState']==='PAUSED')return 0;
 if(code==='wash')return number(values,'PT-CV-01:conveyorSpeed',120)/120;
 if(code==='beverage')return number(values,'BEV-MIX-01:mixSpeed',120)/120;
 if(code==='filler')return number(values,'FIL-PUMP-01:flowRate',120)/120*500/Math.max(100,number(values,'FIL-HEAD-01:fillVolume',500));
 if(code==='robot')return number(values,'PK-ARM-01:pickRate',12)/12;
 if(code==='agv')return number(values,'AGV-01:speedLimit',1);
 if(code==='gas')return 30/Math.max(5,number(values,'GAS-PUMP-01:sampleDuration',30));
 return 1;
}
export function stationCanAnimate(state,paused=false){return !paused&&!!state&&state.source!=='real'&&state.quality!=='offline'&&!['stopped','fault'].includes(state.mode);}

// Effects attach to the exported part bounds. No material or transform is shared between viewers.
export function createDeviceMechanics(root,{focus=null,stage=null}={}){
 const nodes=[],preserve=new Set(),effects=[],materials=[],geometries=[],times=new Map();
 root.updateMatrixWorld(true);
 root.traverse(o=>{if(o.isMesh&&o.visible)nodes.push(o);});
 const group=new THREE.Group();group.name='ParameterDrivenEffects';root.add(group);preserve.add(group);
 const localBox=o=>{const b=new THREE.Box3().setFromObject(o),pts=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])pts.push(root.worldToLocal(new THREE.Vector3(x,y,z)));return new THREE.Box3().setFromPoints(pts);};
 const add=(geometry,color,opacity=1)=>{const material=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35,transparent:opacity<1,opacity,roughness:.28,depthWrite:opacity===1});const mesh=new THREE.Mesh(geometry,material);group.add(mesh);preserve.add(mesh);geometries.push(geometry);materials.push(material);return mesh;};
 // Separate spray and air assemblies: fixed instance counts keep the live view inexpensive.
 const makeWashEffect=(kind,b,code)=>{
  const water=kind==='rinse',rig=new THREE.Group();rig.name=water?'WaterSprayAssembly':'AirKnifeAssembly';group.add(rig);preserve.add(rig);
  const length=water?.48:.55,origin=new THREE.Vector3((b.min.x+b.max.x)/2,water?b.max.y+.012:b.min.y+.13,water?(b.min.z+b.max.z)/2:b.max.z+.015);
  const axis=water?new THREE.Vector3(0,1,0):new THREE.Vector3(0,-.12,1).normalize(),side=new THREE.Vector3(1,0,0),width=water?Math.min(1.6,b.max.x-b.min.x)*.8:.4;
  const jets=[],splashes=[];
  const basic=(geometry,color,opacity)=>{const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false});materials.push(material);geometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);rig.add(mesh);preserve.add(mesh);return mesh;};
  for(let i=0;i<(water?5:3);i++){
   const offset=(i/(water?4:2)-.5)*width,start=origin.clone().addScaledVector(side,offset);
   if(!water){
    const nozzle=add(new THREE.CylinderGeometry(.025,.025,.06,10),0x738c9c);nozzle.position.copy(start).addScaledVector(axis,-.03);nozzle.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
   }
   for(let k=0;k<(water?1:3);k++){
    const points=Array.from({length:9},(_,j)=>{const t=j/8;return start.clone().addScaledVector(axis,t*length).add(new THREE.Vector3(water?Math.sin(t*Math.PI)*.022:(k-1)*.03,water?-t*t*.055:Math.sin(t*Math.PI*2+k)*.018,water?-t*t*.2:0));});
    const mesh=basic(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,water?.009:.007,5,false),water?0x239cfa:0x89d9ed,water?.78:.38);jets.push(mesh);
   }
   if(water){const ring=basic(new THREE.TorusGeometry(.055,.006,5,20),0xa8e8ff,.6);ring.rotation.x=Math.PI/2;ring.position.copy(start).addScaledVector(axis,length-.05);splashes.push(ring);}
  }
  const geometry=new THREE.SphereGeometry(water?.012:.009,5,4),material=new THREE.MeshBasicMaterial({color:water?0x58bcff:0xb2f2ff,transparent:true,opacity:water?.9:.7,depthWrite:false});geometries.push(geometry);materials.push(material);
  const particles=new THREE.InstancedMesh(geometry,material,water?100:72);particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particles.frustumCulled=false;rig.add(particles);preserve.add(particles);rig.visible=false;
  effects.push({kind,code,rig,jets,splashes,particles,origin,axis,side,width,length,phase:0,dummy:new THREE.Object3D()});
 };
 for(const o of nodes){
  const name=o.name.replaceAll('_',' '),code=o.userData.webDevice||stage,b=localBox(o),center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
  if(/Continuous hygienic PU belt/i.test(name)&&(!focus||focus==='PT-CV-01')){
   const axis=size.x>=size.z?'x':'z',length=Math.max(size[axis],.1),markers=[];
   for(let i=0;i<7;i++){const m=add(new THREE.BoxGeometry(axis==='x'?length*.018:size.x*.85,.004,axis==='z'?length*.018:size.z*.85),0x99e6e1,.7);m.position.copy(center);m.position.y=b.max.y+.006;markers.push(m);}
   effects.push({kind:'belt',code,markers,axis,length,center,id:'PT-CV-01',phase:0});
  }
  const rinse=/Rinse jet/i.test(name),fill=/Filling nozzle/i.test(name),air=/Air hose/i.test(name);
  if((rinse&&(!focus||focus==='PT-WASH-01'))||(air&&(!focus||focus==='PT-AIR-01')))makeWashEffect(rinse?'rinse':'air',b,code);
  if(fill&&(!focus||['FIL-PUMP-01','FIL-HEAD-01'].includes(focus))){
   const length=.24,radius=.012,stream=add(new THREE.CylinderGeometry(radius,radius,length,8),0xffce66,.65);stream.position.copy(center);stream.position.y=b.min.y-length/2;
   const drops=[];for(let i=0;i<9;i++)drops.push(add(new THREE.SphereGeometry(radius*.8,6,4),0x91e7ff,.85));
   effects.push({kind:'fill',code,mesh:stream,drops,up:false,length,base:stream.position.clone(),phase:0});
  }
  if(isParameterDrivenPart(name)&&(!focus||focus==='BEV-MIX-01')){
   // Rotate the shaft about its own geometric center, not the export origin.
   const pivot=new THREE.Group();pivot.position.copy(o.parent.worldToLocal(o.getWorldPosition(new THREE.Vector3())));o.parent.add(pivot);pivot.attach(o);preserve.add(pivot);preserve.add(o);effects.push({kind:'mix',code,pivot,phase:0});
  }
  if(/Diffused LED|Fill-level illuminator|Top lens|Side camera lens/i.test(name)){
   o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();const list=Array.isArray(o.material)?o.material:[o.material];materials.push(...list);preserve.add(o);
   let lamp;
   if(/Diffused LED|Fill-level illuminator/i.test(name)){
    lamp=new THREE.SpotLight(0xc5efff,0,3.5,Math.PI/3,.65,1);lamp.position.copy(center);lamp.position.y-=.015;
    const target=new THREE.Object3D();target.position.copy(center);target.position.y-=.75;group.add(target);group.add(lamp);lamp.target=target;
   }
   effects.push({kind:'light',code,list,lamp});
  }
  if(/Top lens|Side camera lens/i.test(name)){
   const scan=add(new THREE.PlaneGeometry(.22,.2),0x67ebd5,.18);scan.material.side=THREE.DoubleSide;scan.position.copy(center);scan.position.y-=.16;scan.rotation.x=-Math.PI/2;
   const cameraId=o.userData.cameraId||(code==='secondary'?'SEC-CAM-01':/Top lens/i.test(name)?'VIS-TOP-01':'VIS-SIDE-01');effects.push({kind:'scan',code,mesh:scan,base:scan.position.clone(),cameraId,phase:0});
  }
  if(/Reject paddle|Reject ram/i.test(name)){
   preserve.add(o);effects.push({kind:'reject',code,object:o,base:o.position.clone(),phase:2,token:null});
  }
  if(/Dished sanitary vessel/i.test(name)&&focus==='BEV-MIX-01'){
   const mats=(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.clone());mats.forEach(m=>{m.transparent=true;m.opacity=.2;m.depthWrite=false;});o.material=Array.isArray(o.material)?mats:mats[0];materials.push(...mats);preserve.add(o);
   const radius=Math.max(.08,Math.min(size.x,size.z)*.32),swirl=[];for(let i=0;i<12;i++){const m=add(new THREE.SphereGeometry(.012,6,4),0x58d5e3,.8);swirl.push(m);}effects.push({kind:'swirl',code,swirl,center,radius,phase:0});
  }
  if(/Sealing bell/i.test(name)&&(!focus||focus==='GAS-CHAMBER-01')){
   preserve.add(o);effects.push({kind:'seal',code,object:o,base:o.position.clone(),phase:0});
  }
  if(/Dished sanitary vessel/i.test(name)&&(!focus||focus==='BEV-HT-01')){
   const mats=(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.clone());o.material=Array.isArray(o.material)?mats:mats[0];materials.push(...mats);preserve.add(o);effects.push({kind:'heat',code,mats});
  }
  if(/Vacuum gripper/i.test(name)&&(!focus||focus==='PK-GRIP-01')){
   const ring=add(new THREE.TorusGeometry(Math.max(size.x,size.z)*.65,.006,6,32),0x74dac4,.8);ring.position.copy(center);ring.rotation.x=Math.PI/2;effects.push({kind:'force',code,mesh:ring});
  }
  if(/Test manifold/i.test(name)&&(!focus||focus==='GAS-PUMP-01')){
   const dots=[];for(let i=0;i<6;i++){const m=add(new THREE.SphereGeometry(.018,8,6),0x71d9ed,.8);dots.push(m);}
   effects.push({kind:'sample',code,dots,center,length:Math.max(size.x,.25),phase:0});
  }
 }
 const rinse=effects.find(e=>e.kind==='rinse'),air=effects.find(e=>e.kind==='air');
 if(rinse&&air&&!focus){
  const separation=air.origin.clone().sub(rinse.origin);if(separation.length()>.05){
   const shield=add(new THREE.BoxGeometry(.008,.5,.36),0xbde5f0,.28);
   shield.position.copy(rinse.origin).add(air.origin).multiplyScalar(.5);shield.position.y+=.12;
   shield.rotation.y=-Math.atan2(separation.z,separation.x);shield.name='WaterAirSplashPartition';
  }
 }
 let last={};
 return {preserve,group,
 update(dt,values={},canRun=()=>true){
  for(const code of stationCodes)if(canRun(code))times.set(code,(times.get(code)||0)+dt);
  const summary={};
  for(const e of effects){const t=times.get(e.code)||0,run=canRun(e.code),v=values;
   if(e.kind==='belt'){const enabled=run&&v[e.id+':runState']!=='PAUSED';if(enabled)e.phase+=dt*number(v,e.id+':conveyorSpeed',120)/1000;for(let i=0;i<e.markers.length;i++)e.markers[i].position[e.axis]=e.center[e.axis]-e.length/2+(e.phase+i*e.length/7)%e.length;summary.beltSpeed=number(v,e.id+':conveyorSpeed',120);summary.beltTravel=e.phase;}
   if(e.kind==='fill'){const flow=Math.max(1,number(v,'FIL-PUMP-01:flowRate',120)),volume=number(v,'FIL-HEAD-01:fillVolume',500),duration=volume/flow;if(run&&v['FIL-POS-01:runState']!=='PAUSED')e.phase+=dt;const active=run&&v['FIL-POS-01:runState']!=='PAUSED'&&e.phase%(duration+1)<duration;e.mesh.visible=active;e.mesh.scale.set(Math.sqrt(flow/120),1,Math.sqrt(flow/120));e.mesh.material.opacity=.5+.2*Math.sin(e.phase*flow/10)**2;summary.fillSeconds=duration;summary.flow=flow;summary.filling=active;summary.deliveredMl=Math.min(volume,(e.phase%(duration+1))*flow);}
   if(e.kind==='rinse'||e.kind==='air'){
    const water=e.kind==='rinse',id=water?'PT-WASH-01':'PT-AIR-01',duration=number(v,id+':'+(water?'washDuration':'airDuration'),water?15:10),flow=Math.max(0,number(v,id+':'+(water?'washFlow':'airFlow'),water?6:80)),ratio=flow/(water?6:80);
    const active=run&&flow>0&&(!v.__washPhase||v.__washPhase===e.kind)&&v[id+':runState']!=='PAUSED';e.rig.visible=active;
    if(active)e.phase+=dt*(.45+Math.sqrt(ratio)*.85);
    e.jets.forEach((mesh,i)=>{mesh.material.opacity=(water?.65:.23)+Math.min(1,ratio)*(water?.25:.32)+Math.sin(e.phase*13+i)*.055;});
    e.splashes.forEach((mesh,i)=>{const pulse=(e.phase*2+i*.21)%1;mesh.scale.setScalar(.6+pulse*1.7*Math.sqrt(ratio));mesh.material.opacity=(1-pulse)*.65;});
    for(let i=0;i<e.particles.count;i++){
     const t=(e.phase*(water?1.7:2.8)+i/e.particles.count)%1,outlet=i%(water?5:3),offset=(outlet/(water?4:2)-.5)*e.width,spread=(water?.035:.09)*t*Math.min(2,Math.sqrt(ratio)),angle=i*2.399;
     e.dummy.position.copy(e.origin).addScaledVector(e.side,offset+Math.cos(angle)*spread).addScaledVector(e.axis,t*e.length);
     if(water){e.dummy.position.y-=t*t*.055;e.dummy.position.z-=t*t*.2+Math.sin(angle)*spread;}else e.dummy.position.y+=Math.sin(angle)*spread;
     const scale=Math.min(1.8,Math.max(.45,Math.sqrt(ratio)));e.dummy.scale.set(water?scale:.7,water?scale:.7,water?scale:2.5+ratio);e.dummy.updateMatrix();e.particles.setMatrixAt(i,e.dummy.matrix);
    }
    e.particles.instanceMatrix.needsUpdate=true;summary[e.kind+'Flow']=flow;summary[e.kind+'Seconds']=duration;summary[e.kind+'Active']=active;summary[e.kind+'ParticleSpeed']=active?(.45+Math.sqrt(ratio)*.85):0;summary.cycleTime=e.phase%(duration+2);
   }
   if(e.drops){const speed=e.kind==='fill'?number(v,'FIL-PUMP-01:flowRate',120)/120:e.kind==='rinse'?number(v,'PT-WASH-01:washFlow',6)/6:number(v,'PT-AIR-01:airFlow',80)/80;for(let i=0;i<e.drops.length;i++){const drop=e.drops[i],travel=(e.phase*speed*2+i/e.drops.length)%1;drop.visible=e.mesh.visible;drop.position.copy(e.base);drop.position.y+=(e.up?1:-1)*(travel-.5)*e.length;const spread=e.up?travel*.035:.006;drop.position.x+=Math.sin(i*2.4+e.phase*4)*spread;drop.position.z+=Math.cos(i*2.4+e.phase*4)*spread;drop.scale.setScalar(e.kind==='fill'?Math.sqrt(speed):1);}}
   if(e.kind==='mix'){if(run&&v['BEV-MIX-01:runState']!=='PAUSED')e.phase+=dt*number(v,'BEV-MIX-01:mixSpeed',120)*Math.PI/30;e.pivot.rotation.y=e.phase;summary.mixAngle=e.phase;}
   if(e.kind==='light'){const brightness=number(v,e.code==='secondary'?'SEC-LIGHT-01:lightIntensity':'VIS-LIGHT-01:lightIntensity',70)/100,exposure=number(v,'SEC-LEVEL-01:exposure',1200)/5000,cameraId=e.code==='secondary'?'SEC-CAM-01':focus||'VIS-TOP-01';if(e.lamp){e.lamp.intensity=run?brightness*7:0;summary.lightPower=e.lamp.intensity;}for(const m of e.list){m.emissive?.setHex(0x9be9ff);m.emissiveIntensity=run&&v[cameraId+':cameraState']!=='PAUSED'?(e.code==='secondary'?exposure*2:brightness*2):0;}}
   if(e.kind==='scan'){const active=run&&v[e.cameraId+':cameraState']!=='PAUSED';if(active)e.phase+=dt;e.mesh.visible=active;e.mesh.position.copy(e.base);e.mesh.position.x+=Math.sin(e.phase*2)*.08;e.mesh.material.opacity=.1+number(v,'SEC-LEVEL-01:exposure',1200)/5000*.45;summary.scanActive=active;}
   if(e.kind==='reject'){const token=v.__previewAction;if(token&&token!==e.token){e.token=token;e.phase=0;}if(run)e.phase=Math.min(2,e.phase+dt);e.object.position.copy(e.base);e.object.position.x+=Math.sin(e.phase/2*Math.PI)*.18;summary.rejectProgress=e.phase/2;}
   if(e.kind==='swirl'){if(run&&v['BEV-MIX-01:runState']!=='PAUSED')e.phase+=dt*number(v,'BEV-MIX-01:mixSpeed',120)*Math.PI/30;e.swirl.forEach((m,i)=>{const angle=e.phase+i*Math.PI/6;m.position.copy(e.center).add(new THREE.Vector3(Math.cos(angle)*e.radius,Math.sin(angle*2)*.025,Math.sin(angle)*e.radius));});summary.mixAngle=e.phase;}
   if(e.kind==='seal'){const duration=number(v,'GAS-CHAMBER-01:settleTime',60);if(run)e.phase+=dt;const cycle=e.phase%(duration+2),lift=cycle<1?1-cycle:cycle>duration+1?cycle-duration-1:0;e.object.position.copy(e.base);e.object.position.z+=lift*.08;summary.settleSeconds=duration;summary.settleElapsed=Math.min(duration,Math.max(0,cycle-1));}
   if(e.kind==='heat'){const temperature=number(v,'BEV-HT-01:targetTemperature',85);for(const m of e.mats){m.emissive?.setHex(0xff642b);m.emissiveIntensity=run?(temperature-70)/30*.22:0;}summary.temperature=temperature;}
   if(e.kind==='force'){const force=number(v,'PK-GRIP-01:gripForce',25);e.mesh.material.opacity=.25+force/80*.65;summary.gripForce=force;}
   if(e.kind==='sample'){const duration=number(v,'GAS-PUMP-01:sampleDuration',30);if(run&&v['GAS-PUMP-01:runState']!=='PAUSED')e.phase+=dt;const active=run&&v['GAS-PUMP-01:runState']!=='PAUSED'&&e.phase%(duration+2)<duration;e.dots.forEach((m,i)=>{m.visible=active;m.position.copy(e.center);m.position.x+=((e.phase*.15+i*e.length/6)%e.length)-e.length/2;m.position.y+=.025;});summary.sampleSeconds=duration;summary.sampleElapsed=e.phase%(duration+2);}
  }
  last=summary;return summary;
 },get state(){return last;},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.removeFromParent();}};
}
