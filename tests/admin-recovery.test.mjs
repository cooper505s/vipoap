import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const loginScript=readFileSync(new URL('../admin/email-login.js',import.meta.url),'utf8');
const requestApi=readFileSync(new URL('../functions/api/admin/auth/request.js',import.meta.url),'utf8');

test('central administrator login exposes secure forgot-password recovery',()=>{
  assert.match(loginScript,/Forgot password\?/i);
  assert.match(loginScript,/admin@vipoap\.co\.uk/);
  assert.match(loginScript,/\/api\/admin\/auth\/request/);
  assert.match(loginScript,/\/api\/admin\/auth\/verify/);
  assert.match(loginScript,/one-time sign-in code/i);
  assert.doesNotMatch(loginScript,/password\s*[:=]\s*['"`][^'"`]+['"`]/i);
  assert.doesNotMatch(loginScript,/body\s*:\s*JSON\.stringify\([^)]*password/i);
});

test('owner email recovery remains rate-limited and single-use',()=>{
  assert.match(requestApi,/OWNER_EMAIL='admin@vipoap\.co\.uk'/);
  assert.match(requestApi,/takeRateLimit/);
  assert.match(requestApi,/expirationTtl:600/);
  assert.match(requestApi,/can only be used once/i);
});
