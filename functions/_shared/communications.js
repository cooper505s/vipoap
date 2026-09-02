const clean=(value,max=3000)=>String(value??'').trim().slice(0,max);
const normalisePhone=value=>clean(value,40).replace(/[^\d+]/g,'');

export const COMMUNICATION_EVENTS=Object.freeze({
  BOOKING_RECEIVED:'booking_received',
  BOOKING_CONFIRMED:'booking_confirmed',
  BOOKING_REMINDER_24H:'booking_reminder_24h',
  BOOKING_REMINDER_3H:'booking_reminder_3h',
  PROVIDER_JOB_OFFER:'provider_job_offer',
  PROVIDER_JOB_CONFIRMED:'provider_job_confirmed',
  ADDITIONAL_TIME_REQUEST:'additional_time_request',
  PAYMENT_REMINDER:'payment_reminder',
  REFERRAL_INVITE:'referral_invite',
  REFERRAL_REWARD:'referral_reward',
  REVIEW_INVITE:'review_invite'
});

export function whatsappConfigured(env){
  return Boolean(env.WHATSAPP_API_URL&&env.WHATSAPP_ACCESS_TOKEN);
}

export function whatsappTemplateName(env,event){
  const key=`VIPOAP_WA_TEMPLATE_${String(event||'').toUpperCase()}`;
  return clean(env[key],120);
}

export async function recordCommunication(env,{customerId='',providerId='',bookingKey='',reference='',channel,direction='outbound',event='',recipient='',subject='',message='',deliveryStatus='recorded',providerMessageId='',metadata={}}){
  if(!env.VIPOAP_DATA)return '';
  const id=crypto.randomUUID(),now=new Date().toISOString(),owner=customerId||providerId||'system',key=`communication:${owner}:${now}:${id}`;
  await env.VIPOAP_DATA.put(key,JSON.stringify({id,customerId,providerId,bookingKey,reference,channel,direction,event,recipient,subject,message,deliveryStatus,providerMessageId,metadata,createdAt:now,updatedAt:now}));
  return key;
}

export async function sendEmail(env,{to,subject,html,text='',idempotencyKey='',event='',customerId='',providerId='',bookingKey='',reference=''}){
  const recipient=clean(to,180);
  if(!recipient)return{ok:false,status:'missing-recipient'};
  if(!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL)return{ok:false,status:'not-configured'};
  const headers={authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'};
  if(idempotencyKey)headers['idempotency-key']=clean(idempotencyKey,180);
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers,body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:[recipient],subject:clean(subject,180),html,text:text||undefined})});
  let body={};try{body=await response.json()}catch{}
  const status=response.ok?'sent':'failed';
  await recordCommunication(env,{customerId,providerId,bookingKey,reference,channel:'Email',event,recipient,subject,message:text||subject,deliveryStatus:status,providerMessageId:clean(body.id,160)});
  return{ok:response.ok,status,providerMessageId:clean(body.id,160),httpStatus:response.status};
}

export async function sendWhatsAppTemplate(env,{to,event,templateName='',language='en_GB',components=[],customerId='',providerId='',bookingKey='',reference='',metadata={}}){
  const recipient=normalisePhone(to);
  if(!recipient)return{ok:false,status:'missing-recipient'};
  if(!whatsappConfigured(env))return{ok:false,status:'not-configured'};
  const template=templateName||whatsappTemplateName(env,event);
  if(!template)return{ok:false,status:'template-not-configured'};
  const payload={messaging_product:'whatsapp',to:recipient,type:'template',template:{name:template,language:{code:language},...(components.length?{components}:{})}};
  const response=await fetch(env.WHATSAPP_API_URL,{method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'content-type':'application/json'},body:JSON.stringify(payload)});
  let body={};try{body=await response.json()}catch{}
  const providerMessageId=clean(body?.messages?.[0]?.id,200),status=response.ok?'sent':'failed';
  await recordCommunication(env,{customerId,providerId,bookingKey,reference,channel:'WhatsApp',event,recipient,message:`Template: ${template}`,deliveryStatus:status,providerMessageId,metadata:{template,language,...metadata}});
  return{ok:response.ok,status,providerMessageId,httpStatus:response.status,error:response.ok?'':clean(body?.error?.message||'',500)};
}

export async function queueCommunication(env,{event,channel,recipient,customerId='',providerId='',bookingKey='',reference='',templateData={},subject='',message=''}){
  if(!env.VIPOAP_DATA)return'';
  const id=crypto.randomUUID(),now=new Date().toISOString(),key=`communication-queue:${now}:${id}`;
  await env.VIPOAP_DATA.put(key,JSON.stringify({id,event,channel,recipient,customerId,providerId,bookingKey,reference,templateData,subject,message,status:'pending',attempts:0,createdAt:now,updatedAt:now}));
  return key;
}
