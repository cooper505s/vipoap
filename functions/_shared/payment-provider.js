function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function sign(secret,payload){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)))}
function safeEqual(expected,actual){const a=new TextEncoder().encode(expected),b=new TextEncoder().encode(String(actual).toLowerCase());if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0}
export async function verifySignature(secret,payload,signature){if(!secret||!signature)return false;return safeEqual(await sign(secret,payload),signature)}
export async function verifyStripeSignature(secret,payload,header,toleranceSeconds=300){if(!secret||!header)return false;const parts=Object.fromEntries(String(header).split(',').map(x=>x.split('=',2))),timestamp=Number(parts.t);if(!timestamp||Math.abs(Date.now()/1000-timestamp)>toleranceSeconds)return false;return safeEqual(await sign(secret,`${timestamp}.${payload}`),parts.v1)}
export async function createCheckout(env,payload,idempotencyKey){
  if(!env.STRIPE_SECRET_KEY)throw new Error('Stripe Checkout is not configured yet.');
  const form=new URLSearchParams({mode:'payment',client_reference_id:payload.reference,customer_email:payload.customer.email,success_url:payload.successUrl,cancel_url:payload.cancelUrl,'line_items[0][quantity]':'1','line_items[0][price_data][currency]':'gbp','line_items[0][price_data][unit_amount]':String(payload.amount),'line_items[0][price_data][product_data][name]':payload.description,'payment_intent_data[receipt_email]':payload.customer.email});
  if(payload.expiresAt)form.set('expires_at',String(payload.expiresAt));
  for(const [key,value] of Object.entries(payload.metadata||{})){form.set(`metadata[${key}]`,String(value));form.set(`payment_intent_data[metadata][${key}]`,String(value))}
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded','idempotency-key':idempotencyKey},body:form.toString()});
  const data=await response.json().catch(()=>({}));if(!response.ok||!data.url||!data.id)throw new Error(data.error?.message||'Unable to create Stripe Checkout.');return{id:data.id,checkoutUrl:data.url};
}
