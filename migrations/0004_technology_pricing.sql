PRAGMA foreign_keys = ON;

-- Active Technology launch pricing.
-- Home visit: £39 first 30 minutes, then £25 per additional 30 minutes.
-- Provider entitlement: £25 first 30 minutes, then £20 per additional 30 minutes.
INSERT OR REPLACE INTO pricing_rules (
  id,category_id,service_id,territory_id,fulfilment_type,billing_model,currency,
  customer_base_pence,customer_increment_pence,base_minutes,increment_minutes,
  provider_base_pence,provider_increment_pence,platform_fee_mode,platform_fee_value,
  status,valid_from,valid_to,created_at,updated_at
) VALUES (
  'technology-home-standard','technology',NULL,NULL,'home','time_blocks','GBP',
  3900,2500,30,30,
  2500,2000,'derived',0,
  'active',NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

-- Remote support remains at the existing launch pricing until separately revised.
INSERT OR REPLACE INTO pricing_rules (
  id,category_id,service_id,territory_id,fulfilment_type,billing_model,currency,
  customer_base_pence,customer_increment_pence,base_minutes,increment_minutes,
  provider_base_pence,provider_increment_pence,platform_fee_mode,platform_fee_value,
  status,valid_from,valid_to,created_at,updated_at
) VALUES (
  'technology-remote-standard','technology',NULL,NULL,'remote','time_blocks','GBP',
  1500,1000,30,30,
  0,0,'derived',0,
  'active',NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

PRAGMA foreign_key_check;
