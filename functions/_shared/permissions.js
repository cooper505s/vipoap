export const PERMISSIONS=[
  'view_dashboard','manage_customers','manage_calls','manage_followups','manage_billing',
  'view_franchise','manage_territories','manage_operators','manage_roles','manage_dbs',
  'view_training','manage_training','manage_marketing','manage_brand','export_data',
  'report_incidents','manage_incidents','manage_recordings','manage_equipment','manage_catalogue','manage_operations'
];

export const BUILT_IN_ROLES={
  owner:{id:'owner',name:'Owner',description:'Full control of VIPOAP OS.',permissions:['*'],system:true},
  admin:{id:'admin',name:'Administrator',description:'Business administration without owner-only role control.',permissions:PERMISSIONS.filter(x=>x!=='manage_roles'),system:true},
  operator:{id:'operator',name:'Operator',description:'Customer visits, follow-ups and assigned training.',permissions:['view_dashboard','manage_customers','manage_calls','manage_followups','view_training','manage_marketing','report_incidents','manage_recordings','manage_equipment'],system:true},
  viewer:{id:'viewer',name:'Viewer',description:'Read-only operational and training access.',permissions:['view_dashboard','view_franchise','view_training'],system:true}
};

export async function roleFor(env,id='viewer'){
  if(BUILT_IN_ROLES[id])return BUILT_IN_ROLES[id];
  return env.VIPOAP_DATA?await env.VIPOAP_DATA.get(`role:${id}`,'json'):null;
}
export function hasPermission(context,permission){return Boolean(context&&(context.permissions?.includes('*')||context.permissions?.includes(permission)))}

