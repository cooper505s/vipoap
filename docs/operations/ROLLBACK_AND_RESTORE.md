# VIPOAP production rollback and data restore

This runbook separates a code deployment rollback from a data restore. A Cloudflare Pages rollback changes the deployed website and Functions code; it does not reverse data already written to Workers KV.

## Authority and safety gates

- The incident owner must be a VIPOAP HQ administrator with `manage_operations`.
- Record the current production deployment, Git commit, time, impact and person leading the incident.
- If VIPOAP OS remains usable, download and validate a fresh HQ backup before changing anything.
- Never paste Cloudflare, Stripe, Resend or Zoho secrets into incident notes, Git, chat or backup files.
- Do not restore KV merely to fix a broken page. Restore data only when durable records are confirmed missing or corrupt.

## Site or Functions rollback

1. In Cloudflare, open **Workers & Pages**, select the VIPOAP Pages project, then open **Deployments**.
2. Identify the most recent previously successful **production** deployment and confirm its Git commit predates the incident.
3. Use its actions menu and choose **Rollback to this deployment**. Preview deployments are not rollback targets.
4. Check the public homepage, booking availability, customer sign-in, partner sign-in and HQ health page.
5. In Git, revert the faulty commit with a new commit and push that correction to `main`. Do not rewrite shared history. This keeps the repository aligned with the emergency Pages rollback and prevents the next deployment from restoring the fault.
6. Record the selected deployment, commit, checks performed and outcome in the incident record.

Cloudflare documentation: [Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/) and [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).

## Controlled Workers KV restore

1. Establish a maintenance window and stop staff from updating VIPOAP OS while the restore is prepared.
2. Keep an untouched copy of the backup in an approved protected location.
3. Validate the backup in **VIPOAP OS → Platform health → Validate backup file**.
4. On an authorised administration computer, prepare the Cloudflare bulk file:

   `node scripts/prepare-kv-restore.mjs vipoap-backup-YYYY-MM-DD.json vipoap-kv-restore.json`

5. The preparation command must report the expected record count. A checksum, duplicate-key or session-key error stops the restore.
6. Take a second current backup of the affected namespace before writing, even when the data is damaged.
7. With an API token limited to the required account and KV permissions, use the current Wrangler `kv bulk put` command against the exact production namespace. Confirm the namespace identifier independently; never infer it from a similarly named preview namespace.
8. Validate representative customers, bookings, payments, territories and audit records before reopening writes.
9. Delete the temporary bulk file securely after the retention decision is recorded.

Cloudflare documentation: [Wrangler KV commands](https://developers.cloudflare.com/kv/reference/kv-commands/).

## Exit criteria

- Public and private core journeys pass.
- Stripe webhooks and scheduled reminders show healthy.
- Record totals reconcile with the backup manifest.
- No active session or one-time login record was restored.
- The incident, rollback/restore operator, deployment, checksum and validation evidence are recorded.
