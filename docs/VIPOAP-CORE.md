# VIPOAP Core

VIPOAP Core is the shared platform behind the public website, installable app, booking system, helpdesk, scam checker and future customer portal.

## Product principles

1. **Plain English first** — customers should never need technical vocabulary.
2. **Designed for older users** — large controls, strong contrast, clear next steps and forgiving forms.
3. **Human support remains central** — AI assists Dan; it does not replace judgement.
4. **Privacy by design** — collect the minimum information needed and define retention periods.
5. **One customer history** — bookings, support tickets, scam checks and future device records should use one customer identity.
6. **Modular delivery** — each module can launch independently without rebuilding the whole site.

## Platform modules

### Public website
- Reassurance-led homepage
- Problem-led service pages
- Better Wi-Fi guidance
- Advice and scam awareness
- Peace of Mind Plan
- About Dan and contact
- Prominent links to the VIPOAP app

### Installable app
- Book a visit
- Contact VIPOAP
- Simple help guides
- Scam checker
- Appointment information
- Offline app shell

### Booking
- 30-minute and 1-hour appointments
- Availability controlled by admin
- Current default availability:
  - Monday 19:00–21:00
  - Wednesday 19:00–21:00
  - Saturday 11:00–13:00 and 16:00–19:00
- Blocked dates and one-off availability
- Duplicate-slot prevention
- Email confirmation

### Helpdesk
Customer side:
- Submit a request without creating an account
- Receive a ticket reference
- View status using a secure link
- Reply through the website or email

Admin side:
- View open, waiting and closed tickets
- Add private notes and customer replies
- Change priority and status
- Search customers and ticket references
- Convert a ticket to a booking

### Scam checker
- Paste suspicious text
- Describe a call
- Later: upload one screenshot
- Return a simple traffic-light assessment
- Explain warning signs in plain English
- Never guarantee that something is safe
- Offer human review by creating a helpdesk ticket

### Customer portal — later phase
- Upcoming and previous visits
- Support tickets
- Scam checks
- Device register
- Membership status
- Invoices and payments
- Advice library

### Business dashboard — later phase
- Today’s bookings
- Open tickets
- Scam checks awaiting review
- Availability and calendar
- Customer history
- Memberships and payments
- Reporting

## Technical direction

### Hosting
- Cloudflare Pages for the static website and app
- Cloudflare Pages Functions for API endpoints

### Data
Use Cloudflare D1 for structured records once the helpdesk begins. KV remains suitable for lightweight configuration and caching.

Proposed D1 tables:
- `customers`
- `bookings`
- `availability_rules`
- `blocked_dates`
- `tickets`
- `ticket_messages`
- `scam_checks`
- `admin_users`
- `audit_log`

### Email
- Resend for transactional messages
- Incoming email replies can be added later through an inbound email provider or webhook

### AI
- Server-side API calls only
- No API keys in browser code
- Structured JSON responses
- Rate limits and usage caps
- Clear disclaimer and human escalation

### Authentication
First release:
- Password-protected admin area
- Secure HttpOnly session cookie
- Rate limiting and login throttling

Later:
- Customer magic links
- Optional family-member access
- Multi-factor authentication for admins

## Security requirements

- Validate all server-side inputs
- Restrict uploads by file type and size
- Escape all customer-supplied content
- Use CSRF protection on admin actions
- Apply rate limits to public forms and AI checks
- Record admin actions in an audit log
- Never store passwords, banking details or unnecessary sensitive data
- Define automatic deletion periods for scam screenshots and inactive tickets
- Back up D1 data before major migrations

## Delivery plan

### Phase 1 — Website polish
- Full content and layout review
- Standardised design system
- Problem-led messaging
- Dedicated app page
- Consistent calls to action

### Phase 2 — Core helpdesk MVP
- D1 schema
- Customer support form
- Ticket references and secure status links
- Admin ticket list and ticket view
- Reply and status controls
- Email notifications

### Phase 3 — Scam checker MVP
- Text-only assessment
- Traffic-light result
- Warning-sign explanation
- Human escalation into helpdesk
- Rate limiting and usage logging

### Phase 4 — Booking integration
- Move bookings to the shared customer and admin data model
- Calendar view
- Convert tickets into bookings
- Confirmation and reminder emails

### Phase 5 — Customer portal
- Magic-link access
- Booking and ticket history
- Scam-check history
- Device register
- Membership information

### Phase 6 — Business platform
- Dashboard and reporting
- Google Calendar integration
- Optional Zoho CRM integration
- Payments and memberships
- Automated reminders

## Definition of success

VIPOAP Core succeeds when an older customer can understand what to do without assistance, while Dan can manage bookings, support and scam enquiries from one calm, simple system.
