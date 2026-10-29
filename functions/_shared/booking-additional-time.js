// Inactive session-authenticated approval planner. Link delivery/legacy token adapters remain separate.
import {loadCustomerBooking} from './booking-access.js';
import {platformRules} from './platform-rules.js';
import {canAddAdditionalTime,validPaymentMethod} from './booking-state.js';
const fail=message=>Object.assign(new Error(message),{status:409});
function pence(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0||!Number.isSafeInteger(Math.round(value*100))||Math.abs(value*100-Math.round(value*100))>0.000001)throw fail('This appointment needs a pricing review.');return Math.round(value*100)}
function history(snapshot){if(snapshot.additionalTimeApprovals!==undefined&&!Array.isArray(snapshot.additionalTimeApprovals))throw fail('This approval history needs review.');return snapshot.additionalTimeApprovals||[]}
function active(snapshot){if(!canAddAdditionalTime(snapshot)||[snapshot.status,snapshot.bookingStatus,snapshot.jobStatus].some(state=>['partially-resolved','unresolved','follow-up-booked'].includes(state))||snapshot.paymentStatus==='review')throw fail('Additional time requires an active appointment without a safety or payment review.');if(!['Home visit','Remote support'].includes(snapshot.supportType)||!validPaymentMethod(snapshot.supportType,snapshot.paymentMethod))throw fail('This appointment needs a verified service.');}
export async function planAdditionalTimeRequest({env,snapshot,requestId,operatorId,blocks,now}){
 active(snapshot);
 if(!operatorId||[snapshot.operatorId,snapshot.assignedEngineerId,snapshot.assignedProviderId].some(id=>id&&id!==operatorId))throw fail('This appointment assignment needs review.');
 const prior=history(snapshot),pending=snapshot.pendingAdditionalTimeRequest;
 if(snapshot.pendingAdditionalTimeApproval&&!pending)throw fail('An existing approval needs review before requesting more time.');
 if(pending&&(!Number.isFinite(Date.parse(pending.expiresAt))||Date.parse(pending.expiresAt)>Date.parse(now)))throw fail('An additional-time request is already awaiting a response.');
 const rules=await platformRules(env),remote=snapshot.supportType==='Remote support',chargePence=pence(remote?rules.prices.remoteAdditional30:rules.prices.homeAdditional30)*blocks,entitlementPence=pence(remote?rules.engineerEntitlements.remoteAdditional30:rules.engineerEntitlements.homeAdditional30)*blocks;
 if(!Number.isSafeInteger(chargePence)||!Number.isSafeInteger(entitlementPence))throw fail('This appointment needs a pricing review.');
 const approval={id:'additional-time-request:'+requestId,operatorId,blocks,minutes:blocks*30,chargePence,entitlementPence,createdAt:now,expiresAt:new Date(Date.parse(now)+3600000).toISOString(),status:'pending'};
 return {patch:{pendingAdditionalTimeApproval:approval.id,pendingAdditionalTimeRequest:approval,additionalTimeApprovals:pending?[...prior,{...pending,status:'expired',respondedAt:now}]:prior},events:[{kind:'booking-additional-time-requested',payload:{approvalId:approval.id,blocks}}]};
}
export async function planAdditionalTimeDecision({env,bookingId,snapshot,approvalId,decision,now,approvalMethod='customer-account'}){
 active(snapshot);const approval=snapshot.pendingAdditionalTimeRequest;
 if(!approval||approval.id!==approvalId||snapshot.pendingAdditionalTimeApproval!==approvalId||approval.status!=='pending'||!Number.isFinite(Date.parse(approval.expiresAt))||Date.parse(approval.expiresAt)<=Date.parse(now))throw fail('This approval request is no longer current or has expired.');
 if(!Number.isInteger(approval.blocks)||approval.blocks<1||approval.blocks>6||approval.minutes!==approval.blocks*30||!Number.isSafeInteger(approval.chargePence)||approval.chargePence<0||!Number.isSafeInteger(approval.entitlementPence)||approval.entitlementPence<0||!approval.operatorId||(snapshot.operatorId||snapshot.assignedEngineerId)!==approval.operatorId||[snapshot.operatorId,snapshot.assignedEngineerId,snapshot.assignedProviderId].some(id=>id&&id!==approval.operatorId))throw fail('This additional-time request needs review.');
 const patch={pendingAdditionalTimeApproval:'',pendingAdditionalTimeRequest:null,additionalTimeApprovals:[...history(snapshot),{...approval,status:decision,respondedAt:now}]};
 let reservation;
 if(decision==='approved'){
  if(snapshot.additionalTime!==undefined&&!Array.isArray(snapshot.additionalTime))throw fail('This appointment needs an additional-time review.');
  const current=pence(snapshot.additionalAmount??0),entitlement=snapshot.providerAdditionalEntitlementPence??0;
  if(!Number.isSafeInteger(entitlement)||entitlement<0||!Number.isSafeInteger(current+approval.chargePence)||!Number.isSafeInteger(entitlement+approval.entitlementPence))throw fail('This appointment needs an entitlement review.');
  const slot=await env.VIPOAP_BOOKING_DB.prepare('SELECT engineer_id,start_ms,end_ms FROM booking_slot_reservations WHERE booking_id=?').bind(bookingId).first();
  if(!slot||slot.engineer_id!==approval.operatorId||!Number.isSafeInteger(slot.start_ms)||!Number.isSafeInteger(slot.end_ms)||slot.end_ms<=slot.start_ms||!Number.isSafeInteger(slot.end_ms+approval.minutes*60000))throw fail('This appointment reservation needs review.');
  reservation={engineerId:slot.engineer_id,startMs:slot.start_ms,endMs:slot.end_ms+approval.minutes*60000};
  Object.assign(patch,{additionalTime:[...(snapshot.additionalTime||[]),{approvalId,blocks:approval.blocks,minutes:approval.minutes,charge:approval.chargePence/100,approvalMethod,approvedAt:now}],additionalAmount:(current+approval.chargePence)/100,providerAdditionalEntitlementPence:entitlement+approval.entitlementPence,paymentStatus:snapshot.paymentMethod==='cash'?'cash-due':'additional-payment-due'});
 }
 return {patch,reservation,events:[{kind:'booking-additional-time-decided',payload:{approvalId,decision}}]};
}

export async function loadCustomerAdditionalTimeRequest({request,env,bookingId,now=new Date().toISOString()}){
 const booking=await loadCustomerBooking({request,env,bookingId});return projectAdditionalTimeQuote(booking,now);
}
export function projectAdditionalTimeQuote(booking,now){
 const approval=booking.snapshot.pendingAdditionalTimeRequest;
 active(booking.snapshot);
 if(!approval||approval.status!=='pending'||approval.id!==booking.snapshot.pendingAdditionalTimeApproval||!Number.isFinite(Date.parse(approval.expiresAt))||Date.parse(approval.expiresAt)<=Date.parse(now)||!Number.isInteger(approval.minutes)||!Number.isSafeInteger(approval.chargePence)||approval.chargePence<0)throw fail('This approval request is no longer current or has expired.');
 return {bookingId:booking.bookingId,revision:booking.revision,approvalId:approval.id,reference:booking.snapshot.reference,minutes:approval.minutes,charge:approval.chargePence/100,expiresAt:approval.expiresAt,status:'pending'};
}
