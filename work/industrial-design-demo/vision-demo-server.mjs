// Rehearsal worker: fixed fixtures, no YOLO or PatchCore inference.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {networkInterfaces} from 'node:os';
import {pathToFileURL} from 'node:url';
import {rehearsalDefaults,rehearsalCameraIds as cameraIds} from './vision-rehearsal.mjs';
const materials=path.resolve('public/images/vision-demo');
async function demoImages(caseId,cameraId){
 const sample=rehearsalDefaults().cases.find(c=>c.id===caseId).cameras.find(c=>c.cameraId===cameraId);
 const images={};for(const branch of ['opencv','yolo','patchcore'])images[branch]='data:image/webp;base64,'+(await fs.readFile(path.join(materials,path.basename(sample.images[branch])))).toString('base64');
 return {...sample,images};
}
export function inspectDemo(input,fixture){
 const cameras=cameraIds.map(cameraId=>{const image=input.images.find(i=>i.cameraId===cameraId);return {cameraId,status:image?(fixture.rejectCamera===cameraId?'reject':'pass'):'missing',reason:!image?'该机位未上传图像':fixture.rejectCamera===cameraId?'固定演示用例：该机位有缺陷':'固定演示用例：该机位通过',...(image?{imageUrl:image.data}:{})};});
 const verdict=cameras.some(c=>c.status==='reject')?'reject':cameras.some(c=>c.status==='missing')?'review':'pass';
 return {requestId:input.requestId,bottleId:input.bottleId,batchId:input.batchId,version:fixture.version,engine:'demo-fixture',demo:true,cameras,verdict,reason:'演示固定结果；缺少机位转复检。未执行真实模型推理。'};
}
export function createDemoServer({storage=path.resolve('.runtime/vision-demo.json')}={}){
 let fixture={version:'demo-1',rejectCamera:null};
 const ready=fs.readFile(storage,'utf8').then(s=>{fixture=JSON.parse(s);}).catch(e=>{if(e.code!=='ENOENT')throw e;});
 return http.createServer(async(req,res)=>{
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   await ready;
   if(req.url==='/health'&&req.method==='GET')return reply(200,{status:'ready',contract:'bottleworks-vision-v1',engine:'演示检测服务（无真实推理）',version:fixture.version,demo:true,capabilities:['opencv','yolo','patchcore','inspect']});
   if(req.method!=='POST')return reply(404,{error:'Not found'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>34000000)return reply(413,{error:'Too large'});}const body=JSON.parse(raw);
   if(req.url==='/packages/load'){
    const data=JSON.parse(Buffer.from(body.data,'base64').toString('utf8'));
    if(data.kind!=='bottleworks-vision-demo'||typeof data.version!=='string'||!data.version||data.version.length>100||(data.rejectCamera!==null&&!cameraIds.includes(data.rejectCamera)))return reply(400,{error:'Only explicitly marked demo manifests are supported'});
    fixture={version:data.version,rejectCamera:data.rejectCamera};await fs.mkdir(path.dirname(storage),{recursive:true});await fs.writeFile(storage,JSON.stringify(fixture));return reply(200,{status:'ready',version:fixture.version,demo:true});
   }
   if(['/inspect','/opencv','/yolo','/patchcore'].includes(req.url)){
    if(!Array.isArray(body.images)||body.images.length>4||body.images.some(i=>!cameraIds.includes(i.cameraId)||typeof i.data!=='string'))return reply(400,{error:'images required'});
    const caseId=body.caseId==='defect'?'defect':'normal',out=inspectDemo(body,{...fixture,rejectCamera:caseId==='defect'?'side-0':fixture.rejectCamera});
    for(const row of out.cameras){if(row.status==='missing')continue;const sample=await demoImages(caseId,row.cameraId);row.status=sample.status;row.defects=sample.defects;row.opencvUrl=sample.images.opencv;row.overlayUrl=sample.images.yolo;row.heatmapUrl=sample.images.patchcore;}
    out.verdict=out.cameras.some(c=>c.status==='reject')?'reject':out.cameras.some(c=>c.status==='missing')?'review':'pass';out.caseId=caseId;
    if(req.url!=='/inspect'){const branch=req.url.slice(1),key={opencv:'opencvUrl',yolo:'overlayUrl',patchcore:'heatmapUrl'}[branch];return reply(200,{requestId:out.requestId,caseId,demo:true,branch,cameras:out.cameras.map(c=>({cameraId:c.cameraId,status:c.status,imageUrl:c[key]||null,defects:c.defects||[]}))});}
    return reply(200,out);
   }
   reply(404,{error:'Not found'});
  }catch(e){reply(400,{error:e.message});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const port=Number(process.env.VISION_DEMO_PORT||8093),host=process.env.VISION_DEMO_HOST||'0.0.0.0',server=createDemoServer();
 server.once('error',async error=>{
  if(error.code==='EADDRINUSE'){
   const addresses=host==='0.0.0.0'?Object.values(networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal).map(a=>a.address):[host];
   const available=await Promise.all((addresses.length?addresses:['127.0.0.1']).map(async address=>{
    const url='http://'+(address.includes(':')?'['+address+']':address)+':'+port;
    try{
     const response=await fetch(url+'/health',{signal:AbortSignal.timeout(1200),redirect:'error'});
     if(!response.ok)return null;
     const health=await response.json();
     return health.status==='ready'&&health.contract==='bottleworks-vision-v1'&&health.demo===true&&['opencv','yolo','patchcore','inspect'].every(name=>health.capabilities?.includes(name))?url:null;
    }catch{return null;}
   }));
   if(available.some(Boolean)){console.log('Demo vision is already running. Reuse: '+available.filter(Boolean).join(', '));return;}
   console.error('Port '+port+' is in use, but no compatible vision service responded on the requested interface. Close the conflicting program or set VISION_DEMO_PORT to a free port.');
  }else console.error('Unable to start demo vision: '+error.message);
  process.exitCode=1;
 });
 server.listen(port,host,()=>console.log('Demo vision listening on port '+port+'; no real inference'));
}
