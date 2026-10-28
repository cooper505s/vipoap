document.addEventListener('workspace-ready',() => {
  const queue=document.getElementById('applicationQueue'),detail=document.getElementById('applicationDetail'),status=document.getElementById('queueStatus'),filter=document.getElementById('applicationFilter'),search=document.getElementById('applicationSearch'),more=document.getElementById('moreApplications');
  const headers=()=>({'content-type':'application/json','x-admin-session':sessionStorage.getItem('vipoapAdminSession')||'','x-admin-password':sessionStorage.getItem('vipoapAdmin')||''});
  const states={received:'Received',reviewing:'Under review',contacted:'Contacted',closed:'Closed'};
  let nextCursor=null,busy=false,selected='',applications=[],notificationsEnabled=false;
  async function api(url,options={}) {const response=await fetch(url,{...options,headers:headers()}),data=await response.json();if(!response.ok)throw Error(data.error||'Please try again.');return data;}
  function node(tag,text,className='') {const el=document.createElement(tag);el.textContent=text;el.className=className;return el;}
  function show(application) {
    selected=application.id;
    for(const row of queue.children)row.setAttribute('aria-pressed',String(row.dataset.applicationId===selected));
    detail.replaceChildren(node('h2',application.name),node('p',`APP-${application.id}`,'record-reference'));
    const list=node('dl','','detail-meta');
    for(const [label,value] of [['Email',application.email],['Telephone',application.phone],['Coverage area',application.area],['Experience',application.experience],['Availability',application.availability],['Received',new Date(application.created_at).toLocaleString('en-GB')]]){const group=document.createElement('div');group.append(node('dt',label),node('dd',value));list.append(group);}
    detail.append(list);
    for(const [label,value] of [['Technology experience',application.skills],['Why VIPOAP',application.motivation]]){const section=node('section','','detail-text');section.append(node('h3',label),node('p',value));detail.append(section);}
    const actions=node('section','','detail-form'),label=node('label','Review status');label.htmlFor='reviewStatus';
    const select=document.createElement('select');select.id=label.htmlFor;
    for(const [value,text] of Object.entries(states)){const option=node('option',text);option.value=value;select.append(option);}select.value=application.status;
    const save=node('button','Save status','button primary');save.type='button';const feedback=node('p','','status-note');feedback.setAttribute('role','status');
    save.onclick=async()=>{save.disabled=true;try{const result=await api('/api/admin/applications',{method:'PATCH',body:JSON.stringify({id:application.id,status:select.value,updatedAt:application.updated_at})});application.updated_at=result.updatedAt;application.status=select.value;const row=[...queue.children].find(el=>el.dataset.applicationId===selected);if(row)row.querySelector('.badge').textContent=states[application.status];feedback.textContent='Status saved. Engineer access is unchanged.';}catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}};
    actions.append(label,select,save,feedback,node('p',notificationsEnabled?`HQ email notification: ${application.notification_status}`:'Email notifications are disabled in this environment.','fine-print'));
    if(notificationsEnabled&&application.notification_status!=='sent') {const retry=node('button','Retry notification','button');retry.type='button';retry.onclick=async()=>{retry.disabled=true;try{await api('/api/admin/applications',{method:'PATCH',body:JSON.stringify({id:application.id,action:'retry-notification'})});feedback.textContent='Retry requested. Refresh to check delivery status.';}catch(error){feedback.textContent=error.message;}finally{retry.disabled=false;}};actions.append(retry);}
    detail.append(actions);
  }
  function row(application) {const button=node('button','','application-row');button.type='button';button.dataset.applicationId=application.id;button.setAttribute('aria-pressed',String(application.id===selected));button.append(node('strong',application.name),node('span',`${application.area} · ${new Date(application.created_at).toLocaleDateString('en-GB')}`),node('span',states[application.status],'badge'));button.onclick=()=>show(application);return button;}
  async function load(append=false) {
    if(busy)return;busy=true;more.disabled=true;status.textContent='Loading applications…';
    try {const query=new URLSearchParams({status:filter.value,search:search.value.trim()});if(append&&nextCursor)query.set('cursor',nextCursor);const data=await api(`/api/admin/applications?${query}`);if(!append){queue.replaceChildren();applications=[];}notificationsEnabled=data.notificationsEnabled===true;applications.push(...data.applications);for(const application of data.applications)queue.append(row(application));nextCursor=data.nextCursor;more.hidden=!nextCursor;status.textContent=applications.length?`${applications.length} applications shown.`:'No applications match this view.';const active=applications.find(a=>a.id===selected)||applications[0];if(active)show(active);else{selected='';detail.replaceChildren(node('div','No applications to review.','empty-state'));}}
    catch(error){status.textContent=error.message;status.classList.add('error');}finally{busy=false;more.disabled=false;}
  }
  filter.onchange=()=>load();search.onkeydown=event=>{if(event.key==='Enter')load();};document.getElementById('refreshApplications').onclick=()=>load();more.onclick=()=>load(true);load();
});
