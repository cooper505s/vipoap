export const DEFAULT_RULES=Object.freeze({
  version:'v6-member-service-discounts',
  prices:{homeFirst30:49,homeFirstHour:79,homeAdditional30:30,remote30:25,remote60:45,remoteAdditional30:20,lateCancellation:15},
  engineerEntitlements:{homeFirst30:25,homeFirstHour:45,homeAdditional30:20,remote30:17.5,remote60:31.5,remoteAdditional30:14,lateCancellation:15},
  membership:{supportMonthly:7.99,supportAnnual:79,familyMonthly:12.99,familyAnnual:129,remoteMinutes:0,memberRemote30:20,engineerRemote30:14,familyPeople:3,homeVisitDiscount:5},
  booking:{homeRadiusMiles:5,cancellationNoticeMinutes:60,slotHoldMinutes:10},
  onboarding:{home:69,remote:39},
  features:{franchiseCommercial:false,regionalPricing:false,operatorRevenueShare:false,remoteRecording:true}
});

function merge(base,overrides){const result={...base};for(const [key,value] of Object.entries(overrides||{}))result[key]=value&&typeof value==='object'&&!Array.isArray(value)?merge(base[key]||{},value):value;return result}
export async function platformRules(env){const saved=env.VIPOAP_DATA?await env.VIPOAP_DATA.get('config:platform-rules','json'):null,result=merge(DEFAULT_RULES,saved||{});if(saved?.version!==DEFAULT_RULES.version){result.version=DEFAULT_RULES.version;result.prices={...DEFAULT_RULES.prices};result.engineerEntitlements={...DEFAULT_RULES.engineerEntitlements};result.membership={...DEFAULT_RULES.membership}}return result}
