import {commitBookingChange} from '../../../functions/_shared/booking-transactions.js';

// Synthetic-only runtime proof; bind VIPOAP_TEST_DB to the isolated preview D1.
// No public trigger, provider client, customer data or production fallback exists.
export default {
  async fetch(){return new Response('Not found',{status:404})},
  async scheduled(_event,env){
    const db=env.VIPOAP_TEST_DB;
    if(!db)throw Error('Preview test binding is required.');
    const marker=await db.prepare("SELECT id FROM booking_transactions WHERE id='qa-foundation-one-20261028'").first();
    if(!marker)throw Error('The isolated preview fixture marker is required.');
    const runId=crypto.randomUUID(),prefix=`qa-runtime-${runId}`,engineerId=`qa-engineer-${runId}`,checks=[];
    const assert=(condition,label)=>{if(!condition)throw Error(`Runtime proof failed: ${label}`);checks.push(label)};
    const make=(id,start=1000,end=2000)=>({bookingId:`${prefix}-${id}`,expectedRevision:0,requestId:crypto.randomUUID(),snapshot:{fixture:true,status:'synthetic-runtime-test'},reservation:{engineerId,startMs:start,endMs:end},events:[{kind:'test-runtime-only',payload:{fixture:true}}]});
    const inputs=[make('one'),make('two')],race=await Promise.allSettled(inputs.map(input=>commitBookingChange(db,input)));
    const winnerIndex=race.findIndex(result=>result.status==='fulfilled'),losers=race.filter(result=>result.status==='rejected');
    assert(winnerIndex>=0&&losers.length===1&&losers[0].reason.status===409,'one-overlap-winner');
    const winner=inputs[winnerIndex],loser=inputs[1-winnerIndex];
    assert(!(await db.prepare('SELECT id FROM booking_transactions WHERE id=?').bind(loser.bookingId).first()),'conflict-rolled-back-snapshot');
    assert(!(await db.prepare('SELECT id FROM booking_mutations WHERE id=?').bind(loser.requestId).first()),'conflict-rolled-back-receipt');
    const replay=await commitBookingChange(db,winner);assert(replay.reused===true&&replay.revision===1,'same-request-replay');
    let changed=false;try{await commitBookingChange(db,{...winner,snapshot:{fixture:true,status:'changed'}})}catch(error){changed=error.status===409}assert(changed,'changed-request-conflict');
    let stale=false;try{await commitBookingChange(db,{...winner,requestId:crypto.randomUUID()})}catch(error){stale=error.status===409}assert(stale,'stale-revision-conflict');
    const adjacent=make('adjacent',2000,3000);await commitBookingChange(db,adjacent);
    let conflict=false;try{await commitBookingChange(db,{...winner,expectedRevision:1,requestId:crypto.randomUUID(),reservation:{engineerId,startMs:1500,endMs:2500}})}catch(error){conflict=error.status===409}assert(conflict,'reschedule-conflict');
    const slot=await db.prepare('SELECT start_ms,end_ms FROM booking_slot_reservations WHERE booking_id=?').bind(winner.bookingId).first();assert(slot?.start_ms===1000&&slot?.end_ms===2000,'reschedule-retains-old-slot');
    const failed=make('outbox-rollback');
    const failingDb={prepare:db.prepare.bind(db),batch(statements){return db.batch([...statements,db.prepare("INSERT INTO booking_outbox (id,mutation_id,booking_id,kind,payload_json,created_at) SELECT ?,mutation_id,booking_id,'',payload_json,created_at FROM booking_outbox WHERE mutation_id=?").bind(`${failed.requestId}:forced-invalid-kind`,failed.requestId)])}};
    // No slot here: the deliberately invalid outbox write must be the failure.
    let rolledBack=false;try{await commitBookingChange(failingDb,{...failed,reservation:null})}catch(error){rolledBack=/constraint/i.test(String(error.message))}assert(rolledBack,'forced-outbox-constraint');
    assert(!(await db.prepare('SELECT id FROM booking_transactions WHERE id=?').bind(failed.bookingId).first()),'outbox-failure-rolls-back-booking');
    assert(!(await db.prepare('SELECT id FROM booking_mutations WHERE id=?').bind(failed.requestId).first()),'outbox-failure-rolls-back-receipt');
    assert(!(await db.prepare('SELECT id FROM booking_outbox WHERE mutation_id=?').bind(failed.requestId).first()),'outbox-failure-rolls-back-event');
    await commitBookingChange(db,{bookingId:winner.bookingId,expectedRevision:1,requestId:crypto.randomUUID(),snapshot:{fixture:true,proof:'passed',runId,checks},reservation:null,events:[]});
    await commitBookingChange(db,{bookingId:adjacent.bookingId,expectedRevision:1,requestId:crypto.randomUUID(),snapshot:{fixture:true,proof:'adjacent-slot-passed'},reservation:null,events:[]});
    console.log(JSON.stringify({suite:'booking-runtime-proof',runId,bookingId:winner.bookingId,passed:true,checks}));
  }
};
