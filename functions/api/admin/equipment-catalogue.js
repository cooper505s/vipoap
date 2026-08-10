import {authorised} from '../../_shared/admin-auth.js';
function clean(value,max=1000){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}
async function records(kv,prefix){const keys=await kv.list({prefix});return Promise.all(keys.keys.map(async key=>({key:key.name,...await kv.get(key.name,'json')})))}

export async function onRequestGet({request,env}){
  if(!await authorised(request,env,'manage_equipment'))return Response.json({error:'Unauthorised'},{status:401});
  const products=(await records(env.VIPOAP_DATA,'supported-product:')).filter(x=>x.status!=='retired').sort((a,b)=>(a.category||'').localeCompare(b.category||'')||(a.name||'').localeCompare(b.name||''));
  return Response.json({products});
}

export async function onRequestPost({request,env}){
  if(!await authorised(request,env,'manage_catalogue'))return Response.json({error:'Unauthorised'},{status:401});
  const body=await request.json(),name=clean(body.name,150),category=clean(body.category,80),status=clean(body.status||'review',20);
  if(!name||!category||!['approved','review','retired'].includes(status))return Response.json({error:'Name, category and valid status are required.'},{status:400});
  const now=new Date().toISOString(),key=clean(body.key,200)||`supported-product:${crypto.randomUUID()}`,product={name,category,manufacturer:clean(body.manufacturer,100),model:clean(body.model,100),status,typicalUse:clean(body.typicalUse),installationNotes:clean(body.installationNotes),limitations:clean(body.limitations),approvedRetailers:Array.isArray(body.approvedRetailers)?body.approvedRetailers.map(x=>clean(x,120)).filter(Boolean).slice(0,20):[],lastReviewed:clean(body.lastReviewed,10)||now.slice(0,10),updatedAt:now};
  await env.VIPOAP_DATA.put(key,JSON.stringify(product));return Response.json({ok:true,key,product},{status:201});
}

