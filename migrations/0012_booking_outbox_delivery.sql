-- No dispatcher is enabled by this migration.
ALTER TABLE booking_outbox ADD COLUMN lease_token TEXT;
ALTER TABLE booking_outbox ADD COLUMN lease_until_ms INTEGER;
ALTER TABLE booking_outbox ADD COLUMN next_attempt_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE booking_outbox ADD COLUMN last_error TEXT;
ALTER TABLE booking_outbox ADD COLUMN delivered_at TEXT;
CREATE INDEX booking_outbox_due ON booking_outbox(status,next_attempt_ms,lease_until_ms,created_at);
