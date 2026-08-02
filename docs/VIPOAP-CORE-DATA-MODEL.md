# VIPOAP Core data model

This is the proposed first shared data model for bookings, helpdesk tickets and scam checks.

## customers

- `id` — UUID
- `name`
- `email`
- `telephone`
- `postcode`
- `created_at`
- `updated_at`

Customers should be matched carefully by verified email or telephone rather than by name alone.

## bookings

- `id` — UUID
- `reference` — customer-friendly reference
- `customer_id`
- `service`
- `start_at`
- `duration_minutes` — 30 or 60
- `status` — requested, confirmed, completed, cancelled
- `notes`
- `source` — website, app, admin, ticket
- `created_at`
- `updated_at`

## availability_rules

- `id`
- `day_of_week` — 0 to 6
- `start_time`
- `end_time`
- `enabled`

## blocked_dates

- `id`
- `date`
- `reason`
- `created_at`

## tickets

- `id` — UUID
- `reference`
- `customer_id`
- `subject`
- `category` — general, wifi, device, scam, booking, membership
- `status` — open, waiting_customer, waiting_admin, closed
- `priority` — low, normal, high, urgent
- `booking_id` — optional
- `secure_token_hash` — for customer status links
- `created_at`
- `updated_at`
- `closed_at`

## ticket_messages

- `id`
- `ticket_id`
- `sender_type` — customer, admin, system
- `body`
- `is_private_note`
- `created_at`

## scam_checks

- `id`
- `reference`
- `customer_id` — optional for anonymous first check
- `ticket_id` — optional escalation
- `source_type` — email, text, whatsapp, phone, website, parcel, bank, other
- `submitted_text`
- `risk_level` — low, caution, high, unknown
- `confidence` — optional internal score
- `warning_signs_json`
- `safe_steps_json`
- `model_name`
- `created_at`
- `expires_at`

## admin_users

- `id`
- `email`
- `password_hash`
- `role`
- `active`
- `last_login_at`
- `created_at`

## audit_log

- `id`
- `admin_user_id`
- `action`
- `entity_type`
- `entity_id`
- `details_json`
- `created_at`

## Data retention starting point

- Booking records: retain for normal business and accounting requirements.
- Closed support tickets: review after 24 months.
- Scam-check text: delete or anonymise after 90 days unless escalated into a support ticket.
- Uploaded scam screenshots: delete after 30 days unless the customer explicitly asks for ongoing support.
- Audit records: retain for at least 12 months.

These periods are an initial product decision and should be checked against the final privacy policy and legal requirements before launch.
