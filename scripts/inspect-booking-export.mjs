// Offline inspection only: no credentials, network calls, database writes or import.
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ukAppointmentInterval} from '../functions/_shared/booking-time.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const invalid=()=>new Error('The export is incomplete or has invalid booking records.');

export function inspectBookingExport(input){
  if(input?.complete!==true||!Array.isArray(input.records)||input.records.length>100000||!['preview','production'].includes(input.source)||!Number.isFinite(Date.parse(input.exportedAt)))throw invalid();
  const seen=new Set(),bookings=[];let otherRecords=0;
  for(const item of input.records){
    if(!item||typeof item.key!=='string'||!item.key||item.key.length>512||seen.has(item.key))throw invalid();
    seen.add(item.key);
    if(!item.key.startsWith('booking:')){otherRecords++;continue;}
    if(typeof item.value!=='string'||Buffer.byteLength(item.value)>1048576)throw invalid();
    let record;try{record=JSON.parse(item.value)}catch{throw invalid()}
    if(!record||typeof record!=='object'||Array.isArray(record))throw invalid();
    const issues=[];
    if(typeof record.reference!=='string'||!record.reference.trim())issues.push('missing-reference');
    try{ukAppointmentInterval({date:record.date,time:record.time,durationMinutes:60})}catch{issues.push('invalid-wall-time')}
    if(!Number.isSafeInteger(record.duration)||record.duration<1||record.duration>480)issues.push('invalid-duration');
    const states=[record.status,record.bookingStatus,record.jobStatus].filter(Boolean);
    if(!states.length)issues.push('missing-state');
    bookings.push({key:item.key,sourceHash:hash(item.value),issues});
  }
  bookings.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  return{version:1,source:input.source,exportedAt:input.exportedAt,dryRun:true,cutoverReady:false,recordCount:input.records.length,otherRecordCount:otherRecords,bookingCount:bookings.length,exceptionCount:bookings.filter(item=>item.issues.length).length,manifestHash:hash(JSON.stringify(bookings)),bookings};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3||statSync(process.argv[2]).size>104857600)throw invalid();
    const result=inspectBookingExport(JSON.parse(readFileSync(process.argv[2],'utf8')));
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch{process.stderr.write('Export inspection failed. Use a complete, valid private export file.\n');process.exitCode=1;}
}
