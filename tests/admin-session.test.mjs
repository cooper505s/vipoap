import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/admin/session.js';

test('owner session exposes full effective portal access',async()=>{
  const request=new Request('https://example.test/api/admin/session',{headers:{'x-admin-password':'secret'}});
  const response=await onRequestGet({request,env:{ADMIN_PASSWORD:'secret',DEFAULT_OPERATOR_ID:'dan-stevens'}});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.role,'owner');
  assert.deepEqual(data.permissions,['*']);
  assert.deepEqual(data.territoryIds,['*']);
});

test('unknown session cannot discover portal permissions',async()=>{
  const request=new Request('https://example.test/api/admin/session');
  const response=await onRequestGet({request,env:{}});
  assert.equal(response.status,401);
});
