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
| Support/Family plan, billing cycle, renewal and utilisation | Books recurring invoice/subscription mapping and CRM membership fields |
| Service/card/cash payment and provider reference | Books Customer Payment |
| VIPOAP Credit issue, redemption and reversal | Books credit note/clearing-account mapping |
| Refund and chargeback | Books refund/credit note and reconciliation record |
| Customer-funded equipment money | Books restricted equipment-funds clearing account |
| Engineer earnings, cash offsets and weekly settlements | Books bills/expenses, clearing account and payout reconciliation |

## Current membership products

- VIPOAP Support: £7.99 monthly or £79 annually.
- VIPOAP Family: £12.99 monthly or £129 annually.

These product identifiers and prices are centrally controlled. Old `essential` and `complete` records are migrated to `support` and `family` when edited.

## Export and automation coverage

The admin billing area provides reconciliation CSVs for customers, invoices, memberships, payments, credits, refunds, equipment funds and Engineer Partner settlements. Customer, invoice, call-out, referral and credit changes also create durable Zoho queue entries. This means the export route remains available if Zoho is unavailable and the same records can later be processed automatically by a scheduled Cloudflare integration worker.

Automatic processing must be idempotent, store the Zoho record/reference returned for each entity, retry transient failures, surface permanent failures in the Admin Control Centre and never delete the VIPOAP source record after synchronisation.

## Production secrets required

The Cloudflare production environment will eventually require `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` and `ZOHO_ORGANISATION_ID`. These must remain Cloudflare secrets and must never be committed to GitHub.

Until those secrets are authorised, VIPOAP OS reports Zoho as ready for connection, retains its pending queue and provides the complete reconciliation exports described above.

## Safe activation sequence

1. Create a dedicated Zoho OAuth client for VIPOAP OS.
2. Confirm CRM and Books field mappings in a sandbox or test organisation.
3. Add the credentials as Cloudflare production secrets.
4. Run a dry sync for one test customer and invoice.
5. Compare both systems before enabling queued background synchronisation.
6. Retain export and reconciliation reports as a recovery route.
