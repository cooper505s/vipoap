import test from 'node:test';
import assert from 'node:assert/strict';
import {ukAppointmentInterval} from '../functions/_shared/booking-time.js';

const interval=(date,time='10:00',durationMinutes=60)=>ukAppointmentInterval({date,time,durationMinutes});
const start=(date,time)=>new Date(interval(date,time).startMs).toISOString();

test('UK appointments convert winter and summer wall time to UTC',()=>{
  assert.equal(start('2026-01-15','10:00'),'2026-01-15T10:00:00.000Z');
  assert.equal(start('2026-07-15','10:00'),'2026-07-15T09:00:00.000Z');
  assert.equal(start('2026-07-15','00:00'),'2026-07-14T23:00:00.000Z');
});

test('spring clock gap is rejected while either side converts correctly',()=>{
  for(const time of ['01:00','01:30','01:59'])assert.throws(()=>interval('2026-03-29',time),error=>error.status===400&&/does not exist/.test(error.message));
  assert.equal(start('2026-03-29','00:59'),'2026-03-29T00:59:00.000Z');
  assert.equal(start('2026-03-29','02:00'),'2026-03-29T01:00:00.000Z');
});

test('autumn repeated hour is rejected instead of silently choosing a slot',()=>{
  for(const time of ['01:00','01:30','01:59'])assert.throws(()=>interval('2026-10-25',time),error=>error.status===400&&/occurs twice/.test(error.message));
  assert.equal(start('2026-10-25','00:59'),'2026-10-24T23:59:00.000Z');
  assert.equal(start('2026-10-25','02:00'),'2026-10-25T02:00:00.000Z');
});

test('reservation duration is elapsed time across clock and midnight changes',()=>{
  for(const [date,time] of [['2026-03-29','00:30'],['2026-10-25','00:30'],['2026-12-31','23:30']]){
    const result=interval(date,time,120);assert.equal(result.endMs-result.startMs,7200000);assert.equal(result.timeZone,'Europe/London');
  }
});

test('invalid calendar dates, wall times and durations are rejected',()=>{
  for(const date of ['2026-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','1999-12-31','2101-01-01','2026-1-01','2026-01-01T00:00Z'])assert.throws(()=>interval(date),{status:400});
  for(const time of ['24:00','12:60','1:30','10:00Z','10:00:00'])assert.throws(()=>interval('2026-01-01',time),{status:400});
  for(const minutes of [0,-1,481,30.5,'30',NaN,Infinity])assert.throws(()=>interval('2026-01-01','10:00',minutes),{status:400});
  assert.equal(start('2028-02-29','10:00'),'2028-02-29T10:00:00.000Z');
});

test('conversions are independent of the server timezone',()=>{
  const previous=process.env.TZ;
  try{for(const timezone of ['UTC','America/Los_Angeles','Asia/Tokyo']){process.env.TZ=timezone;assert.equal(start('2026-07-15','10:00'),'2026-07-15T09:00:00.000Z');}}
  finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
