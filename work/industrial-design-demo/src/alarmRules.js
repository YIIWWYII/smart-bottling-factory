import rules from '../config/alarm-rules.json' with {type:'json'};
import {stages} from './data.js';

// Demonstration limits only, not certified safety limits.
export const alarmRules=rules;

export function classifyAlarm(rule,value){
 if(!Number.isFinite(value))return null;
 if(rule.criticalLow!=null&&value<=rule.criticalLow)return {level:'critical',direction:'low',threshold:rule.criticalLow};
 if(rule.criticalHigh!=null&&value>=rule.criticalHigh)return {level:'critical',direction:'high',threshold:rule.criticalHigh};
 if(rule.low!=null&&value<=rule.low)return {level:'warning',direction:'low',threshold:rule.low};
 if(rule.high!=null&&value>=rule.high)return {level:'warning',direction:'high',threshold:rule.high};
 return null;
}
export function evaluateAlarms({states,controls}){
 return alarmRules.map(rule=>{
  const state=states[rule.stageIndex];if(!state||state.quality==='offline')return null;
  // Configured values must never stand in for measurements on a physical device.
  if(rule.source==='setting'&&state.source==='real')return null;
  if(rule.source!=='setting'&&rule.source!=='measurement'&&state.source!=='real'&&state.mode==='stopped')return null;
  const target=Number(state.target),raw=rule.source==='setting'?controls[rule.id]:rule.source==='measurement'?state.measurements?.[rule.measurement]:state.value;
  if(raw==null||raw==='')return null;
  const value=rule.source==='deviation'?(target>0?(Number(raw)-target)/target*100:NaN):Number(raw);
  const status=classifyAlarm(rule,value);return status?{...rule,...status,value:Number(value.toFixed(3)),dataSource:state.source,signature:state.source+':'+status.level+':'+status.direction}:null;
 }).filter(Boolean);
}
export function alarmChanges(previous,next){
 const old=new Map(previous.map(a=>[a.id,a])),fresh=new Map(next.map(a=>[a.id,a]));
 return [...next.filter(a=>old.get(a.id)?.signature!==a.signature).map(a=>({kind:old.has(a.id)?'change':'trigger',before:old.get(a.id)||null,after:a})),...previous.filter(a=>!fresh.has(a.id)).map(a=>({kind:'clear',before:a,after:null}))];
}
export const ruleText=r=>`${r.metric}（${r.source==='setting'?'模拟设定值':r.source==='deviation'?'读数相对目标偏差':'运行读数'}）：预警 ${[r.low!=null?'≤ '+r.low:null,r.high!=null?'≥ '+r.high:null].filter(Boolean).join(' 或 ')} ${r.unit}；严重 ${[r.criticalLow!=null?'≤ '+r.criticalLow:null,r.criticalHigh!=null?'≥ '+r.criticalHigh:null].filter(Boolean).join(' 或 ')} ${r.unit}。${r.advice}。`;
export const alarmDocument=i=>({id:`DEVICE-ALARMS-${i}`,title:stages[i].name+' · 告警规则（演示）',kind:'document',status:'published',version:1,owner:'系统演示',content:'演示规则，不作为真实生产安全标准。达到上限或低于/等于下限触发，严重优先；回到正常区间恢复。离线时终止判定，不代表恢复正常。只在触发、等级变化及恢复时写日志。告警不自动下发停机命令。\n'+alarmRules.filter(r=>r.stageIndex===i).map(ruleText).join('\n')});
