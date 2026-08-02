# VIPOAP Core Data Model

## Central concept

VIPOAP Core is organised around the **Household**. People, devices, visits, support and communications connect to one household history.

## Core entities

### Household

Represents one supported home.

Suggested fields:

- id
- display_name
- address
- postcode
- service_area
- preferred_contact_method
- technology_score
- membership_status
- created_at
- updated_at

### Person

A resident, member or trusted contact.

Suggested fields:

- id
- household_id
- first_name
- last_name
- email
- telephone
- relationship_to_household
- role
- communication_preferences
- accessibility_preferences
- consent_status

### Device

A piece of technology connected with the household.

Suggested fields:

- id
- household_id
- device_type
- manufacturer
- model
- serial_number
- room
- purchase_date
- warranty_end_date
- support_notes
- status

Passwords and secret credentials must not be stored in ordinary device records.

### Broadband and Wi-Fi profile

Records the household connection and network equipment.

Suggested fields:

- provider
- package_name
- advertised_speed
- router_model
- mesh_system
- installation_location
- known_coverage_notes
- last_reviewed_at

### Booking

Represents a requested or confirmed appointment.

Suggested fields:

- id
- household_id
- requested_by_person_id
- service_type
- appointment_start
- duration_minutes
- status
- address_snapshot
- notes
- created_at

### Visit

Represents work carried out for a household.

Suggested fields:

- id
- booking_id
- household_id
- adviser_id
- started_at
- completed_at
- summary
- recommendations
- follow_up_date
- technology_score_after

### Help request

The customer-facing alternative to a traditional support ticket.

Suggested fields:

- id
- household_id
- created_by_person_id
- subject
- description
- priority
- status
- assigned_to
- linked_booking_id
- created_at
- closed_at

### Help-request message

Stores the conversation without replacing the original request.

Suggested fields:

- id
- help_request_id
- author_type
- author_id
- message
- is_internal_note
- created_at

### Scam check

Suggested fields:

- id
- household_id
- submitted_by_person_id
- source_type
- submitted_text
- attachment_reference
- risk_level
- explanation
- recommended_actions
- human_review_status
- linked_help_request_id
- created_at
- deletion_due_at

### Home Health Check

Suggested fields:

- id
- household_id
- completed_by
- completed_at
- wifi_score
- security_score
- backup_score
- device_score
- scam_awareness_score
- overall_score
- recommendations
- next_review_due

### Timeline event

Provides a readable household history.

Suggested fields:

- id
- household_id
- event_type
- related_entity_type
- related_entity_id
- title
- summary
- happened_at
- visibility

### Audit event

Records security-relevant administrative activity.

Suggested fields:

- id
- actor_id
- action
- target_type
- target_id
- timestamp
- metadata

## Data rules

- Use stable unique identifiers.
- Preserve important history rather than overwriting it.
- Separate internal notes from member-visible information.
- Record consent and access relationships explicitly.
- Avoid duplicating contact details unless a historical snapshot is required.
- Define deletion and anonymisation rules for each entity.
- Use UK date, time and address conventions in customer-facing views.

## Initial storage approach

For the first production release, Cloudflare D1 is the preferred relational store. KV should be limited to configuration, caching and short-lived state rather than becoming the primary customer database.
