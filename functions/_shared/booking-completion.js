// Inactive completion planner. A settlement request is not a provider checkout or delivered email.
import {validPaymentMethod} from './booking-state.js';
const fail=message=>Object.assign(new Error(message),{status:409});
function pence(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0||!Number.isSafeInteger(Math.round(value*100))||Math.abs(value*100-Math.round(value*100))>0.000001)throw fail('This appointment needs a payment review.');return Math.round(value*100)}
export async function planBookingCompletion({env,bookingId,snapshot,operatorId,requestId,outcome,serviceSummary,internalNotes,now}){
 if(snapshot.jobStatus!=='in-progress'||[snapshot.status,snapshot.bookingStatus].some(state=>['cancelled','declined','completed','safety-stopped','awaiting-final-settlement','partially-resolved','unresolved','follow-up-booked'].includes(state))||!['prepaid','paid','cash-selected','cash-due','cash-collected','membership-entitled','additional-payment-due'].includes(snapshot.paymentStatus))throw fail('This appointment needs review before completion.');
 if((snapshot.operatorId||snapshot.assignedEngineerId)!==operatorId||[snapshot.operatorId,snapshot.assignedEngineerId,snapshot.assignedProviderId].some(id=>id&&id!==operatorId))throw fail('This appointment assignment needs review.');
 if(!['Home visit','Remote support'].includes(snapshot.supportType)||!validPaymentMethod(snapshot.supportType,snapshot.paymentMethod)||(snapshot.additionalTime!==undefined&&!Array.isArray(snapshot.additionalTime))||(snapshot.additionalTimeApprovals!==undefined&&!Array.isArray(snapshot.additionalTimeApprovals)))throw fail('This appointment record needs review before completion.');
 const amountPence=pence(snapshot.additionalAmount??0),entitlement=snapshot.providerAdditionalEntitlementPence??0;
 if(!Number.isSafeInteger(entitlement)||entitlement<0)throw fail('This appointment entitlement needs review.');
 const slot=await env.VIPOAP_BOOKING_DB.prepare('SELECT engineer_id,start_ms,end_ms FROM booking_slot_reservations WHERE booking_id=?').bind(bookingId).first();
 if(!slot||slot.engineer_id!==operatorId||!Number.isSafeInteger(slot.start_ms)||!Number.isSafeInteger(slot.end_ms)||slot.end_ms<=slot.start_ms)throw fail('This appointment reservation needs review.');
 const due=snapshot.paymentStatus==='additional-payment-due';
 if(due&&(amountPence<1||snapshot.paymentMethod==='cash'||snapshot.finalPaymentId||snapshot.finalPaymentUrl||snapshot.finalSettlementIntentId||snapshot.finalSettlementStatus))throw fail('The existing final payment needs reconciliation before completion.');
 if(due){let existing;try{existing=await env.VIPOAP_BOOKING_DB.prepare("SELECT id FROM booking_checkout_intents WHERE booking_id=? AND purpose='additional-time'").bind(bookingId).first()}catch{throw Object.assign(new Error('Checkout intent storage is unavailable.'),{status:503})}if(existing)throw fail('The existing final payment needs reconciliation before completion.')}
 if(due){
  const entries=snapshot.additionalTime||[],approvals=snapshot.additionalTimeApprovals||[],seen=new Set();let charges=0,entitlements=0;
  if(!entries.length)throw fail('Approved additional-time evidence needs reconciliation.');
  for(const entry of entries){
   if(!entry||typeof entry.approvalId!=='string'||seen.has(entry.approvalId)||!['customer-account','customer-link','engineer-recorded-verbal','engineer-recorded-written'].includes(entry.approvalMethod)||!Number.isInteger(entry.blocks)||entry.blocks<1||entry.blocks>6||entry.minutes!==entry.blocks*30||!Number.isFinite(Date.parse(entry.approvedAt))||Date.parse(entry.approvedAt)>Date.parse(now))throw fail('Approved additional-time evidence needs reconciliation.');
   const matches=approvals.filter(item=>item&&item.id===entry.approvalId&&item.status==='approved'),charge=pence(entry.charge);if(matches.length!==1)throw fail('Approved additional-time evidence needs reconciliation.');const approval=matches[0];
   if(approval.chargePence!==charge||approval.blocks!==entry.blocks||approval.minutes!==entry.minutes||approval.respondedAt!==entry.approvedAt||!Number.isSafeInteger(approval.entitlementPence)||approval.entitlementPence<0)throw fail('Approved additional-time evidence needs reconciliation.');
   if(entry.approvalMethod.startsWith('engineer-recorded-')&&(!approval.consent||approval.consent.source!=='engineer-record'||approval.consent.method!==entry.approvalMethod.slice('engineer-recorded-'.length)||approval.consent.recordedBy!==approval.operatorId))throw fail('Recorded consent evidence needs reconciliation.');
   seen.add(entry.approvalId);charges+=charge;entitlements+=approval.entitlementPence;
  }
  if(!Number.isSafeInteger(charges)||!Number.isSafeInteger(entitlements)||charges!==amountPence||entitlements!==entitlement)throw fail('The additional charge and consent records need reconciliation.');
 }
 const patch={status:'completed',bookingStatus:due?'awaiting-final-settlement':'completed',jobStatus:outcome,outcome,serviceSummary,internalNotes,completedAt:now,followUpRequired:outcome!=='completed',...(snapshot.paymentStatus==='cash-selected'?{paymentStatus:'cash-due'}:{})};
 const pending=snapshot.pendingAdditionalTimeRequest;
 if(pending||snapshot.pendingAdditionalTimeApproval){
  if(!pending||pending.id!==snapshot.pendingAdditionalTimeApproval||pending.status!=='pending'||!Number.isFinite(Date.parse(pending.expiresAt)))throw fail('The outstanding additional-time request needs review.');
  Object.assign(patch,{pendingAdditionalTimeApproval:'',pendingAdditionalTimeRequest:null,additionalTimeApprovals:[...(snapshot.additionalTimeApprovals||[]),{...pending,status:Date.parse(pending.expiresAt)<=Date.parse(now)?'expired':'cancelled-at-completion',respondedAt:now}]});
 }
 const events=[{kind:'engineer-job-completed',payload:{bookingId,outcome,followUpRequired:outcome!=='completed'}}];let checkoutIntent;
 if(due){checkoutIntent={id:'checkout-intent:'+requestId,purpose:'additional-time',amountPence,currency:'GBP'};Object.assign(patch,{finalSettlementIntentId:checkoutIntent.id,finalSettlementStatus:'requested',finalSettlementAmountPence:amountPence});events.push({kind:'booking-final-settlement-requested',payload:{bookingId,intentId:checkoutIntent.id,amountPence,currency:'GBP'}})}
 return {patch,events,reservation:null,checkoutIntent};
}
