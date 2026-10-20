// MG400 实机小幅空载测试。默认只读检查；--run 路径名 才发送运动。
// 固定起点来自 2026-10-19 现场反馈；更换安装位置/工具后不可直接复用。
import net from 'node:net';
import {MG400,mg400Communication} from '../mg400.mjs';
import {loadMotionConfig} from './mg400-motion-config.mjs';
const settings=loadMotionConfig().smallPaths;
const {origin,paths}=settings;
const name=process.argv[3]||settings.defaultPath,run=process.argv[2]==='--run';
if(!Object.hasOwn(paths,name))throw Error('路径不存在：'+name);
const robot=new MG400(),move=new MG400(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
let sentMotion=false;
const numbers=s=>s.split(',').map(Number);
const distance=(a,b)=>Math.hypot(...a.slice(0,3).map((v,i)=>v-b[i]));
function state(){
 const s=robot.status(),f=s.feedback;
 if(!s.online||!f||f.error_status||!f.enable_status||![5,7].includes(f.robot_mode))throw Error('反馈过期、报警、未使能或非预期模式');
 if(f.user_index!==0||f.tool_index!==0)throw Error('当前坐标系不是已核对的 User0/Tool0');
 return f;
}
try{
 await robot.connect({host:mg400Communication.host});
 for(let i=0;i<30&&!robot.status().online;i++)await sleep(100);
 if(state().robot_mode!==5)throw Error('必须先处于空闲状态');
 const start=numbers((await robot.command('GetPose()')).values);
 if(start.length<4||start.some(v=>!Number.isFinite(v)))throw Error('位姿反馈无效');
 if(distance(start,origin)>.5||Math.abs(start[3]-origin[3])>.5)throw Error('不在本次核对的起点附近，不自动回起点');
 const targets=paths[name].map(d=>origin.map((v,i)=>v+(d[i]||0)));
 let previous=state().q_actual.slice(0,4);
 // 逆解只验证可达性和关节变化，不等于碰撞检测；现场已确认空载、范围清空。
 for(const p of targets){
  const q=numbers((await robot.command(`InverseSolution(${p.join(',')},0,0)`)).values);
  if(q.length!==4||q.some((v,i)=>!Number.isFinite(v)||Math.abs(v-previous[i])>6))throw Error('目标关节变化过大或逆解无效');
  previous=q;
 }
 console.log(JSON.stringify({path:name,origin,targets,mode:run?'RUN':'CHECK_ONLY'}));
 if(run){
  await robot.command(`SpeedFactor(${settings.speedFactorPercent})`); // 不自动恢复此前速度。
  move.dashboard=await new Promise((resolve,reject)=>{const s=net.createConnection({host:mg400Communication.host,port:mg400Communication.motionPort});const timer=setTimeout(()=>s.destroy(Error('运动端口连接超时')),mg400Communication.connectTimeoutMs);s.once('error',reject);s.once('connect',()=>{clearTimeout(timer);resolve(s);});s.on('error',()=>{});});
  for(const p of targets){
   if(state().robot_mode!==5)throw Error('上一段未结束，不追加运动');
   const command=`MovL(${p.join(',')},User=0,Tool=0,SpeedL=${settings.speedLPercent},AccL=${settings.accLPercent},CP=0)`;
   sentMotion=true;console.log('SEND',command);console.log('ACK',(await move.command(command)).raw);
   // Sync 等待队列结束；同时继续检查实时反馈，不能仅凭应答判断到位。
   let synced=false,syncError;
   void move.command('Sync()',{timeoutMs:30000}).then(result=>{synced=true;console.log('SYNC',result.raw);},error=>{syncError=error;});
   const deadline=Date.now()+30000;let stable=0,arrived=false;
   while(Date.now()<deadline){
    await sleep(100);const f=state(),actual=f.tool_vector_actual;
    if(syncError)throw syncError;
    if(distance(actual,p)<.3&&Math.abs(actual[3]-p[3])<.3&&f.robot_mode===5)stable++;else stable=0;
    if(distance(actual,origin)>12)throw Error('超出本次 12 mm 监控范围');
    if(stable>=4&&synced){console.log('ARRIVED',JSON.stringify(actual.slice(0,4)));arrived=true;break;}
   }
   if(!arrived)throw Error('到位超时');
   // 现场观察模式：到位后停留，期间继续检查反馈；不扩大运动范围。
   const dwell=process.argv[4]==='--observe'?settings.observeDwellMs:settings.dwellMs;
   for(let elapsed=0;elapsed<dwell;elapsed+=100){await sleep(100);state();}
  }
  console.log('COMPLETE',name,JSON.stringify(state().tool_vector_actual.slice(0,4)));
 }
}catch(e){
 console.error('STOP',e.message);process.exitCode=1;
 // 发生异常时仅停止并清队列，绝不自动退回、清报警或重试。
 if(sentMotion){try{console.log('RESET',(await robot.command('ResetRobot()')).raw);}catch(stopError){console.error('STOP_UNCONFIRMED: 请立即使用现场急停',stopError.message);}}
}finally{move.close();robot.close();}
