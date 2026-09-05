let password=sessionStorage.getItem('vipoapAdmin')||'';
let session=sessionStorage.getItem('vipoapAdminSession')||'';
let articles=[];
let canModerate=false;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const headers=()=>({'content-type':'application/json','x-admin-password':password,'x-admin-session':session});

async function api(url,options={}){
  const response=await fetch(url,{...options,headers:{...headers(),...options.headers}});
  const type=response.headers.get('content-type')||'';
  const data=type.includes('application/json')?await response.json():{error:await response.text()};
  if(!response.ok)throw Error(data.error||'Knowledge request failed.');
  return data;
}

function render(){
  const q=$('search').value.toLowerCase();
  const category=$('category').value;
  const list=articles.filter(item=>(!q||`${item.title} ${item.summary} ${item.content}`.toLowerCase().includes(q))&&(!category||item.category===category));
  $('articles').innerHTML=list.length?list.map(item=>`<article class="article"><div class="row"><div><span class="pill">${esc(item.category)}</span> <span class="pill">${esc(item.status)}</span><h2>${esc(item.title)}</h2><p><strong>${esc(item.summary)}</strong></p><p>${esc(item.content).replace(/\n/g,'<br>')}</p></div>${canModerate&&item.status==='pending-review'?`<div class="actions"><button class="btn" data-publish="${esc(item.key)}">Publish</button><button class="btn secondary" data-reject="${esc(item.key)}">Reject</button></div>`:''}</div><details><summary>${(item.replies||[]).length} community replies</summary>${(item.replies||[]).map(reply=>`<p><strong>${esc(reply.authorName||'VIPOAP Engineer Partner')}</strong><br>${esc(reply.text)}</p>`).join('')}<textarea data-reply-text="${esc(item.key)}" placeholder="Add a safe practical reply"></textarea><button class="btn secondary" data-reply="${esc(item.key)}">Reply</button></details></article>`).join(''):'<p class="muted">No matching knowledge articles.</p>';
}

async function load(){
  const data=await api('/api/admin/knowledge');
  articles=data.articles||[];
  canModerate=!!data.canModerate;
  const options=(data.categories||[]).map(item=>`<option value="${esc(item)}">${esc(item)}</option>`).join('');
  $('category').innerHTML='<option value="">All categories</option>'+options;
  $('newCategory').innerHTML='<option value="">Choose a category</option>'+options;
  render();
}

async function submit(event){
  event.preventDefault();
  const form=$('articleForm');
  if(!form.reportValidity())return;
  const button=$('submitArticle');
  button.disabled=true;
  button.textContent='Submitting…';
  $('status').textContent='Sending your article securely…';
  try{
    const data=await api('/api/admin/knowledge',{method:'POST',body:JSON.stringify({
      title:$('title').value.trim(),
      category:$('newCategory').value,
      summary:$('summary').value.trim(),
      content:$('content').value.trim()
    })});
    form.reset();
    $('status').textContent=data.status==='published'?'Article published.':'Article sent to VIPOAP HQ for review.';
    await load();
  }catch(error){$('status').textContent=error.message}
  finally{button.disabled=false;button.textContent='Submit article'}
}

async function signIn(){
  password=$('password')?.value||'';
  try{
    await load();
    sessionStorage.setItem('vipoapAdmin',password);
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
  }catch(error){if($('loginStatus'))$('loginStatus').textContent=error.message}
}

$('loginBtn')?.addEventListener('click',signIn);
$('articleForm').addEventListener('submit',submit);
$('search').addEventListener('input',render);
$('category').addEventListener('change',render);
$('logoutBtn')?.addEventListener('click',()=>{sessionStorage.clear();location.reload()});
document.addEventListener('click',async event=>{
  try{
    if(event.target.dataset.publish)await api('/api/admin/knowledge',{method:'PATCH',body:JSON.stringify({key:event.target.dataset.publish,status:'published'})});
    else if(event.target.dataset.reject)await api('/api/admin/knowledge',{method:'PATCH',body:JSON.stringify({key:event.target.dataset.reject,status:'rejected'})});
    else if(event.target.dataset.reply){
      const key=event.target.dataset.reply;
      const text=document.querySelector(`[data-reply-text="${CSS.escape(key)}"]`).value;
      await api('/api/admin/knowledge',{method:'POST',body:JSON.stringify({articleKey:key,reply:text})});
    }else return;
    await load();
  }catch(error){$('status').textContent=error.message}
});

if(password||session)load().then(()=>{$('login').classList.add('hidden');$('app').classList.remove('hidden')}).catch(()=>sessionStorage.clear());
