import {digest} from '../../../_shared/admin-auth.js';
function clean(value,max=150){return String(value??'').trim().toLowerCase().replace(/[<>]/g,'').slice(0,max)}
export async function onRequestPost({request,env}){
  const body=await request.json(),email=clean(body.email),code=String(body.code||'').trim(),key=`customer-login-code:${await digest(email)}`,pending=await env.VIPOAP_DATA.get(key,'json');
  if(!pending||pending.attempts>=5||new Date(pending.expiresAt)<=new Date())return Response.json({error:'This code is invalid or has expired.'},{status:401});
  if(await digest(`${pending.salt}:${code}`)!==pending.hash){await env.VIPOAP_DATA.put(key,JSON.stringify({...pending,attempts:pending.attempts+1}),{expirationTtl:600});return Response.json({error:'This code is invalid or has expired.'},{status:401})}
  const token=`vcs_${crypto.randomUUID().replaceAll('-','')}`,now=new Date(),session={customerId:pending.customerId,email,createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+30*86400000).toISOString()};await env.VIPOAP_DATA.put(`customer-session:${await digest(token)}`,JSON.stringify(session),{expirationTtl:30*86400});await env.VIPOAP_DATA.delete(key);return Response.json({ok:true,token,expiresAt:session.expiresAt});
}

