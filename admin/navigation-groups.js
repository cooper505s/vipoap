// Grouping changes presentation only; callers supply the already-authorised links.
export function groupNavigation(items){const sections=new Map();for(const item of items){if(!sections.has(item.section))sections.set(item.section,[]);sections.get(item.section).push(item)}return [...sections].map(([section,items])=>({section,items}));}
export function mountNavigation({container,items,path,role,iconSvg}){
 const key='vipoapNavGroups:'+role;let preferences={};try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))preferences=saved}catch{}
 const link=item=>{const a=document.createElement('a');a.href=item.href;a.className='nav-link';a.title=item.label;a.setAttribute('aria-label',item.label);a.innerHTML=iconSvg(item.icon);const label=document.createElement('span');label.textContent=item.label;a.append(label);if(path===item.href)a.setAttribute('aria-current','page');return a;};
 container.replaceChildren();
 for(const group of groupNavigation(items)){
   if(group.items.length===1){container.append(link(group.items[0]));continue;}
   const details=document.createElement('details');details.className='workspace-nav-group';details.open=preferences[group.section]===true;const current=group.items.some(item=>item.href===path);if(current)details.classList.add('has-current');
   const summary=document.createElement('summary');summary.title=group.section;summary.setAttribute('aria-label',group.section);summary.innerHTML=iconSvg(group.items[0].icon);const label=document.createElement('span');label.className='nav-group-label';label.textContent=group.section;const chevron=document.createElement('span');chevron.className='nav-group-chevron';chevron.textContent='›';chevron.setAttribute('aria-hidden','true');summary.append(label,chevron);details.append(summary);
   const children=document.createElement('div');children.className='nav-group-links';for(const item of group.items)children.append(link(item));details.append(children);details.addEventListener('toggle',()=>{preferences[group.section]=details.open;try{localStorage.setItem(key,JSON.stringify(preferences))}catch{}});container.append(details);
 }
}
