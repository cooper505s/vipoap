# Release 05: customer workspace

Customer records now have a searchable directory and separate Profile, Equipment, Files, History, Contact and Exports sections. The existing API and storage remain in place. Search covers names, telephone numbers and postcodes. Tabs support arrow keys, Home and End; a shared save action remains available from every section. Empty searches explain what happened. Profile drafts survive equipment/file changes, and switching records prompts before discarding edits.

The shared HQ shell again applies existing permission markers, including sections created after sign-in. This controls presentation; API permissions remain the authority. Updated offline assets include the new record workspace.

Validation: 303 tests pass. Synthetic local browser checks verified search results and empty state, selection, keyboard tabs, draft retention while adding equipment, saving the existing record, and a 390px phone layout without document overflow. The native discard confirmation opened, but the automation browser could not dismiss it; do not describe its cancellation path as verified. No production customer writes were used.

The owner explicitly approved application notifications through Resend to admin@vipoap.co.uk containing only the application reference and HQ review link. The production APPLICATION_NOTIFICATIONS_ENABLED=true setting was saved and verified after reload; it takes effect with the next production deployment. Preview notifications remain disabled. Historical release notes describing the earlier approval block are superseded by this approval. Verify the production notification result before claiming delivery works.

The broader customer and engineer rebuild, transactional booking/assignment, retention scheduling and recovery drill remain outstanding. Google submissions remain deferred.
