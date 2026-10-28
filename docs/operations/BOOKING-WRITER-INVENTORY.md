# Booking mutation inventory and cutover scope

Audited source: draft transaction foundation based on 19f484c, with live safeguards through PR79 tracked separately. This is a source inventory, not proof that the deployed scheduled Worker matches the repository or that every dynamic KV key is classified. Re-run a repository-wide write scan before freezing a release.

## Booking snapshot writers

| Source | Mutation and related effects | Cutover requirement |
| --- | --- | --- |
| `functions/api/bookings.js` | Creates slot-key snapshot and reference index, customer/help associations; deletes slot/reference on creation failure; dispatches email | Atomic identity/slot reservation, stable create intent and notification outbox; paginated conflict/import scan |
| `functions/api/admin/bookings.js` | Confirmation, decline replacement, completion/cancellation, notes and cancellation charge; sends confirmation/reassignment | Shared transition and eligibility rules, atomic replacement/release plus notification intent; include PR78 safeguards |
| `functions/api/admin/job-assignment.js` | Assignment history/status and queued notification | Persist assignment and intent together; conflict-safe slot transfer; same-request replay |
| `functions/api/admin/job-actions.js` | Accept/travel/arrival/start/outcome, extra-time requests/approval, settlement link | Atomic progress/approval/entitlement events, provider intent reconciliation; include PR79 closed-work guards |
| `functions/api/additional-time-approval.js` | Approval response, additional amount/entitlement, pending-request clearing | Approval consumption and booking increment in same transaction; current-token and active-work checks from PR79 |
| `functions/api/account/appointment-request.js` | Customer change-request fields plus help request/index, notification/audit | Authorize owner and commit linked request atomically; no implied cancellation before HQ review |
| `functions/api/payments/checkout.js` | Expired hold cancellation, checkout/payment references, payment ledger | Stable provider checkout intent before API call; reconcile success before response failure; terminal guards and slot release |
| `functions/api/payments/webhook.js` | Service/additional payment state, refund state, hold expiry, dispatch and help association; event receipt | Provider inbox receipt, booking/ledger transition, outbox in one commit; replay and out-of-order policies; distinguish partial refund |
| `functions/api/admin/additional-settlements.js` | Recreated/resend settlement reference and status via final-settlement helper | Durable checkout intent, read current amount, avoid duplicate charge/notification |
| `functions/api/admin/incidents.js` | Stop-work status/payment review and incident link | Validate job ownership/territory before stop; atomic incident link, invalidate further service/payment mutations; safety slots require explicit policy |
| `functions/api/admin/my-payments.js` | Manual provider-paid status/reference on booking or callout | Preserve payout facts with revision check; authorise billing/territory |
| `functions/api/admin/stripe-payouts.js` | Provider-paid/Stripe transfer facts on booking or callout | Stable transfer intent and provider reconciliation; no actual transfers in tests |
| `functions/_shared/reviews.js` | Review key/invitation timestamp on snapshot, review/access records, email | Avoid stale full-snapshot overwrite; atomic invitation intent and token creation |
| `workers/booking-reminders/src/index.js` | Appointment/settlement reminder markers, expired-hold cancellation; invokes reviews/communications/Zoho | Pause/redeploy this independent Worker at cutover; revision-aware updates and paginated scans; do not assume Pages deploy updates it |

## Associated stores that also participate in consistency

| Source | Stores written | Relationship |
| --- | --- | --- |
| `functions/_shared/final-settlement.js` | Additional payment ledger, checkout/email markers | Called by job actions and settlement API; external API success needs reconciliation |
| `functions/_shared/communications.js` | Queue and communication history | Assignment/payment/reminder delivery; current random queue identifiers are not request deduplication |
| `functions/api/admin/refunds.js` | Refund request and payment ledger; Stripe API | Partial amount currently marks ledger refunded; do not cut over without amount/remainder policy and event reconciliation |
| `functions/api/admin/callouts.js` | Callout and customer associations | Distinct work store, included in payout/ticket views; linked bookings must not double count |
| `functions/api/admin/tickets.js` | Ticket and `ticket-state:` overlays | Does not update booking snapshot; status/assignee overlay must not bypass slot or booking transitions |
| `functions/api/admin/membership-usage.js` | Membership usage linked to booking/customer | Not a snapshot write; consumption must be idempotent and owned/authorised |
| `functions/api/account/preferred-engineer.js` | Customer preference | Reads completed bookings/callouts; keep reader compatible, does not reserve work |
| `functions/api/admin/help-booking.js` | Private invitation token and help request | Creates invitation, not booking; preserve owner and expiry checks |
| `functions/api/referrals.js` | Referral event/history | Linked booking context; no direct booking mutation found |
| `functions/api/admin/equipment-recommendations.js` | Recommendation records | Linked job/customer context; no direct booking mutation found |
| `functions/api/admin/followups.js` | Follow-up records | Related workflow, no direct booking snapshot write found |
| `functions/api/admin/remote-recordings.js` | Recording metadata and private object storage | Consent/access and retention gates; no booking snapshot write found |
| `functions/api/admin/training.js` | Course/progress/operator compliance | Changes assignment eligibility; do not freeze only booking records |

## Unfinished integration gates

1. Classify remaining alias/dynamic-key writes and all readers, including deployed Worker versions and any external automation. Preserve the raw KV export outside public Git.
2. Define one transition model across `status`, `bookingStatus`, `jobStatus`, payments and ticket overlays. Keep safety stops, refunds, completed work and stale webhooks from re-opening appointments.
3. Route all snapshot writers through the shared coordinator; do not dual-write independently to KV and D1. Include provider ledgers/inbox and stable intent identities in the transaction design.
4. Dry-run import: count/hash every page, map old slot keys and references to stable booking identity, reserve active future work, quarantine unknown/ambiguous records. Demonstrate restore of KV as well as D1.
5. Freeze every mutation source, not just the public booking form. Retain provider events during maintenance and reconcile before reopening. Rollback after cutover requires data reconciliation, not just Git revert.

No production schema or authoritative storage change is enabled by this document.
