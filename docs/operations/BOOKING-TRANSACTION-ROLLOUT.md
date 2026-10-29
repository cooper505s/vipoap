# Transactional booking foundation and cutover gates

## Current status

`booking-transactions.js`, `booking-outbox.js` and migrations0011–0014 are staged foundations only. No HTTP handler or scheduled trigger imports these modules, no schema change has been applied to production, no KV record is migrated, and no live dispatcher reads this outbox. Live bookings still use KV. Do not describe production double-booking prevention or exactly-once fulfillment as complete.

The primitive atomically commits a revision-checked booking snapshot, immutable request receipt, optional engineer time reservation and pending notification intents using one D1 batch. Database triggers reject overlapping half-open UTC intervals for one engineer. A conflicting reschedule rolls back, retaining the old slot. Identical request retries return their original revision; changed content under the same request ID conflicts. Failed outbox writes roll back the booking and receipt. Notifications are never sent by this module.

Callers must authenticate, authorize territory/ownership, enforce business state and pricing rules, validate timezone conversion, supply the current reservation when changing it and prevent inappropriate state transitions. Omitted reservation preserves an existing slot; null releases it; an object replaces it. An omitted reservation is not proof that an assigned booking is safe. No end-user API exposes this primitive directly.

## Verification

382 tests pass, including 18 real SQLite cases with foreign keys enabled: state/outbox atomicity, optimistic revisions, competing creates/updates, retry identity, changed-content rejection, overlapping/adjacent/different-engineer slots, reschedule rollback, explicit release, missing records, bounded inputs and leased delivery. The local adapter serializes SQL transactions as D1 does; these are not distributed load tests or proof of the Cloudflare deployment. D1 schema validation passes. Cloudflare documents transactional rollback for batch statements: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch .

Migration0011 was applied only to the isolated preview D1 database e7ac3c3a-9c55-4674-a2d0-ae28c6c23967. Four tables and two overlap triggers were verified. A clearly synthetic reservation for qa-engineer-preview-only at epoch milliseconds1000–2000 succeeded; a second reservation at1500–2500 was rejected with booking-slot-conflict. Only the first slot remains. Synthetic records qa-foundation-one-20261028 and possibly the failed request's parent qa-foundation-two-20261028 are preview fixtures, never real bookings. No outbox messages were created. This earlier console check verified schema/trigger compatibility. A later actual Worker batch proof is recorded below; full workflow integration remains incomplete. Production schema remains unchanged.

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


## Offline export inventory (staged)

`scripts/inspect-booking-export.mjs` reads one private local JSON file; it has no credentials, network client, import or write operation. Its input contract is `{complete:true, source:"preview"|"production", exportedAt:"ISO timestamp", records:[{key:"booking:...", value:"raw JSON string"}]}`. Non-booking records are counted but not echoed. Duplicate keys, malformed snapshots and a missing completeness marker fail closed. The inventory reports booking keys, raw-source SHA-256 hashes and validation issue codes, with a stable manifest hash independent of record order. Dates and times use the staged UK converter, including clock-change exceptions.

The result always says `dryRun:true` and `cutoverReady:false`. A supplied completeness marker cannot prove the export followed every KV page or that writes were frozen. This tool is neither a backup nor a reservation importer, and does not verify business transitions, reference-index completeness, related ledgers or collisions. Keep inputs and generated inventories outside this public repository: keys and hashes are operational data even though customer names/contact details are omitted. Only synthetic fixtures were inspected during development. Complete paginated extraction, recovery proof, source reconciliation and an actual import remain required.

## Actual Cloudflare runtime verification

The scheduled-only synthetic runner successfully exercised real Worker D1 batches against isolated preview storage: overlapping creation, request replay/revision conflicts, conflicting reschedule preservation and full rollback following an outbox constraint failure. Its12checks passed and all run reservations were released. See [BOOKING-RUNTIME-PROOF-20261028.md](BOOKING-RUNTIME-PROOF-20261028.md) for bounded evidence and remaining gates. This does not connect any live journey or enable provider delivery.

## Authenticated snapshot readers (staged)

`booking-access.js` loads a snapshot/revision only after the existing sign-in helper authorises the caller. Admin/engineer reads enforce a fixed supported permission, territory and engineer assignment; customer reads additionally require a finite unexpired session and exact customer ownership. Missing records use the same not-found response as out-of-scope records. The adapter requires the explicit `VIPOAP_BOOKING_DB` binding and has no fallback to legacy KV booking records. Malformed stored snapshots fail closed. Tests cover assigned work, HQ territory/permission, customer ownership/expiry, unauthenticated access before storage queries, missing storage and invalid records.

No live route imports this adapter. It does not implement state transitions, mutations, approval consumption, immutable-field rules or provider effects. Future handlers must use the returned `bookingId` and revision rather than trusting a key embedded in snapshot data, and perform shared revision-checked mutations. Existing session storage/expiry policy remains a separate concern; do not treat these tests as a complete authentication-system audit.


## Repeatable compilation gate

The quality workflow validates the D1 schema and compiles all Pages Functions with the same Wrangler3.114.17 version observed in Cloudflare deployments. The compiler writes to the runner temporary directory with metrics disabled, performs no deployment and requires no account token. Local compilation of the complete draft, including authenticated readers and the current public confirmation copy, succeeded on28October2026; all368tests and D1 validation also passed.

Cloudflare preview8d152940 for earlier heade7ec0f5 failed after its GitHub tests passed. The external check exposed no root-cause detail, and the browser diagnostics connection was unavailable. Successful local compilation does not establish the reason for that hosted failure. The newer branch incorporating the released copy change passed both GitHub checks and Cloudflare preview2836b6b3. The earlier failure cause remains unconfirmed. Keep this draft inactive until hosted checks and all integration/cutover gates pass.


## Authenticated commands and durable replay identity (staged)

`booking-commands.js` adds two internal commands: an authorised engineer/HQ note update and an owner-only customer appointment change/cancellation **request**. Payload fields are allowlisted; callers cannot patch price, customer, territory, assignment or booking identity. Customer requests preserve the appointment, payment and reservation until reviewed. Closed/active/refunded work and an already pending request reject new requests. Notes may be edited on historical authorised work. Return values are only booking identity, committed revision and replay status.

Migration0013 adds optional command metadata to mutation receipts. It records a version, hashed authenticated actor, command kind and normalized-input hash in the same D1 batch as state and domain-event intents. No session token, free-text note or customer request description is copied into the receipt/event payload. A matching retry returns its original revision even after a later mutation or when concurrent attempts use different server timestamps. Changed input/actor or a reused legacy receipt conflicts. Current authorisation is checked before receipt lookup; a receipt never grants access after reassignment or ownership changes. Different commands racing on one revision have one winner.

The optional primitive branch leaves legacy no-metadata SQL/hash semantics intact. Legacy calls work without0013, while command adapters fail before mutation when that migration is absent. The existing Cloudflare runtime proof exercised the legacy transaction path; **0013 has not been applied to production**. Its command_json column was subsequently verified present with `PRAGMA table_info(booking_mutations)` in the isolated preview console; do not repeat the ALTER. The new metadata command path has not been proved in Cloudflare yet. Verify the preview schema and repeat runtime proof before enabling an adapter. The new helper remains unused by every HTTP route and scheduler.

Future handlers must provide a server timestamp, project internal snapshots to safe role-specific responses, and connect the pending-request domain event to a durable HQ review workflow. These adapters do not create the legacy separate help-request record or send any message. Domain events require explicit internal routing; they are not provider-send instructions. Assignment, service progress, safety incidents, checkout/payment/provider inbox, approval consumption and other writers still require coordinated adapters, immutable-field rules and end-to-end/recovery checks before cutover.


## Assigned engineer progress command (staged)

The third internal command, `engineer-job-transition`, supports only pending to accepted to en-route to arrived to in-progress. It requires an assigned operator session, territory access, consistent assignment aliases and the expected revision. Closed, stopped and refunded appointments cannot progress. The command preserves booking/customer identity, price, payment state and reservation; it records server timestamps and a minimal internal domain event atomically with its receipt. Retry identity and rollback use the same command mechanism as notes and customer requests.

HQ overrides, reassignment/decline, completion, safety stops, settlement and additional-time decisions are deliberately outside this bounded command and still require their own coordinated adapters. No live route or scheduler imports this adapter. Local tests cover ordered progress, invalid transitions, assignment/role scope, historical replay, racing commands and outbox failure rollback. A real Cloudflare command-path proof remains pending.


## Integration checkpoint — 29 October 2026

The inactive draft now incorporates released main `2d9df3c60545a6e1a469b06cbeb1bab325c7912b` (through PR95), including the staff/contact signatures, access controls and compact portal workspaces. The previous 382-test count describes an earlier draft; the current integrated suite is recorded with the updated pull request checks. This integration does not enable any booking command, provider consumer, schema migration or storage cutover.

Offline inventory now emits a separate `exportHash` over sorted keys and raw-value hashes for **every** exported record. The existing `manifestHash` covers booking inspection results only. A change to operator eligibility or another associated record therefore changes complete-export integrity even when all bookings are unchanged. Neither hash proves that a source export actually traversed every KV page, captures a consistent frozen instant, can be restored or is safe to import. Keep the source file and manifests private. Production cutover still requires the full export, recovery and every-writer gates above.


## Offline reservation review plan

Run `node scripts/plan-booking-reservations.mjs PRIVATE_EXPORT.json` only against a protected local export in the same format as the export inspector. Keep the output private too: it contains booking keys, engineer IDs and appointment intervals. The command has no network, database or provider operations.

The plan uses the export timestamp as its fixed review instant, converts unambiguous UK appointment times to half-open UTC intervals, includes approved additional-time minutes and groups connected overlaps per engineer. Adjacent intervals are allowed. Duplicate references, invalid intervals, conflicting assignment aliases, missing customer/engineer records, inactive/out-of-territory engineers, expired payment holds and unrecognised states produce review issues. Ongoing work and future terminal/refunded appointments require review rather than being silently imported or released. Historical coherent closed work is counted without a proposed reservation.

A candidate is only a proposed interval. Every candidate still requires eligibility review, including training, DBS, current availability, travel/buffer policy, payment/entitlement reconciliation and any external writers. The planner does not validate those rules or prove completeness/frozen consistency of its input. `cutoverReady` remains false unconditionally. The output includes the complete export fingerprint and a deterministic plan fingerprint; it cannot be used as authority to activate production or import records automatically.


## Assigned engineer decline command (staged)

`engineer-job-decline` accepts only a bounded reason from the currently assigned engineer before work starts. A revision-checked transaction clears all assignment aliases, marks the appointment unfilled, releases its reservation, preserves price/payment/customer facts and stores one minimal internal reassignment event with the command receipt. Closed, refunded, in-progress and inconsistent-assignment records fail before mutation. A failed event insertion rolls the assignment, receipt and reservation release back together.

This is a durable unfilled/reassignment hand-off, not automatic replacement selection or a customer notification. No live endpoint or dispatcher calls it. The future shared assignment coordinator must validate eligibility, reserve a replacement and reconcile notification intents. Existing legacy behavior remains active until all writers can cut over together. Current assignment authorization is checked before replay lookup: after unassignment the declining engineer receives not-found rather than gaining access through an old receipt. The booking remains visible to authorized HQ readers for reconciliation.


## HQ engineer assignment command (staged)

`hq-assign-engineer` requires assignment-management permission and HQ scope. It validates the current reservation against the booking, checks target service/territory/compliance/suspension and stored working hours, then atomically transfers the reservation, resets prior-engineer progress and stores a minimal internal assignment event with the receipt. Old progress is retained in assignment history. A slot conflict or event failure keeps the previous assignment and reservation. Repeating the same request reuses its original receipt; selecting the current engineer preserves progress and creates no new notification event.

UTC interval endpoints are compared against UK schedule endpoints, including clock changes. Missing/inconsistent reservations and active/closed/refunded appointments require review. Prices, customer identity and payment facts remain unchanged. No provider is called, and the internal event is not itself a delivered notification.

Eligibility and availability still come from legacy KV and are not locked by the booking transaction. The existing legacy-compliance policy is reused, including its legacy-record handling. Eligibility changes, policy review and every-writer coordination therefore remain explicit cutover gates; this module cannot establish a production-wide eligibility guarantee. No live route imports it, and no storage authority has switched.


### Assignment eligibility follow-up

New replacement assignments evaluate the existing compliance policy both at the server timestamp and on the appointment date. Non-empty malformed DBS/insurance expiry dates require review. Expiry on the appointment date follows the existing inclusive-day policy. This does not change the legacy-record fallback or create missing compliance evidence.

Modern service-specific schedule blocks and legacy weekly ranges are validated before interval comparison. Malformed blocks, overrides, blocked dates and reversed ranges produce a 409 review conflict without mutation. Selecting an already assigned engineer remains a no-op for assignment/progress and notification events; it is not a fresh eligibility approval. Legacy KV eligibility concurrency and final policy review remain cutover gates.


## Private safety report and booking stop (staged)

`report-booking-safety` requires reporting permission and current booking/territory access. Caller fields are allowlisted; reporter identity comes from authentication. It commits a private case, its linked booking revision, command receipt and a minimal internal event in one batch. Report text is stored only in the restricted case table, not in the booking snapshot, receipt metadata or event payload.

With an explicit stop request, all work-status fields become safety-stopped and payment status becomes review. The private immutable report retains the previous status/payment facts. The engineer reservation is preserved for manual safeguarding/operational review rather than silently released for another allocation. Historical/closed/refunded work can receive a report without stopping work; a new stop is rejected on ended/refunded work. Repeated requests return the original case identity and reference.

Migration0014 creates `booking_safety_cases` with booking/mutation foreign keys and scoped status indexing. It has NOT been applied to preview or production. Existing commands remain compatible without0014; safety commands fail closed without it. The private reader requires `manage_incidents` plus case-territory access before returning the report. The existing KV safety API, standalone reporting and case-management workflow have not cut over.

Remaining gates include actual D1 proof of this new case path, scoped queue/triage adapters, standalone-case/import compatibility, review of case retention/access/audit policy and every-writer/payment coordination. Intake expiry cleanup does not cover this table. No provider is called or incident delivered by the internal event, and no live route imports this code. Do not apply production schema or activate it as a completed safety migration.


### Restricted safety queue (staged)

The queue reader applies authenticated territory and optional status filters in SQL before fetching a bounded page (1–100, default50). Keyset pagination orders by creation timestamp and case ID, including timestamp ties. It returns case metadata only; full report text remains behind the individually scoped reader. Invalid paging input is rejected before querying; no-territory managers receive no records. Blank stored scopes never fall back to Andover. The queue is inactive: no live route imports it, case triage/update and audit policy remain unfinished, and migration0014 is still unapplied.


### Private case review and history (staged)

Migration0015 adds a separate case revision and a private review receipt/history table. It is staged only, not applied to preview or production. Both0014 and0015 are now required by the staged case readers; missing schema fails closed. The booking safety-report command remains compatible with0014 alone.

`reviewBookingSafetyCase` requires current safety-management permission and case-territory access before reading a retry receipt. It accepts an expected case revision, unique request ID and exactly a valid status plus a required concise review note. Actual authenticated manager identity is recorded, never caller-supplied authorship. A fenced D1 batch advances the case revision/status and inserts its private history/receipt together. Failed history insertion rolls back the case change; stale competing reviews return409. Identical concurrent requests save once, and matching retries retain the original revision after later reviews. A request reused by another actor, case or input conflicts. Review notes remain private and do not enter booking snapshots or outbox events.

The separately scoped history reader is bounded and paginated by immutable case revision. Individual case and queue metadata include case revision for subsequent review. Changing case status, including resolved/closed, does not release an engineer slot, resume stopped work, restore payment status, refund, notify anyone or mutate the original factual report. Those decisions require separate coordinated commands and approved policy. No provider is called, no live route imports these adapters, and the existing KV incident workflow remains production authority. Human/AI assignment, due dates, standalone cases, import compatibility and retention/audit policy remain unfinished; this is not a complete incident-management cutover.


### Session-based additional-time commands (staged)

Assigned engineers can request one to six half-hours only on an active job without safety/payment review. A pending request, its frozen customer charge and engineer entitlement in integer pence, one-hour expiry and internal event commit in the booking transaction. A second live request conflicts; replacement after expiry retains the expired request in history. Legacy token requests require review rather than being silently replaced.

An authenticated owning customer can read a minimal quote projection and approve/decline the current request. Approval atomically consumes it, records customer-account approval, increments frozen amounts and extends the engineer reservation; a collision or event failure rolls back all effects. Decline clears the request without changing money or slots. Revision receipts prevent duplicate increments and competing decisions. Price/identity remain unchanged, and no provider is charged or communication sent. Quote projection excludes engineer entitlement and full booking details.

This is an inactive customer-session transport, not a replacement for the existing live login-free email/SMS approval link. Secure bearer-token issuance/reader/decision integration, actual provider delivery, verbal/written approval records, schedule/eligibility policy for overtime and migration of outstanding legacy approvals remain release gates. No live route imports these commands; do not activate only this path and strand existing links. Existing KV requests and live pricing remain unchanged. Actual Cloudflare runtime proof remains required, including slot conflicts and rollback.
