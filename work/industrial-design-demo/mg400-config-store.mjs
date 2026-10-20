import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {validateMotionConfig} from './handoff-examples/mg400-motion-config.mjs';

export const mg400Files={communication:'mg400-communication.json',protocol:'mg400-protocol.json',acquisition:'mg400-acquisition.json',trajectories:'mg400-trajectories.json',motion:'mg400-motion.json'};
export function validateMG400Files(c){
 const a=c.communication,p=c.protocol,r=c.acquisition,t=c.trajectories,m=c.motion;
 if(a?.transport!=='tcp'||a.protocol!=='dobot-mg400-4axis-20240419'||p?.id!==a.protocol)throw Error('仅支持 MG400 四轴 TCP 协议');
 if(!net.isIP(a.host))throw Error('机械臂 IP 无效');
 for(const key of ['dashboardPort','feedbackPort','motionPort'])if(!Number.isInteger(a[key])||a[key]<1||a[key]>65535)throw Error(`端口无效：${key}`);
 for(const v of [a.connectTimeoutMs,a.commandTimeoutMs,r?.feedbackStaleAfterMs])if(!Number.isInteger(v)||v<100||v>60000)throw Error('超时须为 100–60000 ms');
 if(r.mode!=='push')throw Error('仅支持主动推送反馈');
 const f=p.feedback;
 if(f?.frameBytes!==1440||f.byteOrder!=='LE'||f.lengthOffset!==0||f.magicOffset!==48||f.magic!=='0x0123456789abcdef')throw Error('MG400 反馈帧头定义不匹配');
 if(!Array.isArray(f.fields)||!f.fields.length)throw Error('缺少反馈字段');
 const names=new Set();
 for(const row of f.fields){
  if(!Array.isArray(row)||row.length!==3)throw Error('字段格式应为 [名称, 偏移, 类型]');
  const [name,offset,type]=row,match=/^(\d*)([BHQd])$/.exec(type),count=match?Number(match[1]||1):0,size=match?{B:1,H:2,Q:8,d:8}[match[2]]:0;
  if(typeof name!=='string'||!/^[a-z][a-z0-9_]*$/.test(name)||names.has(name)||!Number.isInteger(offset)||offset<0||count<1||offset+count*size>1440)throw Error('无效或重复反馈字段：'+name);
  names.add(name);
 }
 // These fields drive control checks; their official locations cannot be relabelled.
 const required={robot_mode:[24,'Q'],q_actual:[432,'6d'],tool_vector_actual:[624,'6d'],enable_status:[1026,'B'],error_status:[1029,'B'],user_index:[1012,'B'],tool_index:[1013,'B']};
 for(const [name,[offset,type]] of Object.entries(required))if(!f.fields.some(row=>row[0]===name&&row[1]===offset&&row[2]===type))throw Error('核心字段不可修改：'+name);
 for(const name of ['enable_status','error_status','user_index','tool_index'])if(!names.has(name))throw Error('缺少字段：'+name);
 const commands={power:'PowerOn()',enable:'EnableRobot()',disable:'DisableRobot()',clear:'ClearError()',pause:'PauseScript()',resume:'ContinueScript()',stop:'StopScript()',run:'RunScript({project})',speed:'SpeedFactor({value})'};
 if(!p.commands||Object.keys(p.commands).length!==Object.keys(commands).length)throw Error('指令集合不匹配');
 for(const [name,template] of Object.entries(commands)){
  const cmd=p.commands[name];if(cmd?.template!==template)throw Error('已适配命令格式不可替换：'+name);
  if(name==='run'){if(cmd.parameter!=='project'||cmd.type!=='projectName')throw Error('工程参数定义无效');}
  else if(name==='speed'){if(cmd.parameter!=='value'||cmd.type!=='integer'||!Number.isInteger(cmd.min)||!Number.isInteger(cmd.max)||cmd.min<1||cmd.max>100||cmd.min>cmd.max)throw Error('速度参数范围无效');}
  else if(cmd.parameter)throw Error('无参数指令不能增加参数');
 }
 if(t?.version!==1||typeof t.controller?.defaultProject!=='string'||(t.controller.defaultProject&&!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(t.controller.defaultProject)))throw Error('轨迹工程名无效');
 if(!Number.isInteger(m?.platform?.defaultSpeedPercent)||m.platform.defaultSpeedPercent<p.commands.speed.min||m.platform.defaultSpeedPercent>p.commands.speed.max)throw Error('默认速度超出协议范围');
 validateMotionConfig({...m,smallPaths:{...m.smallPaths,...t.smallPaths},pickPlace:{...m.pickPlace,points:t.pickPlace?.points}});
 return c;
}
export function createMG400ConfigStore(directory=new URL('./config/',import.meta.url)){
 const path=key=>{if(!Object.hasOwn(mg400Files,key))throw Error('未知 MG400 配置文件');return new URL(mg400Files[key],directory);};
 function read(){const values={},raw={};for(const key of Object.keys(mg400Files)){raw[key]=fs.readFileSync(path(key),'utf8');values[key]=JSON.parse(raw[key]);}validateMG400Files(values);return {values,raw};}
 function save(key,value,expected){
  const current=read();if(current.raw[key]!==expected)throw Error('文件已被修改，请重新读取后再保存');
  validateMG400Files({...current.values,[key]:value});
  const file=path(key),temporary=new URL(mg400Files[key]+'.tmp',directory);
  try{fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n','utf8');fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  return read();
 }
 return {read,save,path:key=>fileURLToPath(path(key))};
}
