import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('customer pages and app use the green VIPOAP browser icon',()=>{
  assert.ok(fs.existsSync(new URL('../favicon.ico',import.meta.url)));
  assert.match(read('assets/script.js'),/favicon-32\.png/);
  assert.match(read('app/index.html'),/favicon-32\.png/);
  assert.match(read('app/account.html'),/favicon-32\.png/);
  assert.match(read('app/service-worker.js'),/favicon-32\.png/);
});

test('every partner and admin page receives the blue VIPOAP OS browser icon',()=>{
  const navigation=read('admin/mobile-nav.js');
  assert.match(navigation,/vipoap-os-icon-192\.png/);
  for(const file of fs.readdirSync(new URL('../admin',import.meta.url)).filter(name=>name.endsWith('.html'))){const html=read(`admin/${file}`);assert.ok(/mobile-nav\.js\?v=(3|4)/.test(html)||/vipoap-os-icon-192\.png/.test(html),file)}
});
