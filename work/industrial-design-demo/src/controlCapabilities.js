import definitions from '../config/device-capabilities.json' with {type:'json'};

export const capabilities=definitions.capabilities;
export const deviceNames=definitions.deviceNames;
export const deviceName=code=>deviceNames[code]||'设备';
