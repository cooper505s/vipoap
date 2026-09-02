import {findService,serviceSupports,TECHNOLOGY_CATEGORY} from './service-catalog.js';

const LEGACY_PRICING={
  home:{60:{customerPence:3000,providerEntitlementPence:0,platformFeePence:0}},
  remote:{30:{customerPence:1500,providerEntitlementPence:0,platformFeePence:0},60:{customerPence:2500,providerEntitlementPence:0,platformFeePence:0}}
};

function fulfilmentType(supportType){return String(supportType||'').toLowerCase().includes('remote')?'remote':'home'}
export function money(pence){return `£${(Number(pence||0)/100).toFixed(2).replace(/\.00$/,'')}`}

export function resolveBookingService({service,supportType,duration}){
  const item=findService(service);
  if(!item)return{error:'Please choose a valid Technology service.'};
  const fulfilment=fulfilmentType(supportType);
  if(!serviceSupports(item,fulfilment))return{error:`${item.name} is not currently available by ${fulfilment==='remote'?'remote support':'home visit'}.`};
  const minutes=Number(duration);
  if(!Number.isFinite(minutes)||minutes<(item.minDurationMinutes||0)||minutes>(item.maxDurationMinutes||Infinity))return{error:'Please choose a valid appointment length for this service.'};
  return{categoryId:TECHNOLOGY_CATEGORY.id,serviceId:item.id,serviceName:item.name,serviceSlug:item.slug,fulfilmentType:fulfilment};
}

export function resolveBookingPricing({supportType,duration}){
  const fulfilment=fulfilmentType(supportType),rule=LEGACY_PRICING[fulfilment]?.[Number(duration)];
  if(!rule)return null;
  return{pricingRuleId:`legacy-${fulfilment}-${duration}`,billingModel:'fixed',currency:'GBP',...rule,price:money(rule.customerPence)};
}

function postcodeMatches(postcode,patterns=[]){
  const compact=String(postcode||'').toUpperCase().replace(/\s+/g,'');
  if(!compact)return false;
  return patterns.some(value=>{const pattern=String(value||'').toUpperCase().replace(/\s+/g,'');return pattern==='*'||compact.startsWith(pattern.replace(/\*$/,''))});
}

export function providerEligible(operator,{serviceId,fulfilmentType,postcode,territoryId}){
  if(!operator)return true; // legacy single-provider fallback remains valid
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
