import {issueBookingApprovalLink,readBookingApprovalQuote} from '../../../functions/_shared/booking-approval-links.js';
// Synthetic-only expanded runtime checks; receives an in-memory identity store, never production KV.
import {executeBookingCommand} from '../../../functions/_shared/booking-commands.js';
import {commitBookingChange} from '../../../functions/_shared/booking-transactions.js';
import {loadBookingSafetyCase,listBookingSafetyCases} from '../../../functions/_shared/booking-safety.js';
import {reviewBookingSafetyCase,listBookingSafetyReviews} from '../../../functions/_shared/booking-safety-review.js';
import {loadCustomerAdditionalTimeRequest} from '../../../functions/_shared/booking-additional-time.js';
import {ukAppointmentInterval} from '../../../functions/_shared/booking-time.js';
export async function extendedProof({db,local,request,sessions,adminKey,admin,runId,customerId,operatorId,assert}){
 const ids=[],now='2026-10-28T17:00:00Z',base={fixture:true,customerId,operatorId,territoryId:'andover',reference:'QA-'+runId,status:'confirmed',bookingStatus:'confirmed',jobStatus:'pending',paymentStatus:'prepaid',price:'synthetic-only',supportType:'Home visit',paymentMethod:'online'};
 const read=async id=>{const row=await db.prepare('SELECT revision,snapshot_json FROM booking_transactions WHERE id=?').bind(id).first();return {...row,snapshot:JSON.parse(row.snapshot_json)}};
 const create=async(label,snapshot,reservation)=>{const id=`booking:qa-command-${runId}-${label}`;await commitBookingChange(db,{bookingId:id,expectedRevision:0,requestId:crypto.randomUUID(),snapshot,reservation,events:[]});ids.push(id);return id};
 const command=(bookingId,expectedRevision,kind,payload,patch={})=>executeBookingCommand({request,env:local,bookingId,expectedRevision,requestId:crypto.randomUUID(),kind,payload,now,...patch});
 const bookingId=await create('progress',base,{engineerId:operatorId,startMs:10000,endMs:20000});
 for(const [index,action] of ['accepted','en-route','arrived','in-progress'].entries())await command(bookingId,index+1,'engineer-job-transition',{action});
 assert((await read(bookingId)).snapshot.jobStatus==='in-progress','assigned-engineer-progress-sequence');
 await command(bookingId,5,'engineer-request-additional-time',{blocks:1});
 const quote=await loadCustomerAdditionalTimeRequest({request,env:local,bookingId,now});assert(quote.charge===30&&quote.minutes===30&&!JSON.stringify(quote).includes('entitlement'),'customer-quote-safe-projection');
 const blocker=await create('blocker',{...base,fixtureRole:'slot-blocker'},{engineerId:operatorId,startMs:20001,endMs:30000}),decisionId=crypto.randomUUID();
 let denied=false;try{await command(bookingId,6,'customer-decide-additional-time',{approvalId:quote.approvalId,decision:'approved'},{requestId:decisionId})}catch(error){denied=error.status===409}
 const blocked=await read(bookingId);assert(denied&&blocked.revision===6&&!blocked.snapshot.additionalAmount&&blocked.snapshot.pendingAdditionalTimeApproval===quote.approvalId,'overtime-slot-conflict-rolls-back-consumption');
 await commitBookingChange(db,{bookingId:blocker,expectedRevision:1,requestId:crypto.randomUUID(),snapshot:{...base,fixtureRole:'released-blocker'},reservation:null,events:[]});
 const approvals=await Promise.all([command(bookingId,6,'customer-decide-additional-time',{approvalId:quote.approvalId,decision:'approved'},{requestId:decisionId}),command(bookingId,6,'customer-decide-additional-time',{approvalId:quote.approvalId,decision:'approved'},{requestId:decisionId})]);
 const approved=await read(bookingId),slot=await db.prepare('SELECT end_ms FROM booking_slot_reservations WHERE booking_id=?').bind(bookingId).first();
 assert(approvals.filter(r=>r.reused).length===1&&approved.snapshot.additionalAmount===30&&approved.snapshot.additionalTime.length===1&&slot.end_ms===1820000,'overtime-approval-once-and-slot-extended');
 local.BOOKING_APPROVAL_LINK_KEYS=JSON.stringify({active:'synthetic-proof',keys:{'synthetic-proof':'A'.repeat(43)}});
 await command(bookingId,7,'engineer-request-additional-time',{blocks:1});
 const link=await issueBookingApprovalLink({request,env:local,bookingId,now}),linkQuote=await readBookingApprovalQuote({env:local,token:link.token,now});assert(linkQuote.charge===30&&linkQuote.minutes===30,'signed-link-quote-without-login');
 denied=false;try{await readBookingApprovalQuote({env:local,token:link.token+'!',now})}catch(error){denied=error.status===404}assert(denied,'tampered-signed-link-rejected');
 const linkId=crypto.randomUUID(),linkDecision=()=>command(bookingId,8,'customer-link-decide-additional-time',{decision:'declined'},{request:new Request('https://example.test'),approvalToken:link.token,requestId:linkId});
 const linkResults=await Promise.all([linkDecision(),linkDecision()]),afterLink=await read(bookingId);assert(linkResults.filter(row=>row.reused).length===1&&afterLink.snapshot.additionalAmount===30&&!afterLink.snapshot.pendingAdditionalTimeApproval,'signed-link-decline-once-without-extra-charge');
 await command(bookingId,9,'engineer-request-additional-time',{blocks:1});const manualId=(await read(bookingId)).snapshot.pendingAdditionalTimeApproval,consentId=crypto.randomUUID(),recordConsent=()=>command(bookingId,10,'engineer-record-additional-consent',{approvalId:manualId,method:'verbal',consentNote:'SYNTHETIC-CONSENT-PRIVATE',confirmed:true},{requestId:consentId});
 const recorded=await Promise.all([recordConsent(),recordConsent()]),consented=await read(bookingId);assert(recorded.filter(row=>row.reused).length===1&&consented.snapshot.additionalAmount===60,'recorded-consent-consumes-once');const consent=consented.snapshot.additionalTimeApprovals.at(-1).consent;assert(consent.recordedBy===operatorId&&consent.source==='engineer-record'&&consented.snapshot.additionalTime.at(-1).approvalMethod==='engineer-recorded-verbal','consent-identifies-actual-recorder-and-source');
 const safety=await command(bookingId,11,'report-booking-safety',{concernType:'Synthetic concern',severity:'high',description:'PRIVATE-QA-DESCRIPTION',immediateAction:'PRIVATE-QA-ACTION',currentlySafe:false,stopWork:true});
 const stopped=await read(bookingId);assert(stopped.snapshot.status==='safety-stopped'&&stopped.snapshot.paymentStatus==='review'&&!JSON.stringify(stopped.snapshot).includes('PRIVATE-QA'),'private-safety-stop-atomic-snapshot');
 const events=await db.prepare('SELECT payload_json FROM booking_outbox WHERE booking_id=?').bind(bookingId).all();assert(events.results.every(row=>!row.payload_json.includes('PRIVATE-QA')&&!row.payload_json.includes('SYNTHETIC-CONSENT-PRIVATE')),'private-report-absent-from-outbox');
 denied=false;try{await loadBookingSafetyCase({request,env:local,incidentId:safety.incidentId})}catch(error){denied=error.status===403}assert(denied,'reporter-cannot-read-restricted-case');
 sessions.set(adminKey,{role:'admin',operatorId:'qa-manager-'+runId,territoryIds:['elsewhere']});denied=false;try{await loadBookingSafetyCase({request,env:local,incidentId:safety.incidentId})}catch(error){denied=error.status===404}assert(denied,'case-territory-scope-enforced');
 sessions.set(adminKey,{role:'admin',operatorId:'qa-manager-'+runId,territoryIds:['andover']});
 const report=await loadBookingSafetyCase({request,env:local,incidentId:safety.incidentId});assert(report.report.description==='PRIVATE-QA-DESCRIPTION'&&report.revision===1,'restricted-case-readable-by-manager');
 const queue=await listBookingSafetyCases({request,env:local,limit:100});assert(queue.items.every(row=>!('report' in row)&&!('description' in row)),'case-queue-metadata-only');
 const reviewId=crypto.randomUUID(),review=patch=>reviewBookingSafetyCase({request,env:local,incidentId:safety.incidentId,expectedRevision:1,requestId:reviewId,changes:{status:'triaged',note:'Synthetic manager review'},...patch});
 const failingDb={prepare:db.prepare.bind(db),batch(statements){return db.batch([...statements,db.prepare('INSERT INTO booking_safety_reviews (id) VALUES (?)').bind('qa-invalid-'+runId)])}};
 denied=false;try{await review({env:{...local,VIPOAP_BOOKING_DB:failingDb}})}catch(error){denied=error.status===503}
 assert(denied&&(await loadBookingSafetyCase({request,env:local,incidentId:safety.incidentId})).revision===1,'review-audit-failure-rolls-back-case');
 const reviews=await Promise.all([review(),review()]);assert(reviews.filter(row=>row.reused).length===1,'concurrent-case-review-once');
 const history=await listBookingSafetyReviews({request,env:local,incidentId:safety.incidentId});assert(history.items.length===1&&history.items[0].actorId==='qa-manager-'+runId,'actual-manager-private-history');
 const afterReview=await read(bookingId);assert(afterReview.revision===12&&afterReview.snapshot.status==='safety-stopped'&&afterReview.snapshot.paymentStatus==='review','case-review-does-not-resume-or-charge');
 sessions.set(adminKey,admin);
 const declineId=await create('decline',base,{engineerId:operatorId,startMs:5000000,endMs:5100000});await command(declineId,1,'engineer-job-decline',{reason:'Synthetic decline'});
 const declined=await read(declineId);assert(!declined.snapshot.operatorId&&declined.snapshot.bookingStatus==='unfilled'&&!(await db.prepare('SELECT booking_id FROM booking_slot_reservations WHERE booking_id=?').bind(declineId).first()),'decline-releases-slot-atomically');
 const assignSnapshot={...base,date:'2030-11-04',time:'10:00',duration:60},interval=ukAppointmentInterval({date:assignSnapshot.date,time:assignSnapshot.time,durationMinutes:60});
 const assignId=await create('assignment',assignSnapshot,{engineerId:operatorId,startMs:interval.startMs,endMs:interval.endMs}),replacement='qa-replacement-'+runId;
 sessions.set('operator:'+replacement,{id:replacement,status:'active',territoryIds:['andover'],serviceTypes:['home'],trainingStatus:'complete',dbsStatus:'verified',photoStatus:'approved',agreementStatus:'signed',insuranceStatus:'verified',dbsRenewalDate:'2031-12-31',insuranceExpiryDate:'2031-12-31'});
 sessions.set('availability:andover:'+replacement,{homeVisitWeekly:{monday:[['09:00','17:00']]}});sessions.set(adminKey,{role:'admin',operatorId:'qa-manager-'+runId,territoryIds:['andover']});
 await command(assignId,1,'hq-assign-engineer',{operatorId:replacement});const assigned=await read(assignId),assignedSlot=await db.prepare('SELECT engineer_id FROM booking_slot_reservations WHERE booking_id=?').bind(assignId).first();assert(assigned.snapshot.operatorId===replacement&&assignedSlot.engineer_id===replacement&&assigned.snapshot.price===base.price,'hq-assignment-transfers-reservation');
 for(const id of ids){const row=await read(id);await commitBookingChange(db,{bookingId:id,expectedRevision:row.revision,requestId:crypto.randomUUID(),snapshot:{...row.snapshot,proof:'extended-commands-passed'},reservation:null,events:[]})}
 sessions.set(adminKey,admin);return ids;
}
