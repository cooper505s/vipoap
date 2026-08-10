import {authorised} from '../../_shared/admin-auth.js';
import {DEFAULT_RULES,platformRules} from '../../_shared/platform-rules.js';

export async function onRequestGet({request,env}){
  if(!await authorised(request,env,'manage_brand'))return Response.json({error:'Unauthorised'},{status:401});
  return Response.json({rules:await platformRules(env),defaults:DEFAULT_RULES});
}

export async function onRequestPut({request,env}){
  if(!await authorised(request,env,'manage_brand'))return Response.json({error:'Unauthorised'},{status:401});
  if(!env.VIPOAP_DATA)return Response.json({error:'VIPOAP_DATA binding is not configured.'},{status:500});
  const body=await request.json();
  if(!body||typeof body.rules!=='object'||Array.isArray(body.rules))return Response.json({error:'Rules are required.'},{status:400});
  await env.VIPOAP_DATA.put('config:platform-rules',JSON.stringify(body.rules));
  return Response.json({ok:true,rules:await platformRules(env)});
}

