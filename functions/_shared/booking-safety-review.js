// Inactive private case-management adapter. Never resumes work or changes payment state.
import {adminContext,canAccessTerritory,digest} from './admin-auth.js';
import {loadBookingSafetyCase} from './booking-safety.js';
import {hasPermission} from './permissions.js';
const fail=(message,status)=>Object.assign(new Error(message),{status});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const statuses=['new','triaged','action-required','awaiting-information','resolved','closed'];
export async function reviewBookingSafetyCase({request,env,incidentId,expectedRevision,requestId,changes}){
 const context=await adminContext(request,env);
 if(!hasPermission(context,'manage_incidents'))throw fail('Safety case access required.',403);
 if(typeof incidentId!=='string'||!incidentId.startsWith('incident:')||!uuid.test(incidentId.slice(9))||incidentId!==incidentId.toLowerCase())throw fail('Safety case not found.',404);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision>=Number.MAX_SAFE_INTEGER||typeof requestId!=='string'||!uuid.test(requestId))throw fail('A valid case revision and unique review request are required.',400);
 if(!changes||Object.getPrototypeOf(changes)!==Object.prototype||Object.keys(changes).sort().join(',')!=='note,status'||!statuses.includes(changes.status)||typeof changes.note!=='string'||!changes.note.trim()||changes.note.trim().length>2000)throw fail('Choose a case status and add a review note of up to 2000 characters.',400);
 const db=env.VIPOAP_BOOKING_DB;if(!db)throw fail('Safety review storage is unavailable.',503);
 let row;try{row=await db.prepare('SELECT id,territory_id,status,revision FROM booking_safety_cases WHERE id=?').bind(incidentId).first()}catch{throw fail('Safety review storage is unavailable.',503)}
 if(!row||typeof row.territory_id!=='string'||!row.territory_id.trim()||!canAccessTerritory(context,row.territory_id))throw fail('Safety case not found.',404);
 const id=requestId.toLowerCase(),note=changes.note.trim(),actorHash=await digest(context.operatorId),inputHash=await digest(JSON.stringify({incidentId,expectedRevision,status:changes.status,note}));
 const receipt=()=>db.prepare('SELECT case_id,revision,actor_hash,input_hash FROM booking_safety_reviews WHERE id=?').bind(id).first();
 const project=prior=>{if(prior.case_id!==incidentId||prior.actor_hash!==actorHash||prior.input_hash!==inputHash)throw fail('This request was already used for a different safety review.',409);return {incidentId,revision:prior.revision,reused:true}};
 let prior;try{prior=await receipt()}catch{throw fail('Safety review storage is unavailable.',503)}
 if(prior)return project(prior);
 if(row.revision!==expectedRevision)throw fail('This case has changed. Refresh before reviewing it.',409);
 const now=new Date().toISOString(),token=crypto.randomUUID(),revision=expectedRevision+1;
 let result;
 try{result=await db.batch([
  db.prepare('UPDATE booking_safety_cases SET status=?,revision=revision+1,last_review_id=?,review_token=?,updated_at=? WHERE id=? AND revision=? AND territory_id=?').bind(changes.status,id,token,now,incidentId,expectedRevision,row.territory_id),
  db.prepare('INSERT INTO booking_safety_reviews (id,case_id,revision,actor_id,actor_hash,input_hash,prior_status,status,note,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM booking_safety_cases WHERE id=? AND revision=? AND last_review_id=? AND review_token=?)').bind(id,incidentId,revision,context.operatorId,actorHash,inputHash,row.status,changes.status,note,now,incidentId,revision,id,token)
 ])}catch{const saved=await receipt().catch(()=>null);if(saved)return project(saved);throw fail('Safety review could not be saved. Retry with the same request.',503)}
 if(result[1]?.meta?.changes===1)return {incidentId,revision,reused:false};
 prior=await receipt();if(prior)return project(prior);
 throw fail('This case has changed. Refresh before reviewing it.',409);
}

export async function listBookingSafetyReviews({request,env,incidentId,afterRevision=1,limit=50}){
 await loadBookingSafetyCase({request,env,incidentId});
 if(!Number.isSafeInteger(afterRevision)||afterRevision<1||!Number.isInteger(limit)||limit<1||limit>100)throw fail('Invalid review history page.',400);
 let result;try{result=await env.VIPOAP_BOOKING_DB.prepare('SELECT revision,actor_id,prior_status,status,note,created_at FROM booking_safety_reviews WHERE case_id=? AND revision>? ORDER BY revision ASC LIMIT ?').bind(incidentId,afterRevision,limit+1).all()}catch{throw fail('Safety review storage is unavailable.',503)}
 if(!Array.isArray(result?.results))throw fail('Safety review storage could not be read.',503);
 const items=result.results.slice(0,limit).map(row=>({revision:row.revision,actorId:row.actor_id,priorStatus:row.prior_status,status:row.status,note:row.note,createdAt:row.created_at}));
 return {items,nextRevision:result.results.length>limit?items.at(-1).revision:null};
}
