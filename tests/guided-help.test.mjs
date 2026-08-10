import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
test('customer app provides safe guided help with a human hand-off',()=>{const page=read('app/index.html'),guide=read('app/guided-help.js');assert.match(page,/guided-help\.js/);assert.match(guide,/factory-reset button/);assert.match(guide,/Do not click, reply, pay or allow remote access/);assert.match(guide,/password, PIN, recovery code/);assert.match(guide,/Book technology help/);assert.match(guide,/Send a help request/)});
test('guided help is available offline in the customer app',()=>{const worker=read('app/service-worker.js');assert.match(worker,/vipoap-app-v18/);assert.match(worker,/\/app\/guided-help\.js/)})
