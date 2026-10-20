// Shared metre grid: x points right, z points down in the 2D map.
export const map={width:24,height:16,revision:1,description:'演示布局 · 待现场尺寸标定'};
export const assets=[
 {id:'wash',name:'瓶体预处理',index:0,x:3,z:3,w:3,d:2},
 {id:'gas',name:'气体检测',index:1,x:7,z:3,w:2,d:2},
 {id:'vision',name:'外观检测',index:2,x:11,z:3,w:2,d:2},
 {id:'beverage',name:'饮料准备',index:3,x:3,z:7,w:3,d:2},
 {id:'filler',name:'精密灌装',index:4,x:7,z:7,w:2,d:2},
 {id:'secondary',name:'二次检测',index:5,x:11,z:7,w:2,d:2},
 {id:'robot',name:'装箱交接',index:6,x:14,z:7,w:2,d:2},
 ...[4,8,12].map((z,i)=>({id:'rack-'+i,model:'warehouse',name:'库区 '+String.fromCharCode(65+i),index:8,x:20,z,w:4,d:2})),
];
export const slots=[4,8,12].flatMap((z,i)=>[0,1].map(n=>({id:`${String.fromCharCode(65+i)}-0${n+1}`,x:19+n*2,z,access:[17,z],capacity:120,category:i===0?'LIME-500':i===1?'SODA-350':null})));
export const ports=[{id:'in',name:'收货交接区',point:[3,12]},{id:'pack',name:'装箱交接区',point:[14,10]},{id:'out',name:'发货交接区',point:[10,13]}];
export const algorithms={'astar':'A* 最短路径','dijkstra':'Dijkstra 最短路径','bfs':'BFS 网格搜索'};
export const storageStrategies={nearest:'就近空位',classified:'按产品分区',balanced:'均衡库区占用'};
export const pickStrategies={fifo:'先进先出',fefo:'临期优先'};
export const avoidanceStrategies={replan:'发现阻挡后重规划',wait:'停车等待障碍解除'};
export const schedulingStrategies={fifo:'先到先服务',priority:'优先级优先',nearest:'最近接货点优先'};
export const pickingAlgorithms={nearest:'最近邻',twoopt:'最近邻 + 2-opt 优化'};
export function obstacleBlocked(x,z,obstacles=[]){return obstacles.some(o=>Math.max(Math.abs(x-o.x),Math.abs(z-o.z))<=1);}
export function blocked(x,z){return x<1||z<1||x>=map.width-1||z>=map.height-1||assets.some(a=>Math.abs(x-a.x)<=a.w/2+.65&&Math.abs(z-a.z)<=a.d/2+.65);}
export function findPath(start,end,algorithm='astar',obstacles=[]){
 const occupied=(x,z)=>blocked(x,z)||obstacleBlocked(x,z,obstacles);
 if(!Object.hasOwn(algorithms,algorithm)||![...start,...end].every(Number.isInteger)||occupied(...start)||occupied(...end))throw Error('无效算法或起终点不可通行');
 const key=p=>p.join(','),goal=key(end),open=[{p:start,g:0}],cost=new Map([[key(start),0]]),parents=new Map(),closed=new Set();let expanded=0;
 while(open.length){if(algorithm!=='bfs')open.sort((a,b)=>(a.g+(algorithm==='astar'?Math.abs(a.p[0]-end[0])+Math.abs(a.p[1]-end[1]):0))-(b.g+(algorithm==='astar'?Math.abs(b.p[0]-end[0])+Math.abs(b.p[1]-end[1]):0)));
  const {p,g}=open.shift(),k=key(p);if(closed.has(k))continue;closed.add(k);expanded++;
  if(k===goal){const path=[end];let q=k;while(parents.has(q)){q=parents.get(q);path.unshift(q.split(',').map(Number));}return {path,distance:path.length-1,expanded,algorithm};}
  for(const [dx,dz]of [[1,0],[0,1],[-1,0],[0,-1]]){const next=[p[0]+dx,p[1]+dz],nk=key(next);if(occupied(...next)||g+1>=(cost.get(nk)??Infinity))continue;cost.set(nk,g+1);parents.set(nk,k);open.push({p:next,g:g+1});}
 }throw Error('没有可通行的路线');
}
export function initialLogistics(){return {vehicle:{id:'AGV-SIM-01',position:[3,10],source:'simulation'},inventory:[],jobs:[],movements:[],obstacles:[],queue:[],avoidance:'replan'};}
export function planJob(state,input){
 const {kind,product,quantity,algorithm='astar',strategy='nearest',pick='fifo',port='in'}=input;
 const route=(a,b)=>findPath(a,b,algorithm,state.obstacles||[]);
 if(!['inbound','outbound'].includes(kind)||!(['LIME-500','SODA-350'].includes(product)||state.inventory.some(l=>l.product===product))||!Number.isInteger(quantity)||quantity<1||quantity>120||!Object.hasOwn(algorithms,algorithm)||!Object.hasOwn(storageStrategies,strategy)||!Object.hasOwn(pickStrategies,pick))throw Error('请选择有效产品、算法及 1–120 箱的数量');
 let slot,lot;
 if(kind==='inbound'){
  if(!['in','pack'].includes(port))throw Error('请选择收货或装箱交接区');
  let candidates=slots.filter(s=>!state.inventory.some(l=>l.slot===s.id)&&quantity<=s.capacity&&(strategy!=='classified'||s.category===product||!s.category));
  const from=ports.find(p=>p.id===port).point;
  candidates=candidates.filter(s=>{try{route(from,s.access);return true;}catch{return false;}});
  candidates.sort((a,b)=>(strategy==='classified'?(Number(b.category===product)-Number(a.category===product)):0)||(strategy==='balanced'?(state.inventory.filter(l=>l.slot[0]===a.id[0]).length-state.inventory.filter(l=>l.slot[0]===b.id[0]).length)||a.id.localeCompare(b.id):route(from,a.access).distance-route(from,b.access).distance));
  slot=candidates[0];if(!slot)throw Error('没有符合策略的空库位');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.expiry||'')||!Number.isFinite(Date.parse(input.expiry))||input.expiry<new Date().toISOString().slice(0,10))throw Error('请选择有效的到期日期');
 }else{
  lot=state.inventory.filter(l=>l.product===product&&l.quantity>=quantity&&l.expiry>=new Date().toISOString().slice(0,10)).sort((a,b)=>(pick==='fefo'?a.expiry.localeCompare(b.expiry):a.receivedAt.localeCompare(b.receivedAt))||a.id.localeCompare(b.id))[0];
  if(!lot)throw Error('没有足量且未过期的单批库存，请减少数量或先入库');slot=slots.find(s=>s.id===lot.slot);
 }
 const from=kind==='inbound'?ports.find(p=>p.id===port).point:slot.access,to=kind==='inbound'?slot.access:ports.find(p=>p.id==='out').point;
 const approach=route(state.vehicle.position,from),loaded=route(from,to);
 return {...input,algorithm,strategy,pick,port,slot:slot.id,lotId:lot?.id,from,to,path:[...approach.path,...loaded.path.slice(1)],pickupIndex:approach.path.length-1,distance:approach.distance+loaded.distance,expanded:approach.expanded+loaded.expanded,seconds:(approach.distance+loaded.distance)*2};
}
export function advanceLogistics(state,timestamp=new Date().toISOString()){
 const job=state.jobs.find(j=>['running','waiting'].includes(j.status));if(!job)return null;
 const obstruction=job.path.slice(job.step+1).some(p=>obstacleBlocked(...p,state.obstacles||[]));
 if(obstruction){
  if((state.avoidance||'replan')==='wait'){job.status='waiting';job.waitReason='路线受阻，停车等待障碍移除';return null;}
  const carrying=job.step>=job.pickupIndex;
  try{
   const approach=carrying?{path:[state.vehicle.position],distance:0}:findPath(state.vehicle.position,job.from,job.algorithm,state.obstacles||[]);
   const loaded=findPath(carrying?state.vehicle.position:job.from,job.to,job.algorithm,state.obstacles||[]);
   job.travelled=(job.travelled||0)+job.step;job.path=[...approach.path,...loaded.path.slice(1)];job.step=0;job.pickupIndex=approach.path.length-1;job.replans=(job.replans||0)+1;job.distance=job.travelled+job.path.length-1;
  }catch{job.status='waiting';job.waitReason='没有安全可通行路线，保持当前位置';return null;}
 }
 job.status='running';job.waitReason=null;
 job.step=Math.min(job.step+1,job.path.length-1);state.vehicle.position=job.path[job.step];
 if(job.step<job.path.length-1)return null;
 if(job.kind==='inbound')state.inventory.push({id:job.id,slot:job.slot,product:job.product,quantity:job.quantity,expiry:job.expiry,receivedAt:timestamp,source:'simulation'});
 else{const lot=state.inventory.find(l=>l.id===job.lotId);if(!lot||lot.quantity<job.quantity)throw Error('库存与任务不一致');lot.quantity-=job.quantity;state.inventory=state.inventory.filter(l=>l.quantity>0);}
 job.status='completed';job.finishedAt=timestamp;state.movements.unshift({id:job.id,kind:job.kind,product:job.product,slot:job.slot,quantity:job.quantity,time:timestamp,source:'simulation'});return job;
}

export function rankQueue(state,strategy='fifo'){
 if(!Object.hasOwn(schedulingStrategies,strategy))throw Error('无效调度策略');
 const rows=(state.queue||[]).map(q=>{try{const plan=planJob(state,q);return {...q,slot:plan.slot,distance:plan.distance,approach:plan.pickupIndex,available:true};}catch(e){return {...q,available:false,reason:e.message};}});
 return rows.sort((a,b)=>Number(b.available)-Number(a.available)||(strategy==='priority'?(a.priority||2)-(b.priority||2):strategy==='nearest'?(a.approach??Infinity)-(b.approach??Infinity):0)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
export function comparePlans(state,input){return Object.keys(storageStrategies).map(strategy=>{try{return {strategy,...planJob(state,{...input,kind:'inbound',strategy})};}catch(e){return {strategy,error:e.message};}});}
export function planPicking(state,ids,algorithm='twoopt'){
 if(!Object.hasOwn(pickingAlgorithms,algorithm)||!Array.isArray(ids)||ids.length<1||ids.length>slots.length||ids.some(id=>!slots.some(s=>s.id===id)))throw Error('请选择 1–6 个有效库位');
 const selected=[...new Set(ids)],start=state.vehicle.position,end=ports.find(p=>p.id==='out').point,point=id=>slots.find(s=>s.id===id).access;
 const cache=new Map(),route=(a,b)=>{const key=[...a,...b].join(',');if(!cache.has(key))cache.set(key,findPath(a,b,'astar',state.obstacles||[]));return cache.get(key);};
 const score=order=>{const points=[start,...order.map(point),end];return points.slice(1).reduce((sum,p,i)=>sum+route(points[i],p).distance,0);};
 let order=[],left=[...selected],current=start;
 while(left.length){left.sort((a,b)=>route(current,point(a)).distance-route(current,point(b)).distance||a.localeCompare(b));const next=left.shift();order.push(next);current=point(next);}
 const nearestDistance=score(order);
 if(algorithm==='twoopt'){let improved=true;while(improved){improved=false;for(let i=0;i<order.length-1;i++)for(let j=i+1;j<order.length;j++){const candidate=[...order.slice(0,i),...order.slice(i,j+1).reverse(),...order.slice(j+1)];if(score(candidate)<score(order)){order=candidate;improved=true;}}}}
 const points=[start,...order.map(point),end],path=[start];points.slice(1).forEach((p,i)=>path.push(...route(points[i],p).path.slice(1)));
 return {algorithm,order,path,distance:score(order),originalDistance:score(selected),nearestDistance,seconds:score(order)*2,analysisOnly:true};
}
export function inventoryAnalysis(state,min=12,target=60){
 if(!Number.isInteger(min)||!Number.isInteger(target)||min<0||target<=min||target>720)throw Error('库存下限须为非负整数，目标库存须大于下限且不超过 720 箱');
 const codes=[...new Set(['LIME-500','SODA-350',...state.inventory.map(l=>l.product),...state.movements.map(m=>m.product)])],today=new Date().toISOString().slice(0,10);
 const rows=codes.map(product=>({product,stock:state.inventory.filter(l=>l.product===product&&l.expiry>=today).reduce((n,l)=>n+l.quantity,0),expired:state.inventory.filter(l=>l.product===product&&l.expiry<today).reduce((n,l)=>n+l.quantity,0),outbound:state.movements.filter(m=>m.product===product&&m.kind==='outbound').reduce((n,m)=>n+m.quantity,0)})).sort((a,b)=>b.outbound-a.outbound||a.product.localeCompare(b.product));
 const total=rows.reduce((n,r)=>n+r.outbound,0);let sum=0;
 return rows.map(r=>{const category=!r.outbound?'未分类':sum/total<.8?'A':sum/total<.95?'B':'C';sum+=r.outbound;return {...r,category,share:total?r.outbound/total:0,replenish:r.stock<min?target-r.stock:0,min,target};});
}

// Visual layers share the exact navigation grid used by findPath.
export const spatialZones=[
 {id:'production',name:'生产作业区',color:'#639fe0',x:.5,z:.5,w:15,d:8.5,label:[1,1]},
 {id:'storage',name:'仓储库区',color:'#ac8bd9',x:17.5,z:.5,w:5,d:14,label:[18,1]},
 {id:'receiving',name:'收货交接区',color:'#dba356',x:.5,z:10.5,w:5,d:4,label:[1,14]},
 {id:'shipping',name:'发货交接区',color:'#54ae9c',x:7.5,z:11.5,w:7,d:3,label:[8,14]},
];
export const spatialLegend=[...spatialZones.map(z=>({id:z.id,label:z.name,color:z.color})),
 {id:'road',label:'可通行道路',color:'#73b8bc'},
 {id:'blocked',label:'设备 / 禁行区域',color:'#667688',pattern:true},
 {id:'obstacle',label:'临时障碍 / 安全区',color:'#d76451'},
 {id:'route',label:'当前规划路线',color:'#267fed'},
];
export const navigationCells=Array.from({length:map.width},(_,x)=>Array.from({length:map.height},(_,z)=>({x,z,blocked:blocked(x,z)}))).flat();

// Production cartons share the inventory ledger; only confirmed simulated placement commits stock.
export function reserveProductionSlot(state,product){
 return slots.find(s=>state.inventory.filter(l=>l.slot===s.id).reduce((n,l)=>n+l.quantity,0)<s.capacity&&!state.inventory.some(l=>l.slot===s.id&&l.product!==product)&&!state.jobs.some(j=>['running','paused','waiting'].includes(j.status)&&j.slot===s.id))?.id||null;
}
export function storeProductionCarton(state,token,product,expiry,timestamp=new Date().toISOString()){
 const id='production:'+token.id;if(state.inventory.some(l=>l.id===id)||state.movements.some(m=>m.id===id))return true;
 const slot=slots.find(s=>s.id===token.storageSlot);
 if(!slot||!token.packed||!Number.isInteger(token.count)||token.count<1||token.packedCount!==token.count||state.inventory.filter(l=>l.slot===slot.id).reduce((n,l)=>n+l.quantity,0)>=slot.capacity||state.inventory.some(l=>l.slot===slot.id&&l.product!==product))return false;
 state.inventory.push({id,slot:slot.id,product,quantity:1,bottles:token.count,expiry,receivedAt:timestamp,source:'simulation',taskId:token.id.split('-').slice(0,-1).join('-')});
 state.movements.unshift({id,kind:'inbound',product,slot:slot.id,quantity:1,bottles:token.count,time:timestamp,source:'simulation'});return true;
}
