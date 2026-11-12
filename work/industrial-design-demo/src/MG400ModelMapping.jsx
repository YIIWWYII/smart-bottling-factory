import {useEffect,useState} from 'react';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindBlenderMG400,modelJointNodes} from './mg400Blender.js';
import {api} from './TwinState';
const sources=[['J1',[1,0,0,0]],['−J1',[-1,0,0,0]],['J2',[0,1,0,0]],['−J2',[0,-1,0,0]],['J3',[0,0,1,0]],['−J3',[0,0,-1,0]],['J4',[0,0,0,1]],['−J4',[0,0,0,-1]],['J2＋J3',[0,1,1,0]],['−J2−J3',[0,-1,-1,0]]];
const empty=()=>({version:1,feedbackField:'q_actual',staleAfterMs:1500,relativeToRest:true,bindings:Array.from({length:4},(_,i)=>({target:'',axis:i===0||i===3?'y':'z',weights:Array.from({length:4},(_,j)=>i===j?1:0),offsetDeg:0}))});
function release(root){root?.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean)){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});}
export default function MG400ModelMapping({asset,canConfigure,onSaved}){
 const [root,setRoot]=useState(null),[nodes,setNodes]=useState([]),[draft,setDraft]=useState(empty),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[facts,setFacts]=useState(null);
 useEffect(()=>{let alive=true,model;setRoot(null);setNodes([]);setFacts(null);setMessage('正在读取模型节点…');
  if(!asset?.modelUrl){setMessage('请先在设备资产中导入 GLB 模型。');return;}
  new GLTFLoader().loadAsync(asset.modelUrl).then(async g=>{
   model=g.scene;if(!alive){release(model);return;}
   const names=modelJointNodes(model).map(n=>n.name);setNodes(names);setRoot(model);
   let vertices=0,missingNormals=0,meshes=0;const materials=new Set();model.traverse(o=>{if(!o.isMesh)return;meshes++;vertices+=o.geometry.attributes.position?.count||0;if(!o.geometry.attributes.normal)missingNormals++;for(const m of [o.material].flat().filter(Boolean))materials.add(m.name||'未命名材质');});setFacts({meshes,vertices,missingNormals,materials:[...materials]});
   if(asset.mg400Mapping){setDraft(structuredClone(asset.mg400Mapping));setMessage('已读取此设备保存的模型映射。');}
   else try{const apply=await bindBlenderMG400(model);if(alive){setDraft(apply.mapping);setMessage('已识别既有节点规则；可以直接查看设备操作。');}}catch{if(alive){setDraft(empty());setMessage('新模型尚未匹配。请逐行选择模型节点及其对应的 J1—J4 数据。');}}
  }).catch(e=>alive&&setMessage('模型读取失败：'+e.message));return()=>{alive=false;release(model);};
 },[asset?.modelUrl,asset?.mg400Mapping]);
 const change=(index,values)=>setDraft(d=>({...d,bindings:d.bindings.map((b,i)=>i===index?{...b,...values}:b)}));
 const save=async mapping=>{setBusy(true);setMessage('');try{
  if(mapping)await bindBlenderMG400(root,{mapping});
  await api('/api/ops/assets/model-mapping',{id:asset.id,version:asset.version,modelUrl:asset.modelUrl,mapping});await onSaved();setMessage(mapping?'模型映射已保存，请返回设备操作查看模拟反馈。':'已恢复默认节点规则。');
 }catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <section className="mg400-mapping-editor"><h4>模型与关节</h4><p>导入模型只完成外形加载。这里把模型里的骨骼或空物体，对应到机械臂的 J1—J4 角度。底座不要加入运动关节表。此设置只控制画面，不会向实机下发动作。</p>
 {facts&&<p>已读取 {facts.meshes} 个网格、{facts.vertices.toLocaleString()} 个顶点、{facts.materials.length} 种材质。{facts.missingNormals?'有 '+facts.missingNormals+' 个网格未导出法线，请检查 Blender 导出设置。':''}</p>}
 <form onSubmit={e=>{e.preventDefault();void save(draft);}}><fieldset disabled={busy||!canConfigure||!root}>
 <label><input type="checkbox" checked={draft.relativeToRest} onChange={e=>setDraft({...draft,relativeToRest:e.target.checked})}/> 在导出的静止姿态上叠加角度</label><p>转轴是模型导入后的局部轴。Blender 的 Z 向上导出到网页后会变为 Y 向上；方向相反时选择带“−”的关节数据。静止姿态不是零位时，用角度补偿校准。</p>
 <div className="mg400-mapping-table"><table><thead><tr><th>模型节点</th><th>局部转轴</th><th>关节数据</th><th>角度补偿 °</th><th>操作</th></tr></thead><tbody>{draft.bindings.map((row,i)=>{const custom=!sources.some(([,v])=>JSON.stringify(v)===JSON.stringify(row.weights));return <tr key={i}><td><select aria-label={'关节 '+(i+1)+' 模型节点'} required value={row.target} onChange={e=>change(i,{target:e.target.value})}><option value="">请选择骨骼／空物体</option>{[...new Set([...nodes,row.target].filter(Boolean))].map(n=><option key={n} value={n}>{n}</option>)}</select></td><td><select aria-label={'关节 '+(i+1)+' 转轴'} value={row.axis} onChange={e=>change(i,{axis:e.target.value})}>{['x','y','z'].map(a=><option key={a} value={a}>{a.toUpperCase()}</option>)}</select></td><td><select aria-label={'关节 '+(i+1)+' 数据'} value={JSON.stringify(row.weights)} onChange={e=>change(i,{weights:JSON.parse(e.target.value)})}>{sources.map(([label,v])=><option key={label} value={JSON.stringify(v)}>{label}</option>)}{custom&&<option value={JSON.stringify(row.weights)}>自定义组合 {row.weights.join(',')}</option>}</select></td><td><input type="number" aria-label={'关节 '+(i+1)+' 补偿'} required step="any" value={row.offsetDeg} onChange={e=>change(i,{offsetDeg:Number(e.target.value)})}/></td><td><button type="button" onClick={()=>setDraft({...draft,bindings:draft.bindings.filter((_,j)=>j!==i)})}>移除行</button></td></tr>;})}</tbody></table></div>
 <div className="mg400-actions"><button type="button" disabled={draft.bindings.length>=32} onClick={()=>setDraft({...draft,bindings:[...draft.bindings,{target:'',axis:'z',weights:[0,1,0,0],offsetDeg:0}]})}>添加从动关节</button><button type="submit">保存模型映射</button><button type="button" onClick={()=>void save(null)}>恢复默认规则</button></div>
 </fieldset></form><p role="status">{message}</p><details><summary>倒角与颜色不一致时，检查导出设置</summary><p>在 Blender 的“修改器”面板确认倒角确实生成了几何。导出 GLB 时开启“应用修改器”和“法线”，只导出选中的模型根节点及全部子物体。材质使用 Principled BSDF（原理化 BSDF），颜色写入材质的基础色；视口“随机颜色”、材质预览的环境和程序纹理不会自动变成网页材质，程序纹理需先烘焙为贴图。先重新导入导出的 GLB 对照，区分导出丢失与平台显示差异。</p></details>
 </section>;
}
