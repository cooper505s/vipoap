import {adminContext} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {applicationJson} from '../../_shared/applications.js';
const states=['received','reviewing','contacted','closed'];
async function access(request,env) {const context=await adminContext(request,env);return hasPermission(context,'manage_followups')&&context.territoryIds?.includes('*')?context:null;}
export async function onRequestGet({request,env}) {
  if(!await access(request,env))return applicationJson({error:'Central follow-up access is required.'},403);
  if(!env.VIPOAP_DB)return applicationJson({error:'Callback storage is not configured.'},503);
  const url=new URL(request.url),status=url.searchParams.get('status')||'',search=(url.searchParams.get('search')||'').trim(),cursor=url.searchParams.get('cursor')||'',parts=cursor.split('|');
  if((status&&!states.includes(status))||search.length>100||(cursor&&(parts.length!==2||!Number.isFinite(Date.parse(parts[0]))||!/^[a-f0-9-]{36}$/i.test(parts[1]))))return applicationJson({error:'Please refresh your search.'},400);
  try {
    const where=['expires_at>?'],args=[new Date().toISOString()];
    if(status){where.push('status=?');args.push(status);}
    if(search){where.push("instr(lower(name||' '||phone||' '||best_time),lower(?))>0");args.push(search);}
    if(cursor){where.push('(created_at<? OR (created_at=? AND id<?))');args.push(parts[0],parts[0],parts[1]);}
    const {results}=await env.VIPOAP_DB.prepare(`SELECT id,name,phone,best_time,message,status,created_at,updated_at FROM callback_requests WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT 51`).bind(...args).all();
    const callbacks=results.slice(0,50),last=callbacks.at(-1);
    return applicationJson({callbacks,nextCursor:results.length>50?`${last.created_at}|${last.id}`:null});
  }catch{return applicationJson({error:'We could not load callback requests. Please try again.'},503);}
}
export async function onRequestPatch({request,env}) {
  const context=await access(request,env);if(!context)return applicationJson({error:'Central follow-up access is required.'},403);
  if(!env.VIPOAP_DB)return applicationJson({error:'Callback storage is not configured.'},503);
  let body;try{body=await request.json();}catch{return applicationJson({error:'Please check the update.'},400);}
  if(!body||!/^[a-f0-9-]{36}$/i.test(body.id||'')||!states.includes(body.status)||!Number.isFinite(Date.parse(body.updatedAt)))return applicationJson({error:'Choose a valid request and status.'},400);
  try {
    const now=new Date(Math.max(Date.now(),Date.parse(body.updatedAt)+1)).toISOString();
    const results=await env.VIPOAP_DB.batch([
      env.VIPOAP_DB.prepare('UPDATE callback_requests SET status=?,updated_at=? WHERE id=? AND updated_at=?').bind(body.status,now,body.id,body.updatedAt),
      env.VIPOAP_DB.prepare('INSERT INTO callback_audit (id,callback_id,actor,action,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),body.id,context.email,`status:${body.status}`,now)
    ]);
    if(!results[0].meta.changes)return applicationJson({error:'The request changed. Refresh it before saving.'},409);
    return applicationJson({ok:true,updatedAt:now});
  }catch{return applicationJson({error:'We could not save that change. Please try again.'},503);}
}
