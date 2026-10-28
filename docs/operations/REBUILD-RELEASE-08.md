# Release 08: manual assignment guards

Manual assignment now rejects completed, cancelled, declined, in-progress and refunded jobs. Retrying an existing assignment to the same engineer leaves confirmation/progress unchanged and does not append another history entry or queue another message. Availability checks traverse all operator and same-day booking KV pages so a later-page conflict cannot be missed.

Validation: all 311 tests pass. Synthetic tests cover terminal/active/refunded job rejection without mutation or notification, repeated assignment retaining one history entry/message and confirmed state, and conflicting bookings on later storage pages. No real assignment, customer record or outbound communication was changed to verify this release.

The availability check and write remain separate KV operations. This does not prevent simultaneous assignments or replace a transaction. Notification is still queued before the assignment record is saved; a transactional assignment/outbox design is needed to close that failure window. No data migration is included.
