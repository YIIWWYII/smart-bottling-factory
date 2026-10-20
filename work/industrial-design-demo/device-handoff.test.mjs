import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDeviceHandoff} from './src/deviceHandoff.js';
const devices=[{id:'DEV-1'}];
const raw=connection=>JSON.stringify({type:'bottle-device-connection',version:1,connection});
test('handoff imports only known connection fields and does not enable HTTP reception',()=>{
 const r=parseDeviceHandoff(raw({deviceId:'DEV-1',protocol:'http',enabled:true,token:'not-imported',action:'save'}),devices);
 assert.equal(r.enabled,false);assert.equal(r.token,undefined);assert.equal(r.action,undefined);
});
test('handoff matches existing Modbus connection and rejects invalid device/address/unit',()=>{
 const c={deviceId:'DEV-1',protocol:'modbus',host:'192.168.1.20',port:502,unitId:1};
 assert.equal(parseDeviceHandoff(raw(c),devices,[{id:'existing',deviceId:'DEV-1',protocol:'modbus'}]).id,'existing');
 assert.throws(()=>parseDeviceHandoff(raw({...c,deviceId:'unknown'}),devices));
 assert.throws(()=>parseDeviceHandoff(raw({...c,port:0}),devices));
 assert.throws(()=>parseDeviceHandoff(raw({...c,unitId:248}),devices));
 assert.throws(()=>parseDeviceHandoff('{invalid',devices));
});
