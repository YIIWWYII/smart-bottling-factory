export function parseDeviceHandoff(raw,devices,links=[]){
 const input=JSON.parse(raw.replace(/^\uFEFF/,''));
 if(!input||Array.isArray(input)||input.type!=='bottle-device-connection'||input.version!==1)throw Error('请使用设备连接交付模板（版本 1）。');
 const c=input.connection;
 if(!c||!devices.some(d=>d.id===c.deviceId))throw Error('设备编号未在平台登记，请先核对设备资产。');
 if(!['http','modbus','mqtt','opcua'].includes(c.protocol))throw Error('不支持此通信协议。');
 if(c.protocol!=='http'&&(typeof c.host!=='string'||!c.host.trim()||c.host.length>200||!Number.isInteger(c.port)||c.port<1||c.port>65535))throw Error('请填写有效地址和端口。');
 if(c.protocol==='modbus'&&(!Number.isInteger(c.unitId)||c.unitId<1||c.unitId>247))throw Error('Modbus 站号应为 1–247。');
 const old=links.find(l=>l.deviceId===c.deviceId&&l.protocol===c.protocol);
 return {id:old?.id,deviceId:c.deviceId,protocol:c.protocol,host:c.host||'',port:c.port||80,unitId:c.unitId||1,topic:typeof c.topic==='string'?c.topic.slice(0,200):'',nodeId:typeof c.nodeId==='string'?c.nodeId.slice(0,200):'',note:typeof c.note==='string'?c.note.slice(0,500):'',enabled:c.protocol==='modbus'};
}
