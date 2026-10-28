# Release 03: customer record preservation

The customer editor previously populated its hidden record key from a nonexistent property, so an edit could create a second customer instead of updating the selected record. It now retains the key and blocks overlapping saves. Blank telephone numbers no longer match unrelated visit history.

Ordinary contact edits preserve unedited membership prices, status, renewal dates, allowances, integration IDs, equipment and attachments. The customer screen shows the existing membership for reference rather than sending a legacy plan value that could overwrite billing state. This release does not change commercial prices or entitlements.

Customer reads now traverse KV pagination and filter by the authenticated account's territories. Updates reject records and destinations outside those territories. Regional creates use an assigned territory and authenticated operator identity. Existing KV remains authoritative; no data migration or cleanup is performed. Other administrative routes need their own scope audit and are not certified by this change.

Validation: 300 tests pass, including regressions for partial-update preservation, multiple KV pages and regional read/write boundaries. A fresh synthetic local browser session created a customer and saved an edit, retaining one customer and its original identity. No production customer records were created or edited during testing. KV concurrency and cross-store consistency remain limitations pending the transactional rebuild.
