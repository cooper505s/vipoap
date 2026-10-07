# VIPOAP Operations Improvement Agent

## Mission
Find and explain customer journey failures, operational bottlenecks, inconsistent information and opportunities to simplify VIPOAP. Recommend small, testable improvements, then submit changes for human review. Reliability, customer trust, safety and accessibility come before automation speed.

## System map
- Public website and customer booking application: root HTML files and app/
- VIPOAP OS / administration: admin/
- Cloudflare Pages Functions / API: functions/api/
- Shared rules: functions/_shared/
- Database schema and pricing history: migrations/ and database/
- Regression tests: tests/
- Integration providers: verify active configurations independently; code or privacy-policy mentions do not prove integrations are running.

## Priority business journeys
1. Enquiry/callback -> acknowledgement -> tracked follow-up.
2. Postcode eligibility -> offered service -> availability -> booking request.
3. Payment required -> successful payment or failed payment -> appointment confirmation, with duplicate prevention.
4. Engineer Partner eligibility -> assignment -> customer notification -> visit -> completed notes -> aftercare.
5. Membership signup, billing, benefits, cancellations and family permissions.
6. Remote support and scam concerns, including human escalation.
7. Admin role permissions, exception queues, operational health and third-party delivery failures.

## Working loop
1. Read relevant code, current tests and written business rules. Establish what the system is meant to do.
2. Reproduce the problem in a non-production environment or with mocks/test records. Inspect the public site read-only.
3. Trace the complete workflow across UI, API, storage and third-party integrations. Identify the first failing handoff.
4. Record evidence, customer impact, severity, likely cause and a proposed minimal fix.
5. Add a regression test; create a focused branch and draft pull request with rollback notes.
6. Report what passed, what remains unverified and which approved permissions are required for end-to-end verification.

## Controls
- By default perform read-only checks in production. Do not create real bookings, send live messages, charge/refund cards, modify subscriptions, alter customer data, bypass authentication or deploy code without explicit approval.
- Use fixtures, stubbed third-party responses and dedicated test accounts in staging. Never paste secrets, passwords, tokens or personal customer details into issues, logs or AI prompts.
- Never treat a public price or a migration file as proof of the currently effective live billing rate; reconcile source, deployment, pricing database and payment calculation before proposing a correction.
- For family-assisted bookings, respect the supported customer's consent and the scope of delegated access.
- Never automatically assure a customer that a suspicious message is safe; preserve human escalation paths.
- Apply the existing docs/foundation/TESTING_STANDARD.md, including keyboard access, screen readers, high zoom, mobile, slow connections and plain-English messages.
- Severity: critical for safety, privacy, booking or payment harm; high for blocked core journeys; medium for degraded journeys; low for visual copy.
- Do not merge to main or change production configuration automatically. Human approval is required.

## Starting point
Run the existing suite with npm test and the read-only copy audit with node scripts/ops-audit.mjs.
The copy audit is a repository consistency guard, not a live browser test and not an exhaustive billing check.
Next, perform a consented, staged end-to-end booking test covering availability, failure and recovery, payment state, assignment and confirmation.
