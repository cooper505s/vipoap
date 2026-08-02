const DEFAULT_AVAILABILITY={monday:[['19:00','21:00']],wednesday:[['19:00','21:00']],saturday:[['11:00','13:00'],['16:00','19:00']]};
const DAY_NAMES=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
function addMinutes(time,mins){const [h,m]=time.split(':').map(Number);const d=new Date(2000,0,1,h,m+mins);return d.toTimeString().slice(0,5)}
function toMinutes(time){const [h,m]=time.split(':').map(Number);return h*60+m}
async function getSettings(env){if(!env.VIPOAP_DATA)return {weekly:DEFAULT_AVAILABILITY,blockedDates:[]};const saved=await env.VIPOAP_DATA.get('availability','json');return saved||{weekly:DEFAULT_AVAILABILITY,blockedDates:[]}}
export async function onRequestGet({request,env}){
  const url=new URL(request.url),date=url.searchParams.get('date'),duration=Number(url.searchParams.get('duration'));
  if(!date||![30,60].includes(duration))return Response.json({error:'Choose a valid date and appointment length.'},{status:400});
  const chosen=new Date(`${date}T12:00:00`);if(Number.isNaN(chosen.getTime()))return Response.json({error:'Invalid date.'},{status:400});
  const settings=await getSettings(env);if(settings.blockedDates?.includes(date))return Response.json({slots:[]});
  const ranges=settings.weekly?.[DAY_NAMES[chosen.getDay()]]||[];let slots=[];
  for(const [start,end] of ranges){for(let t=start;toMinutes(t)+duration<=toMinutes(end);t=addMinutes(t,30))slots.push(t)}
  if(env.VIPOAP_DATA){
    const keys=await env.VIPOAP_DATA.list({prefix:`booking:${date}:`});
    const booked=(await Promise.all(keys.keys.map(k=>env.VIPOAP_DATA.get(k.name,'json')))).filter(Boolean).filter(b=>!['declined','cancelled'].includes(b.status));
    slots=slots.filter(slot=>{const start=toMinutes(slot),end=start+duration;return !booked.some(b=>{const bs=toMinutes(b.time),be=bs+Number(b.duration||30);return start<be&&end>bs})});
  }
  return Response.json({slots,timezone:'Europe/London'});
}