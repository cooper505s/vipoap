export const DEFAULT_RULES=Object.freeze({
  version:'v2-marketplace-launch',
  prices:{homeFirst30:39,homeFirstHour:64,homeAdditional30:25,remote30:15,remote60:25,remoteAdditional30:10,lateCancellation:15},
  engineerEntitlements:{homeFirst30:25,homeFirstHour:45,homeAdditional30:20,remote30:12.5,remote60:22.5,remoteAdditional30:10,lateCancellation:15},
  membership:{supportMonthly:7.99,supportAnnual:79,familyMonthly:12.99,familyAnnual:129,remoteMinutes:30,familyPeople:3,homeVisitDiscount:0},
  booking:{homeRadiusMiles:5,cancellationNoticeMinutes:60,slotHoldMinutes:10},
  onboarding:{home:69,remote:39},
  features:{franchiseCommercial:false,regionalPricing:false,operatorRevenueShare:false,remoteRecording:true}
});

function merge(base,overrides){const result={...base};for(const [key,value] of Object.entries(overrides||{}))result[key]=value&&typeof value==='object'&&!Array.isArray(value)?merge(base[key]||{},value):value;return result}
export async function platformRules(env){const saved=env.VIPOAP_DATA?await env.VIPOAP_DATA.get('config:platform-rules','json'):null;return merge(DEFAULT_RULES,saved||{})}
