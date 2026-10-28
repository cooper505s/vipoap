// Staged authenticated readers. No live route imports this adapter yet.
import {adminContext,canAccessTerritory} from './admin-auth.js';
import {hasPermission} from './permissions.js';
import {requireCustomer} from './customer-auth.js';
const fail=(message,status)=>Object.assign(new Error(message),{status});
async function readBooking(env,bookingId){
  if(typeof bookingId!=='string'||!bookingId.startsWith('booking:')||bookingId.length>160)throw fail('Booking not found.',404);
  if(!env.VIPOAP_BOOKING_DB)throw fail('Transactional booking storage is unavailable.',503);
  const row=await env.VIPOAP_BOOKING_DB.prepare('SELECT snapshot_json,revision FROM booking_transactions WHERE id=?').bind(bookingId).first();
  if(!row)throw fail('Booking not found.',404);
  let snapshot;try{snapshot=JSON.parse(row.snapshot_json)}catch{throw fail('Booking storage could not be read.',503)}
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||!Number.isSafeInteger(row.revision)||row.revision<1)throw fail('Booking storage could not be read.',503);
  return{bookingId,snapshot,revision:row.revision};
}
export async function loadAdminBooking({request,env,bookingId,permission='manage_calls'}){
  if(!['manage_calls','manage_operations','manage_billing','report_incidents'].includes(permission))throw fail('Unsupported booking permission.',400);
  const context=await adminContext(request,env);
  if(!hasPermission(context,permission))throw fail('Booking access required.',403);
  const booking=await readBooking(env,bookingId),snapshot=booking.snapshot;
  if(!canAccessTerritory(context,snapshot.territoryId||'andover')||(context.role==='operator'&&(snapshot.operatorId||snapshot.assignedEngineerId)!==context.operatorId))throw fail('Booking not found.',404);
  return{...booking,context};
}
export async function loadCustomerBooking({request,env,bookingId}){
  const context=await requireCustomer(request,env),expires=Date.parse(context?.expiresAt);
  if(!context||typeof context.customerId!=='string'||!context.customerId.startsWith('customer:')||!Number.isFinite(expires)||expires<=Date.now())throw fail('Please sign in.',401);
  const booking=await readBooking(env,bookingId);
  if(booking.snapshot.customerId!==context.customerId)throw fail('Booking not found.',404);
  return{...booking,context};
}
