import test from 'node:test';
import assert from 'node:assert/strict';
import {stationOutput,validateStationFeedback} from './src/stationTelemetry.js';
const twin=(dataMode,state,protocol=false)=>({dataMode,protocol:{enabled:protocol},states:Array.from({length:9},()=>state)});
test('real, mixed and protocol use returned values, preserve missing and zero',()=>{
 for(const [mode,protocol] of [['real',false],['mixed',false],['simulation',true]]){
  assert.equal(stationOutput(twin(mode,{quality:'live',rate:17},protocol),4).value,17);
  assert.equal(stationOutput(twin(mode,{quality:'live',rate:17},protocol),3).value,null);
  assert.equal(stationOutput(twin(mode,{quality:'live',prepProgress:0},protocol),3).value,0);
  assert.equal(stationOutput(twin(mode,{quality:'offline',prepProgress:82,rate:17},protocol),3).value,null);
 }
});
test('actual process feedback preserves separate bottle times and explicit empty occupancy',()=>{
 const inspection={bottles:[{id:'a',duration:90,elapsed:12,status:'testing'},{id:'b',duration:60,elapsed:60,status:'done'}]};
 assert.deepEqual(validateStationFeedback(1,{inspection}).inspection,inspection);
 assert.deepEqual(validateStationFeedback(1,{inspection:{bottles:[]}}).inspection.bottles,[]);
 assert.equal(validateStationFeedback(1,{}).inspection,undefined);
 assert.equal(validateStationFeedback(0,{washPhase:'air',measurements:{airFlow:80}}).washPhase,'air');
});
test('wrong stages, invalid times and out-of-range values are rejected',()=>{
 const b={id:'a',duration:60,elapsed:12,status:'testing'};
 for(const body of [{inspection:{bottles:Array(5).fill(b)}},{inspection:{bottles:[b,b]}},{inspection:{bottles:[{...b,elapsed:61}]}}])assert.throws(()=>validateStationFeedback(1,body));
 assert.throws(()=>validateStationFeedback(0,{prepProgress:10}));
 assert.throws(()=>validateStationFeedback(3,{prepProgress:101}));
 assert.throws(()=>validateStationFeedback(7,{measurements:{batteryLevel:101}}));
 assert.throws(()=>validateStationFeedback(0,{material:{count:0,processing:true,phase:'processing'}}));
});
