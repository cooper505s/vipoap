import {digest} from '../../../_shared/admin-auth.js';
import {takeRateLimit} from '../../../_shared/rate-limit.js';

const OWNER_EMAIL='admin@vipoap.co.uk';
async function operatorForEmail(env,email){
  if(email===OWNER_EMAIL)return{email,operatorId:env.DEFAULT_OPERATOR_ID||'dan-stevens',role:'owner',territoryIds:['*']};
  let cursor;
  do{
    const page=await env.VIPOAP_DATA.list({prefix:'operator:',cursor});
    for(const key of page.keys){
      const operator=await env.VIPOAP_DATA.get(key.name,'json');
      if(operator?.email?.trim().toLowerCase()===email&&['active','invited'].includes(operator.status||'active'))return{email,operatorId:operator.id||key.name.slice(9),role:operator.role||'operator',territoryIds:operator.territoryIds?.length?operator.territoryIds:[operator.territoryId||'andover']};
    }
    cursor=page.list_complete?undefined:page.cursor;
  }while(cursor);
  return null;
}
export async function onRequestPost({request,env}){
  if(!env.VIPOAP_DATA||!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL)return Response.json({error:'Email login is not configured.'},{status:500});
  let body={};try{body=await request.json()}catch{}
  const client=request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();if(client){const rate=await takeRateLimit(env.VIPOAP_DATA,{scope:'admin-login-request',identifier:client,limit:10,windowSeconds:3600});if(!rate.allowed)return new Response(JSON.stringify({error:'Too many sign-in requests. Please wait before trying again.'}),{status:429,headers:{'content-type':'application/json','retry-after':String(rate.retryAfter)}})}
  const email=String(body.email||OWNER_EMAIL).trim().toLowerCase();
  const account=await operatorForEmail(env,email);
  const generic={ok:true,message:'If that email is authorised, a six-digit sign-in code will arrive shortly.'};
  if(!account)return Response.json(generic);
  const key=`admin-login-code:${await digest(email)}`,current=await env.VIPOAP_DATA.get(key,'json');
  if(current&&Date.now()-new Date(current.sentAt).getTime()<60000)return Response.json(generic);
  const values=new Uint32Array(1);crypto.getRandomValues(values);
  const code=String(values[0]%1000000).padStart(6,'0'),salt=crypto.randomUUID();
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:[email],subject:'Your VIPOAP OS sign-in code',html:`<div style="font-family:Arial,sans-serif;color:#102957"><h1>VIPOAP OS</h1><p>Your one-time sign-in code is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes and can only be used once. If you did not request it, ignore this email.</p></div>`})});
  if(!response.ok)return Response.json({error:'The sign-in email could not be sent.'},{status:502});
  await env.VIPOAP_DATA.put(key,JSON.stringify({...account,hash:await digest(`${salt}:${code}`),salt,sentAt:new Date().toISOString(),attempts:0}),{expirationTtl:600});
  return Response.json(generic);
}
