import {adminContext,canAccessTerritory} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {platformRules} from '../../_shared/platform-rules.js';

async function records(kv,prefix){const page=await kv.list({prefix});return(await Promise.all(page.keys.map(async item=>({key:item.name,...await kv.get(item.name,'json')})))).filter(Boolean)}
const engineerId=item=>item.operatorId||item.assignedEngineerId||item.engineerId||'';
const completed=item=>['completed','complete','partially-resolved','unresolved'].includes(String(item.jobStatus||item.bookingStatus||item.status||'').toLowerCase());
const open=item=>!['completed','complete','resolved','closed','cancelled','declined'].includes(String(item.jobStatus||item.bookingStatus||item.status||'').toLowerCase());
const entitlement=(item,rules)=>{const stored=Number(item.providerEntitlementPence||0),minutes=Math.max(30,Number(item.duration)||30),home=item.supportType!=='Remote support',base=home?rules.engineerEntitlements.homeFirst30:rules.engineerEntitlements.remote30,increment=home?rules.engineerEntitlements.homeAdditional30:rules.engineerEntitlements.remoteAdditional30;return(stored||Math.round((base+Math.max(0,Math.ceil((minutes-30)/30))*increment)*100))+Number(item.providerAdditionalEntitlementPence||0)};

export async function onRequestGet({request,env}){
  const context=await adminContext(request,env);
  if(!hasPermission(context,'manage_operations'))return Response.json({error:'Administration access required.'},{status:403});
  const [operators,bookings,incidents,progress,rules]=await Promise.all([records(env.VIPOAP_DATA,'operator:'),records(env.VIPOAP_DATA,'booking:'),records(env.VIPOAP_DATA,'incident:'),records(env.VIPOAP_DATA,'training-progress:'),platformRules(env)]);
  const visibleBookings=bookings.filter(item=>canAccessTerritory(context,item.territoryId||'andover'));
  const visibleOperators=operators.filter(item=>(item.territoryIds||['andover']).some(id=>canAccessTerritory(context,id)));
  const today=new Date().toISOString().slice(0,10),activeIncidents=incidents.filter(item=>!['closed','resolved'].includes(String(item.status).toLowerCase()));
  const engineers=visibleOperators.map(operator=>{
    const jobs=visibleBookings.filter(item=>engineerId(item)===operator.id),awaiting=jobs.filter(item=>completed(item)&&!item.providerPaidAt&&item.providerPaymentStatus!=='paid');
    const courseProgress=progress.filter(item=>item.operatorId===operator.id),completeCourses=courseProgress.filter(item=>item.status==='complete').length;
    return{id:operator.id,name:operator.name||operator.id,email:operator.email||'',status:operator.status||'invited',trainingStatus:operator.trainingStatus||'not-started',trainingCompleted:completeCourses,dbsStatus:operator.dbsStatus||'not-recorded',dbsRenewalDate:operator.dbsRenewalDate||'',dbsOverdue:Boolean(operator.dbsRenewalDate&&operator.dbsRenewalDate<today),openJobs:jobs.filter(open).length,completedJobs:jobs.filter(completed).length,awaitingPaymentPence:awaiting.reduce((sum,item)=>sum+entitlement(item,rules),0)};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const awaitingJobs=visibleBookings.filter(item=>completed(item)&&!item.providerPaidAt&&item.providerPaymentStatus!=='paid');
  return Response.json({generatedAt:new Date().toISOString(),summary:{engineers:engineers.length,activeEngineers:engineers.filter(item=>item.status==='active').length,trainingComplete:engineers.filter(item=>item.trainingStatus==='complete').length,dbsCurrent:engineers.filter(item=>item.dbsStatus==='verified'&&!item.dbsOverdue).length,openJobs:visibleBookings.filter(open).length,overdueJobs:visibleBookings.filter(item=>open(item)&&item.date&&item.date<today).length,awaitingPayoutJobs:awaitingJobs.length,awaitingPayoutPence:awaitingJobs.reduce((sum,item)=>sum+entitlement(item,rules),0),openSafety:activeIncidents.length},engineers});
}
