import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('Join VIPOAP presents professional network without public commercial split',()=>{
  const page=read('join-us.html'),script=read('assets/script.js');
  assert.match(page,/Join the VIPOAP network/);
  assert.match(page,/technology professionals/i);
  assert.match(page,/Booking volume and earnings are not guaranteed/i);
  assert.doesNotMatch(page,/Customer pays £/i);
  assert.doesNotMatch(page,/VIPOAP receives £/i);
  assert.doesNotMatch(page,/£99/i);
  assert.doesNotMatch(script,/Customer pays £/i);
  assert.doesNotMatch(script,/VIPOAP receives £/i);
  assert.doesNotMatch(script,/£99/i);
});

test('shared public script loads high contrast accessibility fixes',()=>{
  const script=read('assets/script.js'),contrast=read('assets/high-contrast.css');
  assert.match(script,/high-contrast\.css/);
  assert.match(contrast,/html\.contrast \.small-print/);
  assert.match(contrast,/@media \(forced-colors: active\)/);
  assert.match(contrast,/input::placeholder/);
});
