import test from 'node:test';
import assert from 'node:assert/strict';
import {retainSnapshot} from './src/retainSnapshot.js';

test('polling retains unchanged assets and controls while updating live data',()=>{
 const previous={assets:[{id:'arm',placement:{x:1}}],controls:{flow:20},reading:5};
 const next=JSON.parse(JSON.stringify(previous));next.reading=6;
 const merged=retainSnapshot(previous,next);
 assert.deepEqual(merged,next);
 assert.equal(merged.assets,previous.assets);assert.equal(merged.controls,previous.controls);
 assert.equal(previous.reading,5);
 assert.equal(retainSnapshot(merged,JSON.parse(JSON.stringify(merged))),merged);
});
test('asset placement changes, removal and order are not lost',()=>{
 const previous=[{id:'a',placement:{x:1}},{id:'b',placement:{x:2}}];
 const changed=retainSnapshot(previous,[{id:'a',placement:{x:3}},previous[1]]);
 assert.equal(changed[0].placement.x,3);assert.equal(changed[1],previous[1]);
 assert.deepEqual(retainSnapshot(previous,[previous[1],previous[0]]),[previous[1],previous[0]]);
 assert.deepEqual(retainSnapshot({a:1,b:2},{a:1}),{a:1});
 assert.deepEqual(retainSnapshot(previous,[]),[]);
 assert.equal(retainSnapshot(previous,null),null);
 assert.deepEqual(retainSnapshot(null,{a:1}),{a:1});
});
