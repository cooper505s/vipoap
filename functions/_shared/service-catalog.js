export const TECHNOLOGY_CATEGORY={
  id:'technology',slug:'technology',name:'Technology Help',description:'Friendly help with everyday technology in the home or remotely.',status:'active',requiresHomeVisit:false,allowsRemote:true
};

export const TECHNOLOGY_SERVICES=[
  {id:'tech-computer',slug:'computer-laptop',name:'Computer or laptop',fulfilmentTypes:['home','remote'],defaultDurationMinutes:60,minDurationMinutes:30,maxDurationMinutes:120,aliases:['computer','computer or laptop','laptop','pc']},
  {id:'tech-wifi',slug:'wifi-internet',name:'Wi-Fi / internet',fulfilmentTypes:['home'],defaultDurationMinutes:60,minDurationMinutes:60,maxDurationMinutes:180,aliases:['wi-fi','wifi','wi-fi / internet','wifi / internet','internet','broadband','mesh wifi','mesh wi-fi']},
  {id:'tech-printer',slug:'printer',name:'Printer',fulfilmentTypes:['home','remote'],defaultDurationMinutes:60,minDurationMinutes:30,maxDurationMinutes:120,aliases:['printer','printer or scanner','scanner']},
  {id:'tech-mobile',slug:'phone-tablet',name:'Phone or tablet',fulfilmentTypes:['home','remote'],defaultDurationMinutes:60,minDurationMinutes:30,maxDurationMinutes:120,aliases:['phone','tablet','phone or tablet','mobile phone','ipad','iphone']},
  {id:'tech-tv',slug:'smart-tv-streaming',name:'Smart TV / streaming',fulfilmentTypes:['home'],defaultDurationMinutes:60,minDurationMinutes:60,maxDurationMinutes:120,aliases:['smart tv','smart tv / streaming','tv','streaming']},
  {id:'tech-new-device',slug:'new-device-setup',name:'New device setup',fulfilmentTypes:['home','remote'],defaultDurationMinutes:60,minDurationMinutes:30,maxDurationMinutes:180,aliases:['new device','new device setup','device setup']},
  {id:'tech-email',slug:'email-accounts',name:'Email / accounts',fulfilmentTypes:['home','remote'],defaultDurationMinutes:60,minDurationMinutes:30,maxDurationMinutes:120,aliases:['email','email / accounts','email and accounts','accounts','passwords']},
  {id:'tech-smart-home',slug:'smart-home',name:'Smart-home device',fulfilmentTypes:['home'],defaultDurationMinutes:60,minDurationMinutes:60,maxDurationMinutes:180,aliases:['smart home','smart-home device','smart home device']},
  {id:'tech-general',slug:'general-help',name:'Something else',fulfilmentTypes:['home','remote'],defaultDurationMinutes:60,minDurationMinutes:30,maxDurationMinutes:120,aliases:['general technology','general technology help','something else','other']}
];

function normalise(value){return String(value||'').trim().toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ')}
export function findService(value){const key=normalise(value);if(!key)return null;return TECHNOLOGY_SERVICES.find(service=>service.id===key||service.slug===key||normalise(service.name)===key||(service.aliases||[]).some(alias=>normalise(alias)===key))||null}
export function publicServiceCatalog(){return{categories:[{...TECHNOLOGY_CATEGORY,services:TECHNOLOGY_SERVICES.map(({aliases,...service})=>service)}]}}
export function serviceSupports(service,fulfilmentType){const item=typeof service==='string'?findService(service):service;return Boolean(item?.fulfilmentTypes?.includes(fulfilmentType))}
