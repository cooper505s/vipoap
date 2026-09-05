import {adminContext,canAccessTerritory} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {audit} from '../../_shared/audit.js';

const clean=(value,max=1200)=>String(value??'').trim().replace(/[<>]/g,'').slice(0,max);
const LEVELS={good:100,monitor:75,attention:50,urgent:20};
export const HEALTH_DOMAINS=[
  {id:'broadband',label:'Broadband speed and stability'},
  {id:'wifi',label:'Wi-Fi coverage and reliability'},
  {id:'accounts',label:'Passwords and account protection'},
  {id:'updates',label:'Software and device updates'},
  {id:'backup',label:'Photos and important-file backups'},
  {id:'devices',label:'Device condition and support'},
  {id:'smartHome',label:'Printers, TVs and smart-home devices'},
  {id:'scamAwareness',label:'Scam awareness and safe checking'}
];

function automaticRecommendations(answers){
  return HEALTH_DOMAINS.flatMap(({id,label})=>{
    if(answers[id]==='urgent')return [`${label}: requires prompt action.`];
    if(answers[id]==='attention')return [`${label}: improvement recommended.`];
    if(answers[id]==='monitor')return [`${label}: monitor and review at the next visit.`];
    return [];
  });
}
async function list(env,prefix){
  const keys=await env.VIPOAP_DATA.list({prefix});
  return Promise.all(keys.keys.map(async key=>({key:key.name,...await env.VIPOAP_DATA.get(key.name,'json')})));
}
function validAnswer(value){return value==='not-applicable'||Object.hasOwn(LEVELS,value)}

export async function onRequestGet({request,env}){
  const context=await adminContext(request,env);
  if(!hasPermission(context,'manage_customers'))return Response.json({error:'Administrator customer access required.'},{status:403});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  const customerId=clean(new URL(request.url).searchParams.get('customerId'),120);
  const customer=customerId.startsWith('customer:')?await env.VIPOAP_DATA.get(customerId,'json'):null;
  if(!customer||!canAccessTerritory(context,customer.territoryId||'andover'))return Response.json({error:'Customer not found.'},{status:404});
  const checks=(await list(env,`health-check:${customerId}:`)).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)));
  return Response.json({customer:{id:customerId,name:customer.name,technologyScore:customer.technologyScore||null},domains:HEALTH_DOMAINS,checks});
}

export async function onRequestPost({request,env}){
  const context=await adminContext(request,env);
  if(!hasPermission(context,'manage_customers'))return Response.json({error:'Administrator customer access required.'},{status:403});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  let body;try{body=await request.json()}catch{return Response.json({error:'Invalid assessment.'},{status:400})}
  const customerId=clean(body.customerId,120);
  const customer=customerId.startsWith('customer:')?await env.VIPOAP_DATA.get(customerId,'json'):null;
  if(!customer||!canAccessTerritory(context,customer.territoryId||'andover'))return Response.json({error:'Customer not found.'},{status:404});
  const answers=Object.fromEntries(HEALTH_DOMAINS.map(({id})=>[id,clean(body.answers?.[id],20)]));
  if(HEALTH_DOMAINS.some(({id})=>!validAnswer(answers[id])))return Response.json({error:'Complete every assessment area or choose Not checked / not applicable.'},{status:400});
  const assessed=HEALTH_DOMAINS.filter(({id})=>answers[id]!=='not-applicable');
  if(!assessed.length)return Response.json({error:'Assess at least one area before completing the health check.'},{status:400});
  const scores=Object.fromEntries(HEALTH_DOMAINS.map(({id})=>[`${id}Score`,answers[id]==='not-applicable'?null:LEVELS[answers[id]]]));
  const overallScore=Math.round(assessed.reduce((sum,{id})=>sum+LEVELS[answers[id]],0)/assessed.length);
  const notes=Object.fromEntries(HEALTH_DOMAINS.map(({id})=>[id,clean(body.notes?.[id],600)]));
  const automatic=automaticRecommendations(answers),extra=clean(body.recommendations,1200),recommendations=[...automatic,...(extra?[extra]:[])];
  const now=new Date(),reviewDays=overallScore<50?30:overallScore<75?90:365,nextReviewDue=new Date(now.getTime()+reviewDays*86400000).toISOString().slice(0,10),id=crypto.randomUUID(),key=`health-check:${customerId}:${now.toISOString()}:${id}`;
  const record={id,customerId,territoryId:customer.territoryId||'andover',operatorId:context.operatorId,answers,notes,...scores,overallScore,recommendations,observations:clean(body.observations,1500),completedAt:now.toISOString(),completedBy:context.email,nextReviewDue};
  await env.VIPOAP_DATA.put(key,JSON.stringify(record));
  await env.VIPOAP_DATA.put(customerId,JSON.stringify({...customer,technologyScore:overallScore,technologyScoreUpdatedAt:record.completedAt,nextHealthReviewDue:nextReviewDue,updatedAt:record.completedAt}));
  if(overallScore<60){
    const followId=crypto.randomUUID(),followKey=`followup:${followId}`;
    await env.VIPOAP_DATA.put(followKey,JSON.stringify({id:followId,customerId,customerName:customer.name,territoryId:record.territoryId,operatorId:context.operatorId,sourceType:'health-check',sourceKey:key,dueDate:new Date(now.getTime()+14*86400000).toISOString().slice(0,10),status:'open',notes:recommendations.join(' '),createdAt:record.completedAt,updatedAt:record.completedAt}));
  }
  await audit(env,context,'complete','health-check',key,{customerId,overallScore,nextReviewDue});
  return Response.json({ok:true,key,check:record});
}
