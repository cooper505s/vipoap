import {planAdditionalTimeRequest,planAdditionalTimeDecision} from './booking-additional-time.js';
import {planEngineerAssignment} from './booking-assignment.js';
// Inactive command adapters. No live route calls these staged mutations.
import {loadAdminBooking,loadCustomerBooking} from './booking-access.js';
import {commitBookingChange} from './booking-transactions.js';
const failure=(message,status)=>Object.assign(new Error(message),{status});
const requestPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');}
function fields(payload,allowed){return payload&&Object.getPrototypeOf(payload)===Object.prototype&&Object.keys(payload).every(key=>allowed.includes(key));}
function text(value,max){if(typeof value!=='string'||value.length>max)throw failure('Please check the booking change.',400);return value.trim().replace(/[<>]/g,'');}
function normalize(kind,payload){
  if(kind==='engineer-request-additional-time'){if(!fields(payload,['blocks'])||!Number.isInteger(payload.blocks)||payload.blocks<1||payload.blocks>6)throw failure('Choose between one and six additional half-hours.',400);return{blocks:payload.blocks}}
  if(kind==='customer-decide-additional-time'){if(!fields(payload,['approvalId','decision'])||typeof payload.approvalId!=='string'||!/^additional-time-request:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(payload.approvalId)||!['approved','declined'].includes(payload.decision))throw failure('Choose a valid additional-time response.',400);return{approvalId:payload.approvalId,decision:payload.decision}}
  if(kind==='report-booking-safety'){
    if(!fields(payload,['concernType','severity','description','immediateAction','currentlySafe','stopWork'])||!['critical','high','medium','low'].includes(payload.severity)||typeof payload.currentlySafe!=='boolean'||typeof payload.stopWork!=='boolean')throw failure('Please check the safety report.',400);
    const concernType=text(payload.concernType,80),description=text(payload.description,2000),immediateAction=text(payload.immediateAction??'',2000);if(!concernType||!description)throw failure('Concern type and description are required.',400);
    return{concernType,severity:payload.severity,description,immediateAction,currentlySafe:payload.currentlySafe,stopWork:payload.stopWork};
  }
  if(kind==='hq-assign-engineer'){if(!fields(payload,['operatorId'])||typeof payload.operatorId!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(payload.operatorId))throw failure('Choose a valid engineer.',400);return{operatorId:payload.operatorId}}
  if(kind==='engineer-job-decline'){if(!fields(payload,['reason']))throw failure('Please check the decline reason.',400);return{reason:text(payload.reason??'',500)}}
  if(kind==='engineer-job-transition'){
    if(!fields(payload,['action'])||!['accepted','en-route','arrived','in-progress'].includes(payload.action))throw failure('Choose a valid engineer action.',400);
    return{action:payload.action};
  }
  if(kind==='set-admin-note'){
    if(!fields(payload,['note']))throw failure('Please check the booking note.',400);
    return{note:text(payload.note,1500)};
  }
  if(!fields(payload,['requestType','details'])||!['change','cancel'].includes(payload.requestType))throw failure('Choose a valid appointment request.',400);
  const details=text(payload.details??'',800);
  if(payload.requestType==='change'&&details.length<3)throw failure('Please tell us which date or time would suit you.',400);
  return{requestType:payload.requestType,details};
}
async function receipt(db,{requestId,bookingId,metadata}){
  let prior;try{prior=await db.prepare('SELECT booking_id,revision,command_json FROM booking_mutations WHERE id=?').bind(requestId).first();}catch{throw failure('Booking command storage is unavailable.',503);}
  if(!prior)return null;
  let saved;try{saved=JSON.parse(prior.command_json);}catch{throw failure('This request was already used for another booking change.',409);}
  if(prior.booking_id!==bookingId||!Number.isSafeInteger(prior.revision)||prior.revision<1||!saved||saved.version!==metadata.version||saved.actor!==metadata.actor||saved.kind!==metadata.kind||saved.inputHash!==metadata.inputHash)throw failure('This request was already used for another booking change.',409);
  return{bookingId,revision:prior.revision,reused:true};
}
export async function executeBookingCommand({request,env,bookingId,expectedRevision,requestId,kind,payload,now=new Date().toISOString()}){
  if(!['set-admin-note','customer-appointment-request','engineer-job-transition','engineer-job-decline','hq-assign-engineer','report-booking-safety','engineer-request-additional-time','customer-decide-additional-time'].includes(kind))throw failure('Unsupported booking change.',400);
  const staffCommand=!['customer-appointment-request','customer-decide-additional-time'].includes(kind);
  const booking=staffCommand?await loadAdminBooking({request,env,bookingId,permission:kind==='hq-assign-engineer'?'manage_operations':kind==='report-booking-safety'?'report_incidents':'manage_calls'}):await loadCustomerBooking({request,env,bookingId});
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision>=Number.MAX_SAFE_INTEGER||typeof requestId!=='string'||!requestPattern.test(requestId)||typeof now!=='string'||!Number.isFinite(Date.parse(now)))throw failure('A valid booking revision and unique request are required.',400);
  if((kind.startsWith('engineer-job-')||kind==='engineer-request-additional-time')&&booking.context.role!=='operator')throw failure('An assigned engineer session is required.',403);
  if(kind==='hq-assign-engineer'&&booking.context.role==='operator')throw failure('HQ assignment access is required.',403);
  const input=normalize(kind,payload),id=requestId.toLowerCase(),context=booking.context;
  const actor=staffCommand?['admin',context.role,context.operatorId,context.email]:['customer',context.customerId];
  const metadata={version:1,actor:await hash(actor),kind,inputHash:await hash({bookingId,expectedRevision,kind,payload:input})},db=env.VIPOAP_BOOKING_DB;
  const result=output=>kind==='report-booking-safety'?{...output,incidentId:'incident:'+id,reference:'SAFE-'+id.toUpperCase()}:output;
  const prior=await receipt(db,{requestId:id,bookingId,metadata});if(prior)return result(prior);
  if(booking.revision!==expectedRevision)throw failure('This booking changed. Refresh before trying again.',409);
  const snapshot=booking.snapshot,timestamp=new Date(now).toISOString();let patch,events,reservation,safetyCase;
  if(kind==='engineer-request-additional-time'||kind==='customer-decide-additional-time'){
    const planned=kind==='engineer-request-additional-time'?await planAdditionalTimeRequest({env,snapshot,requestId:id,operatorId:context.operatorId,blocks:input.blocks,now:timestamp}):await planAdditionalTimeDecision({env,bookingId,snapshot,...input,now:timestamp});
    patch=planned.patch;reservation=planned.reservation;events=planned.events.map(event=>({...event,payload:{...event.payload,bookingId,requestId:id,actor:metadata.actor}}));
  }else if(kind==='report-booking-safety'){
    if(typeof snapshot.territoryId!=='string'||!snapshot.territoryId||snapshot.territoryId.length>80)throw failure('This appointment needs a verified territory before reporting.',409);
    if(context.role==='operator'&&[snapshot.operatorId,snapshot.assignedEngineerId].some(value=>value&&value!==context.operatorId))throw failure('Booking not found.',404);
    if(input.stopWork&&([snapshot.status,snapshot.bookingStatus,snapshot.jobStatus].some(state=>['completed','cancelled','declined','safety-stopped','awaiting-final-settlement','partially-resolved','unresolved','follow-up-booked'].includes(state))||['refunded','refund-pending'].includes(snapshot.paymentStatus)))throw failure('This appointment has already ended or needs payment review. Submit a report without stopping work.',409);
    const incidentId='incident:'+id,priorState=Object.fromEntries(['status','bookingStatus','jobStatus','paymentStatus'].map(key=>[key,snapshot[key]??null]));
    safetyCase={id:incidentId,territoryId:snapshot.territoryId,reporterHash:metadata.actor,report:{...input,reporterId:context.operatorId,reference:'SAFE-'+id.toUpperCase(),priorState,createdAt:timestamp}};
    patch={latestSafetyIncidentKey:incidentId,...(input.stopWork?{status:'safety-stopped',bookingStatus:'safety-stopped',jobStatus:'safety-stopped',paymentStatus:'review',safetyIncidentKey:incidentId}:{})};
    events=[{kind:'booking-safety-reported',payload:{bookingId,requestId:id,incidentId,stopWork:input.stopWork,actor:metadata.actor}}];
  }else if(kind==='hq-assign-engineer'){const assignment=await planEngineerAssignment({env,booking,operatorId:input.operatorId,now:timestamp});patch=assignment.patch;events=assignment.events.map(event=>({...event,payload:{...event.payload,requestId:id,actor:metadata.actor}}));reservation=assignment.reservation;
  }else if(kind==='set-admin-note'){
    patch={adminNotes:input.note};events=[{kind:'booking-admin-note-recorded',payload:{bookingId,requestId:id,actor:metadata.actor}}];
  }else if(kind==='engineer-job-transition'){
    const closed=['completed','cancelled','declined','safety-stopped','awaiting-final-settlement','partially-resolved','unresolved','follow-up-booked'];
    if([snapshot.status,snapshot.bookingStatus,snapshot.jobStatus].some(state=>closed.includes(state))||['refunded','refund-pending'].includes(snapshot.paymentStatus))throw failure('This appointment cannot progress. Please contact VIPOAP.',409);
    const transitions={pending:'accepted',accepted:'en-route','en-route':'arrived',arrived:'in-progress'};
    if(transitions[snapshot.jobStatus]!==input.action)throw failure('Refresh this appointment before changing its progress.',409);
    if([snapshot.operatorId,snapshot.assignedEngineerId].some(value=>value&&value!==context.operatorId))throw failure('Booking not found.',404);
    const timestampField={accepted:'acceptedAt','en-route':'enRouteAt',arrived:'arrivedAt','in-progress':'startedAt'}[input.action];
    patch={jobStatus:input.action,[timestampField]:timestamp,...(input.action==='accepted'?{assignedEngineerId:context.operatorId}:{})};
    events=[{kind:'engineer-job-progressed',payload:{bookingId,requestId:id,action:input.action,actor:metadata.actor}}];
  }else if(kind==='engineer-job-decline'){
    const closed=['completed','cancelled','declined','in-progress','safety-stopped','awaiting-final-settlement','partially-resolved','unresolved','follow-up-booked'];
    if([snapshot.status,snapshot.bookingStatus,snapshot.jobStatus].some(state=>closed.includes(state))||['refunded','refund-pending'].includes(snapshot.paymentStatus)||!['pending','accepted','en-route','arrived'].includes(snapshot.jobStatus))throw failure('This job can no longer be declined. Please contact VIPOAP.',409);
    if([snapshot.operatorId,snapshot.assignedEngineerId,snapshot.assignedProviderId].some(value=>value&&value!==context.operatorId))throw failure('Booking not found.',404);
    if(snapshot.assignmentHistory!==undefined&&!Array.isArray(snapshot.assignmentHistory))throw failure('This assignment needs review before it can be changed.',409);
    patch={operatorId:'',assignedEngineerId:'',assignedProviderId:'',status:'pending',bookingStatus:'unfilled',jobStatus:'pending',assignmentNotificationSent:false,unfilledAt:timestamp,assignmentHistory:[...(snapshot.assignmentHistory||[]),{operatorId:context.operatorId,action:'declined',at:timestamp,reason:input.reason}]};
    reservation=null;events=[{kind:'engineer-assignment-declined',payload:{bookingId,requestId:id,previousEngineerId:context.operatorId,actor:metadata.actor}}];
  }else{
    const closed=['completed','cancelled','declined','in-progress','safety-stopped','awaiting-final-settlement','partially-resolved','unresolved','follow-up-booked'];
    if([snapshot.status,snapshot.bookingStatus,snapshot.jobStatus].some(state=>closed.includes(state))||['refunded','refund-pending'].includes(snapshot.paymentStatus))throw failure('This appointment can no longer be changed online. Please contact VIPOAP.',409);
    if(snapshot.customerRequestStatus==='received')throw failure('A change request is already being reviewed.',409);
    const reference=`REQ-${id}`;patch={customerRequestStatus:'received',customerRequestType:input.requestType,customerRequestDetails:input.details,customerRequestReference:reference,customerRequestAt:timestamp};
    events=[{kind:'customer-appointment-requested',payload:{bookingId,requestId:id,requestType:input.requestType,reference}}];
  }
  try{return result(await commitBookingChange(db,{bookingId,expectedRevision,requestId:id,snapshot:{...snapshot,...patch,updatedAt:timestamp},events,...(reservation===undefined?{}:{reservation}),commandMetadata:metadata,...(safetyCase===undefined?{}:{safetyCase})}));}
  catch(error){
    // Concurrent identical commands may build different server timestamps. Their
    // durable command identity, rather than the timestamp, determines replay.
    if(error.status===409){const committed=await receipt(db,{requestId:id,bookingId,metadata});if(committed)return result(committed);}
    throw error;
  }
}
