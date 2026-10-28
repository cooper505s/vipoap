async function initialiseOverview(context) {
  const headers={'x-admin-password':sessionStorage.getItem('vipoapAdmin')||'','x-admin-session':sessionStorage.getItem('vipoapAdminSession')||''};
  const status=document.getElementById('overviewStatus');
  async function get(url){const response=await fetch(url,{headers}),data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load this service.');return data;}
  const results=await Promise.allSettled([get('/api/admin/control-overview'),get('/api/admin/health'),...(context.territoryIds?.includes('*')?[get('/api/admin/intake-summary')]:[])]);
  const intake=document.getElementById('intakeSummary');
  if(results[2]?.status==='fulfilled'){const data=results[2].value;intake.replaceChildren();for(const [text,url] of [[`Callbacks awaiting follow-up: ${data.callbacks}`,'/admin/callbacks'],[`New engineer applications: ${data.applications}`,'/admin/applications']]){const link=document.createElement('a');link.href=url;link.textContent=text;intake.append(link);}const note=document.createElement('span');note.className='fine-print';note.textContent=data.retention?.status==='ok'?'Record retention check is current.':data.retention?.status==='not-run'?'Record retention check has not run yet.':'Record retention check needs attention.';intake.append(note);}else if(results[2])intake.textContent='New request queues could not be checked. Open the queues directly.';
  if(results[0].status==='fulfilled') {
    const data=results[0].value;
    // Values are populated only from the authenticated API, never illustrative numbers.
    const metrics=data.metrics||data.summary||{};
    document.getElementById('engineerCount').textContent=metrics.activeEngineers??'—';
    document.getElementById('bookingCount').textContent=metrics.openJobs??'—';
    document.getElementById('incidentCount').textContent=metrics.openSafety??'—';
    status.textContent='Operational data loaded. Use the queues below to review individual records.';
  } else {status.textContent=results[0].reason.message;status.classList.add('error');}
  if(results[1].status==='fulfilled') {
    const data=results[1].value,attention=Object.values(data.services||{}).filter(service=>service.status!=='ok').length;
    document.getElementById('healthSummary').textContent=attention?`${attention} service checks need setup or review. Open the report for details.`:data.status==='ok'?'No exceptions reported by platform checks.':'Some platform checks need attention. Open the report for details.';
  }else document.getElementById('healthSummary').textContent='Platform checks could not be loaded. Open the report to investigate.';
}
window.vipoapWorkspaceReady?.then(context=>{if(context)initialiseOverview(context);});
