(()=>{
  const workspace=document.body.dataset.workspace||'engineer';
  const password=sessionStorage.getItem('vipoapAdmin')||'';
  const session=sessionStorage.getItem('vipoapAdminSession')||'';

  if(workspace==='admin'){
    if(!password&&!session)location.replace('/admin/hq');
    return;
  }

  const login=document.getElementById('login');
  if(!login||password||session)return;
  login.classList.add('auth-shell');
  login.innerHTML='<div class="partner-login"><div class="auth-brand"><img src="../assets/vipoap-os-heart-blue.png" alt=""><div><h1>VIPOAP OS</h1><p>Secure Engineer Partner area</p></div></div><h2>Engineer Partner sign in</h2><p class="muted">Use the authorised email address connected to your VIPOAP area.</p><div class="field"><label for="adminEmail">Engineer Partner email</label><input id="adminEmail" type="email" autocomplete="email" placeholder="your-area@vipoap.co.uk" required></div><button class="btn primary" id="emailCodeButton" type="button">Email my sign-in code</button><div id="emailCodeFields" class="hidden"><div class="field"><label for="emailCode">Six-digit code</label><input id="emailCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></div><button class="btn primary" id="verifyCodeButton" type="button">Open My Work</button></div><p id="emailCodeStatus" class="status" aria-live="polite"></p><p class="muted"><a href="/admin/hq">Administrator sign in</a></p></div>';

  const button=document.getElementById('emailCodeButton');
  const fields=document.getElementById('emailCodeFields');
  const status=document.getElementById('emailCodeStatus');
  const email=document.getElementById('adminEmail');
  const code=document.getElementById('emailCode');

  async function json(response){
    const type=response.headers.get('content-type')||'';
    return type.includes('application/json')?response.json():{error:await response.text()};
  }

  async function requestCode(){
    const address=email.value.trim();
    if(!email.reportValidity())return;
    button.disabled=true;
    status.textContent='Sending code…';
    try{
      const response=await fetch('/api/admin/auth/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:address})});
      const data=await json(response);
      if(!response.ok)throw Error(data.error||'Unable to send code.');
      status.textContent=data.message||'Code sent. Check your email.';
      fields.classList.remove('hidden');
      code.focus();
    }catch(error){status.textContent=error.message}
    finally{button.disabled=false}
  }

  async function verifyCode(){
    if(!code.reportValidity())return;
    status.textContent='Checking code…';
    try{
      const response=await fetch('/api/admin/auth/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email.value.trim(),code:code.value.trim()})});
      const data=await json(response);
      if(!response.ok)throw Error(data.error||'Unable to sign in.');
      sessionStorage.setItem('vipoapAdminSession',data.token);
      sessionStorage.removeItem('vipoapAdmin');
      location.href=data.destination||'/admin/';
    }catch(error){status.textContent=error.message}
  }

  button.addEventListener('click',requestCode);
  document.getElementById('verifyCodeButton').addEventListener('click',verifyCode);
  email.addEventListener('keydown',event=>{if(event.key==='Enter')requestCode()});
  code.addEventListener('keydown',event=>{if(event.key==='Enter')verifyCode()});
})();
