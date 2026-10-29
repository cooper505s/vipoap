# Release 09: closed-work engineer action guards

Engineer job actions check booking, booking-status and progress fields before changing work. Cancelled, declined, safety-stopped, refunded and refund-pending records cannot progress. Completed/outcome/final-settlement records cannot restart through a stale progress value or create another final settlement. The existing follow-up-booked transition from partially resolved or unresolved work remains available when the booking is not stopped or refunded.

The endpoint also rejects non-booking storage keys and malformed JSON objects before writes. An engineer cannot progress a record whose operator and assigned-engineer aliases conflict.

Validation: 406 platform tests pass, including closed-state combinations with zero storage/provider effects, legitimate follow-up transitions, malformed-body/non-booking-key rejection and conflicting assignment scope. Provider calls use mocks only; no production appointments, charges or messages were created by the tests.

This closes stale-state action paths. Reads and writes still use separate KV operations; this release does not provide transactional concurrency protection or activate the staged D1 booking migration.
