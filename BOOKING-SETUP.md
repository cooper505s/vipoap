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
