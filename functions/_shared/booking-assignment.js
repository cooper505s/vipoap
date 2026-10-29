// Inactive assignment planning for the shared transaction coordinator.
// Eligibility is read from legacy KV; coordinated eligibility changes remain a cutover gate.
import {operatorCanReceiveWork} from './compliance.js';
import {ukAppointmentInterval} from './booking-time.js';
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const validDate=value=>{try{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value}catch{return false}};
const validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function scheduleRanges(availability,day,service){
 let ranges;
 if(availability.weeklyBlocks!==undefined){
  if(!availability.weeklyBlocks||typeof availability.weeklyBlocks!=='object'||Array.isArray(availability.weeklyBlocks))throw fail('The engineer schedule needs review.');
  const blocks=availability.weeklyBlocks[day]??[];
  if(!Array.isArray(blocks)||blocks.some(block=>!block||!validTime(block.start)||!validTime(block.end)||block.start>=block.end||!Array.isArray(block.services)||!block.services.length||block.services.some(value=>!['home','remote'].includes(value))))throw fail('The engineer schedule needs review.');
  ranges=blocks.filter(block=>block.services.includes(service)).map(block=>[block.start,block.end]);
 }else{
  const weekly=(service==='remote'?availability.remoteWeekly:availability.homeVisitWeekly)??{};
  if(typeof weekly!=='object'||Array.isArray(weekly))throw fail('The engineer schedule needs review.');
  ranges=weekly[day]??[];
 }
 if(!Array.isArray(ranges)||ranges.some(range=>!Array.isArray(range)||range.length!==2||!validTime(range[0])||!validTime(range[1])||range[0]>=range[1]))throw fail('The engineer schedule needs review.');
 return ranges;
}
const closed=['completed','cancelled','declined','in-progress','safety-stopped','awaiting-final-settlement','partially-resolved','unresolved','follow-up-booked'];
export async function planEngineerAssignment({env,booking,operatorId,now}){
 const snapshot=booking.snapshot,territory=snapshot.territoryId;
 if([snapshot.status,snapshot.bookingStatus,snapshot.jobStatus].some(state=>closed.includes(state))||['refunded','refund-pending'].includes(snapshot.paymentStatus))throw fail('This job cannot be reassigned in its current state.');
 if(typeof territory!=='string'||!territory||!['Home visit','Remote support'].includes(snapshot.supportType))throw fail('This appointment needs review before assignment.');
 const interval=ukAppointmentInterval({date:snapshot.date,time:snapshot.time,durationMinutes:snapshot.duration});
 const aliases=[snapshot.operatorId,snapshot.assignedEngineerId,snapshot.assignedProviderId].filter(Boolean);
 if(new Set(aliases).size>1)throw fail('This assignment needs review before it can be changed.');
 const current=await env.VIPOAP_BOOKING_DB.prepare('SELECT engineer_id,start_ms,end_ms FROM booking_slot_reservations WHERE booking_id=?').bind(booking.bookingId).first();
 if(aliases.length?(!current||current.engineer_id!==aliases[0]||current.start_ms!==interval.startMs||current.end_ms!==interval.endMs):Boolean(current))throw fail('The booking reservation needs review.');
 if(aliases[0]===operatorId)return {patch:{},events:[]};
 if(interval.startMs<=Date.parse(now)||snapshot.pendingAdditionalTimeApproval||(snapshot.additionalTime!==undefined&&(!Array.isArray(snapshot.additionalTime)||snapshot.additionalTime.length)))throw fail('This appointment needs review before reassignment.');
 const operator=await env.VIPOAP_DATA.get('operator:'+operatorId,'json'),service=snapshot.supportType==='Remote support'?'remote':'home';
 if(!operator||typeof operator!=='object'||!Array.isArray(operator.territoryIds)||(operator.serviceTypes!==undefined&&!Array.isArray(operator.serviceTypes))||operator.id!==operatorId||!(operator.territoryIds||[]).some(id=>id==='*'||id===territory)||!(operator.serviceTypes||['home','remote']).includes(service)||!operatorCanReceiveWork(operator,new Date(now),service)||!operatorCanReceiveWork(operator,new Date(snapshot.date+'T12:00:00Z'),service)||['dbsRenewalDate','insuranceExpiryDate'].some(field=>operator[field]!==undefined&&operator[field]!==''&&!validDate(operator[field])))throw fail('Choose an eligible engineer for this service and territory.');
 const availability=await env.VIPOAP_DATA.get(`availability:${territory}:${operatorId}`,'json');
 if(!availability||typeof availability!=='object'||Array.isArray(availability)||(availability.blockedDates!==undefined&&(!Array.isArray(availability.blockedDates)||availability.blockedDates.some(date=>!validDate(date))))||(availability.overrides!==undefined&&(!Array.isArray(availability.overrides)||availability.overrides.some(item=>!item||!validDate(item.date)||!['blocked','available'].includes(item.status)))))throw fail('The engineer schedule needs review.');
 if((availability.blockedDates||[]).includes(snapshot.date)||(availability.overrides||[]).some(item=>item.date===snapshot.date&&item.status==='blocked'))throw fail('The engineer is unavailable on this date.');
 const day=days[new Date(snapshot.date+'T12:00:00Z').getUTCDay()],ranges=scheduleRanges(availability,day,service);
 const scheduled=ranges.some(range=>{try{const start=ukAppointmentInterval({date:snapshot.date,time:range[0],durationMinutes:1}).startMs,end=ukAppointmentInterval({date:snapshot.date,time:range[1],durationMinutes:1}).startMs;return interval.startMs>=start&&interval.endMs<=end}catch{return false}});
 if(!scheduled)throw fail('The engineer is not working throughout this appointment.');
 if(snapshot.assignmentHistory!==undefined&&!Array.isArray(snapshot.assignmentHistory))throw fail('The assignment history needs review.');
 const previousProgress=Object.fromEntries(['jobStatus','acceptedAt','enRouteAt','arrivedAt','startedAt'].filter(key=>snapshot[key]!==undefined).map(key=>[key,snapshot[key]]));
 return {reservation:{engineerId:operatorId,startMs:interval.startMs,endMs:interval.endMs},patch:{operatorId,assignedProviderId:operatorId,assignedEngineerId:'',jobStatus:'pending',acceptedAt:'',enRouteAt:'',arrivedAt:'',startedAt:'',status:'pending',bookingStatus:'requested',unfilledAt:'',assignmentNotificationQueued:false,assignmentNotificationSent:false,assignmentHistory:[...(snapshot.assignmentHistory||[]),{operatorId,previousEngineerId:aliases[0]||'',previousProgress,action:'manual-assignment',at:now,by:booking.context.operatorId||booking.context.email||'hq'}]},events:[{kind:'booking-engineer-assigned',payload:{bookingId:booking.bookingId,engineerId:operatorId,previousEngineerId:aliases[0]||''}}]};
}
