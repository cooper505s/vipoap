// Internal storage primitive only. No production route calls this foundation yet.
// Callers must enforce identity, permissions, valid state transitions and slot rules.
function failure(message,status){return Object.assign(new Error(message),{status});}
function canonical(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  throw failure('Booking changes must contain JSON values only.',400);
}
async function fingerprint(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
const size=value=>new TextEncoder().encode(value).byteLength;
export async function commitBookingChange(db,{bookingId,expectedRevision,requestId,snapshot,events=[],reservation,commandMetadata}){
  if(!db)throw failure('Transactional booking storage is unavailable.',503);
  if(typeof bookingId!=='string'||!bookingId||bookingId.length>160||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)throw failure('Invalid booking identity or revision.',400);
  if(typeof requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))throw failure('A unique change request is required.',400);
  if(!snapshot||Array.isArray(snapshot)||Object.getPrototypeOf(snapshot)!==Object.prototype||!Array.isArray(events)||events.length>20)throw failure('Invalid booking change.',400);
  const body=canonical(snapshot);if(size(body)>65536)throw failure('Booking record is too large.',413);
  const normalized=events.map(event=>{
    if(!event||typeof event.kind!=='string'||!event.kind.trim()||event.kind.length>80)throw failure('Invalid booking event.',400);
    const payload=canonical(event.payload);if(size(payload)>16384)throw failure('Booking event is too large.',413);
    return{kind:event.kind,payload};
  });
  if(reservation!==undefined&&reservation!==null&&(typeof reservation.engineerId!=='string'||!reservation.engineerId||reservation.engineerId.length>120||!Number.isSafeInteger(reservation.startMs)||!Number.isSafeInteger(reservation.endMs)||reservation.startMs<0||reservation.endMs<=reservation.startMs))throw failure('Invalid engineer reservation.',400);
  const slot=reservation===undefined?{mode:'preserve'}:reservation===null?null:{engineerId:reservation.engineerId,startMs:reservation.startMs,endMs:reservation.endMs};
  if(commandMetadata!==undefined&&(!commandMetadata||Object.getPrototypeOf(commandMetadata)!==Object.prototype||Object.keys(commandMetadata).sort().join(',')!=='actor,inputHash,kind,version'||commandMetadata.version!==1||typeof commandMetadata.actor!=='string'||typeof commandMetadata.inputHash!=='string'||!/^[a-f0-9]{64}$/.test(commandMetadata.actor)||!/^[a-f0-9]{64}$/.test(commandMetadata.inputHash)||typeof commandMetadata.kind!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(commandMetadata.kind)))throw failure('Invalid booking command receipt.',400);
  const commandJson=commandMetadata===undefined?undefined:canonical(commandMetadata);
  const id=requestId.toLowerCase(),requestHash=await fingerprint(canonical({bookingId,expectedRevision,snapshot,events:normalized,reservation:slot,...(commandMetadata===undefined?{}:{commandMetadata})}));
  const prior=await db.prepare('SELECT booking_id,request_hash,revision FROM booking_mutations WHERE id=?').bind(id).first();
  if(prior){if(prior.request_hash!==requestHash)throw failure('This request was already used for different booking changes.',409);return{bookingId:prior.booking_id,revision:prior.revision,reused:true};}
  const now=new Date().toISOString(),revision=expectedRevision+1,commitToken=crypto.randomUUID();
  const statements=[
    db.prepare('INSERT INTO booking_transactions (id,snapshot_json,revision,last_request_id,updated_at) SELECT ?,?,1,?,? WHERE ?=0 ON CONFLICT(id) DO NOTHING').bind(bookingId,body,id,now,expectedRevision),
    db.prepare('UPDATE booking_transactions SET snapshot_json=?,revision=revision+1,last_request_id=?,updated_at=? WHERE id=? AND revision=? AND ?>0').bind(body,id,now,bookingId,expectedRevision,expectedRevision),
    db.prepare('INSERT INTO booking_mutations (id,booking_id,request_hash,commit_token,revision,created_at) SELECT ?,id,?,?,revision,? FROM booking_transactions WHERE id=? AND last_request_id=? AND revision=? ON CONFLICT(id) DO NOTHING').bind(id,requestHash,commitToken,now,bookingId,id,revision),
    ...(commandJson===undefined?[]:[db.prepare('UPDATE booking_mutations SET command_json=? WHERE id=? AND commit_token=?').bind(commandJson,id,commitToken)]),
    ...(reservation===undefined?[]:[db.prepare('DELETE FROM booking_slot_reservations WHERE booking_id=? AND EXISTS(SELECT 1 FROM booking_mutations WHERE id=? AND commit_token=?)').bind(bookingId,id,commitToken)]),
    ...(reservation?[db.prepare('INSERT INTO booking_slot_reservations (booking_id,engineer_id,start_ms,end_ms) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM booking_mutations WHERE id=? AND commit_token=?)').bind(bookingId,reservation.engineerId,reservation.startMs,reservation.endMs,id,commitToken)]:[]),
    ...normalized.map((event,index)=>db.prepare("INSERT INTO booking_outbox (id,mutation_id,booking_id,kind,payload_json,created_at) SELECT ?,?,?,?, ?,? WHERE EXISTS(SELECT 1 FROM booking_mutations WHERE id=? AND commit_token=?) ON CONFLICT(id) DO NOTHING").bind(`${id}:${index}`,id,bookingId,event.kind,event.payload,now,id,commitToken))
  ];
  statements.push(db.prepare('SELECT booking_id,request_hash,revision FROM booking_mutations WHERE id=?').bind(id));
  let results;try{results=await db.batch(statements);}catch(error){if(String(error.message).includes('booking-slot-conflict'))throw failure('This engineer already has a booking in that time range.',409);throw error;}
  const saved=results.at(-1).results?.[0];
  if(!saved)throw failure('This booking changed. Refresh before trying again.',409);
  if(saved.request_hash!==requestHash)throw failure('This request was already used for different booking changes.',409);
  return{bookingId:saved.booking_id,revision:saved.revision,reused:results[2].meta.changes===0};
}
