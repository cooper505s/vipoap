PRAGMA foreign_keys = ON;

-- Retire any pre-marketplace Technology pricing rows if this database was used
-- during development before the launch pricing was activated.
UPDATE pricing_rules
SET status='retired',updated_at=CURRENT_TIMESTAMP
WHERE id IN ('technology-home-current','technology-remote-current');

INSERT OR REPLACE INTO pricing_rules (
  id,category_id,service_id,territory_id,fulfilment_type,billing_model,currency,
  customer_base_pence,customer_increment_pence,base_minutes,increment_minutes,
  provider_base_pence,provider_increment_pence,platform_fee_mode,platform_fee_value,
  status,valid_from,valid_to,created_at,updated_at
) VALUES
('technology-home-standard','technology',NULL,NULL,'home','time_blocks','GBP',3900,2500,30,30,2500,2000,'derived',0,'active',NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('technology-remote-standard','technology',NULL,NULL,'remote','time_blocks','GBP',1500,1000,30,30,0,0,'derived',0,'active',NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- The public booking flow offers 30-minute home appointments, so the service
-- catalogue must not advertise a higher minimum for home-only Technology jobs.
UPDATE services
SET min_duration_minutes=30,updated_at=CURRENT_TIMESTAMP
WHERE category_id='technology' AND id IN ('tech-wifi','tech-tv','tech-smart-home');

INSERT OR IGNORE INTO services (
  id,category_id,slug,name,public_name,description,status,fulfilment_types,
  default_duration_minutes,min_duration_minutes,max_duration_minutes,display_order,metadata,created_at,updated_at
) VALUES (
  'tech-online-safety','technology','online-safety','Online safety','Online safety',
  'Help with safer internet use, suspicious messages, account security and scam awareness.',
  'active','["home","remote"]',60,30,120,85,'{}',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

PRAGMA foreign_key_check;
