import test from 'node:test';import assert from 'node:assert/strict';import {onRequestGet} from '../functions/api/coverage.js';
const request=postcode=>new Request(`https://example.test/api/coverage?postcode=${encodeURIComponent(postcode)}`);
const env={VIPOAP_DATA:{async list(){return{keys:[{name:'territory:andover'},{name:'territory:future'}]}},async get(key){return key==='territory:andover'?{id:'andover',name:'Andover',postcodePrefixes:['SP10','SP11'],status:'active'}:{id:'future',name:'Future area',postcodePrefixes:['BA1'],status:'planning'}}}};
test('confirms a postcode in an active territory',async()=>{const response=await onRequestGet({request:request('SP10 1AA'),env}),data=await response.json();assert.equal(response.status,200);assert.equal(data.covered,true);assert.equal(data.area,'Andover')});
test('does not expose a planning territory as covered',async()=>{const data=await(await onRequestGet({request:request('BA1 1AA'),env})).json();assert.equal(data.covered,false);assert.match(data.message,/soon/i)});
test('uses founding coverage when no data binding is available',async()=>{const data=await(await onRequestGet({request:request('SP11 7AA'),env:{}})).json();assert.equal(data.covered,true)});
test('rejects an invalid postcode',async()=>{const response=await onRequestGet({request:request('x'),env});assert.equal(response.status,400)});
