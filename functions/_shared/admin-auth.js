export async function digest(value){const bytes=new TextEncoder().encode(String(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
import {roleFor,hasPermission} from './permissions.js';
export async function adminContext(request,env){
  const password=request.headers.get('x-admin-password');
  if(env.ADMIN_PASSWORD&&password===env.ADMIN_PASSWORD)return{role:'owner',email:'admin@vipoap.co.uk',operatorId:env.DEFAULT_OPERATOR_ID||'dan-stevens',territoryIds:['*'],permissions:['*']};
  const token=request.headers.get('x-admin-session');if(!token||!env.VIPOAP_DATA)return null;
  const session=await env.VIPOAP_DATA.get(`admin-session:${await digest(token)}`,'json');
  if(!session||typeof session!=='object'||Array.isArray(session)||typeof session.role!=='string'||!session.role||typeof session.operatorId!=='string'||!session.operatorId)return null;
  const created=session.createdAt===undefined?null:Date.parse(session.createdAt),expires=session.expiresAt===undefined?null:Date.parse(session.expiresAt);
  if((created!==null&&(!Number.isFinite(created)||Date.now()-created>=28800000))||(expires!==null&&(!Number.isFinite(expires)||expires<=Date.now())))return null;
  const account=await env.VIPOAP_DATA.get(`operator:${session.operatorId}`,'json');
  if(account&&(typeof account!=='object'||Array.isArray(account)))return null;
  if((account?.email!==undefined&&typeof account.email!=='string')||(session.email!==undefined&&typeof session.email!=='string'))return null;
  if(account?.role!==undefined&&(typeof account.role!=='string'||!account.role))return null;
  if(account?.territoryIds!==undefined&&(!Array.isArray(account.territoryIds)||account.territoryIds.some(id=>typeof id!=='string')))return null;
  if(account&&!['active','invited'].includes(account.status||'active'))return null;
  if(account?.email&&session.email&&account.email.trim().toLowerCase()!==session.email.trim().toLowerCase())return null;
  const role=await roleFor(env,account?.role||session.role);if(!role)return null;
  const bootstrapOwner=role.id==='owner'&&session.operatorId===(env.DEFAULT_OPERATOR_ID||'dan-stevens')&&session.email==='admin@vipoap.co.uk';
  const territoryIds=bootstrapOwner?['*']:Array.isArray(account?.territoryIds)?account.territoryIds:Array.isArray(session.territoryIds)?session.territoryIds:[];
  return{role:role.id,email:account?.email||session.email||'',operatorId:session.operatorId,territoryIds,permissions:role.permissions||[]};
}
export async function authorised(request,env,permission=''){const context=await adminContext(request,env);return Boolean(context&&(!permission||hasPermission(context,permission)))}
export function canAccessTerritory(context,territoryId='andover'){return Boolean(context&&(context.territoryIds.includes('*')||context.territoryIds.includes(territoryId||'andover')))}
export function assignedTerritory(context,requested='andover'){if(!context)return null;if(context.territoryIds.includes('*'))return requested||'andover';return context.territoryIds.includes(requested)?requested:context.territoryIds[0]||null}
