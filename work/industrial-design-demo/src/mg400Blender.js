import {loadMG400Mapping,bindMG400Mapping} from './mg400Mapping.js';

// 此 GLB 使用刚性关节层级。真实模式不播放文件里的动画片段。
export async function bindBlenderMG400(root,{hidePayload=true}={}){
 const config=await loadMG400Mapping();
 if(!config.blenderBindings?.length)throw Error('缺少 Blender 关节映射');
 const normalize=name=>name.replaceAll('.','');
 const targets={};
 for(const binding of config.blenderBindings){
  root.traverse(node=>{if(normalize(node.name)===normalize(binding.target))targets[binding.target]=node;});
  if(!targets[binding.target])throw Error('Blender 模型缺少关节 '+binding.target);
 }
 root.traverse(node=>{if(hidePayload&&normalize(node.name).startsWith('Authored_Bottle'))node.visible=false;});
 return bindMG400Mapping({...config,bindings:config.blenderBindings},targets);
}
