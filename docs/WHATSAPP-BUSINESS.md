# VIPOAP WhatsApp Business integration

## Purpose

VIPOAP uses one communication layer for transactional customer/provider updates. Email remains supported and WhatsApp Business is a first-class channel.

Initial automated WhatsApp use cases:

- booking received
- booking confirmed
- 24-hour appointment reminder
- 3-hour appointment reminder
- provider job offer
- provider job confirmed
- additional-time approval request
- payment reminder
- referral invite
- referral reward/update
- review invite

## Customer consent

Selecting WhatsApp as the preferred booking channel displays an explicit transactional-message consent checkbox. The booking API rejects WhatsApp as the preferred channel unless consent is recorded.

Customer records store:

- `preferredContact`
- `whatsAppOptIn`
- `whatsAppOptInAt`

Do not use transactional consent as marketing consent. Promotional/marketing messaging needs its own consent and campaign rules.

## Required environment variables

Configure secrets/settings in Cloudflare rather than source control.

- `WHATSAPP_API_URL` — full Meta WhatsApp Business messages endpoint for the selected phone number/API version
- `WHATSAPP_ACCESS_TOKEN` — server-side access token
- `WHATSAPP_VERIFY_TOKEN` — private value used when registering the webhook
- `WHATSAPP_APP_SECRET` — used to validate `X-Hub-Signature-256` on webhook POSTs

Template names are configured separately so code does not depend on Meta template naming:

- `VIPOAP_WA_TEMPLATE_BOOKING_RECEIVED`
- `VIPOAP_WA_TEMPLATE_BOOKING_CONFIRMED`
- `VIPOAP_WA_TEMPLATE_BOOKING_REMINDER_24H`
- `VIPOAP_WA_TEMPLATE_BOOKING_REMINDER_3H`
- `VIPOAP_WA_TEMPLATE_PROVIDER_JOB_OFFER`
- `VIPOAP_WA_TEMPLATE_PROVIDER_JOB_CONFIRMED`
- `VIPOAP_WA_TEMPLATE_ADDITIONAL_TIME_REQUEST`
- `VIPOAP_WA_TEMPLATE_PAYMENT_REMINDER`
- `VIPOAP_WA_TEMPLATE_REFERRAL_INVITE`
- `VIPOAP_WA_TEMPLATE_REFERRAL_REWARD`
- `VIPOAP_WA_TEMPLATE_REVIEW_INVITE`

Use `en_GB` templates unless a future customer language preference requires another approved language.

## Webhook

Register this public HTTPS endpoint with the WhatsApp Business app:

`/api/webhooks/whatsapp`

GET handles Meta webhook verification using `WHATSAPP_VERIFY_TOKEN`.

POST validates the webhook signature when `WHATSAPP_APP_SECRET` is configured and records:

- sent/delivered/read/failed status callbacks
- inbound WhatsApp messages/replies

Inbound messages are stored for later routing into the VIPOAP OS communications inbox. Do not automatically execute booking/payment changes merely because an inbound WhatsApp message asks for them; route sensitive actions through authenticated/controlled workflows.

## Queue and audit trail

Transactional messages are written to `communication-queue:*` and processed by the booking-reminders scheduled worker.

Every send attempt also creates a `communication:*` record including:

- channel
- event type
- recipient
- customer/provider/booking references where available
- provider message ID
- delivery status
- template metadata

Webhook delivery/read events are retained separately under `whatsapp-event:*`.

## Template parameter order

The queue currently converts `templateData` values into WhatsApp body parameters in insertion order. When templates are approved in Meta, keep each event's application object and template parameter order aligned and cover it with tests before production use.

For example `booking_received` currently queues:

1. customer name
2. booking reference
3. date
4. time
5. service
6. price

## Email

Email remains available through Resend. Longer-form confirmations, receipts and documents can continue by email even where WhatsApp is the customer's preferred reminder channel.

Recommended operating rule:

- WhatsApp: concise timely transactional notifications and links
- Email: confirmations, receipts, detailed summaries, documents and fallback delivery

## Before switching production WhatsApp on

1. Create/verify the Meta Business/WhatsApp Business account and number.
2. Approve the transactional templates above that VIPOAP intends to use.
3. Configure API URL, access token, verify token and app secret in Cloudflare.
4. Register `/api/webhooks/whatsapp` in Meta and verify it.
5. Run test sends to approved test recipients.
6. Confirm delivered/read/failed callbacks appear in the VIPOAP data store.
7. Confirm customer consent is visible in VIPOAP OS.
8. Add operational handling for inbound messages before advertising WhatsApp as a two-way support channel.
