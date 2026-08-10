import {adminContext} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';

async function records(kv,prefix){
  const keys=await kv.list({prefix});
  return (await Promise.all(keys.keys.map(async key=>({key:key.name,...await kv.get(key.name,'json')})))).filter(Boolean);
}
const territoryOf=record=>record.territoryId||'andover';
const completed=record=>['completed','complete','closed','done'].includes(String(record.status||'').toLowerCase());

export async function onRequestGet({request,env}){
  const context=await adminContext(request,env);
  if(!context)return Response.json({error:'Unauthorised'},{status:401});
  if(!hasPermission(context,'view_franchise'))return Response.json({error:'Franchise reporting permission required.'},{status:403});
  const requested=new URL(request.url).searchParams.get('territory')||'';
  const allowed=context.territoryIds.includes('*')||context.territoryIds.includes(requested);
  if(requested&&!allowed)return Response.json({error:'Territory access denied.'},{status:403});
  const filter=items=>requested?items.filter(x=>territoryOf(x)===requested):context.territoryIds.includes('*')?items:items.filter(x=>context.territoryIds.includes(territoryOf(x)));
  const [customers,bookings,callouts,invoices]=await Promise.all(['customer:','booking:','callout:','invoice:'].map(prefix=>records(env.VIPOAP_DATA,prefix).then(filter)));
  const linkedBookingKeys=new Set(callouts.map(x=>x.linkedBookingKey).filter(Boolean));
  const completedCallouts=callouts.filter(completed);
  const completedBookingFallbacks=bookings.filter(x=>completed(x)&&!linkedBookingKeys.has(x.key));
  const completedVisits=[
    ...completedCallouts.map(x=>({key:x.key,kind:'call-out',reference:x.reference||'',date:x.date||'',customerName:x.customerName||'',summary:x.summary||x.actionsTaken||'',amount:Number(x.amountCharged)||0,paymentStatus:x.paymentStatus||'',territoryId:territoryOf(x)})),
    ...completedBookingFallbacks.map(x=>({key:x.key,kind:'booking',reference:x.reference||'',date:x.date||'',customerName:x.name||'',summary:x.service||x.details||'',amount:0,paymentStatus:'',territoryId:territoryOf(x)}))
  ].sort((a,b)=>b.date.localeCompare(a.date));
  const paidInvoices=invoices.filter(x=>x.status==='paid');
  const outstandingInvoices=invoices.filter(x=>['draft','sent'].includes(x.status));
  const invoicedCalloutKeys=new Set(invoices.map(x=>x.calloutKey).filter(Boolean));
  const directPaidCallouts=callouts.filter(x=>x.paymentStatus==='paid'&&!invoicedCalloutKeys.has(x.key));
  const directOutstandingCallouts=callouts.filter(x=>['unpaid','invoiced'].includes(x.paymentStatus)&&!invoicedCalloutKeys.has(x.key));
  const revenueFor=id=>paidInvoices.filter(x=>territoryOf(x)===id).reduce((s,x)=>s+Number(x.total||0),0)+directPaidCallouts.filter(x=>territoryOf(x)===id).reduce((s,x)=>s+Number(x.amountCharged||0),0);
  const revenue=paidInvoices.reduce((s,x)=>s+Number(x.total||0),0)+directPaidCallouts.reduce((s,x)=>s+Number(x.amountCharged||0),0);
  const paidPartnerCalls=completedCallouts.filter(x=>x.paymentStatus==='paid'||paidInvoices.some(i=>i.calloutKey===x.key));
  const engineerPayout=paidPartnerCalls.length*25,vipoapCommission=Math.max(0,revenue-engineerPayout);
  const outstanding=outstandingInvoices.reduce((s,x)=>s+Number(x.total||0),0)+directOutstandingCallouts.reduce((s,x)=>s+Number(x.amountCharged||0),0);
  const territories=[...new Set([...customers,...bookings,...callouts,...invoices].map(territoryOf))];
  return Response.json({territory:requested||'all-authorised',metrics:{territories:territories.length,customers:customers.length,members:customers.filter(x=>x.membershipStatus==='active').length,bookings:bookings.length,completedCallouts:completedVisits.length,revenue,engineerPayout,vipoapCommission,outstanding,averageInvoice:completedVisits.length?revenue/completedVisits.length:0},commercialModel:{standardCustomerPrice:30,memberCustomerPrice:30,engineerPayment:25,standardCommission:5,memberCommission:5,membershipHomeVisitDiscount:0},completedVisits:completedVisits.slice(0,50),byTerritory:territories.map(id=>({id,customers:customers.filter(x=>territoryOf(x)===id).length,callouts:completedVisits.filter(x=>x.territoryId===id).length,revenue:revenueFor(id)}))});
}
