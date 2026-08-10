const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):'';
export function operatorCompliance(operator,now=new Date()){
  const today=now.toISOString().slice(0,10),warning=new Date(now.getTime()+60*86400000).toISOString().slice(0,10),checks=[
    {id:'training',label:'Required training',status:operator.trainingStatus==='complete'?'current':'missing',expiresAt:''},
    {id:'dbs',label:'DBS check',status:operator.dbsStatus!=='verified'?'missing':day(operator.dbsRenewalDate)&&operator.dbsRenewalDate<today?'expired':day(operator.dbsRenewalDate)&&operator.dbsRenewalDate<=warning?'expiring':'current',expiresAt:day(operator.dbsRenewalDate)},
    {id:'photo',label:'Approved identity photo',status:operator.photoStatus==='approved'?'current':'missing',expiresAt:''},
    {id:'agreement',label:'Engineer Partner agreement',status:operator.agreementStatus==='signed'?'current':'missing',expiresAt:''},
    {id:'insurance',label:'Public liability insurance',status:operator.insuranceStatus!=='verified'?'missing':day(operator.insuranceExpiryDate)&&operator.insuranceExpiryDate<today?'expired':day(operator.insuranceExpiryDate)&&operator.insuranceExpiryDate<=warning?'expiring':'current',expiresAt:day(operator.insuranceExpiryDate)}
  ],blocking=checks.filter(item=>['missing','expired'].includes(item.status)),warnings=checks.filter(item=>item.status==='expiring');
  return{operatorId:operator.id,name:operator.name,territoryIds:operator.territoryIds||[],operatorStatus:operator.status||'invited',workAuthorised:(operator.status||'invited')==='active'&&!blocking.length,status:blocking.length?'blocked':warnings.length?'expiring':'current',blockingCount:blocking.length,warningCount:warnings.length,checks};
}
export function operatorCanReceiveWork(operator,now=new Date()){const lifecycleStarted=['trainingStatus','dbsStatus','photoStatus','agreementStatus','insuranceStatus'].some(field=>field in (operator||{}));return lifecycleStarted?operatorCompliance(operator,now).workAuthorised:(operator?.status||'active')==='active'}
