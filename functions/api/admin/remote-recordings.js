import {authorised} from '../../_shared/admin-auth.js';
function clean(value,max=1000){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}

export async function onRequestPost({request,env}){
  if(!await authorised(request,env,'manage_recordings'))return Response.json({error:'Unauthorised'},{status:401});
  const body=await request.json(),bookingKey=clean(body.bookingKey,200),consent=Boolean(body.consent);
  if(!bookingKey.startsWith('booking:'))return Response.json({error:'A valid booking is required.'},{status:400});
  if(!consent)return Response.json({error:'Recording cannot start without recorded customer consent.'},{status:409});
  const now=new Date().toISOString(),key=`recording:${crypto.randomUUID()}`;
  const record={bookingKey,customerId:clean(body.customerId,100),engineerId:clean(body.engineerId,100),consent:true,consentMethod:clean(body.consentMethod||'verbal',40),consentedAt:now,status:'consented',recordingIndicatorRequired:true,sensitiveCaptureProhibited:true,storageKey:'',preserveUntil:'',createdAt:now,updatedAt:now,history:[{event:'consent-recorded',at:now}]};
  await env.VIPOAP_DATA.put(key,JSON.stringify(record));return Response.json({ok:true,key,record},{status:201});
}

export async function onRequestPatch({request,env}){
  if(!await authorised(request,env,'manage_recordings'))return Response.json({error:'Unauthorised'},{status:401});
  const body=await request.json(),key=clean(body.key,200),action=clean(body.action,30),allowed=['start','pause','resume','stop','preserve','delete-requested'];
  if(!key.startsWith('recording:')||!allowed.includes(action))return Response.json({error:'Invalid recording action.'},{status:400});
  const record=await env.VIPOAP_DATA.get(key,'json');if(!record)return Response.json({error:'Recording record not found.'},{status:404});
  const status={start:'recording',pause:'paused',resume:'recording',stop:'complete',preserve:'preserved','delete-requested':'deletion-pending'}[action],now=new Date().toISOString();
  const updated={...record,status,storageKey:clean(body.storageKey||record.storageKey,300),preserveUntil:action==='preserve'?clean(body.preserveUntil,40):record.preserveUntil,updatedAt:now,history:[...(record.history||[]),{event:action,at:now}]};
  await env.VIPOAP_DATA.put(key,JSON.stringify(updated));return Response.json({ok:true,record:updated});
}
