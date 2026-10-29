// Inactive signed bearer transport. No provider, secret provisioning or live endpoint is connected.
import {loadAdminBooking,readBooking} from './booking-access.js';
import {digest} from './admin-auth.js';
import {projectAdditionalTimeQuote} from './booking-additional-time.js';
const fail=(message,status)=>Object.assign(new Error(message),{status});
const invalid=()=>fail('This approval link is invalid or has expired.',404);
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const idPattern=/^additional-time-request:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function encode(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decode(value){if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value))throw invalid();let bytes;try{bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0))}catch{throw invalid()}if(encode(bytes)!==value)throw invalid();return bytes}
function keys(env){try{const config=JSON.parse(env.BOOKING_APPROVAL_LINK_KEYS);if(!config||typeof config.active!=='string'||!config.keys||Object.getPrototypeOf(config.keys)!==Object.prototype||Object.keys(config.keys).length<1||Object.keys(config.keys).length>10||!Object.hasOwn(config.keys,config.active))throw Error();for(const [id,value]of Object.entries(config.keys))if(!/^[A-Za-z0-9_-]{1,32}$/.test(id)||decode(value).length!==32)throw Error();return config}catch{throw fail('Secure approval links are not configured.',503)}}
const keyFor=(config,id)=>crypto.subtle.importKey('raw',decode(config.keys[id]),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const message=(kid,body)=>encoder.encode('vipoap/additional-time/v1\0'+kid+'\0'+body);
const quoteHash=approval=>digest(JSON.stringify([approval.id,approval.operatorId,approval.blocks,approval.minutes,approval.chargePence,approval.entitlementPence,approval.createdAt,approval.expiresAt]));
export async function issueBookingApprovalLink({request,env,bookingId,now=new Date().toISOString()}){
 const booking=await loadAdminBooking({request,env,bookingId}),quote=projectAdditionalTimeQuote(booking,now),approval=booking.snapshot.pendingAdditionalTimeRequest;
 if(booking.context.role==='operator'&&approval.operatorId!==booking.context.operatorId)throw fail('Booking not found.',404);
 if(typeof booking.snapshot.customerId!=='string'||!booking.snapshot.customerId.startsWith('customer:'))throw fail('This approval needs a verified customer.',409);
 const config=keys(env),kid=config.active,claims={bookingId,approvalId:quote.approvalId,expiresAt:quote.expiresAt,customerHash:await digest(booking.snapshot.customerId),quoteHash:await quoteHash(approval)},body=encode(encoder.encode(JSON.stringify(claims)));
 const signature=await crypto.subtle.sign('HMAC',await keyFor(config,kid),message(kid,body));
 return {token:'v1.'+kid+'.'+body+'.'+encode(new Uint8Array(signature)),expiresAt:quote.expiresAt};
}
export async function loadBookingApprovalLink({env,token,bookingId,now=new Date().toISOString(),allowConsumed=false}){
 if(typeof token!=='string'||token.length>2000)throw invalid();const parts=token.split('.');
 if(parts.length!==4||parts[0]!=='v1'||!/^[A-Za-z0-9_-]{1,32}$/.test(parts[1]))throw invalid();
 const config=keys(env),[,kid,body,signature]=parts;if(!Object.hasOwn(config.keys,kid))throw invalid();
 let claims;try{claims=JSON.parse(decoder.decode(decode(body)))}catch{throw invalid()}
 if(!claims||Object.getPrototypeOf(claims)!==Object.prototype||Object.keys(claims).sort().join(',')!=='approvalId,bookingId,customerHash,expiresAt,quoteHash'||typeof claims.bookingId!=='string'||!claims.bookingId.startsWith('booking:')||claims.bookingId.length>160||typeof claims.approvalId!=='string'||!idPattern.test(claims.approvalId)||typeof claims.customerHash!=='string'||!/^[a-f0-9]{64}$/.test(claims.customerHash)||typeof claims.quoteHash!=='string'||!/^[a-f0-9]{64}$/.test(claims.quoteHash)||typeof claims.expiresAt!=='string'||!Number.isFinite(Date.parse(claims.expiresAt))||!Number.isFinite(Date.parse(now))||Date.parse(claims.expiresAt)<=Date.parse(now)||(bookingId!==undefined&&bookingId!==claims.bookingId))throw invalid();
 const bytes=decode(signature);if(bytes.length!==32||!await crypto.subtle.verify('HMAC',await keyFor(config,kid),bytes,message(kid,body)))throw invalid();
 const booking=await readBooking(env,claims.bookingId),snapshot=booking.snapshot;
 if(typeof snapshot.customerId!=='string'||await digest(snapshot.customerId)!==claims.customerHash)throw invalid();
 let approval=snapshot.pendingAdditionalTimeRequest;
 if(!approval||approval.id!==claims.approvalId||snapshot.pendingAdditionalTimeApproval!==claims.approvalId||approval.status!=='pending')approval=allowConsumed&&Array.isArray(snapshot.additionalTimeApprovals)?snapshot.additionalTimeApprovals.find(item=>item&&item.id===claims.approvalId&&['approved','declined'].includes(item.status)):null;
 if(!approval||approval.expiresAt!==claims.expiresAt||await quoteHash(approval)!==claims.quoteHash)throw invalid();
 return {...booking,context:{approvalId:claims.approvalId,customerHash:claims.customerHash}};
}
export async function readBookingApprovalQuote({env,token,now=new Date().toISOString()}){
 const booking=await loadBookingApprovalLink({env,token,now});return projectAdditionalTimeQuote(booking,now);
}
