import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import YAML from 'yaml';
import {configuredSkills,validateSkillSettings} from './src/assistantSkills.js';
export const skillConfigPath=path.resolve('skills');
const builtinIds={'告警分析':'alarm-analysis','生产数据分析':'production-analysis','参数调整':'parameter-adjustment','设备接入检查':'device-connection-check','操作结果复核':'operation-result-review'};
export function parseSkillDocument(content){
 const match=content.replace(/^\uFEFF/,'').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
 if(!match)throw Error('SKILL.md 需要 YAML 头部和 Markdown 正文');
 const meta=YAML.parse(match[1]);
 if(!meta||typeof meta.name!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.name))throw Error('name 需小写字母、数字和短横线，与目录名一致');
 return {meta,instructions:match[2].trim()};
}
export function createSkillStore(root,legacyPath){
 const fileFor=id=>path.join(root,id,'SKILL.md');
 function read(legacy){
  if(!fs.existsSync(root)){
   const rows=legacyPath&&fs.existsSync(legacyPath)?JSON.parse(fs.readFileSync(legacyPath,'utf8').replace(/^\uFEFF/,'')):configuredSkills(legacy);
   write(rows);
  }
  const rows=fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&!d.name.startsWith('.')&&fs.existsSync(fileFor(d.name))).map(d=>{
   const {meta,instructions}=parseSkillDocument(fs.readFileSync(fileFor(d.name),'utf8'));
   if(meta.name!==d.name)throw Error(d.name+' 的 name 与目录名不一致');
   const config=path.join(root,d.name,'agents','platform.yaml');
   const settings=fs.existsSync(config)?YAML.parse(fs.readFileSync(config,'utf8'))||{}:{};
   return {id:d.name,name:settings.interface?.display_name||meta.name,description:meta.description,instructions,example:settings.interface?.default_prompt||'使用'+(settings.interface?.display_name||meta.name),enabled:settings.enabled!==false,tools:settings.tools||['search_knowledge'],requiredTools:settings.requiredTools||[]};
  });
  return validateSkillSettings(rows);
 }
 function write(rows){
  const skills=validateSkillSettings(rows).map(s=>({...s,id:s.id||builtinIds[s.name]||'skill-'+randomUUID()}));
  if(new Set(skills.map(s=>s.id)).size!==skills.length)throw Error('技能目录不能重复');
  fs.mkdirSync(root,{recursive:true});
  for(const s of skills){
   const dir=path.join(root,s.id);fs.mkdirSync(path.join(dir,'agents'),{recursive:true});
   let meta={},settings={};
   if(fs.existsSync(fileFor(s.id)))meta=parseSkillDocument(fs.readFileSync(fileFor(s.id),'utf8')).meta;
   const config=path.join(dir,'agents','platform.yaml');
   if(fs.existsSync(config))settings=YAML.parse(fs.readFileSync(config,'utf8'))||{};
   fs.writeFileSync(fileFor(s.id),'---\n'+YAML.stringify({...meta,name:s.id,description:s.description})+'---\n\n'+s.instructions+'\n');
   fs.writeFileSync(config,YAML.stringify({...settings,interface:{...settings.interface,display_name:s.name,default_prompt:s.example},enabled:s.enabled,tools:s.tools,requiredTools:s.requiredTools||[]}));
  }
  for(const d of fs.readdirSync(root,{withFileTypes:true}))if(d.isDirectory()&&!d.name.startsWith('.')&&fs.existsSync(fileFor(d.name))&&!skills.some(s=>s.id===d.name)){
   const archive=path.join(root,'.deleted');fs.mkdirSync(archive,{recursive:true});fs.renameSync(path.join(root,d.name),path.join(archive,d.name+'-'+randomUUID()));
  }
  return skills;
 }
 function file(name){const skill=read().find(s=>s.name===name);if(!skill)throw Error('请先保存并选择技能');const target=fileFor(skill.id);return {path:target,directory:path.dirname(target),content:fs.readFileSync(target,'utf8')};}
 function saveFile(name,content){const rows=read(),skill=rows.find(s=>s.name===name);if(!skill)throw Error('技能不存在');const parsed=parseSkillDocument(content);if(parsed.meta.name!==skill.id)throw Error('请保留 name 与目录名一致');validateSkillSettings(rows.map(s=>s===skill?{...s,description:parsed.meta.description,instructions:parsed.instructions}:s));fs.writeFileSync(fileFor(skill.id),content);return read();}
 return {read,write,file,saveFile};
}
const store=createSkillStore(skillConfigPath,path.resolve('config/assistant-skills.json'));
export const readSkillConfig=store.read,writeSkillConfig=store.write,readSkillFile=store.file,writeSkillFile=store.saveFile;
