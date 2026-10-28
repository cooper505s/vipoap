import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as listBookings,onRequestPatch as updateBooking} from '../functions/api/admin/bookings.js';
import {onRequestGet as getAvailability,onRequestPost as saveAvailability} from '../functions/api/admin/availability.js';
import {onRequestGet as getPublicAvailability} from '../functions/api/availability.js';
import {digest} from '../functions/_shared/admin-auth.js';

function setup(){const values=new Map();return{values,env:{ADMIN_PASSWORD:'secret',RESEND_API_KEY:'resend',BOOKING_FROM_EMAIL:'VIPOAP <bookings@example.test>',VIPOAP_DATA:{async get(key,type){const value=values.get(key);return type==='json'&&value?JSON.parse(value):value??null},async put(key,value){values.set(key,value)},async list({prefix}){return{keys:[...values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name}))}}}}}}
const request=(url,body)=>new Request(url,{method:'POST',headers:{'content-type':'application/json','x-admin-password':'secret'},body:JSON.stringify(body)});

test('paid booking confirmation sends the customer confirmation once',async t=>{const{env,values}=setup(),key='booking:2026-08-20:10:00';values.set(key,JSON.stringify({reference:'VIP-PAID',name:'Margaret',email:'margaret@example.test',supportType:'Home visit',date:'2026-08-20',time:'10:00',duration:60,price:'£30',status:'pending',paymentStatus:'prepaid'}));const sent=[],original=globalThis.fetch;globalThis.fetch=async(_url,options)=>{sent.push(JSON.parse(options.body));return new Response('{}',{status:200})};t.after(()=>globalThis.fetch=original);let response=await updateBooking({request:request('https://example.test/api/admin/bookings',{key,status:'confirmed',adminNotes:'Paid'}),env});assert.equal(response.status,200);assert.equal(sent.length,1);assert.match(sent[0].subject,/confirmed/i);assert.match(sent[0].html,/additional time.*billed after/i);response=await updateBooking({request:request('https://example.test/api/admin/bookings',{key,status:'confirmed',adminNotes:'Updated'}),env});assert.equal(response.status,200);assert.equal(sent.length,1)});

test('unpaid booking cannot be confirmed',async()=>{const{env,values}=setup(),key='booking:2026-08-20:11:00';values.set(key,JSON.stringify({reference:'VIP-UNPAID',status:'pending',paymentStatus:'payment-required'}));const response=await updateBooking({request:request('https://example.test/api/admin/bookings',{key,status:'confirmed'}),env});assert.equal(response.status,409);assert.match((await response.json()).error,/Advance payment/)});

test('Engineer Partner can use one seven-day calendar with services per time block',async()=>{const{env,values}=setup(),weeklyBlocks={monday:[{start:'09:00',end:'12:00',services:['home','remote']}],tuesday:[{start:'13:00',end:'18:00',services:['remote']}],wednesday:[],thursday:[],friday:[],saturday:[],sunday:[{start:'10:00',end:'12:00',services:['home']}]},body={weeklyBlocks,blockedDates:['2026-08-24'],overrides:[]};let response=await saveAvailability({request:request('https://example.test/api/admin/availability',body),env});assert.equal(response.status,200);assert.ok(values.has('availability:andover:dan-stevens'));response=await getAvailability({request:new Request('https://example.test/api/admin/availability',{headers:{'x-admin-password':'secret'}}),env});const data=await response.json();assert.deepEqual(data.weeklyBlocks,weeklyBlocks);assert.deepEqual(data.homeVisitWeekly.monday,[['09:00','12:00']]);assert.deepEqual(data.remoteWeekly.tuesday,[['13:00','18:00']]);assert.deepEqual(data.homeVisitWeekly.sunday,[['10:00','12:00']]);assert.deepEqual(data.blockedDates,['2026-08-24'])});

test('availability only accepts services enabled on the engineer profile',async()=>{const{env,values}=setup();values.set('operator:dan-stevens',JSON.stringify({id:'dan-stevens',serviceTypes:['remote']}));const weeklyBlocks=Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day=>[day,day==='monday'?[{start:'09:00',end:'12:00',services:['home']}]:[]])),response=await saveAvailability({request:request('https://example.test/api/admin/availability',{weeklyBlocks,blockedDates:[],overrides:[]}),env});assert.equal(response.status,400);assert.match((await response.json()).error,/services from your profile/i)});

test('public booking hides services not enabled on the engineer profile',async()=>{const{env,values}=setup();values.set('operator:dan-stevens',JSON.stringify({id:'dan-stevens',serviceTypes:['remote']}));values.set('availability:andover:dan-stevens',JSON.stringify({territoryId:'andover',operatorId:'dan-stevens',homeVisitWeekly:{monday:[['09:00','12:00']]},remoteWeekly:{monday:[['09:00','12:00']]},blockedDates:[]}));const response=await getPublicAvailability({request:new Request('https://example.test/api/availability?date=2026-08-17&duration=60&supportType=Home%20visit'),env}),data=await response.json();assert.deepEqual(data.slots,[])});

test('operator booking queue only exposes and updates assigned work',async()=>{const{env,values}=setup(),token='operator-session';values.set(`admin-session:${await digest(token)}`,JSON.stringify({role:'operator',operatorId:'engineer-one',territoryIds:['andover']}));values.set('booking:one',JSON.stringify({reference:'VIP-ONE',operatorId:'engineer-one',territoryId:'andover',date:'2026-08-17',time:'10:00',status:'pending'}));values.set('booking:two',JSON.stringify({reference:'VIP-TWO',operatorId:'engineer-two',territoryId:'andover',date:'2026-08-17',time:'11:00',status:'pending'}));const headers={'x-admin-session':token,'content-type':'application/json'},listed=await listBookings({request:new Request('https://example.test/api/admin/bookings',{headers}),env}),data=await listed.json();assert.deepEqual(data.bookings.map(item=>item.reference),['VIP-ONE']);const response=await updateBooking({request:new Request('https://example.test/api/admin/bookings',{method:'PATCH',headers,body:JSON.stringify({key:'booking:two',status:'declined'})}),env});assert.equal(response.status,404)});

test('engineer decline reassigns a paid booking instead of cancelling the customer',async t=>{const{env,values}=setup(),token='decline-session',key='booking:2026-08-17:10:00:engineer-one',headers={'x-admin-session':token,'content-type':'application/json'};values.set(`admin-session:${await digest(token)}`,JSON.stringify({role:'operator',operatorId:'engineer-one',territoryIds:['andover']}));values.set('operator:engineer-two',JSON.stringify({id:'engineer-two',name:'Engineer Two',email:'two@example.test',territoryIds:['andover'],serviceTypes:['home']}));values.set('availability:andover:engineer-two',JSON.stringify({territoryId:'andover',operatorId:'engineer-two',homeVisitWeekly:{monday:[['09:00','12:00']]},remoteWeekly:{},blockedDates:[]}));values.set(key,JSON.stringify({reference:'VIP-08170001',operatorId:'engineer-one',territoryId:'andover',supportType:'Home visit',service:'Wi-Fi',date:'2026-08-17',time:'10:00',duration:60,status:'pending',paymentStatus:'prepaid'}));const sent=[],original=globalThis.fetch;globalThis.fetch=async(_url,options)=>{sent.push(JSON.parse(options.body));return Response.json({id:'email'})};t.after(()=>globalThis.fetch=original);const response=await updateBooking({request:new Request('https://example.test/api/admin/bookings',{method:'PATCH',headers,body:JSON.stringify({key,status:'declined',adminNotes:'Unavailable due to illness'})}),env}),data=await response.json(),booking=JSON.parse(values.get(key));assert.equal(response.status,200);assert.equal(data.reassignedTo,'engineer-two');assert.equal(booking.operatorId,'engineer-two');assert.equal(booking.status,'pending');assert.equal(booking.bookingStatus,'requested');assert.equal(sent.length,1)});

test('booking becomes unfilled when no replacement engineer is available',async()=>{const{env,values}=setup(),token='unfilled-session',key='booking:2026-08-17:10:00:engineer-one',headers={'x-admin-session':token,'content-type':'application/json'};values.set(`admin-session:${await digest(token)}`,JSON.stringify({role:'operator',operatorId:'engineer-one',territoryIds:['andover']}));values.set(key,JSON.stringify({reference:'VIP-08170002',operatorId:'engineer-one',territoryId:'andover',supportType:'Home visit',date:'2026-08-17',time:'10:00',duration:60,status:'pending',paymentStatus:'prepaid'}));const response=await updateBooking({request:new Request('https://example.test/api/admin/bookings',{method:'PATCH',headers,body:JSON.stringify({key,status:'declined'})}),env}),data=await response.json(),booking=JSON.parse(values.get(key));assert.equal(response.status,200);assert.equal(data.unfilled,true);assert.equal(booking.status,'pending');assert.equal(booking.bookingStatus,'unfilled');assert.equal(booking.operatorId,'')});

async function declineFixture(extra={}){
  const {env,values}=setup(),token='synthetic-decline-guard',key='booking:2026-08-17:10:00:original';
  values.set(`admin-session:${await digest(token)}`,JSON.stringify({role:'operator',operatorId:'original',territoryIds:['andover']}));
  values.set(key,JSON.stringify({reference:'VIP-SYNTHETIC-DECLINE',operatorId:'original',territoryId:'andover',supportType:'Home visit',date:'2026-08-17',time:'10:00',duration:60,status:'pending',paymentStatus:'prepaid',...extra}));
  values.set('operator:replacement',JSON.stringify({id:'replacement',status:'active',territoryIds:['andover'],serviceTypes:['home']}));
  values.set('availability:andover:replacement',JSON.stringify({territoryId:'andover',operatorId:'replacement',homeVisitWeekly:{monday:[['09:00','12:00']]},blockedDates:[]}));
  const headers={'x-admin-session':token,'content-type':'application/json'},decline=()=>updateBooking({request:new Request('https://example.test/api/admin/bookings',{method:'PATCH',headers,body:JSON.stringify({key,status:'declined'})}),env});
  return{env,values,key,headers,decline};
}

test('decline rejects closed, active and refunded bookings without changing them',async()=>{
  for(const extra of [{status:'completed'},{bookingStatus:'cancelled'},{jobStatus:'in-progress'},{jobStatus:'safety-stopped'},{bookingStatus:'awaiting-final-settlement'},{paymentStatus:'refunded'}]){
    const {values,key,decline}=await declineFixture(extra),before=[...values];
    assert.equal((await decline()).status,409);assert.deepEqual([...values],before);
  }
});

test('decline excludes missing, noncompliant, suspended and wrong-territory replacements',async()=>{
  for(const extra of [null,{status:'suspended'},{trainingStatus:'in-progress'},{homeSuspended:true},{territoryIds:['elsewhere']}]){
    const {values,key,decline}=await declineFixture();
    if(extra===null)values.delete('operator:replacement');else values.set('operator:replacement',JSON.stringify({...JSON.parse(values.get('operator:replacement')),...extra}));
    const response=await decline();assert.equal(response.status,200);assert.equal((await response.json()).unfilled,true);assert.equal(JSON.parse(values.get(key)).operatorId,'');
  }
});

test('decline checks later availability and booking pages before choosing a replacement',async()=>{
  const {env,values,key,decline}=await declineFixture(),conflict='booking:2026-08-17:10:15:conflict';
  values.set(conflict,JSON.stringify({reference:'VIP-SYNTHETIC-CONFLICT',operatorId:'replacement',time:'10:15',duration:30,status:'confirmed'}));
  const original=env.VIPOAP_DATA.list;
  env.VIPOAP_DATA.list=async options=>options.prefix==='availability:'?(options.cursor?{keys:[{name:'availability:andover:replacement'}],list_complete:true}:{keys:[],list_complete:false,cursor:'availability-next'}):options.prefix==='booking:2026-08-17:'?(options.cursor?{keys:[{name:conflict}],list_complete:true}:{keys:[{name:key}],list_complete:false,cursor:'bookings-next'}):original(options);
  const response=await decline();assert.equal((await response.json()).unfilled,true);
  values.delete(conflict);env.VIPOAP_DATA.list=async options=>options.prefix==='availability:'?(options.cursor?{keys:[{name:'availability:andover:replacement'}],list_complete:true}:{keys:[],list_complete:false,cursor:'availability-next'}):original(options);
  values.set(key,JSON.stringify({...JSON.parse(values.get(key)),operatorId:'original',bookingStatus:'requested'}));
  assert.equal((await (await decline()).json()).reassignedTo,'replacement');
});

test('booking queue includes later pages while retaining engineer ownership scope',async()=>{
  const {env,values,key,headers}=await declineFixture(),other='booking:2026-08-17:11:00:other';
  values.set(other,JSON.stringify({reference:'VIP-OTHER',operatorId:'someone-else',territoryId:'andover'}));
  env.VIPOAP_DATA.list=async({cursor})=>cursor?{keys:[{name:key}],list_complete:true}:{keys:[{name:other}],list_complete:false,cursor:'next'};
  const response=await listBookings({request:new Request('https://example.test/api/admin/bookings',{headers}),env});assert.deepEqual((await response.json()).bookings.map(item=>item.key),[key]);
});

test('malformed booking updates return a validation error',async()=>{
  const {env}=setup();for(const body of ['{','null','[]']){const response=await updateBooking({request:new Request('https://example.test/api/admin/bookings',{method:'PATCH',headers:{'x-admin-password':'secret','content-type':'application/json'},body}),env});assert.equal(response.status,400);}
});
