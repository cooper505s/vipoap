PRAGMA foreign_keys = ON;

-- Preserve the existing live customer pricing when D1 pricing resolution is enabled.
-- These are migration/safety rules, not the proposed future £39 + £25 commercial model.
INSERT OR IGNORE INTO pricing_rules (
  id,category_id,service_id,territory_id,fulfilment_type,billing_model,currency,
  customer_base_pence,customer_increment_pence,base_minutes,increment_minutes,
  provider_base_pence,provider_increment_pence,platform_fee_mode,platform_fee_value,
  status,valid_from,valid_to,created_at,updated_at
) VALUES (
  'technology-home-current','technology',NULL,NULL,'home','fixed','GBP',
  3000,0,60,NULL,
  0,0,'derived',0,
  'active',NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO pricing_rules (
  id,category_id,service_id,territory_id,fulfilment_type,billing_model,currency,
  customer_base_pence,customer_increment_pence,base_minutes,increment_minutes,
  provider_base_pence,provider_increment_pence,platform_fee_mode,platform_fee_value,
  status,valid_from,valid_to,created_at,updated_at
) VALUES (
  'technology-remote-current','technology',NULL,NULL,'remote','time_blocks','GBP',
  1500,1000,30,30,
  0,0,'derived',0,
  'active',NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

PRAGMA foreign_key_check;
