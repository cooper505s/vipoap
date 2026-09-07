const DEFAULT_TERRITORIES=[{id:'andover',name:'Andover',postcodePrefixes:['SP10','SP11'],status:'active'}];
const normalise=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const outward=postcode=>postcode.length>3?postcode.slice(0,-3):postcode;

export async function postcodeCoverage(env,value){
  const postcode=normalise(value);
  if(postcode.length<3)return{error:'Enter a valid UK postcode.'};
  let territories=DEFAULT_TERRITORIES;
  if(env.VIPOAP_DATA){
    const keys=await env.VIPOAP_DATA.list({prefix:'territory:'});
    const stored=(await Promise.all(keys.keys.map(key=>env.VIPOAP_DATA.get(key.name,'json')))).filter(item=>item?.id);
    if(stored.length)territories=stored;
  }
  const area=outward(postcode),territory=territories.find(item=>item.status==='active'&&(item.postcodePrefixes||[]).some(prefix=>area.startsWith(normalise(prefix))));
  return territory?{covered:true,area:territory.name,territoryId:territory.id,message:`Good news — VIPOAP currently covers ${territory.name}. You can request a home visit.`}:{covered:false,message:'We are not covering your postcode yet, but VIPOAP is expanding and we hope to be in your area soon.'};
}

export async function onRequestGet({request,env}){
  const result=await postcodeCoverage(env,new URL(request.url).searchParams.get('postcode'));
  if(result.error)return Response.json({error:result.error},{status:400});
  return Response.json(result,{headers:{'cache-control':'public, max-age=300'}});
}
