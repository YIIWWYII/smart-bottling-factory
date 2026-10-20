export const visionCameraIds=['top','side-0','side-120','side-240'];
export const visionDefaults={baseUrl:'http://127.0.0.1:8093',modelName:'demo-fixture',connection:'bottleworks-http'};
export function normalizeVisionCameras(rows,base,validateUrl){
 if(!Array.isArray(rows)||rows.length!==4||new Set(rows.map(r=>r.id)).size!==4)throw Error('需要四个不同机位的模型配置');
 return visionCameraIds.map(id=>{
  const row=rows.find(r=>r.id===id);if(!row)throw Error('机位编号无效');
  if(row.connection!=='bottleworks-http')throw Error('当前支持 Bottleworks HTTP 检测接口；其他模型需适配服务');
  if(typeof row.modelName!=='string'||!row.modelName.trim()||row.modelName.length>150)throw Error('请填写模型名');
  return {id,baseUrl:validateUrl(row.baseUrl||base),modelName:row.modelName.trim(),connection:row.connection};
 });
}
export async function inspectCameraServices(config,input,request){
 if(visionCameraIds.some(id=>!input.images.some(i=>i.cameraId===id))){
  return {requestId:input.requestId,bottleId:input.bottleId,batchId:input.batchId,verdict:'review',demo:false,
   reason:'四机位采集不完整，未调用检测模型',preflight:{passed:false,inferenceSkipped:true},
   cameras:visionCameraIds.map(cameraId=>({cameraId,status:input.images.some(i=>i.cameraId===cameraId)?'review':'missing',reason:'四机位采集不完整，等待补图'}))};
 }
 if(!config.cameras?.length)return request(config.baseUrl,'/inspect',config.token,input);
 const groups=new Map();
 for(const camera of config.cameras){const key=JSON.stringify([camera.baseUrl,camera.modelName]);if(!groups.has(key))groups.set(key,{camera,ids:[]});groups.get(key).ids.push(camera.id);}
 const parts=await Promise.all([...groups.values()].map(async({camera,ids})=>{
  const response=await request(camera.baseUrl,'/inspect',config.token,{...input,modelName:camera.modelName,cameraIds:ids,images:input.images.filter(i=>ids.includes(i.cameraId))});
  if(response.requestId!==input.requestId||response.bottleId!==input.bottleId||response.batchId!==input.batchId)throw Error('机位检测返回了不同请求或批次');
  if(!Array.isArray(response.cameras))throw Error('机位检测缺少结果');
  return {...response,cameras:response.cameras.filter(c=>ids.includes(c.cameraId))};
 }));
 const cameras=parts.flatMap(p=>p.cameras);
 const verdict=cameras.some(c=>c.status==='reject')?'reject':visionCameraIds.some(id=>!cameras.some(c=>c.cameraId===id&&c.status==='pass'))?'review':'pass';
 return {requestId:input.requestId,bottleId:input.bottleId,batchId:input.batchId,cameras,verdict,demo:parts.some(p=>p.demo),reason:parts.map(p=>p.reason).filter(Boolean).join('；')};
}
