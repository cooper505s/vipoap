function clean(value,max=500){return String(value??'').trim().replace(/[<>]/g,'').slice(0,max)}
export function normalisePhone(value){let phone=clean(value,40).replace(/\D/g,'');if(phone.startsWith('44'))phone=`0${phone.slice(2)}`;return phone}
export async function ensureCustomer(env,input){
  if(!env.VIPOAP_DATA)return null;
  const phone=clean(input.phone,40),phoneKey=normalisePhone(phone);if(!phoneKey)return null;
  let key=await env.VIPOAP_DATA.get(`customer-phone:${phoneKey}`),existing=key?await env.VIPOAP_DATA.get(key,'json'):null;
  if(!existing){const keys=await env.VIPOAP_DATA.list({prefix:'customer:'});for(const item of keys.keys){const record=await env.VIPOAP_DATA.get(item.name,'json');if(record&&normalisePhone(record.phone)===phoneKey){key=item.name;existing=record;break}}}
  const now=new Date().toISOString(),territoryId=clean(input.territoryId||env.DEFAULT_TERRITORY_ID||'andover',60),operatorId=clean(input.operatorId||env.DEFAULT_OPERATOR_ID||'dan-stevens',80);
  if(!existing){key=`customer:${crypto.randomUUID()}`;existing={name:'',phone:'',phoneKey,email:'',postcode:'',address:'',membership:'none',customerNotes:'',equipment:[],attachments:[],createdAt:now}}
  const customer={...existing,name:clean(input.name,100)||existing.name,phone:phone||existing.phone,phoneKey,email:clean(input.email,150)||existing.email,postcode:clean(input.postcode,20)||existing.postcode,territoryId:existing.territoryId||territoryId,operatorId:existing.operatorId||operatorId,updatedAt:now};
  await env.VIPOAP_DATA.put(key,JSON.stringify(customer));await env.VIPOAP_DATA.put(`customer-phone:${phoneKey}`,key);return{key,...customer};
}
