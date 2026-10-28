import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequestPost} from '../functions/api/engineer-applications.js';
import {onRequestGet,onRequestPatch} from '../functions/api/admin/applications.js';
import {notifyApplication} from '../functions/_shared/applications.js';

function setup() {
  const sql=new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(new URL('../migrations/0009_engineer_applications.sql',import.meta.url),'utf8'));
  const db={prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){const result=sql.prepare(query).run(...this.values);return {meta:{changes:Number(result.changes)}};}};},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
  return {sql,env:{VIPOAP_DB:db,ADMIN_PASSWORD:'test-only'},jobs:[],waitUntil(job){this.jobs.push(job);}};
}
const valid=()=>({requestId:crypto.randomUUID(),name:'Test Applicant',email:'applicant@example.test',phone:'07700 900123',area:'SP10',experience:'2–5 years',availability:'Weekends',skills:'Home Wi-Fi and device support',motivation:'Patient practical help',website:''});
const post=body=>new Request('https://vipoap.test/api/engineer-applications',{method:'POST',headers:{'content-type':'application/json','origin':'https://vipoap.test','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(body)});
const admin=(method='GET',body,auth=true)=>new Request('https://vipoap.test/api/admin/applications',{method,headers:{'content-type':'application/json',...(auth?{'x-admin-password':'test-only'}:{})},...(body?{body:JSON.stringify(body)}:{})});
const submit=(state,body)=>onRequestPost({request:post(body),env:state.env,waitUntil:job=>state.jobs.push(job)});

test('application receipt corresponds to a durable row and retries reuse it',async()=>{
  const state=setup(),body=valid();let response=await submit(state,body);
  assert.equal(response.status,201);const receipt=await response.json();assert.equal(receipt.reference,`APP-${body.requestId}`);
  response=await submit(state,body);assert.equal(response.status,200);assert.equal((await response.json()).reference,receipt.reference);
  assert.equal(state.sql.prepare('SELECT count(*) n FROM engineer_applications').get().n,1);
  assert.equal(state.sql.prepare('SELECT status FROM engineer_applications').get().status,'received');
  assert.equal(response.headers.get('cache-control'),'no-store');
});

test('changed details cannot overwrite an existing receipt',async()=>{
  const state=setup(),body=valid();await submit(state,body);
  const response=await submit(state,{...body,name:'Changed'});assert.equal(response.status,409);
  assert.equal(state.sql.prepare('SELECT name FROM engineer_applications').get().name,body.name);
});

test('concurrent duplicate requests create one record with matching receipts',async()=>{
  const state=setup(),body=valid();const responses=await Promise.all([submit(state,body),submit(state,body)]);
  for(const response of responses){assert.ok(response.ok);assert.equal((await response.json()).reference,`APP-${body.requestId}`);}
  assert.equal(state.sql.prepare('SELECT count(*) n FROM engineer_applications').get().n,1);
});

test('validates all fields on server and never saves malformed applications',async()=>{
  const state=setup();
  for(const changed of [{email:'bad'},{name:''},{phone:'a number'},{area:'x'.repeat(101)},{skills:'x'.repeat(3001)},{experience:'expert'},{availability:'anything'},{website:'spam'},{motivation:null},{requestId:'not-an-id'}]) {
    assert.equal((await submit(state,{...valid(),...changed})).status,400,JSON.stringify(changed).slice(0,80));
  }
  assert.equal(state.sql.prepare('SELECT count(*) n FROM engineer_applications').get().n,0);
});

test('rejects cross-origin, malformed, oversized and unsupported requests',async()=>{
  const state=setup(),request=post(valid());
  request.headers.set('origin','https://elsewhere.test');assert.equal((await onRequestPost({request,env:state.env})).status,403);
  assert.equal((await onRequestPost({request:new Request('https://vipoap.test/api/engineer-applications',{method:'POST',headers:{'content-type':'application/json'},body:'{'}),env:state.env})).status,400);
  const huge=post({...valid(),skills:'x'.repeat(21000)});huge.headers.delete('content-length');assert.equal((await onRequestPost({request:huge,env:state.env})).status,413);
  const unsupported=post(valid());unsupported.headers.set('content-type','text/plain');assert.equal((await onRequestPost({request:unsupported,env:state.env})).status,415);
});

test('missing or failed database never claims receipt',async()=>{
  assert.equal((await onRequestPost({request:post(valid()),env:{}})).status,503);
  const state=setup();state.env.VIPOAP_DB.prepare=()=>{throw Error('private database detail');};
  const response=await submit(state,valid());assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private database/);
});

test('atomic rate counter bounds new submissions while allowing receipt retry',async()=>{
  const state=setup(),body=valid();await submit(state,body);
  for(let i=0;i<5;i++)assert.equal((await submit(state,valid())).status,201);
  const response=await submit(state,valid());assert.equal(response.status,429);assert.ok(Number(response.headers.get('retry-after'))>0);
  assert.equal((await submit(state,body)).status,200);
});

test('email failure preserves the saved application and HQ retry can deliver it',async t=>{
  const state=setup(),body=valid();state.env.APPLICATION_NOTIFICATIONS_ENABLED='true';state.env.RESEND_API_KEY='test-only';state.env.BOOKING_FROM_EMAIL='test@example.test';
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:500}));
  const response=await submit(state,body);assert.equal(response.status,201);await Promise.all(state.jobs);
  assert.equal(state.sql.prepare('SELECT notification_status FROM engineer_applications').get().notification_status,'failed');
  let sent=0;t.mock.method(globalThis,'fetch',async(url,options)=>{sent++;assert.equal(options.headers['idempotency-key'],`engineer-application-${body.requestId}`);return new Response('{}',{status:200});});
  await notifyApplication(state.env,body.requestId);await notifyApplication(state.env,body.requestId);
  assert.equal(sent,1);assert.equal(state.sql.prepare('SELECT notification_status FROM engineer_applications').get().notification_status,'sent');
});

test('HQ access is server enforced and updates cannot activate engineers',async()=>{
  const state=setup(),body=valid();await submit(state,body);
  assert.equal((await onRequestGet({request:admin('GET',null,false),env:state.env})).status,403);
  let response=await onRequestGet({request:admin(),env:state.env});const saved=(await response.json()).applications[0];assert.equal(saved.name,body.name);
  response=await onRequestPatch({request:admin('PATCH',{id:body.requestId,status:'approved',updatedAt:saved.updated_at}),env:state.env});assert.equal(response.status,409);
  response=await onRequestPatch({request:admin('PATCH',{id:body.requestId,status:'reviewing',updatedAt:saved.updated_at}),env:state.env});assert.equal(response.status,200);
  assert.equal(state.sql.prepare('SELECT status FROM engineer_applications').get().status,'reviewing');
  assert.equal(state.sql.prepare('SELECT count(*) n FROM application_audit').get().n,1);
  response=await onRequestPatch({request:admin('PATCH',{id:body.requestId,status:'closed',updatedAt:saved.updated_at}),env:state.env});assert.equal(response.status,409);
});

test('regional and engineer roles cannot view central recruitment records',async()=>{
  const state=setup();state.env.ADMIN_PASSWORD='';
  const {digest}=await import('../functions/_shared/admin-auth.js');const token='synthetic-session';const key=`admin-session:${await digest(token)}`;
  for(const session of [{role:'operator',territoryIds:['andover']},{role:'admin',territoryIds:['andover']}]) {
    state.env.VIPOAP_DATA={get:async storedKey=>storedKey===key?session:null};
    const request=new Request('https://vipoap.test/api/admin/applications',{headers:{'x-admin-session':token}});
    assert.equal((await onRequestGet({request,env:state.env})).status,403);
  }
});

test('HQ queue pagination does not drop records sharing a timestamp',async()=>{
  const state=setup(),body=valid(),now=new Date().toISOString();
  const query=state.sql.prepare(`INSERT INTO engineer_applications (id,payload_hash,name,email,phone,area,experience,availability,skills,motivation,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for(let i=0;i<53;i++)query.run(crypto.randomUUID(),'hash',body.name,body.email,body.phone,body.area,body.experience,body.availability,body.skills,body.motivation,now,now,'2099-01-01T00:00:00.000Z');
  const first=await(await onRequestGet({request:admin(),env:state.env})).json();assert.equal(first.applications.length,50);assert.ok(first.nextCursor);
  const request=new Request(`https://vipoap.test/api/admin/applications?cursor=${encodeURIComponent(first.nextCursor)}`,{headers:{'x-admin-password':'test-only'}});
  const second=await(await onRequestGet({request,env:state.env})).json();assert.equal(second.applications.length,3);assert.equal(new Set([...first.applications,...second.applications].map(x=>x.id)).size,53);
});
