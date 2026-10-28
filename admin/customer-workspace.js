(() => {
  const app=document.getElementById('app'),select=document.getElementById('customerSelect'),editor=document.getElementById('editor');
  if(!app||!select||!editor)return;
  const directory=select.closest('section');directory.classList.add('customer-directory');
  directory.querySelector('h2').textContent='Customers';
  const field=select.closest('.field');field.hidden=true;
  const search=document.createElement('input');search.id='customerSearch';search.type='search';search.placeholder='Name, phone or postcode';
  const label=document.createElement('label');label.htmlFor=search.id;label.textContent='Search customers';directory.append(label,search);
  const count=document.createElement('p');count.className='muted';count.setAttribute('role','status');directory.append(count);
  const list=document.createElement('div');list.className='customer-results';list.setAttribute('aria-label','Customer records');directory.append(list);
  const layout=document.createElement('div');layout.className='customer-workspace-layout';directory.before(layout);layout.append(directory);layout.classList.add('directory-first');
  const dialog=document.createElement('dialog');dialog.className='record-dialog';dialog.setAttribute('aria-label','Customer record');const close=document.createElement('button');close.type='button';close.className='button dialog-dismiss';close.textContent='Close';dialog.append(close);document.body.append(dialog);
  const record=document.createElement('div');record.className='customer-record';dialog.append(record);
  function closeRecord(){if(mayLeave()){dirty=false;dialog.close()}}close.onclick=closeRecord;dialog.addEventListener('cancel',event=>{event.preventDefault();closeRecord()});
  const heading=document.createElement('div');heading.className='customer-record-heading';
  const title=document.createElement('h2'),subtitle=document.createElement('p');subtitle.className='muted';heading.append(title,subtitle);const ticket=document.createElement('button');ticket.type='button';ticket.className='button';ticket.textContent='Create Helpdesk ticket';ticket.dataset.requiresPermission='manage_calls';ticket.onclick=()=>{dialog.close();document.dispatchEvent(new CustomEvent('vipoap-create-ticket',{detail:{title:'Customer follow-up',customerName:current?.name||'Customer',summary:'Follow up this customer record.',parentTicketId:current?.key||''}}))};heading.append(ticket);record.append(heading);
  const saveBar=document.createElement('div');saveBar.className='customer-save-bar';saveBar.append(document.getElementById('saveCustomer'),document.getElementById('saveStatus'));record.append(saveBar);
  const tabs=document.createElement('div');tabs.className='customer-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Customer record sections');record.append(tabs);
  const definitions=[
    ['Profile',[editor]],
    ['Equipment',[document.getElementById('equipment')?.closest('section')]],
    ['Files',[document.getElementById('files')?.closest('section')]],
    ['History',[document.getElementById('visits')?.closest('section'),document.getElementById('customerTimeline')]],
    ['Contact',[document.getElementById('communicationPreference')?.closest('section')]],
    ['Exports',[document.getElementById('exports')],'export_data']
  ];
  const entries=[];
  function activate(entry,focus=false){for(const item of entries){const active=item===entry;item.button.setAttribute('aria-selected',String(active));item.button.tabIndex=active?0:-1;item.panel.hidden=!active;}if(focus)entry.button.focus();}
  for(const [name,sections,permission] of definitions){
    const existing=sections.filter(Boolean);if(!existing.length)continue;
    const id=`customer-panel-${name.toLowerCase()}`,button=document.createElement('button');button.type='button';button.id=`${id}-tab`;button.textContent=name;button.setAttribute('role','tab');button.setAttribute('aria-controls',id);
    if(permission)button.dataset.requiresPermission=permission;
    const panel=document.createElement('div');panel.id=id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;panel.className='customer-record-panel';panel.append(...existing);
    const entry={button,panel};entries.push(entry);button.onclick=()=>activate(entry);tabs.append(button);record.append(panel);
    button.onkeydown=event=>{const visible=entries.filter(item=>!item.button.hidden),index=visible.indexOf(entry);let next;if(event.key==='ArrowRight')next=visible[(index+1)%visible.length];if(event.key==='ArrowLeft')next=visible[(index-1+visible.length)%visible.length];if(event.key==='Home')next=visible[0];if(event.key==='End')next=visible.at(-1);if(next){event.preventDefault();activate(next,true);}};
  }
  activate(entries[0]);
  let dirty=false;
  function mayLeave(){return !dirty||confirm('Discard unsaved customer changes and open another record?');}
  function draw(){
    const query=search.value.trim().toLowerCase(),records=customers.filter(item=>[item.name,item.phone,item.email,item.postcode].some(value=>String(value||'').toLowerCase().includes(query)));
    list.replaceChildren();count.textContent=`${records.length} customer${records.length===1?'':'s'}${query?' found':''}`;
    for(const customer of records){const button=document.createElement('button');button.type='button';button.className='customer-result';button.setAttribute('aria-pressed',String(select.value===customer.key));const name=document.createElement('strong'),detail=document.createElement('span');name.textContent=customer.name||'Unnamed customer';detail.textContent=[customer.postcode,customer.phone].filter(Boolean).join(' · ');const membership=document.createElement('span');membership.className='badge';membership.textContent=customer.membershipPlan||customer.membership||'PAYG';button.append(name,detail,membership);button.onclick=()=>{if(!mayLeave())return;dirty=false;select.value=customer.key;choose(customer.key);select.dispatchEvent(new Event('change',{bubbles:true}));draw();if(!dialog.open)dialog.showModal();};list.append(button);}
    if(!records.length){const empty=document.createElement('p');empty.className='muted';empty.textContent=query?'No customers match this search.':'No customer records yet. Use Add customer to create the first record.';list.append(empty);}
  }
  function summary(){title.textContent=current?.key?current.name||'Customer record':'New customer';const plan=current?.membershipPlan||current?.membership;subtitle.textContent=current?.key?[current.postcode,!plan||plan==='none'?'No membership':`${plan[0].toUpperCase()}${plan.slice(1)} membership`].filter(Boolean).join(' · '):'Add contact details, then save the record.';draw();}
  search.oninput=draw;
  document.addEventListener('customers-loaded',draw);
  document.addEventListener('customer-selected',summary);
  document.addEventListener('customer-saved',()=>{dirty=false;summary();});
  editor.addEventListener('input',()=>{dirty=true;});
  document.getElementById('equipment')?.addEventListener('input',()=>{dirty=true;});
  for(const id of ['addEquipment','fileUpload'])document.getElementById(id)?.addEventListener(id==='fileUpload'?'change':'click',()=>{dirty=true;});
  record.addEventListener('click',event=>{if(event.target.closest('[data-remove-equipment],[data-remove-file]'))dirty=true;});
  document.getElementById('newCustomer').addEventListener('click',event=>{if(!mayLeave()){event.preventDefault();event.stopImmediatePropagation();return;}dirty=false;select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));activate(entries[0]);},true);
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  document.getElementById('newCustomer').addEventListener('click',()=>{if(!dialog.open)dialog.showModal()});
  summary();
})();
