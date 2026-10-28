import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAdminBooking,loadCustomerBooking} from '../functions/_shared/booking-access.js';
import {digest} from '../functions/_shared/admin-auth.js';
import {bookingDatabase} from './helpers/booking-database.mjs';

async function setup({role='operator',territoryIds=['andover'],operatorId='synthetic-engineer'}={}){
  const {db,sql}=bookingDatabase(),sessions=new Map(),token='synthetic-booking-access';
  sessions.set(`admin-session:${await digest(token)}`,{role,territoryIds,operatorId});
  sessions.set(`customer-session:${await digest(token)}`,{customerId:'customer:synthetic',expiresAt:new Date(Date.now()+3600000).toISOString()});
  const env={VIPOAP_BOOKING_DB:db,VIPOAP_DATA:{async get(key){return sessions.get(key)||null}}},bookingId='booking:synthetic-access';
  const seed=patch=>{sql.prepare('INSERT OR REPLACE INTO booking_transactions VALUES (?,?,3,?,?)').run(bookingId,JSON.stringify({customerId:'customer:synthetic',territoryId:'andover',operatorId:'synthetic-engineer',status:'confirmed',...patch}),'fixture','2026-10-28')};seed({});
  const request=new Request('https://example.test',{headers:{'x-admin-session':token,'x-customer-session':token}});
  return{env,sql,sessions,token,bookingId,seed,request};
}

test('transactional engineer read returns only authorised assigned work and revision',async()=>{
  const state=await setup(),booking=await loadAdminBooking(state);assert.equal(booking.revision,3);assert.equal(booking.snapshot.customerId,'customer:synthetic');assert.equal(booking.context.role,'operator');
  for(const patch of [{operatorId:'another-engineer'},{territoryId:'elsewhere'}]){state.seed(patch);await assert.rejects(loadAdminBooking(state),{status:404});}
});

test('transactional HQ read respects territory and requested permission',async()=>{
  const state=await setup({role:'admin'});state.seed({operatorId:'another-engineer'});assert.equal((await loadAdminBooking({...state,permission:'manage_billing'})).revision,3);
  state.seed({territoryId:'elsewhere'});await assert.rejects(loadAdminBooking(state),{status:404});
  const viewer=await setup({role:'viewer'});await assert.rejects(loadAdminBooking(viewer),{status:403});
  const engineer=await setup();await assert.rejects(loadAdminBooking({...engineer,permission:'manage_billing'}),{status:403});await assert.rejects(loadAdminBooking({...engineer,permission:'view_dashboard'}),{status:400});
});

test('transactional customer read requires ownership and an unexpired session',async()=>{
  const state=await setup();assert.equal((await loadCustomerBooking(state)).revision,3);state.seed({customerId:'customer:someone-else'});await assert.rejects(loadCustomerBooking(state),{status:404});
  state.seed({});const key=`customer-session:${await digest(state.token)}`;
  for(const patch of [{expiresAt:'invalid'},{expiresAt:new Date(Date.now()-1000).toISOString()},{customerId:''}]){state.sessions.set(key,{customerId:'customer:synthetic',expiresAt:new Date(Date.now()+3600000).toISOString(),...patch});await assert.rejects(loadCustomerBooking(state),{status:401});}
});

test('unauthenticated transactional reads fail before querying storage',async()=>{
  const request=new Request('https://example.test'),env={VIPOAP_BOOKING_DB:{prepare(){throw Error('Must not query')}}};await assert.rejects(loadAdminBooking({request,env,bookingId:'booking:any'}),{status:403});await assert.rejects(loadCustomerBooking({request,env,bookingId:'booking:any'}),{status:401});
});

test('missing transactional storage or malformed records do not fall back to KV bookings',async()=>{
  const state=await setup();await assert.rejects(loadAdminBooking({...state,env:{VIPOAP_DATA:state.env.VIPOAP_DATA}}),{status:503});
  await assert.rejects(loadAdminBooking({...state,bookingId:'customer:synthetic'}),{status:404});
  state.sql.prepare('UPDATE booking_transactions SET snapshot_json=? WHERE id=?').run('[]',state.bookingId);await assert.rejects(loadAdminBooking(state),{status:503});
  await assert.rejects(loadAdminBooking({...state,bookingId:'booking:missing'}),{status:404});
});
