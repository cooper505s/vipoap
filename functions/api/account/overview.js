import {requireCustomer} from '../../_shared/customer-auth.js';
import {membershipEntitlement} from '../../_shared/membership.js';
async function records(kv,prefix){const keys=await kv.list({prefix});return Promise.all(keys.keys.map(async k=>({key:k.name,...await kv.get(k.name,'json')})))}
export async function onRequestGet({request,env}){
  const session=await requireCustomer(request,env);if(!session)return Response.json({error:'Please sign in.'},{status:401});
  const customer=await env.VIPOAP_DATA.get(session.customerId,'json');if(!customer)return Response.json({error:'Account not found.'},{status:404});
  const [bookings,receipts,recommendations,delegates,helpRequests]=await Promise.all([records(env.VIPOAP_DATA,'booking:'),records(env.VIPOAP_DATA,'invoice:'),records(env.VIPOAP_DATA,'equipment-recommendation:'),records(env.VIPOAP_DATA,'delegated-access:'),records(env.VIPOAP_DATA,'help-request:')]);
  const own=x=>x.customerId===session.customerId,redacted={id:session.customerId,name:customer.name,email:customer.email,phone:customer.phone,postcode:customer.postcode,preferredContact:customer.preferredContact||'',accessibilityPreferences:customer.accessibilityPreferences||'',membershipPlan:customer.membershipPlan||customer.membership||'none'};
  return Response.json({customer:redacted,entitlement:await membershipEntitlement(env,session.customerId),appointments:bookings.filter(own).sort((a,b)=>`${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),helpRequests:helpRequests.filter(own).map(x=>({reference:x.reference,status:x.status,category:x.category,updatedAt:x.updatedAt})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),receipts:receipts.filter(own),equipment:recommendations.filter(own),delegatedAccess:delegates.filter(x=>x.customerId===session.customerId||x.delegateCustomerId===session.customerId).map(x=>({key:x.key,customerId:x.customerId,delegateCustomerId:x.delegateCustomerId,permissions:x.permissions,status:x.status}))});
}

