# VIPOAP multi-service backend foundation

## Decision

VIPOAP remains **Technology-only at launch**. The backend is category-neutral so additional home-service categories can be introduced later without rebuilding bookings, provider profiles, coverage, pricing, payments, reviews or reporting.

No future trade category should be made customer-visible until it has its own commercial, insurance, credential, safeguarding and regulatory review.

## Terminology

Existing code and tables use `operator` and `Engineer Partner`. These remain supported for compatibility during the Technology launch.

New backend concepts use **provider** as the generic term. A provider may later be approved for one or more services/categories. Customer-facing Technology wording can migrate separately rather than performing a risky global rename.

## Active Technology pricing

Home visits now use the marketplace launch model:

- first 30 minutes: customer £39 / provider £25 / VIPOAP gross fee £14
- 60 minutes: customer £64 / provider £45 / VIPOAP gross fee £19
- 90 minutes: customer £89 / provider £65 / VIPOAP gross fee £24
- 120 minutes: customer £114 / provider £85 / VIPOAP gross fee £29
- each additional 30 minutes after the first block adds £25 customer price and £20 provider entitlement

Remote support remains on the existing launch prices until separately revised: £15 for 30 minutes and £25 for 60 minutes.

Customer amounts, provider entitlements and VIPOAP fees are stored independently so VAT/payment/accounting treatment can be applied to the correct supply once the final marketplace structure is signed off.

## Core entities

### service_categories
Top-level service family. Only `technology` is active.

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

The schema is Connect-ready but Connect settlement is not yet enabled.

Provider records can hold:

- Stripe connected account ID
- onboarding status
- charges enabled
- payouts enabled

When Connect is enabled, the implementation should calculate the commercial split from the selected pricing rule and persist a marketplace transaction before/alongside payment creation.

Do not infer tax treatment merely from the Stripe transfer configuration. Contractual supplier/agent status, invoices, terms and actual operating behaviour must remain aligned with the approved legal/accounting model.

## Booking evolution

Existing booking records remain readable. New bookings also reference/store:

- category ID
- service ID
- assigned provider ID
- pricing rule ID
- customer amount
- provider entitlement
- platform fee

The legacy text `service` and `operatorId` fields remain during migration.

## Current Technology catalogue

All customer-facing booking labels map to stable services, including Wi-Fi & Broadband, Phone or Tablet Setup, Smart TV or Smart Home, Internet Safety, Printer & Scanning and General Technology Help.

Only Technology is active. Future categories must be added behind `disabled` or `internal` status first.

## Recommended implementation sequence

1. Deploy schema migrations and active pricing.
2. Use the shared service catalogue throughout the public booking UI.
3. Move availability matching fully onto provider-service + coverage records.
4. Add assignment offer/accept/decline/expiry workflow.
5. Complete accountant/solicitor review of marketplace/agency model.
6. Enable Stripe Connect onboarding and marketplace settlement.
7. Add provider earnings/transaction statements.
8. Only then prepare any additional service category behind `disabled`/`internal` status.

## Rules for future categories

A future category should be data/configuration first, not a new set of bespoke booking tables.

Each category may define its services, fulfilment modes, pricing rules, provider credentials, service areas, insurance requirements and booking questions through metadata/configuration.

Regulated work must never be enabled merely by adding a category row. Category launch requires explicit validation and provider credential rules.
