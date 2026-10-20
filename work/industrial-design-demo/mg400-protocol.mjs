import protocol from './config/mg400-protocol.json' with {type:'json'};
export {protocol};
// No eval: command parameters are typed and substituted only after validation.
export function formatMG400Command(action,parameters={}){
 const c=Object.hasOwn(protocol.commands,action)?protocol.commands[action]:null;
 if(!c)throw Error('不支持的机械臂指令');
 if(!c.parameter)return c.template;
 const value=parameters[c.parameter];
 if(c.type==='projectName'){
  if(typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value))throw Error('控制器工程名称无效');
 }else if(c.type==='integer'){
  if(!Number.isInteger(value)||value<c.min||value>c.max)throw Error(`参数须为 ${c.min}–${c.max}`);
 }else throw Error('不支持的命令参数类型');
 return c.template.replace(`{${c.parameter}}`,String(value));
}
