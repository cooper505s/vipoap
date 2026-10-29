// Inactive internal consumer: no route, scheduled trigger or provider is wired here.
// deliver MUST use event.id as the provider idempotency key and honor event.signal.
export async function dispatchBookingOutbox(db,deliver,{limit=20,now=Date.now(),leaseMs=120000,maxAttempts=5}={}){
  if(!db||typeof deliver!=='function')throw Error('Booking delivery dependencies are required.');
  if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isSafeInteger(now)||now<0||!Number.isInteger(leaseMs)||leaseMs<60000||leaseMs>900000||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>10)throw Error('Invalid booking delivery limits.');
  const totals={claimed:0,sent:0,retry:0,failed:0,stale:0};
  await db.prepare("UPDATE booking_outbox SET status='failed',lease_token=NULL,lease_until_ms=NULL,last_error='delivery-interrupted' WHERE status='sending' AND lease_until_ms<=? AND attempts>=?").bind(now,maxAttempts).run();
  for(let index=0;index<limit;index++){
    const token=crypto.randomUUID();
    const result=await db.prepare("UPDATE booking_outbox SET status='sending',lease_token=?,lease_until_ms=?,attempts=attempts+1 WHERE id=(SELECT id FROM booking_outbox WHERE attempts<? AND ((status IN ('pending','failed') AND next_attempt_ms<=?) OR (status='sending' AND lease_until_ms<=?)) ORDER BY created_at,id LIMIT 1) RETURNING id,booking_id,kind,payload_json,attempts").bind(token,now+leaseMs,maxAttempts,now,now).all();
    const item=result.results?.[0];if(!item)break;totals.claimed++;
    let accepted=false;
    try{const delivery=await deliver({id:item.id,bookingId:item.booking_id,kind:item.kind,payload:JSON.parse(item.payload_json),signal:AbortSignal.timeout(15000)});accepted=delivery?.accepted===true;}catch{/* Store no provider error body or customer content. */}
    const status=accepted?'sent':item.attempts>=maxAttempts?'failed':'pending',next=accepted?0:now+Math.min(3600000,60000*2**(item.attempts-1));
    const update=await db.prepare("UPDATE booking_outbox SET status=?,next_attempt_ms=?,delivered_at=?,last_error=?,lease_token=NULL,lease_until_ms=NULL WHERE id=? AND status='sending' AND lease_token=?").bind(status,next,accepted?new Date(now).toISOString():null,accepted?null:'delivery-not-confirmed',item.id,token).run();
    if(!update.meta.changes){totals.stale++;continue;}
    if(accepted)totals.sent++;else if(status==='failed')totals.failed++;else totals.retry++;
  }
  return totals;
}
