import {applicationBody,applicationJson,applicationReference,hash,notifyApplication,pruneApplications,validateApplication,APPLICATION_RETENTION_DAYS} from '../_shared/applications.js';

export async function onRequestPost({request,env,waitUntil}) {
  const origin=request.headers.get('origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')return applicationJson({error:'Please send the application from the VIPOAP website.',code:'origin'},403);
  if(!env.VIPOAP_DB)return applicationJson({error:'Applications are temporarily unavailable. Please call 07977 254158.',code:'unavailable'},503);
  if(!request.headers.get('content-type')?.includes('application/json'))return applicationJson({error:'Please use the VIPOAP application form.',code:'content_type'},415);
  try {
    const body=await applicationBody(request);
    if(!body||typeof body!=='object'||Array.isArray(body))return applicationJson({error:'Please complete the application.',code:'validation'},400);
    if(body.website)return applicationJson({error:'We could not accept this application. Please call 07977 254158.',code:'validation'},400);
    const id=typeof body.requestId==='string'?body.requestId.toLowerCase():body.requestId;
    if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))return applicationJson({error:'Please refresh the form and try again.',code:'request_id'},400);
    const {values,errors}=validateApplication(body);
    if(Object.keys(errors).length)return applicationJson({error:'Please check the marked fields.',fields:errors,code:'validation'},400);
    const fingerprint=await hash(JSON.stringify(values));
    const existing=await env.VIPOAP_DB.prepare('SELECT payload_hash,expires_at FROM engineer_applications WHERE id=?').bind(id).first();
    if(existing&&existing.expires_at<=new Date().toISOString())return applicationJson({error:'That earlier application has expired. Please send a new application.',code:'expired'},410);
    if(existing&&existing.payload_hash!==fingerprint)return applicationJson({error:'These details have changed. Please start a new application.',code:'conflict'},409);
    if(!existing) {
      const now=Date.now(),bucket=Math.floor(now/3600000),ip=request.headers.get('CF-Connecting-IP')||'unknown';
      const rateKey=`${bucket}:${await hash(ip)}`;
      const rate=await env.VIPOAP_DB.prepare(`INSERT INTO application_rate_limits (key,count,expires_at) VALUES (?,1,?)
        ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`).bind(rateKey,now+7200000).first();
      if(rate.count>6)return new Response(JSON.stringify({error:'Please wait before sending another application, or call 07977 254158.',code:'rate_limit'}),{status:429,headers:{'content-type':'application/json','cache-control':'no-store','retry-after':String(Math.ceil(((bucket+1)*3600000-now)/1000))}});
      const createdAt=new Date(now).toISOString(),expiresAt=new Date(now+APPLICATION_RETENTION_DAYS*86400000).toISOString();
      await env.VIPOAP_DB.prepare(`INSERT INTO engineer_applications
        (id,payload_hash,name,email,phone,area,experience,availability,skills,motivation,created_at,updated_at,expires_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(id,fingerprint,...Object.values(values),createdAt,createdAt,expiresAt).run();
      const saved=await env.VIPOAP_DB.prepare('SELECT payload_hash FROM engineer_applications WHERE id=?').bind(id).first();
      if(!saved||saved.payload_hash!==fingerprint)return applicationJson({error:'This application reference is already in use. Please try a new application.',code:'conflict'},409);
    }
    // Accepted means durably stored, not email delivered or engineer approved.
    const notification=Promise.allSettled([notifyApplication(env,id),pruneApplications(env.VIPOAP_DB)]);
    if(waitUntil)waitUntil(notification);else await notification;
    return applicationJson({ok:true,reference:applicationReference(id),message:'Your application has been saved. We will contact you to discuss the next steps.'},existing?200:201);
  } catch(error) {
    return applicationJson({error:error.status?error.message:'We could not save your application just now. Your details are still here. Please try again or call 07977 254158.',code:error.status?'request':'storage'},error.status||503);
  }
}
