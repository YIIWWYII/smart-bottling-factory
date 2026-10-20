// Protocol templates are configuration records, not active device drivers.
export const connectionProfiles = {
  http: {label:'标准 HTTP 遥测', ready:true, description:'网关转换后上报读数、速度和状态。已支持认证接收，不含硬件控制。'},
  plc: {label:'PLC · Modbus / MQTT', ready:false, description:'PLC → IPC 网关 → MQTT。先登记设备、点位与主题，现场协议核对后实现驱动。'},
  robot: {label:'机械臂 · TCP', ready:false, description:'登记控制器与程序名；连接、使能和运行是不同动作。本页不会发送任何指令。'},
  vision: {label:'工业相机 · 识别事件', ready:false, description:'登记相机及识别结果主题，产品编码、置信度和图片证据需另行适配。'},
  pda: {label:'PDA · 扫码出入库', ready:false, description:'登记扫码设备，箱码、批次与出入库单通过业务事件接入。'},
  agv: {label:'AGV · 调度接口', ready:false, description:'登记车辆接口。位置、地图、任务完成回执需与车辆协议核对。'},
};
export const timeoutOptions=[5,15,30,60];
