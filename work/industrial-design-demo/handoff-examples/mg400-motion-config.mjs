import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function loadMotionConfig(){
 const c=JSON.parse(readFileSync(new URL('../config/mg400-motion.json',import.meta.url),'utf8'));
 const trajectories=JSON.parse(readFileSync(new URL('../config/mg400-trajectories.json',import.meta.url),'utf8'));
 if(trajectories.version!==1)throw Error('轨迹配置版本不支持');
 c.smallPaths={...c.smallPaths,origin:trajectories.smallPaths?.origin,defaultPath:trajectories.smallPaths?.defaultPath,paths:trajectories.smallPaths?.paths};
 c.pickPlace={...c.pickPlace,points:trajectories.pickPlace?.points};
 validateMotionConfig(c);return c;
}
export function validateMotionConfig(c){
 const check=(ok,message)=>{if(!ok)throw Error(`动作配置：${message}`);};
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 if(c?.liveTest){const live=c.liveTest;
  for(const name of ['speedFactorPercent','speedLPercent','accLPercent'])check(integer(live[name],1,100),`liveTest.${name} 须为1–100%`);
  for(const name of ['pickWaitMs','placeWaitMs','suctionOffGapMs','blowPulseMs','releaseWaitMs','cycleWaitMs'])check(integer(live[name],0,60000),`liveTest.${name} 须为0–60000 ms`);
  check(live.vacuumOutput===2&&live.blowOutput===1,'已核对接线为DO2吸气、DO1吹气，不能直接互换');
 }
 check(c?.version===1,'不支持的版本');const s=c.smallPaths,p=c.pickPlace;
 check(s&&p,'缺少 smallPaths 或 pickPlace');
 check(Array.isArray(s.origin)&&s.origin.length===4&&s.origin.every(Number.isFinite),'origin 必须为 X/Y/Z/R 四个数字');
 for(const [name,value] of Object.entries({speedFactorPercent:s.speedFactorPercent,speedLPercent:s.speedLPercent,accLPercent:s.accLPercent}))check(integer(value,1,5),`${name} 保持本次小幅测试的 1–5% 范围`);
 for(const value of [s.dwellMs,s.observeDwellMs])check(integer(value,0,60000),'停留时间须为 0–60000 ms');
 check(s.paths&&Object.hasOwn(s.paths,s.defaultPath),'默认轨迹不存在');
 for(const [name,points] of Object.entries(s.paths)){
  check(/^[a-zA-Z][\w-]*$/.test(name),'轨迹名称只能用字母、数字、下划线或横线');
  check(Array.isArray(points)&&points.length>0&&points.length<=100,`${name} 须包含 1–100 个点`);
  for(const point of points)check(Array.isArray(point)&&point.length===3&&point.every(Number.isFinite)&&Math.hypot(...point)<=12,`${name} 偏移须为 XYZ 毫米，距起点不超过 12 mm`);
 }
 for(const value of [p.speedLPercent,p.accLPercent])check(integer(value,1,10),'取放模板速度/加速度范围为 1–10%');
 for(const name of ['start','pickAbove','pick','transit','placeAbove','place'])check(/^P[1-9]\d*$/.test(p.points?.[name]),`无效示教点 ${name}`);
 const v=p.vacuum;check(v&&['unconfigured','digital-output'].includes(v.mode),'吸具模式须为 unconfigured 或 digital-output');
 check(v.pressureKPa===null,'尚未接入调压硬件，不能设置吸取压力');
 for(const value of [v.pickWaitMs,v.releaseWaitMs])check(integer(value,0,60000),'吸取/释放等待须为 0–60000 ms');
 if(v.mode==='digital-output'){
  check(integer(v.output,1,16),'单 DO 输出编号须为 1–16，仍须按现场控制器核对');
  check([0,1].includes(v.onLevel)&&[0,1].includes(v.offLevel)&&v.onLevel!==v.offLevel,'吸取与释放电平须为不同的 0/1');
 }else check(v.output===null&&v.onLevel===null&&v.offLevel===null,'未配置模式下接口和电平应为 null');
 return c;
}

export function renderPickPlace(template,config){
 validateMotionConfig(config);const p=config.pickPlace,v=p.vacuum;
 const values={SPEED_PERCENT:p.speedLPercent,VACUUM_DO:v.output??'nil',VACUUM_ON:v.onLevel===null?'nil':v.onLevel===1?'ON':'OFF',VACUUM_OFF:v.offLevel===null?'nil':v.offLevel===1?'ON':'OFF',PICK_WAIT_MS:v.pickWaitMs,RELEASE_WAIT_MS:v.releaseWaitMs,PREVIEW_ONLY:'true',SITE_CHECKED:'false',START_AT_P1:'false',IO_CHECKED:'false'};
 let output=template;
 for(const [key,value] of Object.entries(values)){
  const pattern=new RegExp(`^(local ${key} = )[^\\r\\n]*`,'m');
  if(!pattern.test(output))throw Error(`Lua 模板缺少 ${key}`);
  output=output.replace(pattern,`$1${value}`);
 }
 const points='local points = {'+Object.entries(p.points).filter(([key])=>['start','pickAbove','pick','transit','placeAbove','place'].includes(key)).map(([key,value])=>`${key}=${value}`).join(', ')+'}';
 if(!/^local points = .*$/m.test(output)||!/^    AccL\(\d+\)/m.test(output))throw Error('Lua 模板结构不匹配');
 return output.replace(/^local points = .*$/m,points).replace(/^    AccL\(\d+\)/m,`    AccL(${p.accLPercent})`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config=loadMotionConfig();
 if(process.argv[2]==='--export-lua'){
  const file=new URL('./mg400_pick_place.configured.lua',import.meta.url);
  const source=readFileSync(new URL('./mg400_pick_place.lua',import.meta.url),'utf8');
  writeFileSync(file,renderPickPlace(source,config),'utf8');
  console.log('已生成预览脚本（未连接设备）：',file.pathname);
 }else if(process.argv[2]&&process.argv[2]!=='--check')throw Error('只支持 --check 或 --export-lua');
 else console.log('配置校验通过（离线，不连接设备）',JSON.stringify({paths:Object.keys(config.smallPaths.paths),vacuum:config.pickPlace.vacuum.mode}));
}
