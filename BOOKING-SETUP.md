# VIPOAP booking app setup

The customer app is available at `/app/` and the availability editor is at `/app/admin.html`.

## Cloudflare Pages configuration

Create a Workers KV namespace and bind it to the Pages project as:

- `VIPOAP_DATA`

Add these encrypted environment variables:

- `ADMIN_PASSWORD` — password used by `/app/admin.html`
- `RESEND_API_KEY` — API key used to send booking emails
- `BOOKING_FROM_EMAIL` — for example `VIPOAP Bookings <bookings@vipoap.co.uk>`

Verify `vipoap.co.uk` with Resend before using a `@vipoap.co.uk` sender.

All four settings are required in production. The booking API deliberately returns a temporary-unavailable response when the KV binding or any email setting is absent, rather than accepting a booking that cannot be retained or delivered.

Before adding a `wrangler.jsonc` file, download the live Pages configuration with `npx wrangler pages download config <PROJECT_NAME>` and review it. Once a Pages project is deployed with `pages_build_output_dir` in a Wrangler file, that file becomes the source of truth and can replace dashboard-managed settings.

## Default availability

- Monday: 19:00–21:00
- Wednesday: 19:00–21:00
- Saturday: 11:00–13:00 and 16:00–19:00
- Appointment lengths: 30 or 60 minutes

The admin page can replace these hours and add blocked dates. Example settings:

```json
{
  "weekly": {
    "monday": [["19:00", "21:00"]],
    "wednesday": [["19:00", "21:00"]],
    "saturday": [["11:00", "13:00"], ["16:00", "19:00"]]
  },
  "blockedDates": ["2026-12-25"]
}
```

## Booking delivery

Bookings are stored in KV to prevent the same start time being booked twice. A booking email is sent to `help@vipoap.co.uk` through Resend. If email delivery fails, the slot reservation is removed and the customer is asked to try again or call 07977 254158.

KV is eventually consistent and does not provide an atomic create-if-absent operation. It is acceptable for an initial low-volume pilot, but it cannot guarantee prevention of simultaneous bookings from different locations. Move booking records and slot reservation to D1, or coordinate writes through a Durable Object, before increasing traffic or opening additional territories.
