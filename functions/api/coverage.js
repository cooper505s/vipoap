const DEFAULT_TERRITORIES=[{id:'andover',name:'Andover',postcodePrefixes:['SP10','SP11'],status:'active'}];
const normalise=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const outward=postcode=>postcode.length>3?postcode.slice(0,-3):postcode;

export async function onRequestGet({request,env}){
  const postcode=normalise(new URL(request.url).searchParams.get('postcode'));
  if(postcode.length<3)return Response.json({error:'Enter a valid UK postcode.'},{status:400});
  let territories=DEFAULT_TERRITORIES;
  if(env.VIPOAP_DATA){
    const keys=await env.VIPOAP_DATA.list({prefix:'territory:'});
    const stored=(await Promise.all(keys.keys.map(key=>env.VIPOAP_DATA.get(key.name,'json')))).filter(item=>item?.id);
    if(stored.length)territories=stored;
  }
  const area=outward(postcode),territory=territories.find(item=>item.status==='active'&&(item.postcodePrefixes||[]).some(prefix=>area.startsWith(normalise(prefix))));
  return Response.json(territory?{covered:true,area:territory.name,message:`Good news — VIPOAP currently covers ${territory.name}. You can request a home visit.`}:{covered:false,message:'We are not covering your postcode yet, but VIPOAP is expanding and we hope to be in your area soon.'},{headers:{'cache-control':'public, max-age=300'}});
}
