import {randomUUID} from 'node:crypto';
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
export function managementRoute({db,p,body:b,write,user,requireRole,log}){
 db.formulas??=[];db.strategies??=[];db.materialUsage??=[];
 if(p==='/api/ops/management'&&!write)return {daily:Object.values(db.dailyMetrics||{}).filter(x=>x.mode===db.dataMode),tasks:db.tasks.filter(x=>(x.dataMode||'simulation')===db.dataMode),formulas:db.formulas,strategies:db.strategies.filter(x=>x.mode===db.dataMode),usage:db.materialUsage.filter(x=>x.mode===db.dataMode)};
 requireRole(user,['admin','engineer']);
 if(p==='/api/ops/material-usage'){
  if(!db.materials.some(m=>m.id===b.materialId)||!/^\d{4}-\d{2}-\d{2}$/.test(b.day))fail('请选择物料和日期。');
  if(![b.planned,b.used].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||!b.reason?.trim())fail('用量需为非负数，并填写调整依据。');
  const old=db.materialUsage.find(x=>x.materialId===b.materialId&&x.day===b.day&&x.mode===db.dataMode);if(old&&old.version!==b.version)fail('用量已更新，请刷新。',409);
  const item={materialId:b.materialId,day:b.day,mode:db.dataMode,planned:b.planned,used:b.used,reason:String(b.reason).slice(0,1000),version:(old?.version||0)+1,updatedAt:new Date().toISOString()};if(old)Object.assign(old,item);else db.materialUsage.push(item);log(user,'修改物料用量',b.materialId,'成功',{after:item});return item;
 }
 const list=p.endsWith('formulas')?db.formulas:db.strategies,old=list.find(x=>x.id===b.id);
 if(b.id&&!old)fail('记录不存在。',404);if(old&&old.version!==b.version)fail('记录已更新，请重新打开。',409);
 if(b.action==='delete'){if(!old||b.confirmed!==true)fail('请确认删除。');if(p.endsWith('strategies')&&old.status!=='draft')fail('已采用方案请关闭，保留执行关联。');list.splice(list.indexOf(old),1);log(user,'删除'+(p.endsWith('formulas')?'配方':'运营方案'),old.title||old.productId,'成功',{before:old});return {ok:true};}
 if(p.endsWith('formulas')){
  if(!db.products.some(p=>p.id===b.productId)||typeof b.title!=='string'||!b.title.trim()||!Number.isFinite(b.batchSize)||b.batchSize<=0||typeof b.batchUnit!=='string'||!b.batchUnit.trim())fail('填写产品、配方名称和基准批量。');
  if(!Array.isArray(b.ingredients)||!b.ingredients.length||b.ingredients.some(i=>!db.materials.some(m=>m.id===i.materialId)||typeof i.amount!=='number'||!Number.isFinite(i.amount)||i.amount<=0))fail('每项原料需关联已有物料，并填写正数用量。');
  if(new Set(b.ingredients.map(i=>i.materialId)).size!==b.ingredients.length)fail('请合并重复原料。');
  if(typeof b.steps!=='string'||!b.steps.trim())fail('请填写投料及制作步骤。');
  const item={id:old?.id||randomUUID(),version:(old?.version||0)+1,productId:b.productId,title:b.title.slice(0,100),batchSize:b.batchSize,batchUnit:b.batchUnit.slice(0,20),ingredients:b.ingredients.map(i=>({materialId:i.materialId,amount:i.amount,unit:db.materials.find(m=>m.id===i.materialId).unit})),steps:b.steps.slice(0,10000),history:old?[...(old.history||[]),{version:old.version,title:old.title,ingredients:old.ingredients,steps:old.steps,batchSize:old.batchSize,batchUnit:old.batchUnit}]:[],updatedAt:new Date().toISOString()};if(old)list[list.indexOf(old)]=item;else list.push(item);log(user,'保存产品配方',item.title,'成功',{after:item});return item;
 }
 if(!['production','stock'].includes(b.kind)||typeof b.title!=='string'||!b.title.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(b.start)||!/^\d{4}-\d{2}-\d{2}$/.test(b.end)||b.end<b.start||typeof b.target!=='number'||!Number.isFinite(b.target)||b.target<=0)fail('请填写方案目标、周期与名称。');
 const target=(b.kind==='production'?db.products:db.materials).find(x=>x.id===b.targetId);if(!target)fail('目标产品或物料不存在。');
 if(b.taskIds!==undefined&&(!Array.isArray(b.taskIds)||b.taskIds.some(id=>typeof id!=='string')))fail('任务关联格式无效。');const taskIds=[...new Set(b.taskIds||[])];if(taskIds.some(id=>!db.tasks.some(t=>t.id===id&&!t.deletedAt&&(t.dataMode||'simulation')===db.dataMode&&b.kind==='production'&&(t.name===target.name||target.aliases?.includes(t.name)))))fail('只能关联本模式、本产品的有效任务。');
 if(old&&old.status!=='draft'&&(old.targetId!==b.targetId||old.kind!==b.kind))fail('采用后不可替换执行对象。');
 const status=b.status||'draft';if(!['draft','adopted','closed'].includes(status)||old?.status==='closed'&&status!=='closed'||old?.status==='adopted'&&status==='draft')fail('方案状态不允许回退。');
 const item={id:old?.id||randomUUID(),version:(old?.version||0)+1,mode:db.dataMode,title:b.title.slice(0,100),kind:b.kind,targetId:b.targetId,target:b.target,start:b.start,end:b.end,basis:String(b.basis||'').slice(0,5000),measures:String(b.measures||'').slice(0,5000),owner:String(b.owner||'').slice(0,80),status,taskIds,updatedAt:new Date().toISOString()};if(!item.basis.trim()||!item.measures.trim())fail('请填写数据依据和措施。');if(old)list[list.indexOf(old)]=item;else list.push(item);log(user,'保存运营方案',item.title,'成功',{before:old||null,after:item});return item;
}
