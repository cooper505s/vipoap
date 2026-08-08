import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/bookings.js';

function nextMonday(){
  const date=new Date();
  date.setUTCDate(date.getUTCDate()+((8-date.getUTCDay())%7||7));
  return date.toISOString().slice(0,10);
}

function request(overrides={}){
  return new Request('https://example.test/api/bookings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({supportType:'Home visit',service:'General Technology Help',duration:60,date:nextMonday(),time:'19:00',name:'Test Customer',phone:'01234 567890',email:'test@example.com',address:'1 Test Street',postcode:'SP10 1AA',notificationChannel:'Email',details:'Wi-Fi help',...overrides})});
}

function environment(){
  const values=new Map();
  return {
    values,
    env:{
      RESEND_API_KEY:'test-key',
      BOOKING_FROM_EMAIL:'VIPOAP Bookings <bookings@example.test>',
      VIPOAP_DATA:{
        async get(key,type){const value=values.get(key);return type==='json'&&value?JSON.parse(value):value??null},
        async put(key,value){values.set(key,value)},
        async delete(key){values.delete(key)},
        async list({prefix}){return {keys:[...values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name}))}}
      }
    }
  };
}

test('fails safely when required bindings are missing',async()=>{
  const response=await onRequestPost({request:request(),env:{}});
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/temporarily unavailable/i);
});

test('rejects a time outside configured availability',async()=>{
  const {env}=environment();
  const response=await onRequestPost({request:request({time:'18:00'}),env});
  assert.equal(response.status,409);
});

test('stores an offered slot and sends the notification',async t=>{
  const {env,values}=environment();
  const emails=[];
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(_url,options)=>{emails.push(JSON.parse(options.body));return new Response(null,{status:202})};
  t.after(()=>{globalThis.fetch=originalFetch});

  const response=await onRequestPost({request:request({details:'Router <script>alert(1)</script> & setup'}),env});
  const result=await response.json();
  assert.equal(response.status,200);
  assert.match(result.reference,/^VIP-[A-F0-9]{8}$/);
  assert.ok(values.has(`booking:${nextMonday()}:19:00`));
  const stored=JSON.parse(values.get(`booking:${nextMonday()}:19:00`));
  assert.ok(stored.customerId.startsWith('customer:'));
  assert.equal(stored.territoryId,'andover');
  assert.equal(emails.length,2);
  assert.doesNotMatch(emails[0].html,/<script>/);
  assert.match(emails[0].html,/&amp;/);
  assert.match(emails[0].html,/£30/);
  assert.match(emails[1].html,/Service price:<\/strong> £30/);
});

test('prices and stores a 30-minute remote-support request',async t=>{
  const {env,values}=environment(),originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(null,{status:202});t.after(()=>{globalThis.fetch=originalFetch});
  const response=await onRequestPost({request:request({supportType:'Remote support',duration:30,address:''}),env});
  assert.equal(response.status,200);
  const stored=JSON.parse(values.get(`booking:${nextMonday()}:19:00`));
  assert.equal(stored.supportType,'Remote support');
  assert.equal(stored.price,'£15');
});

test('removes the reservation when email delivery fails',async t=>{
  const {env,values}=environment();
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(null,{status:500});
  t.after(()=>{globalThis.fetch=originalFetch});

  const response=await onRequestPost({request:request(),env});
  assert.equal(response.status,502);
  assert.equal(values.has(`booking:${nextMonday()}:19:00`),false);
});
