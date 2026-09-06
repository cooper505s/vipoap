(function(){
  var form=document.getElementById('bookingForm'),support=document.getElementById('supportType');if(!form||!support)return;
  var field=document.createElement('div');field.className='field';field.id='paymentChoice';
  field.innerHTML='<label>Payment</label><input type="hidden" name="paymentMethod" value="online"><div class="note" id="paymentHelp"></div>';
  var date=document.getElementById('date');date.parentNode.insertBefore(field,date.parentNode);
  function priceFor(type,duration){if(type==='Remote support')return duration===30?'£25':duration===60?'£45':'£65';return duration===30?'£49':duration===60?'£79':'£109'}
  function update(){
    var remote=support.value==='Remote support',thirty=document.querySelector('input[name="duration"][value="30"]'),sixty=document.querySelector('input[name="duration"][value="60"]'),ninety=document.querySelector('input[name="duration"][value="90"]');
    if(thirty)thirty.disabled=false;
    if(ninety)ninety.disabled=false;
    var price30=document.getElementById('price30'),price60=document.getElementById('price60'),price90=document.getElementById('price90'),priceNote=document.getElementById('priceNote');
    if(price30)price30.textContent=remote?'First 30 minutes — £25':'Home visit — £49 (up to 30 minutes)';
    if(price60)price60.textContent=remote?'Up to 60 minutes — £45':'Up to 1 hour — £79';
    if(price90)price90.textContent=remote?'Up to 90 minutes — £65':'Up to 90 minutes — £109';
    if(priceNote)priceNote.innerHTML=remote?'<strong>£25 for the first 30 minutes.</strong><br>Each additional 30 minutes is £20 and is agreed first. We never unexpectedly call asking for remote access, and we never leave permanent unattended access.':'<strong>Simple home-visit pricing.</strong><br>£49 includes the visit and first 30 minutes. Each additional 30 minutes is £30 and is only charged with your agreement. Local travel is included.';
    document.getElementById('paymentHelp').innerHTML='<strong>New customers pay securely in advance.</strong><br>Any additional time is agreed with you first and billed after the appointment.';
  }
  support.addEventListener('change',function(){setTimeout(update,0)});update();
  form.addEventListener('submit',function(){
    booking.paymentMethod='online';
    var duration=Number(document.querySelector('input[name="duration"]:checked').value),price=priceFor(support.value,duration);booking.price=price;
    var summary=document.getElementById('summary');if(summary){var rows=[...summary.querySelectorAll('div')],priceRow=rows.find(function(row){return row.firstElementChild&&row.firstElementChild.textContent==='price'});if(priceRow&&priceRow.lastElementChild)priceRow.lastElementChild.textContent=price}
  });
}());
