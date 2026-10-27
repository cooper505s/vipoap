# VIPOAP 2.0 — Staged Build Plan for Codex and Claude Code

**Status:** Draft implementation plan for owner approval · **Date:** 27 October 2026  
**Source of truth:** [VIPOAP 2.0 Master Specification](./VIPOAP-2-MASTER-SPEC.md) · **Repository base:** `main` after the audit/reconciliation gate.

> This is a planning document, not permission to alter production. The existing `development` branch diverges from `main`. The plan does not assert any feature has been built, tested or deployed. Scope, timescales and costs require an actual repository and environment audit.

## 1. Operating model: both coding assistants build software

- **Owner (Managing Director):** chooses priorities, approves scope, pricing, spending, risk decisions and production releases.
- **Codex:** a **full implementation contributor**. It can build frontend, backend, integrations, tests, migrations and documentation on bounded tasks, not merely audit or review Claude's work.
- **Claude Code:** an **equally valid implementation contributor** across frontend, backend, integrations, tests, migrations and documentation.
- **Lead/assignee per issue:** determined by availability, suitable context and code ownership rather than a permanent model-specific division. An illustrative division below is not exclusive.
- **Independent reviewer:** another coding assistant may review the PR, but automated reviews do not replace required human approval for finance/security/privacy or production deployment.
- **Coordination:** GitHub issues and PRs are the shared record. Neither conversational assistant is assumed to be monitoring the other's sessions automatically; handoffs require explicit commits, issue updates and PR links or a separately approved orchestrator.

### Rules for parallel development
1. Audit `main` and the live configuration before modifying architecture. Reconcile `development` without blindly merging either direction.
2. Create **one tracked GitHub issue per small deliverable** with user journey, impacted files/APIs, acceptance criteria, security/privacy concerns and tests.
3. Both assistants branch from the **same approved integration base**; each task has **one active file owner**. Separate concerns, not simply screens, to prevent concurrent edits to migrations, auth, route registration or shared schemas.
4. Agree interface contracts (types, endpoints, schema migrations, events) before dependent frontend/backend changes. Use mocks or fixtures while counterpart tasks are in progress.
5. Open focused PRs with proof of tests, screenshots for UI changes, migration/rollback plans and compatibility notes; use cross-review when helpful.
6. Protect `main`, run automated checks, resolve conflicts on the task branch and merge sequentially. No silent AI commits to production; no unapproved auto-merge or deployment.
7. Each stage ends with a **human acceptance gate**. Backlog may be reprioritised based on real customer and engineer feedback.

## 2. Build order — prioritise the first paid, successfully fulfilled booking

| Stage | Main outcome | Example Codex work | Example Claude Code work | Exit / acceptance gate |
| --- | --- | --- | --- | --- |
| **0. Audit and architecture** | Know what exists and what's safe to reuse | Read-only audit of APIs, booking concurrency, payments, auth, DB/KV/D1, tests | Read-only audit of customer/engineer/admin pages, accessibility, training and journey gaps | Owner approves reuse/refactor/replace register, risks, shared data authority, branch policy and MVP tickets |
| **1. Common foundations** | Reliable identities, bookings, events and observability | Implement agreed transactional booking and payment foundations, authorisation, core APIs and test harness | Build shared design components, role-aware navigation, UI shell and API-contract fixtures | Auth/permissions, money flows, slot contention, duplicate events, logging, backups and rollback demonstrated |
| **2. First paid service (MVP)** | One locality can market, book, allocate, perform and settle genuine jobs | Engineer eligibility and **fair rotating timed offers** with atomic assignment; payment/settlement tests | Public site, **AI-first Get Help with prominent direct booking**, guest booking, engineer My Work job flow | Test customer can see price, book without membership, get honest pending/confirmed status, receive service, see receipt; engineer can accept, close and be paid; human support fallback |
| **3. Membership and family** | Convert first-time customers into subscribers | Membership entitlements, Stripe subscription events, family consent/granular permissions, invoice reconciliation | Accessible My Home dashboard, membership comparison, onboarding, two-household family management | Pay As You Go remains available; Support £7.99, Family £12.99, Complete £24.99 are configurable *proposed* launch rates; Family up to three named people across two households; pricing and entitlements approved against costs |
| **4. Household tech care and follow-up** | Offer recurring value outside a repair visit | Tech Passport records, warranty/renewal jobs, secure uploads, recommendation catalog/pricing/versioning and communication controls | My Technology and My Appointments, easy-to-read **Recommended for Your Home** message/page, no-pressure booking and preference controls | Engineer can suggest mesh Wi-Fi or other approved service; lawful email/WhatsApp delivery, disclosed product/installation/total prices and booking attribution work; reminders are accurate |
| **5. AI operations and management** | Scale administration without unattended high-risk actions | Event-driven coordinator, action tiers, approvals, limits, audit/event log, dashboards, failure recovery and evaluation tests | HQ console, Customer Support/Dispatch/Partner Network interfaces, role scorecards and owner briefings | Operations Manager directs routine specialist workflows; spending, pricing, serious incidents, partner approval/suspension and production releases remain controlled by humans |
| **6. Pilot learning and expansion** | Repeatably acquire and serve customers in more postcodes | Performance, security, monitoring, deployment hardening, app/offline feasibility, scalable integrations | Engineer/customer mobile refinements, marketing and onboarding optimisation, learning content | Pilot unit economics, customer satisfaction, acceptance/fill rates, partner retention and service quality meet owner-set thresholds before wider launch |

*Illustrative assignment: Codex and Claude Code may swap or share a stage through **non-overlapping** issues. No time estimate is defensible until Stage 0 completes.*

## 3. Requirements carried from owner discussions

### Customer journey
- Homepage message: **“Your home technology, taken care of.”** Distinct **Get Help Now** and **Explore Memberships** routes.
- **AI support first** for the Get Help journey, with a conspicuous bypass to human/engineer booking; AI must not block urgent or ordinary bookings or imply a human is available until confirmed.
- Four-step booking concept: problem → postcode → available remote/home options and clear prices → contact/confirmation.
- **Guest/pay-as-you-go bookings**, with no subscription or pre-booking account password required. Provision a minimum-necessary customer record securely and invite account activation after booking.
- After successful work, invite membership; no pressured upgrades.
- Customer portal prioritises Get Help, My Technology, My Appointments, My Household and My Membership; accessible writing and mobile-first layout.
- Draft subscription options: free Pay As You Go; £7.99 Support; £12.99 Family for **up to three named people across two households**; £24.99 Complete with **four half-hour human remote sessions per year**, proposed quarterly entitlement release. Home visits are chargeable on all plans. Final allowances and profitability require finance/commercial approval.

### Engineer journey
- Part-time flexible engineer network for occasional extra income, with partner approval, appropriate checks/insurance, training, skills, postcode radius, availability and opt-in to remote vs in-home work. Do not guarantee jobs.
- **Fair rotating offers with timed escalation**: choose only available, suitably skilled, approved engineers; balance recent opportunities considering declared availability; offer to one eligible engineer at a time, proposed pilot 5-minute response window, then cascade; transactional single-winner assignment. Use urgent-job fallback and fully auditable manual overrides. See master spec §14.
- Engineer My Work supports accept/decline, travel/arrival, notes, consent, extra-time approvals, closeout, ratings, incident reporting, earnings and weekly settlement workflow.
- **Recommended for Your Home**: engineer chooses zero/multiple approved products/services, explains why, and with proper communication permission sends transparent, non-pressured follow-up with product, installation and full price and an optional booking link. See master spec §13.

### AI management
- Owner is Managing Director; bounded **AI Operations Manager** coordinates **15 responsibility areas** arranged into Customer Experience & Growth, Engineer Operations, Finance & Business Performance, and Technology/Security/Governance.
- Operations AI may instruct specialist workflows and resolve routine issues **only within explicit permissions, tested limits and audit logs**. Spending, pricing/policy changes, safeguarding/security incidents and production deployments need designated human decisions.
- Start with a small number of high-value agents and deterministic automation; do not launch 15 continuously running LLM processes.

## 4. Immediate proposed GitHub issue breakdown (create after owner review)

1. **AUDIT-01** — Record deployed Cloudflare bindings, KV/D1 read/write authority, schema migrations and baseline tests (read-only).
2. **AUDIT-02** — Check booking slot concurrency, Stripe events, refunds, idempotency and weekly engineer settlements (read-only).
3. **AUDIT-03** — Inspect frontend journeys, auth/roles, privacy, accessibility and training; document reusable screens.
4. **ARCH-01** — Reconcile `development` vs `main`, define approved implementation base and CI/PR protections.
5. **ARCH-02** — Agree household/guest-booking identity, partner skills/availability, booking-state and payment/ledger API contracts.
6. **UX-01** — Accessible homepage, Get Help, My Home, My Work, HQ wireframes and acceptance scenarios.
7. **BOOK-01** — Atomic slot reservation and event retry handling with concurrency tests.
8. **DISPATCH-01** — Fair timed engineer offer rotation with deterministic test cases.
9. **WEB-01** — Guest booking, AI-first guidance with bypass and transparent prices.
10. **PARTNER-01** — Engineer registration, approval, availability and first job closeout.
11. **FIN-01** — Settlement ledger, cancellation/no-show policy, payment reconciliation, receipts and exceptions.
12. **MEMBER-01** — Subscription plans, permissions for three people/two households, family delegated access.
13. **HOME-01** — Tech Passport, warranty/reminder rules and secure customer file storage.
14. **RECOMMEND-01** — Versioned recommendations, opt-in message workflows, item/installation prices and bookings.
15. **OPS-01** — AI approvals/audit, executive briefings, agent metrics and safe action controls.

For each issue the owner/tech lead picks Codex or Claude Code as builder; the other can review when independent review is useful. Don't assign both to the same writable files or schema migration.

## 5. Release gates, evidence and decisions

**Definition of done for every PR:** specified acceptance tests pass; public/private data boundaries checked; accessibility and mobile states verified as applicable; negative/error/cancellation paths covered; telemetry available; no secrets in repo; updated docs; reviewed by appropriate human for risky changes.

**Before first paying customer:** Stripe merchant/settlement responsibilities and actual pricing approved; customer terms/privacy/cancellation routes checked; partner checks, customer/engineer support, missed booking and incident escalation available; security, concurrency, backups, refunds and real end-to-end payment test passed.

**Pilot measurements (no invented targets):** paid bookings, fulfilment rate, first-response time, engineer-offer fairness, cancellation/no-show rate, customer satisfaction, first-time-to-member conversion, cost to acquire a booking/member, contribution after engineer/payment costs, and human admin minutes per job. Owner sets go/no-go thresholds after the first pilot.

**Do not infer build completion** from this specification or GitHub issue/PR creation. No coding assistants are automatically running in the background. Begin implementation only with an approved, bounded task and correct tool/session permissions.

## 6. Next executable sequence

1. Owner reviews this plan and confirms **MVP = paid booking + engineer fulfilment in one pilot area**, before most AI sophistication.
2. Assign the three read-only audit issues in parallel to Codex and Claude Code with **non-overlapping scopes**, and combine findings into one risk/architecture register.
3. Resolve the branch and data/finance authority decisions.
4. Create small implementable tickets and explicit API contracts for Stage 1.
5. Build, test and approve each gated stage; keep production unchanged until a distinct release authorisation.
