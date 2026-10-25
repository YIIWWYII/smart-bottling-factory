import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {alarmRules} from './src/alarmRules.js';
import {capabilities} from './src/controlCapabilities.js';
import {productDefaults} from './src/product-resources.js';
import {stages} from './src/data.js';

const root=process.env.BOTTLE_KNOWLEDGE_ROOT||fileURLToPath(new URL('../../../数据与模型/知识库/表格与索引/',import.meta.url));
const version='2026-10-19';
fs.mkdirSync(root,{recursive:true});
const devices=[...new Set([...capabilities.map(c=>c.device),...stages.map(s=>s.code)])].map(id=>({id,model:id,source:'平台设备编号（未提供厂商型号）',version}));
const chunks=alarmRules.map(r=>({id:'PLATFORM-RULE:'+r.id,model:r.device,alarm_code:r.id,version,title:r.title,text:`适用设备：${r.device}。指标：${r.metric}（${r.unit}），来源：${r.source}。本平台演示规则：预警低限${r.low??'无'}，高限${r.high??'无'}；严重低限${r.criticalLow??'无'}，高限${r.criticalHigh??'无'}。达到边界即按平台规则告警。建议：${r.advice}。设定参数的允许输入范围不是质量合格范围。此资料来自平台配置，仅用于演示，不是厂商手册；真实现场需使用审核后的工艺与安全规程。`}));
// Maintained platform explanations, plus catalogs derived from actual configuration.
const guideRoot=new URL('./knowledge/platform/',import.meta.url);
for(const name of fs.readdirSync(guideRoot).filter(n=>n.endsWith('.md'))){
 const source='knowledge/platform/'+name,content=fs.readFileSync(new URL(name,guideRoot),'utf8');
 for(const section of content.split(/^## /m).slice(1)){
  const [rawTitle,...lines]=section.split('\n');const title=rawTitle.trim();
  chunks.push({id:'UI:'+name+':'+title,title,keywords:title.split(/[、，]/),text:title+'。'+lines.join('\n').trim(),version,source,kind:'platform',model:'',alarm_code:''});
 }
}
for(const [i,s] of stages.entries())chunks.push({id:'STATION:'+s.id,title:s.name,keywords:[s.name,s.short,s.code],kind:'device',model:s.code,alarm_code:'',version,source:'src/data.js',text:`${s.name}属于工位${i+1}，平台编号${s.code}，主要指标${s.metric}，单位${s.unit}。当前值和状态请查询query_devices，默认样例数值不是实时值。`});
for(const c of capabilities)chunks.push({id:'CONTROL:'+c.id,title:c.label,keywords:[c.label,c.device,c.id],kind:'device',model:c.device,alarm_code:'',version,source:'src/controlCapabilities.js',text:`${stages[c.stageIndex]?.name} / ${c.device} / ${c.label}。参数编号${c.id}，类型${c.type}，单位${c.unit||'无'}。${c.type==='NUMBER'?`允许输入${c.min}至${c.max}，步长${c.step}。`:`选项${c.options?.join('、')}。`}这是设定参数定义，不是实测读数，也不是质量合格阈值；当前值须查询query_devices。写入需权限校验和人工确认。`});
for(const p of productDefaults)chunks.push({id:'PRODUCT:'+p.id,title:p.name,keywords:[p.name,...p.aliases],kind:'product',model:'',alarm_code:'',version,source:'src/product-resources.js',text:`${p.name}是平台预置展示产品，类别${p.category}，描述：${p.description}。产品图与文案仅展示用途，不证明配方、产量或实际加工。当前启用状态、规格、配料、配方和任务用query_products查询，不能用默认配置替代当前产品资料。`});
for(const kind of ['device','product'])fs.writeFileSync(root+'/'+(kind==='device'?'09-设备与参数目录.md':'10-产品目录.md'),chunks.filter(c=>c.kind===kind).map(c=>`## ${c.title}\n\n${c.text}\n\n来源：${c.source}；版本：${c.version}`).join('\n\n'));
for(const name of fs.readdirSync(guideRoot).filter(n=>n.endsWith('.md')))fs.copyFileSync(new URL(name,guideRoot),root+'/'+name);
fs.writeFileSync(root+'/platform-knowledge.json',JSON.stringify({devices,alarms:alarmRules,thresholds:alarmRules,chunks},null,2));
for(const [name,rows] of Object.entries({devices,alarms:alarmRules,thresholds:alarmRules})){
 const fields=[...new Set(rows.flatMap(Object.keys))],quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
 fs.writeFileSync(root+'/'+name+'.csv','\ufeff'+[fields,...rows.map(r=>fields.map(k=>r[k]))].map(r=>r.map(quote).join(',')).join('\r\n'));
}
fs.writeFileSync(root+'/平台设备告警说明.md',chunks.map(c=>`## ${c.title}\n\n资料编号：${c.id}；版本：${c.version}\n\n${c.text}`).join('\n\n'));
console.log(`Exported ${devices.length} devices and ${chunks.length} rule documents to ${root}. Restart knowledge service to rebuild its indexes.`);
