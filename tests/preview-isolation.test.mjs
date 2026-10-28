import test from 'node:test';import assert from 'node:assert/strict';
import {onRequest} from '../functions/_middleware.js';
test('middleware preserves form security and response protections for function-wrapped pages',async()=>{
  const response=await onRequest({request:new Request('https://vipoap.co.uk/join-us'),next:async()=>new Response('page')});
  assert.match(response.headers.get('content-security-policy'),/form-action 'self' https:\/\/\*\.stripe\.com/);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('x-frame-options'),'DENY');
});
test('preview blocks external-effect routes and excludes every response from indexing',async()=>{
  let called=false;const next=async()=>{called=true;return new Response('ok');};
  const blocked=await onRequest({request:new Request('https://branch.vipoap.pages.dev/api/bookings',{method:'POST'}),next});
  assert.equal(blocked.status,403);assert.equal(called,false);assert.match(blocked.headers.get('x-robots-tag'),/noindex/);
  const page=await onRequest({request:new Request('https://branch.vipoap.pages.dev/'),next});assert.equal(called,true);assert.match(page.headers.get('x-robots-tag'),/noindex/);
});
test('preview permits only the isolated application write paths',async()=>{
  let called=false;
  const response=await onRequest({request:new Request('https://branch.vipoap.pages.dev/api/engineer-applications',{method:'POST'}),next:async()=>{called=true;return new Response('stored',{status:201});}});
  assert.equal(called,true);assert.equal(response.status,201);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('custom-domain production requests retain their normal behaviour',async()=>{
  const response=await onRequest({request:new Request('https://vipoap.co.uk/api/bookings',{method:'POST'}),next:async()=>new Response('normal',{status:201})});
  assert.equal(response.status,201);assert.equal(response.headers.get('x-robots-tag'),null);assert.equal(await response.text(),'normal');
});
