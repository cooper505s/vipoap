function clean(value,max=500){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}
export function normalisePhone(value){let phone=clean(value,40).replace(/\D/g,'');if(phone.startsWith('44'))phone=`0${phone.slice(2)}`;return phone}
async function emailIndex(value){const email=clean(value,150).toLowerCase();if(!email)return'';const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email));return`customer-email:${[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}`}
export async function ensureCustomer(env,input){
  if(!env.VIPOAP_DATA)return null;
  const phone=clean(input.phone,40),phoneKey=normalisePhone(phone),email=clean(input.email,150),emailKey=await emailIndex(email);if(!phoneKey&&!emailKey)return null;
  let key=phoneKey?await env.VIPOAP_DATA.get(`customer-phone:${phoneKey}`):await env.VIPOAP_DATA.get(emailKey),existing=key?await env.VIPOAP_DATA.get(key,'json'):null;
  if(!existing){const keys=await env.VIPOAP_DATA.list({prefix:'customer:'});for(const item of keys.keys){const record=await env.VIPOAP_DATA.get(item.name,'json');if(record&&((phoneKey&&normalisePhone(record.phone)===phoneKey)||(email&&String(record.email||'').toLowerCase()===email.toLowerCase()))){key=item.name;existing=record;break}}}
  const now=new Date().toISOString(),territoryId=clean(input.territoryId||env.DEFAULT_TERRITORY_ID||'andover',60),operatorId=clean(input.operatorId||env.DEFAULT_OPERATOR_ID||'dan-stevens',80);
  if(!existing){key=`customer:${crypto.randomUUID()}`;existing={name:'',phone:'',phoneKey,email:'',postcode:'',address:'',membership:'none',customerNotes:'',equipment:[],attachments:[],createdAt:now}}
  const customer={...existing,name:clean(input.name,100)||existing.name,phone:phone||existing.phone,phoneKey:phoneKey||existing.phoneKey||'',email:email||existing.email,postcode:clean(input.postcode,20)||existing.postcode,territoryId:existing.territoryId||territoryId,operatorId:existing.operatorId||operatorId,updatedAt:now};
  await env.VIPOAP_DATA.put(key,JSON.stringify(customer));if(phoneKey)await env.VIPOAP_DATA.put(`customer-phone:${phoneKey}`,key);if(emailKey)await env.VIPOAP_DATA.put(emailKey,key);return{key,...customer};
}
