const WINDOWS=[{id:'24h',target:24*60,tolerance:20},{id:'3h',target:3*60,tolerance:20}];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ukAppointment(date,time){const naive=Date.parse(`${date}T${time}:00Z`),parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(naive)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)])),shown=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute),offset=shown-naive;return new Date(naive-offset)}
async function send(env,booking,window,key){
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':key},body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:[booking.email],subject:`Reminder: your VIPOAP visit is ${window.id==='24h'?'tomorrow':'in a few hours'}`,html:`<div style="font-family:Arial,sans-serif;color:#102957"><h1>VIPOAP appointment reminder</h1><p>Hello ${esc(booking.name)},</p><p>This is a reminder that your local VIPOAP Engineer Partner is due to visit on <strong>${esc(booking.date)}</strong> at <strong>${esc(booking.time)}</strong>.</p><p><strong>Service:</strong> ${esc(booking.service)}<br><strong>Length:</strong> ${esc(booking.duration)} minutes<br><strong>Price:</strong> ${esc(booking.price)}</p><p>If you need to change the appointment, call 07977 254158 or email help@vipoap.co.uk as soon as possible.</p></div>`})});
  if(!response.ok)throw Error(`Reminder email failed with status ${response.status}`);
}
export async function processReminders(env,now=new Date()){
  if(!env.VIPOAP_DATA||!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL)throw Error('Reminder Worker bindings are incomplete.');
  const page=await env.VIPOAP_DATA.list({prefix:'booking:'});let sent=0,skipped=0;
  for(const item of page.keys){const booking=await env.VIPOAP_DATA.get(item.name,'json');if(!booking||booking.status!=='confirmed'||!booking.email){skipped++;continue}const appointment=ukAppointment(booking.date,booking.time),minutes=(appointment-now)/60000;const window=WINDOWS.find(x=>Math.abs(minutes-x.target)<=x.tolerance);if(!window){skipped++;continue}const marker=`reminder:${item.name}:${window.id}`;if(await env.VIPOAP_DATA.get(marker)){skipped++;continue}await send(env,booking,window,marker);await env.VIPOAP_DATA.put(marker,JSON.stringify({sentAt:now.toISOString(),reference:booking.reference}),{expirationTtl:604800});sent++}
  return{sent,skipped};
}
export default{async scheduled(_controller,env,ctx){ctx.waitUntil(processReminders(env))}};
