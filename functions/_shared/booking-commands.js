// Inactive command adapters. No live route calls these staged mutations.
import {loadAdminBooking,loadCustomerBooking} from './booking-access.js';
import {commitBookingChange} from './booking-transactions.js';
const failure=(message,status)=>Object.assign(new Error(message),{status});
const requestPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');}
function fields(payload,allowed){return payload&&Object.getPrototypeOf(payload)===Object.prototype&&Object.keys(payload).every(key=>allowed.includes(key));}
function text(value,max){if(typeof value!=='string'||value.length>max)throw failure('Please check the booking change.',400);return value.trim().replace(/[<>]/g,'');}
function normalize(kind,payload){
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
  if(!['set-admin-note','customer-appointment-request'].includes(kind))throw failure('Unsupported booking change.',400);
  const booking=kind==='set-admin-note'?await loadAdminBooking({request,env,bookingId,permission:'manage_calls'}):await loadCustomerBooking({request,env,bookingId});
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision>=Number.MAX_SAFE_INTEGER||typeof requestId!=='string'||!requestPattern.test(requestId)||typeof now!=='string'||!Number.isFinite(Date.parse(now)))throw failure('A valid booking revision and unique request are required.',400);
  const input=normalize(kind,payload),id=requestId.toLowerCase(),context=booking.context;
  const actor=kind==='set-admin-note'?['admin',context.role,context.operatorId,context.email]:['customer',context.customerId];
  const metadata={version:1,actor:await hash(actor),kind,inputHash:await hash({bookingId,expectedRevision,kind,payload:input})},db=env.VIPOAP_BOOKING_DB;
  const prior=await receipt(db,{requestId:id,bookingId,metadata});if(prior)return prior;
  if(booking.revision!==expectedRevision)throw failure('This booking changed. Refresh before trying again.',409);
  const snapshot=booking.snapshot,timestamp=new Date(now).toISOString();let patch,events;
  if(kind==='set-admin-note'){
    patch={adminNotes:input.note};events=[{kind:'booking-admin-note-recorded',payload:{bookingId,requestId:id,actor:metadata.actor}}];
  }else{
    const closed=['completed','cancelled','declined','in-progress','safety-stopped','awaiting-final-settlement','partially-resolved','unresolved','follow-up-booked'];
    if([snapshot.status,snapshot.bookingStatus,snapshot.jobStatus].some(state=>closed.includes(state))||['refunded','refund-pending'].includes(snapshot.paymentStatus))throw failure('This appointment can no longer be changed online. Please contact VIPOAP.',409);
    if(snapshot.customerRequestStatus==='received')throw failure('A change request is already being reviewed.',409);
    const reference=`REQ-${id}`;patch={customerRequestStatus:'received',customerRequestType:input.requestType,customerRequestDetails:input.details,customerRequestReference:reference,customerRequestAt:timestamp};
    events=[{kind:'customer-appointment-requested',payload:{bookingId,requestId:id,requestType:input.requestType,reference}}];
  }
  try{return await commitBookingChange(db,{bookingId,expectedRevision,requestId:id,snapshot:{...snapshot,...patch,updatedAt:timestamp},events,commandMetadata:metadata});}
  catch(error){
    // Concurrent identical commands may build different server timestamps. Their
    // durable command identity, rather than the timestamp, determines replay.
    if(error.status===409){const committed=await receipt(db,{requestId:id,bookingId,metadata});if(committed)return committed;}
    throw error;
  }
}
