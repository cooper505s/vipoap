import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {onRequest} from '../functions/_middleware.js';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('sitemap URLs match self-canonical public pages without indexing exclusions',()=>{
  const urls=[...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert.equal(new Set(urls).size,urls.length);
  for(const href of urls){const url=new URL(href);assert.equal(url.origin,'https://vipoap.co.uk');assert.ok(!url.pathname.endsWith('.html'));const file=url.pathname==='/'?'index.html':url.pathname.slice(1)+'.html',html=read(file),canonical=html.match(/<link rel="canonical" href="([^"]+)"/);assert.equal(canonical?.[1],href,file);assert.doesNotMatch(html,/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i,file);}
  assert.ok(urls.includes('https://vipoap.co.uk/book'));assert.ok(urls.includes('https://vipoap.co.uk/join-us'));
});
test('www requests preserve the path and query while consolidating at HTTPS apex',async()=>{
  const response=await onRequest({request:new Request('https://www.vipoap.co.uk/join-us?source=test'),next:()=>{throw Error('Should redirect before origin response');}});
  assert.equal(response.status,308);assert.equal(response.headers.get('location'),'https://vipoap.co.uk/join-us?source=test');
});
test('private portal and token-bearing pages carry HTTP indexing exclusions',async()=>{
  for(const path of ['/admin/control','/app/account','/additional-time','/review','/help?access=synthetic']){
    const response=await onRequest({request:new Request('https://vipoap.co.uk'+path),next:async()=>new Response('page')});assert.match(response.headers.get('x-robots-tag'),/noindex/,path);
  }
});
test('engineer application form submits within the deployed form-action policy',()=>{
  const html=read('join-us.html'),action=html.match(/<form[^>]*id="engineerApplication"[^>]*action="([^"]+)"/)?.[1];assert.ok(action);
  const origin=new URL(action,'https://vipoap.co.uk').origin;assert.equal(origin,'https://vipoap.co.uk');assert.match(read('_headers'),/form-action 'self'/);assert.doesNotMatch(html,/interest=sent|formsubmit\.co/);
});
