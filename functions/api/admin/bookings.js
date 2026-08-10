import {authorised} from '../../_shared/admin-auth.js';
function clean(value,max=1000){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}

export async function onRequestGet({request,env}){
  if(!await authorised(request,env,'manage_calls'))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  const keys=await env.VIPOAP_DATA.list({prefix:'booking:'});
  const bookings=(await Promise.all(keys.keys.map(async key=>({key:key.name,...await env.VIPOAP_DATA.get(key.name,'json')})))).filter(x=>x.reference).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return Response.json({bookings});
}

export async function onRequestPatch({request,env}){
  if(!await authorised(request,env,'manage_calls'))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  const body=await request.json(); const key=clean(body.key,200); const status=clean(body.status,20); const adminNotes=clean(body.adminNotes,1500);const cancellationReason=clean(body.cancellationReason,500);const cancellationWaived=Boolean(body.cancellationWaived);const cancellationCharge=status==='cancelled'&&!cancellationWaived?Math.max(0,Math.min(15,Number(body.cancellationCharge)||0)):0;
  if(!key.startsWith('booking:')||!['pending','confirmed','declined','completed','cancelled'].includes(status))return Response.json({error:'Invalid update.'},{status:400});
  const booking=await env.VIPOAP_DATA.get(key,'json'); if(!booking)return Response.json({error:'Booking not found.'},{status:404});
  await env.VIPOAP_DATA.put(key,JSON.stringify({...booking,status,adminNotes,cancellationCharge,cancellationWaived,cancellationReason,updatedAt:new Date().toISOString()}));
  return Response.json({ok:true});
}
