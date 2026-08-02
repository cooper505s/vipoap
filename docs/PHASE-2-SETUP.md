# VIPOAP Phase 2 setup

Phase 2 uses Cloudflare Pages Functions and a KV namespace for the initial no-cost booking system.

## Included

- Customer booking journey in `/app/`
- 30- and 60-minute appointments
- Default availability: Monday and Wednesday 19:00–21:00; Saturday 11:00–13:00 and 16:00–19:00
- Overlap protection for bookings of different lengths
- Email notification through Resend
- VIPOAP HQ at `/admin/`
- Booking status and admin notes
- Weekly availability editing and blocked dates

## Cloudflare bindings

Create a KV namespace named `VIPOAP_DATA` and bind it to the Pages project with the variable name:

```text
VIPOAP_DATA
```

Add these encrypted environment variables in Cloudflare Pages:

```text
ADMIN_PASSWORD=<a long unique password>
RESEND_API_KEY=<your Resend API key>
BOOKING_FROM_EMAIL=VIPOAP Bookings <bookings@vipoap.co.uk>
```

The Resend sending domain must be verified before `bookings@vipoap.co.uk` can be used. Until then, use a verified Resend sender.

## Admin security

The application requires the `ADMIN_PASSWORD` secret for all `/api/admin/*` requests. For stronger protection, also create a Cloudflare Access application covering:

```text
/admin/*
/api/admin/*
```

Allow only Dan's email address. Cloudflare Access should be treated as mandatory before production launch.

## Database migration path

`database/phase2.sql` contains the planned D1 relational schema. The first release uses KV to stay simple and free. Move booking and household records to D1 before adding multiple administrators, complex reporting or customer accounts.

## Production checks

1. Open `/app/` and request a 30-minute appointment.
2. Confirm the slot disappears from availability.
3. Request a 60-minute appointment and confirm overlapping half-hour slots disappear.
4. Confirm the booking email arrives at `help@vipoap.co.uk`.
5. Sign into `/admin/`, change the status and save an admin note.
6. Change weekly availability and block a test date.
7. Confirm the public app reflects the changes.
8. Remove the test bookings and test blocked date before launch.
