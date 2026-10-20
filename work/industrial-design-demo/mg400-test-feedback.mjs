// 本机空载测试执行器共享反馈；平台不再重复连接控制器。
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export const testStopFile=join(tmpdir(),'mg400-cola-loop.stop');
const file=new URL('./.runtime/mg400-test-feedback.json',import.meta.url);
export function publishTestFeedback(status){fs.mkdirSync(new URL('./.runtime/',import.meta.url),{recursive:true});const temp=new URL('./.runtime/mg400-test-feedback.tmp',import.meta.url);fs.writeFileSync(temp,JSON.stringify({...status,publishedAt:Date.now()}));fs.renameSync(temp,file);}
export function readTestFeedback(now=Date.now()){
 try{const s=JSON.parse(fs.readFileSync(file,'utf8'));if(!s.externalControl||!s.active||!Number.isFinite(s.publishedAt)||now-s.publishedAt<0||now-s.publishedAt>2000)return null;const fresh=s.online&&Number.isFinite(s.receivedAt)&&now-s.receivedAt>=0&&now-s.receivedAt<1500;return {...s,online:!!fresh,feedback:fresh?s.feedback:null,phase:fresh?s.phase:'测试反馈中断'};}catch{return null;}
}
export function stopTest(){fs.writeFileSync(testStopFile,'stop');return {message:'已请求停止空载测试，等待实际停止反馈'};}

const speedRequest=new URL('./.runtime/mg400-speed-request.json',import.meta.url),speedResponse=new URL('./.runtime/mg400-speed-response.json',import.meta.url);
export async function requestTestSpeed(value){
 if(!Number.isInteger(value)||value<1||value>100)throw Error('速度比例须为1–100%');
 if(!readTestFeedback())throw Error('测试执行器未在线');
 const id=randomUUID(),request={id,value,expires:Date.now()+2000};
 const temp=new URL('./.runtime/mg400-speed-request.tmp',import.meta.url);fs.writeFileSync(temp,JSON.stringify(request));fs.renameSync(temp,speedRequest);
 const end=Date.now()+3000;
 while(Date.now()<end){await new Promise(r=>setTimeout(r,40));try{const result=JSON.parse(fs.readFileSync(speedResponse,'utf8'));if(result.id===id){if(result.error)throw Error(result.error);return result;}}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}}
 throw Error('改速回执超时，结果未知，请核对反馈，不要重复下发');
}
export function createTestSpeedConsumer(robot){
 let lastId=null,busy=false;
 return async()=>{
  if(busy)return;let request;try{request=JSON.parse(fs.readFileSync(speedRequest,'utf8'));}catch{return;}
  if(request.id===lastId||request.expires<Date.now())return;lastId=request.id;busy=true;
  try{if(!Number.isInteger(request.value)||request.value<1||request.value>100)throw Error('无效速度');
   const result=await robot.command(`SpeedFactor(${request.value})`);robot.config.speed=request.value;
   fs.writeFileSync(speedResponse,JSON.stringify({id:request.id,message:'速度指令已受理，请核对实际反馈',raw:result.raw}));
  }catch(e){fs.writeFileSync(speedResponse,JSON.stringify({id:request.id,error:e.message}));}finally{busy=false;}
 };
}
