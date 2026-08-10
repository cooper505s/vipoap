import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {digest} from '../functions/_shared/admin-auth.js';
import {onRequestGet,onRequestPost,onRequestPatch} from '../functions/api/admin/knowledge.js';

function setup(){
  const values=new Map();
  const kv={
    async get(key,type){const value=values.get(key);return type==='json'&&value?JSON.parse(value):value??null},
    async put(key,value){values.set(key,value)},
    async list({prefix}){return{keys:[...values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name}))}}
  };
  return{values,env:{ADMIN_PASSWORD:'secret',VIPOAP_DATA:kv}};
}

async function operatorRequest(env,values,url,options={}){
  const token='operator-session';
  values.set(`admin-session:${await digest(token)}`,JSON.stringify({role:'operator',email:'partner@example.test',operatorId:'partner-one',territoryIds:['andover']}));
  values.set('operator:partner-one',JSON.stringify({id:'partner-one',name:'Alex Partner'}));
  return new Request(url,{...options,headers:{'content-type':'application/json','x-admin-session':token,...options.headers}});
}

test('Engineer Partner submissions wait for HQ moderation and never expose staff email',async()=>{
  const{env,values}=setup(),request=await operatorRequest(env,values,'https://example.test/api/admin/knowledge',{method:'POST',body:JSON.stringify({title:'Printer queue reset',category:'Printers',summary:'Clear a stuck print queue safely.',content:'Pause the queue, remove the failed item, restart the printer and confirm with a test page.'})});
  const response=await onRequestPost({request,env}),data=await response.json(),stored=JSON.parse(values.get(data.key));
  assert.equal(response.status,200);
  assert.equal(data.status,'pending-review');
  assert.equal(stored.authorName,'Alex Partner');
  assert.equal('authorEmail' in stored,false);
});

test('HQ publishes an article before it becomes community-visible',async()=>{
  const{env,values}=setup(),key='knowledge:pending';
  values.set(key,JSON.stringify({id:'pending',title:'Router restart',category:'Wi-Fi',summary:'Restart in a safe order.',content:'Switch off the router, wait, restore power and check the connection.',status:'pending-review',authorId:'partner-one'}));
  let request=await operatorRequest(env,values,'https://example.test/api/admin/knowledge');
  let data=await(await onRequestGet({request,env})).json();
  assert.equal(data.articles.length,1);
  values.set('admin-session:'+await digest('other-session'),JSON.stringify({role:'operator',operatorId:'partner-two',territoryIds:['andover']}));
  request=new Request('https://example.test/api/admin/knowledge',{headers:{'x-admin-session':'other-session'}});
  data=await(await onRequestGet({request,env})).json();
  assert.equal(data.articles.length,0);
  request=new Request('https://example.test/api/admin/knowledge',{method:'PATCH',headers:{'content-type':'application/json','x-admin-password':'secret'},body:JSON.stringify({key,status:'published'})});
  assert.equal((await onRequestPatch({request,env})).status,200);
  data=await(await onRequestGet({request:new Request('https://example.test/api/admin/knowledge',{headers:{'x-admin-session':'other-session'}}),env})).json();
  assert.equal(data.articles.length,1);
});

test('published articles accept safe replies and reject customer-identifying details',async()=>{
  const{env,values}=setup(),key='knowledge:published';
  values.set(key,JSON.stringify({id:'published',status:'published',title:'Safe help',category:'Safety',summary:'Keep support safe.',content:'Use the approved process and explain each step.',replies:[]}));
  let request=await operatorRequest(env,values,'https://example.test/api/admin/knowledge',{method:'POST',body:JSON.stringify({articleKey:key,reply:'This also works after checking the device is safely powered.'})});
  assert.equal((await onRequestPost({request,env})).status,200);
  let stored=JSON.parse(values.get(key));
  assert.equal(stored.replies[0].authorName,'Alex Partner');
  assert.equal('authorEmail' in stored.replies[0],false);
  request=await operatorRequest(env,values,'https://example.test/api/admin/knowledge',{method:'POST',body:JSON.stringify({articleKey:key,reply:'The customer lives at SP10 1AA and uses pat@example.com.'})});
  assert.equal((await onRequestPost({request,env})).status,400);
});

test('Knowledge Hub is available in the OS shell and uses controlled moderation',()=>{
  const page=fs.readFileSync('admin/knowledge.html','utf8'),ui=fs.readFileSync('admin/knowledge.js','utf8'),worker=fs.readFileSync('admin/service-worker.js','utf8');
  assert.match(page,/Engineer Community Knowledge Hub/);
  assert.match(page,/Never include customer names/);
  assert.match(ui,/sent to HQ for review/i);
  assert.doesNotMatch(ui,/authorEmail/);
  assert.match(worker,/\/admin\/knowledge\.js/);
});
