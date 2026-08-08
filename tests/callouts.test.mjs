import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost,onRequestPatch} from '../functions/api/admin/callouts.js';

function environment(){
  const values=new Map();
  return {values,env:{ADMIN_PASSWORD:'secret',VIPOAP_DATA:{async get(key,type){const value=values.get(key);return type==='json'&&value?JSON.parse(value):value??null},async put(key,value){values.set(key,value)},async list({prefix}){return {keys:[...values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name}))}}}}};
}
function request(method,body,password='secret'){return new Request('https://example.test/api/admin/callouts',{method,headers:{'x-admin-password':password,'content-type':'application/json'},body:body?JSON.stringify(body):undefined})}
const valid={date:'2026-08-08',customerName:'Margaret Test',phone:'01234 567890',postcode:'SP10 1AA',category:'Wi-Fi',duration:60,amountCharged:65,paymentStatus:'paid',summary:'Restored Wi-Fi coverage.',actionsTaken:'Moved mesh unit and reconnected tablet.',recommendations:'Review placement if furniture moves.',followUpRequired:false,followUpDate:'',followUpNotes:'',status:'completed',linkedBookingKey:'booking:2026-08-08:11:00'};

test('rejects unauthorised call-out access',async()=>{const {env}=environment();const response=await onRequestGet({request:request('GET',null,'wrong'),env});assert.equal(response.status,401)});
test('creates and lists a call-out',async()=>{const {env}=environment();const created=await onRequestPost({request:request('POST',valid),env});assert.equal(created.status,200);const result=await created.json();assert.match(result.reference,/^CO-[A-F0-9]{8}$/);const listed=await onRequestGet({request:request('GET'),env});const data=await listed.json();assert.equal(data.callouts.length,1);assert.equal(data.callouts[0].amountCharged,65)});
test('rejects incomplete call-out details',async()=>{const {env}=environment();const response=await onRequestPost({request:request('POST',{...valid,summary:''}),env});assert.equal(response.status,400)});
test('rejects an impossible calendar date',async()=>{const {env}=environment();const response=await onRequestPost({request:request('POST',{...valid,date:'2026-02-31'}),env});assert.equal(response.status,400)});
test('updates an existing call-out',async()=>{const {env}=environment();const created=await (await onRequestPost({request:request('POST',valid),env})).json();const response=await onRequestPatch({request:request('PATCH',{...valid,key:created.key,status:'follow-up',followUpRequired:true,followUpDate:'2026-08-15'}),env});assert.equal(response.status,200);const updated=await env.VIPOAP_DATA.get(created.key,'json');assert.equal(updated.status,'follow-up');assert.equal(updated.followUpRequired,true)});
