(()=>{
  const style=document.createElement('style');
  style.textContent='.os-mobile-nav{display:none}.os-install{white-space:nowrap}.os-mobile-nav[hidden],.os-global-nav[hidden]{display:none!important}@media(max-width:720px){body{padding-bottom:82px!important}.os-mobile-nav{position:fixed;display:flex;left:8px;right:8px;bottom:8px;z-index:1000;overflow-x:auto;gap:3px;background:rgba(255,255,255,.94);border:1px solid #cbd9ea;border-radius:17px;padding:6px;box-shadow:0 10px 30px rgba(16,41,87,.18);backdrop-filter:blur(14px)}.os-mobile-nav a{display:grid;flex:1 0 48px;gap:2px;text-align:center;padding:7px 3px;border-radius:11px;color:#667085;text-decoration:none;font-size:9px;font-weight:800}.os-mobile-nav a span{font-size:18px;line-height:1}.os-mobile-nav a.active{color:#fff;background:linear-gradient(135deg,#102957,#2765a8)}}';
  document.head.append(style);
  const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/admin',logging=path==='/admin'&&location.hash==='#calloutEditor',knowledge=path==='/admin/knowledge';
  const items=[
    ['/admin/os','⌂','Overview','view_dashboard','primary'],
    ['/admin/customers','♟','Customers','manage_customers','primary'],
    ['/admin','▣','Visits','manage_calls','primary'],
    ['/admin/help-requests','?','Help','manage_followups','primary'],
    ['/admin/billing','£','Billing','manage_billing','primary'],
    ['/admin/safety','!','Safety','report_incidents','primary'],
    ['/admin/training','✓','Training','view_training','primary'],
    ['/admin/marketing','◆','Marketing','manage_brand','secondary'],
    ['/admin/knowledge','◇','Knowledge','view_training','secondary'],
    ['/admin/franchise','◎','Network','view_franchise','secondary']
  ];
  const isActive=(href,label)=>{const target=href.replace(/\/$/,'').split('#')[0];return label==='Log visit'?logging:label==='Visits'?(path===target&&!logging):label==='Training'?(path===target||knowledge):path===target};
  const allowed=(permission,permissions)=>permissions.includes('*')||permissions.includes(permission);
  const mobile=document.createElement('nav');mobile.className='os-mobile-nav';mobile.hidden=true;mobile.setAttribute('aria-label','VIPOAP OS mobile navigation');document.body.append(mobile);
  const desktop=document.createElement('nav');desktop.className='os-global-nav';desktop.hidden=true;desktop.setAttribute('aria-label','VIPOAP OS main navigation');document.body.insertBefore(desktop,document.body.firstChild);
  function render(permissions=[]){
    const visible=items.filter(item=>allowed(item[3],permissions));
    mobile.innerHTML=visible.filter(item=>item[4]==='primary').map(([href,icon,label])=>`<a href="${href}" class="${isActive(href,label)?'active':''}"><span>${icon}</span>${label}</a>`).join('');
    desktop.innerHTML=visible.map(([href,,label,,,])=>`<a class="${isActive(href,label)?'active':''}" href="${href}">${label}</a>`).join('');
  }
  const headers=()=>({'x-admin-password':sessionStorage.getItem('vipoapAdmin')||'','x-admin-session':sessionStorage.getItem('vipoapAdminSession')||''});
  const signedIn=()=>Boolean(sessionStorage.getItem('vipoapAdmin')||sessionStorage.getItem('vipoapAdminSession'));
  async function syncNav(){
    if(!signedIn()){mobile.hidden=true;desktop.hidden=true;return}
    try{const response=await fetch('/api/admin/session',{headers:headers()}),data=await response.json();if(!response.ok)throw Error();render(data.permissions||[]);mobile.hidden=false;desktop.hidden=false}catch{mobile.hidden=true;desktop.hidden=true}
  }
  syncNav();
  const observer=new MutationObserver(syncNav);document.querySelectorAll('#app,#hq,#portal,#workspace').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class']}));
  if(logging){let attempts=0;const timer=setInterval(()=>{const editor=document.getElementById('calloutEditor');if(editor&&!editor.closest('.hidden')){editor.scrollIntoView({block:'start'});clearInterval(timer)}else if(++attempts>20)clearInterval(timer)},150)}
  let prompt;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;if(document.getElementById('installOS'))return;const target=document.querySelector('.os-install-slot');if(!target)return;const button=document.createElement('button');button.id='installOS';button.className='btn os-install';button.type='button';button.textContent='Install OS';button.onclick=async()=>{if(!prompt)return;prompt.prompt();await prompt.userChoice;prompt=null;button.remove()};target.append(button)});
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/admin/service-worker.js');
})();
(function(){if(document.getElementById('connectivityStatus'))return;var script=document.createElement('script');script.src='/assets/connectivity.js';document.body.appendChild(script)})();