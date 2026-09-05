import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {digest} from '../functions/_shared/admin-auth.js';
import {onRequestGet,onRequestPost} from '../functions/api/admin/health-checks.js';

function setup(){
  const values=new Map([['customer:one',JSON.stringify({name:'Margaret',territoryId:'andover',operatorId:'alex'})]]);
  return{values,env:{ADMIN_PASSWORD:'secret',VIPOAP_DATA:{
    async get(key,type){const value=values.get(key);return type==='json'&&value?JSON.parse(value):value??null},
    async put(key,value){values.set(key,value)},
    async list({prefix}){return{keys:[...values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name}))}}
  }}};
}
const request=(method='GET',body,url='https://vipoap.test/api/admin/health-checks?customerId=customer%3Aone',headers={'x-admin-password':'secret'})=>new Request(url,{method,headers:{'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});

test('overall technology score is calculated from eight controlled assessment areas',async()=>{
  const{env,values}=setup();
  const answers={broadband:'good',wifi:'attention',accounts:'urgent',updates:'good',backup:'monitor',devices:'attention',smartHome:'good',scamAwareness:'attention'};
  const notes={wifi:'Signal drops in the rear bedroom.',accounts:'Multi-factor authentication still needs enabling.'};
  const response=await onRequestPost({request:request('POST',{customerId:'customer:one',overallScore:100,answers,notes,observations:'Backups and account security need follow-up.'}),env});
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.check.overallScore,68);
  assert.equal(data.check.accountsScore,20);
  assert.equal(data.check.notes.wifi,notes.wifi);
  assert.ok(data.check.recommendations.some(item=>/account protection.*prompt action/i.test(item)));
  assert.equal(JSON.parse(values.get('customer:one')).technologyScore,68);
  assert.equal([...values.keys()].filter(key=>key.startsWith('followup:')).length,0);
});

test('not-applicable areas are excluded and a low score creates an admin-controlled follow-up',async()=>{
  const{env,values}=setup();
  const answers={broadband:'urgent',wifi:'urgent',accounts:'urgent',updates:'attention',backup:'attention',devices:'not-applicable',smartHome:'not-applicable',scamAwareness:'not-applicable'};
  const response=await onRequestPost({request:request('POST',{customerId:'customer:one',answers}),env});
  const data=await response.json();
  assert.equal(data.check.overallScore,32);
  assert.equal(data.check.devicesScore,null);
  assert.equal([...values.keys()].filter(key=>key.startsWith('followup:')).length,1);
  const listed=await(await onRequestGet({request:request(),env})).json();
  assert.equal(listed.checks.length,1);
});

test('Engineer Partners cannot read or submit central customer health checks',async()=>{
  const{env,values}=setup();
  const token='operator';
  values.set(`admin-session:${await digest(token)}`,JSON.stringify({role:'operator',operatorId:'alex',territoryIds:['andover'],email:'alex@example.test'}));
  const operatorHeaders={'x-admin-session':token};
  const getResponse=await onRequestGet({request:request('GET',null,'https://vipoap.test/api/admin/health-checks?customerId=customer%3Aone',operatorHeaders),env});
  const postResponse=await onRequestPost({request:request('POST',{customerId:'customer:one',answers:{}},'https://vipoap.test/api/admin/health-checks',operatorHeaders),env});
  assert.equal(getResponse.status,403);
  assert.equal(postResponse.status,403);
});

test('health check UI provides eight described areas, quick choices and notes without an editable score',()=>{
  const page=fs.readFileSync(new URL('../admin/health-check.html',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../app/account-health.js',import.meta.url),'utf8');
  assert.match(page,/VIPOAP calculates the overall score|Calculating and saving/);
  assert.doesNotMatch(page,/id="overallScore"/);
  for(const id of ['broadband','wifi','accounts','updates','backup','devices','smartHome','scamAwareness'])assert.match(page,new RegExp(`id:'${id}'`));
  assert.match(page,/Not checked \/ not applicable/);
  assert.match(page,/Optional note for this area/);
  assert.match(page,/Customer-safe visit summary/);
  assert.match(app,/Home Health Check/);
});
