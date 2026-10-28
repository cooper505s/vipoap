# Cloudflare D1 booking runtime proof — 28 October 2026

## Scope and evidence

A manual scheduled event executed the staged `commitBookingChange` primitive in Cloudflare Workers against **vipoap-rebuild-preview**, D1 database `e7ac3c3a-9c55-4674-a2d0-ae28c6c23967`. No production storage binding, mail/payment provider, public test trigger or recurring cron was configured. The dedicated Worker is `vipoap-booking-runtime-proof`; its HTTP handler returns404. Its `VIPOAP_TEST_DB` binding and database identifier were visibly verified before execution. The runner also requires the previously created synthetic preview marker before performing any mutation.

At 13:57:32 UTC, the Worker console reported `passed:true` for run `e99ae3be-1181-4b80-aab1-62c69d4287ea`. Twelve checks verified:

- Exactly one of two overlapping creations succeeded; the losing snapshot and request receipt were rolled back.
- An identical request reused its original revision; changed content under that request ID and a stale revision were rejected.
- An adjacent slot succeeded; a conflicting reschedule failed and retained the original slot.
- A deliberately invalid appended outbox write failed its database constraint and rolled back the booking, receipt and event from that entire batch.

The D1 console then queried only that synthetic run prefix. It returned two fixture snapshots at revision2: one with `proof:passed`, one with `proof:adjacent-slot-passed`. The run had **zero remaining reservations** and two synthetic `test-runtime-only` outbox records. No dispatcher is enabled for these records and no message was sent. Fixture rows remain in the isolated preview database as evidence.

The UI-deployed bundle combines the unchanged storage primitive and runner. Its SHA-256 is `af518d8591f8ac3a13179696c6b68b3139720122c3648eb5dd0d62cfd0be3a48`; the local source and browser paste string hashes matched. Worker version `a8706c23` was active after binding. The repository runner imports the same primitive rather than duplicating it, with an empty cron configuration and only the preview database binding. No Git build token was created.

## Limits and next gates

This proves actual Worker invocation of D1 batches for the tested cases, rather than only local SQLite or console SQL. It is a bounded synthetic run, not a distributed load test, business-policy review, authenticated customer journey or production concurrency guarantee. Outbox provider delivery, all-writer adapters, provider-event/checkout intent coordination, complete export/import reconciliation and post-cutover recovery remain required. The draft stays inactive and production KV remains authoritative.

Future manual proof runs generate new synthetic prefixes. Do not attach this test Worker to production storage, add a public trigger or enable a recurring cron. Before any real delivery consumer is introduced in preview, explicitly separate or dispose of these synthetic outbox fixtures; an unknown event kind must not reach a provider.
