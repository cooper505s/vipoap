-- Standalone foundation. No existing KV data is imported or replaced.
CREATE TABLE IF NOT EXISTS booking_transactions (
  id TEXT PRIMARY KEY,
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  revision INTEGER NOT NULL CHECK(revision > 0),
  last_request_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS booking_mutations (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES booking_transactions(id),
  request_hash TEXT NOT NULL,
  commit_token TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_mutations_booking ON booking_mutations(booking_id,revision);
CREATE TABLE IF NOT EXISTS booking_outbox (
  id TEXT PRIMARY KEY,
  mutation_id TEXT NOT NULL REFERENCES booking_mutations(id),
  booking_id TEXT NOT NULL REFERENCES booking_transactions(id),
  kind TEXT NOT NULL CHECK(length(kind) BETWEEN 1 AND 80),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_outbox_pending ON booking_outbox(status,created_at);
CREATE TABLE IF NOT EXISTS booking_slot_reservations (
  booking_id TEXT PRIMARY KEY REFERENCES booking_transactions(id),
  engineer_id TEXT NOT NULL,
  start_ms INTEGER NOT NULL CHECK(typeof(start_ms)='integer'),
  end_ms INTEGER NOT NULL CHECK(typeof(end_ms)='integer' AND end_ms>start_ms)
);
CREATE INDEX IF NOT EXISTS booking_slots_engineer ON booking_slot_reservations(engineer_id,start_ms,end_ms);
CREATE TRIGGER IF NOT EXISTS booking_slots_insert BEFORE INSERT ON booking_slot_reservations
WHEN EXISTS(SELECT 1 FROM booking_slot_reservations WHERE engineer_id=NEW.engineer_id AND booking_id<>NEW.booking_id AND start_ms<NEW.end_ms AND end_ms>NEW.start_ms)
BEGIN SELECT RAISE(ABORT,'booking-slot-conflict'); END;
CREATE TRIGGER IF NOT EXISTS booking_slots_update BEFORE UPDATE ON booking_slot_reservations
WHEN EXISTS(SELECT 1 FROM booking_slot_reservations WHERE engineer_id=NEW.engineer_id AND booking_id<>NEW.booking_id AND start_ms<NEW.end_ms AND end_ms>NEW.start_ms)
BEGIN SELECT RAISE(ABORT,'booking-slot-conflict'); END;
