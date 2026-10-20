// Shared catalog: the server resolves commands from this allowlist, never from client instructions.
export const assistantSkills = [
 {name:'告警分析',description:'查告警、设备读数和规程，给出依据与建议',example:'分析当前未恢复告警',tools:['query_logs','query_devices','search_knowledge'],instructions:'先查询当前未恢复告警，再核对相关设备数据；需要解释阈值和处理方法时检索适用规程。没有当前告警就如实说明，不把历史告警当作故障。输出当前情况、依据、可能原因和建议；原因不足以确定时说明不确定性。只读，不生成修改单。'},
 {name:'生产数据分析',description:'比较产量、任务和告警，解释数据变化',example:'分析今天的生产情况',tools:['query_production','query_tasks','query_logs','query_products'],instructions:'先用query_production查询用户时间范围的产量，再按需要查询任务；平台会用工具返回的原始数据自动绘制每日产量、小时分布和明细表，不要生成HTML或编造图表数据。必要时关联告警。未指定日期默认今天，明确日期和数据模式；比较时使用一致口径。缺记录不当作零，相关性不当作因果。输出关键数据、比较依据、发现及证据不足之处。只读，不生成修改单。'},
 {name:'参数调整',description:'核对当前值与范围，生成待确认方案',example:'把水洗时间调整到20秒',tools:['query_devices','search_knowledge','propose_change'],instructions:'先查目标参数的当前值、controlId和允许范围；目标、数值或单位不明确时先问用户，不自行决定。仅为用户明确要求的数值参数生成提案，kind必须parameter。说明修改前后值、理由和确认要求；提案不是执行成功，不能代替人工确认。'},
 {name:'设备接入检查',description:'检查数据模式、连接与读数是否可用',example:'检查当前设备的数据接入情况',tools:['query_configuration','query_devices'],instructions:'查询当前数据模式与连接配置，再查询相关设备读数、来源及质量。区分模拟、真实、混合、禁用、离线和数据过期；无时间戳不能断言数据实时。输出已接通项、未接通项和下一步检查方法。不泄露凭证，不修改配置。'},
 {name:'操作结果复核',description:'核对确认单、参数回读和告警恢复情况',example:'检查我最近一次操作的结果',tools:['query_commands','query_devices','query_logs'],instructions:'先查当前用户的操作结果，根据目标核对参数读数或当前告警。用户指定操作无法定位时问清，不用其他操作代替。区分待确认、已取消、指令返回成功、参数回读一致与机械动作完成；无现场证据不能说动作完成。输出目标、查得结果、是否可验证及未完成事项。只读，不再次生成或执行命令。'}
];

export function parseSkillCommand(text,context={},catalog=assistantSkills){
 const match=String(text).trimStart().match(/^[/／]([^\s]*)\s*([\s\S]*)$/);
 if(!match)return null;
 const skill=catalog.find(s=>s.name===match[1]);
 if(skill?.enabled===false)throw new Error('该技能已停用，请在 AI 配置中启用。');
 if(!skill)throw new Error('请选择有效技能：'+catalog.filter(s=>s.enabled!==false).map(s=>'/'+s.name).join('、'));
 const selected=context.selectionLocked&&context.target;
 const dates=selected?[...new Set(String(selected).match(/\b\d{4}-\d{2}(?:-\d{2})?\b/g)||[])]:[];
 let selectionRange='';
 if(skill.name==='生产数据分析'&&dates.length===1){
  const date=dates[0],month=Number(date.slice(5,7));
  if(month>=1&&month<=12)selectionRange=date.length===10?'分析'+date+'至'+date+'的生产数据。':'分析'+date+'-01至'+date+'-'+new Date(Number(date.slice(0,4)),month,0).getDate()+'的生产数据。';
 }
 const fallback=skill.name==='参数调整'?'查询可调整参数，等待我指定参数和目标值，不生成提案。':selected?selectionRange+'针对当前选中的对象使用'+skill.name+'，按选中对象的时间范围查询和分析，不改为今天。':skill.example;
 return {skill,question:match[2].trim()||fallback};
}

export const skillTools=['query_devices','query_logs','query_tasks','query_products','query_production','query_configuration','query_commands','search_knowledge','propose_change'];
export function configuredSkills(settings={}){
 if(Array.isArray(settings))return settings.map(s=>({...s,tools:[...s.tools]}));
 return assistantSkills.map(s=>({...s,enabled:settings[s.name]?.enabled!==false,example:settings[s.name]?.example||s.example,instructions:s.instructions+(settings[s.name]?.guidance?'\n补充要求：'+settings[s.name].guidance:''),guidance:settings[s.name]?.guidance||''}));
}
export function validateSkillSettings(rows){
 if(!Array.isArray(rows)||rows.length>50)throw Error('技能配置必须是数组，最多50个');
 const names=new Set();
 return rows.map(row=>{
  if(typeof row.name!=='string'||!(/^[\p{L}\p{N}_-]{1,32}$/u).test(row.name)||names.has(row.name))throw Error('技能名称限1–32个文字、数字、下划线或短横线，不能重复');
  names.add(row.name);
  for(const [k,max] of [['description',300],['example',200],['instructions',6000]])if(typeof row[k]!=='string'||!row[k].trim()||row[k].length>max)throw Error(k+' 不能为空且最多'+max+'字');
  if(typeof row.enabled!=='boolean'||!Array.isArray(row.tools)||!row.tools.length||row.tools.some(t=>!skillTools.includes(t)))throw Error('启用状态或工具列表无效');
  if(row.id!==undefined&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.id))throw Error('技能目录名需小写字母、数字和短横线');
  return {...(row.id?{id:row.id}:{}),name:row.name,description:row.description.trim(),example:row.example.trim(),instructions:row.instructions.trim(),enabled:row.enabled,tools:[...new Set(row.tools)]};
 });
}
