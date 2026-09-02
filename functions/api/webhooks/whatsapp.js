const clean=(value,max=3000)=>String(value??'').trim().slice(0,max);
const bytesToHex=bytes=>[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
async function validSignature(request,raw,secret){
  if(!secret)return true;
  const supplied=request.headers.get('x-hub-signature-256')||'';
  if(!supplied.startsWith('sha256='))return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw));
  return `sha256=${bytesToHex(digest)}`===supplied;
}

export async function onRequestGet({request,env}){
  const url=new URL(request.url),mode=url.searchParams.get('hub.mode'),token=url.searchParams.get('hub.verify_token'),challenge=url.searchParams.get('hub.challenge');
  if(mode==='subscribe'&&env.WHATSAPP_VERIFY_TOKEN&&token===env.WHATSAPP_VERIFY_TOKEN)return new Response(challenge||'',{status:200});
  return new Response('Webhook verification failed.',{status:403});
}

export async function onRequestPost({request,env}){
  if(!env.VIPOAP_DATA)return Response.json({error:'Messaging storage is unavailable.'},{status:503});
  const raw=await request.text();
  if(!await validSignature(request,raw,env.WHATSAPP_APP_SECRET))return new Response('Invalid webhook signature.',{status:401});
  let payload;try{payload=JSON.parse(raw)}catch{return Response.json({error:'Invalid webhook payload.'},{status:400})}
  const now=new Date().toISOString(),events=[];
  for(const entry of payload.entry||[])for(const change of entry.changes||[]){
    const value=change.value||{};
    for(const status of value.statuses||[]){
      const id=clean(status.id,220),state=clean(status.status,40),event={type:'status',providerMessageId:id,status:state,recipient:clean(status.recipient_id,60),timestamp:status.timestamp||'',errors:status.errors||[],receivedAt:now};
      const key=`whatsapp-event:${now}:${crypto.randomUUID()}`;await env.VIPOAP_DATA.put(key,JSON.stringify(event),{expirationTtl:7776000});events.push(event);
    }
    for(const message of value.messages||[]){
      const id=clean(message.id,220),from=clean(message.from,60),text=clean(message.text?.body||message.button?.text||message.interactive?.button_reply?.title||'',3000),event={type:'inbound',providerMessageId:id,from,messageType:clean(message.type,40),text,timestamp:message.timestamp||'',receivedAt:now};
      const key=`whatsapp-inbound:${from}:${now}:${crypto.randomUUID()}`;await env.VIPOAP_DATA.put(key,JSON.stringify(event),{expirationTtl:15552000});events.push(event);
    }
  }
  return Response.json({ok:true,events:events.length});
}
