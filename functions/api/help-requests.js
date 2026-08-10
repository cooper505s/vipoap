import {takeRateLimit} from '../_shared/rate-limit.js';
import {ensureCustomer} from '../_shared/customers.js';

const clean=(value,max=1000)=>String(value??'').trim().replace(/[<>]/g,'').slice(0,max);
const emailOk=value=>!value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicStatuses={received:'We have received your request.',looking:'Your local VIPOAP team is looking at this.',information:'We need a little more information.',arranged:'A visit has been arranged.',completed:'This has been completed.'};
const token=()=>[...crypto.getRandomValues(new Uint8Array(24))].map(value=>value.toString(16).padStart(2,'0')).join('');
const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(value=>value.toString(16).padStart(2,'0')).join('');
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

async function createReference(env){
  const date=new Date().toISOString().slice(5,10).replace('-','');
  for(let attempt=0;attempt<20;attempt++){
    const suffix=String(crypto.getRandomValues(new Uint16Array(1))[0]%10000).padStart(4,'0'),reference=`HELP-${date}${suffix}`;
    if(!await env.VIPOAP_DATA.get(`help-reference:${reference}`))return reference;
  }
  throw new Error('Could not create a help reference.');
}

async function notify(env,{to,subject,html,key}){
  if(!to||!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL)return false;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':key},body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:[to],subject,html})});
  return response.ok;
}

async function authorisedRecord(request,env){
  const url=new URL(request.url),accessToken=clean(url.searchParams.get('access')||request.headers.get('x-help-access'),100);
  if(!accessToken)return null;
  const key=await env.VIPOAP_DATA.get(`help-access:${await digest(accessToken)}`);
  if(!key)return null;
  const record=await env.VIPOAP_DATA.get(key,'json');
  return record?{key,record}:null;
}

export async function onRequestGet({request,env}){
  if(!env.VIPOAP_DATA)return Response.json({error:'Help requests are temporarily unavailable.'},{status:503});
  const found=await authorisedRecord(request,env);if(!found)return Response.json({error:'This private help link is invalid or has expired.'},{status:404});
  const {reference,status='received',messages=[],createdAt,updatedAt}=found.record;
  return Response.json({reference,status,statusLabel:publicStatuses[status]||publicStatuses.received,messages:messages.map(({author,text,createdAt})=>({author,text,createdAt})),createdAt,updatedAt});
}

export async function onRequestPost({request,env}){
  if(!env.VIPOAP_DATA)return Response.json({error:'Help requests are temporarily unavailable. Please call 07977 254158.'},{status:503});
  let body;try{body=await request.json()}catch{return Response.json({error:'Please check the request and try again.'},{status:400})}
  const ip=request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const rate=await takeRateLimit(env.VIPOAP_DATA,{scope:'public-help',identifier:ip,limit:8,windowSeconds:3600});
  if(!rate.allowed)return new Response(JSON.stringify({error:'Too many requests have been sent. Please wait, or call 07977 254158.'}),{status:429,headers:{'content-type':'application/json','retry-after':String(rate.retryAfter)}});
  const existing=await authorisedRecord(request,env);
  if(existing){
    const text=clean(body.message,1500);if(!text)return Response.json({error:'Please add your message.'},{status:400});
    const now=new Date().toISOString(),messages=[...(existing.record.messages||[]),{author:'customer',text,createdAt:now}];
    await env.VIPOAP_DATA.put(existing.key,JSON.stringify({...existing.record,status:'received',messages,updatedAt:now}));
    await notify(env,{to:'help@vipoap.co.uk',subject:`Customer reply — ${existing.record.reference}`,html:`<h2>New reply to ${escapeHtml(existing.record.reference)}</h2><p>${escapeHtml(text)}</p>`,key:`${existing.record.reference}-customer-${messages.length}`});
    return Response.json({ok:true,status:'received',statusLabel:publicStatuses.received});
  }
  const requestData={name:clean(body.name,100),email:clean(body.email,120),phone:clean(body.phone,40),contactPreference:clean(body.contactPreference,20),category:clean(body.category,30),description:clean(body.description,2000),postcode:clean(body.postcode,20),territoryId:clean(body.territoryId||'andover',60)};
  if(!requestData.name||(!requestData.email&&!requestData.phone)||!['Email','Phone','SMS','WhatsApp'].includes(requestData.contactPreference)||!requestData.description||!emailOk(requestData.email))return Response.json({error:'Please tell us what is happening and how we can contact you.'},{status:400});
  const reference=await createReference(env),accessToken=token(),now=new Date().toISOString(),key=`help-request:${now.slice(0,10)}:${reference}`;
  const customer=await ensureCustomer(env,requestData),record={...requestData,customerId:customer?.key||'',reference,status:'received',messages:[{author:'customer',text:requestData.description,createdAt:now}],createdAt:now,updatedAt:now};
  await env.VIPOAP_DATA.put(key,JSON.stringify(record));
  await env.VIPOAP_DATA.put(`help-reference:${reference}`,key);
  await env.VIPOAP_DATA.put(`help-access:${await digest(accessToken)}`,key,{expirationTtl:60*60*24*365});
  const statusUrl=`${new URL(request.url).origin}/help.html?access=${accessToken}`;
  await Promise.allSettled([
    notify(env,{to:'help@vipoap.co.uk',subject:`New VIPOAP help request ${reference}`,html:`<h2>${escapeHtml(reference)}</h2><p><strong>${escapeHtml(requestData.name)}</strong> prefers ${escapeHtml(requestData.contactPreference)}.</p><p>${escapeHtml(requestData.description)}</p>`,key:`${reference}-hq`}),
    notify(env,{to:requestData.email,subject:`We received your VIPOAP help request ${reference}`,html:`<h2>We have received your request</h2><p>Your reference is <strong>${escapeHtml(reference)}</strong>.</p><p>Keep this private link to see updates or send another message:</p><p><a href="${escapeHtml(statusUrl)}">View my help request</a></p><p>If anything feels unsafe or urgent, stop and call 999 where appropriate.</p>`,key:`${reference}-customer`})
  ]);
  return Response.json({ok:true,reference,status:'received',statusLabel:publicStatuses.received,statusUrl});
}
