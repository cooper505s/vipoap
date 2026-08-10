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

export async function onRequestPut({request,env}){
  if(!await authorised(request,env,'manage_recordings'))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.REMOTE_RECORDINGS)return Response.json({error:'Private recording storage is not configured.'},{status:503});
  const key=clean(new URL(request.url).searchParams.get('key'),200),record=key.startsWith('recording:')?await env.VIPOAP_DATA.get(key,'json'):null,type=clean(request.headers.get('content-type'),80),size=Number(request.headers.get('content-length'));
  if(!record?.consent)return Response.json({error:'A consented recording session is required.'},{status:409});
  if(!['video/webm','audio/webm','video/mp4'].includes(type)||!Number.isFinite(size)||size<1||size>100*1024*1024)return Response.json({error:'Upload a WebM or MP4 recording no larger than 100 MB.'},{status:400});
  const data=await request.arrayBuffer();if(data.byteLength!==size)return Response.json({error:'The recording upload was incomplete.'},{status:400});
  const objectKey=`remote-support/${record.bookingKey.replace(/[^a-zA-Z0-9_-]/g,'_')}/${record.id||key.slice(10)}.${type==='video/mp4'?'mp4':'webm'}`,now=new Date(),retention=Math.max(30,Math.min(365,Number(env.RECORDING_RETENTION_DAYS)||90)),preserveUntil=new Date(now.getTime()+retention*86400000).toISOString();
  const object=await env.REMOTE_RECORDINGS.put(objectKey,data,{httpMetadata:{contentType:type,contentDisposition:'attachment; filename="VIPOAP-remote-support-recording"',cacheControl:'private, no-store'},customMetadata:{recordingKey:key,bookingKey:record.bookingKey,consentedAt:record.consentedAt}});
  const updated={...record,status:'complete',storageKey:objectKey,contentType:type,size:object.size,etag:object.etag,preserveUntil,uploadedAt:now.toISOString(),updatedAt:now.toISOString(),history:[...(record.history||[]),{event:'recording-uploaded',at:now.toISOString()}]};await env.VIPOAP_DATA.put(key,JSON.stringify(updated));return Response.json({ok:true,record:updated});
}

export async function onRequestGet({request,env}){
  if(!await authorised(request,env,'manage_recordings'))return Response.json({error:'Unauthorised'},{status:401});const url=new URL(request.url),key=clean(url.searchParams.get('key'),200);
  if(key){const record=key.startsWith('recording:')?await env.VIPOAP_DATA.get(key,'json'):null;if(!record?.storageKey||!env.REMOTE_RECORDINGS)return Response.json({error:'Recording file not found.'},{status:404});const object=await env.REMOTE_RECORDINGS.get(record.storageKey);if(!object)return Response.json({error:'Recording file not found.'},{status:404});const headers=new Headers({'cache-control':'private, no-store','content-disposition':`attachment; filename="VIPOAP-${clean(record.bookingKey,80)}.webm"`});object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);return new Response(object.body,{headers})}
  const page=await env.VIPOAP_DATA.list({prefix:'recording:'}),recordings=(await Promise.all(page.keys.map(async item=>({key:item.name,...await env.VIPOAP_DATA.get(item.name,'json')})))).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));return Response.json({recordings});
}
