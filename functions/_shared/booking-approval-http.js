// Inactive adapter: no Functions route imports it. Preview-only until complete authority cutover.
import {readBookingApprovalQuote} from './booking-approval-links.js';
import {executeBookingCommand} from './booking-commands.js';
import {digest} from './admin-auth.js';
const headers={'cache-control':'no-store, private','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const reply=(body,status=200,extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
async function bodyOf(request){
 if(Number(request.headers.get('content-length'))>4096)throw Object.assign(Error(),{status:413});
 const reader=request.body?.getReader();if(!reader)throw Object.assign(Error(),{status:400});let size=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw Object.assign(Error(),{status:413})}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch(error){throw Object.assign(Error(),{status:error.status===413?413:400})}
}
async function limited(db,scope,identifier,limit){const now=Date.now(),bucket=Math.floor(now/60000),key=scope+':'+bucket+':'+await digest(identifier);const row=await db.prepare('INSERT INTO booking_approval_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=MIN(count+1,?) RETURNING count').bind(key,(bucket+1)*60000+60000,limit+1).first();if(!row||!Number.isInteger(row.count))throw Error();return row.count<=limit}
export async function handleBookingApproval({request,env}){
 const url=new URL(request.url);
 if(env.BOOKING_APPROVAL_HTTP_MODE!=='preview'||url.protocol!=='https:'||!url.hostname.endsWith('.pages.dev')||!env.VIPOAP_BOOKING_DB)return reply({error:'Approval service unavailable.'},404);
 if(request.method!=='POST')return reply({error:'Use a secure approval request.'},405,{allow:'POST'});
 if(request.headers.get('origin')!==url.origin||!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reply({error:'Invalid approval request.'},403);
 let body;try{body=await bodyOf(request)}catch(error){return reply({error:'Please check the approval request.'},error.status)}
 if(!body||Object.getPrototypeOf(body)!==Object.prototype||typeof body.token!=='string'||!body.token||body.token.length>2000||!['quote','decide'].includes(body.action)||Object.keys(body).sort().join(',')!==(body.action==='quote'?'action,token':'action,decision,expectedRevision,requestId,token'))return reply({error:'Please check the approval request.'},400);
 const ip=request.headers.get('cf-connecting-ip');if(!ip)return reply({error:'Approval service unavailable.'},503);
 try{
  if(!await limited(env.VIPOAP_BOOKING_DB,'approval-ip',ip,60)||!await limited(env.VIPOAP_BOOKING_DB,'approval-token',body.token,20))return reply({error:'Please wait a minute before trying again.'},429,{'retry-after':'60'});
  if(body.action==='quote')return reply(await readBookingApprovalQuote({env,token:body.token}));
  const result=await executeBookingCommand({request,env,kind:'customer-link-decide-additional-time',approvalToken:body.token,expectedRevision:body.expectedRevision,requestId:body.requestId,payload:{decision:body.decision}});
  return reply({ok:true,status:body.decision,revision:result.revision,reused:result.reused});
 }catch(error){const status=[400,401,403,404,409,413].includes(error.status)?error.status:503;return reply({error:status===404?'This approval link is invalid or has expired.':status===409?'This request changed or needs review. Please contact VIPOAP.':status===400?'Please check the approval response.':'We could not confirm your response. Retry the same response.'},status)}
}
