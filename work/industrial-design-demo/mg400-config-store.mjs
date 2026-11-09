import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import nodePath from 'node:path';
import {validateMotionConfig} from './handoff-examples/mg400-motion-config.mjs';

export const mg400Files={communication:'mg400-communication.json',protocol:'mg400-protocol.json',acquisition:'mg400-acquisition.json',trajectories:'mg400-trajectories.json',motion:'mg400-motion.json'};
export function mg400CommunicationConfigured(communication){
 return net.isIP(communication?.host)===4&&['dashboardPort','feedbackPort','motionPort'].every(key=>Number.isInteger(communication[key])&&communication[key]>=1&&communication[key]<=65535);
}
export function trajectoryReplacementBlock(status,pendingCount=0){
 if(pendingCount>0)return '有待确认的机械臂指令，请先处理后再替换轨迹配置。';
 if(!status?.connected)return '请先连接控制器并读取机械臂状态；无有效反馈时不允许替换。';
 if(!status.online||!status.feedback)return '机械臂反馈不可用，暂不能确认停机状态。';
 if(Number(status.feedback.enable_status)!==1||Number(status.feedback.robot_mode)!==5)return '请先停止工程并确认机械臂处于已上使能、空闲状态；保持上电和通信连接，无需断电。';
 const state=status.execution?.state;
 if(state&&!['已停止（反馈空闲）','运行结束（未核验取放结果）','报警中断','启动被拒绝'].includes(state))return '控制器仍有未结束的工程状态，请确认工程已停止、机械臂已上使能且空闲后再替换。';
 return '';
}
export function selectTrajectoryPreset(trajectories,projectName,status,pendingCount=0){
 if(status?.connected||pendingCount>0){const block=trajectoryReplacementBlock(status,pendingCount);if(block)throw Error(block);}
 if(typeof projectName!=='string'||!trajectories.controller.presets?.some(preset=>preset.projectName===projectName))throw Error('请选择已登记的轨迹工程');
 return {...trajectories,controller:{...trajectories.controller,defaultProject:projectName}};
}
export function validateMG400Files(c){
 const a=c.communication,p=c.protocol,r=c.acquisition,t=c.trajectories,m=c.motion;
 if(a?.transport!=='tcp'||a.protocol!=='dobot-mg400-4axis-20240419'||p?.id!==a.protocol)throw Error('仅支持 MG400 四轴 TCP 协议');
 const endpointKeys=['dashboardPort','feedbackPort','motionPort'],unsetEndpoint=!a.host&&endpointKeys.every(key=>a[key]===null||a[key]==='');
 if(!unsetEndpoint&&!mg400CommunicationConfigured(a))throw Error('通讯配置须全部留空，或填写有效的机械臂 IPv4 地址和三个端口');
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
 if(t.controller.presets!==undefined){
  if(!Array.isArray(t.controller.presets))throw Error('轨迹预设须为列表');
  const presetNames=new Set();
  for(const preset of t.controller.presets){
   if(typeof preset?.name!=='string'||!preset.name.trim()||typeof preset.projectName!=='string'||!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(preset.projectName)||typeof preset.packagePath!=='string'||!/^mg400-projects\/[A-Za-z0-9_.-]+$/.test(preset.packagePath)||presetNames.has(preset.projectName))throw Error('轨迹预设信息无效或重复');
   presetNames.add(preset.projectName);
  }
 }
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
 function importProject({projectName,name,files,expected}){
  if(typeof projectName!=='string'||!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(projectName))throw Error('工程名须以英文字母开头，仅含字母、数字、下划线、点或短横线，最多80字');
  if(typeof name!=='string'||!name.trim()||name.length>100)throw Error('请输入100字以内的显示名称');
  const current=read();if(current.raw.trajectories!==expected)throw Error('轨迹列表已更新，请重新打开轨迹工程选项卡');
  if(current.values.trajectories.controller.presets?.some(p=>p.projectName===projectName))throw Error('该工程名已存在，请使用新工程名；控制器中的工程名须一致');
  if(!Array.isArray(files)||!files.length||files.length>100)throw Error('请选择完整工程文件夹，最多100个文件');
  const entries=new Map();let total=0;
  for(const file of files){
   if(typeof file?.path!=='string'||file.path.length>240||file.path.split('/').some(p=>!p||p==='.'||p==='..'||/[\\:\x00-\x1f]/.test(p))||/(^|\/)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|\/|$)/i.test(file.path)||nodePath.isAbsolute(file.path)||entries.has(file.path))throw Error('工程内存在无效或重复文件路径');
   if(typeof file.data!=='string'||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data))throw Error('工程文件编码无效');
   const bytes=Buffer.from(file.data,'base64');total+=bytes.length;if(total>2*1024*1024)throw Error('工程总大小不能超过2 MB');entries.set(file.path,bytes);
  }
  let manifest;try{manifest=JSON.parse(entries.get('prj.json')?.toString('utf8').replace(/^\uFEFF/,''));}catch{throw Error('所选文件夹根目录必须包含有效的 prj.json');}
  if(!Array.isArray(manifest.cpus)||!manifest.cpus.length||typeof manifest.global!=='string'||typeof manifest.teach_point!=='string')throw Error('prj.json 缺少程序、全局文件或示教点声明');
  for(const name of [...manifest.cpus,manifest.global,manifest.teach_point])if(typeof name!=='string'||!entries.has(name))throw Error('工程缺少引用文件：'+name);
  const base=fileURLToPath(new URL('mg400-projects/',directory)),destination=nodePath.join(base,projectName);
  fs.mkdirSync(base,{recursive:true});if(fs.existsSync(destination))throw Error('工程目录已存在，请更换工程名');
  fs.mkdirSync(destination);
  try{
   for(const [name,bytes]of entries){const output=nodePath.join(destination,...name.split('/'));fs.mkdirSync(nodePath.dirname(output),{recursive:true});fs.writeFileSync(output,bytes,{flag:'wx'});}
   const trajectories={...current.values.trajectories,controller:{...current.values.trajectories.controller,presets:[...current.values.trajectories.controller.presets||[],{name:name.trim(),projectName,packagePath:'mg400-projects/'+projectName}]}};
   return save('trajectories',trajectories,expected);
  }catch(error){if(nodePath.dirname(destination)===nodePath.resolve(base))fs.rmSync(destination,{recursive:true,force:true});throw error;}
 }
 function projectFolder(projectName){const preset=read().values.trajectories.controller.presets?.find(p=>p.projectName===projectName);if(!preset)throw Error('未找到轨迹工程');return fileURLToPath(new URL(preset.packagePath+'/',directory));}
 return {read,save,importProject,projectFolder,path:key=>fileURLToPath(path(key))};
}
