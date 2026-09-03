import {adminContext} from '../../_shared/admin-auth.js';

export async function onRequestGet({request,env}){
  const context=await adminContext(request,env);
  if(!context)return Response.json({error:'Unauthorised'},{status:401});
  return Response.json({
    role:context.role,
    email:context.email,
    operatorId:context.operatorId,
    territoryIds:context.territoryIds,
    permissions:context.permissions
  });
}
