import {loadMG400Mapping,bindMG400Mapping} from './mg400Mapping.js';

// 此 GLB 使用刚性关节层级。真实模式不播放文件里的动画片段。
export async function bindBlenderMG400(root,{hidePayload=true,config:providedConfig}={}){
 const config=providedConfig||await loadMG400Mapping();
 if(!config.blenderBindings?.length)throw Error('缺少 Blender 关节映射');
 const normalize=name=>name.replaceAll('.','');
 const nodes=new Map();
 root.traverse(node=>nodes.set(normalize(node.name),node));
 const bindings=[config.blenderBindings,config.practiceBindings].find(items=>items?.length&&items.every(item=>nodes.has(normalize(item.target))));
 if(!bindings){
  const names=[...nodes.values()].filter(node=>node.isBone).map(node=>node.name);
  throw Error(`模型骨骼与映射配置不一致。当前骨骼：${names.join('、')||'未找到骨骼'}`);
 }
 const targets={};
 for(const binding of bindings)targets[binding.target]=nodes.get(normalize(binding.target));
 root.traverse(node=>{if(hidePayload&&normalize(node.name).startsWith('Authored_Bottle'))node.visible=false;});
 return bindMG400Mapping({...config,bindings},targets);
}
