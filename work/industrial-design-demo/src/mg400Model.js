import * as THREE from 'three';
import {loadMG400Mapping,bindMG400Mapping} from './mg400Mapping.js';

// Reference program geometry/axis convention; physical installation needs calibration.
export function createMG400Model(){
 const root=new THREE.Group();root.name='MG400_Feedback_Rig';
 const material=new THREE.MeshStandardMaterial({color:0x2497ad,metalness:.45,roughness:.35});
 const box=(parent,size,pos)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);parent.add(m);};
 const joint=(parent,pos)=>{const g=new THREE.Group();g.position.set(...pos);parent.add(g);return g;};
 box(root,[.19,.055,.19],[0,.0275,0]);const j1=joint(root,[0,0,0]);box(j1,[.075,.173,.075],[0,.1415,0]);
 const j2=joint(j1,[0,.228,0]);box(j2,[.055,.175,.055],[0,.0875,0]);const j3=joint(j2,[0,.175,0]);box(j3,[.175,.045,.045],[.0875,0,0]);const wrist=joint(j3,[.175,0,0]);box(wrist,[.066,.035,.04],[.033,0,0]);const j4=joint(wrist,[.066,-.036,0]);box(j4,[.04,.05,.04],[0,-.025,0]);
 let applyMapping=null,disposed=false;
 root.userData.mappingState='正在读取模型映射';
 loadMG400Mapping().then(config=>{if(disposed)return;applyMapping=bindMG400Mapping(config,{j1,j2,j3,wrist,j4});root.userData.mappingState='';}).catch(error=>{if(disposed)return;root.userData.mappingState=error.message;console.error(error);});
 return {root,update(status){return applyMapping?applyMapping(status):false;},dispose(){disposed=true;root.traverse(o=>o.geometry?.dispose());material.dispose();}};
}
