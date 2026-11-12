import {loadMG400Mapping,bindMG400Mapping,validateAssetMG400Mapping} from './mg400Mapping.js';
import {Quaternion,Vector3} from 'three';

// Match original names first. Numeric suffix tolerance never resolves ambiguous joints.
export function modelJointNodes(root){
 const nodes=[];root.traverse(node=>{if(node.name&&(node.isBone||node.isMesh||node.children.length))nodes.push(node);});return nodes;
}
export async function bindBlenderMG400(root,{hidePayload=true,config:providedConfig,mapping=null}={}){
 const config=mapping?validateAssetMG400Mapping(mapping):(providedConfig||await loadMG400Mapping());
 const all=[];root.traverse(node=>all.push(node));
 const normalize=name=>name.replaceAll('.','');
 const resolve=target=>{
  const exact=all.filter(node=>node.name===target);if(exact.length)return exact.length===1?exact[0]:null;
  const normalized=all.filter(node=>normalize(node.name)===normalize(target));if(normalized.length)return normalized.length===1?normalized[0]:null;
  const base=target.replace(/\.\d+$/,'');
  const matches=all.filter(node=>{const name=normalize(node.name),key=normalize(base);return node.name.replace(/\.\d+$/,'')===base||name.startsWith(key)&&/^\d{3,}$/.test(name.slice(key.length));});
  return matches.length===1?matches[0]:null;
 };
 const bindings=(mapping?[config.bindings]:[config.blenderBindings,config.practiceBindings]).find(items=>items?.length&&items.every(item=>resolve(item.target)));
 if(!bindings)throw Error('尚未匹配模型关节。请打开“模型与关节”，选择新模型的节点、转轴和关节数据。');
 const targets={},resolved=new Set();
 for(const binding of bindings){const node=resolve(binding.target);if(resolved.has(node))throw Error('多个关节映射指向同一节点，请检查模型与关节配置。');resolved.add(node);targets[binding.target]=node;}
 root.traverse(node=>{if(hidePayload&&normalize(node.name).startsWith('Authored_Bottle'))node.visible=false;});
 const selected={...config,bindings};
 let apply;
 if(mapping?.relativeToRest){
  const angles=Object.fromEntries(bindings.map(b=>[b.target,{rotation:{x:0,y:0,z:0}}]));
  const update=bindMG400Mapping(selected,angles);
  const rest=bindings.map(b=>targets[b.target].quaternion.clone());
  const axes=bindings.map(b=>new Vector3(b.axis==='x'?1:0,b.axis==='y'?1:0,b.axis==='z'?1:0)),rotation=new Quaternion();
  apply=(status,now=Date.now())=>{if(!update(status,now))return false;bindings.forEach((b,i)=>targets[b.target].quaternion.copy(rest[i]).multiply(rotation.setFromAxisAngle(axes[i],angles[b.target].rotation[b.axis])));return true;};
 }else apply=bindMG400Mapping(selected,targets);
 apply.mapping={version:1,feedbackField:config.feedbackField,staleAfterMs:config.staleAfterMs,relativeToRest:!!mapping?.relativeToRest,bindings:bindings.map(b=>({...b,target:targets[b.target].name}))};
 return apply;
}
