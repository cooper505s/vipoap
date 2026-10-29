// Inactive assignment planning for the shared transaction coordinator.
// Eligibility is read from legacy KV; coordinated eligibility changes remain a cutover gate.
import {operatorCanReceiveWork} from './compliance.js';
import {ukAppointmentInterval} from './booking-time.js';
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
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
 if(!operator||typeof operator!=='object'||!Array.isArray(operator.territoryIds)||(operator.serviceTypes!==undefined&&!Array.isArray(operator.serviceTypes))||operator.id!==operatorId||!(operator.territoryIds||[]).some(id=>id==='*'||id===territory)||!(operator.serviceTypes||['home','remote']).includes(service)||!operatorCanReceiveWork(operator,new Date(now),service))throw fail('Choose an eligible engineer for this service and territory.');
 const availability=await env.VIPOAP_DATA.get(`availability:${territory}:${operatorId}`,'json');
 if(!availability||typeof availability!=='object'||(availability.blockedDates!==undefined&&!Array.isArray(availability.blockedDates))||(availability.overrides!==undefined&&!Array.isArray(availability.overrides))||(availability.blockedDates||[]).includes(snapshot.date)||(availability.overrides||[]).some(item=>item.date===snapshot.date&&item.status==='blocked'))throw fail('The engineer is unavailable on this date.');
 const day=days[new Date(snapshot.date+'T12:00:00Z').getUTCDay()],ranges=availability.weeklyBlocks?.[day]?.filter(item=>item.services?.includes(service)).map(item=>[item.start,item.end])??(service==='remote'?availability.remoteWeekly:availability.homeVisitWeekly)?.[day]??[];
 const scheduled=ranges.some(range=>{try{const start=ukAppointmentInterval({date:snapshot.date,time:range[0],durationMinutes:1}).startMs,end=ukAppointmentInterval({date:snapshot.date,time:range[1],durationMinutes:1}).startMs;return interval.startMs>=start&&interval.endMs<=end}catch{return false}});
 if(!scheduled)throw fail('The engineer is not working throughout this appointment.');
 if(snapshot.assignmentHistory!==undefined&&!Array.isArray(snapshot.assignmentHistory))throw fail('The assignment history needs review.');
 const previousProgress=Object.fromEntries(['jobStatus','acceptedAt','enRouteAt','arrivedAt','startedAt'].filter(key=>snapshot[key]!==undefined).map(key=>[key,snapshot[key]]));
 return {reservation:{engineerId:operatorId,startMs:interval.startMs,endMs:interval.endMs},patch:{operatorId,assignedProviderId:operatorId,assignedEngineerId:'',jobStatus:'pending',acceptedAt:'',enRouteAt:'',arrivedAt:'',startedAt:'',status:'pending',bookingStatus:'requested',unfilledAt:'',assignmentNotificationQueued:false,assignmentNotificationSent:false,assignmentHistory:[...(snapshot.assignmentHistory||[]),{operatorId,previousEngineerId:aliases[0]||'',previousProgress,action:'manual-assignment',at:now,by:booking.context.operatorId||booking.context.email||'hq'}]},events:[{kind:'booking-engineer-assigned',payload:{bookingId:booking.bookingId,engineerId:operatorId,previousEngineerId:aliases[0]||''}}]};
}
