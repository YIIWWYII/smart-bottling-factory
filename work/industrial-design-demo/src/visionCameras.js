import * as THREE from 'three';
export const visionCameras=[{id:'VIS-TOP-01',label:'顶部相机',angle:null},{id:'VIS-SIDE-01',label:'侧面 0°',angle:0},{id:'VIS-SIDE-02',label:'侧面 120°',angle:120},{id:'VIS-SIDE-03',label:'侧面 240°',angle:240}];
export const secondaryCameras=visionCameras.map((c,i)=>({...c,id:i===0?'SEC-CAM-01':`SEC-SIDE-0${i}`}));
export const inspectionCameras=stageIndex=>stageIndex===5?secondaryCameras:visionCameras;
export const inspectionTarget=new THREE.Vector3(0,1.14,0);
export function cameraPosition(spec){if(spec.angle===null)return new THREE.Vector3(0,1.82,0);const a=THREE.MathUtils.degToRad(spec.angle);return new THREE.Vector3(Math.sin(a)*.66,1.15,Math.cos(a)*.66);}
// Reuse the authored camera body/lens; all four viewers use these same extrinsics.
export function installVisionCameras(root){for(const code of ['vision','secondary'])installCameraRig(root,code);}
function installCameraRig(root,code){
 const asset=root.getObjectByName('Asset_'+code);if(!asset)return;
 const find=name=>{let found;asset.traverse(o=>{if(o.name.replaceAll('_',' ').replace(/\.?\d+$/,'')===name)found=o;});return found;};
 const body=find('Side camera'),lens=find('Side camera lens');if(!body||!lens)return;
 const sources=[body,lens];const center=body.position.clone();
 const templates=sources.map(o=>{const copy=o.clone();copy.geometry=o.geometry.clone();copy.material=o.material.clone();copy.position.sub(center);delete copy.userData.webId;return copy;});
 for(const name of ['Side camera','Side camera lens','Top camera','Top lens'])find(name)?.removeFromParent();
 for(const spec of inspectionCameras(code==='secondary'?5:2)){const group=new THREE.Group();group.name='VisionRig_'+spec.id;group.userData.webDevice=code;group.userData.cameraId=spec.id;group.position.copy(cameraPosition(spec));group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),inspectionTarget.clone().sub(group.position).normalize());
  for(const t of templates){const o=t.clone();o.name=spec.id+'_camera_'+t.name.replaceAll(' ','_');o.userData={webDevice:code,cameraId:spec.id};group.add(o);}asset.add(group);
 }
}
