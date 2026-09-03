import {digest} from '../../../_shared/admin-auth.js';
import {takeRateLimit} from '../../../_shared/rate-limit.js';
export async function onRequestPost({request,env}){
  if(!env.VIPOAP_DATA)return Response.json({error:'Email login is not configured.'},{status:500});
  const client=request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();if(client){const rate=await takeRateLimit(env.VIPOAP_DATA,{scope:'admin-login-verify',identifier:client,limit:20,windowSeconds:3600});if(!rate.allowed)return new Response(JSON.stringify({error:'Too many code attempts. Please wait before trying again.'}),{status:429,headers:{'content-type':'application/json','retry-after':String(rate.retryAfter)}})}
  let body;try{body=await request.json()}catch{return Response.json({error:'Enter your email and six-digit code.'},{status:400})}
  const email=String(body.email||'admin@vipoap.co.uk').trim().toLowerCase(),code=String(body.code??'').replace(/\D/g,'').slice(0,6),key=`admin-login-code:${await digest(email)}`,record=await env.VIPOAP_DATA.get(key,'json');
  if(!record||code.length!==6||Date.now()-new Date(record.sentAt).getTime()>600000)return Response.json({error:'That code is invalid or has expired.'},{status:401});
  if((record.attempts||0)>=5)return Response.json({error:'Too many attempts. Request a new code.'},{status:429});
  if(await digest(`${record.salt}:${code}`)!==record.hash){await env.VIPOAP_DATA.put(key,JSON.stringify({...record,attempts:(record.attempts||0)+1}),{expirationTtl:600});return Response.json({error:'That code is invalid or has expired.'},{status:401})}
  const token=`vas_${crypto.randomUUID()}_${crypto.randomUUID()}`;
  await env.VIPOAP_DATA.put(`admin-session:${await digest(token)}`,JSON.stringify({createdAt:new Date().toISOString(),role:record.role||'operator',email:record.email||email,operatorId:record.operatorId,territoryIds:record.territoryIds||[]}),{expirationTtl:28800});
  await env.VIPOAP_DATA.delete(key);
  return Response.json({ok:true,token,expiresIn:28800,role:record.role||'operator',operatorId:record.operatorId,territoryIds:record.territoryIds||[],destination:['owner','admin'].includes(record.role)?'/admin/os':'/admin/'});
}
