import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as report} from '../functions/api/admin/incidents.js';
import {onRequestPost as action} from '../functions/api/admin/job-actions.js';
import {digest} from '../functions/_shared/admin-auth.js';

async function setup(role='operator'){
  const values=new Map(),token='synthetic-safety-session',env={VIPOAP_DATA:{async get(key,type){const value=values.get(key);return type==='json'&&value?JSON.parse(value):value??null},async put(key,value){values.set(key,value)}}};
  values.set(`admin-session:${await digest(token)}`,JSON.stringify({role,operatorId:'synthetic-engineer',territoryIds:['andover']}));
  values.set('booking:assigned',JSON.stringify({reference:'VIP-SYNTHETIC',operatorId:'synthetic-engineer',territoryId:'andover',status:'confirmed',bookingStatus:'confirmed',jobStatus:'in-progress',paymentStatus:'prepaid'}));
  const headers={'x-admin-session':token,'content-type':'application/json'},body={bookingKey:'booking:assigned',severity:'high',concernType:'Engineer safety',description:'Synthetic safety test.',currentlySafe:true,stopWork:true};
  const send=patch=>report({request:new Request('https://example.test/api/admin/incidents',{method:'POST',headers,body:JSON.stringify({...body,...patch})}),env});
  return{env,values,headers,send};
}

test('engineer safety report rejects another assignment or territory before any write',async()=>{
  for(const patch of [{operatorId:'someone-else'},{territoryId:'elsewhere'}]){
    const {values,send}=await setup();values.set('booking:assigned',JSON.stringify({...JSON.parse(values.get('booking:assigned')),...patch}));const before=[...values];
    assert.equal((await send()).status,404);assert.deepEqual([...values],before);
  }
});

test('missing and non-booking targets cannot create a linked safety report',async()=>{
  for(const bookingKey of ['booking:missing','customer:private','']){const {values,send}=await setup(),before=[...values];assert.equal((await send({bookingKey})).status,bookingKey.startsWith('booking:')?404:400);assert.deepEqual([...values],before);}
});

test('valid stop records authenticated reporter and prevents later job progression',async()=>{
  const {env,values,headers,send}=await setup(),response=await send({reporterId:'spoofed-person'});assert.equal(response.status,201);
  const {incident}=await response.json();assert.equal(incident.reporterId,'synthetic-engineer');assert.equal(incident.territoryId,'andover');
  const booking=JSON.parse(values.get('booking:assigned'));for(const field of ['status','bookingStatus','jobStatus'])assert.equal(booking[field],'safety-stopped');assert.equal(booking.paymentStatus,'review');
  const before=[...values],progress=await action({request:new Request('https://example.test/api/admin/job-actions',{method:'POST',headers,body:JSON.stringify({bookingKey:'booking:assigned',action:'completed'})}),env});assert.equal(progress.status,409);assert.deepEqual([...values],before);
});

test('engineer may report a general concern without modifying a booking',async()=>{
  const {values,send}=await setup(),before=values.get('booking:assigned'),response=await send({bookingKey:'',stopWork:false});assert.equal(response.status,201);assert.equal((await response.json()).incident.bookingKey,'');assert.equal(values.get('booking:assigned'),before);
});

test('ended work can be reported but cannot be changed into a safety stop',async()=>{
  for(const patch of [{status:'completed'},{bookingStatus:'cancelled'},{jobStatus:'unresolved'},{paymentStatus:'refunded'}]){
    const {values,send}=await setup();values.set('booking:assigned',JSON.stringify({...JSON.parse(values.get('booking:assigned')),...patch}));const before=[...values];assert.equal((await send()).status,409);assert.deepEqual([...values],before);assert.equal((await send({stopWork:false})).status,201);
  }
});

test('viewer cannot submit safety reports',async()=>{const {values,send}=await setup('viewer'),before=[...values];assert.equal((await send()).status,401);assert.deepEqual([...values],before);});

test('malformed safety submissions return validation errors',async()=>{
  for(const body of ['{','null','[]']){const {env,headers}=await setup();assert.equal((await report({request:new Request('https://example.test/api/admin/incidents',{method:'POST',headers,body}),env})).status,400);}
});

test('HQ may stop another engineer’s booking inside its authorised territory',async()=>{
  const {values,send}=await setup('admin');values.set('booking:assigned',JSON.stringify({...JSON.parse(values.get('booking:assigned')),operatorId:'another-engineer'}));assert.equal((await send()).status,201);
});
