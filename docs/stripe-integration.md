# Stripe payments, subscriptions and Engineer payouts

VIPOAP uses Stripe as its payment platform. Customer card details and Engineer bank details never pass through VIPOAP storage.

## Customer payment experience

- Embedded Stripe Checkout is used when `STRIPE_PUBLISHABLE_KEY` is configured, keeping the secure payment form inside VIPOAP.
- The existing Stripe-hosted Checkout redirect remains a safe fallback until the publishable key is added.
- One-time Checkout collects booking payments in advance.
- Stripe Billing collects the VIPOAP Support subscription at £7.99 per month using a Stripe Price ID.
- Refund events create separate, auditable refund-ledger entries.

## Engineer payouts

- Every Engineer has an individual Stripe Connect account linked to their VIPOAP OS operator record.
- Stripe collects identity and bank details through its onboarding flow.
- The Billing dashboard shows the completed jobs and entitlement making up every outstanding balance.
- A Stripe transfer is available only after Connect reports payouts as enabled.
- The admin must confirm the exact job reference before a transfer is created. The job stores the Stripe transfer ID to prevent duplicate payouts.

## Required Cloudflare secrets and variables

- `STRIPE_SECRET_KEY`: Stripe live secret used only by server-side functions.
- `STRIPE_PUBLISHABLE_KEY`: publishable key used to initialise embedded Checkout.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the production webhook.
- `STRIPE_CONNECT_WEBHOOK_SECRET`: signing secret for connected-account events when Stripe supplies a separate endpoint secret.
- `STRIPE_SUPPORT_MONTHLY_PRICE_ID`: recurring Stripe Price for VIPOAP Support at £7.99/month.

## Webhook endpoint

Configure Stripe to send these events to `https://vipoap.co.uk/api/payments/webhook`:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `account.updated` for connected accounts

The endpoint verifies the raw request body with the `Stripe-Signature` header, rejects stale signatures and deduplicates every event ID. Subscription events update the customer membership status and period. Connect events update Engineer onboarding and payout readiness.

## Zoho Books

Zoho Books can connect to Stripe for customer collections, recurring payments and bank-feed reconciliation. VIPOAP remains the operational source for jobs and Engineer entitlements. Stripe Connect transfers should be posted to Zoho as Engineer bills/expenses and reconciled through a Stripe clearing account; they must not be inferred only from the net Stripe bank deposit.

## Safe activation order

1. Create the £7.99 monthly product and Price in Stripe.
2. Add the Stripe values above to Cloudflare production settings.
3. Configure the listed webhook events, including connected-account events.
4. Complete one test Engineer Connect onboarding.
5. Test one subscription and one booking payment in Stripe test mode.
6. Test a refund and a small Engineer transfer in test mode.
7. Compare the customer payment, Stripe fees, Engineer liability and net settlement against Zoho before enabling live transfers.
