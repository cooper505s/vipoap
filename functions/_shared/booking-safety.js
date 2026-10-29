// Inactive restricted case reader. Never exposes full reports through booking events.
import {adminContext,canAccessTerritory} from './admin-auth.js';
import {hasPermission} from './permissions.js';
const fail=(message,status)=>Object.assign(new Error(message),{status});
export async function loadBookingSafetyCase({request,env,incidentId}){
 const context=await adminContext(request,env);if(!hasPermission(context,'manage_incidents'))throw fail('Safety case access required.',403);
 if(typeof incidentId!=='string'||!/^incident:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(incidentId))throw fail('Safety case not found.',404);
 if(!env.VIPOAP_BOOKING_DB)throw fail('Safety case storage is unavailable.',503);
 const row=await env.VIPOAP_BOOKING_DB.prepare('SELECT id,booking_id,territory_id,report_json,status,created_at FROM booking_safety_cases WHERE id=?').bind(incidentId).first();
 if(!row||typeof row.territory_id!=='string'||!row.territory_id.trim()||!canAccessTerritory(context,row.territory_id))throw fail('Safety case not found.',404);
 let report;try{report=JSON.parse(row.report_json)}catch{throw fail('Safety case storage could not be read.',503)}
 if(!report||typeof report!=='object'||Array.isArray(report))throw fail('Safety case storage could not be read.',503);
 return {id:row.id,bookingId:row.booking_id,territoryId:row.territory_id,status:row.status,createdAt:row.created_at,report};
}
