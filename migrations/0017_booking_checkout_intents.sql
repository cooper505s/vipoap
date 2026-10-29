-- Staged only: durable checkout intent; no provider invocation or production activation.
CREATE TABLE booking_checkout_intents (
 id TEXT PRIMARY KEY,
 booking_id TEXT NOT NULL REFERENCES booking_transactions(id),
 mutation_id TEXT NOT NULL UNIQUE REFERENCES booking_mutations(id),
 purpose TEXT NOT NULL CHECK(purpose='additional-time'),
 amount_pence INTEGER NOT NULL CHECK(typeof(amount_pence)='integer' AND amount_pence>0 AND amount_pence<=9007199254740991),
 currency TEXT NOT NULL CHECK(currency='GBP'),
 state TEXT NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','creating','ready','paid','failed','review')),
 created_at TEXT NOT NULL,
 UNIQUE(booking_id,purpose)
);
CREATE INDEX booking_checkout_intents_pending ON booking_checkout_intents(state,created_at);
