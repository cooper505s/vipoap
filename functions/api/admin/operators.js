import {allRecords} from '../../_shared/team.js';
import {adminContext,canAccessTerritory} from '../../_shared/admin-auth.js';
import {audit} from '../../_shared/audit.js';
import {hasPermission,roleFor,canGrantRole} from '../../_shared/permissions.js';
const clean=(v,m=500)=>String(v??'').trim().replace(/[<>]/g,'').slice(0,m),slug=v=>clean(v,80).toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
const FOUNDING_OPERATOR={key:'operator:dan-stevens',id:'dan-stevens',name:'Dan Stevens',email:'admin@vipoap.co.uk',role:'owner',status:'active',territoryIds:['andover'],serviceTypes:['home','remote'],configuredServiceTypes:['home','remote'],trainingStatus:'complete',dbsStatus:'not-recorded'};
function record(body){const configuredServiceTypes=[...new Set((Array.isArray(body.configuredServiceTypes)?body.configuredServiceTypes:Array.isArray(body.serviceTypes)?body.serviceTypes:['home','remote']).filter(value=>['home','remote'].includes(value)))],homeSuspended=body.homeSuspended===true,remoteSuspended=body.remoteSuspended===true,serviceTypes=configuredServiceTypes.filter(service=>!body[`${service}Suspended`]);return{id:slug(body.id||body.name),name:clean(body.name,100),email:clean(body.email,150).toLowerCase(),phone:clean(body.phone,40),role:slug(body.role||'operator'),status:clean(body.status||'invited',20),territoryIds:(Array.isArray(body.territoryIds)?body.territoryIds:[]).slice(0,30).map(x=>slug(x)).filter(Boolean),serviceTypes,configuredServiceTypes,homeSuspended,remoteSuspended,startDate:clean(body.startDate,10),trainingStatus:clean(body.trainingStatus||'not-started',30),dbsStatus:clean(body.dbsStatus||'not-recorded',30),dbsCheckedAt:clean(body.dbsCheckedAt,10),dbsRenewalDate:clean(body.dbsRenewalDate,10),agreementStatus:clean(body.agreementStatus||'not-issued',30),insuranceStatus:clean(body.insuranceStatus||'not-recorded',30),insuranceProvider:clean(body.insuranceProvider,100),insurancePolicyNumber:clean(body.insurancePolicyNumber,100),insuranceExpiryDate:clean(body.insuranceExpiryDate,10),notes:clean(body.notes,1500)}}
async function validRole(env,id){return Boolean(await roleFor(env,id))}
const validBody=body=>body&&typeof body==='object'&&!Array.isArray(body);
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const inScope=(context,operator)=>context.territoryIds.includes('*')||(operator.territoryIds?.length&&operator.territoryIds.every(id=>canAccessTerritory(context,id)));
async function mayManage(env,context,operator){return hasPermission(context,'manage_operators')&&inScope(context,operator)&&(context.permissions?.includes('*')||canGrantRole(context,await roleFor(env,operator.role||'operator')));}
async function duplicateEmail(env,email,key){return(await allRecords(env.VIPOAP_DATA,'operator:')).some(operator=>operator.key!==key&&operator.email?.trim().toLowerCase()===email)||(email==='admin@vipoap.co.uk'&&key!==FOUNDING_OPERATOR.key);}
async function parse(request){try{const body=await request.json();return validBody(body)?body:null}catch{return null}}
export async function onRequestGet({request,env}){
 const context=await adminContext(request,env);if(!context)return Response.json({error:'Unauthorised'},{status:401});
 const operators=(await allRecords(env.VIPOAP_DATA,'operator:')).filter(x=>x.id).map(operator=>({...operator,serviceTypes:Array.isArray(operator.serviceTypes)?operator.serviceTypes:['home','remote']}));if(!operators.length)operators.push({...FOUNDING_OPERATOR});
 const managers=hasPermission(context,'manage_operators')||hasPermission(context,'view_franchise');
 const visible=operators.filter(operator=>managers?(operator.territoryIds||[]).some(id=>canAccessTerritory(context,id)):operator.id===context.operatorId);
 return Response.json({operators:await Promise.all(visible.map(async operator=>({...operator,canEdit:await mayManage(env,context,operator)})))});
}
export async function onRequestPost({request,env}){
 const context=await adminContext(request,env);if(!hasPermission(context,'manage_operators'))return Response.json({error:'Operator management permission required.'},{status:403});const body=await parse(request);if(!body)return Response.json({error:'Check the account details.'},{status:400});
 const operator=record(body);if(!operator.id||!operator.name||!validEmail(operator.email)||!await validRole(env,operator.role)||!operator.territoryIds.length||!operator.serviceTypes.length||!['active','invited','paused','left'].includes(operator.status))return Response.json({error:'Complete the account, valid email, role, territories and services.'},{status:400});
 if(!await mayManage(env,context,operator))return Response.json({error:'You cannot grant this role or manage these territories.'},{status:403});
 const key=`operator:${operator.id}`;if(await env.VIPOAP_DATA.get(key)||await duplicateEmail(env,operator.email,key))return Response.json({error:'That account or email already exists.'},{status:409});
 const now=new Date().toISOString();await env.VIPOAP_DATA.put(key,JSON.stringify({...operator,createdAt:now,updatedAt:now}));await audit(env,context,'create','operator',key,{name:operator.name,role:operator.role});return Response.json({ok:true,key});
}
export async function onRequestPatch({request,env}){
 const context=await adminContext(request,env);if(!hasPermission(context,'manage_operators'))return Response.json({error:'Operator management permission required.'},{status:403});const body=await parse(request);if(!body)return Response.json({error:'Check the account details.'},{status:400});
 const key=clean(body.key,120),stored=key.startsWith('operator:')?await env.VIPOAP_DATA.get(key,'json'):null,existing=stored||(key===FOUNDING_OPERATOR.key?FOUNDING_OPERATOR:null);if(!existing)return Response.json({error:'Operator not found.'},{status:404});
 if(!await mayManage(env,context,existing))return Response.json({error:'This account requires a higher access level or different territory access.'},{status:403});
 const operator=record({...existing,...body,id:existing.id});if(!operator.name||!validEmail(operator.email)||!await validRole(env,operator.role)||!operator.territoryIds.length||!operator.serviceTypes.length||!['active','invited','paused','left'].includes(operator.status))return Response.json({error:'Complete the account, valid email, role, territories and services.'},{status:400});
 if(!await mayManage(env,context,operator))return Response.json({error:'You cannot grant this role or manage these territories.'},{status:403});
 if(await duplicateEmail(env,operator.email,key))return Response.json({error:'That email already belongs to another account.'},{status:409});
 await env.VIPOAP_DATA.put(key,JSON.stringify({...existing,...operator,updatedAt:new Date().toISOString()}));await audit(env,context,'update','operator',key,{name:operator.name,role:operator.role,status:operator.status,serviceTypes:operator.serviceTypes,homeSuspended:operator.homeSuspended,remoteSuspended:operator.remoteSuspended});return Response.json({ok:true,key});
}
