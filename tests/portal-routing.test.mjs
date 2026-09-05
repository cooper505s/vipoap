import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('Engineer Partner and administrator sign-ins use separate URLs',()=>{
  const partner=read('admin/index.html');
  const hq=read('admin/hq.html');
  const login=read('admin/email-login.js');
  assert.match(partner,/VIPOAP OS/);
  assert.match(partner,/Administrator sign in/);
  assert.match(partner,/href="hq"/);
  assert.doesNotMatch(partner,/Central administrator sign in/);
  assert.match(hq,/Administrator sign in/);
  assert.match(hq,/id="adminPassword"/);
  assert.match(hq,/href="\/admin\/"/);
  assert.match(login,/Engineer Partner sign in/);
  assert.match(login,/location\.replace\('\/admin\/hq'\)/);
});

test('Engineer Partner home focuses on assigned work and safe tools',()=>{
  const page=read('admin/index.html');
  for(const label of ['My work','Bookings','Call-out history','My area availability'])assert.match(page,new RegExp(label));
  assert.doesNotMatch(page,/Customer export|Invoice export|Download customers/i);
});
