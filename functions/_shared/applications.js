export const APPLICATION_RETENTION_DAYS = 180;
export const applicationReference = id => `APP-${id}`;
export const applicationHeaders = {'cache-control':'no-store','x-content-type-options':'nosniff'};
export const applicationJson = (body,status=200) => Response.json(body,{status,headers:applicationHeaders});
export async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function pruneApplications(db,now=new Date()) {
  const cutoff=now.toISOString();
  await db.batch([
    db.prepare('DELETE FROM application_audit WHERE application_id IN (SELECT id FROM engineer_applications WHERE expires_at<=?)').bind(cutoff),
    db.prepare('DELETE FROM engineer_applications WHERE expires_at<=?').bind(cutoff),
    db.prepare('DELETE FROM application_rate_limits WHERE expires_at<=?').bind(now.getTime())
  ]);
}

export function validateApplication(body) {
  const limits={name:100,email:150,phone:40,area:100,experience:30,availability:40,skills:3000,motivation:2000};
  const values={},errors={};
  for(const [field,max] of Object.entries(limits)) {
    const value=typeof body[field]==='string'?body[field].trim():'';
    values[field]=value;
    if(!value)errors[field]='Please complete this field.';
    else if(value.length>max)errors[field]=`Please use ${max} characters or fewer.`;
    else if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))errors[field]='Please remove unusual control characters.';
  }
  values.email=values.email.toLowerCase();
  if(values.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))errors.email='Please check your email address.';
  if(values.phone&&!/^[+()\d\s.-]{7,40}$/.test(values.phone))errors.phone='Please enter a telephone number we can reach you on.';
  if(values.phone.replace(/\D/g,'').length<7)errors.phone='Please check your telephone number.';
  if(!['Under 2 years','2–5 years','6–10 years','More than 10 years'].includes(values.experience))errors.experience='Please choose your experience.';
  if(!['Weekdays','Evenings','Weekends','A mixture','Exploring for the future'].includes(values.availability))errors.availability='Please choose your availability.';
  return {values,errors};
}

// Bound streamed input even when a client omits or lies about Content-Length.
export async function applicationBody(request) {
  if(Number(request.headers.get('content-length')||0)>20000)throw Object.assign(Error('Please shorten your application.'),{status:413});
  const reader=request.body?.getReader();
  if(!reader)throw Object.assign(Error('Please complete the application.'),{status:400});
  const chunks=[];let size=0;
  while(true) {
    const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>20000){await reader.cancel();throw Object.assign(Error('Please shorten your application.'),{status:413});}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw Object.assign(Error('We could not read the application. Please try again.'),{status:400}); }
}

export async function notifyApplication(env,id) {
  const db=env.VIPOAP_DB;
  if(env.APPLICATION_NOTIFICATIONS_ENABLED!=='true'||!env.RESEND_API_KEY||!env.BOOKING_FROM_EMAIL)return;
  const now=new Date().toISOString(),stale=new Date(Date.now()-300000).toISOString();
  const claimed=await db.prepare(`UPDATE engineer_applications SET notification_status='sending',notification_claimed_at=?
    WHERE id=? AND (notification_status IN ('pending','failed') OR (notification_status='sending' AND notification_claimed_at<?)) RETURNING id`).bind(now,id,stale).first();
  if(!claimed)return;
  let delivered=false;
  try {
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',signal:AbortSignal.timeout(10000),
      headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':`engineer-application-${id}`},
      body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:['admin@vipoap.co.uk'],subject:'New VIPOAP engineer application',
        text:`A new application has been saved. Reference: ${applicationReference(id)}. Review it in VIPOAP OS: https://vipoap.co.uk/admin/applications`})
    });
    delivered=response.ok;
  } catch { /* The saved application remains available in the HQ queue. */ }
  await db.prepare('UPDATE engineer_applications SET notification_status=? WHERE id=? AND notification_claimed_at=?').bind(delivered?'sent':'failed',id,now).run();
}
