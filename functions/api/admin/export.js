import {authorised} from '../../_shared/admin-auth.js';
const csv=value=>{let text=String(value??'');if(/^[=+\-@]/.test(text))text=`'${text}`;return `"${text.replace(/"/g,'""')}"`};
async function records(kv,prefix){const keys=await kv.list({prefix});return Promise.all(keys.keys.map(async key=>({key:key.name,...await kv.get(key.name,'json')})))}
export async function onRequestGet({request,env}){
  if(!await authorised(request,env,'export_data'))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  const kind=new URL(request.url).searchParams.get('type')||'customers';let headings=[],rows=[];
  if(kind==='customers'){headings=['Customer ID','Name','Phone','Email','Postcode','Address','Membership','Notes'];rows=(await records(env.VIPOAP_DATA,'customer:')).map(x=>[x.key,x.name,x.phone,x.email,x.postcode,x.address,x.membership,x.customerNotes])}
  else if(kind==='equipment'){headings=['Customer ID','Customer','Phone','Type','Brand','Model','Location','Ownership','Condition','Notes','Upgrade priority','Possible upgrade'];for(const customer of await records(env.VIPOAP_DATA,'customer:'))for(const item of customer.equipment||[])rows.push([customer.key,customer.name,customer.phone,item.type,item.brand,item.model,item.location,item.ownership,item.status,item.notes,item.upgradePriority,item.upgradeRecommendation])}
  else if(kind==='callouts'){headings=['Reference','Date','Customer','Phone','Postcode','Category','Minutes','Amount','Payment','Status','Problem and outcome','Work completed','Recommendations','Follow-up required','Follow-up date','Follow-up notes'];rows=(await records(env.VIPOAP_DATA,'callout:')).map(x=>[x.reference,x.date,x.customerName,x.phone,x.postcode,x.category,x.duration,x.amountCharged,x.paymentStatus,x.status,x.summary,x.actionsTaken,x.recommendations,x.followUpRequired?'Yes':'No',x.followUpDate,x.followUpNotes])}
  else if(kind==='invoices'){const customers=Object.fromEntries((await records(env.VIPOAP_DATA,'customer:')).map(x=>[x.key,x]));headings=['Invoice number','Issue date','Due date','Customer ID','Customer','Status','Subtotal','Total','Call-out key','Territory','Operator','Zoho sync status','Notes'];rows=(await records(env.VIPOAP_DATA,'invoice:')).map(x=>[x.number,x.issueDate,x.dueDate,x.customerId,customers[x.customerId]?.name||'',x.status,x.subtotal,x.total,x.calloutKey,x.territoryId,x.operatorId,x.zohoSyncStatus,x.notes])}
  else return Response.json({error:'Choose customers, equipment, callouts or invoices.'},{status:400});
  const output='\uFEFF'+[headings,...rows].map(row=>row.map(csv).join(',')).join('\r\n');
  return new Response(output,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="vipoap-${kind}-${new Date().toISOString().slice(0,10)}.csv"`,'cache-control':'no-store'}});
}
