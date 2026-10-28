CREATE TABLE IF NOT EXISTS callback_requests (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  best_time TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','reviewing','contacted','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS callback_requests_queue ON callback_requests(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS callback_requests_retention ON callback_requests(expires_at);
CREATE TABLE IF NOT EXISTS callback_audit (
  id TEXT PRIMARY KEY,
  callback_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intake_maintenance (
  id TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL,
  status TEXT NOT NULL
);
