(()=>{
  let data;
  const $=id=>document.getElementById(id);
  const money=pence=>`£${(Number(pence||0)/100).toFixed(2)}`;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const headers=()=>({'content-type':'application/json','x-admin-password':sessionStorage.getItem('vipoapAdmin')||'','x-admin-session':sessionStorage.getItem('vipoapAdminSession')||''});

  async function api(url,options={}){
    const response=await fetch(url,{...options,headers:{...headers(),...options.headers}}),payload=await response.json();
    if(!response.ok)throw Error(payload.error||'Unable to load payments.');
    return payload;
  }

  function managerControls(){
    if(!data.canManage||document.getElementById('payoutManager'))return;
    const section=document.createElement('section');
    section.id='payoutManager';section.className='card';
    section.innerHTML='<div class="row"><div><h2>Engineer payouts</h2><p class="muted">Choose an Engineer Partner, review completed work and record each transfer.</p></div><label><strong>Engineer Partner</strong><br><select id="operatorSelect"><option value="">Loading…</option></select></label></div>';
    document.querySelector('.metrics').before(section);
    api('/api/admin/operators').then(payload=>{
      const select=$('operatorSelect');
      select.innerHTML=(payload.operators||[]).map(item=>`<option value="${esc(item.id)}" ${item.id===data.operatorId?'selected':''}>${esc(item.name)}</option>`).join('');
      select.onchange=()=>load(select.value);
    }).catch(error=>$('status').textContent=error.message);
  }

  function render(){
    $('paid').textContent=money(data.summary.paidPence);$('awaiting').textContent=money(data.summary.awaitingPence);
    $('taxLabel').textContent=`Tax year ${data.taxYear.label}`;$('taxPaid').textContent=money(data.summary.taxYearPaidPence);
    $('taxJobs').textContent=`${data.summary.taxYearJobs} paid job${data.summary.taxYearJobs===1?'':'s'}`;
    const head=$('payments').closest('table').querySelector('thead tr');
    head.innerHTML='<th>Completed</th><th>Job</th><th>Service</th><th>Time</th><th>Amount</th><th>Status</th><th>Paid</th>'+(data.canManage?'<th>Action</th>':'');
    $('payments').innerHTML=data.payments.length?data.payments.map(item=>`<tr><td>${esc(item.date)}</td><td>${esc(item.reference)}</td><td>${esc(item.service)}<br><small>${esc(item.supportType)}</small></td><td>${item.duration} mins</td><td><strong>${money(item.amountPence)}</strong></td><td><span class="pill ${item.status==='paid'?'paid':''}">${esc(item.status)}</span></td><td>${item.paidAt?esc(new Date(item.paidAt).toLocaleDateString('en-GB')):'—'}${item.paymentReference?`<br><small>${esc(item.paymentReference)}</small>`:''}</td>${data.canManage?`<td>${item.status==='paid'?`<button class="btn secondary" data-awaiting="${esc(item.key)}">Undo</button>`:`<button class="btn" data-paid="${esc(item.key)}">Mark paid</button>`}</td>`:''}</tr>`).join(''):`<tr><td colspan="${data.canManage?8:7}">No completed paid work is recorded yet.</td></tr>`;
    managerControls();$('login').classList.add('hidden');$('app').classList.remove('hidden');
  }

  async function load(operatorId=''){data=await api(`/api/admin/my-payments${operatorId?`?operatorId=${encodeURIComponent(operatorId)}`:''}`);render()}
  async function updatePayment(key,status){
    const paymentReference=status==='paid'?(prompt('Enter the bank transfer or payment reference (optional):','')||''):'';
    $('status').textContent='Updating payout record…';
    await api('/api/admin/my-payments',{method:'PATCH',body:JSON.stringify({key,status,paymentReference})});
    await load($('operatorSelect')?.value||data.operatorId);$('status').textContent=status==='paid'?'Payout marked as paid.':'Payout returned to awaiting status.';
  }
  function csv(){
    if(!data)return;
    const rows=[['Completed','Job reference','Service','Support type','Minutes','Amount GBP','Status','Paid date','Payment reference'],...data.payments.map(item=>[item.date,item.reference,item.service,item.supportType,item.duration,(item.amountPence/100).toFixed(2),item.status,item.paidAt,item.paymentReference])];
    const output=rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\r\n'),link=document.createElement('a');
    link.href=URL.createObjectURL(new Blob([output],{type:'text/csv'}));link.download=`vipoap-payments-${data.operatorId}-${data.taxYear.label.replace('/','-')}.csv`;link.click();URL.revokeObjectURL(link.href);
  }
  $('download').onclick=csv;
  document.addEventListener('click',event=>{if(event.target.dataset.paid)updatePayment(event.target.dataset.paid,'paid').catch(error=>$('status').textContent=error.message);if(event.target.dataset.awaiting)updatePayment(event.target.dataset.awaiting,'awaiting').catch(error=>$('status').textContent=error.message)});
  if(sessionStorage.getItem('vipoapAdmin')||sessionStorage.getItem('vipoapAdminSession'))load().catch(error=>$('status').textContent=error.message);
})();
