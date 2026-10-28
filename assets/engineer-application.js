(() => {
  const form=document.getElementById('engineerApplication');
  if(!form)return;
  const status=document.getElementById('interestStatus'),button=form.querySelector('button[type="submit"]');
  let sending=false,accepted=false,requestId='',lastPayload='';
  button.disabled=false;
  const fields=['name','email','phone','area','experience','availability','skills','motivation'];
  function message(text,ok=false) {
    status.textContent=text;status.className=`booking-status ${ok?'ok':'error'}`;
    status.focus();
  }
  function clearErrors() {
    for(const name of fields){const field=form.elements.namedItem(name);field.removeAttribute('aria-invalid');document.getElementById(`error-${name}`).textContent='';}
  }
  form.addEventListener('submit',async event => {
    event.preventDefault();if(sending||accepted)return;
    clearErrors();if(!form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form)),payload=JSON.stringify(values);
    if(payload!==lastPayload){requestId=crypto.randomUUID();lastPayload=payload;}
    sending=true;button.disabled=true;button.textContent='Saving your application…';form.setAttribute('aria-busy','true');
    status.textContent='Please wait while we save your application.';
    try {
      const response=await fetch('/api/engineer-applications',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...values,requestId}),signal:AbortSignal.timeout(20000)
      });
      const type=response.headers.get('content-type')||'';
      const data=type.includes('application/json')?await response.json():{};
      if(!response.ok) {
        if(response.status===410){requestId='';lastPayload='';}
        for(const [name,text] of Object.entries(data.fields||{})) {
          if(!fields.includes(name))continue;
          form.elements.namedItem(name).setAttribute('aria-invalid','true');
          document.getElementById(`error-${name}`).textContent=text;
        }
        throw Error(data.error||'We could not save your application just now. Please try again or call 07977 254158.');
      }
      if(!data.ok||!data.reference)throw Error('We could not confirm receipt. Please try again using the same details.');
      accepted=true;
      message(`Application saved. Reference: ${data.reference}. We'll be in touch. Approval is required before taking work.`,true);
      button.textContent='Application saved';
      for(const name of fields){const field=form.elements.namedItem(name);field.readOnly=true;if(field.tagName==='SELECT')field.disabled=true;}
    } catch(error) {
      message(error.name==='TimeoutError'||error.name==='AbortError'?'The connection took too long. Your details are still here. Try again with the same details; this will reuse your application reference.':['TypeError','SyntaxError'].includes(error.name)?'We could not confirm receipt just now. Your details are still here. Please try again or call 07977 254158.':error.message);
    } finally {
      sending=false;button.disabled=accepted;form.removeAttribute('aria-busy');
      if(!accepted)button.textContent='Register my interest';
    }
  });
})();
