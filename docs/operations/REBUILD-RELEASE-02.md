# Release 02: callbacks and workspace navigation

The contact form now saves callback requests to D1 before showing a receipt. Requests appear in a central HQ queue with search, status changes, optimistic conflict protection and an audit trail. Preferred callback times are requests, not confirmed appointments. This route sends no email or other third-party notification.

Apply additive migration `0010_callback_requests.sql` to each environment before deploying. Keep preview D1 and KV separate from production. Existing booking/customer KV remains authoritative and is not migrated by this release.

HQ pages now share the software sidebar, permission-aware navigation, sign-out, mobile menu and install controls. Email-code administrator sign-in opens the new overview. Engineer and customer journey redesigns remain further work.

The optional new `workers/intake-maintenance` worker removes expired applications (180 days), callbacks (365 days), associated audit records and expired rate counters. Its daily schedule is code only until separately deployed and verified. HQ reports missing or stale retention runs. Never claim retention scheduling is active solely because this configuration exists. D1 recovery/Time Travel evidence remains outstanding; the older KV exporter does not back up D1.

Application email notifications remain disabled pending the owner's specific approval. Automatic approval review rejected enabling production transmission of application references and HQ review links through Resend to admin@vipoap.co.uk. Do not enable them through alternate code or tooling.

Validation: 297 tests pass, including real SQLite tests of callback receipts, validation, retries, permissions, status conflicts, expiry and the retention job. D1 schema validation and diff checks pass. Local customer workspace fits a 390px viewport after wrapping legacy action buttons; the mobile menu opens and closes with Escape. Hosted preview callback storage must be verified before merge, followed by a clearly labelled synthetic production check. Do not contact real applicants or charge payments for verification.

Code rollback must preserve both databases and KV. No destructive schema rollback is needed. Google submissions remain deferred until the broader rebuilt release is ready. This increment does not establish that payment, assignment, membership or the full VIPOAP 2 specification is complete.
