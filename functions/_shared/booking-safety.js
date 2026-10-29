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

// Keyset pagination is scoped in SQL before LIMIT; list results never include report text.
export async function listBookingSafetyCases({request,env,limit=50,status=null,cursor=null}){
 const context=await adminContext(request,env);
 if(!hasPermission(context,'manage_incidents'))throw fail('Safety case access required.',403);
 const statuses=['new','triaged','action-required','awaiting-information','resolved','closed'];
 if(!Number.isInteger(limit)||limit<1||limit>100)throw fail('Choose a page size between 1 and 100.',400);
 if(status!==null&&!statuses.includes(status))throw fail('Choose a valid safety case status.',400);
 if(cursor!==null&&(!cursor||typeof cursor!=='object'||Array.isArray(cursor)||Object.keys(cursor).sort().join(',')!=='createdAt,id'||typeof cursor.createdAt!=='string'||!Number.isFinite(Date.parse(cursor.createdAt))||typeof cursor.id!=='string'||!/^incident:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(cursor.id)))throw fail('Invalid safety case page cursor.',400);
 if(!env.VIPOAP_BOOKING_DB)throw fail('Safety case storage is unavailable.',503);
 const territories=[...new Set(context.territoryIds.filter(id=>typeof id==='string'&&id.trim()))];
 if(!territories.length)return {items:[],nextCursor:null};
 const where=["length(trim(territory_id))>0"],values=[];
 if(!territories.includes('*')){where.push(`territory_id IN (${territories.map(()=>'?').join(',')})`);values.push(...territories)}
 if(status!==null){where.push('status=?');values.push(status)}
 if(cursor!==null){where.push('(created_at<? OR (created_at=? AND id<?))');values.push(cursor.createdAt,cursor.createdAt,cursor.id)}
 values.push(limit+1);
 let result;try{result=await env.VIPOAP_BOOKING_DB.prepare(`SELECT id,booking_id,territory_id,status,created_at FROM booking_safety_cases WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...values).all()}catch{throw fail('Safety case storage is unavailable.',503)}
 if(!Array.isArray(result?.results))throw fail('Safety case storage could not be read.',503);
 const items=result.results.slice(0,limit).map(row=>({id:row.id,bookingId:row.booking_id,territoryId:row.territory_id,status:row.status,createdAt:row.created_at}));
 const last=items.at(-1);
 return {items,nextCursor:result.results.length>limit?{createdAt:last.createdAt,id:last.id}:null};
}
