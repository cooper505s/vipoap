# D1 recovery drill — 28 October 2026

The drill used a new unbound database named `vipoap-recovery-drill-20261028`. It contained only a synthetic recovery_probe table and two text markers. Production and the existing preview database were never restored, overwritten or copied.

Procedure and observed results:

1. Created the table and a `before` marker. Captured a current Time Travel bookmark.
2. Added an `after` marker and captured the later bookmark for recovery.
3. Restored the disposable database to the first bookmark. A query returned only the before marker.
4. Used the undo bookmark returned by Cloudflare to restore the later state. A query returned both before and after markers.

Both restore operations succeeded, and both post-restore queries matched their expected states. The private checkpoint contains the resource identity and bookmarks. The database remains unbound, retaining only synthetic markers. Do not bind it to an application or treat its records as production data.

This demonstrates the account's D1 point-in-time restore and undo procedure. It does not establish a production restore test, KV backup completeness, off-site backup retention or application consistency after a restore. Restoring a database overwrites it in place and cancels in-flight transactions. Production recovery needs a maintenance/reconciliation plan and verified pre-restore bookmark. A full application rollback can involve more than one store and external provider effects.

Cloudflare documents a retention window of 7 days for Workers Free and 30 days for Workers Paid; verify the actual plan/window at recovery time. Expiry cleanup does not remove Time Travel history immediately. Source: https://developers.cloudflare.com/d1/reference/time-travel/ .

## Intake cleanup preparation

The prepared worker deletes only expired engineer applications (180-day expiry), callback requests (365-day expiry), related intake audit entries and expired rate counters. It updates a retention heartbeat read by HQ. It does not touch booking/customer KV, make charges or send emails. UK-local 03:00 scheduling uses 02:00 and 03:00 UTC candidates with an Europe/London hour gate, including daylight saving. Preview has no automatic trigger.

The owner explicitly approved activation of the daily cleanup job after the recovery drill. Tests of expiry boundaries, retained current records and UK winter/summer scheduling pass; the full release suite passes312 tests. Deployment and actual trigger/binding verification are separate steps. A successful code test or this recovery drill is not proof the production job has been deployed or run.
