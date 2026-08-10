import {platformRules} from './platform-rules.js';

export function billingPeriod(subscription,date=new Date()){
  const start=new Date(subscription.currentPeriodStart||subscription.membershipStartDate||date);
  const end=new Date(subscription.currentPeriodEnd||subscription.membershipRenewalDate||date);
  return{start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}

export async function membershipEntitlement(env,customerId,personId=''){
  const customer=await env.VIPOAP_DATA.get(customerId,'json');if(!customer)return null;
  const plan=customer.membershipPlan||customer.membership||'none',active=customer.membershipStatus==='active';
  const rules=await platformRules(env),period=billingPeriod(customer),keys=await env.VIPOAP_DATA.list({prefix:`membership-usage:${customerId}:`});
  const usage=(await Promise.all(keys.keys.map(k=>env.VIPOAP_DATA.get(k.name,'json')))).filter(x=>x&&x.periodStart===period.start&&x.status!=='reversed');
  const minutesUsed=usage.reduce((sum,x)=>sum+Number(x.minutes||0),0),allowance=active&&['support','family'].includes(plan)?rules.membership.remoteMinutes:0;
  const people=Array.isArray(customer.membershipPeople)?customer.membershipPeople:[];
  const personCovered=plan!=='family'||!personId||people.some(x=>(x.id||x.customerId)===personId);
  return{customerId,plan,active,personCovered,period,allowanceMinutes:allowance,minutesUsed,minutesRemaining:Math.max(0,allowance-minutesUsed),priorityBooking:active,annualCheckupAvailable:active&&!customer.annualCheckupCompletedAt};
}

