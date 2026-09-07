import {requireCustomer} from '../../_shared/customer-auth.js';
const clean=(value,max=300)=>String(value??'').trim().replace(/[<>]/g,'').slice(0,max);
export async function onRequestPost({request,env}){
  const session=await requireCustomer(request,env);if(!session)return Response.json({error:'Sign in to start membership.'},{status:401});
  if(!env.STRIPE_SECRET_KEY||!env.STRIPE_SUPPORT_MONTHLY_PRICE_ID)return Response.json({error:'Online membership signup is not configured yet.'},{status:503});
  const customer=await env.VIPOAP_DATA.get(session.customerId,'json');if(!customer)return Response.json({error:'Customer account not found.'},{status:404});
  if(customer.stripeSubscriptionId&&['active','trialing','past_due'].includes(customer.membershipStatus))return Response.json({error:'This account already has a Stripe membership.'},{status:409});
  const origin=new URL(request.url).origin,body=await request.json().catch(()=>({})),successUrl=clean(body.successUrl)||`${origin}/app/account?membership=success#membership`,cancelUrl=clean(body.cancelUrl)||`${origin}/app/account#membership`,embedded=Boolean(env.STRIPE_PUBLISHABLE_KEY),form=new URLSearchParams({mode:'subscription',client_reference_id:session.customerId,customer_email:customer.email||session.email,'line_items[0][price]':env.STRIPE_SUPPORT_MONTHLY_PRICE_ID,'line_items[0][quantity]':'1','metadata[type]':'membership','metadata[customer_id]':session.customerId,'metadata[plan]':'support','subscription_data[metadata][customer_id]':session.customerId,'subscription_data[metadata][plan]':'support'});
  if(embedded){form.set('ui_mode','embedded');form.set('return_url',successUrl)}else{form.set('success_url',successUrl);form.set('cancel_url',cancelUrl)}
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded','idempotency-key':`membership-${session.customerId}-${Math.floor(Date.now()/1800000)}`},body:form.toString()}),checkout=await response.json().catch(()=>({}));
  if(!response.ok||!checkout.id||embedded&&!checkout.client_secret||!embedded&&!checkout.url)return Response.json({error:checkout.error?.message||'Unable to start secure membership checkout.'},{status:503});
  const now=new Date().toISOString();await env.VIPOAP_DATA.put(`subscription-checkout:${checkout.id}`,JSON.stringify({customerId:session.customerId,plan:'support',status:'pending',providerPaymentId:checkout.id,createdAt:now,updatedAt:now}));
  return Response.json({ok:true,url:checkout.url||'',clientSecret:checkout.client_secret||'',publishableKey:embedded?env.STRIPE_PUBLISHABLE_KEY:'',id:checkout.id});
}
