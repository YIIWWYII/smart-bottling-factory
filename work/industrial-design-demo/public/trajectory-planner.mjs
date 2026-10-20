export function generatePlan({name,pick,place,height,recess=0,clearance=50,travelZ=null}){
 const point=p=>{
  if(!Array.isArray(p)||p.length!==4||!p.every(Number.isFinite))throw Error('请完整填写 X、Y、Z、R，不能留空。');
  return p.map(v=>Math.round(v*1000)/1000);
 };
 pick=point(pick);place=point(place);
 if(!Number.isFinite(height)||height<=0||height>1000)throw Error('瓶高应为 0～1000 mm 之间的实测值。');
 if(!Number.isFinite(recess)||recess<0||recess>=height)throw Error('凹陷深度应不小于 0 且小于瓶子总高。');
 const effectiveHeight=height-recess;
 if(!Number.isFinite(clearance)||clearance<50||clearance>500)throw Error('抬升净空应为 50～500 mm，不能低于复位高度。');
 // 已示教接触点包含瓶高；只加抬升距离，不能重复加瓶高。
 const suggestedZ=Math.round((Math.max(pick[2],place[2])+clearance)*1000)/1000;
 const z=travelZ===null?suggestedZ:travelZ;
 if(!Number.isFinite(z)||z<suggestedZ||z<=Math.max(pick[2],place[2]))throw Error('通行 Z 必须满足两处接触点的抬升净空，不得低于建议值。');
 const abovePick=[pick[0],pick[1],z,pick[3]],abovePlace=[place[0],place[1],z,place[3]];
 return {version:1,name:name.trim()||'取放草案',status:'draft',executionEnabled:false,user:0,tool:0,bottleHeightMm:height,recessDepthMm:recess,effectiveHeightMm:effectiveHeight,clearanceMm:clearance,suggestedTravelZ:suggestedZ,travelZ:z,
  assumptions:['上料、下料均为该瓶型的吸盘接触点，不是台面坐标','从上方吸取，瓶体竖直（允许倒置），User0 的 Z 方向竖直','吸盘与工具安装不变；通行高度、完整扫掠空间和逆解尚未验证','有效高度=总高-吸附面凹陷深度；实测接触点不重复增加瓶高或扣除凹陷，复位为上料接触点上方50 mm'],
  startRequirement:'执行前读取新鲜的 User0/Tool0 实际位姿，确认空载、气泵关闭及上方净空；起步点必须重新计算，不能复用上次下料点',
  entry:{source:'fresh_actual_pose',initialLiftMm:0,keepXYR:true,transferZRule:'travelZ',validationRequired:true},
  points:{P1:abovePick,P2:pick,P3:abovePick,P4:abovePlace,P5:place,P6:abovePlace,P7:[pick[0],pick[1],Math.round((pick[2]+50)*1000)/1000,pick[3]]},
  steps:[
   {operation:'check-entry',label:'读取实时位置，单独验证到上料上方的进入路径；不从当前位置累加50 mm'},
   {operation:'approach-above',point:'P1',label:'到上料正上方的通行高度，禁止未验证的斜向下降'},
   {operation:'move',point:'P2',label:'竖直下降到取料接触点'},
   {operation:'output',output:2,value:1,label:'开启 DO2 吸气'},
   {operation:'manual-check',label:'确认吸牢后才允许抬升；尚无真空检测输入'},
   {operation:'move',point:'P3',label:'带瓶竖直抬升'},
   {operation:'move',point:'P4',label:'移动到下料上方'},
   {operation:'move',point:'P5',label:'竖直下降，确认瓶底有支撑'},
   {operation:'dwell',durationMs:500,label:'放稳后停顿0.5秒'},
   {operation:'output',output:2,value:0,label:'关闭 DO2 吸气'},
   {operation:'dwell',durationMs:200,label:'等待0.2秒，避免吸吹同时开启'},
   {operation:'output',output:1,value:1,label:'开启 DO1 吹气'},
   {operation:'dwell',durationMs:300,label:'吹气0.3秒'},
   {operation:'output',output:1,value:0,label:'关闭 DO1 吹气'},
   {operation:'dwell',durationMs:500,label:'等待0.5秒后检查释放'},
   {operation:'manual-check',label:'确认释放，避免带瓶抬升'},
   {operation:'move',point:'P6',label:'放料后空载抬起'},
   {operation:'move',point:'P1',label:'在通行高度返回上料上方'},
   {operation:'move',point:'P7',label:'竖直到上料接触点上方50 mm，单次结束'}]};
}

if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id);let plan=null;
 const numeric=id=>$(id).value.trim()===''?NaN:Number($(id).value);
 const readPoint=prefix=>['x','y','z','r'].map(axis=>numeric(prefix+'-'+axis));
 const inputs=[...document.querySelectorAll('input')];
 inputs.forEach(input=>input.addEventListener('input',()=>{plan=null;$('download').disabled=true;$('result').hidden=true;$('error').textContent='';}));
 $('form').addEventListener('submit',event=>{
  event.preventDefault();$('error').textContent='';
  try{
   plan=generatePlan({name:$('name').value,pick:readPoint('pick'),place:readPoint('place'),height:numeric('height'),recess:numeric('recess'),clearance:numeric('clearance'),travelZ:$('travel').value.trim()===''?null:numeric('travel')});
   $('height-result').textContent=plan.travelZ+' mm';
   $('effective-height').textContent=plan.effectiveHeightMm+' mm（总高 '+plan.bottleHeightMm+' − 凹陷 '+plan.recessDepthMm+'）';
   $('points').replaceChildren(...Object.entries(plan.points).map(([name,values])=>{const row=document.createElement('tr');[name,...values].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell);});return row;}));
   $('steps').replaceChildren(...plan.steps.map(step=>{const li=document.createElement('li');li.textContent=(step.point?step.point+' · ':'')+step.label;return li;}));
   $('result').hidden=false;$('download').disabled=false;
  }catch(e){plan=null;$('download').disabled=true;$('result').hidden=true;$('error').textContent=e.message;}
 });
 $('download').addEventListener('click',()=>{
  if(!plan)return;
  const blob=new Blob([JSON.stringify(plan,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='mg400-pick-place-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
}
