export function directoryPage(rows,query='',page=0,size=50){
 const search=query.trim().toLowerCase(),matches=rows.filter(row=>row.text.toLowerCase().includes(search)),pages=Math.ceil(matches.length/size),index=Math.max(0,Math.min(page,Math.max(0,pages-1)));
 return {items:matches.slice(index*size,(index+1)*size),total:matches.length,page:index,pages,start:matches.length?index*size+1:0,end:Math.min((index+1)*size,matches.length)};
}
export function mountDirectory(directory){
 const list=directory.querySelector('.directory-list');if(!list)return;let page=0;
 const input=document.createElement('input');input.type='search';input.placeholder='Search records';input.setAttribute('aria-label','Search '+(directory.querySelector('h3')?.textContent||'records'));input.className='directory-search';
 const status=document.createElement('p');status.className='directory-count';status.setAttribute('role','status');
 const pager=document.createElement('div');pager.className='record-pagination';const previous=document.createElement('button'),next=document.createElement('button');for(const [button,label] of [[previous,'Previous'],[next,'Next']]){button.type='button';button.className='button';button.textContent=label;pager.append(button)}
 const toolbar=document.createElement('div');toolbar.className='directory-toolbar';toolbar.append(status,pager);list.before(input,toolbar);
 function render(){const rows=[...list.querySelectorAll('.directory-record')].map(element=>({element,text:element.textContent})),view=directoryPage(rows,input.value,page);page=view.page;const visible=new Set(view.items.map(item=>item.element));for(const row of rows)row.element.hidden=!visible.has(row.element);status.textContent=view.total?`${view.start}–${view.end} of ${view.total} records`:'No matching records';pager.hidden=view.pages<=1;previous.disabled=page===0;next.disabled=page+1>=view.pages;}
 input.oninput=()=>{page=0;render()};previous.onclick=()=>{page--;render();input.focus()};next.onclick=()=>{page++;render();input.focus()};new MutationObserver(render).observe(list,{childList:true});render();
}
