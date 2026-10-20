import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readRenderingMode,browserArgs} from './rendering-settings.mjs';

test('missing or invalid settings always default to software',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bottle-rendering-'));
 try{
  assert.equal(readRenderingMode(root),'software');
  fs.writeFileSync(path.join(root,'.local-rendering.json'),'{bad');assert.equal(readRenderingMode(root),'software');
  for(const mode of ['software','hybrid','hardware']){fs.writeFileSync(path.join(root,'.local-rendering.json'),JSON.stringify({mode}));assert.equal(readRenderingMode(root),mode);}
  fs.writeFileSync(path.join(root,'.local-rendering.json'),'{"mode":"other"}');assert.equal(readRenderingMode(root),'software');
 }finally{fs.rmSync(root,{recursive:true});}
});
test('software uses explicit SwiftShader; accelerated modes do not',()=>{
 const args=browserArgs('software','F:/BottleAI/browser/software','http://127.0.0.1:5174');
 assert.ok(args.includes('--use-angle=swiftshader'));
 assert.ok(args.includes('--disable-gpu-compositing'));
 for(const mode of ['hybrid','hardware'])assert.ok(!browserArgs(mode,'profile','url').some(v=>v.includes('swiftshader')));
 assert.throws(()=>browserArgs('invalid','profile','url'));
});
