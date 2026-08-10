import {digest} from '../../../_shared/admin-auth.js';
import {takeRateLimit} from '../../../_shared/rate-limit.js';
function clean(value,max=150){return String(value??'').trim().toLowerCase().replace(/[<>]/g,'').slice(0,max)}
function code(){return String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0')}
async function send(env,to,loginCode){const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:[to],subject:'Your VIPOAP sign-in code',html:`<h2>Your VIPOAP sign-in code</h2><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${loginCode}</p><p>This code expires in 10 minutes. VIPOAP will never ask you for a bank PIN or one-time banking code.</p>`})});if(!response.ok)throw new Error('Unable to send sign-in code')}
export async function onRequestPost({request,env}){
  if(!env.VIPOAP_DATA||!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL)return Response.json({error:'Account sign-in is temporarily unavailable.'},{status:503});
  const body=await request.json(),email=clean(body.email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:'Enter a valid email address.'},{status:400});
  const identifier=request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||email,rate=await takeRateLimit(env.VIPOAP_DATA,{scope:'customer-login-request',identifier,limit:5,windowSeconds:3600});if(!rate.allowed)return new Response(JSON.stringify({error:'Too many sign-in requests. Please wait before trying again.'}),{status:429,headers:{'content-type':'application/json','retry-after':String(rate.retryAfter)}});
  const keys=await env.VIPOAP_DATA.list({prefix:'customer:'}),customers=await Promise.all(keys.keys.map(async k=>({key:k.name,...await env.VIPOAP_DATA.get(k.name,'json')}))),customer=customers.find(x=>String(x.email||'').toLowerCase()===email);
  if(customer){const loginCode=code(),salt=crypto.randomUUID(),now=new Date();await env.VIPOAP_DATA.put(`customer-login-code:${await digest(email)}`,JSON.stringify({customerId:customer.key,email,salt,hash:await digest(`${salt}:${loginCode}`),attempts:0,expiresAt:new Date(now.getTime()+10*60000).toISOString()}),{expirationTtl:600});await send(env,email,loginCode)}
  return Response.json({ok:true,message:'If that email belongs to a VIPOAP account, a sign-in code has been sent.'});
}

