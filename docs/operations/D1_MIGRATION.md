# VIPOAP D1 migration runbook

VIPOAP’s structured production records move from KV to D1 in controlled, reversible stages. KV remains appropriate for sessions, rate limits, short-lived private links, configuration and caches.

## Production binding

Create the production database as `vipoap-production` and bind it to the Pages project as `VIPOAP_DB` under **Workers & Pages → VIPOAP → Settings → Bindings → Add → D1 database**. Redeploy after adding the binding. Keep the dashboard as configuration source until the current configuration has first been downloaded with `wrangler pages download config`; do not introduce a hand-written Wrangler file that could replace live bindings.

## Migration gate

1. Run `npm run validate:d1` locally. This executes every migration against an empty SQLite database and verifies all required tables and foreign keys.
2. Create a D1 backup or confirm Time Travel coverage before a production migration.
3. List unapplied migrations with `wrangler d1 migrations list vipoap-production --remote`.
4. Apply with `wrangler d1 migrations apply vipoap-production --remote`.
5. Verify the `d1_migrations` table and the application health endpoint before enabling any D1 read path.

## Data cutover

Cut over one aggregate at a time: dual-write, reconcile counts and money totals, enable D1 reads behind an operational flag, observe, then retire the corresponding durable KV records. Sessions, tokens and rate limits remain in KV. Never switch financial or safeguarding reads until reconciliation is exact.

## Recovery

Disable the D1 read flag first so the application returns to the established KV path. Preserve both stores, record the incident, and restore D1 through Time Travel or the pre-migration backup only after identifying the faulty migration. Never delete the KV source during the observation window.
