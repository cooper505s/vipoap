import {ensureCustomer} from '../_shared/customers.js';
const DEFAULT_AVAILABILITY={monday:[['19:00','21:00']],wednesday:[['19:00','21:00']],saturday:[['11:00','13:00'],['16:00','19:00']]};
const DAY_NAMES=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
function clean(value,max=500){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function reference(){return `VIP-${crypto.randomUUID().split('-')[0].toUpperCase()}`}
function toMinutes(time){const [h,m]=time.split(':').map(Number);return h*60+m}
function jsonError(error,status){return Response.json({error},{status})}

async function sendMessage(env,payload,key){
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':key},body:JSON.stringify(payload)});
  if(!response.ok)throw new Error(`Email delivery failed with status ${response.status}`);
}

async function sendEmails(env,booking,ref){
  const from=env.BOOKING_FROM_EMAIL;
  const safe=Object.fromEntries(Object.entries(booking).map(([key,value])=>[key,escapeHtml(value)]));
const adminHtml=`<h2>New VIPOAP booking request</h2><p><strong>Reference:</strong> ${escapeHtml(ref)}</p><p><strong>Booking for:</strong> ${safe.bookingFor==='someone_else'?'Someone else':'Myself'}<br><strong>Booker:</strong> ${safe.bookerName||'Same person'}<br><strong>Relationship:</strong> ${safe.relationship||'Not applicable'}<br><strong>Booker phone:</strong> ${safe.bookerPhone||'Not supplied'}<br><strong>Booker email:</strong> ${safe.bookerEmail||'Not supplied'}</p><p><strong>Support type:</strong> ${safe.supportType}</p><p><strong>Name:</strong> ${safe.name}</p><p><strong>Telephone:</strong> ${safe.phone}</p><p><strong>Email:</strong> ${safe.email||'Not supplied'}</p><p><strong>Address:</strong> ${safe.address||'Not supplied'}</p><p><strong>Postcode:</strong> ${safe.postcode}</p><p><strong>Preferred notifications:</strong> ${safe.notificationChannel}</p><p><strong>Service:</strong> ${safe.service}</p><p><strong>Date:</strong> ${safe.date}</p><p><strong>Time:</strong> ${safe.time}</p><p><strong>Duration:</strong> ${safe.duration} minutes (${safe.price})</p><p><strong>Details:</strong><br>${safe.details||'Not supplied'}</p><p><strong>Accessibility or communication notes:</strong><br>${safe.accessibilityNotes||'Not supplied'}</p>`;
  await sendMessage(env,{from,to:['help@vipoap.co.uk'],reply_to:booking.bookerEmail||booking.email||undefined,subject:`VIPOAP booking request ${ref}`,html:`<p><strong>Authorised family/contact:</strong> ${safe.bookerName||'Same person'}</p>${adminHtml}`},`${ref}-admin`);
  const confirmationEmails=[booking.email,booking.bookerEmail].filter((email,index,list)=>email&&list.indexOf(email)===index);
  if(confirmationEmails.length){
    const customerHtml=`<h2>Thank you, ${safe.name}</h2><p>Your VIPOAP booking request has been received.</p><p><strong>Reference:</strong> ${escapeHtml(ref)}<br><strong>Support type:</strong> ${safe.supportType}<br><strong>Date:</strong> ${safe.date}<br><strong>Time:</strong> ${safe.time}<br><strong>Length:</strong> ${safe.duration} minutes<br><strong>Service price:</strong> ${safe.price}</p><p>Normal support is paid after the appointment. Equipment, paid software and subscriptions are separate and are only purchased with your approval; equipment is paid for before we buy it.</p><p>This is a request, not yet a confirmed appointment. Your local VIPOAP Engineer Partner will contact you to confirm it.</p><p>You can cancel free of charge until one hour before the appointment. Late cancellations and no-shows may be charged £15, although we can waive this in reasonable exceptional circumstances.</p><p>Need to change something? Call 07977 254158 or email help@vipoap.co.uk.</p>`;
    await sendMessage(env,{from,to:confirmationEmails,subject:`We received your VIPOAP booking request ${ref}`,html:customerHtml},`${ref}-customer`);
  }
}

export async function onRequestPost({request,env}){
  if(!env.VIPOAP_DATA||!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL){
    console.error(JSON.stringify({event:'booking_configuration_error',kv:!!env.VIPOAP_DATA,resend:!!env.RESEND_API_KEY,fromEmail:!!env.BOOKING_FROM_EMAIL}));
    return jsonError('Booking is temporarily unavailable. Please call 07977 254158.',503);
  }
  let body;try{body=await request.json()}catch{return jsonError('Invalid booking request.',400)}
  const booking={referralCode:clean(body.referralCode,80),bookingFor:clean(body.bookingFor||'myself',20),supportType:clean(body.supportType||'Home visit',30),service:clean(body.service,100),duration:Number(body.duration),date:clean(body.date,10),time:clean(body.time,5),name:clean(body.name,100),phone:clean(body.phone,40),email:clean(body.email,120),address:clean(body.address,300),postcode:clean(body.postcode,20),notificationChannel:clean(body.notificationChannel||'Email',20),details:clean(body.details,1000),accessibilityNotes:clean(body.accessibilityNotes,500),bookerName:clean(body.bookerName,100),bookerPhone:clean(body.bookerPhone,40),bookerEmail:clean(body.bookerEmail,120),relationship:clean(body.relationship,80)};
  if(!['myself','someone_else'].includes(booking.bookingFor)||!['Home visit','Remote support'].includes(booking.supportType)||!booking.service||![30,60].includes(booking.duration)||(booking.supportType==='Home visit'&&booking.duration!==60)||!/^\d{4}-\d{2}-\d{2}$/.test(booking.date)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(booking.time)||!booking.name||!booking.phone||!booking.postcode||(booking.supportType==='Home visit'&&!booking.address)||(booking.bookingFor==='someone_else'&&(!booking.bookerName||!booking.bookerPhone||!booking.relationship))||!['Email','SMS','WhatsApp','Phone'].includes(booking.notificationChannel))return jsonError('Please complete all required fields.',400);
  booking.price=booking.supportType==='Remote support'?(booking.duration===30?'£15':'£25'):'£30';
  if(booking.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email))return jsonError('Please enter a valid email address.',400);
  if(booking.bookerEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.bookerEmail))return jsonError('Please enter a valid booker email address.',400);
  const chosen=new Date(`${booking.date}T12:00:00Z`),[hour,minute]=booking.time.split(':').map(Number),start=toMinutes(booking.time),end=start+booking.duration;
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
  if(Number.isNaN(chosen.getTime())||chosen.toISOString().slice(0,10)!==booking.date||booking.date<tomorrow||hour>23||minute>59||minute%30!==0)return jsonError('Please choose a valid future appointment time.',400);
  const saved=await env.VIPOAP_DATA.get('availability','json'),settings=saved||{weekly:DEFAULT_AVAILABILITY,blockedDates:[]};
  const ranges=settings.weekly?.[DAY_NAMES[chosen.getUTCDay()]]||[],allowed=!settings.blockedDates?.includes(booking.date)&&ranges.some(([from,to])=>start>=toMinutes(from)&&end<=toMinutes(to)&&(start-toMinutes(from))%30===0);
  if(!allowed)return jsonError('That appointment time is not available. Please choose another time.',409);
  const keys=await env.VIPOAP_DATA.list({prefix:`booking:${booking.date}:`});
  const existing=(await Promise.all(keys.keys.map(key=>env.VIPOAP_DATA.get(key.name,'json')))).filter(Boolean).filter(item=>!['declined','cancelled'].includes(item.status));
  if(existing.some(item=>{const bookedStart=toMinutes(item.time),bookedEnd=bookedStart+Number(item.duration||30);return start<bookedEnd&&end>bookedStart}))return jsonError('That appointment has just been taken. Please choose another time.',409);
  const ref=reference(),slotKey=`booking:${booking.date}:${booking.time}`,now=new Date().toISOString();
  await env.VIPOAP_DATA.put(slotKey,JSON.stringify({...booking,reference:ref,status:'pending',adminNotes:'',createdAt:now,updatedAt:now}));
  try{await sendEmails(env,booking,ref)}catch(error){
    await env.VIPOAP_DATA.delete(slotKey);
    console.error(JSON.stringify({event:'booking_email_failed',reference:ref,message:error instanceof Error?error.message:'Unknown error'}));
    return jsonError('We could not send the booking. Please try again or call 07977 254158.',502);
  }
  const customer=await ensureCustomer(env,booking);
  await env.VIPOAP_DATA.put(slotKey,JSON.stringify({...booking,reference:ref,status:'pending',adminNotes:'',customerId:customer?.key||'',territoryId:customer?.territoryId||'andover',operatorId:customer?.operatorId||'dan-stevens',createdAt:now,updatedAt:new Date().toISOString()}));
  if(booking.referralCode){const referralKey=await env.VIPOAP_DATA.get(`referral-code:${booking.referralCode}`);if(referralKey){const referral=await env.VIPOAP_DATA.get(referralKey,'json');if(referral){const at=new Date().toISOString();await env.VIPOAP_DATA.put(referralKey,JSON.stringify({...referral,referredCustomerId:customer?.key||'',bookingKey:slotKey,status:'booked',history:[...(referral.history||[]),{status:'booked',at}],updatedAt:at}))}}}
  console.log(JSON.stringify({event:'booking_created',reference:ref,date:booking.date,time:booking.time,duration:booking.duration}));
  return Response.json({ok:true,reference:ref});
}
