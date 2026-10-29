import {adminContext} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {allRecords} from '../../_shared/team.js';
import {companyRoster} from '../../_shared/company-roster.js';
import {audit} from '../../_shared/audit.js';
export async function onRequestPost({request,env}){
 const context=await adminContext(request,env);
 if(!hasPermission(context,'manage_operators')||!context.territoryIds?.includes('*'))return Response.json({error:'Company-wide staff management required.'},{status:403});
 let body;try{body=await request.json()}catch{return Response.json({error:'Invalid setup request.'},{status:400})}
 if(!body||Object.keys(body).length!==1||body.action!=='add-agreed-team')return Response.json({error:'Invalid setup request.'},{status:400});
 const existing=await allRecords(env.VIPOAP_DATA,'staff:'),records=new Map(),pending=[];
 for(const role of companyRoster){const match=existing.find(person=>person.templateId===role.templateId||(person.kind===role.kind&&person.name?.trim().toLowerCase()===role.name.toLowerCase()));if(match){records.set(role.templateId,match);continue}if(existing.some(person=>person.key===role.key))return Response.json({error:'A reserved staff identifier is already in use. Review the directory before setup.'},{status:409});records.set(role.templateId,role);pending.push(role)}
 const now=new Date().toISOString();let created=0;
 for(const role of pending){const {key,reportsToTemplateId,...fields}=role;const record={...fields,reportsTo:reportsToTemplateId?records.get(reportsToTemplateId).key:'',territoryIds:['*'],status:role.phase==='phase-2'?'inactive':'active',connectionStatus:role.kind==='ai'?'not-connected':'no-login-provisioned',createdAt:now,updatedAt:now};await env.VIPOAP_DATA.put(key,JSON.stringify(record));await audit(env,context,'create','staff',key,{kind:role.kind,team:role.team,source:'agreed-company-roster'});created++}
 return Response.json({ok:true,created,existing:companyRoster.length-created});
}
