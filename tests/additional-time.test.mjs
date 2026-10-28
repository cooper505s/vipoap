import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as jobAction} from '../functions/api/admin/job-actions.js';
import {onRequestGet as getApproval,onRequestPost as answerApproval} from '../functions/api/additional-time-approval.js';

function setup(){const values=new Map();return{values,env:{ADMIN_PASSWORD:'secret',RESEND_API_KEY:'resend',BOOKING_FROM_EMAIL:'VIPOAP <bookings@example.test>',VIPOAP_DATA:{async get(key,type){const value=values.get(key);return type==='json'&&value?JSON.parse(value):value??null},async put(key,value){values.set(key,value)},async list({prefix}){return{keys:[...values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name}))}}}}}}
const adminRequest=body=>new Request('https://example.test/api/admin/job-actions',{method:'POST',headers:{'content-type':'application/json','x-admin-password':'secret'},body:JSON.stringify(body)});

test('additional time requires the customer response and is billed afterwards',async t=>{const{env,values}=setup();values.set('booking:one',JSON.stringify({reference:'VIP-ONE',name:'Margaret',email:'margaret@example.test',notificationChannel:'Email',jobStatus:'in-progress',paymentStatus:'prepaid',paymentMethod:'online'}));let email,original=globalThis.fetch;globalThis.fetch=async(_url,options)=>{email=JSON.parse(options.body);return new Response('{}',{status:200})};t.after(()=>globalThis.fetch=original);let response=await jobAction({request:adminRequest({bookingKey:'booking:one',action:'request-additional-time',blocks:1}),env}),requested=await response.json();assert.equal(response.status,200);assert.equal(requested.status,'awaiting-customer');assert.equal(requested.charge,30);assert.match(email.html,/billed after the appointment/i);const token=new URL(requested.approvalUrl).searchParams.get('token');response=await getApproval({request:new Request(`https://example.test/api/additional-time-approval?token=${token}`),env});assert.equal((await response.json()).minutes,30);response=await answerApproval({request:new Request('https://example.test/api/additional-time-approval',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,decision:'approve'})}),env});assert.equal(response.status,200);const booking=JSON.parse(values.get('booking:one'));assert.equal(booking.additionalAmount,30);assert.equal(booking.providerAdditionalEntitlementPence,2000);assert.equal(booking.paymentStatus,'additional-payment-due');assert.equal(booking.additionalTime[0].approvalMethod,'customer-link')});

test('remote additional time charges £20 and pays the engineer 70 percent',async t=>{const{env,values}=setup();values.set('booking:remote',JSON.stringify({reference:'VIP-REMOTE',name:'Jean',email:'jean@example.test',notificationChannel:'Email',supportType:'Remote support',jobStatus:'in-progress',paymentStatus:'prepaid',paymentMethod:'online'}));const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:200});t.after(()=>globalThis.fetch=original);let response=await jobAction({request:adminRequest({bookingKey:'booking:remote',action:'request-additional-time',blocks:1}),env}),requested=await response.json();assert.equal(requested.charge,20);const token=new URL(requested.approvalUrl).searchParams.get('token');response=await answerApproval({request:new Request('https://example.test/api/additional-time-approval',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,decision:'approve'})}),env});assert.equal(response.status,200);const booking=JSON.parse(values.get('booking:remote'));assert.equal(booking.additionalAmount,20);assert.equal(booking.providerAdditionalEntitlementPence,1400)});

const approvalRequest=(token,decision='approve')=>new Request('https://example.test/api/additional-time-approval',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,decision})});
function approvalFixture(extra={}){
  const {env,values}=setup(),token='synthetic_current_approval',key=`additional-time-approval:${token}`;
  values.set(key,JSON.stringify({bookingKey:'booking:one',reference:'VIP-SYNTHETIC',blocks:1,minutes:30,charge:30,status:'pending',expiresAt:new Date(Date.now()+3600000).toISOString()}));
  values.set('booking:one',JSON.stringify({reference:'VIP-SYNTHETIC',jobStatus:'in-progress',status:'confirmed',bookingStatus:'confirmed',paymentStatus:'prepaid',pendingAdditionalTimeApproval:key,...extra}));
  return{env,values,token,key};
}

test('finished, cancelled and refunded work rejects old additional-time links without writes',async()=>{
  for(const extra of [{jobStatus:'completed'},{status:'cancelled'},{bookingStatus:'completed'},{bookingStatus:'awaiting-final-settlement'},{paymentStatus:'refunded'},{paymentStatus:'refund-pending'}]){
    const {env,values,token}=approvalFixture(extra),before=[...values];
    assert.equal((await getApproval({request:new Request(`https://example.test/api/additional-time-approval?token=${token}`),env})).status,404);
    assert.equal((await answerApproval({request:approvalRequest(token),env})).status,409);assert.deepEqual([...values],before);
  }
});

test('superseded approvals cannot add charges or clear the current request',async()=>{
  for(const decision of ['approve','decline']){
    const {env,values,token}=approvalFixture({pendingAdditionalTimeApproval:'additional-time-approval:newer'}),before=[...values];
    assert.equal((await answerApproval({request:approvalRequest(token,decision),env})).status,409);assert.deepEqual([...values],before);
  }
});

test('answered and expired approval links cannot add another charge',async()=>{
  const {env,values,token,key}=approvalFixture();
  assert.equal((await answerApproval({request:approvalRequest(token),env})).status,200);
  const before=[...values];assert.equal((await answerApproval({request:approvalRequest(token),env})).status,400);assert.deepEqual([...values],before);
  for(const expiresAt of ['invalid',new Date(Date.now()-1000).toISOString()]){
    values.set(key,JSON.stringify({...JSON.parse(values.get(key)),status:'pending',expiresAt}));const expiredBefore=[...values];
    assert.equal((await answerApproval({request:approvalRequest(token),env})).status,400);assert.deepEqual([...values],expiredBefore);
  }
});

test('current decline clears only its own request without charging',async()=>{
  const {env,values,token,key}=approvalFixture();assert.equal((await answerApproval({request:approvalRequest(token,'decline'),env})).status,200);
  const booking=JSON.parse(values.get('booking:one'));assert.equal(booking.pendingAdditionalTimeApproval,'');assert.equal(booking.additionalAmount,undefined);assert.equal(booking.paymentStatus,'prepaid');assert.equal(JSON.parse(values.get(key)).status,'declined');
});

test('engineer cannot request or directly approve extra time on inconsistent closed work',async()=>{
  for(const extra of [{status:'cancelled'},{bookingStatus:'completed'},{paymentStatus:'refunded'}])for(const action of ['request-additional-time','approve-additional-time']){
    const {env,values}=approvalFixture(extra),before=[...values];const response=await jobAction({request:adminRequest({bookingKey:'booking:one',action,blocks:1,approvalMethod:'verbal'}),env});assert.equal(response.status,409);assert.deepEqual([...values],before);
  }
});

test('malformed approval responses return a validation error',async()=>{
  for(const body of ['{','null','[]']){const {env}=setup(),response=await answerApproval({request:new Request('https://example.test/api/additional-time-approval',{method:'POST',headers:{'content-type':'application/json'},body}),env});assert.equal(response.status,400);}
});
