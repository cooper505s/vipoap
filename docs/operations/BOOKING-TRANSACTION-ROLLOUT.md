# Transactional booking foundation and cutover gates

## Current status

`booking-transactions.js`, `booking-outbox.js` and migrations0011–0012 are tested foundations only. No HTTP handler or scheduled trigger imports these modules, no schema change has been applied to production, no KV record is migrated, and no live dispatcher reads this outbox. Live bookings still use KV. Do not describe production double-booking prevention or exactly-once fulfillment as complete.

The primitive atomically commits a revision-checked booking snapshot, immutable request receipt, optional engineer time reservation and pending notification intents using one D1 batch. Database triggers reject overlapping half-open UTC intervals for one engineer. A conflicting reschedule rolls back, retaining the old slot. Identical request retries return their original revision; changed content under the same request ID conflicts. Failed outbox writes roll back the booking and receipt. Notifications are never sent by this module.

Callers must authenticate, authorize territory/ownership, enforce business state and pricing rules, validate timezone conversion, supply the current reservation when changing it and prevent inappropriate state transitions. Omitted reservation preserves an existing slot; null releases it; an object replaces it. An omitted reservation is not proof that an assigned booking is safe. No end-user API exposes this primitive directly.

## Verification

355 tests pass, including 18 real SQLite cases with foreign keys enabled: state/outbox atomicity, optimistic revisions, competing creates/updates, retry identity, changed-content rejection, overlapping/adjacent/different-engineer slots, reschedule rollback, explicit release, missing records, bounded inputs and leased delivery. The local adapter serializes SQL transactions as D1 does; these are not distributed load tests or proof of the Cloudflare deployment. D1 schema validation passes. Cloudflare documents transactional rollback for batch statements: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch .

Migration0011 was applied only to the isolated preview D1 database e7ac3c3a-9c55-4674-a2d0-ae28c6c23967. Four tables and two overlap triggers were verified. A clearly synthetic reservation for qa-engineer-preview-only at epoch milliseconds1000–2000 succeeded; a second reservation at1500–2500 was rejected with booking-slot-conflict. Only the first slot remains. Synthetic records qa-foundation-one-20261028 and possibly the failed request's parent qa-foundation-two-20261028 are preview fixtures, never real bookings. No outbox messages were created. This verifies D1 schema/trigger compatibility, not the module's actual Worker batch invocation or full workflow integration. Production schema remains unchanged.

## Inactive delivery consumer

Migration0012 adds delivery leases, retry scheduling and acceptance/error markers. The internal consumer claims one event atomically, increments its bounded attempt count, and requires explicit provider acceptance before recording success. Retries keep the original outbox ID. Delivery callbacks must use that ID as the provider idempotency key and honor the supplied timeout signal. A stale worker cannot overwrite a newer lease; interrupted leases can be recovered, and exhausted work remains failed for review. Generic failure markers exclude provider error bodies and customer content.

The callback is injected; no real provider adapter, public route or cron is enabled. Tests use synthetic callbacks. Acceptance is not inbox delivery. Leases do not provide exactly-once external effects: provider reconciliation, idempotency retention windows, provider adapters, queue monitoring/manual retry and operational authorization remain gates before activation. A callback that ignores its signal may outlive its lease; provider deduplication is therefore mandatory.

## Required staged integration

1. Inventory every booking, payment, assignment, dispatch, customer-change and administrative writer, including scheduled jobs and webhooks. Define allowed transitions and terminal-state behavior. Keep all prices/entitlements unchanged unless separately agreed.
2. Apply0011 to isolated preview storage. Verify actual D1 batch results, triggers, retry conflicts and failed-outbox rollback. Test using synthetic customer/engineer records and mocked provider calls. Keep production schema and traffic unchanged during this proof.
3. Build authenticated adapters for all writers and a reader compatible with existing keys/references. Provider event inbox and stable checkout intents must share the transaction boundary. Persist outbound work before sending, and use stable provider idempotency identifiers. External delivery is at least once unless provider reconciliation proves otherwise; a database transaction cannot undo a sent message or charge.
4. Test UK timezone and DST conversion, expired holds, payment after cancellation, partial refunds, subscription ordering, owner/territory scope, concurrent slot requests and all failure/retry windows. Add reconciliation for provider success followed by a failed local response.
5. Export a complete paginated KV snapshot and independently back up D1. Demonstrate restore in disposable test storage. Produce a dry-run import manifest with stable request IDs, source hashes, record counts, active future reservations and exceptions; unknown or ambiguous states require review. Never import silently or assume there are no customers.
6. Prepare a bounded maintenance window that pauses every mutation source, including webhooks/queues, without losing events. Reconcile the frozen snapshot and import active reservations before enabling any new booking writer. Replay retained events and compare totals/identities/states. End maintenance only after end-to-end preview and recovery checks pass.
7. Switch all live writers/readers together through a reviewed compatibility adapter. Keep legacy KV as preserved history and any deliberately maintained read mirror, not an independent writer. Monitor conflicts, queue age and provider reconciliation. Do not expose a production toggle that allows bypassing the shared coordinator.

## Recovery and rollback

Before cutover, ordinary code rollback is sufficient because the foundation is unused. After cutover, Git rollback alone is unsafe: old code would read stale KV and could overwrite newer state. Use maintenance, preserve the authoritative D1 state, replay/reconcile mutations into any legacy compatibility store and verify active reservations before switching back. Keep import manifests and recovery bookmarks outside public source control. Retention for booking snapshots, mutation receipts and notification payloads must be agreed and implemented before production use; current intake retention does not cover these tables.

Existing migration0001 contains a prior relational model that is not the live authority. This foundation uses standalone tables to avoid requiring that unused model or silently replacing KV. A later migration must explicitly settle the final schema; do not keep multiple booking stores indefinitely.

## UK reservation time conversion (staged)

`booking-time.js` validates calendar dates, 24-hour wall times and integer durations, converts Europe/London time by round-tripping candidate offsets, and rejects nonexistent spring times and repeated autumn times. Durations are elapsed minutes, including appointments crossing a clock change or midnight. It accepts dates from 2000 through 2100 for imports; booking-window/past-date rules remain caller responsibilities. Six tests cover winter/summer/midnight, both clock changes, leap dates, invalid inputs and independence from the server timezone. No live handler imports it yet.

The source mutation inventory is in [BOOKING-WRITER-INVENTORY.md](BOOKING-WRITER-INVENTORY.md). It identifies the independent reminder Worker, review markers, payout fields and linked stores that must participate in the cutover. Inventory is not a completed adapter rollout. Main has subsequent PR77–79 safeguards that this older draft branch must incorporate before integration.
