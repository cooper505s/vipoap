import {authorised} from '../../_shared/admin-auth.js';
function clean(value,max=2000){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}
async function list(kv,prefix){const keys=await kv.list({prefix});return Promise.all(keys.keys.map(async k=>({key:k.name,...await kv.get(k.name,'json')})))}

export async function onRequestGet({request,env}){
  if(!await authorised(request,env,'manage_incidents'))return Response.json({error:'Unauthorised'},{status:401});
  const incidents=(await list(env.VIPOAP_DATA,'incident:')).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  return Response.json({incidents});
}

export async function onRequestPost({request,env}){
  if(!await authorised(request,env,'report_incidents'))return Response.json({error:'Unauthorised'},{status:401});
  const body=await request.json(),severity=clean(body.severity,20),concernType=clean(body.concernType,80);
  if(!['critical','high','medium','low'].includes(severity)||!concernType||!clean(body.description))return Response.json({error:'Concern type, severity and factual description are required.'},{status:400});
  const now=new Date().toISOString(),key=`incident:${crypto.randomUUID()}`;
  const incident={reference:`SAFE-${crypto.randomUUID().split('-')[0].toUpperCase()}`,bookingKey:clean(body.bookingKey,200),reporterId:clean(body.reporterId,100),concernType,severity,description:clean(body.description),immediateAction:clean(body.immediateAction),currentlySafe:Boolean(body.currentlySafe),status:'new',ownerId:'',dueAt:clean(body.dueAt,40),restricted:true,paymentReview:Boolean(body.paymentReview),createdAt:now,updatedAt:now,history:[{event:'created',at:now,severity}]};
  await env.VIPOAP_DATA.put(key,JSON.stringify(incident));
  if(body.stopWork&&incident.bookingKey){const booking=await env.VIPOAP_DATA.get(incident.bookingKey,'json');if(booking)await env.VIPOAP_DATA.put(incident.bookingKey,JSON.stringify({...booking,status:'safety-stopped',paymentStatus:'review',safetyIncidentKey:key,updatedAt:now}))}
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
