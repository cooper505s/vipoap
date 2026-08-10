# Stripe integration

VIPOAP uses Stripe-hosted Checkout for online service payments. Card details never pass through VIPOAP forms or storage.

## Required Cloudflare secrets

- `STRIPE_SECRET_KEY`: Stripe restricted/live secret used to create Checkout Sessions.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the production webhook endpoint.

## Webhook endpoint

Configure Stripe to send these events to:

`https://vipoap.co.uk/api/payments/webhook`

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

The endpoint verifies the raw request body using the `Stripe-Signature` header, rejects stale signatures and deduplicates every event ID.

## Checkout behaviour

- One idempotent Checkout Session per booking reference.
- Booking remains `slot-held` until successful payment.
- Successful Checkout moves payment to `prepaid` and booking to `requested` for Engineer assignment.
- Failed or expired Checkout leaves an auditable failed state.
- Refunds update the original payment and create a separate refund-ledger entry.
- Stripe receipt email is sent to the verified booking email.

Membership subscriptions will use Stripe Billing price IDs configured separately from one-time service Checkout.
