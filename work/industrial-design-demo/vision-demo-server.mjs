// Rehearsal worker: fixed fixtures, no YOLO or PatchCore inference.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {cameraIds} from './platform-integrations.mjs';
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
   if(req.url==='/health'&&req.method==='GET')return reply(200,{status:'ready',contract:'bottleworks-vision-v1',engine:'演示检测服务（无真实推理）',version:fixture.version,demo:true});
   if(req.method!=='POST')return reply(404,{error:'Not found'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>34000000)return reply(413,{error:'Too large'});}const body=JSON.parse(raw);
   if(req.url==='/packages/load'){
    const data=JSON.parse(Buffer.from(body.data,'base64').toString('utf8'));
    if(data.kind!=='bottleworks-vision-demo'||typeof data.version!=='string'||!data.version||data.version.length>100||(data.rejectCamera!==null&&!cameraIds.includes(data.rejectCamera)))return reply(400,{error:'Only explicitly marked demo manifests are supported'});
    fixture={version:data.version,rejectCamera:data.rejectCamera};await fs.mkdir(path.dirname(storage),{recursive:true});await fs.writeFile(storage,JSON.stringify(fixture));return reply(200,{status:'ready',version:fixture.version,demo:true});
   }
   if(req.url==='/inspect'){if(!Array.isArray(body.images))return reply(400,{error:'images required'});return reply(200,inspectDemo(body,fixture));}
   reply(404,{error:'Not found'});
  }catch(e){reply(400,{error:e.message});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){createDemoServer().listen(Number(process.env.VISION_DEMO_PORT||8093),'127.0.0.1',()=>console.log('Demo vision listening on 127.0.0.1:8093; no real inference'));}
