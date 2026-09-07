import {adminContext,canAccessTerritory} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {audit} from '../../_shared/audit.js';
import {platformRules} from '../../_shared/platform-rules.js';
import {completedBooking,providerEntitlementPence} from '../../_shared/provider-entitlement.js';
const clean=(value,max=200)=>String(value??'').trim().replace(/[<>]/g,'').slice(0,max);
export async function onRequestPost({request,env}){
  const context=await adminContext(request,env);if(!hasPermission(context,'manage_billing'))return Response.json({error:'HQ billing access required.'},{status:403});
  const body=await request.json().catch(()=>({})),key=clean(body.bookingKey,240),booking=/^(booking|callout):/.test(key)?await env.VIPOAP_DATA.get(key,'json'):null;if(!booking||!completedBooking(booking)||!canAccessTerritory(context,booking.territoryId||'andover'))return Response.json({error:'Completed job not found.'},{status:404});
  if(booking.providerPaidAt||booking.providerPaymentStatus==='paid'||booking.providerStripeTransferId)return Response.json({error:'This engineer payment has already been recorded.'},{status:409});
  if(body.confirm!==booking.reference)return Response.json({error:'Confirm the job reference before sending this payment.'},{status:400});
  const operatorId=booking.operatorId||booking.assignedEngineerId,operator=operatorId?await env.VIPOAP_DATA.get(`operator:${operatorId}`,'json'):null;if(!operator?.stripeConnectedAccountId||!operator.stripePayoutsEnabled)return Response.json({error:'This engineer must finish Stripe Connect onboarding before payment can be sent.'},{status:409});
  if(!env.STRIPE_SECRET_KEY)return Response.json({error:'Stripe is not configured yet.'},{status:503});const amount=providerEntitlementPence(booking,await platformRules(env)),form=new URLSearchParams({amount:String(amount),currency:'gbp',destination:operator.stripeConnectedAccountId,transfer_group:`JOB_${booking.reference}`,'metadata[booking_key]':key,'metadata[booking_reference]':booking.reference||'','metadata[operator_id]':operatorId});
  const response=await fetch('https://api.stripe.com/v1/transfers',{method:'POST',headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded','idempotency-key':`engineer-payout-${booking.reference}`},body:form.toString()}),transfer=await response.json().catch(()=>({}));if(!response.ok||!transfer.id)return Response.json({error:transfer.error?.message||'Stripe could not send this engineer payment.'},{status:503});
  const now=new Date().toISOString(),updated={...booking,providerPaymentStatus:'paid',providerPaidAt:now,providerPaymentReference:transfer.id,providerStripeTransferId:transfer.id,providerPaymentMethod:'stripe-connect',updatedAt:now};await env.VIPOAP_DATA.put(key,JSON.stringify(updated));await audit(env,context,'pay','engineer-payment',key,{operatorId,amountPence:amount,provider:'stripe-connect'});return Response.json({ok:true,transferId:transfer.id,amountPence:amount});
}
