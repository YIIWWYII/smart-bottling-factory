import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraIds,recognitionCameraId,validateCameraSources} from './camera-sources.mjs';
const defaults=()=>cameraIds.map(id=>({id,type:'video',url:''}));
test('four optional feeds preserve distinct addresses and reject unsupported sources',()=>{
 const a=defaults();assert.equal(validateCameraSources(a).length,4);
 a[0].type='mjpeg';a[0].url='http://localhost:8080/feed';assert.equal(validateCameraSources(a)[0].url,a[0].url);
 a[0].type='usb';a[0].url='browser-device-id';assert.equal(validateCameraSources(a)[0].url,'browser-device-id');a[0].type='mjpeg';
 for(const url of ['rtsp://localhost/feed','javascript:alert(1)','https://user:pass@camera/feed']){a[0].url=url;assert.throws(()=>validateCameraSources(a));}
 assert.throws(()=>validateCameraSources([defaults()[0],...defaults().slice(0,3)]));
});

import {secondaryCameraIds} from './camera-sources.mjs';
test('secondary endpoints accept a separate complete group and reject mixed stations',()=>{
 const feeds=secondaryCameraIds.map(id=>({id,type:'video',url:''}));assert.equal(validateCameraSources(feeds).length,4);
 feeds[1].id=cameraIds[1];assert.throws(()=>validateCameraSources(feeds));
});

test('optional fifth product-recognition feed is distinct and can use a network stream',()=>{
 const feeds=defaults();feeds.push({id:recognitionCameraId,type:'mjpeg',url:'http://192.168.1.40:8080/camera.mjpg'});
 assert.equal(validateCameraSources(feeds).length,5);assert.equal(validateCameraSources(feeds)[4].id,recognitionCameraId);
 assert.deepEqual(validateCameraSources([feeds[4]]),[feeds[4]]);
 assert.throws(()=>validateCameraSources([feeds[0]]));
 feeds[4].id='SEC-CAM-01';assert.throws(()=>validateCameraSources(feeds));
});
