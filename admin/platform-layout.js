(()=>{
 const root=document.getElementById('os');if(!root)return;
 const details=document.createElement('details');details.id='operationsDetail';details.className='card operations-detail';const summary=document.createElement('summary');summary.textContent='Operational detail & service recovery';details.append(summary);
 for(const child of [...root.children])if(!child.matches('.os-page-header,.os-page-heading,#operationalHealth,#launchReadiness'))details.append(child);
 root.append(details);
 const target=()=>{const id=location.hash.slice(1);if(id&&details.querySelector(`[id="${CSS.escape(id)}"]`))details.open=true;};window.addEventListener('hashchange',target);target();
})();
