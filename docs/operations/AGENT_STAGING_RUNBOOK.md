# VIPOAP staging environment and agent go-live gates

Status: **planning only**. This document does not provision Cloudflare, connect providers, change production or authorise live transactions.

## Decision

VIPOAP currently operates only in production. Keep the first AI Operations Agent **read-only against production**. Do not test POST/PATCH/DELETE operations, booking submission, payment collection, messaging, refunds, subscriptions, admin updates or engineering assignment against the live service.

Create a **separate Cloudflare Pages project** (suggested name `vipoap-staging`) using the same GitHub repository, with a dedicated staging branch. A separate project reduces the possibility that Pages preview configuration accidentally points at live databases. Before creating a new branch or connecting automatic deployment, review existing Pages branch deployment controls and bindings. Keep the existing `vipoap.co.uk` production project's branch, routes, settings and deployments unchanged.

This plan is based on repository documentation; the actual Cloudflare dashboard configuration has not yet been verified.

## Environment separation checklist

- [ ] Confirm live Cloudflare Pages project name, GitHub deploy branch and deployment controls (READ-ONLY inspection).
- [ ] Confirm the actual production binding *names* and which services are in use; never disclose production IDs, credentials or secrets in issues or AI chats.
- [ ] Create a separate Cloudflare Pages project linked to the repository and a staging branch; never point its custom domain at `vipoap.co.uk`.
- [ ] Restrict access to **all** staging URLs with Cloudflare Access or equivalent. Note that Pages **preview** Access protection alone may not protect a separate project's primary `*.pages.dev` hostname. Test access unauthenticated before putting any test records in staging.
- [ ] Add `noindex` on the staging site and verify response headers. Search deindexing is not a substitute for authentication.
- [ ] Provision dedicated, empty `VIPOAP_DATA` KV namespace for staging. Never bind production KV; that contains sessions and operational records.
- [ ] Provision a new staging D1 database and bind it as `VIPOAP_DB`. Apply applicable migrations to the **staging database only**; seed fictional test data, not customer exports.
- [ ] Configure staging-only authentication and admin credentials, distinct from live credentials. Keep secrets inside Cloudflare secret settings; do not commit them.
- [ ] Configure Stripe test/sandbox keys, test-mode price IDs, and staging-only webhook endpoint/signing secret. Do not reuse live Stripe keys, Connect accounts or webhook destinations.
- [ ] Configure email to a controlled internal/test recipient only, or disable external sends entirely until a safe mock transport is used. Do not use live Resend/FormSubmit/Zoho integrations for tests that create or modify real contact records.
- [ ] Disable or stub customer SMS, WhatsApp, calendar invitations, third-party CRM sync, customer notifications, Engineer payouts and external webhooks unless sandbox credentials and recipients are explicitly verified.
- [ ] Use synthetic test contacts and Engineer Partner accounts. Never copy real customer, family, payment or safeguarding data into staging.
- [ ] Verify that staging cannot mutate production via any API, integration, shared KV/D1 binding or webhook.
- [ ] Record rollback and removal steps for staging resources independently of production.

## Before the agent performs a test write

All these tests must pass:
1. Production website remains unchanged and can receive real bookings.
2. Staging is private when opened in an unauthenticated browser.
3. Staging Cloudflare bindings point to new, empty resources and have no live provider credentials.
4. An authorised test booking cannot appear in production VIPOAP OS.
5. Test payment uses Stripe sandbox only and produces no live charge.
6. Test message reaches only approved test recipients.
7. Staging database reset and recovery procedures have been demonstrated.
8. A human explicitly approves enabling each staging test workflow.

If any check cannot be confirmed: remain in read-only audit mode.

## Read-only operations the agent may perform immediately

- Inspect repository files, changelogs, schema migrations, tests and permitted public website content.
- Run static code and content audits, automated unit tests and mocked integration tests.
- Investigate suspicious gaps in booking-state transitions or pricing calculations by tracing code paths.
- File evidence-backed issues and propose pull requests for owner review. No production merge/deploy.

## First staged customer journeys to automate

### Journey A: home/remote booking
- Enter an eligible and ineligible test postcode; verify availability and alternatives.
- Select dates and appointment duration; simulate two customers requesting one slot.
- Verify validation, a single booking record, error handling and retries.
- Simulate test-mode payment success, failure, cancellation, delayed webhook and duplicate webhook.
- Verify confirmation is withheld until payment requirements are met.

### Journey B: Engineer Partner assignment
- Check operator eligibility and assigned availability.
- Decline, reassign or leave a test booking unfilled.
- Verify appropriate admin queue and fictional customer notification states.

### Journey C: membership and family access
- Test membership billing and renewal in Stripe sandbox.
- Check correct member price and who can act for another person.
- Verify revoked access and cancelled memberships.

### Journey D: operational exceptions
- Simulate failed email, missing integration config, expired sessions, unavailable calendar and rate-limited requests.
- Verify accessible and plain-English recovery messages and surfaced admin exceptions.

## Required evidence for each agent finding

`ID | journey | severity | reproduction (test-only) | expected | observed | customer impact | file/line or safe logs | proposed change | verification | approval`.

No claim of a live failure from a static-code finding alone. Keep personal information and credentials out of test evidence.

## References

- Repository: `BOOKING-SETUP.md`, `docs/operations/D1_MIGRATION.md`, `docs/stripe-integration.md`, `docs/foundation/TESTING_STANDARD.md`.
- Cloudflare Pages bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Pages deployment controls: https://developers.cloudflare.com/pages/configuration/branch-build-controls/
- Cloudflare Pages preview access: https://developers.cloudflare.com/pages/configuration/preview-deployments/
