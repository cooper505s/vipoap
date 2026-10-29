(()=>{
 const root=document.getElementById('os');if(!root)return;
 const details=document.createElement('details');details.id='operationsDetail';details.className='card operations-detail';const summary=document.createElement('summary');summary.textContent='Operational detail & service recovery';details.append(summary);
 for(const child of [...root.children])if(!child.matches('.os-page-header,.os-page-heading,#operationalHealth,#launchReadiness'))details.append(child);
 root.append(details);
 const navigation=root.querySelector('.health-sections'),sections=['serviceStatus','systemFailures','businessIndicators','recoveryControls','launchReadiness','operationsDetail'].map(id=>document.getElementById(id)).filter(Boolean);
 if(!navigation)return;
 let active='serviceStatus';
 function show(id){
  const target=document.getElementById(id),panel=sections.find(section=>section===target||section.contains(target));active=panel?.id||'serviceStatus';
  for(const section of sections)section.hidden=section.id!==active;
  if(active==='operationsDetail')details.open=true;
  for(const link of navigation.querySelectorAll('a')){if(link.hash==='#'+active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')}
 }
 navigation.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(!link)return;event.preventDefault();history.replaceState(null,'',link.hash);show(link.hash.slice(1));});
 window.addEventListener('hashchange',()=>show(location.hash.slice(1)));
 const sync=()=>show(location.hash.slice(1)||active);document.addEventListener('workspace-ready',sync);sync();
})();
