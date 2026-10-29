import {reviewBookingSafetyCase,listBookingSafetyReviews} from '../functions/_shared/booking-safety-review.js';
import {loadBookingSafetyCase,listBookingSafetyCases} from '../functions/_shared/booking-safety.js';
import {ukAppointmentInterval} from '../functions/_shared/booking-time.js';
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


test('engineer decline atomically releases the slot and requests reassignment without changing payment facts',async()=>{const s=await setup();await s.command({kind:'engineer-job-decline',payload:{reason:'Synthetic reason'}});const record=s.record();assert.equal(record.bookingStatus,'unfilled');assert.equal(record.operatorId,'');assert.equal(record.assignedEngineerId,'');assert.equal(record.assignedProviderId,'');assert.equal(s.count('booking_slot_reservations'),0);assert.equal(s.count('booking_mutations'),1);assert.equal(s.count('booking_outbox'),1);assert.equal(record.paymentStatus,s.snapshot.paymentStatus);assert.equal(record.price,s.snapshot.price);assert.equal(record.customerId,s.snapshot.customerId);assert.equal(record.assignmentHistory[0].reason,'Synthetic reason');const event=s.sql.prepare('SELECT kind,payload_json FROM booking_outbox').get();assert.equal(event.kind,'engineer-assignment-declined');assert.doesNotMatch(event.payload_json,/Synthetic reason|synthetic@example/)});
test('decline of closed, active or refunded work preserves its reservation and assignment',async()=>{for(const patch of [{status:'cancelled'},{bookingStatus:'completed'},{jobStatus:'in-progress'},{paymentStatus:'refunded'},{paymentStatus:'refund-pending'}]){const s=await setup();s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify({...s.snapshot,...patch}),s.bookingId);await assert.rejects(s.command({kind:'engineer-job-decline',payload:{reason:''}}),{status:409});assert.equal(s.count('booking_slot_reservations'),1);assert.equal(s.count('booking_mutations'),0);assert.equal(s.record().operatorId,'engineer-one')}});
test('decline requires the assigned engineer and consistent provider aliases',async()=>{const s=await setup();s.sessions.set(s.adminKey,{role:'owner',operatorId:'engineer-one',territoryIds:['*']});await assert.rejects(s.command({kind:'engineer-job-decline',payload:{reason:''}}),{status:403});s.sessions.set(s.adminKey,{role:'operator',operatorId:'engineer-one',territoryIds:['andover']});s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify({...s.snapshot,assignedProviderId:'another'}),s.bookingId);await assert.rejects(s.command({kind:'engineer-job-decline',payload:{reason:''}}),{status:404});assert.equal(s.count('booking_mutations'),0);assert.equal(s.count('booking_slot_reservations'),1)});
test('failed decline event rolls back assignment, receipt and slot release together',async()=>{const s=await setup();s.sql.exec("CREATE TRIGGER reject_decline BEFORE INSERT ON booking_outbox BEGIN SELECT RAISE(ABORT,'synthetic-decline-failure'); END;");await assert.rejects(s.command({kind:'engineer-job-decline',payload:{reason:''}}),/synthetic-decline-failure/);assert.equal(s.saved().revision,1);assert.equal(s.record().operatorId,'engineer-one');assert.equal(s.count('booking_slot_reservations'),1);assert.equal(s.count('booking_mutations'),0);assert.equal(s.count('booking_outbox'),0)});
test('competing decline commands release one assignment once and do not grant receipt access after unassignment',async()=>{const s=await setup(),requestId=crypto.randomUUID(),input={kind:'engineer-job-decline',requestId,payload:{reason:''}},results=await Promise.allSettled([s.command(input),s.command({...input,requestId:crypto.randomUUID()})]);assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(s.count('booking_mutations'),1);assert.equal(s.count('booking_outbox'),1);assert.equal(s.count('booking_slot_reservations'),0);await assert.rejects(s.command(input),{status:404})});


async function assignmentSetup(){const s=await setup();s.sessions.set(s.adminKey,{role:'owner',operatorId:'hq-owner',territoryIds:['*']});const snapshot={...s.snapshot,date:'2026-11-02',time:'10:00',duration:60,supportType:'Home visit'};s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify(snapshot),s.bookingId);const slot=ukAppointmentInterval({date:snapshot.date,time:snapshot.time,durationMinutes:60});s.sql.prepare('UPDATE booking_slot_reservations SET start_ms=?,end_ms=? WHERE booking_id=?').run(slot.startMs,slot.endMs,s.bookingId);s.sessions.set('operator:engineer-two',{id:'engineer-two',status:'active',territoryIds:['andover'],serviceTypes:['home','remote']});s.sessions.set('availability:andover:engineer-two',{homeVisitWeekly:{monday:[['09:00','17:00']]},blockedDates:[],overrides:[]});return{...s,slot,assign:patch=>s.command({kind:'hq-assign-engineer',payload:{operatorId:'engineer-two'},...patch})}}
test('HQ assignment commits replacement reservation and event while preserving customer and payment facts',async()=>{const s=await assignmentSetup();await s.assign();const record=s.record(),slot=s.sql.prepare('SELECT * FROM booking_slot_reservations').get();assert.equal(slot.engineer_id,'engineer-two');assert.equal(slot.start_ms,s.slot.startMs);assert.equal(record.operatorId,'engineer-two');assert.equal(record.assignedProviderId,'engineer-two');assert.equal(record.jobStatus,'pending');assert.equal(record.bookingStatus,'requested');for(const field of ['customerId','price','paymentStatus','reference'])assert.equal(record[field],s.snapshot[field]);assert.equal(s.count('booking_outbox'),1);assert.equal(s.sql.prepare('SELECT kind FROM booking_outbox').get().kind,'booking-engineer-assigned')});
test('assignment retry reuses its receipt and selecting the current engineer preserves accepted progress without notification',async()=>{const s=await assignmentSetup(),requestId=crypto.randomUUID();await s.assign({requestId});assert.equal((await s.assign({requestId})).reused,true);assert.equal(s.count('booking_outbox'),1);const t=await assignmentSetup();t.sql.prepare("UPDATE booking_transactions SET snapshot_json=json_set(snapshot_json,'$.jobStatus','accepted') WHERE id=?").run(t.bookingId);await t.assign({payload:{operatorId:'engineer-one'}});assert.equal(t.record().jobStatus,'accepted');assert.equal(t.count('booking_outbox'),0);assert.equal(t.record().operatorId,'engineer-one')});
test('a conflicting replacement slot rolls back the old reservation and assignment',async()=>{const s=await assignmentSetup();s.sql.prepare('INSERT INTO booking_transactions VALUES (?,?,1,?,?)').run('booking:other','{}','fixture','2026-10-28');s.sql.prepare('INSERT INTO booking_slot_reservations VALUES (?,?,?,?)').run('booking:other','engineer-two',s.slot.startMs,s.slot.endMs);await assert.rejects(s.assign(),{status:409});assert.equal(s.record().operatorId,'engineer-one');assert.equal(s.saved().revision,1);assert.equal(s.count('booking_mutations'),0);assert.equal(s.sql.prepare('SELECT engineer_id FROM booking_slot_reservations WHERE booking_id=?').get(s.bookingId).engineer_id,'engineer-one')});
test('assignment event failure rolls back reservation transfer and snapshot together',async()=>{const s=await assignmentSetup();s.sql.exec("CREATE TRIGGER reject_assignment BEFORE INSERT ON booking_outbox BEGIN SELECT RAISE(ABORT,'synthetic-assignment-failure'); END;");await assert.rejects(s.assign(),/synthetic-assignment-failure/);assert.equal(s.record().operatorId,'engineer-one');assert.equal(s.count('booking_mutations'),0);assert.equal(s.sql.prepare('SELECT engineer_id FROM booking_slot_reservations').get().engineer_id,'engineer-one')});
test('assignment validates territory, service suspension, compliance and complete scheduled availability',async()=>{for(const change of [{status:'inactive'},{territoryIds:['elsewhere']},{serviceTypes:['remote']},{homeSuspended:true},{trainingStatus:'complete'}]){const s=await assignmentSetup();s.sessions.set('operator:engineer-two',{...s.sessions.get('operator:engineer-two'),...change});await assert.rejects(s.assign(),{status:409});assert.equal(s.count('booking_mutations'),0)}for(const availability of [null,{homeVisitWeekly:{monday:[['10:30','17:00']]}},{homeVisitWeekly:{monday:[['09:00','17:00']]},blockedDates:['2026-11-02']}]){const s=await assignmentSetup();s.sessions.set('availability:andover:engineer-two',availability);await assert.rejects(s.assign(),{status:409});assert.equal(s.record().operatorId,'engineer-one')}});
test('assignment requires HQ scope and rejects closed work or an inconsistent current reservation',async()=>{for(const patch of [{status:'completed'},{paymentStatus:'refund-pending'},{jobStatus:'in-progress'},{additionalTime:{}},{additionalTime:[{minutes:30}]}]){const s=await assignmentSetup();s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify({...s.record(),...patch}),s.bookingId);await assert.rejects(s.assign(),{status:409})}const s=await assignmentSetup();s.sessions.set(s.adminKey,{role:'operator',operatorId:'engineer-one',territoryIds:['andover']});await assert.rejects(s.assign(),{status:403});const t=await assignmentSetup();t.sql.prepare('UPDATE booking_slot_reservations SET end_ms=end_ms+60000 WHERE booking_id=?').run(t.bookingId);await assert.rejects(t.assign(),{status:409});assert.equal(t.count('booking_mutations'),0)});

test('concurrent replacement assignments commit one engineer reservation and one event',async()=>{const s=await assignmentSetup();s.sessions.set('operator:engineer-three',{...s.sessions.get('operator:engineer-two'),id:'engineer-three'});s.sessions.set('availability:andover:engineer-three',s.sessions.get('availability:andover:engineer-two'));const results=await Promise.allSettled([s.assign(),s.assign({payload:{operatorId:'engineer-three'}})]);assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(s.count('booking_slot_reservations'),1);assert.equal(s.count('booking_mutations'),1);assert.equal(s.count('booking_outbox'),1);assert.equal(s.sql.prepare('SELECT engineer_id FROM booking_slot_reservations').get().engineer_id,s.record().operatorId)});
test('assignment compares actual UTC endpoints across the spring clock change',async()=>{const s=await assignmentSetup(),record={...s.record(),date:'2027-03-28',time:'00:30',duration:120},interval=ukAppointmentInterval({date:record.date,time:record.time,durationMinutes:120});s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify(record),s.bookingId);s.sql.prepare('UPDATE booking_slot_reservations SET start_ms=?,end_ms=? WHERE booking_id=?').run(interval.startMs,interval.endMs,s.bookingId);s.sessions.set('availability:andover:engineer-two',{homeVisitWeekly:{sunday:[['00:00','02:30']]}});await assert.rejects(s.assign(),{status:409});assert.equal(s.count('booking_mutations'),0);assert.equal(s.record().operatorId,'engineer-one')});


const fullCompliance={trainingStatus:'complete',dbsStatus:'verified',dbsRenewalDate:'2099-01-01',photoStatus:'approved',agreementStatus:'signed',insuranceStatus:'verified',insuranceExpiryDate:'2099-01-01'};
test('replacement compliance must remain valid on the appointment date',async()=>{for(const field of ['dbsRenewalDate','insuranceExpiryDate']){const s=await assignmentSetup();s.sessions.set('operator:engineer-two',{...s.sessions.get('operator:engineer-two'),...fullCompliance,[field]:'2026-11-01'});await assert.rejects(s.assign(),{status:409});assert.equal(s.count('booking_mutations'),0)}const s=await assignmentSetup();s.sessions.set('operator:engineer-two',{...s.sessions.get('operator:engineer-two'),...fullCompliance,dbsRenewalDate:'2026-11-02',insuranceExpiryDate:'2026-11-02'});await s.assign();assert.equal(s.record().operatorId,'engineer-two')});
test('malformed compliance expiry dates cannot pass assignment validation',async()=>{for(const date of ['2099-02-30','not-a-date',42]){const s=await assignmentSetup();s.sessions.set('operator:engineer-two',{...s.sessions.get('operator:engineer-two'),...fullCompliance,dbsRenewalDate:date});await assert.rejects(s.assign(),{status:409});assert.equal(s.count('booking_mutations'),0)}});
test('malformed stored schedules produce a review conflict without mutating the booking',async()=>{for(const availability of [{overrides:[null]},{blockedDates:['not-a-date']},{weeklyBlocks:{monday:{}}},{weeklyBlocks:{monday:[{start:'09:00',end:'17:00',services:'home'}]}},{homeVisitWeekly:{monday:{}}},{homeVisitWeekly:{monday:[['17:00','09:00']]}}]){const s=await assignmentSetup();s.sessions.set('availability:andover:engineer-two',availability);await assert.rejects(s.assign(),{status:409});assert.equal(s.saved().revision,1);assert.equal(s.count('booking_mutations'),0)}});
test('modern schedule blocks keep home and remote service availability separate',async()=>{const s=await assignmentSetup();s.sessions.set('availability:andover:engineer-two',{weeklyBlocks:{monday:[{start:'09:00',end:'17:00',services:['remote']}]}});await assert.rejects(s.assign(),{status:409});s.sessions.set('availability:andover:engineer-two',{weeklyBlocks:{monday:[{start:'09:00',end:'17:00',services:['home','remote']}]}});await s.assign();assert.equal(s.record().operatorId,'engineer-two')});


const safetyInput={concernType:'Engineer safety',severity:'high',description:'Synthetic private safety description',immediateAction:'Synthetic private action',currentlySafe:false,stopWork:true};
test('safety report and stop commit together while preserving reservation and prior payment facts',async()=>{const s=await setup(),response=await s.command({kind:'report-booking-safety',payload:safetyInput}),row=s.sql.prepare('SELECT * FROM booking_safety_cases').get(),report=JSON.parse(row.report_json);assert.equal(row.id,response.incidentId);assert.equal(s.record().status,'safety-stopped');assert.equal(s.record().bookingStatus,'safety-stopped');assert.equal(s.record().jobStatus,'safety-stopped');assert.equal(s.record().paymentStatus,'review');assert.equal(s.record().price,s.snapshot.price);assert.equal(report.priorState.paymentStatus,'prepaid');assert.equal(report.reporterId,'engineer-one');assert.equal(s.count('booking_slot_reservations'),1);assert.equal(s.count('booking_mutations'),1);const event=s.sql.prepare('SELECT payload_json FROM booking_outbox').get();assert.doesNotMatch(event.payload_json,/Synthetic private|Engineer safety|synthetic@example/);assert.doesNotMatch(s.saved().snapshot_json,/Synthetic private/)});
test('reporting historical work without a stop keeps appointment and payment states',async()=>{const s=await setup();s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify({...s.snapshot,status:'completed',bookingStatus:'completed',jobStatus:'completed'}),s.bookingId);await s.command({kind:'report-booking-safety',payload:{...safetyInput,stopWork:false}});assert.equal(s.record().status,'completed');assert.equal(s.record().paymentStatus,'prepaid');assert.equal(s.count('booking_safety_cases'),1)});
test('safety case or event constraint failure rolls back case, stop and receipt',async()=>{for(const table of ['booking_safety_cases','booking_outbox']){const s=await setup();s.sql.exec(`CREATE TRIGGER reject_safety BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'synthetic-safety-failure'); END;`);await assert.rejects(s.command({kind:'report-booking-safety',payload:safetyInput}),/synthetic-safety-failure/);assert.equal(s.record().status,'confirmed');assert.equal(s.record().paymentStatus,'prepaid');assert.equal(s.count('booking_safety_cases'),0);assert.equal(s.count('booking_mutations'),0);assert.equal(s.count('booking_slot_reservations'),1)}});
test('identical concurrent safety reports create one case and retain stable replay reference',async()=>{const s=await setup(),requestId=crypto.randomUUID(),input={kind:'report-booking-safety',requestId,payload:safetyInput},results=await Promise.all([s.command(input),s.command({...input,now:'2026-10-28T17:00:01Z'})]);assert.equal(results.filter(item=>item.reused).length,1);assert.equal(results[0].incidentId,results[1].incidentId);assert.equal(s.count('booking_safety_cases'),1);await s.command({expectedRevision:2,payload:{note:'Later note'}});const replay=await s.command(input);assert.equal(replay.revision,2);assert.equal(replay.incidentId,results[0].incidentId);assert.equal(replay.reference,results[0].reference)});
test('closed or refunded work rejects a stop but can still receive a report',async()=>{for(const patch of [{status:'completed'},{bookingStatus:'cancelled'},{jobStatus:'safety-stopped'},{paymentStatus:'refunded'},{paymentStatus:'refund-pending'}]){const s=await setup();s.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run(JSON.stringify({...s.snapshot,...patch}),s.bookingId);await assert.rejects(s.command({kind:'report-booking-safety',payload:safetyInput}),{status:409});assert.equal(s.count('booking_safety_cases'),0);await s.command({kind:'report-booking-safety',payload:{...safetyInput,stopWork:false}});assert.equal(s.count('booking_safety_cases'),1)}});
test('safety report authorization and input fields cannot be spoofed',async()=>{const s=await setup();await assert.rejects(s.command({kind:'report-booking-safety',payload:{...safetyInput,reporterId:'someone-else'}}),{status:400});await assert.rejects(s.command({kind:'report-booking-safety',payload:{...safetyInput,stopWork:'true'}}),{status:400});s.sessions.set(s.adminKey,{role:'operator',operatorId:'another',territoryIds:['andover']});await assert.rejects(s.command({kind:'report-booking-safety',payload:safetyInput}),{status:404});assert.equal(s.count('booking_safety_cases'),0)});
test('private safety cases require safety-management permission and matching territory',async()=>{const s=await setup(),response=await s.command({kind:'report-booking-safety',payload:safetyInput});await assert.rejects(loadBookingSafetyCase({request:s.request,env:s.env,incidentId:response.incidentId}),{status:403});s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['elsewhere']});await assert.rejects(loadBookingSafetyCase({request:s.request,env:s.env,incidentId:response.incidentId}),{status:404});s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['andover']});const result=await loadBookingSafetyCase({request:s.request,env:s.env,incidentId:response.incidentId});assert.equal(result.report.description,safetyInput.description);assert.equal(result.territoryId,'andover');s.sql.prepare('UPDATE booking_safety_cases SET report_json=? WHERE id=?').run('[]',response.incidentId);await assert.rejects(loadBookingSafetyCase({request:s.request,env:s.env,incidentId:response.incidentId}),{status:503})});
test('safety command requires its staged migration and does not mutate when storage is absent',async()=>{const s=await setup();s.sql.exec('DROP TABLE booking_safety_cases');await assert.rejects(s.command({kind:'report-booking-safety',payload:safetyInput}),{status:503});assert.equal(s.saved().revision,1);assert.equal(s.count('booking_mutations'),0);assert.equal(s.count('booking_slot_reservations'),1);await s.command();assert.equal(s.saved().revision,2)});

 test('private safety reader fails closed for legacy blank scope and invalid identifiers before lookup',async()=>{
 const s=await setup(),response=await s.command({kind:'report-booking-safety',payload:safetyInput});
 s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['andover']});
 s.sql.exec('PRAGMA ignore_check_constraints=ON');
 s.sql.prepare('UPDATE booking_safety_cases SET territory_id=? WHERE id=?').run('',response.incidentId);
 await assert.rejects(loadBookingSafetyCase({request:s.request,env:s.env,incidentId:response.incidentId}),{status:404});
 let queried=false;s.env.VIPOAP_BOOKING_DB={prepare(){queried=true;throw new Error('Unexpected query')}};
 for(const incidentId of ['incident:'+'-'.repeat(36),'incident:00000000-0000-1000-8000-000000000000'])await assert.rejects(loadBookingSafetyCase({request:s.request,env:s.env,incidentId}),{status:404});
 assert.equal(queried,false);
 });

 test('safety queue scopes before pagination, orders ties and keeps private reports out of list results',async()=>{
 const s=await setup(),ids=[];
 for(let i=0;i<5;i++){const result=await s.command({kind:'report-booking-safety',expectedRevision:i+1,payload:{...safetyInput,stopWork:false}});ids.push(result.incidentId)}
 s.sql.prepare('UPDATE booking_safety_cases SET created_at=?').run('2026-10-29T14:00:00.000Z');
 s.sql.prepare('UPDATE booking_safety_cases SET territory_id=? WHERE id=?').run('elsewhere',ids[0]);
 s.sql.prepare('UPDATE booking_safety_cases SET status=? WHERE id=?').run('triaged',ids[1]);
 s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['andover']});
 const expected=ids.slice(1).sort().reverse(),seen=[];let cursor=null;
 do{const page=await listBookingSafetyCases({request:s.request,env:s.env,limit:2,cursor});seen.push(...page.items.map(row=>row.id));assert.doesNotMatch(JSON.stringify(page),/Synthetic private|reporterId|description|immediateAction/);cursor=page.nextCursor}while(cursor);
 assert.deepEqual(seen,expected);
 const filtered=await listBookingSafetyCases({request:s.request,env:s.env,status:'triaged'});assert.deepEqual(filtered.items.map(row=>row.id),[ids[1]]);
 s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['*']});assert.equal((await listBookingSafetyCases({request:s.request,env:s.env})).items.length,5);
 });
 test('safety queue denies reporters and rejects malformed paging without reading cases',async()=>{
 const s=await setup();await assert.rejects(listBookingSafetyCases({request:s.request,env:s.env}),{status:403});
 s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['andover']});let queried=false;s.env.VIPOAP_BOOKING_DB={prepare(){queried=true;throw new Error('Unexpected query')}};
 for(const args of [{limit:0},{limit:101},{limit:'2'},{status:'unknown'},{cursor:{}},{cursor:{createdAt:'bad',id:'bad'}},{cursor:{createdAt:'2026-10-28',id:'incident:'+crypto.randomUUID(),extra:true}}])await assert.rejects(listBookingSafetyCases({request:s.request,env:s.env,...args}),{status:400});
 assert.equal(queried,false);
 s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:[]});assert.deepEqual(await listBookingSafetyCases({request:s.request,env:s.env}),{items:[],nextCursor:null});assert.equal(queried,false);
 });

async function reviewSetup(){const s=await setup(),report=await s.command({kind:'report-booking-safety',payload:safetyInput});s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['andover']});const review=(patch={})=>reviewBookingSafetyCase({request:s.request,env:s.env,incidentId:report.incidentId,expectedRevision:1,requestId:crypto.randomUUID(),changes:{status:'triaged',note:'Synthetic manager review'},...patch});return {...s,incidentId:report.incidentId,review}}
test('case review atomically records actual manager, note and revision without resuming work or changing payment',async()=>{
 const s=await reviewSetup(),before=s.saved().snapshot_json,report=s.sql.prepare('SELECT report_json FROM booking_safety_cases').get().report_json;
 assert.deepEqual(await s.review(),{incidentId:s.incidentId,revision:2,reused:false});
 const row=s.sql.prepare('SELECT * FROM booking_safety_cases').get(),audit=s.sql.prepare('SELECT * FROM booking_safety_reviews').get();assert.equal(row.status,'triaged');assert.equal(row.revision,2);assert.equal(audit.actor_id,'manager');assert.equal(audit.prior_status,'new');assert.equal(audit.note,'Synthetic manager review');assert.equal(row.report_json,report);assert.equal(s.saved().snapshot_json,before);assert.equal(s.record().status,'safety-stopped');assert.equal(s.record().paymentStatus,'review');assert.equal(s.count('booking_slot_reservations'),1);
 const read=await loadBookingSafetyCase({request:s.request,env:s.env,incidentId:s.incidentId});assert.equal(read.revision,2);
});
test('concurrent identical case reviews save once and replay their original receipt after later updates',async()=>{
 const s=await reviewSetup(),requestId=crypto.randomUUID(),results=await Promise.all([s.review({requestId}),s.review({requestId})]);assert.equal(results.filter(r=>r.reused).length,1);assert.equal(s.count('booking_safety_reviews'),1);
 await s.review({expectedRevision:2,changes:{status:'resolved',note:'Synthetic resolution'}});assert.equal((await s.review({requestId})).revision,2);
 await assert.rejects(s.review({requestId,changes:{status:'closed',note:'Different'}}),{status:409});
 s.sessions.set(s.adminKey,{role:'admin',operatorId:'other-manager',territoryIds:['andover']});await assert.rejects(s.review({requestId}),{status:409});
});
test('competing case reviews cannot overwrite one another and history stays scoped and paginated',async()=>{
 const s=await reviewSetup(),results=await Promise.allSettled([s.review(),s.review({changes:{status:'action-required',note:'Alternative review'}})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);assert.equal(s.count('booking_safety_reviews'),1);
 await s.review({expectedRevision:2,changes:{status:'awaiting-information',note:'Follow-up'}});
 const first=await listBookingSafetyReviews({request:s.request,env:s.env,incidentId:s.incidentId,limit:1});assert.equal(first.items[0].revision,2);assert.equal(first.nextRevision,2);assert.equal(first.items[0].actorId,'manager');const next=await listBookingSafetyReviews({request:s.request,env:s.env,incidentId:s.incidentId,afterRevision:first.nextRevision,limit:1});assert.equal(next.items[0].revision,3);assert.equal(next.nextRevision,null);
 s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['elsewhere']});await assert.rejects(s.review(),{status:404});await assert.rejects(listBookingSafetyReviews({request:s.request,env:s.env,incidentId:s.incidentId}),{status:404});
});
test('failed audit insertion rolls case status and revision back together',async()=>{
 const s=await reviewSetup();s.sql.exec("CREATE TRIGGER fail_safety_review BEFORE INSERT ON booking_safety_reviews BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");await assert.rejects(s.review(),{status:503});const row=s.sql.prepare('SELECT * FROM booking_safety_cases').get();assert.equal(row.status,'new');assert.equal(row.revision,1);assert.equal(row.last_review_id,null);assert.equal(s.count('booking_safety_reviews'),0);
});
test('review permissions and strict inputs reject spoofing or malformed requests before updates',async()=>{
 const s=await reviewSetup();for(const patch of [{expectedRevision:0},{expectedRevision:'1'},{requestId:'bad'},{changes:{status:'triaged',note:''}},{changes:{status:'unknown',note:'Note'}},{changes:{status:'triaged',note:'Note',actorId:'spoof'}},{changes:{status:'triaged',note:'x'.repeat(2001)}}])await assert.rejects(s.review(patch),{status:400});
 s.sessions.set(s.adminKey,{role:'operator',operatorId:'engineer-one',territoryIds:['andover']});await assert.rejects(s.review(),{status:403});assert.equal(s.count('booking_safety_reviews'),0);
});
test('review retries do not bypass revoked scope and missing review schema makes no changes',async()=>{
 const s=await reviewSetup(),requestId=crypto.randomUUID();await s.review({requestId});s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['elsewhere']});await assert.rejects(s.review({requestId}),{status:404});s.sessions.set(s.adminKey,{role:'admin',operatorId:'manager',territoryIds:['andover']});s.sql.exec('DROP TABLE booking_safety_reviews');await assert.rejects(s.review({expectedRevision:2}),{status:503});assert.equal(s.sql.prepare('SELECT revision FROM booking_safety_cases').get().revision,2);
});
