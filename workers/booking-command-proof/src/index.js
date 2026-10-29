import {extendedProof} from './extended.js';
// Manual, synthetic-only command proof. No public trigger or provider access.
import {executeBookingCommand} from '../../../functions/_shared/booking-commands.js';
import {commitBookingChange} from '../../../functions/_shared/booking-transactions.js';
import {digest} from '../../../functions/_shared/admin-auth.js';
export default {
  async fetch(){return new Response('Not found',{status:404})},
  async scheduled(_event,env){
    const db=env.VIPOAP_TEST_DB;if(!db)throw Error('Preview test binding required.');
    if(!(await db.prepare("SELECT id FROM booking_transactions WHERE id='qa-foundation-one-20261028'").first()))throw Error('Preview fixture marker required.');
    await db.prepare('SELECT command_json FROM booking_mutations LIMIT 0').all();
    await db.prepare('SELECT report_json,revision,review_token FROM booking_safety_cases LIMIT 0').all();
    await db.prepare('SELECT actor_hash,input_hash FROM booking_safety_reviews LIMIT 0').all();
    await db.prepare('SELECT amount_pence,state FROM booking_checkout_intents LIMIT 0').all();
    const runId=crypto.randomUUID(),bookingId=`booking:qa-command-${runId}`,operatorId=`qa-engineer-${runId}`,customerId=`customer:qa-${runId}`,token=`qa-admin-${runId}`,customerToken=`qa-customer-${runId}`,sessions=new Map(),checks=[];
    const adminKey=`admin-session:${await digest(token)}`,customerKey=`customer-session:${await digest(customerToken)}`;
    const admin={role:'operator',operatorId,email:'synthetic@example.test',territoryIds:['andover']},customer={customerId,expiresAt:new Date(Date.now()+3600000).toISOString()};sessions.set(adminKey,admin);sessions.set(customerKey,customer);
    const local={VIPOAP_BOOKING_DB:db,VIPOAP_DATA:{async get(key){return sessions.get(key)||null}}},request=new Request('https://example.test',{headers:{'x-admin-session':token,'x-customer-session':customerToken}});
    const assert=(condition,label)=>{if(!condition)throw Error(`Command runtime proof failed: ${label}`);checks.push(label)};
    const snapshot={fixture:true,customerId,operatorId,territoryId:'andover',reference:`QA-${runId}`,status:'confirmed',bookingStatus:'confirmed',jobStatus:'pending',paymentStatus:'prepaid',price:'synthetic-only'};
    await commitBookingChange(db,{bookingId,expectedRevision:0,requestId:crypto.randomUUID(),snapshot,reservation:{engineerId:operatorId,startMs:4000,endMs:5000},events:[]});
    const command=(patch={})=>executeBookingCommand({request,env:local,bookingId,expectedRevision:1,requestId:crypto.randomUUID(),kind:'set-admin-note',payload:{note:'Synthetic note'},now:'2026-10-28T17:00:00Z',...patch});
    const noteId=crypto.randomUUID(),notes=await Promise.all([command({requestId:noteId}),command({requestId:noteId,now:'2026-10-28T17:00:01Z'})]);assert(notes.filter(result=>result.reused).length===1,'concurrent-identical-note-once');
    let denied=false;try{await command({requestId:noteId,payload:{note:'Changed'}})}catch(error){denied=error.status===409}assert(denied,'changed-request-conflict');
    sessions.set(adminKey,{...admin,operatorId:'someone-else'});denied=false;try{await command({expectedRevision:2})}catch(error){denied=error.status===404}assert(denied,'engineer-scope-enforced');sessions.set(adminKey,admin);
    sessions.set(customerKey,{...customer,customerId:'customer:someone-else'});denied=false;try{await command({kind:'customer-appointment-request',expectedRevision:2,payload:{requestType:'cancel'}})}catch(error){denied=error.status===404}assert(denied,'customer-ownership-enforced');sessions.set(customerKey,customer);
    const customerRequest={kind:'customer-appointment-request',expectedRevision:2,requestId:crypto.randomUUID(),payload:{requestType:'change',details:'Synthetic Tuesday request'}};
    assert((await command(customerRequest)).revision===3,'customer-request-committed');
    denied=false;try{await command({...customerRequest,requestId:crypto.randomUUID(),expectedRevision:3})}catch(error){denied=error.status===409}assert(denied,'pending-request-not-duplicated');
    const failedId=crypto.randomUUID(),failingDb={prepare:db.prepare.bind(db),batch(statements){return db.batch([...statements,db.prepare("INSERT INTO booking_outbox (id,mutation_id,booking_id,kind,payload_json,created_at) SELECT ?,mutation_id,booking_id,'',payload_json,created_at FROM booking_outbox WHERE mutation_id=?").bind(`${failedId}:invalid`,failedId)])}};
    denied=false;try{await command({requestId:failedId,expectedRevision:3,env:{...local,VIPOAP_BOOKING_DB:failingDb}})}catch(error){denied=/constraint/i.test(String(error.message))}assert(denied,'outbox-constraint-failed');
    const current=await db.prepare('SELECT revision,snapshot_json FROM booking_transactions WHERE id=?').bind(bookingId).first();assert(current.revision===3,'outbox-failure-state-rollback');assert(!(await db.prepare('SELECT id FROM booking_mutations WHERE id=?').bind(failedId).first()),'outbox-failure-command-rollback');
    const competing=await Promise.allSettled([command({expectedRevision:3,payload:{note:'First'}}),command({expectedRevision:3,payload:{note:'Second'}})]);assert(competing.filter(item=>item.status==='fulfilled').length===1&&competing.find(item=>item.status==='rejected').reason.status===409,'different-commands-one-winner');
    const replay=await command({requestId:noteId,now:'2026-10-28T18:00:00Z'});assert(replay.reused===true&&replay.revision===2,'replay-after-later-changes');
    const final=await db.prepare('SELECT revision,snapshot_json FROM booking_transactions WHERE id=?').bind(bookingId).first(),stored=JSON.parse(final.snapshot_json);assert(stored.customerId===customerId&&stored.operatorId===operatorId&&stored.price===snapshot.price&&stored.status==='confirmed'&&stored.customerRequestStatus==='received','identity-price-appointment-preserved');
    const receipts=await db.prepare('SELECT command_json FROM booking_mutations WHERE booking_id=? AND command_json IS NOT NULL').bind(bookingId).all();assert(receipts.results.length===3&&receipts.results.every(row=>{const meta=JSON.parse(row.command_json);return meta.version===1&&typeof meta.actor==='string'&&meta.actor.length===64&&!row.command_json.includes('Synthetic note')}),'atomic-command-metadata-present');
    const fixtures=await extendedProof({db,local,request,sessions,adminKey,admin,runId,customerId,operatorId,assert});
    await commitBookingChange(db,{bookingId,expectedRevision:final.revision,requestId:crypto.randomUUID(),snapshot:{...stored,proof:'commands-passed',runId,checks},reservation:null,events:[]});
    console.log(JSON.stringify({suite:'booking-command-proof',passed:true,runId,bookingId,fixtures,checks}));
  }
};
