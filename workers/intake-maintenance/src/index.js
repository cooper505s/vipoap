export async function retainIntake(env,scheduledTime=Date.now()) {
  if(!env.VIPOAP_DB)throw Error('Intake storage is not configured.');
  const now=new Date(scheduledTime),cutoff=now.toISOString();
  await env.VIPOAP_DB.batch([
    env.VIPOAP_DB.prepare('DELETE FROM application_audit WHERE application_id IN (SELECT id FROM engineer_applications WHERE expires_at<=?)').bind(cutoff),
    env.VIPOAP_DB.prepare('DELETE FROM engineer_applications WHERE expires_at<=?').bind(cutoff),
    env.VIPOAP_DB.prepare('DELETE FROM callback_audit WHERE callback_id IN (SELECT id FROM callback_requests WHERE expires_at<=?)').bind(cutoff),
    env.VIPOAP_DB.prepare('DELETE FROM callback_requests WHERE expires_at<=?').bind(cutoff),
    env.VIPOAP_DB.prepare('DELETE FROM application_rate_limits WHERE expires_at<=?').bind(now.getTime()),
    env.VIPOAP_DB.prepare("INSERT INTO intake_maintenance (id,completed_at,status) VALUES ('retention',?,'ok') ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at,status=excluded.status").bind(cutoff)
  ]);
}
export default {
  async scheduled(event,env) {await retainIntake(env,event.scheduledTime);},
  async fetch(){return new Response('Not found',{status:404});}
};
