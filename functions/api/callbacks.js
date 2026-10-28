import {applicationBody,applicationJson,hash} from '../_shared/applications.js';
const times=['Morning, 8am to 12pm','Afternoon, 12pm to 5pm','Evening, 5pm to 8pm'];
export async function onRequestPost({request,env}) {
  const origin=request.headers.get('origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')return applicationJson({error:'Please use the callback form on VIPOAP.'},403);
  if(!env.VIPOAP_DB)return applicationJson({error:'Callback requests are temporarily unavailable. Please call 07977 254158.'},503);
  if(!request.headers.get('content-type')?.includes('application/json'))return applicationJson({error:'Please use the callback form.'},415);
  try {
    const body=await applicationBody(request,'request');
    if(!body||typeof body!=='object'||Array.isArray(body)||body.website)return applicationJson({error:'Please check your callback details.'},400);
    const id=typeof body.requestId==='string'?body.requestId.toLowerCase():'';
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))return applicationJson({error:'Please refresh the callback form and try again.'},400);
    const values={};const errors={};
    for(const [key,max] of Object.entries({name:100,phone:40,bestTime:50,message:2000})) {
      values[key]=typeof body[key]==='string'?body[key].trim():'';
      if(values[key].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(values[key]))errors[key]=`Please use ${max} characters or fewer and remove unusual control characters.`;
    }
    if(!values.name)errors.name='Please add your name.';
    if(!/^[+()\d\s.-]{7,40}$/.test(values.phone)||values.phone.replace(/\D/g,'').length<7)errors.phone='Please check your telephone number.';
    if(!times.includes(values.bestTime))errors.bestTime='Please choose a preferred time.';
    if(Object.keys(errors).length)return applicationJson({error:'Please check the marked fields.',fields:errors},400);
    const fingerprint=await hash(JSON.stringify(values)),now=new Date(),timestamp=now.toISOString();
    const existing=await env.VIPOAP_DB.prepare('SELECT payload_hash,expires_at FROM callback_requests WHERE id=?').bind(id).first();
    if(existing&&existing.expires_at<=timestamp)return applicationJson({error:'That earlier request has expired. Please send a new callback request.'},410);
    if(existing&&existing.payload_hash!==fingerprint)return applicationJson({error:'Those details changed. Please send a new callback request.'},409);
    if(!existing) {
      const bucket=Math.floor(now.getTime()/3600000),rateKey=`callback:${bucket}:${await hash(request.headers.get('CF-Connecting-IP')||'unknown')}`;
      const rate=await env.VIPOAP_DB.prepare('INSERT INTO application_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(rateKey,now.getTime()+7200000).first();
      if(rate.count>6)return new Response(JSON.stringify({error:'Please wait before sending another request, or call 07977 254158.'}),{status:429,headers:{'content-type':'application/json','cache-control':'no-store','retry-after':String(Math.ceil(((bucket+1)*3600000-now.getTime())/1000))}});
      const expires=new Date(now.getTime()+365*86400000).toISOString();
      await env.VIPOAP_DB.prepare('INSERT INTO callback_requests (id,payload_hash,name,phone,best_time,message,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,fingerprint,values.name,values.phone,values.bestTime,values.message,timestamp,timestamp,expires).run();
      const saved=await env.VIPOAP_DB.prepare('SELECT payload_hash FROM callback_requests WHERE id=?').bind(id).first();
      if(!saved||saved.payload_hash!==fingerprint)return applicationJson({error:'Please start a new callback request.'},409);
    }
    // Callback records are reviewed in HQ; no third-party notification is sent.
    return applicationJson({ok:true,reference:`CALL-${id}`,message:'Your callback request has been saved. Your preferred time is a request, not a confirmed appointment.'},existing?200:201);
  } catch(error) {return applicationJson({error:error.status?error.message:'We could not save the request just now. Your details are still here. Please try again or call 07977 254158.'},error.status||503);}
}
