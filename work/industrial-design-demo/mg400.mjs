import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {protocol,formatMG400Command} from './mg400-protocol.mjs';
import communication from './config/mg400-communication.json' with {type:'json'};
import motion from './config/mg400-motion.json' with {type:'json'};
import trajectories from './config/mg400-trajectories.json' with {type:'json'};
import acquisition from './config/mg400-acquisition.json' with {type:'json'};

if(communication.transport!=='tcp'||communication.protocol!==protocol.id||protocol.id!=='dobot-mg400-4axis-20240419')throw Error('不支持的通信方式或设备协议');
if(acquisition.mode!=='push')throw Error('MG400 反馈仅支持主动推送');
if(!net.isIP(communication.host))throw Error('通信配置 IP 无效');
for(const key of ['dashboardPort','feedbackPort','motionPort'])if(!Number.isInteger(communication[key])||communication[key]<1||communication[key]>65535)throw Error(`通信端口无效：${key}`);
for(const value of [communication.connectTimeoutMs,communication.commandTimeoutMs,acquisition.feedbackStaleAfterMs])if(!Number.isInteger(value)||value<100||value>60000)throw Error('超时时间须为 100–60000 ms');
const {frameBytes,lengthOffset,magicOffset,magic,fields:layout}=protocol.feedback;
if(frameBytes!==1440||protocol.feedback.byteOrder!=='LE'||lengthOffset!==0||magicOffset!==48||magic!=='0x0123456789abcdef')throw Error('MG400 帧定义不匹配');
for(const [name,offset,format] of layout){
 const m=/^(\d*)([BHQd])$/.exec(format),count=m?Number(m[1]||1):0,size=m?{B:1,H:2,Q:8,d:8}[m[2]]:0;
 if(typeof name!=='string'||!Number.isInteger(offset)||offset<0||count<1||offset+count*size>frameBytes)throw Error('反馈字段定义无效：'+name);
}
export const mg400Communication=communication; // 断开后重新加载配置时，运动端口也同步更新。
export const defaultMG400={host:communication.host,dashboardPort:communication.dashboardPort,feedbackPort:communication.feedbackPort,project:trajectories.controller.defaultProject,speed:motion.platform.defaultSpeedPercent};
// Only call while disconnected. All consumers share the validated file values.
export function applyMG400Files(files){
 Object.assign(communication,files.communication);Object.assign(acquisition,files.acquisition);
 layout.splice(0,layout.length,...files.protocol.feedback.fields);
 Object.assign(protocol.commands,files.protocol.commands);
 Object.assign(defaultMG400,{host:communication.host,dashboardPort:communication.dashboardPort,feedbackPort:communication.feedbackPort,project:files.trajectories.controller.defaultProject,speed:files.motion.platform.defaultSpeedPercent});
 return {...defaultMG400};
}
export function validateMG400(input){
 const c={...defaultMG400,...input};
 if(!net.isIP(c.host))throw Error('请输入机械臂 IP 地址');
 for(const k of ['dashboardPort','feedbackPort'])if(!Number.isInteger(c[k])||c[k]<1||c[k]>65535)throw Error('端口须为 1–65535');
 if(c.project&&!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(c.project))throw Error('工程名使用字母开头的英文、数字、下划线、点或横线；填写控制器内准确名称');
 if(!Number.isInteger(c.speed)||c.speed<1||c.speed>100)throw Error('速度比例须为 1–100%');
 return Object.fromEntries(Object.keys(defaultMG400).map(k=>[k,c[k]]));
}
export function parseMG400(frame){
 if(frame.length!==frameBytes||frame.readUInt16LE(lengthOffset)!==frameBytes||frame.readBigUInt64LE(magicOffset)!==BigInt(magic))throw Error('MG400 反馈帧长度或校验标识错误');
 const result={};
 for(const [name,offset,format] of layout){const type=format.slice(-1),count=Number(format.slice(0,-1)||1),size={B:1,H:2,Q:8,d:8}[type];
  const values=Array.from({length:count},(_,i)=>{const at=offset+i*size;return type==='Q'?frame.readBigUInt64LE(at).toString():type==='d'?frame.readDoubleLE(at):type==='H'?frame.readUInt16LE(at):frame.readUInt8(at);});
  if(type==='d'&&values.some(v=>!Number.isFinite(v)))throw Error('反馈含无效数值');result[name]=count===1?values[0]:values;
 }
 result.robot_mode=Number(result.robot_mode);return result;
}
export class MG400 {
 constructor(){this.config={...defaultMG400};this.events=[];this.pending=new Map();this.queue=Promise.resolve();this.epoch=0;this.last=null;this.receivedAt=0;this.phase='未连接';}
 event(detail,result='成功'){this.events.push({detail,result});this.events=this.events.slice(-100);}
 drain(){return this.events.splice(0);}
 status(){const online=!!this.dashboard&&!this.dashboard.destroyed&&!!this.feedback&&!this.feedback.destroyed&&Date.now()-this.receivedAt<acquisition.feedbackStaleAfterMs;return {config:this.config,connected:!!this.dashboard&&!this.dashboard.destroyed,online,receivedAt:this.receivedAt||null,phase:online?this.phase:'未连接 / 反馈过期',feedback:online?this.last:null,error:this.error||'',alarmCodes:online&&this.last?.robot_mode===9?this.alarmCodes||'读取中':null,execution:this.execution||null};}
 close(){this.epoch++;this.pending.clear();this.dashboard?.destroy();this.feedback?.destroy();this.dashboard=null;this.feedback=null;this.last=null;this.receivedAt=0;this.phase='未连接';}
 async connect(config){
  this.close();this.config=validateMG400(config);this.error='';const epoch=this.epoch;
  const open=port=>new Promise((resolve,reject)=>{const s=net.createConnection({host:this.config.host,port});const timer=setTimeout(()=>s.destroy(Error('连接超时')),communication.connectTimeoutMs);s.once('error',reject);s.once('connect',()=>{clearTimeout(timer);if(epoch!==this.epoch){s.destroy();reject(Error('连接已取消'));}else resolve(s);});s.once('close',()=>clearTimeout(timer));});
  try{this.dashboard=await open(this.config.dashboardPort);this.dashboard.on('error',e=>{this.error=e.message;});this.feedback=await open(this.config.feedbackPort);
   let buffer=Buffer.alloc(0);this.feedback.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);while(buffer.length>=frameBytes){if(buffer.readUInt16LE(lengthOffset)!==frameBytes||buffer.readBigUInt64LE(magicOffset)!==BigInt(magic)){buffer=buffer.subarray(1);continue;}const frame=buffer.subarray(0,frameBytes);buffer=buffer.subarray(frameBytes);try{this.accept(parseMG400(frame));}catch(e){this.error=e.message;}}});
   this.feedback.on('error',e=>{this.error=e.message;});this.feedback.on('close',()=>{if(epoch===this.epoch){this.event('机械臂反馈连接断开','失败');this.receivedAt=0;this.pending.clear();}});this.event('已建立 MG400 TCP 连接，等待有效反馈');
  }catch(e){this.close();this.error=e.message;throw e;}return this.status();
 }
 accept(data){
  const old=this.last?.robot_mode;this.last=data;this.receivedAt=Date.now();this.phase=({1:'初始化',2:'抱闸松开',3:'未上电',4:'未使能',5:'已使能 · 空闲',6:'拖拽',7:'运行中',8:'轨迹录制',9:'报警',10:'暂停',11:'点动'})[data.robot_mode]||'未知状态';
  if(old!==data.robot_mode&&data.robot_mode===9){this.command('GetErrorID()').then(r=>{this.alarmCodes=r.values;this.event('机械臂报警编码：'+r.values,'告警');}).catch(e=>{this.error='报警编码读取失败：'+e.message;});}
  if(old!==data.robot_mode)this.event('机械臂状态：'+this.phase,data.robot_mode===9?'告警':'成功');
  const run=this.execution;if(run){if(data.robot_mode===5&&run.state.startsWith('停止'))run.state='已停止（反馈空闲）';else if(data.robot_mode===7){run.started=true;run.state='运行中';}else if(data.robot_mode===9)run.state='报警中断';else if(data.robot_mode===10)run.state='已暂停';else if(data.robot_mode===5&&run.started&&!run.state.startsWith('停止'))run.state='运行结束（未核验取放结果）';}
 }
 command(text,{timeoutMs=communication.commandTimeoutMs}={}){if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)return Promise.reject(Error('指令超时须为 1–60000 ms'));const epoch=this.epoch;const job=this.queue.then(()=>new Promise((resolve,reject)=>{
  const socket=this.dashboard;if(epoch!==this.epoch||!socket||socket.destroyed)return reject(Error('控制连接不可用'));
  let buffer='',timer;const finish=(err,value)=>{clearTimeout(timer);socket.off('data',onData);socket.off('close',onClose);err?reject(err):resolve(value);};
  const onClose=()=>finish(Error('控制连接断开，执行结果未知'));const onData=chunk=>{buffer+=chunk.toString('utf8');if(buffer.length>65536){socket.destroy();return;}if(!buffer.includes(';'))return;const raw=buffer.slice(0,buffer.indexOf(';')+1),m=raw.match(/^\s*(-?\d+),\{([\s\S]*)\},([^;]+);$/);if(!m||m[3].toLowerCase()!==text.toLowerCase())return finish(Error('应答与下发指令不匹配'));if(Number(m[1])!==0)return finish(Error(`控制器拒绝指令：${raw}`));finish(null,{raw,values:m[2],accepted:true});};
  socket.on('data',onData);socket.once('close',onClose);timer=setTimeout(()=>{finish(Error('响应超时，结果未知；请核对状态后重新连接，勿重复启动'));socket.destroy();},timeoutMs);socket.write(text);
 }));this.queue=job.catch(()=>{});return job;}
 prepare(action,value,actor){
  if(!this.status().online)throw Error('有效反馈不可用，禁止下发');const mode=this.last.robot_mode;

  let text;if(action==='run'){if(this.execution?.state==='已受理 · 等待运行反馈')throw Error('上一工程仍等待运行反馈，请核对实机，不可重复启动');if(mode!==5)throw Error('启动前须已使能且空闲；不会自动清错或停止其他工程');if(!this.config.project)throw Error('请填写控制器内工程名称');text=formatMG400Command(action,{project:this.config.project});}
  if(action==='speed'){if(!Number.isInteger(value)||value<1||value>100)throw Error('速度比例须为 1–100%');text=formatMG400Command(action,{value});}
  if(!text)text=formatMG400Command(action);if(action==='power'&&mode!==3)throw Error('仅未上电状态可上电');if(action==='enable'&&mode!==4)throw Error('仅未使能状态可使能');if(action==='resume'&&mode!==10)throw Error('当前未暂停');if(action==='pause'&&mode!==7)throw Error('当前未运行');
  if(action==='pause'&&this.execution&&Date.now()-this.execution.at<1000)throw Error('启动后至少等待 1 秒再暂停');
  for(const [key,p] of this.pending)if(p.expires<Date.now())this.pending.delete(key);if(this.pending.size>=50)throw Error('待确认操作过多，请稍后重试');const token=randomUUID();this.pending.set(token,{action,value,text,actor,epoch:this.epoch,expires:Date.now()+30000});return {token,command:text,host:this.config.host,expiresIn:30};
 }
 async execute(token,actor){const p=this.pending.get(token);this.pending.delete(token);if(!p||p.actor!==actor||p.epoch!==this.epoch||p.expires<Date.now())throw Error('确认已过期，请重新发起');
  const check=this.prepare(p.action,p.value,actor);this.pending.delete(check.token);
  const result=await this.command(p.text);if(p.action==='run')this.execution={at:Date.now(),project:this.config.project,state:'已受理 · 等待运行反馈',started:false};if(p.action==='stop'&&this.execution)this.execution.state='停止已受理 · 等待反馈';
  this.event(p.text+'：已受理，实际状态以反馈为准');return {...result,message:'控制器已受理；不代表物理动作完成'};
 }
}
