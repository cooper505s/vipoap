# Release 07: preserve payment and booking progress

Checkout rejects already paid/refunded or terminal bookings before checking an old hold expiry. Previously an expired timestamp could cancel an already paid booking. The service payment webhook ignores late failure/expiry events after its payment ledger is paid, and ignores later completion events after a refund. Repeated successful events preserve advanced booking progress rather than changing confirmed/in-progress/completed/cancelled bookings back to requested. Closed work is not sent another paid-booking notification.

A completed service checkout now requires explicit paid/no-payment-required status before fulfillment. An unpaid completed checkout is acknowledged while the record remains pending for the later async success event. This follows Stripe's distinction between Checkout completion and payment completion.

Validation: 308 tests pass. Signed synthetic events cover expired holds on paid bookings, success followed by late expiry/failure, distinct successful event IDs on advanced bookings, completion after refund, and unpaid completion followed by async success. All provider calls are mocked. No live charges, refunds, engineer notifications or production data repairs were made to verify this release.

## Remaining priority findings

These guards address sequential stale-event failures. KV read-modify-write is still not transactional; simultaneous webhook/checkout/assignment requests can race. Do not claim exactly-once fulfillment or duplicate-booking prevention. A shared transactional coordinator, durable event inbox/outbox and reconciliation are needed across every writer, with a staged migration and rollback plan.

Manual assignment currently checks availability and writes separately, and queues a notification before persisting the assignment. Checkout retries use a stable provider idempotency key but regenerate expiry/pricing parameters; provider reconciliation and stable stored checkout intent remain needed. Several payment and assignment lookups scan only the first KV page. Subscription lifecycle ordering and partial refund semantics need separate coverage. A paid event received after cancellation needs an explicit operational review workflow. None of these findings proves a real affected transaction; no production transaction audit has been performed.

Sources: https://docs.stripe.com/webhooks and Stripe's official fulfillment guidance at https://github.com/stripe/ai/blob/main/skills/stripe-best-practices/references/payments.md . Google submissions remain deferred.
