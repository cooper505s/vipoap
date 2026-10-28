(() => {
  const headers=()=>({'x-admin-password':sessionStorage.getItem('vipoapAdmin')||'','x-admin-session':sessionStorage.getItem('vipoapAdminSession')||''});
  const icons={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3z',list:'M5 6h15M5 12h15M5 18h15M2 6h.1M2 12h.1M2 18h.1',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 21v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8',money:'M12 2v20M17 5H9a4 4 0 0 0 0 8h6a3 3 0 0 1 0 6H6',check:'m4 12 5 5L20 6'};
  const items=[
    ['Workspace','Overview','/admin/control','manage_operations','home'],
    ['Operations','Helpdesk','/admin/helpdesk','manage_operations','list'],
    ['Operations','Customers','/admin/customers','manage_customers','people'],
    ['Network','Applications','/admin/applications','manage_operators','list'],
    ['Network','Engineers & territories','/admin/franchise','view_franchise','people'],
    ['Network','Training academy','/admin/training','manage_training','check'],
    ['Business','Billing & settlements','/admin/billing','manage_billing','money'],
    ['Business','Marketing','/admin/marketing','manage_marketing','list'],
    ['System','Platform health','/admin/os#operationalHealth','manage_operations','check']
  ];
  const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'');
  const nav=document.createElement('aside');nav.className='workspace-nav';nav.id='workspaceNavigation';nav.setAttribute('aria-label','Main navigation');
  const brand=document.createElement('a');brand.className='workspace-brand';brand.href='/admin/control';brand.innerHTML='<img src="/assets/vipoap-os-heart-blue.png" alt=""><span>VIPOAP OS<small>HQ workspace</small></span>';nav.append(brand);
  const links=document.createElement('nav');links.setAttribute('aria-label','Workspace');nav.append(links);
  const foot=document.createElement('div');foot.className='workspace-foot';foot.textContent='Technology without the worry.';nav.append(foot);
  const backdrop=document.createElement('div');backdrop.className='workspace-backdrop';backdrop.setAttribute('aria-hidden','true');
  const bar=document.createElement('header');bar.className='workspace-topbar';bar.innerHTML='<button class="workspace-menu" aria-controls="workspaceNavigation" aria-expanded="false">Menu</button><div class="workspace-context"><strong>HQ</strong> <small>/ Central operations</small></div><div class="workspace-actions"><span class="workspace-role">Secure workspace</span><button id="workspaceSignOut" type="button">Sign out</button></div>';
  document.body.prepend(nav,backdrop,bar);
  const menu=bar.querySelector('.workspace-menu');
  const mobile=matchMedia('(max-width:850px)');
  function visibility(){const hidden=mobile.matches&&!nav.classList.contains('is-open');nav.inert=hidden;nav.setAttribute('aria-hidden',String(hidden));}
  function close(){nav.classList.remove('is-open');backdrop.classList.remove('is-open');menu.setAttribute('aria-expanded','false');visibility();}
  menu.onclick=()=>{const open=!nav.classList.contains('is-open');nav.classList.toggle('is-open',open);backdrop.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));visibility();if(open)nav.querySelector('a').focus();};
  mobile.addEventListener('change',close);visibility();
  nav.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||!mobile.matches||!nav.classList.contains('is-open'))return;
    const focusable=[...nav.querySelectorAll('a[href],button')],first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  backdrop.onclick=close;
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('is-open')){close();menu.focus();}});
  bar.querySelector('#workspaceSignOut').onclick=()=>{sessionStorage.removeItem('vipoapAdmin');sessionStorage.removeItem('vipoapAdminSession');location.href='/admin/hq';};
  async function initialise() {
    if(!headers()['x-admin-password']&&!headers()['x-admin-session']){location.replace('/admin/hq');return;}
    try {
      const response=await fetch('/api/admin/session',{headers:headers()}),data=await response.json();
      if(!response.ok){location.replace('/admin/hq');return;}
      const can=permission=>data.permissions?.includes('*')||data.permissions?.includes(permission);
      if(!can(document.body.dataset.pagePermission||'manage_operations')) {
        const main=document.querySelector('main');main.replaceChildren();const title=document.createElement('h1');title.textContent='Access restricted';const text=document.createElement('p');text.textContent='Your account does not have access to this workspace.';main.append(title,text);document.body.classList.add('workspace-ready');return;
      }
      let group='';for(const [section,label,href,permission,icon] of items) {
        if(!can(permission))continue;
        if(section!==group){const heading=document.createElement('h2');heading.textContent=section;links.append(heading);group=section;}
        const link=document.createElement('a');link.href=href;link.className='nav-link';link.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[icon]}"></path></svg><span>${label}</span>`;
        if(path===href)link.setAttribute('aria-current','page');links.append(link);
      }
      bar.querySelector('.workspace-role').textContent=data.role==='owner'?'Owner':'Administrator';
      document.body.classList.add('workspace-ready');document.dispatchEvent(new CustomEvent('workspace-ready',{detail:data}));
    } catch {const main=document.querySelector('main');main.textContent='We could not open the workspace. Please refresh to try again.';document.body.classList.add('workspace-ready');}
  }
  initialise();
})();
