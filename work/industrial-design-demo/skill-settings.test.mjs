import test from 'node:test';
import assert from 'node:assert/strict';
import {configuredSkills,validateSkillSettings,parseSkillCommand} from './src/assistantSkills.js';
test('skill CRUD, prompt and permitted tools use the saved catalog',()=>{
 const rows=configuredSkills();rows[0].enabled=false;
 rows.push({name:'平台帮助',description:'解释平台功能',example:'产线全景是什么',instructions:'先检索平台说明并引用来源',enabled:true,tools:['search_knowledge']});
 const catalog=validateSkillSettings(rows);
 assert.throws(()=>parseSkillCommand('/告警分析',{},catalog),/停用/);
 assert.equal(parseSkillCommand('/平台帮助',{},catalog).question,'产线全景是什么');
 assert.deepEqual(parseSkillCommand('/平台帮助',{},catalog).skill.tools,['search_knowledge']);
 assert.throws(()=>parseSkillCommand('/平台帮助',{},catalog.slice(0,-1)),/有效技能/);
 assert.deepEqual(validateSkillSettings([]),[]);
 assert.throws(()=>validateSkillSettings([...rows,rows[0]]),/重复/);
 assert.throws(()=>validateSkillSettings([{...rows[0],tools:['execute_shell']}]),/工具/);
 assert.throws(()=>validateSkillSettings([{...rows[0],instructions:'x'.repeat(6001)}]),/6000/);
});
