import test from 'node:test';
import assert from 'node:assert/strict';
import {chinaDay,dailyRecord,recordProduction} from './daily-metrics.mjs';
test('Beijing day boundary and mode isolation',()=>{
 const db={dataMode:'simulation'},before=Date.parse('2026-10-04T15:59:59Z'),after=Date.parse('2026-10-04T16:00:00Z');
 recordProduction(db,4,before);assert.equal(dailyRecord(db,before).produced,4);assert.equal(dailyRecord(db,before).hourly[23],4);assert.equal(dailyRecord(db,before).hourly[0],null);
 assert.equal(chinaDay(after),'2026-10-05');assert.equal(dailyRecord(db,after).produced,0);
 db.dataMode='real';recordProduction(db,10,before);assert.equal(dailyRecord(db,before).produced,0);assert.ok(dailyRecord(db,before).hourly.every(v=>v===null));
 db.dataMode='simulation';assert.equal(dailyRecord(db,before).produced,4);
});
test('increments persist and never import cumulative totals',()=>{
 const at=Date.parse('2026-10-04T03:00:00Z'),db={dataMode:'simulation',produced:12000};recordProduction(db,0,at);assert.equal(dailyRecord(db,at).produced,0);
 const restored=JSON.parse(JSON.stringify(db));recordProduction(restored,3,at+2000);assert.equal(dailyRecord(restored,at).produced,3);assert.equal(dailyRecord(restored,at).hourly[11],3);
});

test('mixed mode counts completed local simulated flow without borrowing pure simulation or real totals',()=>{
 const at=Date.parse('2026-11-17T02:00:00Z'),db={dataMode:'simulation'};recordProduction(db,5,at);db.dataMode='mixed';recordProduction(db,12,at);
 assert.equal(dailyRecord(db,at).produced,12);assert.equal(dailyRecord(db,at).hourly[10],12);
 db.dataMode='real';recordProduction(db,50,at);assert.equal(dailyRecord(db,at).produced,0);db.dataMode='simulation';assert.equal(dailyRecord(db,at).produced,5);
});
