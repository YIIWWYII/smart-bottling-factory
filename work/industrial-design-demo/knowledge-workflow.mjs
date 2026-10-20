import {randomUUID} from 'node:crypto';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const productFields={name:'名称',category:'种类',flavor:'口味',ingredients:'配料',spec:'包装规格',description:'介绍'};
export const deviceFields={manufacturer:'制造商',model:'型号',purpose:'用途',ratedVoltage:'额定电压',maintenance:'维护要求',constraints:'适用条件'};
export function validateFields(draft,capabilities){
 if(!Array.isArray(draft.fields)||!draft.fields.length||draft.fields.length>80)fail('至少需要一个标准字段，最多 80 个。');
 const keys=new Set();
 for(const f of draft.fields){
  if(!f||typeof f.key!=='string'||keys.has(f.key))fail('字段重复或无效。');keys.add(f.key);
  const c=capabilities.find(c=>c.id===f.key);
  if(draft.kind==='recipe'){
   if(!c||!['NUMBER','TEXT'].includes(c.type))fail('配方不能包含启动动作或未知参数。');
   if(f.unit!==c.unit)fail('参数单位必须与设备能力一致：'+c.label);
   if(c.type==='NUMBER'&&(typeof f.value!=='number'||!Number.isFinite(f.value)||f.value<c.min||f.value>c.max||(c.step&&Math.abs((f.value-c.min)/c.step-Math.round((f.value-c.min)/c.step))>1e-6)))fail('参数超出设备范围：'+c.label);
   if(c.type==='TEXT'&&(typeof f.value!=='string'||!/^A-0[1-3]-0[1-6]$/.test(f.value)))fail('库位无效。');
  }else if(!Object.hasOwn(draft.kind==='product'?productFields:deviceFields,f.key)||typeof f.value!=='string'||!f.value.trim()||f.value.length>3000)fail('标准字段无效。');
  const e=f.evidence;
  if(!e||typeof e.quote!=='string'||!e.quote.trim())fail('每个字段必须附原文或人工补充依据。');
  if(typeof f.unit!=='string')fail('字段单位无效。');
  const source=draft.sources.find(s=>s.id===e.sourceId&&s.version===e.version)||draft.answers.find(a=>a.id===e.sourceId);
  if(!source||!(source.content||source.text).includes(e.quote))fail('字段引用与原始资料不匹配。');
 }
}
export function workflow({db,user,requireRole,log,capabilities,canControl,validate,setControl,pause,activeTask,executeProtocol}){
 db.standardDrafts??=[];db.standardRecords??=[];db.standardExecutions??=[];
 const writable=()=>requireRole(user,['admin','engineer']);
 const get=id=>{const d=db.standardDrafts.find(x=>x.id===id);if(!d)fail('草稿不存在。',404);return d;};
 const edit=b=>{writable();const d=get(b.id);if(d.status==='published')fail('已发布版本不可修改，请创建修订。',409);if(b.version!==d.version)fail('草稿已更新，请刷新。',409);return d;};
 const changed=(d,action)=>{d.version++;d.updatedAt=new Date().toISOString();d.history.push({time:d.updatedAt,actor:user.name,action,version:d.version,fields:structuredClone(d.fields),questions:structuredClone(d.questions)});log(user,'标准数据'+action,d.title,'成功',{category:'knowledge'});return d;};
 const list=()=>({drafts:db.standardDrafts,records:db.standardRecords,executions:db.standardExecutions.slice(-40)});
 const apply=b=>{
  writable();if(typeof b.requestId!=='string'||b.requestId.length<8||b.requestId.length>100)fail('需要有效请求编号。');
  const prior=db.standardExecutions.find(x=>x.requestId===b.requestId);if(prior){if(prior.recordId!==b.recordId||prior.version!==b.version)fail('请求编号已用于其他配置。',409);return prior;}
  const r=db.standardRecords.find(r=>r.id===b.recordId&&r.version===b.version&&r.kind==='recipe');
  if(!r||db.documents.some(d=>d.standardId===r.id&&d.status!=='published')||db.standardRecords.some(x=>x.kind===r.kind&&x.targetId===r.targetId&&x.version>r.version))fail('只能应用当前已发布配方版本。',409);
  if(db.dataMode!=='simulation')fail('真实和混合模式未接通控制网关。',409);if(db.interlock)fail('安全联锁未解除。',409);
  if(b.confirmed!==true)fail('需要确认应用此版本。');
  const task=activeTask(),p=db.products.find(p=>p.id===r.targetId);if(task&&task.name!==p?.name&&!p?.aliases?.includes(task.name))fail('当前任务产品与配方不符，请先处理当前任务。',409);
  validateFields(r,capabilities);
  for(const f of r.fields){const c=capabilities.find(c=>c.id===f.key);validate(c,f.value);if(!canControl(user,c.stageIndex))fail('没有全部涉及工位的控制权限。',403);}
  // 协议设备由适配器执行；数据库状态不能代替寄存器回读。
  if(db.protocolEnabled){if(!executeProtocol)fail('协议配方执行器未接入。',409);return executeProtocol(r,b,user);}
  const before=Object.fromEntries(r.fields.map(f=>[f.key,db.controls[f.key]]));pause();
  for(const f of r.fields)setControl(capabilities.find(c=>c.id===f.key),f.value);
  db.activeProduct=r.targetId;
  const execution={id:randomUUID(),requestId:b.requestId,recordId:r.id,version:r.version,targetId:r.targetId,time:new Date().toISOString(),status:'applied_paused',reason:'已按数据库标准版本应用虚拟设备参数并保持暂停，等待人工核对恢复。',source:'simulation',actor:user.name,before,after:Object.fromEntries(r.fields.map(f=>[f.key,db.controls[f.key]]))};
  db.standardExecutions.push(execution);db.lastDecision={id:execution.id,time:execution.time,productCode:r.targetId,status:'applied',source:'标准数据工具 / 模拟',reason:execution.reason,recipe:{id:r.id,title:r.title,version:r.version,settings:execution.after}};for(const stageIndex of new Set(r.fields.map(f=>capabilities.find(c=>c.id===f.key).stageIndex)))log(user,'AI 工位决策',r.title+' / V'+r.version+'；应用标准参数后保持暂停','成功',{category:'ai',stageIndex,after:{executionId:execution.id,changes:r.fields.filter(f=>capabilities.find(c=>c.id===f.key).stageIndex===stageIndex).map(f=>({parameter:f.key,before:before[f.key],after:f.value,unit:f.unit}))}});log(user,'应用标准配方',r.title+' / V'+r.version+'；虚拟设备回读一致，保持暂停','成功',{category:'ai',before,after:execution});return execution;
 };
 return {list,apply,route(action,b){
  if(action==='list')return list();writable();
  if(action==='template'){
   if(!['product','recipe'].includes(b.kind))fail('模板类型无效。');
   const p=b.newProduct&&b.kind==='product'?{id:randomUUID(),name:b.values?.name}:db.products.find(p=>p.id===b.targetId);if(!p)fail('请选择产品。');if(b.newProduct&&db.products.some(x=>x.name===p.name||x.aliases?.includes(p.name)))fail('产品名称已存在。');
   if(!b.values||typeof b.values!=='object'||Array.isArray(b.values))fail('模板字段无效。');
   const keys=b.kind==='product'?Object.keys(productFields):capabilities.filter(c=>['NUMBER','TEXT'].includes(c.type)).map(c=>c.id);
   if(Object.keys(b.values).some(k=>!keys.includes(k)))fail('包含模板以外的字段。');
   if(b.kind==='product'&&keys.some(k=>typeof b.values[k]!=='string'||!b.values[k].trim()))fail('请填写全部产品固定项；未知内容请先核实。');
   if(typeof b.basis!=='string'||b.basis.trim().length<5||b.basis.length>3000)fail('请填写适用条件及资料依据（5–3000 字）。');
   const source={id:randomUUID(),version:1,title:p.name+' · '+(b.kind==='product'?'产品':'生产')+'标准模板',content:JSON.stringify({templateVersion:1,kind:b.kind,targetId:b.targetId,values:b.values,basis:b.basis},null,2)};
   const fields=Object.entries(b.values).map(([key,value])=>({key,value,unit:b.kind==='recipe'?capabilities.find(c=>c.id===key)?.unit||'':'',evidence:{sourceId:source.id,version:1,quote:JSON.stringify(value)}}));
   const d={id:randomUUID(),templateVersion:1,newProduct:b.newProduct===true,baseVersion:Math.max(0,...db.standardRecords.filter(r=>r.kind===b.kind&&r.targetId===b.targetId).map(r=>r.version)),kind:b.kind,targetId:p.id,title:source.title,version:1,status:'draft',sources:[source],answers:[],fields,questions:[],history:[],updatedAt:new Date().toISOString()};
   validateFields(d,capabilities);db.documents.push({...source,kind:'document',status:'pending',owner:user.name,updated:d.updatedAt});db.standardDrafts.unshift(d);log(user,'提交产品标准模板',d.title);return d;
  }
  if(action==='audit'){
   const d=edit(b);if(!d.templateVersion)fail('请使用固定模板提交。');
   if(!b.result||typeof b.result.passed!=='boolean'||!Array.isArray(b.result.issues)||b.result.issues.some(x=>typeof x!=='string'||x.length>1500))fail('AI 审核格式无效。',502);
   d.aiReview={...b.result,model:b.model,time:new Date().toISOString()};d.questions=b.result.issues.map(text=>({text,resolved:false,blocking:true}));d.status='review';return changed(d,'AI 审核模板');
  }
  if(action==='create'){
   if(!['product','device','recipe'].includes(b.kind))fail('请选择标准数据类型。');
   const target=b.kind==='device'?capabilities.find(c=>c.device===b.targetId):db.products.find(p=>p.id===b.targetId);if(!target)fail('目标产品或设备不存在。');
   if(!Array.isArray(b.sourceIds)||!b.sourceIds.length||b.sourceIds.length>12)fail('请选择 1–12 份原始资料。');
   const sources=[...new Set(b.sourceIds)].map(id=>{const s=db.documents.find(d=>d.id===id&&d.kind==='document');if(!s)fail('原始资料不存在。');return {id:s.id,title:s.title,version:s.version,content:s.content};});
   if(sources.reduce((n,s)=>n+s.content.length,0)>90000)fail('本次资料总正文请控制在 9 万字内。');
   const d={id:randomUUID(),baseVersion:Math.max(0,...db.standardRecords.filter(r=>r.kind===b.kind&&r.targetId===b.targetId).map(r=>r.version)),kind:b.kind,targetId:b.targetId,title:(target.name||target.device)+' · '+({product:'产品数据',device:'设备数据',recipe:'工艺配方'}[b.kind]),version:1,status:'draft',sources,answers:[],fields:[],questions:[],history:[],updatedAt:new Date().toISOString()};
   db.standardDrafts.unshift(d);log(user,'建立标准数据草稿',d.title);return d;
  }
  if(action==='revise'){
   const r=db.standardRecords.find(r=>r.id===b.recordId);if(!r)fail('版本不存在。',404);
   const d={...structuredClone(r),newProduct:false,baseVersion:Math.max(0,...db.standardRecords.filter(x=>x.kind===r.kind&&x.targetId===r.targetId).map(x=>x.version)),id:randomUUID(),version:1,status:'draft',history:[],updatedAt:new Date().toISOString()};delete d.publishedBy;delete d.publishedAt;
   d.sources=d.sources.map(s=>{const current=db.documents.find(x=>x.id===s.id);return current?{id:current.id,title:current.title,version:current.version,content:current.content}:s;});
   d.fields=[];d.questions=[];db.standardDrafts.unshift(d);log(user,'建立标准数据修订',d.title);return d;
  }
  if(action==='apply')return apply(b);
  const d=edit(b);
  if(action==='answer'){
   if(typeof b.text!=='string'||!b.text.trim()||b.text.length>12000)fail('请填写补充或纠正说明（最多 12000 字）。');
   d.answers.push({id:randomUUID(),text:b.text.trim(),actor:user.name,time:new Date().toISOString()});
   d.status='draft';d.questions=d.questions.map(q=>({...q,resolved:false}));return changed(d,'补充资料');
  }
  if(action==='save'){
   if(d.templateVersion&&JSON.stringify(b.fields)!==JSON.stringify(d.fields))fail('模板字段变更请重新提交并审核。',409);
   const candidate={...d,fields:b.fields};validateFields(candidate,capabilities);
   if(!Array.isArray(b.questions)||b.questions.length>40||b.questions.some(q=>typeof q.text!=='string'||!q.text.trim()||q.text.length>1500||typeof q.resolved!=='boolean'))fail('问题清单无效。');
   if(b.questions.some(q=>q.resolved&&(typeof q.resolution!=='string'||q.resolution.trim().length<2||q.resolution.length>3000)))fail('请记录已确认问题的处理依据。');
   d.fields=structuredClone(b.fields);d.questions=b.questions.map(q=>({text:q.text,resolved:q.resolved,resolution:q.resolution||'',blocking:q.blocking!==false}));d.status='review';return changed(d,'人工核对');
  }
  if(action==='extract'){
   const result=b.result;if(!result||!Array.isArray(result.fields)||!Array.isArray(result.questions)||result.questions.length>40)fail('AI 提取格式无效。',502);
   if(result.fields.length)validateFields({...d,fields:result.fields},capabilities);
   if(result.questions.some(q=>typeof q.text!=='string'||!q.text.trim()||q.text.length>1500))fail('AI 提问格式无效。',502);
   if(result.fields.length>80)fail('AI 字段过多。',502);d.fields=structuredClone(result.fields);d.questions=result.questions.map(q=>({text:q.text,resolved:false,blocking:q.blocking!==false}));d.model=b.model;d.status='review';return changed(d,'AI 提取');
  }
  if(action==='publish'){
   if(b.confirmed!==true)fail('请确认发布。');if(d.templateVersion&&d.aiReview&&!d.aiReview.passed)fail('AI 审核未通过，请纠正模板后重新提交。',409);validateFields(d,capabilities);
   if(d.status!=='review'||d.questions.some(q=>q.blocking&&!q.resolved))fail('请完成字段核对及必答问题。',409);
   if(d.sources.some(s=>db.documents.find(x=>x.id===s.id)?.version!==s.version))fail('原始资料已更新，请建立新草稿重新提取。',409);
   if(d.newProduct){const values=Object.fromEntries(d.fields.map(f=>[f.key,f.value]));if(db.products.some(p=>p.name===values.name||p.aliases?.includes(values.name)))fail('产品名称已存在。',409);db.products.push({id:d.targetId,...values,version:0,enabled:true,aliases:[],documentIds:[],modelUrl:'',backgroundUrl:''});}
   const version=1+Math.max(0,...db.standardRecords.filter(r=>r.kind===d.kind&&r.targetId===d.targetId).map(r=>r.version));
   if((d.baseVersion||0)!==version-1)fail('已有更新的发布版本，请基于当前版本创建修订。',409);
   const r={...structuredClone(d),id:randomUUID(),version,status:'published',publishedAt:new Date().toISOString(),publishedBy:user.name};db.standardRecords.push(r);
   if(d.kind==='product'){const p=db.products.find(p=>p.id===d.targetId);if(!p)fail('产品已删除。',409);if(d.fields.some(f=>f.key==='name'&&f.value!==p.name))fail('请在产品资源中修改名称及别名，避免破坏任务关联。');Object.assign(p,Object.fromEntries(d.fields.map(f=>[f.key,f.value])));p.version++;p.updatedAt=r.publishedAt;}
   if(d.kind!=='recipe'){
    for(const x of db.documents)if(x.standardTarget===d.targetId&&x.standardKind===d.kind&&x.status==='published')x.status='superseded';
    db.documents.push({id:r.id,title:r.title,kind:'document',status:'published',version,standardId:r.id,standardTarget:d.targetId,standardKind:d.kind,owner:user.name,updated:r.publishedAt,content:d.fields.map(f=>f.key+'：'+String(f.value)+' '+f.unit+'；依据：'+f.evidence.quote).join('\n')+'\n来源：'+d.sources.map(s=>s.title+' V'+s.version).join('；')});
    if(d.kind==='product'){const p=db.products.find(p=>p.id===d.targetId);p.documentIds=[...(p.documentIds||[]),r.id];}
   }
   if(d.kind==='recipe'){
    const p=db.products.find(p=>p.id===d.targetId);if(!p)fail('产品已删除。',409);
    for(const x of db.documents)if(x.kind==='recipe'&&x.productCode===p.id&&x.status==='published')x.status='superseded';
    db.documents.push({id:r.id,title:r.title,productName:p.name,productCode:p.id,kind:'recipe',status:'published',version,standardId:r.id,owner:user.name,updated:r.publishedAt,content:'经审核的标准化配方；仅限模拟产线。来源：'+d.sources.map(s=>s.title+' V'+s.version).join('；'),settings:Object.fromEntries(d.fields.map(f=>[f.key,f.value]))});p.recipeId=r.id;p.version++;
   }
   d.status='published';d.recordId=r.id;changed(d,'发布');return r;
  }
  fail('操作不存在。',404);
 }};
}
