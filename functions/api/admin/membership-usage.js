import {authorised} from '../../_shared/admin-auth.js';
import {membershipEntitlement} from '../../_shared/membership.js';
function clean(value,max=200){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}

export async function onRequestGet({request,env}){
  if(!await authorised(request,env,'manage_customers'))return Response.json({error:'Unauthorised'},{status:401});
  const url=new URL(request.url),customerId=clean(url.searchParams.get('customerId'));
  if(!customerId.startsWith('customer:'))return Response.json({error:'Customer is required.'},{status:400});
  const entitlement=await membershipEntitlement(env,customerId,clean(url.searchParams.get('personId')));if(!entitlement)return Response.json({error:'Customer not found.'},{status:404});
  return Response.json({entitlement});
}

export async function onRequestPost({request,env}){
  if(!await authorised(request,env,'manage_calls'))return Response.json({error:'Unauthorised'},{status:401});
  const body=await request.json(),customerId=clean(body.customerId),minutes=Math.max(0,Math.floor(Number(body.minutes)||0));
  if(!customerId.startsWith('customer:')||!minutes||minutes>240)return Response.json({error:'Customer and valid usage minutes are required.'},{status:400});
  const before=await membershipEntitlement(env,customerId,clean(body.personId));
  if(!before?.active||!before.personCovered||before.minutesRemaining<=0)return Response.json({error:'No eligible membership allowance is available.'},{status:409});
  const includedMinutes=Math.min(minutes,before.minutesRemaining),paidMinutes=Math.max(0,minutes-includedMinutes),now=new Date().toISOString(),key=`membership-usage:${customerId}:${crypto.randomUUID()}`;
  const usage={customerId,personId:clean(body.personId),bookingKey:clean(body.bookingKey),minutes,includedMinutes,paidMinutes,periodStart:before.period.start,periodEnd:before.period.end,status:'posted',createdAt:now};
  await env.VIPOAP_DATA.put(key,JSON.stringify(usage));
  return Response.json({ok:true,key,usage,entitlement:await membershipEntitlement(env,customerId,clean(body.personId))},{status:201});
}

