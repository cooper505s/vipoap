(()=>{
  const recommendations=document.getElementById('recommendations');
  if(!recommendations)return;
  let selected=[];
  const field=document.createElement('div');field.className='field wide';
  field.innerHTML='<label for="calloutPhoto">On-site photos</label><p class="muted">Take a photo with this device or choose an existing image. Up to 6 photos, maximum 2 MB each.</p><input id="calloutPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple><div id="calloutPhotos" class="actions"></div>';
  recommendations.closest('.field').after(field);
  const input=document.getElementById('calloutPhoto'),preview=document.getElementById('calloutPhotos');
  function render(){preview.innerHTML=selected.map((photo,index)=>`<span class="pill"><a href="${photo.data}" target="_blank" rel="noopener">${esc(photo.name)}</a> <button type="button" class="btn quiet" data-remove-call-photo="${index}" aria-label="Remove ${esc(photo.name)}">Remove</button></span>`).join('')||'<span class="muted">No photos attached.</span>'}
  const basePayload=calloutPayload;calloutPayload=()=>({...basePayload(),photos:selected});
  const baseReset=resetCallout;resetCallout=()=>{selected=[];render();baseReset()};
  const baseEdit=editCallout;editCallout=key=>{baseEdit(key);selected=[...(allCallouts.find(record=>record.key===key)?.photos||[])];render()};
  input.addEventListener('change',async event=>{for(const file of [...event.target.files]){if(selected.length>=6){alert('A call-out can contain up to 6 photos.');break}if(file.size>2097152){alert(`${file.name} is larger than 2 MB.`);continue}const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file)});selected.push({id:crypto.randomUUID(),name:file.name||`On-site photo ${selected.length+1}.jpg`,type:file.type,size:file.size,takenAt:new Date().toISOString(),data})}render();input.value=''});
  preview.addEventListener('click',event=>{const index=event.target.dataset.removeCallPhoto;if(index===undefined)return;selected.splice(Number(index),1);render()});
  document.getElementById('clearCallout').addEventListener('click',()=>{selected=[];render()});
  render();
})();
