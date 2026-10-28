import {adminContext} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {applicationJson,notifyApplication} from '../../_shared/applications.js';

async function access(request,env) {
  const context=await adminContext(request,env);
  return hasPermission(context,'manage_operators')&&context.territoryIds?.includes('*')?context:null;
}
const states=['received','reviewing','contacted','closed'];

export async function onRequestGet({request,env}) {
  if(!await access(request,env))return applicationJson({error:'Central recruitment access is required.'},403);
  if(!env.VIPOAP_DB)return applicationJson({error:'The application store is not configured.'},503);
  const url=new URL(request.url),status=url.searchParams.get('status')||'',cursor=url.searchParams.get('cursor')||'',search=(url.searchParams.get('search')||'').trim();
  if(search.length>100)return applicationJson({error:'Please shorten your search.'},400);
  if(status&&!states.includes(status))return applicationJson({error:'Choose a valid application status.'},400);
  const parts=cursor.split('|');
  if(cursor&&(parts.length!==2||!Number.isFinite(Date.parse(parts[0]))||!/^[a-f0-9-]{36}$/i.test(parts[1])))return applicationJson({error:'Please refresh the application list.'},400);
  try {
    const where=['expires_at>?'],args=[new Date().toISOString()];
    if(search){where.push("instr(lower(name||' '||email||' '||area),lower(?))>0");args.push(search);}
    if(status){where.push('status=?');args.push(status);}
    if(cursor){where.push('(created_at<? OR (created_at=? AND id<?))');args.push(parts[0],parts[0],parts[1]);}
    const query=`SELECT id,name,email,phone,area,experience,availability,skills,motivation,status,notification_status,created_at,updated_at,expires_at FROM engineer_applications ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY created_at DESC,id DESC LIMIT 51`;
    const {results}=await env.VIPOAP_DB.prepare(query).bind(...args).all(),page=results.slice(0,50),last=page.at(-1);
    return applicationJson({applications:page,nextCursor:results.length>50?`${last.created_at}|${last.id}`:null,notificationsEnabled:env.APPLICATION_NOTIFICATIONS_ENABLED==='true'});
  } catch {return applicationJson({error:'We could not load applications. Please try again.'},503);}
}

export async function onRequestPatch({request,env,waitUntil}) {
  const context=await access(request,env);
  if(!context)return applicationJson({error:'Central recruitment access is required.'},403);
  if(!env.VIPOAP_DB)return applicationJson({error:'The application store is not configured.'},503);
  let body;try{body=await request.json();}catch{return applicationJson({error:'Please check the request.'},400);}
  if(!body||typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return applicationJson({error:'Choose a valid application.'},400);
  try {
    const record=await env.VIPOAP_DB.prepare('SELECT id,updated_at FROM engineer_applications WHERE id=?').bind(body.id).first();
    if(!record)return applicationJson({error:'Application not found.'},404);
    if(body.action==='retry-notification') {
      if(env.APPLICATION_NOTIFICATIONS_ENABLED!=='true')return applicationJson({error:'Email notifications are disabled in this environment. Applications remain saved.'},409);
      await env.VIPOAP_DB.prepare('INSERT INTO application_audit (id,application_id,actor,action,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),body.id,context.email,'retry-notification',new Date().toISOString()).run();
      const job=notifyApplication(env,body.id).catch(()=>{});if(waitUntil)waitUntil(job);else await job;
      return applicationJson({ok:true});
    }
    if(!states.includes(body.status)||body.updatedAt!==record.updated_at)return applicationJson({error:'This record changed. Refresh it before saving.'},409);
    const now=new Date(Math.max(Date.now(),Date.parse(record.updated_at)+1)).toISOString();
    const results=await env.VIPOAP_DB.batch([
      env.VIPOAP_DB.prepare('UPDATE engineer_applications SET status=?,updated_at=? WHERE id=? AND updated_at=?').bind(body.status,now,body.id,body.updatedAt),
      env.VIPOAP_DB.prepare('INSERT INTO application_audit (id,application_id,actor,action,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),body.id,context.email,`status:${body.status}`,now)
    ]);
    if(!results[0].meta.changes)return applicationJson({error:'This record changed. Refresh it before saving.'},409);
    return applicationJson({ok:true,updatedAt:now});
  } catch {return applicationJson({error:'We could not save this change. Please try again.'},503);}
}
