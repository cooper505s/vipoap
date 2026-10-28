# Rebuild increment 1: recruitment and HQ workspace

28 October 2026. User authorised staged implementation and release after checks. This increment is not the full VIPOAP 2.0 system.

## Behaviour

- Public brand, artwork and layout retained. Homepage uses the new technology-care proposition without advertising unbuilt household-management functions.
- Engineer interest is submitted to the same origin, validated and saved in D1 before a receipt is issued. A request UUID and payload fingerprint prevent retries overwriting details or creating duplicate records.
- Central recruitment queue supports search, status filtering, cursor pagination, optimistic updates and notification retry. Only globally authorised users with `manage_operators` can access applications; applicants do not become approved engineers.
- New HQ overview and recruitment screens use a software sidebar, work queues and a separate visual system. Other operational screens remain available while being modernised. Password HQ sign-in opens the new overview; the existing dashboard remains accessible.
- Canonicals and sitemap use final extensionless public URLs. WWW redirects to HTTPS apex. Token pages and private areas receive indexing exclusions.
- Cloudflare Pages preview responses are excluded from indexing. Preview mutations are limited to the new isolated recruitment routes. Booking/payment/account writes are blocked on preview. Existing email secrets are not used for application notifications unless explicitly enabled.

## Storage and configuration

Existing booking/customer/operator authority remains `VIPOAP_DATA` KV. Do not migrate or clear it for this increment.

Create a separate D1 database for preview and production, and bind each environment's database as `VIPOAP_DB`. Apply `migrations/0009_engineer_applications.sql` to each empty database. This migration is standalone/additive and does not modify existing KV or require historical D1 pricing seeds. Do not point preview at production.

Preview database created: `vipoap-rebuild-preview`; preview Pages binding verified. Production database/binding must be created and verified before release. Database IDs belong in configuration; secrets do not belong in Git.

Production application notifications require existing `RESEND_API_KEY`, `BOOKING_FROM_EMAIL` and text variable `APPLICATION_NOTIFICATIONS_ENABLED=true`. Leave the latter absent/false in preview. The administrative email contains only a receipt and HQ link, not application content. A failed notification remains recorded and can be retried. Resend's idempotency key reduces duplicates; external delivery and a database acknowledgement cannot be made one atomic transaction.

## Privacy and recovery

Data owner: VIPOAP owner/central recruitment. Collect contact details, availability, coverage and relevant experience only. No document uploads. Server limits bound payload and field sizes. Public responses do not expose stored application contents.

Applications expire after 180 days. Expired rows are excluded from HQ views and opportunistically purged on application submissions, with related application audit entries and expired rate buckets. A scheduled maintenance job is still required to enforce deletion without website traffic; do not treat opportunistic cleanup as a complete retention scheduler. Backup/Time Travel retention must also be documented before recruitment becomes business-critical.

Code rollback returns the site to the previous commit but does not remove D1 records. Preserve D1 and KV if rolling back. No existing store deletion or replacement is required. Applications are not included in the older KV-only backup exporter; use D1 backup/Time Travel and verify recovery separately.

## Validation

Baseline: 271 tests on original main. Added real SQLite-backed tests for validation, durable receipts, duplicates/concurrency, storage failure, notification failure/retry, HQ role scope, optimistic updates and pagination. Added preview isolation and public indexing invariants. Local browser checks verified server errors preserve input, successful receipt, HQ application retrieval/status changes, mobile fit at 390px, navigation opening and Escape/focus recovery. Review the final test totals in the PR.

Local tests use synthetic data and no external email/payment credentials. The local harness is outside the repository. Run the complete suite and D1 schema validation before release. Test the hosted preview against actual D1, as local SQLite is not proof of Cloudflare runtime correctness.

## Remaining rebuild work

- Callback form has the same third-party/CSP mismatch; replace its delivery/storage and add an HQ queue.
- Redesign remaining HQ and engineer/customer workspaces consistently.
- Audit and replace non-atomic booking/assignment paths, payment retries and operational state transitions before calling the broader rebuild ready.
- Finish daily retention/notification maintenance, backup restore evidence and central observability.
- Reconcile development branch changes individually; no wholesale merge.
- Internal `.html` links remain compatible via hosting redirects; clean these and their shared navigation selectors in a separate reviewed change.
- Membership/family entitlements, Tech Passport and bounded AI operations remain later product increments.

Do not submit the sitemap or request Google indexing merely because this increment deploys. Google launch remains gated on the rebuilt public journey and core operational release.
