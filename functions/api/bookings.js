function clean(value,max=500){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}
function reference(){return `VIP-${Date.now().toString(36).toUpperCase()}`}
function toMinutes(time){const [h,m]=time.split(':').map(Number);return h*60+m}
async function sendEmail(env,booking,ref){
  if(!env.RESEND_API_KEY)return;
  const html=`<h2>New VIPOAP booking request</h2><p><strong>Reference:</strong> ${ref}</p><p><strong>Name:</strong> ${booking.name}</p><p><strong>Telephone:</strong> ${booking.phone}</p><p><strong>Email:</strong> ${booking.email||'Not supplied'}</p><p><strong>Postcode:</strong> ${booking.postcode}</p><p><strong>Service:</strong> ${booking.service}</p><p><strong>Date:</strong> ${booking.date}</p><p><strong>Time:</strong> ${booking.time}</p><p><strong>Duration:</strong> ${booking.duration} minutes</p><p><strong>Details:</strong><br>${booking.details||'Not supplied'}</p>`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':ref},body:JSON.stringify({from:env.BOOKING_FROM_EMAIL||'VIPOAP Bookings <bookings@vipoap.co.uk>',to:['help@vipoap.co.uk'],reply_to:booking.email||undefined,subject:`VIPOAP booking request ${ref}`,html})});
  if(!response.ok)throw new Error('Email delivery failed');
}
export async function onRequestPost({request,env}){
  let body;try{body=await request.json()}catch{return Response.json({error:'Invalid booking request.'},{status:400})}
  const booking={service:clean(body.service,100),duration:Number(body.duration),date:clean(body.date,10),time:clean(body.time,5),name:clean(body.name,100),phone:clean(body.phone,40),email:clean(body.email,120),postcode:clean(body.postcode,20),details:clean(body.details,1000)};
  if(!booking.service||![30,60].includes(booking.duration)||!/^\d{4}-\d{2}-\d{2}$/.test(booking.date)||!/^\d{2}:\d{2}$/.test(booking.time)||!booking.name||!booking.phone||!booking.postcode)return Response.json({error:'Please complete all required fields.'},{status:400});
  const ref=reference(),slotKey=`booking:${booking.date}:${booking.time}`;
  if(env.VIPOAP_DATA){
    const keys=await env.VIPOAP_DATA.list({prefix:`booking:${booking.date}:`});
    const existing=(await Promise.all(keys.keys.map(k=>env.VIPOAP_DATA.get(k.name,'json')))).filter(Boolean).filter(b=>!['declined','cancelled'].includes(b.status));
    const start=toMinutes(booking.time),end=start+booking.duration;
    if(existing.some(b=>{const bs=toMinutes(b.time),be=bs+Number(b.duration||30);return start<be&&end>bs}))return Response.json({error:'That appointment has just been taken. Please choose another time.'},{status:409});
    await env.VIPOAP_DATA.put(slotKey,JSON.stringify({...booking,reference:ref,status:'pending',adminNotes:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));
  }
  try{await sendEmail(env,booking,ref)}catch(error){if(env.VIPOAP_DATA)await env.VIPOAP_DATA.delete(slotKey);return Response.json({error:'We could not send the booking. Please try again or call 07977 254158.'},{status:502})}
  return Response.json({ok:true,reference:ref});
}