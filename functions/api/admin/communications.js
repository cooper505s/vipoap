import {adminContext,canAccessTerritory} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {audit} from '../../_shared/audit.js';

const clean=(value,max=2000)=>String(value??'').trim().replace(/[<>]/g,'').slice(0,max);
const channels=['Email','Phone','SMS','WhatsApp'];
const directions=['inbound','outbound'];
async function customerFor(env,context,customerId){
  const customer=customerId.startsWith('customer:')?await env.VIPOAP_DATA.get(customerId,'json'):null;
  if(!customer||!canAccessTerritory(context,customer.territoryId||'andover')||(context.role==='operator'&&customer.operatorId&&customer.operatorId!==context.operatorId))return null;
  return customer;
}
async function records(kv,customerId){
  const page=await kv.list({prefix:`communication:${customerId}:`});
  return (await Promise.all(page.keys.map(async item=>({key:item.name,...await kv.get(item.name,'json')})))).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function onRequestGet({request,env}){
  const context=await adminContext(request,env);
  if(!hasPermission(context,'manage_customers'))return Response.json({error:'Customer communications access required.'},{status:403});
  const customerId=clean(new URL(request.url).searchParams.get('customerId'),120),customer=await customerFor(env,context,customerId);
  if(!customer)return Response.json({error:'Customer not found.'},{status:404});
  return Response.json({customer:{id:customerId,name:customer.name,email:customer.email||'',phone:customer.phone||'',preferredContact:customer.preferredContact||''},communications:await records(env.VIPOAP_DATA,customerId),channels});
}

export async function onRequestPost({request,env}){
  const context=await adminContext(request,env);
  if(!hasPermission(context,'manage_customers'))return Response.json({error:'Customer communications access required.'},{status:403});
  const body=await request.json(),customerId=clean(body.customerId,120),customer=await customerFor(env,context,customerId),channel=clean(body.channel,20),direction=clean(body.direction,20),subject=clean(body.subject,180),message=clean(body.message,3000);
  if(!customer)return Response.json({error:'Customer not found.'},{status:404});
  if(!channels.includes(channel)||!directions.includes(direction)||message.length<2)return Response.json({error:'Choose a channel, direction and add a useful contact note.'},{status:400});
  let deliveryStatus='recorded',providerId='';
  if(direction==='outbound'&&channel==='Email'){
    if(!customer.email)return Response.json({error:'This customer has no email address.'},{status:400});
    if(!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL)return Response.json({error:'Customer email delivery is not configured. Record a phone contact or ask HQ to configure email.'},{status:503});
    const delivery=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:[customer.email],subject:subject||'An update from VIPOAP',html:`<p>${message.replace(/\n/g,'<br>')}</p><p>VIPOAP — Technology without the worry.</p>`})});
    let result={};try{result=await delivery.json()}catch{}
    if(!delivery.ok)return Response.json({error:'The email could not be delivered. Nothing has been marked as sent.'},{status:502});
    deliveryStatus='sent';providerId=clean(result.id,120);
  }else if(direction==='outbound'&&['SMS','WhatsApp'].includes(channel))deliveryStatus='manual-action-required';
  const id=crypto.randomUUID(),key=`communication:${customerId}:${id}`,now=new Date().toISOString(),record={id,customerId,territoryId:customer.territoryId||'andover',operatorId:context.operatorId,channel,direction,subject,message,deliveryStatus,providerId,createdAt:now,createdBy:context.email};
  await env.VIPOAP_DATA.put(key,JSON.stringify(record));
  await audit(env,context,'record','customer-communication',key,{customerId,channel,direction,deliveryStatus});
  return Response.json({ok:true,key,deliveryStatus});
}
