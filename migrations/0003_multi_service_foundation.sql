PRAGMA foreign_keys = ON;

-- Keep the existing `operators` terminology for compatibility with the current
-- Technology launch, but make the data model capable of supporting other
-- independent service professionals later without exposing those categories yet.
ALTER TABLE operators ADD COLUMN provider_kind TEXT NOT NULL DEFAULT 'independent';
ALTER TABLE operators ADD COLUMN stripe_account_id TEXT;
ALTER TABLE operators ADD COLUMN stripe_onboarding_status TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE operators ADD COLUMN payouts_enabled INTEGER NOT NULL DEFAULT 0 CHECK(payouts_enabled IN (0,1));
ALTER TABLE operators ADD COLUMN charges_enabled INTEGER NOT NULL DEFAULT 0 CHECK(charges_enabled IN (0,1));
ALTER TABLE operators ADD COLUMN business_name TEXT;
ALTER TABLE operators ADD COLUMN public_profile_name TEXT;
ALTER TABLE operators ADD COLUMN insurance_status TEXT;
ALTER TABLE operators ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS operators_stripe_account
ON operators(stripe_account_id)
WHERE stripe_account_id IS NOT NULL AND stripe_account_id <> '';

CREATE TABLE IF NOT EXISTS service_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  public_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK(status IN ('disabled','internal','pilot','active','paused')),
  display_order INTEGER NOT NULL DEFAULT 0,
  requires_home_visit INTEGER NOT NULL DEFAULT 1 CHECK(requires_home_visit IN (0,1)),
  allows_remote INTEGER NOT NULL DEFAULT 0 CHECK(allows_remote IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES service_categories(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  public_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK(status IN ('disabled','internal','pilot','active','paused')),
  fulfilment_types TEXT NOT NULL DEFAULT '["home"]',
  default_duration_minutes INTEGER,
  min_duration_minutes INTEGER,
  max_duration_minutes INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(category_id,slug)
);

CREATE INDEX IF NOT EXISTS services_category_status
ON services(category_id,status,display_order);

CREATE TABLE IF NOT EXISTS provider_services (
  provider_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','paused','rejected')),
  experience_notes TEXT,
  credential_status TEXT NOT NULL DEFAULT 'not_required',
  credential_data TEXT NOT NULL DEFAULT '{}',
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(provider_id,service_id)
);

CREATE INDEX IF NOT EXISTS provider_services_service
ON provider_services(service_id,status,provider_id);

CREATE TABLE IF NOT EXISTS provider_service_areas (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  territory_id TEXT REFERENCES territories(id),
  postcode_pattern TEXT NOT NULL,
  service_id TEXT REFERENCES services(id),
  fulfilment_type TEXT NOT NULL DEFAULT 'home'
    CHECK(fulfilment_type IN ('home','remote','onsite_business')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','paused','disabled')),
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS provider_service_areas_lookup
ON provider_service_areas(status,postcode_pattern,service_id,provider_id);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES service_categories(id),
  service_id TEXT REFERENCES services(id),
  territory_id TEXT REFERENCES territories(id),
  fulfilment_type TEXT NOT NULL DEFAULT 'home'
    CHECK(fulfilment_type IN ('home','remote','onsite_business')),
  billing_model TEXT NOT NULL
    CHECK(billing_model IN ('fixed','time_blocks','hourly','quote')),
  currency TEXT NOT NULL DEFAULT 'GBP',
  customer_base_pence INTEGER NOT NULL DEFAULT 0 CHECK(customer_base_pence >= 0),
  customer_increment_pence INTEGER NOT NULL DEFAULT 0 CHECK(customer_increment_pence >= 0),
  base_minutes INTEGER,
  increment_minutes INTEGER,
  provider_base_pence INTEGER NOT NULL DEFAULT 0 CHECK(provider_base_pence >= 0),
  provider_increment_pence INTEGER NOT NULL DEFAULT 0 CHECK(provider_increment_pence >= 0),
  platform_fee_mode TEXT NOT NULL DEFAULT 'derived'
    CHECK(platform_fee_mode IN ('derived','fixed','percentage')),
  platform_fee_value INTEGER NOT NULL DEFAULT 0 CHECK(platform_fee_value >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('draft','active','paused','retired')),
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pricing_rules_lookup
ON pricing_rules(service_id,territory_id,fulfilment_type,status,valid_from);

CREATE TABLE IF NOT EXISTS booking_assignments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES operators(id),
  status TEXT NOT NULL
    CHECK(status IN ('offered','accepted','declined','expired','cancelled','completed')),
  offered_at TEXT NOT NULL,
  responded_at TEXT,
  expires_at TEXT,
  decline_reason TEXT,
  allocation_score REAL,
  allocation_details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS booking_assignments_booking
ON booking_assignments(booking_id,status,offered_at);
CREATE INDEX IF NOT EXISTS booking_assignments_provider
ON booking_assignments(provider_id,status,offered_at);

CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES bookings(id),
  provider_id TEXT REFERENCES operators(id),
  payment_id TEXT REFERENCES payments(id),
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_connected_account_id TEXT,
  gross_customer_pence INTEGER NOT NULL CHECK(gross_customer_pence >= 0),
  provider_entitlement_pence INTEGER NOT NULL CHECK(provider_entitlement_pence >= 0),
  platform_fee_gross_pence INTEGER NOT NULL CHECK(platform_fee_gross_pence >= 0),
  platform_vat_pence INTEGER NOT NULL DEFAULT 0 CHECK(platform_vat_pence >= 0),
  processor_fee_pence INTEGER NOT NULL DEFAULT 0 CHECK(processor_fee_pence >= 0),
  refund_pence INTEGER NOT NULL DEFAULT 0 CHECK(refund_pence >= 0),
  currency TEXT NOT NULL DEFAULT 'GBP',
  settlement_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(settlement_status IN ('pending','authorised','paid','part_refunded','refunded','disputed','failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS marketplace_transactions_booking
ON marketplace_transactions(booking_id,created_at);
CREATE INDEX IF NOT EXISTS marketplace_transactions_provider
ON marketplace_transactions(provider_id,settlement_status,created_at);

ALTER TABLE bookings ADD COLUMN category_id TEXT REFERENCES service_categories(id);
ALTER TABLE bookings ADD COLUMN service_id TEXT REFERENCES services(id);
ALTER TABLE bookings ADD COLUMN assigned_provider_id TEXT REFERENCES operators(id);
ALTER TABLE bookings ADD COLUMN pricing_rule_id TEXT REFERENCES pricing_rules(id);
ALTER TABLE bookings ADD COLUMN provider_entitlement_pence INTEGER NOT NULL DEFAULT 0 CHECK(provider_entitlement_pence >= 0);
ALTER TABLE bookings ADD COLUMN platform_fee_pence INTEGER NOT NULL DEFAULT 0 CHECK(platform_fee_pence >= 0);

-- Only Technology is enabled. Future categories are intentionally not seeded.
INSERT OR IGNORE INTO service_categories (
  id,slug,name,public_name,description,status,display_order,requires_home_visit,allows_remote,created_at,updated_at
) VALUES (
  'technology','technology','Technology','Technology Help','Friendly help with everyday technology in the home or remotely.','active',10,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO services (id,category_id,slug,name,public_name,description,status,fulfilment_types,default_duration_minutes,min_duration_minutes,max_duration_minutes,display_order,created_at,updated_at) VALUES
('tech-general','technology','general-help','General technology help','Something else','General technology help where the customer is not sure which option to choose.','active','["home","remote"]',60,30,120,90,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('tech-computer','technology','computer-laptop','Computer or laptop','Computer or laptop','Help setting up, using or troubleshooting a computer or laptop.','active','["home","remote"]',60,30,120,10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('tech-wifi','technology','wifi-internet','Wi-Fi and internet','Wi-Fi / internet','Help with Wi-Fi coverage, routers, mesh systems and internet connectivity.','active','["home"]',60,60,180,20,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('tech-printer','technology','printer','Printer','Printer','Help connecting, configuring or troubleshooting printers and scanners.','active','["home","remote"]',60,30,120,30,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('tech-mobile','technology','phone-tablet','Phone or tablet','Phone or tablet','Help setting up, transferring data or learning to use a phone or tablet.','active','["home","remote"]',60,30,120,40,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('tech-tv','technology','smart-tv-streaming','Smart TV and streaming','Smart TV / streaming','Help setting up smart TVs, streaming devices and related accounts.','active','["home"]',60,60,120,50,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('tech-new-device','technology','new-device-setup','New device setup','New device setup','Setup, transfer and guidance for a new technology device.','active','["home","remote"]',60,30,180,60,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('tech-email','technology','email-accounts','Email and accounts','Email / accounts','Help with email, passwords, account setup and everyday account problems.','active','["home","remote"]',60,30,120,70,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('tech-smart-home','technology','smart-home','Smart home','Smart-home device','Help setting up and connecting ordinary smart-home devices.','active','["home"]',60,60,180,80,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

PRAGMA foreign_key_check;
