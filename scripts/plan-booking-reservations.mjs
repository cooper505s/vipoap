// Offline review only. Never imports data or writes reservations.
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {inspectBookingExport} from './inspect-booking-export.mjs';
import {ukAppointmentInterval} from '../functions/_shared/booking-time.js';
const closed=new Set(['completed','cancelled','declined','safety-stopped','awaiting-final-settlement','partially-resolved','unresolved','follow-up-booked']);
const active=new Set(['draft','pending','slot-held','requested','confirmed','unfilled','accepted','en-route','arrived','in-progress']);
const payments=new Set(['none','payment-required','pending','prepaid','paid','cash-selected','cash-due','cash-collected','membership-entitled','additional-payment-due','refund-pending','refunded','review','failed']);
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function planBookingReservations(input){
 const inventory=inspectBookingExport(input),asOf=Date.parse(input.exportedAt),records=new Map(input.records.map(item=>[item.key,item.value])),references=new Map(),items=[];
 const jsonRecord=key=>{try{const value=JSON.parse(records.get(key));return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}};
 for(const entry of inventory.bookings){
  const record=JSON.parse(records.get(entry.key)),issues=[...entry.issues],states=[record.status,record.bookingStatus,record.jobStatus].filter(Boolean);let interval=null;
  if(states.some(state=>!closed.has(state)&&!active.has(state)))issues.push('unknown-state');
  if(record.paymentStatus&&!payments.has(record.paymentStatus))issues.push('unknown-payment-state');
  const extras=record.additionalTime??[];let extraMinutes=0;
  if(!Array.isArray(extras)||extras.some(item=>!item||!Number.isSafeInteger(item.minutes)||item.minutes<1||item.minutes>180))issues.push('invalid-additional-time');else extraMinutes=extras.reduce((total,item)=>total+item.minutes,0);
  try{interval=ukAppointmentInterval({date:record.date,time:record.time,durationMinutes:record.duration+extraMinutes})}catch{if(!issues.includes('invalid-wall-time'))issues.push('invalid-reservation-interval')}
  const aliases=[record.operatorId,record.assignedEngineerId,record.assignedProviderId].filter(value=>value!==undefined&&value!==null&&value!=='');
  if(aliases.some(value=>typeof value!=='string')||new Set(aliases).size>1)issues.push('conflicting-engineer-aliases');
  if(typeof record.reference==='string'&&record.reference){const keys=references.get(record.reference)||[];keys.push(entry.key);references.set(record.reference,keys)}
  const future=interval&&interval.endMs>asOf,terminal=states.some(state=>closed.has(state))||['refunded','refund-pending'].includes(record.paymentStatus);let disposition='historical';
  if(record.jobStatus==='in-progress'){issues.push('active-work-requires-review');disposition='review'}
  else if(future&&terminal){issues.push('future-closed-work-requires-review');disposition='review'}
  else if(future){
   disposition='candidate';
   if(!aliases.length)issues.push('unassigned-future-work');
   if(typeof record.customerId!=='string'||!record.customerId.startsWith('customer:')||!jsonRecord(record.customerId))issues.push('missing-customer-record');
   if(typeof record.territoryId!=='string'||!record.territoryId)issues.push('missing-territory');
   if(aliases.length&&typeof aliases[0]==='string'){
    let operator;try{operator=JSON.parse(records.get('operator:'+aliases[0]))}catch{}
    if(!operator||operator.status!=='active')issues.push('missing-or-inactive-engineer');
    else if(!Array.isArray(operator.territoryIds)||!operator.territoryIds.some(id=>id==='*'||id===record.territoryId))issues.push('engineer-territory-mismatch');
   }
   if(!record.paymentStatus||['none','failed','review','additional-payment-due'].includes(record.paymentStatus))issues.push('payment-state-requires-review');
   if(['payment-required','pending'].includes(record.paymentStatus)){const expires=Date.parse(record.holdExpiresAt);if(!Number.isFinite(expires)||expires<=asOf)issues.push('expired-or-invalid-payment-hold')}
   if(record.pendingAdditionalTimeApproval)issues.push('pending-additional-time-review');
   if(states.includes('unfilled')||states.includes('draft'))issues.push('unready-booking-state');
  }
  if(interval&&interval.endMs<=asOf&&!terminal&&record.jobStatus!=='in-progress'){issues.push('past-unfinished-work-requires-review');disposition='review'}
  items.push({key:entry.key,sourceHash:entry.sourceHash,disposition,issues,interval:future&&aliases.length&&typeof aliases[0]==='string'?{engineerId:aliases[0],startMs:interval.startMs,endMs:interval.endMs}:null});
 }
 const byKey=new Map(items.map(item=>[item.key,item]));for(const keys of references.values())if(keys.length>1)for(const key of keys)byKey.get(key).issues.push('duplicate-booking-reference');
 const groups=new Map();for(const item of items)if(item.interval&&item.disposition==='candidate'){const group=groups.get(item.interval.engineerId)||[];group.push(item);groups.set(item.interval.engineerId,group)}
 const overlapGroups=[];
 for(const [engineerId,group] of groups){group.sort((a,b)=>a.interval.startMs-b.interval.startMs||(a.key<b.key?-1:a.key>b.key?1:0));let cluster=[],end=-Infinity;const flush=()=>{if(cluster.length>1){const keys=cluster.map(item=>item.key);overlapGroups.push({engineerId,keys});for(const item of cluster)item.issues.push('overlapping-reservations')}};for(const item of group){if(item.interval.startMs>=end){flush();cluster=[];end=-Infinity}cluster.push(item);end=Math.max(end,item.interval.endMs)}flush()}
 const bookings=items.map(item=>({key:item.key,sourceHash:item.sourceHash,disposition:item.issues.length?'review':item.disposition,issues:[...new Set(item.issues)].sort(),proposedReservation:item.interval}));
 const reservations=bookings.filter(item=>item.disposition==='candidate').map(item=>({bookingId:item.key,...item.proposedReservation,requiresEligibilityReview:true}));
 const result={version:1,dryRun:true,cutoverReady:false,source:inventory.source,asOf:input.exportedAt,exportHash:inventory.exportHash,bookingCount:bookings.length,reviewCount:bookings.filter(item=>item.disposition==='review').length,reservations,overlapGroups,bookings};
 return {...result,planHash:digest(result)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3||statSync(process.argv[2]).size>104857600)throw Error();const result=planBookingReservations(JSON.parse(readFileSync(process.argv[2],'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n')}
 catch{process.stderr.write('Reservation planning failed. Use a complete, valid private export file.\n');process.exitCode=1}
}
