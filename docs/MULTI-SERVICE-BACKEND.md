# VIPOAP multi-service backend foundation

## Decision

VIPOAP remains **Technology-only at launch**. The backend is being made category-neutral so additional home-service categories can be introduced later without rebuilding bookings, provider profiles, coverage, pricing, payments, reviews or reporting.

No future trade category should be made customer-visible until it has its own commercial, insurance, credential, safeguarding and regulatory review.

## Terminology

Existing code and tables use `operator` and `Engineer Partner`. These remain supported for compatibility during the Technology launch.

New backend concepts use **provider** as the generic term. A provider may later be approved for one or more services/categories. We should migrate customer-facing Technology wording separately rather than performing a risky global rename.

## Core entities

### service_categories
Top-level service family. Only `technology` is seeded and active.

### services
Bookable capabilities within a category. Services carry fulfilment modes and duration constraints rather than hard-coding these into the UI.

### provider_services
Approval junction between a provider and a service. This is where future category-specific credentials can be represented without adding columns for every trade.

### provider_service_areas
Postcode/service coverage per provider. Coverage can differ by service and fulfilment type.

### pricing_rules
Category/service/territory-specific pricing. Supports fixed, time-block, hourly and quote models. Customer price and provider entitlement are stored separately so VIPOAP's fee is explicit.

### booking_assignments
Tracks job offers and provider responses independently of the booking itself. This supports fair allocation, decline/expiry history and future multi-provider offer strategies.

### marketplace_transactions
Financial ledger for the marketplace split. Stores gross customer payment, provider entitlement, VIPOAP gross fee, VAT attributable to VIPOAP's fee, processing costs, refunds and settlement state.

This table is deliberately independent from the payment processor. Stripe IDs are recorded, but Stripe is infrastructure rather than the accounting source of truth.

## Stripe Connect direction

The schema is Connect-ready but the current payment flow remains unchanged until the legal/accounting marketplace structure is confirmed.

Provider records can hold:

- Stripe connected account ID
- onboarding status
- charges enabled
- payouts enabled

When Connect is enabled, the implementation should calculate the commercial split from the selected pricing rule and persist a marketplace transaction before/alongside payment creation.

Do not infer tax treatment merely from the Stripe transfer configuration. Contractual supplier/agent status, invoices, terms and actual operating behaviour must remain aligned with the approved legal/accounting model.

## Technology launch pricing

Pricing must move out of hard-coded booking handlers into `pricing_rules` before Connect goes live. This lets VIPOAP test prices without deployments and lets future categories use different commercial models.

The currently discussed £39 first 30 minutes + £25 per additional 30 minutes model is a commercial proposal, not seeded by this migration, because existing live booking pages currently use different prices. Change customer pricing only as a coordinated frontend/backend release.

## Booking evolution

Existing bookings remain compatible. New columns allow each booking to reference:

- category
- service
- assigned provider
- pricing rule
- provider entitlement
- platform fee

The legacy text `service` and `operator_id` fields remain during migration.

Recommended implementation sequence:

1. Deploy schema migration.
2. Add a read-only service catalog API returning only `active` categories/services.
3. Map existing Technology booking labels to service IDs.
4. Add pricing-rule resolver and persist price breakdown on new bookings.
5. Move availability matching from generic operator service types to provider-service + coverage matching.
6. Add assignment offer/accept workflow.
7. Complete accountant/solicitor review of marketplace/agency model.
8. Enable Stripe Connect onboarding and marketplace settlement.
9. Add provider earnings/transaction statements.
10. Only then prepare any additional service category behind `disabled`/`internal` status.

## Rules for future categories

A future category should be data/configuration first, not a new set of bespoke booking tables.

Each category may define:

- its services
- fulfilment modes
- pricing rules
- provider credentials
- service areas
- insurance requirements
- booking questions through metadata/configuration

Regulated work must never be enabled merely by adding a category row. Category launch requires explicit validation and provider credential rules.
