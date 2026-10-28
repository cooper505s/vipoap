import test from 'node:test';
import assert from 'node:assert/strict';
import {executeBookingCommand} from '../functions/_shared/booking-commands.js';
import {commitBookingChange} from '../functions/_shared/booking-transactions.js';
import {digest} from '../functions/_shared/admin-auth.js';
import {bookingDatabase} from './helpers/booking-database.mjs';

async function setup(){
  const {db,sql}=bookingDatabase(),sessions=new Map(),token='synthetic-command-session',bookingId='booking:synthetic-command';
  const adminKey=`admin-session:${await digest(token)}`,customerKey=`customer-session:${await digest(token)}`;
  sessions.set(adminKey,{role:'operator',operatorId:'engineer-one',email:'synthetic@example.test',territoryIds:['andover']});
  sessions.set(customerKey,{customerId:'customer:one',expiresAt:new Date(Date.now()+3600000).toISOString()});
  const snapshot={customerId:'customer:one',territoryId:'andover',operatorId:'engineer-one',reference:'VIP-SYNTHETIC',status:'confirmed',bookingStatus:'confirmed',jobStatus:'pending',paymentStatus:'prepaid',price:'£79',adminNotes:''};
  sql.prepare('INSERT INTO booking_transactions VALUES (?,?,1,?,?)').run(bookingId,JSON.stringify(snapshot),'fixture','2026-10-28');
  sql.prepare('INSERT INTO booking_slot_reservations VALUES (?,?,1000,2000)').run(bookingId,'engineer-one');
  const env={VIPOAP_BOOKING_DB:db,VIPOAP_DATA:{async get(key){return sessions.get(key)||null}}},request=new Request('https://example.test',{headers:{'x-admin-session':token,'x-customer-session':token}});
  const command=(patch={})=>executeBookingCommand({request,env,bookingId,expectedRevision:1,requestId:crypto.randomUUID(),kind:'set-admin-note',payload:{note:'Synthetic note'},now:'2026-10-28T17:00:00Z',...patch});
  const saved=()=>sql.prepare('SELECT * FROM booking_transactions WHERE id=?').get(bookingId),record=()=>JSON.parse(saved().snapshot_json),count=table=>sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  return{db,sql,sessions,adminKey,customerKey,snapshot,bookingId,env,request,command,saved,record,count};
}

test('authenticated note command preserves identity, price and reservation',async()=>{
  const s=await setup(),response=await s.command();assert.equal(response.revision,2);assert.equal(response.reused,false);
  for(const field of ['customerId','territoryId','operatorId','reference','price','paymentStatus','status'])assert.equal(s.record()[field],s.snapshot[field]);
  assert.equal(s.record().adminNotes,'Synthetic note');assert.equal(s.count('booking_slot_reservations'),1);assert.equal(s.count('booking_outbox'),1);
  const receipt=JSON.parse(s.sql.prepare('SELECT command_json FROM booking_mutations').get().command_json);assert.equal(receipt.kind,'set-admin-note');assert.match(receipt.actor,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(receipt),/synthetic@example|Synthetic note/);
});

test('command replay returns its original revision after later changes',async()=>{
  const s=await setup(),requestId=crypto.randomUUID();await s.command({requestId});await s.command({expectedRevision:2,payload:{note:'Later note'}});
  const before=s.saved().snapshot_json,replay=await s.command({requestId,now:'2026-10-28T18:00:00Z'});assert.deepEqual(replay,{bookingId:s.bookingId,revision:2,reused:true});assert.equal(s.saved().revision,3);assert.equal(s.saved().snapshot_json,before);assert.equal(s.count('booking_mutations'),2);
});

test('concurrent identical commands with different server timestamps commit once',async()=>{
  const s=await setup(),requestId=crypto.randomUUID(),results=await Promise.all([s.command({requestId,now:'2026-10-28T17:00:00Z'}),s.command({requestId,now:'2026-10-28T17:00:01Z'})]);assert.equal(results.filter(item=>item.reused).length,1);assert.equal(s.saved().revision,2);assert.equal(s.count('booking_mutations'),1);assert.equal(s.count('booking_outbox'),1);
});

test('same request cannot be reused for changed payload or a different actor',async()=>{
  const s=await setup(),requestId=crypto.randomUUID();await s.command({requestId});const before=s.saved().snapshot_json;
  await assert.rejects(s.command({requestId,payload:{note:'Different'}}),{status:409});
  s.sessions.set(s.adminKey,{...s.sessions.get(s.adminKey),email:'another@example.test'});await assert.rejects(s.command({requestId}),{status:409});assert.equal(s.saved().snapshot_json,before);assert.equal(s.count('booking_mutations'),1);
});

test('stale revisions and unauthorised note commands make no mutation',async()=>{
  const s=await setup();await s.command();const before=s.saved().snapshot_json;await assert.rejects(s.command(),{status:409});
  for(const patch of [{operatorId:'another'},{territoryIds:['elsewhere']},{role:'viewer'}]){s.sessions.set(s.adminKey,{role:'operator',operatorId:'engineer-one',territoryIds:['andover'],...patch});await assert.rejects(s.command({expectedRevision:2}),{status:patch.role?403:404});}
  assert.equal(s.saved().snapshot_json,before);assert.equal(s.count('booking_mutations'),1);
});

test('commands reject unexpected identity fields and invalid inputs',async()=>{
  const s=await setup();for(const patch of [{payload:{note:'x',customerId:'customer:other'}},{payload:{note:42}},{payload:{note:'x'.repeat(1501)}},{requestId:'invalid'},{expectedRevision:0},{kind:'set-price'},{now:'invalid'}])await assert.rejects(s.command(patch),{status:400});assert.equal(s.saved().revision,1);assert.equal(s.count('booking_mutations'),0);
});

test('customer cancellation request records intent without cancelling or repricing work',async()=>{
  const s=await setup(),response=await s.command({kind:'customer-appointment-request',payload:{requestType:'cancel',details:'Synthetic change request'}});assert.equal(response.revision,2);assert.equal(s.record().customerRequestStatus,'received');assert.equal(s.record().customerRequestType,'cancel');assert.equal(s.record().status,'confirmed');assert.equal(s.record().price,'£79');assert.equal(s.count('booking_slot_reservations'),1);
  const event=s.sql.prepare('SELECT kind,payload_json FROM booking_outbox').get();assert.equal(event.kind,'customer-appointment-requested');assert.doesNotMatch(event.payload_json,/Synthetic change request|customer:one/);
});

test('concurrent duplicate appointment requests reuse the same receipt',async()=>{
  const s=await setup(),requestId=crypto.randomUUID(),input={requestId,kind:'customer-appointment-request',payload:{requestType:'change',details:'Tuesday afternoon'}};
  const results=await Promise.all([s.command(input),s.command({...input,now:'2026-10-28T17:01:00Z'})]);assert.equal(results.filter(item=>item.reused).length,1);assert.equal(s.count('booking_mutations'),1);assert.equal(s.count('booking_outbox'),1);
  assert.equal((await s.command(input)).revision,2);await assert.rejects(s.command({...input,requestId:crypto.randomUUID(),expectedRevision:2}),{status:409});assert.equal(s.count('booking_mutations'),1);
});

test('closed, active or refunded work rejects a new customer request',async()=>{
  for(const patch of [{status:'completed'},{bookingStatus:'cancelled'},{jobStatus:'in-progress'},{status:'safety-stopped'},{bookingStatus:'awaiting-final-settlement'},{paymentStatus:'refunded'}]){
    const s=await setup();s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify({...s.snapshot,...patch}),s.bookingId);await assert.rejects(s.command({kind:'customer-appointment-request',payload:{requestType:'cancel'}}),{status:409});assert.equal(s.saved().revision,1);assert.equal(s.count('booking_mutations'),0);
  }
});

test('customer ownership and session validation precede request mutation',async()=>{
  const s=await setup();s.sessions.set(s.customerKey,{customerId:'customer:someone-else',expiresAt:new Date(Date.now()+3600000).toISOString()});await assert.rejects(s.command({kind:'customer-appointment-request',payload:{requestType:'cancel'}}),{status:404});s.sessions.set(s.customerKey,{customerId:'customer:one',expiresAt:'invalid'});await assert.rejects(s.command({kind:'customer-appointment-request',payload:{requestType:'cancel'}}),{status:401});assert.equal(s.count('booking_mutations'),0);
});

test('outbox failure rolls back snapshot and command identity together',async()=>{
  const s=await setup();s.sql.exec("CREATE TRIGGER reject_synthetic_command BEFORE INSERT ON booking_outbox BEGIN SELECT RAISE(ABORT,'synthetic-outbox-failure'); END;");const before=s.saved().snapshot_json;await assert.rejects(s.command(),/synthetic-outbox-failure/);assert.equal(s.saved().snapshot_json,before);assert.equal(s.saved().revision,1);assert.equal(s.count('booking_mutations'),0);assert.equal(s.count('booking_outbox'),0);
});

test('invalid or legacy primitive receipts cannot be impersonated as commands',async()=>{
  const s=await setup(),requestId=crypto.randomUUID();await commitBookingChange(s.db,{bookingId:s.bookingId,expectedRevision:1,requestId,snapshot:s.snapshot,events:[]});await assert.rejects(s.command({requestId}),{status:409});
  for(const commandMetadata of [null,{version:1,actor:['0'.repeat(64)],kind:'note',inputHash:'0'.repeat(64)},{version:1,actor:'bad',kind:'note',inputHash:'0'.repeat(64)},{version:1,actor:'0'.repeat(64),kind:'note',inputHash:'0'.repeat(64),secret:'must-not-store'}])await assert.rejects(commitBookingChange(s.db,{bookingId:s.bookingId,expectedRevision:2,requestId:crypto.randomUUID(),snapshot:s.snapshot,commandMetadata}),{status:400});assert.equal(s.count('booking_mutations'),1);
});


test('different commands racing on one revision have a single committed winner',async()=>{
  const s=await setup(),results=await Promise.allSettled([s.command({payload:{note:'First'}}),s.command({payload:{note:'Second'}})]);assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(results.find(item=>item.status==='rejected').reason.status,409);assert.equal(s.saved().revision,2);assert.equal(s.count('booking_mutations'),1);assert.equal(s.count('booking_outbox'),1);
});

test('command path requires its migration while legacy commits still work without it',async()=>{
  const s=await setup();s.sql.exec('ALTER TABLE booking_mutations DROP COLUMN command_json');
  await commitBookingChange(s.db,{bookingId:s.bookingId,expectedRevision:1,requestId:crypto.randomUUID(),snapshot:s.snapshot,events:[]});const before=s.saved().snapshot_json;
  await assert.rejects(s.command({expectedRevision:2}),{status:503});assert.equal(s.saved().snapshot_json,before);assert.equal(s.saved().revision,2);assert.equal(s.count('booking_mutations'),1);
});


test('assigned engineer progresses in order while preserving booking identity and charges',async()=>{
  const s=await setup();let revision=1;
  for(const [action,field] of [['accepted','acceptedAt'],['en-route','enRouteAt'],['arrived','arrivedAt'],['in-progress','startedAt']]){
    const result=await s.command({kind:'engineer-job-transition',expectedRevision:revision,payload:{action}});assert.equal(result.revision,++revision);assert.equal(s.record().jobStatus,action);assert.equal(s.record()[field],'2026-10-28T17:00:00.000Z');
    for(const key of ['customerId','operatorId','territoryId','reference','price','paymentStatus','bookingStatus','status'])assert.equal(s.record()[key],s.snapshot[key]);
    assert.equal(s.record().assignedEngineerId,'engineer-one');assert.equal(s.count('booking_slot_reservations'),1);
  }
  assert.equal(s.count('booking_mutations'),4);assert.equal(s.count('booking_outbox'),4);assert.ok(s.sql.prepare('SELECT kind FROM booking_outbox').all().every(row=>row.kind==='engineer-job-progressed'));
});

test('engineer transition rejects skipped, reversed, unsupported and malformed actions',async()=>{
  const s=await setup();for(const payload of [{action:'arrived'},{action:'en-route'},{action:'in-progress'}])await assert.rejects(s.command({kind:'engineer-job-transition',payload}),{status:409});
  for(const payload of [{action:'completed'},{action:'declined'},{action:'accepted',operatorId:'other'},null])await assert.rejects(s.command({kind:'engineer-job-transition',payload}),{status:400});
  await s.command({kind:'engineer-job-transition',payload:{action:'accepted'}});await assert.rejects(s.command({kind:'engineer-job-transition',expectedRevision:2,payload:{action:'accepted'}}),{status:409});assert.equal(s.count('booking_mutations'),1);
});

test('closed or refunded bookings cannot be progressed by an engineer',async()=>{
  for(const patch of [{status:'cancelled'},{bookingStatus:'completed'},{jobStatus:'safety-stopped'},{status:'awaiting-final-settlement'},{paymentStatus:'refunded'},{paymentStatus:'refund-pending'},{jobStatus:'unresolved'}]){
    const s=await setup();s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify({...s.snapshot,...patch}),s.bookingId);await assert.rejects(s.command({kind:'engineer-job-transition',payload:{action:'accepted'}}),{status:409});assert.equal(s.count('booking_mutations'),0);assert.equal(s.count('booking_outbox'),0);assert.equal(s.saved().revision,1);
  }
});

test('engineer progress requires the assigned operator and consistent assignment aliases',async()=>{
  const s=await setup();s.sessions.set(s.adminKey,{role:'owner',operatorId:'engineer-one',territoryIds:['*']});await assert.rejects(s.command({kind:'engineer-job-transition',payload:{action:'accepted'}}),{status:403});
  s.sessions.set(s.adminKey,{role:'operator',operatorId:'engineer-one',territoryIds:['andover']});s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify({...s.snapshot,assignedEngineerId:'another-engineer'}),s.bookingId);await assert.rejects(s.command({kind:'engineer-job-transition',payload:{action:'accepted'}}),{status:404});assert.equal(s.count('booking_mutations'),0);
});

test('engineer progress retries reuse the original receipt after subsequent progress',async()=>{
  const s=await setup(),requestId=crypto.randomUUID(),input={kind:'engineer-job-transition',requestId,payload:{action:'accepted'}};await s.command(input);await s.command({kind:'engineer-job-transition',expectedRevision:2,payload:{action:'en-route'}});
  const replay=await s.command({...input,now:'2026-10-28T18:00:00Z'});assert.equal(replay.reused,true);assert.equal(replay.revision,2);assert.equal(s.record().jobStatus,'en-route');assert.equal(s.count('booking_mutations'),2);
  await assert.rejects(s.command({...input,payload:{action:'arrived'}}),{status:409});
});

test('competing engineer progress commands commit once and event failure rolls back',async()=>{
  const s=await setup(),input={kind:'engineer-job-transition',payload:{action:'accepted'}},results=await Promise.allSettled([s.command(input),s.command(input)]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.status,409);assert.equal(s.count('booking_mutations'),1);
  s.sql.exec("CREATE TRIGGER reject_progress BEFORE INSERT ON booking_outbox BEGIN SELECT RAISE(ABORT,'synthetic-progress-failure'); END;");await assert.rejects(s.command({kind:'engineer-job-transition',expectedRevision:2,payload:{action:'en-route'}}),/synthetic-progress-failure/);assert.equal(s.record().jobStatus,'accepted');assert.equal(s.saved().revision,2);assert.equal(s.count('booking_mutations'),1);assert.equal(s.count('booking_outbox'),1);
});
