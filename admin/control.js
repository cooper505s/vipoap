document.addEventListener('workspace-ready',async()=>{
  const headers={'x-admin-password':sessionStorage.getItem('vipoapAdmin')||'','x-admin-session':sessionStorage.getItem('vipoapAdminSession')||''};
  const status=document.getElementById('overviewStatus');
  async function get(url){const response=await fetch(url,{headers}),data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load this service.');return data;}
  const results=await Promise.allSettled([get('/api/admin/control-overview'),get('/api/admin/health')]);
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
});
