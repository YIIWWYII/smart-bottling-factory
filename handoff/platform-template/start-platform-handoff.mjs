import {spawn} from 'node:child_process';

const start=(file,args=[])=>spawn(process.execPath,[file,...args],{stdio:'inherit'});
const probe=async(url,contract)=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(1000),redirect:'error'});if(!r.ok)return false;const health=await r.json();return health.status==='ready'&&health.contract===contract&&health.demo===true;}catch{return false;}};
const services=[['vision-demo-server.mjs','http://127.0.0.1:18093/health','bottleworks-vision-v1'],['local-agent-demo.mjs','http://127.0.0.1:8887/health','coze-v3-demo']];
const children=[];
function stop(){for(const child of children)child.kill();}
process.on('SIGINT',stop);
process.on('SIGTERM',stop);
try{
 for(const [file,url,contract] of services){
  if(!await probe(url,contract))children.push(start(file));
  for(let i=0;i<15;i++){
   if(await probe(url,contract))break;
   if(i===14)throw Error('Local backup not ready: '+url);
   await new Promise(resolve=>setTimeout(resolve,200));
  }
 }
 const web=start('node_modules/vite/bin/vite.js',['--host','0.0.0.0','--port','5174','--strictPort']);children.push(web);
 process.exitCode=await new Promise(resolve=>web.once('exit',code=>resolve(code??1)));
}catch(error){console.error(error.message);process.exitCode=1;}
finally{stop();}
