(function(){
  var form=document.getElementById('bookingForm'),support=document.getElementById('supportType');if(!form||!support)return;
  var field=document.createElement('div');field.className='field';field.id='paymentChoice';
  field.innerHTML='<label>Secure advance payment</label><input type="hidden" name="paymentMethod" value="online"><div class="note" id="paymentHelp"></div>';
  var date=document.getElementById('date');date.parentNode.insertBefore(field,date.parentNode);
  function update(){document.getElementById('paymentHelp').innerHTML='<strong>'+support.value+' is paid securely before confirmation.</strong><br>Any additional time is agreed with you first and billed after the appointment.'}
  support.addEventListener('change',update);update();
  form.addEventListener('submit',function(){booking.paymentMethod='online'});
}());
