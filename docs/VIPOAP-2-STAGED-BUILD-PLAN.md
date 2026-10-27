# VIPOAP 2.0 — Codex-First Staged Build Plan (Claude Optional)

**Status:** Draft implementation plan for owner approval · **Date:** 27 October 2026  
**Source of truth:** [VIPOAP 2.0 Master Specification](./VIPOAP-2-MASTER-SPEC.md) · **Repository base:** `main` after the audit/reconciliation gate.

> This is a planning document, not permission to alter production. The existing `development` branch diverges from `main`. The plan does not assert any feature has been built, tested or deployed. Scope, timescales and costs require an actual repository and environment audit.

## 1. Operating model — Codex builds, Claude is optional

- **Owner (Managing Director):** chooses priorities, approves scope, pricing, spending, risk decisions and production releases.
- **Codex — default and primary developer:** executes the technical audit and can deliver **all stages** of frontend, backend, integrations, migrations, tests, documentation and GitHub pull requests. A task never needs Claude Code in order to begin or finish.
- **Claude Code — optional only:** if the owner chooses, request a second opinion on a tricky design, a security/payment-sensitive pull request, or a difficult defect. The owner might **never use Claude**. Do not automatically assign tasks to Claude or treat a Claude review as a release prerequisite.
- **Quality assurance:** Codex must run automated checks and document its own changes, but self-review alone is not sufficient assurance for high-risk code. Use required **human/qualified independent review** and specialised testing where warranted. That does **not** mean Claude must be involved.
- **Coordination:** GitHub issues and PRs hold the scope, evidence, decisions and progress; no assumption that separate AI sessions communicate or run in the background.

### Rules for Codex-first development
1. Audit `main` and the live configuration before changing architecture. Reconcile the diverged `development` branch carefully; never blindly merge histories.
2. Define one small, testable GitHub issue per deliverable, including the journey, APIs/files, acceptance tests, privacy/security controls and completion evidence.
3. Codex works on **short-lived branches** from the approved integration base. Avoid overlapping modifications if several Codex tasks or agents run concurrently; reserve shared migrations, authentication and core schemas to one active owner at a time.
4. Agree typed API and event contracts before dependent UI/backend work. Use fixtures/mocks to avoid blocked UI development.
5. Open focused PRs with test results, screenshots for UI changes, migration/rollback notes, and explicit human sign-off where appropriate. An optional Claude review can supplement, not replace, quality gates.
6. Protect `main`, require automated checks, merge sequentially after review, and do not auto-deploy or silently change production.
7. Each stage has a **human acceptance gate**. Prioritise proven customer value and engineer fulfilment, not feature count.

## 2. Build order — Codex owns every stage by default

| Stage | Main outcome | Codex primary deliverables | Exit / acceptance gate |
| --- | --- | --- | --- |
| **0. Audit and architecture** | Know what exists and what can safely be reused | Read-only review of Cloudflare bindings, KV/D1, auth, booking, payments, tests **and** all customer, partner and HQ pages, accessibility, training and existing flows | Owner approves reuse/refactor/replace register, risk log, data authority, branch policy and MVP tickets |
| **1. Common foundations** | Reliable identities, bookings, events and observability | Transactional booking and payment foundations; authorisation; core APIs/tests; shared design system, role navigation and UI shells | Permissions, money flows, slot contention, duplicate events, logging, backups and rollback demonstrated |
| **2. First paid service (MVP)** | One locality can take, allocate, complete and settle genuine jobs | Public site; **AI-first Get Help and direct human booking option**; guest booking; My Work job flow; approved engineer eligibility; **fair rotating timed offers** and atomic assignments; payments/settlement | Test customer sees real price, books without membership, gets accurate pending/confirmed status, receives service and receipt; engineer accepts, closes and is paid; human support fallback |
| **3. Membership and family** | Convert suitable first-time customers into subscribers | Subscription events, entitlement calculations, family consent/permissions, invoices; accessible My Home, plan comparison, onboarding and two-household management | Pay As You Go remains available; proposed Support £7.99, Family £12.99, Complete £24.99 configurable and commercially approved; Family up to three people across two households |
| **4. Household tech care and follow-up** | Offer value outside a repair visit | Home Tech Passport, warranty/renewals, secure uploads; approved recommendation catalogue, permission-based messages, **Recommended for Your Home** customer page and optional follow-up bookings | Lawful email/WhatsApp where consented; item, installation and total prices transparent; reminders accurate; booking attribution works |
| **5. AI operations and management** | Automate routine administration with boundaries | Event-driven AI coordinator, approvals and action limits, audit trail, evaluations; HQ management dashboards and operational scorecards | AI Operations Manager handles permitted routine tasks, while spending, pricing, serious incidents, engineer suspensions and deployments require human control |
| **6. Pilot learning and expansion** | Replicate proven service in further postcodes | Performance/security hardening, monitoring, app feasibility, mobile refinements, growth and learning content | Unit economics, customer outcomes, service reliability and engineer fairness meet owner-set pilot thresholds before further rollout |

**Claude Code is not allocated a stage, task or mandatory review.** It may be invited for a particular second opinion if the owner wants. Time and cost estimates follow Stage 0 audit; none are presumed here.

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

Codex is the default builder on every issue, with appropriate automated tests and human approval for material changes. The owner may optionally request Claude Code for a specific review or second opinion, but no issue depends on using Claude. Avoid simultaneous writes to the same files or schema migration.

## 5. Release gates, evidence and decisions

**Definition of done for every PR:** specified acceptance tests pass; public/private data boundaries checked; accessibility and mobile states verified as applicable; negative/error/cancellation paths covered; telemetry available; no secrets in repo; updated docs; reviewed by appropriate human for risky changes.

**Before first paying customer:** Stripe merchant/settlement responsibilities and actual pricing approved; customer terms/privacy/cancellation routes checked; partner checks, customer/engineer support, missed booking and incident escalation available; security, concurrency, backups, refunds and real end-to-end payment test passed.

**Pilot measurements (no invented targets):** paid bookings, fulfilment rate, first-response time, engineer-offer fairness, cancellation/no-show rate, customer satisfaction, first-time-to-member conversion, cost to acquire a booking/member, contribution after engineer/payment costs, and human admin minutes per job. Owner sets go/no-go thresholds after the first pilot.

**Do not infer build completion** from this specification or GitHub issue/PR creation. No coding assistants are automatically running in the background. Begin implementation only with an approved, bounded task and correct tool/session permissions.

## 6. Next executable sequence

1. Owner reviews this plan and confirms **MVP = paid booking + engineer fulfilment in one pilot area**, before most AI sophistication.
2. Assign the read-only audit tasks to **Codex** (which can run them sequentially or as non-overlapping parallel tasks under supervision), and combine findings into one risk/architecture register. Claude is not required.
3. Resolve the branch and data/finance authority decisions.
4. Create small implementable tickets and explicit API contracts for Stage 1.
5. Build, test and approve each gated stage; keep production unchanged until a distinct release authorisation.
