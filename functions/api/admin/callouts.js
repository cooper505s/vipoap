function authorised(request,env){return !!env.ADMIN_PASSWORD&&request.headers.get('x-admin-password')===env.ADMIN_PASSWORD}
function clean(value,max=1500){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}
function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function normalise(body){
  const duration=Number(body.duration),amountCharged=Number(body.amountCharged||0);
  return {
    linkedBookingKey:clean(body.linkedBookingKey,200),date:clean(body.date,10),customerName:clean(body.customerName,100),phone:clean(body.phone,40),postcode:clean(body.postcode,20),category:clean(body.category,60),duration:Number.isFinite(duration)?duration:0,amountCharged:Number.isFinite(amountCharged)?Math.round(amountCharged*100)/100:0,paymentStatus:clean(body.paymentStatus,20),summary:clean(body.summary,1500),actionsTaken:clean(body.actionsTaken,2500),recommendations:clean(body.recommendations,1500),followUpRequired:Boolean(body.followUpRequired),followUpDate:clean(body.followUpDate,10),followUpNotes:clean(body.followUpNotes,1000),status:clean(body.status,20)
  };
}
function validate(record){
  if(!record.customerName||!validDate(record.date)||!record.summary)return 'Enter the visit date, customer name and a short summary.';
  if(![30,60,90,120].includes(record.duration))return 'Choose a valid visit length.';
  if(record.amountCharged<0||record.amountCharged>100000)return 'Enter a valid amount charged.';
  if(!['paid','unpaid','invoiced','waived'].includes(record.paymentStatus))return 'Choose a valid payment status.';
  if(!['completed','follow-up','open'].includes(record.status))return 'Choose a valid call-out status.';
  if(record.followUpRequired&&record.followUpDate&&!validDate(record.followUpDate))return 'Enter a valid follow-up date.';
  if(record.linkedBookingKey&&!record.linkedBookingKey.startsWith('booking:'))return 'Invalid linked booking.';
  return '';
}

export async function onRequestGet({request,env}){
  if(!authorised(request,env))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  const keys=await env.VIPOAP_DATA.list({prefix:'callout:'});
  const callouts=(await Promise.all(keys.keys.map(async key=>({key:key.name,...await env.VIPOAP_DATA.get(key.name,'json')})))).filter(item=>item.reference).sort((a,b)=>`${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`));
  return Response.json({callouts});
}

export async function onRequestPost({request,env}){
  if(!authorised(request,env))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  let body;try{body=await request.json()}catch{return Response.json({error:'Invalid call-out record.'},{status:400})}
  const record=normalise(body),error=validate(record);if(error)return Response.json({error},{status:400});
  const now=new Date().toISOString(),reference=`CO-${crypto.randomUUID().split('-')[0].toUpperCase()}`,key=`callout:${record.date}:${crypto.randomUUID()}`;
  await env.VIPOAP_DATA.put(key,JSON.stringify({...record,reference,createdAt:now,updatedAt:now}));
  console.log(JSON.stringify({event:'callout_created',reference,date:record.date,status:record.status}));
  return Response.json({ok:true,key,reference});
}

export async function onRequestPatch({request,env}){
  if(!authorised(request,env))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  let body;try{body=await request.json()}catch{return Response.json({error:'Invalid call-out record.'},{status:400})}
  const key=clean(body.key,250);if(!key.startsWith('callout:'))return Response.json({error:'Invalid call-out key.'},{status:400});
  const existing=await env.VIPOAP_DATA.get(key,'json');if(!existing)return Response.json({error:'Call-out not found.'},{status:404});
  const record=normalise(body),error=validate(record);if(error)return Response.json({error},{status:400});
  await env.VIPOAP_DATA.put(key,JSON.stringify({...existing,...record,updatedAt:new Date().toISOString()}));
  console.log(JSON.stringify({event:'callout_updated',reference:existing.reference,status:record.status}));
  return Response.json({ok:true,key,reference:existing.reference});
}
