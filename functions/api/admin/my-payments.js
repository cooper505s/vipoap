import {adminContext,canAccessTerritory} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {audit} from '../../_shared/audit.js';
import {platformRules} from '../../_shared/platform-rules.js';

const clean=(value,max=200)=>String(value??'').trim().replace(/[<>]/g,'').slice(0,max);
const completed=item=>['completed','complete','partially-resolved','unresolved'].includes(String(item.bookingStatus||item.status||item.jobStatus).toLowerCase());
function taxYear(date=new Date()){
  const year=date.getUTCFullYear(),start=Date.UTC(year,3,6),startYear=date.getTime()>=start?year:year-1;
  return{label:`${startYear}/${String(startYear+1).slice(-2)}`,from:`${startYear}-04-06`,to:`${startYear+1}-04-05`};
}
function calculatedEntitlement(item,rules){
  if(Number(item.providerEntitlementPence)>0)return Number(item.providerEntitlementPence);
  const minutes=Math.max(30,Number(item.duration)||30),home=item.supportType!=='Remote support',base=home?rules.engineerEntitlements.homeFirst30:rules.engineerEntitlements.remote30,increment=home?rules.engineerEntitlements.homeAdditional30:rules.engineerEntitlements.remoteAdditional30;
  return Math.round((base+Math.max(0,Math.ceil((minutes-30)/30))*increment)*100);
}
export async function onRequestGet({request,env}){
  const context=await adminContext(request,env);if(!hasPermission(context,'manage_calls'))return Response.json({error:'Engineer payment access required.'},{status:403});
  const url=new URL(request.url),requested=clean(url.searchParams.get('operatorId'),80),operatorId=hasPermission(context,'manage_billing')?(requested||context.operatorId):context.operatorId;if(!operatorId)return Response.json({error:'No Engineer Partner is linked to this account.'},{status:400});
  const keys=await env.VIPOAP_DATA.list({prefix:'booking:'}),rules=await platformRules(env),records=(await Promise.all(keys.keys.map(async key=>({key:key.name,...await env.VIPOAP_DATA.get(key.name,'json')})))).filter(item=>(item.operatorId||item.assignedEngineerId)===operatorId&&canAccessTerritory(context,item.territoryId||'andover')&&completed(item)).map(item=>{const extra=Number(item.providerAdditionalEntitlementPence||0),amountPence=calculatedEntitlement(item,rules)+extra,paid=Boolean(item.providerPaidAt||item.providerPaymentStatus==='paid');return{key:item.key,reference:item.reference||'',date:item.completedAt?.slice(0,10)||item.date||'',service:item.service||'',supportType:item.supportType||'',duration:Number(item.duration||0)+(item.additionalTime||[]).reduce((sum,entry)=>sum+Number(entry.minutes||0),0),amountPence,status:paid?'paid':'awaiting payout',paidAt:item.providerPaidAt||'',paymentReference:item.providerPaymentReference||''}}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const year=taxYear(),inYear=records.filter(item=>item.date>=year.from&&item.date<=year.to),sum=list=>list.reduce((total,item)=>total+item.amountPence,0);
  return Response.json({operatorId,taxYear:year,canManage:hasPermission(context,'manage_billing'),summary:{paidPence:sum(records.filter(item=>item.status==='paid')),awaitingPence:sum(records.filter(item=>item.status!=='paid')),taxYearPaidPence:sum(inYear.filter(item=>item.status==='paid')),taxYearJobs:inYear.filter(item=>item.status==='paid').length},payments:records});
}
export async function onRequestPatch({request,env}){
  const context=await adminContext(request,env);if(!hasPermission(context,'manage_billing'))return Response.json({error:'Billing management access required.'},{status:403});
  const body=await request.json(),key=clean(body.key,240),booking=key.startsWith('booking:')?await env.VIPOAP_DATA.get(key,'json'):null;if(!booking||!canAccessTerritory(context,booking.territoryId||'andover')||!completed(booking))return Response.json({error:'Completed job not found.'},{status:404});
  const now=new Date().toISOString(),paid=body.status==='paid',updated={...booking,providerPaymentStatus:paid?'paid':'awaiting-payout',providerPaidAt:paid?(booking.providerPaidAt||now):'',providerPaymentReference:paid?clean(body.paymentReference,100):'',updatedAt:now};await env.VIPOAP_DATA.put(key,JSON.stringify(updated));await audit(env,context,'update','engineer-payment',key,{status:updated.providerPaymentStatus,operatorId:booking.operatorId||booking.assignedEngineerId});return Response.json({ok:true,status:updated.providerPaymentStatus});
}
