export const cameraIds=['VIS-TOP-01','VIS-SIDE-01','VIS-SIDE-02','VIS-SIDE-03'];
export const secondaryCameraIds=['SEC-CAM-01','SEC-SIDE-01','SEC-SIDE-02','SEC-SIDE-03'];
export const recognitionCameraId='VIS-PRODUCT-01';
export function validateCameraSources(items){
 const recognitionOnly=Array.isArray(items)&&items.length===1&&items[0]?.id===recognitionCameraId;
 if(!recognitionOnly&&(!Array.isArray(items)||![4,5].includes(items.length)))throw Error('请配置四路检测相机，或单独保存瓶型识别相机。');
 const allowed=items[0]?.id?.startsWith('SEC-')?secondaryCameraIds:cameraIds;
 const expected=recognitionOnly?[recognitionCameraId]:items.length===4?allowed:[...allowed,recognitionCameraId];
 const seen=new Set();return items.map(item=>{
  if(!expected.includes(item.id)||seen.has(item.id))throw Error('相机编号无效或重复。');seen.add(item.id);
  if(!['video','mjpeg','usb'].includes(item.type))throw Error('请选择 USB 摄像头、视频或 MJPEG。');
  const url=String(item.url||'').trim();if(url.length>2000)throw Error('地址过长。');
  if(url&&item.type!=='usb'){const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('请使用不含用户名和密码的 HTTP/HTTPS 网关地址。');}
  return {id:item.id,type:item.type,url};
 });
}
