-- Additive recruitment storage. Existing KV records and booking authority are unchanged.
CREATE TABLE IF NOT EXISTS engineer_applications (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT NOT NULL,
  experience TEXT NOT NULL,
  availability TEXT NOT NULL,
  skills TEXT NOT NULL,
  motivation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','contacted','closed')),
  notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending','sending','sent','failed')),
  notification_claimed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS engineer_applications_queue ON engineer_applications(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS engineer_applications_retention ON engineer_applications(expires_at);
CREATE TABLE IF NOT EXISTS application_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS application_audit (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);
