(() => {
  const form=document.getElementById('callbackForm');if(!form)return;
  const button=form.querySelector('button[type="submit"]'),status=document.getElementById('cbStatus'),fields=['name','phone','bestTime','message'];
  let busy=false,done=false,id='',last='';button.disabled=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||done)return;
    for(const key of fields){form.elements.namedItem(key).removeAttribute('aria-invalid');document.getElementById(`cb-error-${key}`).textContent='';}
    if(!form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form)),payload=JSON.stringify(values);
    if(last!==payload){id=crypto.randomUUID();last=payload;}
    busy=true;button.disabled=true;button.textContent='Saving your request…';status.textContent='Please wait while we save your callback request.';form.setAttribute('aria-busy','true');
    try {
      const response=await fetch('/api/callbacks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...values,requestId:id}),signal:AbortSignal.timeout(20000)});
      const data=(response.headers.get('content-type')||'').includes('application/json')?await response.json():{};
      if(!response.ok){if(response.status===410){id='';last='';}for(const [key,text] of Object.entries(data.fields||{})){if(!fields.includes(key))continue;form.elements.namedItem(key).setAttribute('aria-invalid','true');document.getElementById(`cb-error-${key}`).textContent=text;}throw Error(data.error||'We could not confirm receipt. Please try again or call 07977 254158.');}
      if(!data.ok||!data.reference)throw Error('We could not confirm receipt. Please try again with the same details.');
      done=true;status.className='booking-status ok';status.textContent=`Your callback request has been saved. Reference: ${data.reference}. We will contact you about your request. Your preferred time is not a confirmed appointment.`;button.textContent='Callback request saved';for(const key of fields){const field=form.elements.namedItem(key);field.readOnly=true;if(field.tagName==='SELECT')field.disabled=true;}
    }catch(error){status.className='booking-status error';status.textContent=['TimeoutError','AbortError','TypeError','SyntaxError'].includes(error.name)?'We could not confirm receipt just now. Your details are still here. Please try again with the same details or call 07977 254158.':error.message;}
    finally{busy=false;button.disabled=done;form.removeAttribute('aria-busy');if(!done)button.textContent='Request my callback';status.focus();}
  });
})();
