import {requireCustomer} from '../../_shared/customer-auth.js';
import {audit} from '../../_shared/audit.js';
const clean=(value,max=800)=>String(value??'').trim().replace(/[<>]/g,'').slice(0,max);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function notify(env,customer,booking,record){if(!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL)return false;const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':`${record.reference}-appointment-request`},body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:['help@vipoap.co.uk'],subject:`Appointment ${record.requestType} request — ${booking.reference||record.reference}`,html:`<h2>Customer appointment request</h2><p><strong>${escapeHtml(customer.name)}</strong> has requested ${escapeHtml(record.requestType)} for ${escapeHtml(booking.reference||'an appointment')}.</p><p>${escapeHtml(booking.date)} at ${escapeHtml(booking.time)}</p><p>${escapeHtml(record.description)}</p>`})});return response.ok}
export async function onRequestPost({request,env}){
  const session=await requireCustomer(request,env);if(!session)return Response.json({error:'Please sign in.'},{status:401});
  let body;try{body=await request.json()}catch{return Response.json({error:'Please check the request.'},{status:400})}
  const bookingKey=clean(body.bookingKey,250),requestType=clean(body.requestType,20),details=clean(body.details,800);
  if(!bookingKey.startsWith('booking:')||!['change','cancel'].includes(requestType))return Response.json({error:'Choose a valid appointment request.'},{status:400});
  const booking=await env.VIPOAP_DATA.get(bookingKey,'json');if(!booking||booking.customerId!==session.customerId)return Response.json({error:'Appointment not found.'},{status:404});
  const status=booking.bookingStatus||booking.status;if(['completed','cancelled','declined','in-progress','safety-stopped'].includes(status))return Response.json({error:'This appointment can no longer be changed online. Please contact VIPOAP.'},{status:409});
  if(booking.customerRequestStatus==='received')return Response.json({error:'A change request is already being reviewed.'},{status:409});
  if(requestType==='change'&&details.length<3)return Response.json({error:'Please tell us which date or time would suit you.'},{status:400});
  const customer=await env.VIPOAP_DATA.get(session.customerId,'json')||{},now=new Date().toISOString(),reference=`HELP-${now.slice(5,10).replace('-','')}${crypto.randomUUID().slice(0,4).toUpperCase()}`,description=requestType==='cancel'?`Please cancel appointment ${booking.reference||''}. ${details}`.trim():`Please change appointment ${booking.reference||''}. Preferred date or time: ${details}`,helpKey=`help-request:${now.slice(0,10)}:${reference}`;
  const record={customerId:session.customerId,name:customer.name||'',email:customer.email||session.email||'',phone:customer.phone||'',postcode:customer.postcode||'',contactPreference:customer.preferredContact||'Email',territoryId:booking.territoryId||'andover',category:'appointment',requestType,bookingKey,bookingReference:booking.reference||'',reference,status:'received',description,messages:[{author:'customer',text:description,createdAt:now}],createdAt:now,updatedAt:now};
  await env.VIPOAP_DATA.put(helpKey,JSON.stringify(record));await env.VIPOAP_DATA.put(`help-reference:${reference}`,helpKey);
  await env.VIPOAP_DATA.put(bookingKey,JSON.stringify({...booking,customerRequestStatus:'received',customerRequestType:requestType,customerRequestDetails:details,customerRequestReference:reference,customerRequestAt:now,updatedAt:now}));
  await Promise.allSettled([notify(env,customer,booking,record),audit(env,{email:session.email,operatorId:'customer'},'request-appointment-change','booking',bookingKey,{requestType,reference})]);
  return Response.json({ok:true,reference,status:'received'});
}
