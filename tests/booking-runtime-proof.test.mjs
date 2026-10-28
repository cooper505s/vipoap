import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/booking-runtime-proof/src/index.js';
import {bookingDatabase} from './helpers/booking-database.mjs';

test('runtime proof has no public execution endpoint',async()=>{
  const response=await worker.fetch(new Request('https://example.test/__scheduled'));assert.equal(response.status,404);assert.equal(await response.text(),'Not found');
});

test('runtime proof fails before mutations without its isolated preview marker',async()=>{
  await assert.rejects(worker.scheduled({},{}),/Preview test binding/);
  const {db,sql}=bookingDatabase();await assert.rejects(worker.scheduled({},{VIPOAP_TEST_DB:db}),/isolated preview fixture/);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM booking_transactions').get().n,0);
});

test('runtime harness verifies batch conflicts, replay and rollback then releases slots',async t=>{
  const {db,sql}=bookingDatabase();sql.prepare("INSERT INTO booking_transactions VALUES ('qa-foundation-one-20261028','{}',1,'fixture','2026-10-28')").run();
  const original=console.log,logs=[];console.log=message=>logs.push(JSON.parse(message));t.after(()=>console.log=original);
  await worker.scheduled({},{VIPOAP_TEST_DB:db});assert.equal(logs.length,1);const result=logs[0];assert.equal(result.passed,true);assert.equal(result.checks.length,12);
  const proof=JSON.parse(sql.prepare('SELECT snapshot_json FROM booking_transactions WHERE id=?').get(result.bookingId).snapshot_json);assert.equal(proof.proof,'passed');assert.deepEqual(proof.checks,result.checks);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM booking_slot_reservations').get().n,0);assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM booking_outbox WHERE kind='test-runtime-only'").get().n,2);
});
