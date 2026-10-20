import {stages} from './src/data.js';
import {connectionProfiles,timeoutOptions} from './src/connectionProfiles.js';

export function defaultConnections(){return stages.map((s,i)=>({stageIndex:i,deviceId:s.code,protocol:'http',enabled:false,timeoutSeconds:15,host:'',port:0,topic:'',point:'',note:'',version:1}));}
export function validateConnection(body,previous){
 const fail=message=>{throw Object.assign(new Error(message),{status:400});};
 if(!previous)fail('工序无效。');
 if(body.version!==previous.version)throw Object.assign(new Error('配置已更新，请关闭后重新打开。'),{status:409});
 if(!/^[A-Za-z0-9_.:-]{1,80}$/.test(body.deviceId||''))fail('设备编号仅允许字母、数字、点、冒号、横线与下划线（最多 80 字）。');
 if(!Object.hasOwn(connectionProfiles,body.protocol)||typeof body.enabled!=='boolean'||!timeoutOptions.includes(body.timeoutSeconds))fail('请选择有效的协议、接收开关和超时。');
 for(const [key,max] of [['host',200],['topic',200],['point',200],['note',300]])if(typeof body[key]!=='string'||body[key].length>max||/[\r\n\x00-\x1f]/.test(body[key]))fail('配置文本长度或格式无效。');
 if(body.host&&!/^[a-zA-Z0-9.:[\]-]+$/.test(body.host))fail('主机只填 IP 或域名，不要填写用户名、密码或完整 URL。');
 if(!Number.isInteger(body.port)||body.port<0||body.port>65535)fail('端口须为 0–65535；0 表示未填写。');
 if(body.protocol!=='http'&&body.enabled)fail('该协议目前仅支持保存接入草案，尚不能启用驱动。');
 return {stageIndex:previous.stageIndex,deviceId:body.deviceId,protocol:body.protocol,enabled:body.enabled,timeoutSeconds:body.timeoutSeconds,host:body.host.trim(),port:body.port,topic:body.topic.trim(),point:body.point.trim(),note:body.note.trim(),version:previous.version+1};
}
export function telemetryFresh(sample,config,clock=Date.now()){
 return !!(config?.enabled&&config.protocol==='http'&&sample?.deviceId===config.deviceId&&Number.isFinite(sample.receivedAt)&&clock>=sample.receivedAt&&clock-sample.receivedAt<config.timeoutSeconds*1000);
}
export function connectionStatus(config,sample,tokenConfigured,mode){
 const fresh=telemetryFresh(sample,config);
 return {stageIndex:config.stageIndex,deviceId:config.deviceId,protocol:config.protocol,enabled:config.enabled,timeoutSeconds:config.timeoutSeconds,
  status:config.protocol!=='http'?'draft':!config.enabled?'disabled':!tokenConfigured?'unauthenticated':mode==='simulation'?'simulation':fresh?'live':sample?'stale':'waiting',
  receivedAt:sample?.deviceId===config.deviceId?sample.receivedAt:null,control:'unavailable',
  checks:[{label:'协议驱动',ok:config.protocol==='http',detail:config.protocol==='http'?'标准遥测接收器可用':'仅配置草案，驱动待适配'},
   {label:'接收开关',ok:config.enabled,detail:config.enabled?'允许已绑定设备上报':'尚未启用接收'},
   {label:'网关认证',ok:tokenConfigured,detail:tokenConfigured?'服务端令牌已配置':'服务端 TELEMETRY_TOKEN 未配置'},
   {label:'当前模式',ok:mode!=='simulation',detail:mode==='simulation'?'模拟模式不接收实体遥测':'允许接收实体遥测'},
   {label:'最近遥测',ok:fresh,detail:fresh?'已接收匹配编号的有效数据':sample?'最近数据已失效':'尚无匹配的设备上报'},
   {label:'真实控制',ok:false,detail:'未实现命令驱动与执行回执，禁止真实控制'}]};
}
