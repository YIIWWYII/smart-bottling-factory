import {materialProgress,inspectionCaptureTime} from './src/materialFlow.js';
export const rehearsalCameraIds=['top','side-0','side-120','side-240'];
const defectNotes={'side-0':['标签上部污渍','标签破口','标签褶皱'],'side-240':['侧后标签污渍']};
export const rehearsalBranches=['original','opencv','yolo','patchcore'];
export const rehearsalDefaults=()=>({version:1,revision:0,enabled:true,stageIndices:[2,5],cases:['normal','defect'].map((id,i)=>({id,name:i?'缺陷瓶':'正常瓶',cameras:rehearsalCameraIds.map((cameraId,j)=>({cameraId,status:i&&defectNotes[cameraId]?'reject':'pass',defects:i?(defectNotes[cameraId]||[]):[],images:Object.fromEntries(rehearsalBranches.map(branch=>[branch,'/images/vision-demo/'+id+'-'+branch+'-'+cameraId+'.webp']))}))}))});
const imagePath=value=>typeof value==='string'&&/^\/(?:images\/vision-demo|uploads\/vision-demo)\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/.test(value);
export function validateRehearsal(value){
 if(!value||value.version!==1||typeof value.enabled!=='boolean'||!Array.isArray(value.stageIndices)||!value.stageIndices.length||new Set(value.stageIndices).size!==value.stageIndices.length||value.stageIndices.some(i=>![2,5].includes(i)))throw Error('请选择外观检测或成品二次检测工位。');
 if(!Array.isArray(value.cases)||value.cases.length!==2||value.cases[0]?.id!=='normal'||value.cases[1]?.id!=='defect')throw Error('需要正常瓶、缺陷瓶两套素材，分别配置两组图片。');
 const cases=value.cases.map(c=>{
  if(typeof c.name!=='string'||!c.name.trim()||c.name.length>60||!Array.isArray(c.cameras)||c.cameras.length!==4)throw Error('每套素材需要四个机位。');
  const cameras=rehearsalCameraIds.map(id=>{
   const matches=c.cameras.filter(row=>row.cameraId===id);if(matches.length!==1)throw Error('机位重复或缺失。');const row=matches[0];
   if(!['pass','reject'].includes(row.status))throw Error('机位结果只能选择正常或缺陷。');
   const images={...row.images};if(row.images&&images.original===undefined)images.original='/images/vision-demo/'+c.id+'-original-'+id+'.webp';
   if(!row.images||rehearsalBranches.some(k=>images[k]&&!imagePath(images[k])))throw Error('请使用后台上传的图片。');
   if(value.enabled&&rehearsalBranches.some(k=>!images[k]))throw Error('启用前需要补齐两套各16张图片，共32张。');
   if(row.defects!==undefined&&(!Array.isArray(row.defects)||row.defects.length>8||row.defects.some(v=>typeof v!=='string'||v.length>80)))throw Error('缺陷说明格式无效。');
   return {cameraId:id,status:row.status,defects:row.defects||[],images:Object.fromEntries(rehearsalBranches.map(k=>[k,images[k]||'']))};
  });
  if(c.id==='normal'&&cameras.some(row=>row.status!=='pass'))throw Error('正常瓶各机位应为正常。');
  if(c.id==='defect'&&!cameras.some(row=>row.status==='reject'))throw Error('缺陷瓶请至少指定一个缺陷机位。');
  return {id:c.id,name:c.name.trim(),cameras};
 });
 return {version:1,revision:Number.isInteger(value.revision)?value.revision:0,enabled:value.enabled,stageIndices:[...value.stageIndices],cases};
}
export function createVisionRehearsal(){
 let taskId=null;const assigned=new Map(),runs=new Map(),manual=new Map(),selectedSamples=new Map();
 const reset=()=>{taskId=null;assigned.clear();runs.clear();manual.clear();selectedSamples.clear();};
 return {reset,selectSample(stageIndex,caseId){selectedSamples.set(stageIndex,caseId);},start(stageIndex,id,now=Date.now(),source='simulation'){
   const previous=manual.get(stageIndex);if(previous&&!previous.stopped&&(previous.source==='camera'?now-previous.startedAt<20000:now-previous.startedAt<8000))throw Error('本轮正在检测，请等待完成。');
   manual.set(stageIndex,{id,source,caseId:selectedSamples.get(stageIndex)||'normal',startedAt:now,frames:{}});
  },capture(stageIndex,bottleId,cameraId,data,now=Date.now()){
   const single=manual.get(stageIndex);if(!single||single.id!==bottleId||single.stopped)throw Error('本轮采集已结束。');
   if(!single.frames[cameraId])single.frames[cameraId]={data,at:new Date(now).toISOString()};
   const run=runs.get(stageIndex+':'+bottleId);if(run)run.frames=single.frames;
  },stop(stageIndex){const single=manual.get(stageIndex);if(single)single.stopped=true;},observe(config,snapshot,now=Date.now()){
  const flow=snapshot?.materialFlow;
  if(!config?.enabled||snapshot?.dataMode==='real'||snapshot?.protocol?.enabled)return {active:false,records:[],stageIndices:config?.stageIndices||[],message:config?.enabled?'预设演示仅在模拟工位生效。':'预设演示未启用。'};
  if(flow?.taskId&&taskId!==flow.taskId){assigned.clear();runs.clear();manual.clear();taskId=flow.taskId;}
  const activeStages=config.stageIndices.filter(i=>flow?.simulatedStages?.[i]!==false&&snapshot.states?.[i]?.source!=='real');
  const manualFlows={};
  for(const stageIndex of activeStages){
   if(flow?.simulatedStages?.[stageIndex]===false||snapshot.states?.[stageIndex]?.source==='real')continue;
   let stageFlow=flow;const single=manual.get(stageIndex);
   if(single){
    const elapsed=Math.max(0,(now-single.startedAt)/1000),stages=Array.from({length:9},()=>[]);
    stages[stageIndex]=[{id:single.id,count:1,elapsed:Math.min(8,elapsed),duration:8}];
    stageFlow={taskId:flow?.taskId||'单次采集',stages,running:elapsed<8,updated:now,simulatedStages:Array(9).fill(true)};
    if(single.source==='camera'&&elapsed>=20)single.stopped=true;
    if(!single.stopped&&(single.source==='camera'||elapsed<8))manualFlows[stageIndex]={...stageFlow,source:single.source,caseId:single.caseId,bottleId:single.id,startedAt:single.startedAt};
   }
   const token=stageFlow?.stages?.[stageIndex]?.[0];if(!token)continue;
   const key=stageIndex+':'+token.id;let run=runs.get(key);
   const progress=Math.max(run?.record?.progress||0,materialProgress(stageFlow,token,now)),time=progress*token.duration;
   if(!run){
    // Never replay a bottle already past the first arrival when enabling/restarting.
    if(time>2&&!single){runs.set(key,{bottleId:token.id,skipped:true});continue;}
    run={key,bottleId:token.id,batchId:stageFlow.taskId,stageIndex,samples:structuredClone(validateRehearsal(config).cases),startedAt:now,captured:{},frames:single?.frames||{},caseId:single?.caseId||selectedSamples.get(stageIndex)||'normal'};runs.set(key,run);
   }
   if(run.skipped)continue;
   if(time>=2&&!assigned.has(token.id)){
    assigned.set(token.id,run.samples[run.caseId==='defect'?1:0]);
   }
   const sample=assigned.get(token.id)||run.samples[run.caseId==='defect'?1:0];
   const cameras=rehearsalCameraIds.map((cameraId,index)=>{
    // The bottle reaches the inspection position after two seconds. Four camera
    // captures occur during its hold there, tied to material time (including pauses).
    const arrival=inspectionCaptureTime(token.duration,index),frame=sample.cameras.find(c=>c.cameraId===cameraId),captured=single?.source==='camera'?!!single.frames[cameraId]:time>=arrival;
    if(captured&&!run.captured[cameraId])run.captured[cameraId]=run.frames[cameraId]?.at||new Date(now-Math.max(0,time-arrival)*1000).toISOString();
    return {cameraId,defects:captured?frame.defects:[],status:captured?frame.status:single?.stopped?'missing':'pending',capturedAt:run.captured[cameraId]||null,imageUrl:captured?(run.frames[cameraId]?.data||frame.images.original):null,originalUrl:captured?(run.frames[cameraId]?.data||frame.images.original):null,opencvUrl:captured?frame.images.opencv:null,overlayUrl:captured?frame.images.yolo:null,heatmapUrl:captured?frame.images.patchcore:null,opencvStatus:captured?'pass':'pending',yoloStatus:captured?frame.status:'pending',patchcoreStatus:captured?frame.status:'pending',codeMask:{status:captured?'preset':'pending',reason:captured?'条码区域处理图':'等待瓶子到达本机位'},reason:captured?'离线采集帧与处理结果':'等待瓶子到达本机位',preset:true};
   });
   const completed=cameras.every(c=>c.patchcoreStatus!=='pending'),ended=completed||single?.stopped;
   run.record={requestId:'rehearsal:'+key,bottleId:token.id,batchId:run.batchId,stageIndex,caseId:sample.id,caseName:sample.name,demo:true,demoSource:'preset-upload',engine:'preset-upload',captureSource:single?.source||'simulation',version:'rehearsal-1',status:ended?'completed':'processing',createdAt:new Date(run.startedAt).toISOString(),cameras,verdict:single?.stopped&&!completed?'review':completed?(sample.cameras.some(c=>c.status==='reject')?'reject':'pass'):'pending',reason:single?.stopped&&!completed?'采集未完成，缺少机位：'+cameras.filter(c=>!c.capturedAt).map(c=>c.cameraId).join('、'):completed?(sample.cameras.some(c=>c.status==='reject')?'外观异常，请检查缺陷机位。':'四个机位检查通过。'):'等待各机位采集完成。',capturedCount:cameras.filter(c=>c.capturedAt).length,progress};
   run.completed=completed;
   if(single&&(single.stopped||single.source==='camera'&&completed||single.source!=='camera'&&time>=8)){manual.delete(stageIndex);delete manualFlows[stageIndex];}
  }
  while(runs.size>40)runs.delete(runs.keys().next().value);
  // Keep both stages on the same sample for a given bottle.
  if(assigned.size>500){const keep=new Set([...runs.values()].map(r=>r.bottleId));for(const id of assigned.keys())if(!keep.has(id))assigned.delete(id);}
  return {active:activeStages.length>0,stageIndices:activeStages,selectedSamples:Object.fromEntries(selectedSamples),manualFlows,records:[...runs.values()].reverse().map(r=>r.record).filter(Boolean),message:flow?.running?'随产线到料展示。':'点击“开始检测”进行单次采集，或运行产线任务后随到料采集。'};
 }};
}
