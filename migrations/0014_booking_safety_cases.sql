-- Staged safety-case storage. No legacy case import or production activation.
CREATE TABLE IF NOT EXISTS booking_safety_cases (
 id TEXT PRIMARY KEY,
 booking_id TEXT NOT NULL REFERENCES booking_transactions(id),
 mutation_id TEXT NOT NULL UNIQUE REFERENCES booking_mutations(id),
 territory_id TEXT NOT NULL CHECK(length(territory_id) BETWEEN 1 AND 80),
 reporter_hash TEXT NOT NULL CHECK(length(reporter_hash)=64),
 report_json TEXT NOT NULL CHECK(json_valid(report_json)),
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','triaged','action-required','awaiting-information','resolved','closed')),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_safety_cases_scope ON booking_safety_cases(territory_id,status,created_at);
