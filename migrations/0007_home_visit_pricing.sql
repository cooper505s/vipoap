-- Active Technology home-visit pricing from September 2026.
-- Customer: £49 first 30 minutes, then £30 per additional 30 minutes.
-- Engineer: £25 first 30 minutes, then £20 per additional 30 minutes.
INSERT INTO pricing_rules (
  id, category_id, service_id, territory_id, fulfilment_type, billing_model, currency,
  customer_base_pence, customer_increment_pence, base_minutes, increment_minutes,
  provider_base_pence, provider_increment_pence, platform_fee_mode, platform_fee_value,
  status, valid_from, valid_to, created_at, updated_at
) VALUES (
  'technology-home-standard','technology',NULL,NULL,'home','time_blocks','GBP',
  4900,3000,30,30,2500,2000,'derived',0,'active','2026-09-06',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
)
ON CONFLICT(id) DO UPDATE SET
  customer_base_pence=excluded.customer_base_pence,
  customer_increment_pence=excluded.customer_increment_pence,
  provider_base_pence=excluded.provider_base_pence,
  provider_increment_pence=excluded.provider_increment_pence,
  status='active',
  valid_from=excluded.valid_from,
  valid_to=NULL,
  updated_at=CURRENT_TIMESTAMP;
