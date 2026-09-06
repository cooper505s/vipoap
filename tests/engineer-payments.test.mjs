import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digest} from '../functions/_shared/admin-auth.js';
import {onRequestGet,onRequestPatch} from '../functions/api/admin/my-payments.js';

function setup(){
  const values=new Map(),env={ADMIN_PASSWORD:'secret',DEFAULT_OPERATOR_ID:'owner',VIPOAP_DATA:{
    async get(key,type){const value=values.get(key);return type==='json'&&value?JSON.parse(value):value??null},async put(key,value){values.set(key,value)},async list({prefix}){return{keys:[...values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name}))}}
  }};return{values,env};
}

test('Engineer Partners see only their own completed work and payout totals',async()=>{
  const{values,env}=setup(),token='partner-session';
  values.set(`admin-session:${await digest(token)}`,JSON.stringify({role:'operator',operatorId:'alex',territoryIds:['andover']}));
  values.set('booking:alex-paid',JSON.stringify({reference:'VIP-PAID',operatorId:'alex',territoryId:'andover',status:'completed',completedAt:'2026-08-20T10:00:00Z',service:'Wi-Fi',supportType:'Home visit',duration:60,providerEntitlementPence:4500,providerAdditionalEntitlementPence:2000,providerPaymentStatus:'paid',providerPaidAt:'2026-08-25T10:00:00Z'}));
  values.set('booking:alex-waiting',JSON.stringify({reference:'VIP-WAITING',operatorId:'alex',territoryId:'andover',jobStatus:'completed',completedAt:'2026-08-22T10:00:00Z',service:'Printer',supportType:'Remote support',duration:30,providerEntitlementPence:1250}));
  values.set('booking:other',JSON.stringify({reference:'VIP-OTHER',operatorId:'sam',territoryId:'andover',status:'completed',completedAt:'2026-08-21T10:00:00Z',providerEntitlementPence:9999}));
  const response=await onRequestGet({request:new Request('https://example.test/api/admin/my-payments?operatorId=sam',{headers:{'x-admin-session':token}}),env}),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.operatorId,'alex');assert.deepEqual(data.payments.map(item=>item.reference),['VIP-WAITING','VIP-PAID']);assert.equal(data.summary.paidPence,6500);assert.equal(data.summary.awaitingPence,1750);assert.equal(data.canManage,false);
  const denied=await onRequestPatch({request:new Request('https://example.test/api/admin/my-payments',{method:'PATCH',headers:{'content-type':'application/json','x-admin-session':token},body:JSON.stringify({key:'booking:alex-waiting',status:'paid'})}),env});assert.equal(denied.status,403);
});

test('HQ can record an engineer payout with a payment reference',async()=>{
  const{values,env}=setup();values.set('booking:alex',JSON.stringify({reference:'VIP-ALEX',operatorId:'alex',territoryId:'andover',status:'completed',completedAt:'2026-08-20T10:00:00Z',providerEntitlementPence:4500}));
  const response=await onRequestPatch({request:new Request('https://example.test/api/admin/my-payments',{method:'PATCH',headers:{'content-type':'application/json','x-admin-password':'secret'},body:JSON.stringify({key:'booking:alex',status:'paid',paymentReference:'BANK-123'})}),env}),record=JSON.parse(values.get('booking:alex'));
  assert.equal(response.status,200);assert.equal(record.providerPaymentStatus,'paid');assert.equal(record.providerPaymentReference,'BANK-123');assert.ok(record.providerPaidAt);
  const listed=await(await onRequestGet({request:new Request('https://example.test/api/admin/my-payments?operatorId=alex',{headers:{'x-admin-password':'secret'}}),env})).json();assert.equal(listed.payments[0].status,'paid');assert.equal(listed.canManage,true);
});

test('the private portal exposes payment history and a CSV tax record',async()=>{
  const html=await readFile(new URL('../admin/my-payments.html',import.meta.url),'utf8'),script=await readFile(new URL('../admin/my-payments.js',import.meta.url),'utf8'),nav=await readFile(new URL('../admin/mobile-nav.js',import.meta.url),'utf8');
  assert.match(html,/Payment history/i);assert.match(html,/tax return/i);assert.match(html,/£17\.50 for the first 30 minutes/i);assert.match(html,/£14 for each additional 30 minutes/i);assert.match(html,/70%/);assert.match(script,/text\/csv/);assert.match(script,/Mark paid/);assert.match(nav,/My payments/);
});
