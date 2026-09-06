import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {digest} from '../functions/_shared/admin-auth.js';
import {onRequestGet,onRequestPost} from '../functions/api/admin/communications.js';
import {onRequestGet as timeline} from '../functions/api/admin/customer-timeline.js';

function setup(){
  const values=new Map();
  const kv={
    async get(key,type){const value=values.get(key);return type==='json'&&value?JSON.parse(value):value??null},
    async put(key,value){values.set(key,value)},
    async list({prefix}){return{keys:[...values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name}))}}
  };
  return{values,env:{ADMIN_PASSWORD:'secret',VIPOAP_DATA:kv,RESEND_API_KEY:'resend',BOOKING_FROM_EMAIL:'VIPOAP <help@example.test>'}};
}
async function operator(values,url,options={}){
  const token='partner-session';
  values.set(`admin-session:${await digest(token)}`,JSON.stringify({role:'operator',email:'alex@example.test',operatorId:'partner-one',territoryIds:['andover']}));
  return new Request(url,{...options,headers:{'content-type':'application/json','x-admin-session':token,...options.headers}});
}
const admin=(url,options={})=>new Request(url,{...options,headers:{'content-type':'application/json','x-admin-password':'secret',...options.headers}});

test('Engineer Partners cannot open the central customer communication history',async()=>{
  const{env,values}=setup();
  const customerId='customer:one';
  values.set(customerId,JSON.stringify({name:'Pat',email:'pat@example.test',territoryId:'andover',operatorId:'partner-one',preferredContact:'Email'}));
  values.set(`communication:${customerId}:one`,JSON.stringify({customerId,channel:'Phone',direction:'inbound',message:'Asked about an appointment.',createdAt:'2026-08-10T10:00:00Z'}));
  const request=await operator(values,`https://example.test/api/admin/communications?customerId=${customerId}`);
  const response=await onRequestGet({request,env});
  assert.equal(response.status,403);
});

test('HQ outbound email is marked sent only after provider acceptance',async t=>{
  const{env,values}=setup();
  const customerId='customer:one';
  values.set(customerId,JSON.stringify({name:'Pat',email:'pat@example.test',territoryId:'andover',operatorId:'partner-one'}));
  const original=globalThis.fetch,sent=[];
  globalThis.fetch=async(_url,options)=>{sent.push(JSON.parse(options.body));return Response.json({id:'email-one'})};
  t.after(()=>globalThis.fetch=original);
  const request=admin('https://example.test/api/admin/communications',{method:'POST',body:JSON.stringify({customerId,channel:'Email',direction:'outbound',subject:'Appointment update',message:'Your appointment details have been updated.'})});
  const response=await onRequestPost({request,env});
  const data=await response.json();
  const record=JSON.parse(values.get(data.key));
  assert.equal(response.status,200);
  assert.equal(record.deliveryStatus,'sent');
  assert.equal(record.providerMessageId,'email-one');
  assert.equal(data.providerId,'email-one');
  assert.equal(sent[0].to[0],'pat@example.test');
});

test('unconnected HQ SMS is honestly queued for manual action and appears in the household timeline',async()=>{
  const{env,values}=setup();
  const customerId='customer:one';
  values.set(customerId,JSON.stringify({name:'Pat',phone:'07123456789',territoryId:'andover',operatorId:'partner-one'}));
  let request=admin('https://example.test/api/admin/communications',{method:'POST',body:JSON.stringify({customerId,channel:'SMS',direction:'outbound',subject:'Reminder',message:'A short appointment reminder.'})});
  let response=await onRequestPost({request,env});
  let data=await response.json();
  assert.equal(data.deliveryStatus,'manual-action-required');
  request=admin(`https://example.test/api/admin/customer-timeline?customerId=${customerId}`);
  data=await(await timeline({request,env})).json();
  assert.equal(data.counts.communication,1);
  assert.equal(data.timeline[0].visibility,'internal');
});

test('customer overview includes the controlled communication workspace',()=>{
  const page=fs.readFileSync('admin/customers.html','utf8');
  const ui=fs.readFileSync('admin/customer-communications.js','utf8');
  const worker=fs.readFileSync('admin/service-worker.js','utf8');
  assert.match(page,/customer-communications\.js/);
  assert.match(ui,/Preferred contact/);
  assert.match(ui,/data-whatsapp-option disabled/);
  assert.match(ui,/SMS\/WhatsApp delivery is not connected yet/);
  assert.match(worker,/customer-communications\.js/);
});
