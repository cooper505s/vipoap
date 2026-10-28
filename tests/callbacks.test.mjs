import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {onRequestPost} from '../functions/api/callbacks.js';
import {onRequestGet,onRequestPatch} from '../functions/api/admin/callbacks.js';
import {onRequestGet as summary} from '../functions/api/admin/intake-summary.js';
import {retainIntake} from '../workers/intake-maintenance/src/index.js';
function setup(){const sql=new DatabaseSync(':memory:');for(const file of ['0009_engineer_applications.sql','0010_callback_requests.sql'])sql.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));const db={prepare(query){return{values:[],bind(...v){this.values=v;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return{results:sql.prepare(query).all(...this.values)};},async run(){const r=sql.prepare(query).run(...this.values);return{meta:{changes:Number(r.changes)}};}};},async batch(items){sql.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};return{sql,env:{VIPOAP_DB:db,ADMIN_PASSWORD:'test-only'}};}
const valid=()=>({requestId:crypto.randomUUID(),name:'Synthetic Callback',phone:'07700 900123',bestTime:'Morning, 8am to 12pm',message:'Synthetic printer question',website:''});
const request=body=>new Request('https://vipoap.test/api/callbacks',{method:'POST',headers:{'content-type':'application/json','origin':'https://vipoap.test','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(body)});
const admin=(method='GET',body,auth=true)=>new Request('https://vipoap.test/api/admin/callbacks',{method,headers:{'content-type':'application/json',...(auth?{'x-admin-password':'test-only'}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('callbacks save before receipt and retries do not duplicate or overwrite records',async()=>{
 const {sql,env}=setup(),body=valid();let response=await onRequestPost({request:request(body),env});assert.equal(response.status,201);const data=await response.json();assert.equal(data.reference,`CALL-${body.requestId}`);assert.equal(data.name,undefined);
 response=await onRequestPost({request:request(body),env});assert.equal(response.status,200);assert.equal(sql.prepare('SELECT count(*) n FROM callback_requests').get().n,1);
 response=await onRequestPost({request:request({...body,name:'Changed'}),env});assert.equal(response.status,409);assert.equal(sql.prepare('SELECT name FROM callback_requests').get().name,body.name);
 const row=sql.prepare('SELECT created_at,expires_at FROM callback_requests').get();assert.equal(Date.parse(row.expires_at)-Date.parse(row.created_at),365*86400000);
});
test('callback flow never sends an external email, even when provider keys exist',async t=>{
 const {env}=setup();env.RESEND_API_KEY='synthetic';env.BOOKING_FROM_EMAIL='test@example.test';env.APPLICATION_NOTIFICATIONS_ENABLED='true';let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('Should not send');});
 assert.equal((await onRequestPost({request:request(valid()),env})).status,201);assert.equal(calls,0);
});
test('callback server validates required fields, bounds data and rejects honeypots',async()=>{
 const {env,sql}=setup();for(const patch of [{name:''},{phone:'not a phone'},{bestTime:'Now!'},{message:'x'.repeat(2001)},{website:'spam'},{requestId:'bad'}])assert.equal((await onRequestPost({request:request({...valid(),...patch}),env})).status,400);
 assert.equal(sql.prepare('SELECT count(*) n FROM callback_requests').get().n,0);
 assert.equal((await onRequestPost({request:request({...valid(),message:''}),env})).status,201);
 assert.equal((await onRequestPost({request:request({...valid(),message:'x'.repeat(21000)}),env})).status,413);
});
test('callback storage/origin/rate failures never produce false receipts',async()=>{
 const {env}=setup();assert.equal((await onRequestPost({request:request(valid()),env:{}})).status,503);
 const cross=request(valid());cross.headers.set('origin','https://elsewhere.test');assert.equal((await onRequestPost({request:cross,env})).status,403);
 for(let i=0;i<6;i++)assert.equal((await onRequestPost({request:request(valid()),env})).status,201);
 assert.equal((await onRequestPost({request:request(valid()),env})).status,429);
});
test('callback HQ queue enforces access, search and optimistic status changes',async()=>{
 const {env,sql}=setup(),body=valid();await onRequestPost({request:request(body),env});assert.equal((await onRequestGet({request:admin('GET',null,false),env})).status,403);
 const list=await(await onRequestGet({request:admin(),env})).json(),row=list.callbacks[0];assert.equal(row.name,body.name);
 const filtered=new Request('https://vipoap.test/api/admin/callbacks?search=does-not-exist',{headers:{'x-admin-password':'test-only'}});assert.equal((await(await onRequestGet({request:filtered,env})).json()).callbacks.length,0);
 let response=await onRequestPatch({request:admin('PATCH',{id:row.id,status:'contacted',updatedAt:row.updated_at}),env});assert.equal(response.status,200);assert.equal(sql.prepare('SELECT count(*) n FROM callback_audit').get().n,1);
 response=await onRequestPatch({request:admin('PATCH',{id:row.id,status:'closed',updatedAt:row.updated_at}),env});assert.equal(response.status,409);
 sql.prepare("UPDATE callback_requests SET expires_at='2000-01-01'").run();assert.equal((await(await onRequestGet({request:admin(),env})).json()).callbacks.length,0);
});
test('central intake summary shows actionable counts rather than sample metrics',async()=>{
 const {env,sql}=setup();await onRequestPost({request:request(valid()),env});await onRequestPost({request:request(valid()),env});sql.prepare("UPDATE callback_requests SET status='closed' WHERE id=(SELECT id FROM callback_requests LIMIT 1)").run();
 assert.equal((await summary({request:admin('GET',null,false),env})).status,403);
 const data=await(await summary({request:admin(),env})).json();assert.equal(data.callbacks,1);assert.equal(data.applications,0);
});
test('scheduled intake retention deletes only expired records and records completion',async()=>{
 const {env,sql}=setup();await onRequestPost({request:request(valid()),env});await onRequestPost({request:request(valid()),env});
 const old=sql.prepare('SELECT id FROM callback_requests LIMIT 1').get().id;sql.prepare("UPDATE callback_requests SET expires_at='2000-01-01' WHERE id=?").run(old);sql.prepare('INSERT INTO callback_audit VALUES (?,?,?,?,?)').run(crypto.randomUUID(),old,'synthetic','status:closed','2000-01-01');
 await retainIntake(env,Date.now());assert.equal(sql.prepare('SELECT count(*) n FROM callback_requests').get().n,1);assert.equal(sql.prepare('SELECT count(*) n FROM callback_audit').get().n,0);assert.equal(sql.prepare('SELECT status FROM intake_maintenance').get().status,'ok');
});
