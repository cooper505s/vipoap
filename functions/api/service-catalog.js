import {publicServiceCatalog} from '../_shared/service-catalog.js';
const CACHE='public, max-age=300, s-maxage=900';
function json(data,status=200){return Response.json(data,{status,headers:{'cache-control':CACHE}})}

export async function onRequestGet({env}){
  if(!env.VIPOAP_DB)return json(publicServiceCatalog());
  try{
    const categories=await env.VIPOAP_DB.prepare(`
      SELECT id,slug,name,public_name,description,display_order,requires_home_visit,allows_remote
      FROM service_categories
      WHERE status='active'
      ORDER BY display_order,public_name
    `).all();
    const services=await env.VIPOAP_DB.prepare(`
      SELECT id,category_id,slug,name,public_name,description,fulfilment_types,
             default_duration_minutes,min_duration_minutes,max_duration_minutes,display_order,metadata
      FROM services
      WHERE status='active'
      ORDER BY category_id,display_order,public_name
    `).all();
    const byCategory=new Map();
    for(const service of services.results||[]){
      let fulfilmentTypes=['home'];
      let metadata={};
      try{fulfilmentTypes=JSON.parse(service.fulfilment_types||'["home"]')}catch{}
      try{metadata=JSON.parse(service.metadata||'{}')}catch{}
      const item={id:service.id,slug:service.slug,name:service.public_name||service.name,description:service.description||'',fulfilmentTypes,defaultDurationMinutes:service.default_duration_minutes,minDurationMinutes:service.min_duration_minutes,maxDurationMinutes:service.max_duration_minutes,metadata};
      if(!byCategory.has(service.category_id))byCategory.set(service.category_id,[]);
      byCategory.get(service.category_id).push(item);
    }
    const result={categories:(categories.results||[]).map(category=>({id:category.id,slug:category.slug,name:category.public_name||category.name,description:category.description||'',requiresHomeVisit:Boolean(category.requires_home_visit),allowsRemote:Boolean(category.allows_remote),services:byCategory.get(category.id)||[]}))};
    return json(result.categories.length?result:publicServiceCatalog());
  }catch(error){
    console.error(JSON.stringify({event:'service_catalog_d1_fallback',message:error instanceof Error?error.message:'Unknown error'}));
    return json(publicServiceCatalog());
  }
}
