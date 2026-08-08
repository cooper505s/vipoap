# VIPOAP OS — Zoho integration foundation

VIPOAP OS keeps its own customer, membership, visit and invoice records as the operational source. Every customer or invoice change creates a pending Zoho queue item so changes are not lost while Zoho is disconnected.

## Planned mapping

| VIPOAP OS | Zoho destination |
|---|---|
| Customer name, telephone, email, address and postcode | CRM Contact and Books Contact |
| Territory and operator IDs | CRM territory/operator custom fields |
| Membership plan, status, renewal and visit balance | CRM membership custom fields |
| Equipment and upgrade recommendations | CRM related list or custom module |
| Invoice number, dates, lines, amount and status | Zoho Books Invoice |
| Call-out reference and notes | CRM activity linked to the contact |

## Production secrets required

The Cloudflare production environment will eventually require `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` and `ZOHO_ORGANISATION_ID`. These must remain Cloudflare secrets and must never be committed to GitHub.

Until those secrets are authorised, VIPOAP OS reports Zoho as ready for connection, retains its pending queue and provides CSV exports for customers, equipment, call-outs and invoices.

## Safe activation sequence

1. Create a dedicated Zoho OAuth client for VIPOAP OS.
2. Confirm CRM and Books field mappings in a sandbox or test organisation.
3. Add the credentials as Cloudflare production secrets.
4. Run a dry sync for one test customer and invoice.
5. Compare both systems before enabling queued background synchronisation.
6. Retain export and reconciliation reports as a recovery route.
