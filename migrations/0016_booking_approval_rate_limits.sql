-- Staged preview-only HTTP abuse counters. No production application.
CREATE TABLE booking_approval_rate_limits (
 key TEXT PRIMARY KEY,
 count INTEGER NOT NULL CHECK(count>=1),
 expires_at INTEGER NOT NULL
);
CREATE INDEX booking_approval_rate_expiry ON booking_approval_rate_limits(expires_at);
