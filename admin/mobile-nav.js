(()=>{
  const style=document.createElement('style');
  style.textContent='.os-mobile-nav{display:none}.os-install{white-space:nowrap}.os-mobile-nav[hidden],.os-global-nav[hidden],[data-requires-permission][hidden]{display:none!important}.os-nav-group{display:flex;align-items:center;gap:4px}.os-nav-group+.os-nav-group{margin-left:auto;padding-left:9px;border-left:1px solid #dbe4ef}.os-nav-label{padding:0 5px;color:#78879a;font-size:.67rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}@media(max-width:900px){.os-nav-label{display:none}}@media(max-width:720px){body{padding-bottom:82px!important}.os-mobile-nav{position:fixed;display:flex;left:8px;right:8px;bottom:8px;z-index:1000;overflow-x:auto;gap:3px;background:rgba(255,255,255,.94);border:1px solid #cbd9ea;border-radius:17px;padding:6px;box-shadow:0 10px 30px rgba(16,41,87,.18);backdrop-filter:blur(14px)}.os-mobile-nav a{display:grid;flex:1 0 54px;gap:2px;text-align:center;padding:7px 3px;border-radius:11px;color:#667085;text-decoration:none;font-size:9px;font-weight:800}.os-mobile-nav a span{font-size:18px;line-height:1}.os-mobile-nav a.active{color:#fff;background:linear-gradient(135deg,#102957,#2765a8)}}';
  document.head.append(style);
  const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/admin';
  const items=[
    {href:'/admin',icon:'▣',label:'My work',permission:'manage_calls',group:'partner'},
    {href:'/admin/customers',icon:'♟',label:'Customers',permission:'manage_customers',group:'partner'},
    {href:'/admin/health-check',icon:'♡',label:'Health check',permission:'manage_customers',group:'partner'},
    {href:'/admin/help-requests',icon:'?',label:'Help requests',permission:'manage_followups',group:'partner'},
    {href:'/admin/safety',icon:'!',label:'Safety',permission:'report_incidents',group:'partner'},
    {href:'/admin/training',icon:'✓',label:'Training',permission:'view_training',group:'partner'},
    {href:'/admin/knowledge',icon:'◇',label:'Knowledge',permission:'view_training',group:'partner'},
    {href:'/admin/marketing',icon:'◆',label:'Marketing',permission:'manage_marketing',group:'partner'},
    {href:'/admin/os',icon:'⌂',label:'Admin overview',permission:'manage_operations',group:'admin'},
    {href:'/admin/billing',icon:'£',label:'Billing',permission:'manage_billing',group:'admin'},
    {href:'/admin/franchise',icon:'◎',label:'Network & access',permission:'view_franchise',group:'admin'}
  ];
  const isActive=href=>path===href.replace(/\/$/,'');
  const allowed=(permission,permissions)=>permissions.includes('*')||permissions.includes(permission);
  const mobile=document.createElement('nav');mobile.className='os-mobile-nav';mobile.hidden=true;mobile.setAttribute('aria-label','VIPOAP OS navigation');document.body.append(mobile);
  const desktop=document.createElement('nav');desktop.className='os-global-nav';desktop.hidden=true;desktop.setAttribute('aria-label','VIPOAP OS navigation');document.body.insertBefore(desktop,document.body.firstChild);
  const link=item=>`<a href="${item.href}" class="${isActive(item.href)?'active':''}">${item.label}</a>`;
  function render(permissions=[]){
    const visible=items.filter(item=>allowed(item.permission,permissions));
    mobile.innerHTML=visible.map(item=>`<a href="${item.href}" class="${isActive(item.href)?'active':''}"><span>${item.icon}</span>${item.label}</a>`).join('');
    const partner=visible.filter(item=>item.group==='partner'),admin=visible.filter(item=>item.group==='admin');
    desktop.innerHTML=(partner.length?`<div class="os-nav-group"><span class="os-nav-label">Partner workspace</span>${partner.map(link).join('')}</div>`:'')+(admin.length?`<div class="os-nav-group"><span class="os-nav-label">Admin centre</span>${admin.map(link).join('')}</div>`:'');
  }
  const headers=()=>({'x-admin-password':sessionStorage.getItem('vipoapAdmin')||'','x-admin-session':sessionStorage.getItem('vipoapAdminSession')||''});
  const signedIn=()=>Boolean(sessionStorage.getItem('vipoapAdmin')||sessionStorage.getItem('vipoapAdminSession'));
  let effectivePermissions=[];
  function applyVisibility(){
    document.querySelectorAll('[data-requires-permission]').forEach(element=>{element.hidden=!allowed(element.dataset.requiresPermission,effectivePermissions)});
  }
  function showDenied(required){
    const main=document.querySelector('main');if(!main)return;
    main.innerHTML='<section class="card os-access-denied"><span class="pill">Access restricted</span><h1>This area is for central administration</h1><p>Your account does not have the required permission for this page.</p><a class="btn primary" href="/admin/">Return to Partner Workspace</a></section>';
  }
  async function syncNav(){
    if(!signedIn()){mobile.hidden=true;desktop.hidden=true;return}
    try{
      const response=await fetch('/api/admin/session',{headers:headers()}),data=await response.json();if(!response.ok)throw Error();
      effectivePermissions=data.permissions||[];render(effectivePermissions);applyVisibility();
      const required=document.body.dataset.pagePermission;if(required&&!allowed(required,effectivePermissions)){showDenied(required)}
      mobile.hidden=false;desktop.hidden=false;
    }catch{mobile.hidden=true;desktop.hidden=true}
  }
  syncNav();
  const observer=new MutationObserver(()=>{applyVisibility();if(signedIn()&&(mobile.hidden||desktop.hidden))syncNav()});
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  let prompt;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;if(document.getElementById('installOS'))return;const target=document.querySelector('.os-install-slot');if(!target)return;const button=document.createElement('button');button.id='installOS';button.className='btn os-install';button.type='button';button.textContent='Install OS';button.onclick=async()=>{if(!prompt)return;prompt.prompt();await prompt.userChoice;prompt=null;button.remove()};target.append(button)});
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/admin/service-worker.js');
})();
(function(){if(document.getElementById('connectivityStatus'))return;var script=document.createElement('script');script.src='/assets/connectivity.js';document.body.appendChild(script)})();