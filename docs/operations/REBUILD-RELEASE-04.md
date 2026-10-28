# Release 04: verify customer identity indexes

An old phone/email index can remain after a contact edit. Shared customer lookup previously trusted that index without checking the current contact, allowing a later request using an old number to link to and overwrite the wrong customer. Lookup now verifies the current phone or email before accepting an indexed record, ignores index targets outside customer storage and traverses all customer KV pages when scanning is necessary. Storage keys take precedence over any stale embedded key.

No indexes or existing customer records are deleted or rewritten by deployment. Existing matching rules still use either supplied phone or supplied email. This is identity linking, not authentication; customer portal authentication remains separate. KV does not provide transactional duplicate prevention, and that remains a later rebuild task.

Validation covers stale phone indexes without overwriting the old record, lookup across multiple pages, storage-key precedence, empty identities and unrelated index targets. Existing customer account and portal action tests continue to pass. Full suite: 303 tests passed. No real customer or external service data is used in these tests.
