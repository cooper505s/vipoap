import {authorised} from '../../_shared/admin-auth.js';
function clean(value,max=1000){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}

export async function onRequestPost({request,env}){
  if(!await authorised(request,env,'manage_equipment'))return Response.json({error:'Unauthorised'},{status:401});
  const body=await request.json(),productKey=clean(body.productKey,200),customerId=clean(body.customerId,200),price=Math.round(Number(body.price)*100)/100,delivery=Math.round((Number(body.delivery)||0)*100)/100;
  const product=await env.VIPOAP_DATA.get(productKey,'json');
  if(!product||product.status!=='approved'||!customerId.startsWith('customer:')||!clean(body.reason)||!(price>0))return Response.json({error:'An approved product, customer, current price and reason are required.'},{status:400});
  const now=new Date().toISOString(),key=`equipment-recommendation:${crypto.randomUUID()}`,validUntil=clean(body.validUntil,10)||new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  const recommendation={customerId,bookingKey:clean(body.bookingKey,200),engineerId:clean(body.engineerId,100),productKey,productName:product.name,retailer:clean(body.retailer,150),listingUrl:clean(body.listingUrl,500),itemPrice:price,delivery,total:Math.round((price+delivery)*100)/100,reason:clean(body.reason),validUntil,status:'awaiting-customer',customerApproval:false,paymentStatus:'not-requested',createdAt:now,updatedAt:now};
  await env.VIPOAP_DATA.put(key,JSON.stringify(recommendation));return Response.json({ok:true,key,recommendation},{status:201});
}

export async function onRequestPatch({request,env}){
  if(!await authorised(request,env,'manage_equipment'))return Response.json({error:'Unauthorised'},{status:401});
  const body=await request.json(),key=clean(body.key,200),status=clean(body.status,40),allowed=['awaiting-customer','approved-awaiting-payment','paid-awaiting-purchase','purchased','in-delivery','ready-for-installation','installed','declined','return-open','refunded'];
  if(!key.startsWith('equipment-recommendation:')||!allowed.includes(status))return Response.json({error:'Invalid equipment update.'},{status:400});
  const item=await env.VIPOAP_DATA.get(key,'json');if(!item)return Response.json({error:'Recommendation not found.'},{status:404});
  const now=new Date().toISOString(),updated={...item,status,orderNumber:clean(body.orderNumber||item.orderNumber,100),receiptKey:clean(body.receiptKey||item.receiptKey,300),actualCost:Number.isFinite(Number(body.actualCost))?Math.round(Number(body.actualCost)*100)/100:item.actualCost,updatedAt:now};
  if(updated.actualCost>item.total&&status==='purchased')return Response.json({error:'Customer approval is required before spending above the authorised amount.'},{status:409});
  await env.VIPOAP_DATA.put(key,JSON.stringify(updated));return Response.json({ok:true,recommendation:updated});
}
