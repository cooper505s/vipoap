import {findService,serviceSupports,TECHNOLOGY_CATEGORY} from './service-catalog.js';

const ACTIVE_PRICING={
  home:{
    30:{customerPence:3900,providerEntitlementPence:2500,platformFeePence:1400},
    60:{customerPence:6400,providerEntitlementPence:4500,platformFeePence:1900},
    90:{customerPence:8900,providerEntitlementPence:6500,platformFeePence:2400},
    120:{customerPence:11400,providerEntitlementPence:8500,platformFeePence:2900}
  },
  remote:{30:{customerPence:2500,providerEntitlementPence:0,platformFeePence:2500},60:{customerPence:4500,providerEntitlementPence:0,platformFeePence:4500}}
};

function fulfilmentType(supportType){return String(supportType||'').toLowerCase().includes('remote')?'remote':'home'}
export function money(pence){return `£${(Number(pence||0)/100).toFixed(2).replace(/\.00$/,'')}`}

export function resolveBookingService({service,supportType,duration}){
  const item=findService(service);
  if(!item)return{error:'Please choose a valid Technology service.'};
  const fulfilment=fulfilmentType(supportType),minutes=Number(duration);
  if(!Number.isFinite(minutes))return{error:'Please choose a valid appointment length for this service.'};
  return{categoryId:TECHNOLOGY_CATEGORY.id,serviceId:item.id,serviceName:item.name,serviceSlug:item.slug,fulfilmentType:fulfilment,fulfilmentSupported:serviceSupports(item,fulfilment),durationWithinCatalog:minutes>=(item.minDurationMinutes||0)&&minutes<=(item.maxDurationMinutes||Infinity)};
}

export function resolveBookingPricing({supportType,duration}){
  const fulfilment=fulfilmentType(supportType),rule=ACTIVE_PRICING[fulfilment]?.[Number(duration)];
  if(!rule)return null;
  return{pricingRuleId:`technology-${fulfilment}-${duration}`,billingModel:fulfilment==='home'?'time_blocks':'fixed',currency:'GBP',...rule,price:money(rule.customerPence),source:'active-config'};
}

export async function resolveBookingPricingFromEnvironment(env,{categoryId,serviceId,supportType,duration,territoryId='andover'}){
  const fallback=resolveBookingPricing({supportType,duration});
  if(!env?.VIPOAP_DB||!serviceId)return fallback;
  try{
    const fulfilment=fulfilmentType(supportType),today=new Date().toISOString().slice(0,10),row=await env.VIPOAP_DB.prepare(`
      SELECT id,billing_model,currency,customer_base_pence,customer_increment_pence,base_minutes,increment_minutes,
             provider_base_pence,provider_increment_pence,platform_fee_mode,platform_fee_value
      FROM pricing_rules
      WHERE status='active'
        AND fulfilment_type=?1
        AND (service_id=?2 OR (service_id IS NULL AND category_id=?3))
        AND (territory_id=?4 OR territory_id IS NULL)
        AND (valid_from IS NULL OR valid_from<=?5)
        AND (valid_to IS NULL OR valid_to>=?5)
      ORDER BY CASE WHEN service_id=?2 THEN 0 ELSE 1 END,
               CASE WHEN territory_id=?4 THEN 0 ELSE 1 END,
               valid_from DESC
      LIMIT 1
    `).bind(fulfilment,serviceId,categoryId,territoryId,today).first();
    if(!row)return fallback;
    const minutes=Number(duration),baseMinutes=Number(row.base_minutes||minutes||0),incrementMinutes=Number(row.increment_minutes||0);
    let customerPence=Number(row.customer_base_pence||0),providerEntitlementPence=Number(row.provider_base_pence||0);
    if(row.billing_model==='time_blocks'&&incrementMinutes>0&&minutes>baseMinutes){
      const blocks=Math.ceil((minutes-baseMinutes)/incrementMinutes);
      customerPence+=blocks*Number(row.customer_increment_pence||0);
      providerEntitlementPence+=blocks*Number(row.provider_increment_pence||0);
    }else if(row.billing_model==='hourly'&&minutes>0){
      customerPence=Math.round(Number(row.customer_base_pence||0)*(minutes/60));
      providerEntitlementPence=Math.round(Number(row.provider_base_pence||0)*(minutes/60));
    }
    let platformFeePence=Math.max(0,customerPence-providerEntitlementPence);
    if(row.platform_fee_mode==='fixed')platformFeePence=Number(row.platform_fee_value||0);
    if(row.platform_fee_mode==='percentage')platformFeePence=Math.round(customerPence*(Number(row.platform_fee_value||0)/10000));
    return{pricingRuleId:row.id,billingModel:row.billing_model,currency:row.currency||'GBP',customerPence,providerEntitlementPence,platformFeePence,price:money(customerPence),source:'d1'};
  }catch(error){
    console.error(JSON.stringify({event:'pricing_rule_lookup_failed',serviceId,territoryId,message:error instanceof Error?error.message:'Unknown error'}));
    return fallback;
  }
}

function postcodeMatches(postcode,patterns=[]){
  const compact=String(postcode||'').toUpperCase().replace(/\s+/g,'');
  if(!compact)return false;
  return patterns.some(value=>{const pattern=String(value||'').toUpperCase().replace(/\s+/g,'');return pattern==='*'||compact.startsWith(pattern.replace(/\*$/,''))});
}

export function providerEligible(operator,{serviceId,fulfilmentType,postcode,territoryId}){
  if(!operator)return true;
  const legacyTypes=Array.isArray(operator.serviceTypes)?operator.serviceTypes:[];
  if(legacyTypes.length&&!legacyTypes.includes(fulfilmentType))return false;

  const approvals=Array.isArray(operator.providerServices)?operator.providerServices:Array.isArray(operator.approvedServiceIds)?operator.approvedServiceIds.map(id=>({serviceId:id,status:'approved'})):[];
  if(approvals.length&&!approvals.some(item=>(typeof item==='string'?item:item.serviceId)===serviceId&&(typeof item==='string'||!item.status||item.status==='approved')))return false;

  const areas=Array.isArray(operator.serviceAreas)?operator.serviceAreas:[];
  if(areas.length){
    const matches=areas.some(area=>(!area.status||area.status==='active')&&(!area.territoryId||area.territoryId===territoryId)&&(!area.serviceId||area.serviceId===serviceId)&&(!area.fulfilmentType||area.fulfilmentType===fulfilmentType)&&postcodeMatches(postcode,[area.postcodePattern||area.postcode||'*']));
    if(!matches)return false;
  }
  return true;
}
