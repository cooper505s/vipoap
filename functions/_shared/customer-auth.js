import {digest} from './admin-auth.js';
export async function customerContext(request,env){
  const token=request.headers.get('x-customer-session')||request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!token||!env.VIPOAP_DATA)return null;
  const session=await env.VIPOAP_DATA.get(`customer-session:${await digest(token)}`,'json');
  if(!session||new Date(session.expiresAt)<=new Date())return null;
  return session;
}
export async function requireCustomer(request,env){return customerContext(request,env)}

