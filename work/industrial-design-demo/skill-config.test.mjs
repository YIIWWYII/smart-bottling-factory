import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSkillStore} from './skill-config.mjs';
import {configuredSkills} from './src/assistantSkills.js';
test('directory skills migrate, reload edited Markdown and retain resources on edits and deletion',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'platform-skills-'));
 try{
  const legacy=path.join(base,'old.json');fs.writeFileSync(legacy,JSON.stringify(configuredSkills()));
  const root=path.join(base,'skills'),store=createSkillStore(root,legacy),rows=store.read();
  assert.equal(rows.length,5);assert.equal(rows[0].id!==undefined,true);
  const selected=rows[0],file=store.file(selected.name);
  fs.mkdirSync(path.join(file.directory,'references'));fs.writeFileSync(path.join(file.directory,'references','guide.md'),'reference');
  store.saveFile(selected.name,file.content+'\n额外说明。');assert.match(store.read()[0].instructions,/额外说明/);
  assert.throws(()=>store.saveFile(selected.name,'invalid'),/YAML/);
  const changed=store.read();changed[0].name='改名技能';store.write(changed);
  assert.equal(store.file('改名技能').directory,file.directory);
  assert.equal(fs.readFileSync(path.join(file.directory,'references','guide.md'),'utf8'),'reference');
  store.write([]);assert.deepEqual(store.read(),[]);assert.equal(fs.readdirSync(path.join(root,'.deleted')).length,5);
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});
