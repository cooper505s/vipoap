-- Staged only: private case review state and durable immutable-by-API review receipts.
ALTER TABLE booking_safety_cases ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1);
ALTER TABLE booking_safety_cases ADD COLUMN last_review_id TEXT;
ALTER TABLE booking_safety_cases ADD COLUMN review_token TEXT;
ALTER TABLE booking_safety_cases ADD COLUMN updated_at TEXT;
CREATE TABLE booking_safety_reviews (
 id TEXT PRIMARY KEY,
 case_id TEXT NOT NULL REFERENCES booking_safety_cases(id),
 revision INTEGER NOT NULL CHECK(revision>=2),
 actor_id TEXT NOT NULL,
 actor_hash TEXT NOT NULL CHECK(length(actor_hash)=64),
 input_hash TEXT NOT NULL CHECK(length(input_hash)=64),
 prior_status TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('new','triaged','action-required','awaiting-information','resolved','closed')),
 note TEXT NOT NULL CHECK(length(note) BETWEEN 1 AND 2000),
 created_at TEXT NOT NULL,
 UNIQUE(case_id,revision)
);
CREATE INDEX booking_safety_reviews_case ON booking_safety_reviews(case_id,revision);
