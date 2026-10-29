// Inactive command adapters. No live route calls these staged mutations.
import {loadAdminBooking,loadCustomerBooking} from './booking-access.js';
import {commitBookingChange} from './booking-transactions.js';
const failure=(message,status)=>Object.assign(new Error(message),{status});
const requestPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');}
function fields(payload,allowed){return payload&&Object.getPrototypeOf(payload)===Object.prototype&&Object.keys(payload).every(key=>allowed.includes(key));}
function text(value,max){if(typeof value!=='string'||value.length>max)throw failure('Please check the booking change.',400);return value.trim().replace(/[<>]/g,'');}
function normalize(kind,payload){
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
  if(!['set-admin-note','customer-appointment-request','engineer-job-transition','engineer-job-decline'].includes(kind))throw failure('Unsupported booking change.',400);
  const staffCommand=kind!=='customer-appointment-request';
  const booking=staffCommand?await loadAdminBooking({request,env,bookingId,permission:'manage_calls'}):await loadCustomerBooking({request,env,bookingId});
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision>=Number.MAX_SAFE_INTEGER||typeof requestId!=='string'||!requestPattern.test(requestId)||typeof now!=='string'||!Number.isFinite(Date.parse(now)))throw failure('A valid booking revision and unique request are required.',400);
  if(kind.startsWith('engineer-job-')&&booking.context.role!=='operator')throw failure('An assigned engineer session is required.',403);
  const input=normalize(kind,payload),id=requestId.toLowerCase(),context=booking.context;
  const actor=staffCommand?['admin',context.role,context.operatorId,context.email]:['customer',context.customerId];
  const metadata={version:1,actor:await hash(actor),kind,inputHash:await hash({bookingId,expectedRevision,kind,payload:input})},db=env.VIPOAP_BOOKING_DB;
  const prior=await receipt(db,{requestId:id,bookingId,metadata});if(prior)return prior;
  if(booking.revision!==expectedRevision)throw failure('This booking changed. Refresh before trying again.',409);
  const snapshot=booking.snapshot,timestamp=new Date(now).toISOString();let patch,events,reservation;
  if(kind==='set-admin-note'){
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
  try{return await commitBookingChange(db,{bookingId,expectedRevision,requestId:id,snapshot:{...snapshot,...patch,updatedAt:timestamp},events,...(reservation===null?{reservation:null}:{}),commandMetadata:metadata});}
  catch(error){
    // Concurrent identical commands may build different server timestamps. Their
    // durable command identity, rather than the timestamp, determines replay.
    if(error.status===409){const committed=await receipt(db,{requestId:id,bookingId,metadata});if(committed)return committed;}
    throw error;
  }
}
