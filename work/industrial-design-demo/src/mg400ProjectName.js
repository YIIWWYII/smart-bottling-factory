export function normalizeMG400ProjectName(value, preserveName = false) {
 const name=typeof value==='string'?value.trim():'';
 if(!/^[A-Za-z0-9_.-]+$/.test(name)||name==='blockly_')return '';
 const project=preserveName||name.startsWith('blockly_')?name:'blockly_'+name;
 return /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(project)&&!project.endsWith('.')?project:'';
}
