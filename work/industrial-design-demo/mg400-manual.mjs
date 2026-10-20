import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {MG400,mg400Communication} from './mg400.mjs';
export function manualTarget(feedback,axis,direction,step){
 if(!/^(X|Y|Z|R|J[1-4])$/.test(axis)||![1,-1].includes(direction)||![.1,1,5,10].includes(step))throw Error('无效轴、方向或寸动距离');
 const joint=axis.startsWith('J'),index=joint?Number(axis[1])-1:['X','Y','Z','R'].indexOf(axis);
 const target=(joint?feedback.q_actual:feedback.tool_vector_actual).slice(0,4);
 if(target.length!==4||!target.every(Number.isFinite))throw Error('无效实际位置');target[index]+=direction*step;
 if(joint){const limits=[[-160,160],[-25,85],[-25,105],[-360,360]];if(target.some((v,i)=>v<limits[i][0]||v>limits[i][1]))throw Error('目标超出关节标称范围');}
 return {joint,target};
}
export function createManualControl(robot,{motionPort=mg400Communication.motionPort}={}){
 let session=null,motion=null,watchdog=null,stopping=false;
 const live=()=>{const s=robot.status(),f=s.feedback;if(!s.online||Date.now()-s.receivedAt>500||!f.enable_status||f.error_status||f.user_index!==0||f.tool_index!==0)throw Error('反馈无效或不是 User0 / Tool0');return f;};
 async function stop(){const current=session;if(stopping)return {stopped:false};if(!current)return {stopped:true};stopping=true;session=null;clearInterval(watchdog);watchdog=null;try{if(current.sent)await robot.command('ResetRobot()');}finally{motion?.close();motion=null;stopping=false;}return {stopped:true};}
 async function start(body,owner){
  if(session||stopping)throw Error('已有手动动作，请先停止');
  if(body.confirmed!==true||!['jog','step'].includes(body.mode))throw Error('请先确认手动调试');
  const f=live();if(f.robot_mode!==5)throw Error('必须先停止自动动作并处于空闲');
  const plan=manualTarget(f,body.axis,body.direction,body.step);
  const current={id:randomUUID(),owner,last:Date.now(),sent:false,starting:true};session=current;
  try{
   motion=new MG400();motion.dashboard=await new Promise((resolve,reject)=>{const socket=net.createConnection({host:robot.config.host,port:motionPort});const timeout=setTimeout(()=>socket.destroy(Error('运动通道连接超时')),2000);socket.once('error',reject);socket.on('error',()=>{});socket.once('connect',()=>{clearTimeout(timeout);resolve(socket);});});
   if(session!==current)throw Error('手动动作已取消');
   if(body.mode==='step'&&!plan.joint){
    const cmd=`InverseSolution(${plan.target.join(',')},0,0)`;const q=(await robot.command(cmd)).values.split(',').map(Number);const limits=[[-160,160],[-25,85],[-25,105],[-360,360]];if(q.length!==4||q.some((v,i)=>!Number.isFinite(v)||v<limits[i][0]||v>limits[i][1]))throw Error('逆解超出关节范围');
   }
   live();if(session!==current)throw Error('手动动作已取消');
   const command=body.mode==='jog'?`MoveJog(${body.axis}${body.direction===1?'+':'-'},CoordType=0,User=0,Tool=0)`:`${plan.joint?'JointMovJ':'MovL'}(${plan.target.join(',')},${plan.joint?'SpeedJ=10,AccJ=5':'User=0,Tool=0,SpeedL=10,AccL=5'},CP=0)`;
   current.sent=true;await motion.command(command);if(session!==current)throw Error('动作已停止');current.last=Date.now();current.starting=false;
   const begin=Date.now();let stable=0,stamp=0,synced=body.mode==='jog',syncError;
   if(body.mode==='step')void motion.command('Sync()',{timeoutMs:15000}).then(()=>{synced=true;},e=>{syncError=e;});
   watchdog=setInterval(()=>{
    if(session!==current)return;
    try{
     const now=Date.now(),f=live();if(now-current.last>700||now-begin>15000||syncError||![5,7,11].includes(f.robot_mode))throw Error('手动动作停止：心跳中断、超时或状态异常');
     if(body.mode==='step'&&robot.receivedAt!==stamp){stamp=robot.receivedAt;const actual=(plan.joint?f.q_actual:f.tool_vector_actual).slice(0,4);stable=f.robot_mode===5&&actual.every((v,i)=>Math.abs(v-plan.target[i])<.08)?stable+1:0;if(stable>=3&&synced){session=null;clearInterval(watchdog);watchdog=null;motion?.close();motion=null;}}
    }catch(e){robot.event(e.message,'告警');void stop().catch(err=>robot.event('停止失败，请现场急停：'+err.message,'告警'));}
   },50);
   return {id:current.id,command,mode:body.mode};
  }catch(e){await stop();throw e;}
 }
 function heartbeat(id,owner){if(!session||session.id!==id||session.owner!==owner)return {active:false};session.last=Date.now();return {active:true};}
 return {start,heartbeat,stop,get active(){return !!session||stopping;}};
}
