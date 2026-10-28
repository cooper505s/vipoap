window.vipoapWorkspaceReady=(async () => {
  const favicon=document.querySelector('link[rel~="icon"]')||document.createElement('link');favicon.rel='icon';favicon.type='image/png';favicon.href='/assets/vipoap-os-icon-192.png?v=4';if(!favicon.isConnected)document.head.append(favicon);
  const headers=()=>({'x-admin-password':sessionStorage.getItem('vipoapAdmin')||'','x-admin-session':sessionStorage.getItem('vipoapAdminSession')||''});
  const {staffNavigation,iconSvg,routePath}=await import('/assets/portal-navigation.js?v=1');
  let engineer=false;
  let signIn=document.body.dataset.workspace==='engineer'?'/admin/':'/admin/hq';
  const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'').replace(/^\/admin\/index$/,'/admin');
  document.body.classList.add('software-workspace');
  const main=document.querySelector('main');
  if(main&&!main.id)main.id='main-content';
  if(!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.className='skip-link';skip.href=`#${main?.id||'main-content'}`;skip.textContent='Skip to workspace';document.body.prepend(skip);}
  main?.querySelectorAll('.os-page-heading a').forEach(link=>{const destination=new URL(link.href,location.href).pathname.replace(/\.html$/,'');if(!engineer&&['/admin','/admin/','/admin/index','/admin/os'].includes(destination)){link.href='/admin/control';link.textContent='Overview';}});
  const oldHeading=main?.querySelector('.os-page-heading h2');
  if(oldHeading){const title=document.createElement('h1');title.textContent=oldHeading.textContent;oldHeading.replaceWith(title);}
  const nav=document.createElement('aside');nav.className='workspace-nav';nav.id='workspaceNavigation';nav.setAttribute('aria-label','Main navigation');
  const brand=document.createElement('a');brand.className='workspace-brand';brand.href='/admin/control';brand.innerHTML='<img src="/assets/vipoap-os-heart-blue.png" alt=""><span>VIPOAP OS<small>HQ workspace</small></span>';if(engineer){brand.href='/admin/';brand.querySelector('small').textContent='Engineer workspace';}nav.append(brand);
  const links=document.createElement('nav');links.setAttribute('aria-label','Workspace');nav.append(links);
  const collapse=document.createElement('button');collapse.type='button';collapse.className='workspace-collapse';collapse.setAttribute('aria-label','Collapse sidebar');collapse.setAttribute('aria-expanded','true');collapse.innerHTML=iconSvg('collapse')+'<span>Collapse sidebar</span>';nav.append(collapse);
  const compactKey='vipoapSidebarCollapsed';
  function setCompact(compact){document.body.classList.toggle('sidebar-collapsed',compact);collapse.setAttribute('aria-expanded',String(!compact));collapse.setAttribute('aria-label',compact?'Expand sidebar':'Collapse sidebar');collapse.title=compact?'Expand sidebar':'Collapse sidebar';try{localStorage.setItem(compactKey,String(compact))}catch{}}
  try{setCompact(localStorage.getItem(compactKey)==='true')}catch{}
  collapse.onclick=()=>setCompact(!document.body.classList.contains('sidebar-collapsed'));
  const foot=document.createElement('div');foot.className='workspace-foot';foot.textContent='Technology without the worry.';nav.append(foot);
  const backdrop=document.createElement('div');backdrop.className='workspace-backdrop';backdrop.setAttribute('aria-hidden','true');
  const bar=document.createElement('header');bar.className='workspace-topbar';bar.innerHTML='<button class="workspace-menu" aria-controls="workspaceNavigation" aria-expanded="false">Menu</button><div class="workspace-context"><strong>HQ</strong> <small>/ Central operations</small></div><div class="workspace-actions"><span class="workspace-role">Secure workspace</span><button id="workspaceInstall" type="button" hidden>Install workspace</button><button id="workspaceSignOut" type="button">Sign out</button></div>';
  if(engineer){bar.querySelector('.workspace-context strong').textContent='My work';bar.querySelector('.workspace-context small').textContent='/ Engineer workspace';}document.body.prepend(nav,backdrop,bar);
  const menu=bar.querySelector('.workspace-menu');
  const mobile=matchMedia('(max-width:850px)');
  function visibility(){const hidden=mobile.matches&&!nav.classList.contains('is-open');nav.inert=hidden;nav.setAttribute('aria-hidden',String(hidden));}
  function close(){nav.classList.remove('is-open');backdrop.classList.remove('is-open');menu.setAttribute('aria-expanded','false');visibility();}
  menu.onclick=()=>{const open=!nav.classList.contains('is-open');nav.classList.toggle('is-open',open);backdrop.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));visibility();if(open)nav.querySelector('a').focus();};
  mobile.addEventListener('change',close);visibility();
  nav.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||!mobile.matches||!nav.classList.contains('is-open'))return;
    const focusable=[...nav.querySelectorAll('a[href],button')].filter(element=>element.getClientRects().length),first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  backdrop.onclick=close;
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('is-open')){close();menu.focus();}});
  bar.querySelector('#workspaceSignOut').onclick=()=>{sessionStorage.removeItem('vipoapAdmin');sessionStorage.removeItem('vipoapAdminSession');location.href=signIn;};
  let installPrompt=null;const installButton=bar.querySelector('#workspaceInstall');
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installButton.hidden=false;});
  installButton.onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;installButton.hidden=true;};
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/admin/service-worker.js',{scope:'/admin/'}).catch(()=>{});
  async function initialise() {
    if(!headers()['x-admin-password']&&!headers()['x-admin-session']){location.replace(signIn);return;}
    try {
      const response=await fetch('/api/admin/session',{headers:headers()}),data=await response.json();
      if(!response.ok){sessionStorage.removeItem('vipoapAdmin');sessionStorage.removeItem('vipoapAdminSession');location.replace(signIn);return;}
      const can=permission=>data.permissions?.includes('*')||data.permissions?.includes(permission);
      engineer=data.role==='operator';signIn=engineer?'/admin/':'/admin/hq';
      brand.href=engineer?'/admin/':'/admin/control';brand.querySelector('small').textContent=engineer?'Partner workspace':'HQ workspace';
      bar.querySelector('.workspace-context strong').textContent=engineer?'Partner workspace':'HQ workspace';bar.querySelector('.workspace-context small').textContent=' / '+(document.querySelector('main .os-page-heading h1,main .page-heading h1,main>header h1')?.textContent||document.title.split('|')[0]);
      const applyPermissions=()=>document.querySelectorAll('[data-requires-permission]').forEach(element=>{element.hidden=!can(element.dataset.requiresPermission);});applyPermissions();new MutationObserver(applyPermissions).observe(document.body,{childList:true,subtree:true});
      let group='';for(const {section,label,href,icon} of staffNavigation(data)) {
        if(section!==group){const heading=document.createElement('h2');heading.textContent=section;links.append(heading);group=section;}
        const link=document.createElement('a');link.href=href;link.className='nav-link';link.title=label;link.setAttribute('aria-label',label);link.innerHTML=iconSvg(icon)+`<span>${label}</span>`;
        if(routePath(path)===href)link.setAttribute('aria-current','page');links.append(link);
      }
      try{links.scrollTop=Number(sessionStorage.getItem('vipoapNavScroll:'+data.role))||0}catch{}
      links.addEventListener('scroll',()=>{try{sessionStorage.setItem('vipoapNavScroll:'+data.role,String(links.scrollTop))}catch{}},{passive:true});
      bar.querySelector('.workspace-role').textContent=data.role==='owner'?'Owner':data.role==='operator'?'Engineer Partner':'Administrator';
      if(!can(document.body.dataset.pagePermission||'manage_operations')) {
        const main=document.querySelector('main');main.replaceChildren();const title=document.createElement('h1');title.textContent='Access restricted';const text=document.createElement('p');text.textContent='Your account does not have access to this workspace.';main.append(title,text);document.body.classList.add('workspace-ready');return;
      }
      if(!data.territoryIds?.includes('*'))document.querySelectorAll('[data-global-hq]').forEach(element=>element.hidden=true);
      const {enhancePage}=await import('/admin/page-layouts.js?v=1');enhancePage(data);bar.querySelector('.workspace-context small').textContent=' / '+(document.querySelector('main .os-page-heading h1,main .page-heading h1,main>header h1')?.textContent||document.title.split('|')[0]);
      document.body.classList.add('workspace-ready');document.dispatchEvent(new CustomEvent('workspace-ready',{detail:data}));return data;
    } catch {const main=document.querySelector('main');main.textContent='We could not open the workspace. Please refresh to try again.';document.body.classList.add('workspace-ready');}
  }
  return initialise();
})();
