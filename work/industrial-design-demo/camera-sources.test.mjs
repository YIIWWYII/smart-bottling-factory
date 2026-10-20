import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraIds,validateCameraSources} from './camera-sources.mjs';
const defaults=()=>cameraIds.map(id=>({id,type:'video',url:''}));
test('four optional feeds preserve distinct addresses and reject unsupported sources',()=>{
 const a=defaults();assert.equal(validateCameraSources(a).length,4);
 a[0].type='mjpeg';a[0].url='http://localhost:8080/feed';assert.equal(validateCameraSources(a)[0].url,a[0].url);
 for(const url of ['rtsp://localhost/feed','javascript:alert(1)','https://user:pass@camera/feed']){a[0].url=url;assert.throws(()=>validateCameraSources(a));}
 assert.throws(()=>validateCameraSources([defaults()[0],...defaults().slice(0,3)]));
});

import {secondaryCameraIds} from './camera-sources.mjs';
test('secondary endpoints accept a separate complete group and reject mixed stations',()=>{
 const feeds=secondaryCameraIds.map(id=>({id,type:'video',url:''}));assert.equal(validateCameraSources(feeds).length,4);
 feeds[1].id=cameraIds[1];assert.throws(()=>validateCameraSources(feeds));
});
