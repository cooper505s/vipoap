import {authorised,adminContext,canAccessTerritory} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
function clean(value,max=2000){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}
async function list(kv,prefix){const keys=await kv.list({prefix});return Promise.all(keys.keys.map(async k=>({key:k.name,...await kv.get(k.name,'json')})))}

export async function onRequestGet({request,env}){
  if(!await authorised(request,env,'manage_incidents'))return Response.json({error:'Unauthorised'},{status:401});
  const incidents=(await list(env.VIPOAP_DATA,'incident:')).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  return Response.json({incidents});
}

export async function onRequestPost({request,env}){
  const context=await adminContext(request,env);
  if(!hasPermission(context,'report_incidents'))return Response.json({error:'Unauthorised'},{status:401});
  let body;try{body=await request.json()}catch{return Response.json({error:'Please check the safety report.'},{status:400})}
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Please check the safety report.'},{status:400});
  const severity=clean(body.severity,20),concernType=clean(body.concernType,80);
  if(!['critical','high','medium','low'].includes(severity)||!concernType||!clean(body.description))return Response.json({error:'Concern type, severity and factual description are required.'},{status:400});
  const bookingKey=clean(body.bookingKey,200);
  if((bookingKey&&!bookingKey.startsWith('booking:'))||(body.stopWork&&!bookingKey))return Response.json({error:'Choose a valid appointment before stopping work.'},{status:400});
  const booking=bookingKey?await env.VIPOAP_DATA.get(bookingKey,'json'):null;
  if(bookingKey&&(!booking||!canAccessTerritory(context,booking.territoryId||'andover')||(context.role==='operator'&&(booking.operatorId||booking.assignedEngineerId)!==context.operatorId)))return Response.json({error:'Appointment not found.'},{status:404});
  if(body.stopWork&&([booking.status,booking.bookingStatus,booking.jobStatus].some(state=>['completed','cancelled','declined','awaiting-final-settlement','partially-resolved','unresolved','follow-up-booked'].includes(state))||booking.paymentStatus==='refunded'))return Response.json({error:'This appointment has already ended. You can still submit a safety report without stopping work.'},{status:409});
  const now=new Date().toISOString(),key=`incident:${crypto.randomUUID()}`;
  const incident={reference:`SAFE-${crypto.randomUUID().split('-')[0].toUpperCase()}`,bookingKey,territoryId:booking?.territoryId||context.territoryIds.find(id=>id!=='*')||'andover',reporterId:context.operatorId,concernType,severity,description:clean(body.description),immediateAction:clean(body.immediateAction),currentlySafe:Boolean(body.currentlySafe),status:'new',ownerId:'',dueAt:clean(body.dueAt,40),restricted:true,paymentReview:Boolean(body.paymentReview),createdAt:now,updatedAt:now,history:[{event:'created',at:now,severity}]};
  await env.VIPOAP_DATA.put(key,JSON.stringify(incident));
  if(body.stopWork&&booking)await env.VIPOAP_DATA.put(bookingKey,JSON.stringify({...booking,status:'safety-stopped',bookingStatus:'safety-stopped',jobStatus:'safety-stopped',paymentStatus:'review',safetyIncidentKey:key,updatedAt:now}));
  return Response.json({ok:true,key,incident},{status:201});
}

export async function onRequestPatch({request,env}){
  if(!await authorised(request,env,'manage_incidents'))return Response.json({error:'Unauthorised'},{status:401});
  const body=await request.json(),key=clean(body.key,200),status=clean(body.status,30);
  if(!key.startsWith('incident:')||!['new','triaged','action-required','awaiting-information','resolved','closed'].includes(status))return Response.json({error:'Invalid incident update.'},{status:400});
  const incident=await env.VIPOAP_DATA.get(key,'json');if(!incident)return Response.json({error:'Incident not found.'},{status:404});
  const now=new Date().toISOString(),updated={...incident,status,severity:['critical','high','medium','low'].includes(body.severity)?body.severity:incident.severity,ownerId:clean(body.ownerId,100),dueAt:clean(body.dueAt,40),updatedAt:now,history:[...(incident.history||[]),{event:'updated',status,at:now}]};
  await env.VIPOAP_DATA.put(key,JSON.stringify(updated));return Response.json({ok:true,incident:updated});
}
