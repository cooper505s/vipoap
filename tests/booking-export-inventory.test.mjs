import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectBookingExport} from '../scripts/inspect-booking-export.mjs';
const booking=(key='booking:synthetic',extra={})=>({key,value:JSON.stringify({reference:'VIP-SYNTHETIC',date:'2026-11-01',time:'10:00',duration:60,status:'confirmed',name:'Synthetic Private Name',email:'private@example.test',...extra})});
const input=records=>({complete:true,source:'preview',exportedAt:'2026-10-28T11:00:00Z',records});

test('offline inventory counts records without outputting customer data',()=>{
  const result=inspectBookingExport(input([booking(),{key:'admin-session:synthetic',value:'private-token'}]));
  assert.equal(result.recordCount,2);assert.equal(result.bookingCount,1);assert.equal(result.otherRecordCount,1);assert.equal(result.exceptionCount,0);assert.equal(result.cutoverReady,false);assert.equal(result.dryRun,true);
  assert.match(result.bookings[0].sourceHash,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(result),/Private Name|private@example|private-token|admin-session/);
});

test('manifest hashes are stable across export order and change with source content',()=>{
  const a=booking('booking:a'),b=booking('booking:b'),one=inspectBookingExport(input([a,b])),two=inspectBookingExport(input([b,a]));assert.equal(one.manifestHash,two.manifestHash);
  assert.notEqual(one.manifestHash,inspectBookingExport(input([booking('booking:a',{status:'cancelled'}),b])).manifestHash);
});

test('duplicate keys, malformed JSON and incomplete exports fail closed',()=>{
  for(const records of [[booking(),booking()],[{key:'booking:bad',value:'{' }],[{key:'booking:bad',value:'[]'}],[{key:'booking:bad',value:null}]])assert.throws(()=>inspectBookingExport(input(records)));
  for(const change of [{complete:false},{source:'unknown'},{exportedAt:'invalid'},{records:null}])assert.throws(()=>inspectBookingExport({...input([]),...change}));
});

test('missing booking fields remain explicit import exceptions',()=>{
  const result=inspectBookingExport(input([booking('booking:incomplete',{reference:'',date:'unknown',time:'25:00',duration:'60',status:''})]));assert.equal(result.exceptionCount,1);assert.deepEqual(result.bookings[0].issues,['missing-reference','invalid-wall-time','invalid-duration','missing-state']);assert.equal(result.cutoverReady,false);
});


test('import inventory quarantines invalid dates and clock-change ambiguity',()=>{
  for(const [date,time] of [['2026-02-30','10:00'],['2026-03-29','01:30'],['2026-10-25','01:30']]){
    const result=inspectBookingExport(input([booking('booking:time',{date,time})]));assert.deepEqual(result.bookings[0].issues,['invalid-wall-time']);assert.equal(result.exceptionCount,1);
  }
});


test('complete export integrity includes non-booking eligibility and session records without exposing them',()=>{
 const record=booking(),operator={key:'operator:private-engineer',value:'private eligibility one'},session={key:'admin-session:private',value:'private session token'},first=inspectBookingExport(input([record,operator,session])),reordered=inspectBookingExport(input([session,operator,record])),changed=inspectBookingExport(input([record,{...operator,value:'private eligibility two'},session]));
 assert.equal(first.exportHash,reordered.exportHash);assert.notEqual(first.exportHash,changed.exportHash);assert.equal(first.manifestHash,changed.manifestHash);assert.match(first.exportHash,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(first),/private-engineer|private eligibility|private session token|admin-session/);
});
test('complete export cannot silently accept malformed non-booking record values',()=>{for(const value of [null,{},42])assert.throws(()=>inspectBookingExport(input([booking(),{key:'operator:invalid',value}])))});
