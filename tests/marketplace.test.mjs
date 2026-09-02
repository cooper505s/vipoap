import test from 'node:test';
import assert from 'node:assert/strict';
import {providerEligible,resolveBookingPricing,resolveBookingService} from '../functions/_shared/marketplace.js';

test('maps legacy Technology labels to stable service IDs',()=>{
  const result=resolveBookingService({service:'General Technology Help',supportType:'Home visit',duration:60});
  assert.equal(result.categoryId,'technology');
  assert.equal(result.serviceId,'tech-general');
  assert.equal(result.fulfilmentType,'home');
});

test('prevents remote booking for a home-only Technology service',()=>{
  const result=resolveBookingService({service:'Wi-Fi / internet',supportType:'Remote support',duration:60});
  assert.match(result.error,/not currently available by remote support/i);
});

test('preserves current live prices through a named pricing rule',()=>{
  assert.deepEqual(resolveBookingPricing({supportType:'Home visit',duration:60}),{
    pricingRuleId:'legacy-home-60',billingModel:'fixed',currency:'GBP',customerPence:3000,providerEntitlementPence:0,platformFeePence:0,price:'£30'
  });
  assert.equal(resolveBookingPricing({supportType:'Remote support',duration:30}).customerPence,1500);
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
