import {adminContext} from '../../_shared/admin-auth.js';
import {hasPermission} from '../../_shared/permissions.js';
import {applicationJson} from '../../_shared/applications.js';
export async function onRequestGet({request,env}) {
  const context=await adminContext(request,env);
  if(!hasPermission(context,'manage_operations')||!context.territoryIds?.includes('*'))return applicationJson({error:'Central operations access is required.'},403);
  if(!env.VIPOAP_DB)return applicationJson({error:'Intake storage is not configured.'},503);
  try {
    const now=new Date().toISOString();
    const [applications,callbacks,maintenance]=await Promise.all([
      env.VIPOAP_DB.prepare("SELECT count(*) AS count FROM engineer_applications WHERE status='received' AND expires_at>?").bind(now).first(),
      env.VIPOAP_DB.prepare("SELECT count(*) AS count FROM callback_requests WHERE status IN ('received','reviewing') AND expires_at>?").bind(now).first(),
      env.VIPOAP_DB.prepare("SELECT completed_at,status FROM intake_maintenance WHERE id='retention'").first()
    ]);
    return applicationJson({applications:applications.count,callbacks:callbacks.count,generatedAt:now,retention:{lastRunAt:maintenance?.completed_at||null,status:!maintenance?'not-run':Date.now()-Date.parse(maintenance.completed_at)>36*3600000?'stale':maintenance.status}});
  }catch{return applicationJson({error:'Intake queues could not be checked.'},503);}
}
