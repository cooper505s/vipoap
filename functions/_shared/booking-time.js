// Staged reservation conversion. No live booking handler imports this module yet.
const zone='Europe/London';
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const partsAt=ms=>Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
const wallMs=parts=>Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute);
const invalid=message=>Object.assign(new Error(message),{status:400});

export function ukAppointmentInterval({date,time,durationMinutes}){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw invalid('Choose a valid appointment date and time.');
  const [year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number),naive=Date.UTC(year,month-1,day,hour,minute),check=new Date(naive);
  if(year<2000||year>2100||check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)throw invalid('Choose a valid appointment date.');
  if(!Number.isSafeInteger(durationMinutes)||durationMinutes<1||durationMinutes>480)throw invalid('Choose a valid appointment duration.');
  // Discover the offsets on either side of a clock change, then round-trip each
  // candidate. A gap has no match; a repeated hour has two and needs a new time.
  const offsets=new Set([-36,0,36].map(hours=>{const sample=naive+hours*3600000;return wallMs(partsAt(sample))-sample;}));
  const candidates=[...offsets].map(offset=>naive-offset).filter(ms=>wallMs(partsAt(ms))===naive);
  if(candidates.length===0)throw invalid('This UK time does not exist because the clocks change. Choose another time.');
  if(candidates.length!==1)throw invalid('This UK time occurs twice because the clocks change. Choose another time.');
  const startMs=candidates[0];
  return{startMs,endMs:startMs+durationMinutes*60000,timeZone:zone};
}
