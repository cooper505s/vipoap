import {adminContext,canAccessTerritory} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {audit} from '../../_shared/audit.js';
import {recordCommunication,sendEmail,sendWhatsAppTemplate,whatsappConfigured} from '../../_shared/communications.js';

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
  return Response.json({customer:{id:customerId,name:customer.name,email:customer.email||'',phone:customer.phone||'',preferredContact:customer.preferredContact||''},communications:await records(env.VIPOAP_DATA,customerId),channels,delivery:{email:Boolean(env.RESEND_API_KEY&&env.BOOKING_FROM_EMAIL),whatsApp:whatsappConfigured(env)}});
}

export async function onRequestPost({request,env}){
  const context=await adminContext(request,env);
  if(!hasPermission(context,'manage_customers'))return Response.json({error:'Customer communications access required.'},{status:403});
  const body=await request.json(),customerId=clean(body.customerId,120),customer=await customerFor(env,context,customerId),channel=clean(body.channel,20),direction=clean(body.direction,20),subject=clean(body.subject,180),message=clean(body.message,3000),event=clean(body.event||'manual_customer_update',80),templateName=clean(body.templateName,120);
  if(!customer)return Response.json({error:'Customer not found.'},{status:404});
  if(!channels.includes(channel)||!directions.includes(direction)||message.length<2)return Response.json({error:'Choose a channel, direction and add a useful contact note.'},{status:400});
  let deliveryStatus='recorded',providerId='';
  if(direction==='outbound'&&channel==='Email'){
    if(!customer.email)return Response.json({error:'This customer has no email address.'},{status:400});
    const result=await sendEmail(env,{to:customer.email,subject:subject||'An update from VIPOAP',html:`<p>${message.replace(/\n/g,'<br>')}</p><p>VIPOAP — Technology without the worry.</p>`,text:message,event,customerId});
    if(result.status==='not-configured')return Response.json({error:'Customer email delivery is not configured.'},{status:503});
    if(!result.ok)return Response.json({error:'The email could not be delivered. Nothing has been marked as sent.'},{status:502});
    deliveryStatus='sent';providerId=result.providerMessageId||'';
  }else if(direction==='outbound'&&channel==='WhatsApp'){
    if(!customer.phone)return Response.json({error:'This customer has no telephone number.'},{status:400});
    if(customer.whatsAppOptIn!==true)return Response.json({error:'WhatsApp consent has not been recorded for this customer.'},{status:409});
    const result=await sendWhatsAppTemplate(env,{to:customer.phone,event,templateName,customerId,metadata:{manualMessage:message,createdBy:context.email}});
    if(result.status==='not-configured'||result.status==='template-not-configured')return Response.json({error:'WhatsApp Business delivery or the required template is not configured.'},{status:503});
    if(!result.ok)return Response.json({error:'The WhatsApp message could not be delivered. Nothing has been marked as sent.'},{status:502});
    deliveryStatus='sent';providerId=result.providerMessageId||'';
  }else if(direction==='outbound'&&channel==='SMS')deliveryStatus='manual-action-required';
  if(!(direction==='outbound'&&['Email','WhatsApp'].includes(channel))){
    await recordCommunication(env,{customerId,channel,direction,event,recipient:channel==='Email'?customer.email:customer.phone,subject,message,deliveryStatus,providerMessageId:providerId,metadata:{createdBy:context.email}});
  }
  await audit(env,context,'record','customer-communication',customerId,{customerId,channel,direction,deliveryStatus,event});
  return Response.json({ok:true,deliveryStatus,providerId});
}
