export const completedBooking=item=>['completed','complete','partially-resolved','unresolved'].includes(String(item.bookingStatus||item.status||item.jobStatus).toLowerCase());

export function providerEntitlementPence(item,rules){
  const home=item.supportType!=='Remote support',paid=Boolean(item.providerPaidAt||item.providerPaymentStatus==='paid');
  if(Number(item.providerEntitlementPence)>0&&(home||paid))return Number(item.providerEntitlementPence)+Number(item.providerAdditionalEntitlementPence||0);
  if(String(item.key||'').startsWith('callout:'))return Math.round((home?rules.engineerEntitlements.homeFirst30:rules.engineerEntitlements.remote30)*100)+Number(item.providerAdditionalEntitlementPence||0);
  const minutes=Math.max(30,Number(item.duration)||30),base=home?rules.engineerEntitlements.homeFirst30:rules.engineerEntitlements.remote30,increment=home?rules.engineerEntitlements.homeAdditional30:rules.engineerEntitlements.remoteAdditional30;
  return Math.round((base+Math.max(0,Math.ceil((minutes-30)/30))*increment)*100)+Number(item.providerAdditionalEntitlementPence||0);
}
