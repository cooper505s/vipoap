PRAGMA foreign_keys = ON;

CREATE TABLE territories (id TEXT PRIMARY KEY, name TEXT NOT NULL, area_email TEXT UNIQUE, status TEXT NOT NULL CHECK(status IN ('planning','active','paused','closed')), postcode_prefixes TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE operators (id TEXT PRIMARY KEY, territory_id TEXT REFERENCES territories(id), name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT, status TEXT NOT NULL, service_types TEXT NOT NULL DEFAULT '[]', dbs_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE customers (id TEXT PRIMARY KEY, territory_id TEXT REFERENCES territories(id), operator_id TEXT REFERENCES operators(id), name TEXT NOT NULL, email TEXT, phone TEXT, phone_key TEXT, postcode TEXT, address TEXT, preferred_contact TEXT, accessibility_preferences TEXT, membership_plan TEXT NOT NULL DEFAULT 'none', membership_status TEXT NOT NULL DEFAULT 'none', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX customers_phone_key ON customers(phone_key) WHERE phone_key IS NOT NULL AND phone_key <> '';
CREATE INDEX customers_email ON customers(email);
CREATE TABLE customer_devices (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE, type TEXT NOT NULL, brand TEXT, model TEXT, location TEXT, ownership TEXT, condition_status TEXT, notes TEXT, upgrade_priority TEXT, upgrade_recommendation TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE bookings (id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, customer_id TEXT REFERENCES customers(id), territory_id TEXT REFERENCES territories(id), operator_id TEXT REFERENCES operators(id), help_request_id TEXT, booking_for TEXT NOT NULL, support_type TEXT NOT NULL, service TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes IN (30,60)), booking_date TEXT NOT NULL, start_time TEXT NOT NULL, customer_name TEXT NOT NULL, customer_email TEXT, customer_phone TEXT NOT NULL, address TEXT, postcode TEXT NOT NULL, details TEXT, accessibility_notes TEXT, booking_status TEXT NOT NULL, job_status TEXT, payment_status TEXT NOT NULL, price_pence INTEGER NOT NULL CHECK(price_pence >= 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX bookings_schedule ON bookings(booking_date,start_time,operator_id);
CREATE INDEX bookings_customer ON bookings(customer_id,booking_date);
CREATE INDEX bookings_status ON bookings(booking_status,payment_status);
CREATE TABLE payments (id TEXT PRIMARY KEY, booking_id TEXT REFERENCES bookings(id), customer_id TEXT REFERENCES customers(id), type TEXT NOT NULL, method TEXT NOT NULL, status TEXT NOT NULL, amount_pence INTEGER NOT NULL CHECK(amount_pence >= 0), currency TEXT NOT NULL DEFAULT 'GBP', provider TEXT, provider_reference TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX payments_provider_reference ON payments(provider,provider_reference) WHERE provider_reference IS NOT NULL;
CREATE TABLE callouts (id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, booking_id TEXT REFERENCES bookings(id), customer_id TEXT REFERENCES customers(id), territory_id TEXT REFERENCES territories(id), operator_id TEXT REFERENCES operators(id), visit_date TEXT NOT NULL, duration_minutes INTEGER, category TEXT, summary TEXT, actions_taken TEXT, recommendations TEXT, status TEXT NOT NULL, amount_charged_pence INTEGER NOT NULL DEFAULT 0, payment_status TEXT, service_summary TEXT, completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX callouts_customer ON callouts(customer_id,visit_date);

CREATE TABLE help_requests (id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, customer_id TEXT REFERENCES customers(id), territory_id TEXT REFERENCES territories(id), category TEXT NOT NULL, contact_preference TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('received','looking','information','arranged','completed')), name TEXT NOT NULL, email TEXT, phone TEXT, postcode TEXT, booking_id TEXT REFERENCES bookings(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX help_requests_queue ON help_requests(territory_id,status,updated_at);
CREATE TABLE help_messages (id TEXT PRIMARY KEY, help_request_id TEXT NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE, author_type TEXT NOT NULL CHECK(author_type IN ('customer','vipoap')), message_text TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX help_messages_request ON help_messages(help_request_id,created_at);
CREATE TABLE scam_checks (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id), help_request_id TEXT REFERENCES help_requests(id), channel TEXT NOT NULL, outcome TEXT NOT NULL, reasons TEXT NOT NULL DEFAULT '[]', human_review INTEGER NOT NULL DEFAULT 0 CHECK(human_review IN (0,1)), created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX scam_checks_customer ON scam_checks(customer_id,created_at);
CREATE INDEX scam_checks_expiry ON scam_checks(expires_at);

CREATE TABLE followups (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id), booking_id TEXT REFERENCES bookings(id), callout_id TEXT REFERENCES callouts(id), territory_id TEXT REFERENCES territories(id), operator_id TEXT REFERENCES operators(id), due_date TEXT, status TEXT NOT NULL, notes TEXT, completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX followups_queue ON followups(territory_id,status,due_date);
CREATE TABLE memberships (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), plan TEXT NOT NULL, billing_cycle TEXT NOT NULL, status TEXT NOT NULL, period_start TEXT, period_end TEXT, included_minutes INTEGER NOT NULL DEFAULT 0, used_minutes INTEGER NOT NULL DEFAULT 0, provider_subscription_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX memberships_customer ON memberships(customer_id,status);
CREATE TABLE delegated_access (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), delegate_customer_id TEXT NOT NULL REFERENCES customers(id), permissions TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX delegated_access_pair ON delegated_access(customer_id,delegate_customer_id);
CREATE TABLE invoices (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id), callout_id TEXT REFERENCES callouts(id), booking_id TEXT REFERENCES bookings(id), territory_id TEXT REFERENCES territories(id), number TEXT UNIQUE, status TEXT NOT NULL, issue_date TEXT, due_date TEXT, subtotal_pence INTEGER NOT NULL DEFAULT 0, total_pence INTEGER NOT NULL DEFAULT 0, lines TEXT NOT NULL DEFAULT '[]', zoho_sync_status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX invoices_customer ON invoices(customer_id,issue_date);
CREATE TABLE audit_events (id TEXT PRIMARY KEY, actor_email TEXT, operator_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_key TEXT NOT NULL, details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE INDEX audit_entity ON audit_events(entity_type,entity_key,created_at);
CREATE TABLE integration_queue (id TEXT PRIMARY KEY, provider TEXT NOT NULL, entity_type TEXT NOT NULL, entity_key TEXT NOT NULL, action TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX integration_queue_status ON integration_queue(provider,status,created_at);

PRAGMA foreign_key_check;
