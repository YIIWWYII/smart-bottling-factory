import {loadMotionConfig} from './mg400-motion-config.mjs';
import {publishTestFeedback,createTestSpeedConsumer} from '../mg400-test-feedback.mjs';
// 仅用于现场确认空载的可乐测试。默认单次，--loop 显式启用空载循环。--run 启动，--stop 请求停止。
import net from 'node:net';
import {readFileSync,writeFileSync,existsSync,unlinkSync,openSync,closeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MG400,mg400Communication} from '../mg400.mjs';
const stopFile=join(tmpdir(),'mg400-cola-loop.stop'),lockFile=join(tmpdir(),'mg400-cola-loop.lock');
if(process.argv.includes('--stop')){writeFileSync(stopFile,'stop');console.log('Stop requested');process.exit(0);}
if(!process.argv.includes('--run')){console.log('No motion. Use --run for confirmed empty-load test; --stop to stop.');process.exit(0);}
const settings=loadMotionConfig().liveTest;if(!settings)throw Error('缺少 liveTest 运行参数');
const profile=JSON.parse(readFileSync(new URL('../config/mg400-trajectories.json',import.meta.url),'utf8')).productTrajectories.profiles.find(p=>p.id==='cola-330ml');
const path=['P1','P2','P3','P4','P5','P6','P1','P7'].map(key=>{const p=profile?.points[key];const values=p&&[p.x,p.y,p.z,p.r];if(!values?.every(Number.isFinite))throw Error('轨迹点无效：'+key);return values;});
if(Math.abs(path[7][2]-path[1][2]-50)>.01||path[7].some((v,i)=>i!==2&&v!==path[1][i]))throw Error('复位点必须位于取料接触点上方50 mm');
const lock=openSync(lockFile,'wx');closeSync(lock);
if(existsSync(stopFile))unlinkSync(stopFile);
const robot=new MG400(),move=new MG400(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const repeat=process.argv.includes("--loop"),recover=process.argv.includes("--recover-verified-stop");
let sent=false,bits=0n,requested=false,cycle=0,completed=false,publishTimer,speedTimer;
process.on('SIGINT',()=>{requested=true;});process.on('SIGTERM',()=>{requested=true;});
const near=(a,b,t=.5)=>a.every((v,i)=>Number.isFinite(v)&&Math.abs(v-b[i])<t);
function state(checkIO=true){
 if(requested||existsSync(stopFile))throw Error('Operator stop');
 const s=robot.status(),f=s.feedback;
 if(!s.online||Date.now()-robot.receivedAt>500||!f||!f.enable_status||f.error_status||![5,7].includes(f.robot_mode)||f.user_index!==0||f.tool_index!==0)throw Error('Invalid/stale feedback');
 if(checkIO&&BigInt(f.digital_outputs)!==bits)throw Error('Unexpected output');return f;
}
async function dwell(ms){for(let t=0;t<ms;t+=25){await sleep(25);state();}}
async function output(n,on){
 state();await robot.command(`DOExecute(${n},${on?1:0})`);bits=on?1n<<BigInt(n-1):0n;
 const end=Date.now()+500;while(Date.now()<end){await sleep(20);if(BigInt(state(false).digital_outputs)===bits)return;}
 throw Error('IO feedback timeout');
}
try{
 await robot.connect({host:mg400Communication.host});for(let i=0;i<40&&!robot.status().online;i++)await sleep(50);
 const publish=()=>publishTestFeedback({...robot.status(),externalControl:true,active:true,execution:{state:'空载测试 · 第'+cycle+'轮'}});
 publish();publishTimer=setInterval(()=>{try{publish();}catch{requested=true;}},100);
 const origin=state().tool_vector_actual.slice(0,4);let recoveryTarget=null;console.log('INITIAL',origin);
 if(state().robot_mode!==5)throw Error('Not idle');
 if(!near(origin,path.at(-1),1)){
  if(!recover)throw Error('Not at verified reset point');
  const onColumn=(low,high)=>[0,1,3].every(i=>Math.abs(origin[i]-low[i])<1)&&origin[2]>=low[2]-1&&origin[2]<=high[2]+1;
  if(onColumn(path[1],path[0]))recoveryTarget=path[0];
  else if(onColumn(path[4],path[5]))recoveryTarget=path[5];
  else throw Error('当前位置不在已核对的取放竖直段内，需单独核验进入路线');
 }
 let previous=origin;const limits=[[-160,160],[-25,85],[-25,105],[-360,360]];
 for(const target of (recoveryTarget?[recoveryTarget,...path]:path)){
  const count=Math.max(1,Math.ceil(Math.max(Math.hypot(...target.slice(0,3).map((v,i)=>v-previous[i]))/10,Math.abs(target[3]-previous[3])/5)));
  for(let j=0;j<=count;j++){state();const p=previous.map((v,i)=>v+(target[i]-v)*j/count);const q=(await robot.command(`InverseSolution(${p.map(v=>v.toFixed(5)).join(',')},0,0)`)).values.split(',').map(Number);if(q.length!==4||q.some((v,i)=>!Number.isFinite(v)||v<limits[i][0]||v>limits[i][1]))throw Error('Inverse solution range failed');}
  previous=target;
 }
 if(state().robot_mode!==5||!near(state().tool_vector_actual.slice(0,4),origin))throw Error('Pose changed during checks');
 await robot.command(`SpeedFactor(${settings.speedFactorPercent})`);robot.config.speed=settings.speedFactorPercent;const consumeSpeed=createTestSpeedConsumer(robot);speedTimer=setInterval(()=>{if(!requested&&!existsSync(stopFile))void consumeSpeed();},100);console.log('RUN_PARAMETERS',JSON.stringify(settings));
 move.dashboard=await new Promise((resolve,reject)=>{const s=net.createConnection({host:mg400Communication.host,port:mg400Communication.motionPort});s.setTimeout(3000,()=>s.destroy(Error('Connection timeout')));s.once('error',reject);s.once('connect',()=>{s.setTimeout(0);resolve(s);});s.on('error',()=>{});});
 do { // 默认单次；用户明确空载授权时才使用 --loop。
  state();cycle++;console.log('CYCLE_START',cycle);
  for(let i=cycle===1&&recoveryTarget?-1:0;i<path.length;i++){
   const target=i===-1?recoveryTarget:path[i],from=state().tool_vector_actual.slice(0,4);if(state().robot_mode!==5)throw Error('Not idle');
   sent=true;await move.command(`MovL(${target.join(',')},User=0,Tool=0,SpeedL=${settings.speedLPercent},AccL=${settings.accLPercent},CP=0)`);
   let synced=false,err;void move.command('Sync()',{timeoutMs:30000}).then(()=>{synced=true;},e=>{err=e;});
   const start=Date.now();let started=false,arrived=false,stable=0,stamp=0;
   while(Date.now()-start<30000){
    await sleep(50);const f=state(),p=f.tool_vector_actual.slice(0,4);if(err)throw err;
    if(p.some((v,j)=>!Number.isFinite(v)||v<Math.min(from[j],target[j])-3||v>Math.max(from[j],target[j])+3))throw Error('Outside corridor');
    if(!near(p,from,.5))started=true;if(!started&&Date.now()-start>4000)throw Error('No movement within 4 seconds');
    if(robot.receivedAt!==stamp){stamp=robot.receivedAt;stable=f.robot_mode===5&&near(p,target,.4)?stable+1:0;}
    if(stable>=4&&synced){arrived=true;console.log('ARRIVED',cycle,i+1,p);break;}
   }
   if(!arrived)throw Error('Arrival timeout');
   if(i===1){await output(settings.vacuumOutput,true);await dwell(settings.pickWaitMs);}
   if(i===4){await dwell(settings.placeWaitMs);await output(settings.vacuumOutput,false);await dwell(settings.suctionOffGapMs);await output(settings.blowOutput,true);await dwell(settings.blowPulseMs);await output(settings.blowOutput,false);await dwell(settings.releaseWaitMs);}
  }
  console.log('RUN_COMPLETE',cycle,'outputs',state().digital_outputs);if(repeat)await dwell(settings.cycleWaitMs);
 }while(repeat);
 completed=true;
}catch(e){console.error('STOP',e.message);if(e.message!=='Operator stop')process.exitCode=1;}
finally{
 // 此脚本只用于空载。退出时独立下发停止及两路气泵关闭。
 if(sent&&!completed)try{console.log('RESET',(await robot.command('ResetRobot()')).raw);}catch(e){console.error('STOP_UNCONFIRMED: USE EMERGENCY STOP',e.message);}
 if(sent)for(const n of [1,2])try{console.log('OUTPUT_OFF',(await robot.command(`DOExecute(${n},0)`)).raw);}catch(e){console.error('OUTPUT_OFF_UNCONFIRMED',n,e.message);}
 clearInterval(publishTimer);clearInterval(speedTimer);publishTestFeedback({...robot.status(),externalControl:true,active:false});
 move.close();robot.close();unlinkSync(lockFile);
}
