// Display-only mapping. No controller commands or expression evaluation.
let configPromise;
export function loadMG400Mapping(){
 return configPromise??=fetch(`${import.meta.env?.BASE_URL||'/'}config/mg400-model-mapping.json`,{cache:'no-store'})
  .then(response=>{if(!response.ok)throw Error(`映射配置读取失败 (${response.status})`);return response.json();});
}

export function bindMG400Mapping(config,targets){
 const fail=message=>{throw Error(`MG400 模型映射：${message}`);};
 if(config?.version!==1)fail('不支持的配置版本');
 if(typeof config.feedbackField!=='string'||!config.feedbackField.trim())fail('缺少反馈字段');
 if(!Number.isFinite(config.staleAfterMs)||config.staleAfterMs<=0)fail('反馈有效期必须为正数');
 if(!Array.isArray(config.bindings)||!config.bindings.length)fail('缺少关节映射');
 const seen=new Set();
 const bindings=config.bindings.map(binding=>{
  if(!binding||!Object.hasOwn(targets,binding.target))fail(`未知节点 ${binding?.target}`);
  if(!['x','y','z'].includes(binding.axis))fail(`无效旋转轴 ${binding.axis}`);
  if(seen.has(binding.target))fail(`重复节点 ${binding.target}`);seen.add(binding.target);
  if(!Array.isArray(binding.weights)||binding.weights.length!==4||!binding.weights.every(Number.isFinite))fail(`${binding.target} 的 weights 必须为四个有限数字`);
  if(!Number.isFinite(binding.offsetDeg))fail(`${binding.target} 的 offsetDeg 必须为有限数字`);
  return {...binding,node:targets[binding.target]};
 });
 if(seen.size!==Object.keys(targets).length)fail('必须包含全部模型关节');
 return (status,now=Date.now())=>{
  const age=now-status?.receivedAt,q=status?.feedback?.[config.feedbackField];
  if(!status?.online||!Number.isFinite(status.receivedAt)||age<0||age>config.staleAfterMs||!Array.isArray(q)||q.length<4||!q.slice(0,4).every(Number.isFinite))return false;
  const angles=bindings.map(b=>(b.weights.reduce((sum,w,i)=>sum+w*q[i],b.offsetDeg))*Math.PI/180);
  if(!angles.every(Number.isFinite))return false;
  // Apply the complete frame together. Do not clamp actual feedback to nominal limits.
  bindings.forEach((b,i)=>{b.node.rotation[b.axis]=angles[i];});
  return true;
 };
}
