import {adminContext,canAccessTerritory} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
function clean(value,max=1000){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
async function sendConfirmation(env,booking){
  if(!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL)throw new Error('Confirmation email is not configured.');
  const recipients=[booking.email,booking.bookerEmail].filter((email,index,list)=>email&&list.indexOf(email)===index);
  if(!recipients.length)return;
  const html=`<h2>Your VIPOAP appointment is confirmed</h2><p>Hello ${escapeHtml(booking.name)},</p><p>Your appointment is confirmed and the booked session has been paid.</p><p><strong>Reference:</strong> ${escapeHtml(booking.reference)}<br><strong>Support:</strong> ${escapeHtml(booking.supportType)}<br><strong>Date:</strong> ${escapeHtml(booking.date)}<br><strong>Time:</strong> ${escapeHtml(booking.time)}<br><strong>Booked duration:</strong> ${escapeHtml(booking.duration)} minutes<br><strong>Paid:</strong> ${escapeHtml(booking.price)}</p><p>If additional time is useful, your Engineer Partner will explain it and ask for your approval first. Any approved extra time will be billed after the appointment.</p><p>Need to change anything? Call 07977 254158 or email help@vipoap.co.uk.</p>`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':`${booking.reference}-confirmed`},body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:recipients,subject:`Your VIPOAP appointment is confirmed — ${booking.reference}`,html})});
  if(!response.ok)throw new Error(`Confirmation email failed with status ${response.status}`);
}
function canUse(context,booking){return canAccessTerritory(context,booking.territoryId||'andover')&&(context.role!=='operator'||(booking.operatorId||booking.assignedEngineerId)===context.operatorId)}

export async function onRequestGet({request,env}){
  const context=await adminContext(request,env);if(!hasPermission(context,'manage_calls'))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  const keys=await env.VIPOAP_DATA.list({prefix:'booking:'});
  const bookings=(await Promise.all(keys.keys.map(async key=>({key:key.name,...await env.VIPOAP_DATA.get(key.name,'json')})))).filter(x=>x.reference&&canUse(context,x)).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return Response.json({bookings});
}

export async function onRequestPatch({request,env}){
  const context=await adminContext(request,env);if(!hasPermission(context,'manage_calls'))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  const body=await request.json(); const key=clean(body.key,200); const status=clean(body.status,20); const adminNotes=clean(body.adminNotes,1500);const cancellationReason=clean(body.cancellationReason,500);const cancellationWaived=Boolean(body.cancellationWaived);const cancellationCharge=status==='cancelled'&&!cancellationWaived?Math.max(0,Math.min(15,Number(body.cancellationCharge)||0)):0;
  if(!key.startsWith('booking:')||!['pending','confirmed','declined','completed','cancelled'].includes(status))return Response.json({error:'Invalid update.'},{status:400});
  const booking=await env.VIPOAP_DATA.get(key,'json'); if(!booking||!canUse(context,booking))return Response.json({error:'Booking not found.'},{status:404});
  if(status==='confirmed'&&booking.status!=='confirmed'&&booking.paymentStatus!=='prepaid')return Response.json({error:'Advance payment must be completed before this appointment can be confirmed.'},{status:409});
  let confirmationEmailSentAt=booking.confirmationEmailSentAt;
  if(status==='confirmed'&&!confirmationEmailSentAt){try{await sendConfirmation(env,booking);confirmationEmailSentAt=new Date().toISOString()}catch(error){return Response.json({error:error.message},{status:502})}}
  await env.VIPOAP_DATA.put(key,JSON.stringify({...booking,status,bookingStatus:status==='confirmed'?'confirmed':booking.bookingStatus,adminNotes,cancellationCharge,cancellationWaived,cancellationReason,confirmedAt:status==='confirmed'?(booking.confirmedAt||new Date().toISOString()):booking.confirmedAt,confirmationEmailSentAt,updatedAt:new Date().toISOString()}));
  return Response.json({ok:true});
}
