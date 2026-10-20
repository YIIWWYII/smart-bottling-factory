import test from 'node:test';
import assert from 'node:assert/strict';
import {productionReports} from './src/assistantReport.js';
test('report preserves missing days and hours, and does not double count supplied totals',()=>{
 const trace=[{tool:'query_production',status:'success',at:'2026-10-18T00:00:00Z',result:{from:'2026-10-16',to:'2026-10-18',dataMode:'simulation',produced:999,rows:[{day:'2026-10-16',produced:0,hourly:[null,0]},{day:'2026-10-18',produced:12,hourly:[12]}]}}];
 const [r]=productionReports(trace);assert.equal(r.total,12);assert.equal(r.recorded,2);assert.deepEqual(r.days.map(d=>d.produced),[0,null,12]);assert.deepEqual(r.days[0].hourly.slice(0,3),[null,0,null]);assert.equal(r.mode,'simulation');
});
test('missing result is not a zero total; failed queries are not plotted',()=>{
 const data={from:'2026-10-18',to:'2026-10-18',rows:[]};
 assert.equal(productionReports([{tool:'query_production',status:'success',result:data}])[0].total,null);
 assert.deepEqual(productionReports([{tool:'query_production',status:'error',result:data}]),[]);
});
