import test from 'node:test';
import assert from 'node:assert/strict';
import {providerEligible,resolveBookingPricing,resolveBookingPricingFromEnvironment,resolveBookingService} from '../functions/_shared/marketplace.js';

test('maps legacy Technology labels to stable service IDs',()=>{
  const result=resolveBookingService({service:'General Technology Help',supportType:'Home visit',duration:60});
  assert.equal(result.categoryId,'technology');
  assert.equal(result.serviceId,'tech-general');
  assert.equal(result.fulfilmentType,'home');
});

test('records future fulfilment rules without breaking legacy booking combinations',()=>{
  const result=resolveBookingService({service:'Wi-Fi / internet',supportType:'Remote support',duration:60});
  assert.equal(result.serviceId,'tech-wifi');
  assert.equal(result.fulfilmentType,'remote');
  assert.equal(result.fulfilmentSupported,false);
});

test('preserves current live prices through a named fallback pricing rule',()=>{
  assert.deepEqual(resolveBookingPricing({supportType:'Home visit',duration:60}),{
    pricingRuleId:'legacy-home-60',billingModel:'fixed',currency:'GBP',customerPence:3000,providerEntitlementPence:0,platformFeePence:0,price:'£30',source:'legacy'
  });
  assert.equal(resolveBookingPricing({supportType:'Remote support',duration:30}).customerPence,1500);
});

test('uses a D1 time-block pricing rule when one is active',async()=>{
  const row={id:'tech-home-pilot',billing_model:'time_blocks',currency:'GBP',customer_base_pence:3900,customer_increment_pence:2500,base_minutes:30,increment_minutes:30,provider_base_pence:2500,provider_increment_pence:2000,platform_fee_mode:'derived',platform_fee_value:0};
  const env={VIPOAP_DB:{prepare(){return{bind(){return{async first(){return row}}}}}}};
  const price=await resolveBookingPricingFromEnvironment(env,{categoryId:'technology',serviceId:'tech-computer',supportType:'Home visit',duration:60,territoryId:'andover'});
  assert.equal(price.source,'d1');
  assert.equal(price.customerPence,6400);
  assert.equal(price.providerEntitlementPence,4500);
  assert.equal(price.platformFeePence,1900);
  assert.equal(price.price,'£64');
});

test('legacy providers remain eligible using existing serviceTypes',()=>{
  assert.equal(providerEligible({serviceTypes:['home']},{serviceId:'tech-general',fulfilmentType:'home',postcode:'SP10 1AA',territoryId:'andover'}),true);
  assert.equal(providerEligible({serviceTypes:['home']},{serviceId:'tech-general',fulfilmentType:'remote',postcode:'SP10 1AA',territoryId:'andover'}),false);
});

test('future-ready provider records can restrict service and postcode',()=>{
  const provider={
    serviceTypes:['home'],
    providerServices:[{serviceId:'tech-wifi',status:'approved'}],
    serviceAreas:[{territoryId:'andover',serviceId:'tech-wifi',fulfilmentType:'home',postcodePattern:'SP10',status:'active'}]
  };
  assert.equal(providerEligible(provider,{serviceId:'tech-wifi',fulfilmentType:'home',postcode:'SP10 3AB',territoryId:'andover'}),true);
  assert.equal(providerEligible(provider,{serviceId:'tech-wifi',fulfilmentType:'home',postcode:'SP11 3AB',territoryId:'andover'}),false);
  assert.equal(providerEligible(provider,{serviceId:'tech-printer',fulfilmentType:'home',postcode:'SP10 3AB',territoryId:'andover'}),false);
});
