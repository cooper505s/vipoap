# VIPOAP 2.0 — Master Product and Architecture Specification

**Status:** Proposed, for owner review — not approved for implementation or production deployment  
**Version:** 0.1 · 27 October 2026  
**Starting point:** \`cooper505s/vipoap\` on \`main\`  
**Scope:** Public website, customer, Engineer Partner and HQ/admin experiences; web and mobile; shared platform, training, onboarding, marketing and AI workforce.

> This is a planning baseline, not a claim that new features are live, a completed code/security audit, or permission to alter production. The commercial and technical choices marked as proposed need to be validated.

## 1. Vision and guiding decisions

VIPOAP becomes a **household technology-care membership** for people of all ages, while maintaining specialist accessibility and patient support for older and less-confident customers. The leading proposition is **“Your home technology, taken care of.”** Retain **“Technology without the worry.”** as the brand promise.

Customers should receive value when nothing has broken: track technology and contracts, understand renewal opportunities, receive personalised advice, feel safer online and get help when needed. Human Engineer Partners provide optional remote support and physical visits.

**Decisions confirmed in planning:**
- Maintain the existing single-word VIPOAP logo with approved differently coloured sections; no AI redraw or unapproved restyling.
- Preserve what works visually in the current website, but redesign its message around membership, household care, protection, savings and help.
- There are currently no customers requiring migration. A significant refactor/rebuild is acceptable; still back up existing code and systems before replacing anything.
- Design three complete role-based systems: **Customer**, **Engineer Partner**, **Admin/HQ**, each available via responsive web and appropriate mobile applications.
- Include Training Academy, recruitment/onboarding, marketing, finance, growth and operational management as core capabilities.
- Build a low-touch business supported by an AI Operations Manager and specialist AI agents, with explicit human accountability.
- Prepare a generic household-management capability (energy, insurance, broader bills, warranties and other home services), but **keep it disabled and invisible at initial technology launch**.
- Prefer a shared backend, modular business rules, permissioned data and automated event-driven workflows.
- Prioritise early paying members and demonstrated value rather than launching every possible feature simultaneously.

## 2. Initial repository findings and mandatory audit

An initial source-level review found the following building blocks. Existing presence does **not** imply production readiness:

| Existing material | Examples from repo | Audit decision required |
| --- | --- | --- |
| Website / brand | \`index.html\`, \`membership.html\`, \`assets/\`, \`docs/foundation/\` | Preserve visual identity and accessibility; update copy, journeys, navigation |
| Customer app | \`app/\`, \`app/manifest.webmanifest\` | Reuse or refactor after UX and auth review |
| Admin/partner experience | \`admin/\`, \`admin/manifest.webmanifest\` | Separate HQ vs partner experiences and permissions |
| API/domain logic | \`functions/api/\`, \`functions/_shared/\` | Audit current behaviour, consistency and authorisation |
| Booking / payments | booking, Stripe webhook, booking assignment and payout-related functions | Concurrency, refunds, ledger, idempotency, audit controls |
| Training/marketing | \`functions/api/admin/training.js\`, \`functions/api/admin/marketing.js\` | Identify functioning parts; consolidate and expand |
| Database | \`migrations/0001...\` to \`0008...\`, \`docs/operations/D1_MIGRATION.md\` | Compare schema against actual configured infrastructure |
| Tests | \`tests/*.test.mjs\`, GitHub Actions \`quality.yml\` | Run baseline; expand end-to-end, security, mobile and money-flow tests |

**Known risks from inspection:**
1. On 27 October 2026, GitHub comparison indicated that \`main\` is **323 commits ahead** of \`development\` and \`development\` is **15 commits ahead** of \`main\`; both have unique history. Do not build from or automatically merge the older development branch without reconciling it. This specification is based on main.
2. Existing APIs often use the Cloudflare KV binding \`VIPOAP_DATA\`; D1 schemas and migration plans also exist. **Do not assume that D1 is already the authority** for transactional data. Confirm deployed bindings and actual read/write paths before changing them.
3. Existing \`BOOKING-SETUP.md\` states that KV does not guarantee atomic booking-slot reservation under concurrency. A transactional reservation mechanism is required for scale.
4. Pricing varies across historical migrations. Use currently authorised, effective-dated price rules rather than hard-coding amounts; settle partner payment, VAT and marketplace/agency questions with professional review.
5. Repository visibility is currently **public**. Never commit customer data, secrets or personally identifying example records. Review whether the code should remain public.

**Audit gate:** inventory pages and APIs; compare deployed configuration with repo; document data flows and stores; evaluate Stripe and booking correctness; assess authentication, role boundaries, file access and rate limits; enumerate integrations and secrets by name only; examine tests; identify reusable code. Produce a **Reuse / Refactor / Replace / Retire** register and a prioritised threat/risk log. No implementation until owner approves this baseline.

## 3. Customer-facing public website

Keep the existing brand palette (navy \`#102957\`, greens \`#5A8F5A\` and \`#7DBE7D\`, cream \`#F7F3EC\`), typography (Quicksand), approachable language and existing approved logo artwork.

Proposed public navigation: Home; What We Do; Memberships; Book Help; Family Support; Guides & Safety; Become a Partner; About/Contact; Sign In.

**Hero concept:** “Your home technology, taken care of.” Supporting text explains monitoring, advice, protection and friendly human help. Primary CTA: **Explore membership**. Secondary CTA: **Get technology help**.

Explain four connected pillars:
- **SAVE:** Contract renewal reminders, genuinely comparable offers and informed technology-buying guidance.
- **PROTECT:** Scam guidance, safety/backup reminders and family digital-support features.
- **MANAGE:** Home Tech Passport, receipts, warranties, subscriptions and reports.
- **HELP:** Ask VIPOAP, remote support and approved local engineers.

Never market a planned service as live. Avoid unsubstantiated claims about savings, safety or response times. Keep the current calm, accessible “Kitchen Table Test” and “Margaret Test” in the foundation handbook. Customers must be able to seek human help without needing to understand AI.

## 4. Three integrated product experiences

### 4.1 Customer portal — “My Home”
The household is the centre of the account, not just a booking contact.
- Household, property/address and member profiles; accessibility and communication preferences.
- Family invites and granular delegated access, including multi-property support; recorded consent and revocation.
- Home Tech Passport: devices, models, purchase dates, support status, warranties, issues and support history.
- Services/contracts: broadband, TV, mobile, streaming, cloud storage, protection services and future categories.
- Secure document vault: bills, warranties and receipts; AI suggests extracted fields but user verifies them.
- Renewal engine: configurable 90/60/30-day reminders, price-change prompts and last-verified status.
- Deal comparisons only from permitted/licensed sources; show full contract cost, fees, suitability and affiliate disclosure.
- Personal monthly technology review, clear distinction between possible and achieved savings, recommended actions.
- AI support, cautious scam guidance, knowledge articles, assistance requests, booking and status tracking.
- Membership, invoices, payments, subscription changes, notifications and data/privacy controls.
- Optional family safety, digital legacy plan and educational content.

**Core journey:** Add contract via manual entry, uploaded bill or forwarded notice → extraction with confidence/source → customer confirmation → renewal schedule → relevant comparison when evidence exists → customer-authorised action → verified result and audit trail. Do not connect full inbox or bank accounts in the MVP.

### 4.2 Engineer Partner portal — “My Work”
- Recruitment application, service skills, postcode/area coverage and availability.
- Identity, relevant DBS eligibility, insurance, credentials, agreements and renewal dates.
- Guided onboarding, mandatory training, tests, policy acknowledgement and final human approval.
- Offered/accepted jobs, calendar, route suggestions, staged disclosure of necessary customer information.
- Arrival and lone-working safety, consent, visit notes, device records, photographs and customer sign-off.
- Additional time approvals, equipment/parts proposals, remote session consent and safe closeout.
- Earnings, cash declarations, settlement adjustments, weekly payouts and dispute routes.
- Quality ratings, coaching, community, knowledge base and incident reporting.
- Mobile-first interface; optionally use push, camera and maps; no sensitive details on unsecured lock-screen notifications.

### 4.3 HQ/Admin — “VIPOAP OS”
One management view with drill-down and responsible owners:
1. Executive pulse: revenue, members, jobs, risks and decisions needing attention.
2. Customers/households: all relationships, permissions, consent, service history and retention.
3. Service desk: AI/human conversations, tickets, SLAs, complaints and escalations.
4. Bookings and dispatch: matching, allocation, rescheduling, missed appointments and capacity.
5. Partners/network: recruitment, checks, coverage, quality, earnings and incidents.
6. Academy/onboarding: courses, certificates, tests, progress and service eligibility.
7. Marketing/brand: campaigns, territories, referrals, content calendar, consent and conversion.
8. Sales/customer success: leads, subscription funnel, engagement and churn prevention.
9. Finance: subscriptions, settlements, invoices, payment failures, refunds, reconciliation and margins.
10. Household care: extraction exceptions, expiring contracts, comparisons, alerts and customer value.
11. AI workforce: objectives, activities, cost limits, quality checks, approval requests and audit.
12. Technology/reliability: deployments, integration failures, security issues, backup status.
13. Risk/compliance/people: complaints, safeguarding, privacy rights, policies and incidents.
14. Commercial partnerships: offer feeds, suppliers, affiliate terms and employer accounts.
15. BI/strategy: cohorts, unit economics, regional economics, forecasts and expansion scenarios.

Every KPI has a documented definition, source, time period, drill-through record and confidence/freshness indicator. An empty business must show truthful zero/empty states, not sample KPIs as live facts.

## 5. Training Academy, onboarding and marketing

**Academy:** modular lessons (video/text), quizzes, retakes, scored attempts, practical checks, certificates, expiry reminders, skill/service eligibility. Partners cannot self-approve their own assessments. Customer lessons can reuse the learning engine under different visibility controls. Human reviewers remain responsible for safety-critical or practical competency.

**Onboarding:** separate state machines for household/customer, Engineer Partner and HQ roles. Automated reminders, document review queues, welcome journeys, membership setup, training prerequisites and approvals. Block job acceptance until required authorisation is in place. Keep DBS and identity material restricted and time-limited.

**Marketing & growth:** owned leads, lawful communication preferences, lead-source attribution, referrals, abandonment follow-ups where permitted, segmentation by geography/capacity, campaign drafting, landing pages, SEO/content, budget gates, performance reporting and retention triggers. AI can draft/recommend; new paid campaigns and material policy/claim changes require owner approval. Do not buy email lists or equate transactional messaging consent with marketing consent.

## 6. AI Operations Manager and AI workforce

The system is **AI-managed with bounded authority**, not an unsupervised collection of autonomous assistants. Use deterministic workflows for dates, payments, access rules, capacity and calculations; use models only when interpretation, drafting, guided support or evidence synthesis is needed.

**Core coordinating agent:** AI Operations Manager — receives scheduled/event alerts, gathers explanations and evidence from specialist domains, prioritises operational exceptions, assigns approved tasks and presents management briefings. It cannot grant itself privileges.

Specialist departments/roles:
1. Customer Support AI — guidance, triage and customer conversation summaries.
2. Booking & Dispatch AI — explain candidate matches, routine communications; authoritative allocation by rules/transactions.
3. Recruitment & Onboarding AI — review completeness, chase paperwork, prepare checks; not final approval.
4. Training AI — lesson guidance, objective marking and coaching suggestions.
5. Marketing & Brand AI — draft campaigns and analyse performance.
6. Finance AI — reconcile and flag discrepancies; no unsupervised payouts.
7. Household Care AI — extract/monitor contracts and generate appropriate reviews.
8. Quality & Compliance AI — sample cases, flag risk, route incidents.
9. Sales AI — prioritise enquiries, draft lawful follow-ups.
10. Customer Success AI — engagement, retention, realised value and churn signals.
11. Partner Network AI — supply/demand by area, quality and utilisation analysis.
12. Technology & Product AI — detect defects, prepare Github tasks, development review with human release control.
13. Commercial Partnerships AI — research, compare commercial terms and prepare proposals.
14. Business Intelligence & Strategy AI — forecasts, experimentation, expansion analysis.
15. People, Security & Governance AI assistance — records, alerts, risk review; human accountable owners for major decisions.

These are **responsibility domains**, not 15 continuously running paid model instances. Implement agents incrementally and share utilities.

**For every agent** define: purpose; triggering event/schedule; data scope; authorised read/write tools; allowed action tier; human owner; performance metric; token/cost budget; prompt/model version; evaluation set; log and retention; failure fallback; escalation SLA; kill switch and circuit breaker.

**Action tiers:**
- **Automatic:** permitted routine reminders, categorisation, non-sensitive status messages, basic support guidance, monitoring and reports with tested guardrails.
- **Human-approved:** campaign spend, meaningful refunds, engineer activation/suspension, supplier outreach, account changes with financial implications, high-impact communications, pricing or policy edits.
- **Human-only:** legal and safeguarding judgements, serious fraud/security response, material employment/partner disputes, production credential handling, strategic commitments.

Model outputs are untrusted. Enforce permissions server-side, validate tool inputs, prevent prompt-injection instructions in uploaded emails and documents, minimise private data disclosed to model providers, require idempotency and full traceability for side effects. No production code deployment by an agent without approved PR and checks.

**AI Management dashboard:** queued/running/failed tasks, exceptions, saved human time estimate (measured), confidence, override rate, action history, data accessed, cost by agent and cost per customer, budget alerts, quality scores, approvals and manual takeover.

## 7. Shared data and technical architecture

\`\`\`text
Public site / Customer Web+Mobile / Partner Web+Mobile / HQ Web+Mobile
                             |
             Authentication + Policy Enforcement
                             |
       Domain APIs: Household / Contracts / Support / Booking
       Membership / Partner / Learning / Marketing / Finance
                             |
                Transactional relational database
                             |
       Event outbox -> durable task queue and scheduled jobs
                             |
              Rules Engine + AI Task Coordinator
                             |
     External integrations / protected files / reports / audit
\`\`\`

**Technical recommendation, subject to repo and deployment audit:**
- Evaluate keeping Cloudflare Pages/Workers; avoid rewriting merely to adopt a trendy framework.
- Put durable relational aggregates in Cloudflare D1 or another suitable transactional database after concurrency/scale testing. Keep KV for acceptable eventual-consistency cases (configuration, cache, expiry state).
- Use private object storage such as R2 for customer documents, with scan, access checks, retention, signed time-limited links and removal process.
- Build typed API contracts and stable IDs for customer, household, address, user, permission grant, partner, booking, contract, subscription, payment, ledger, course and event.
- Maintain transactional outbox and idempotent worker handlers. Retrying an event must not duplicate payment, offer, job, message or credit.
- Apply least-privilege across role + household + assignment + field/doc category. Partner access must be limited to assigned work, not the full household dossier.
- Maintain versioned service/price rules; include dates, cancellation policies, membership entitlements, credits and partner fee splits.
- Create modular feature flags by product, plan, rollout cohort and jurisdiction; future household-management categories start **off** for everyone.
- Define backup/restore, retention, erasure, incident response, monitoring, structured logging, DLQs and test data.
- Choose app approach after spike: accessible responsive web/PWA first; compare React Native/Expo and Capacitor on code reuse, offline states, notifications and store release overhead. Share domain logic and API clients, not necessarily all screens.
- Scope existing integrations: Stripe/Stripe Connect, transactional email, approved WhatsApp templates, optional Zoho, licensed comparison feeds and device-support information. Commercial/legal eligibility must be checked before integration.

**Draft core entities:**
households, properties, people/users, household_memberships, permissions_grants, consent_events, devices, warranty_records, service_contracts, contract_snapshots, documents, renewal_events, recommendations, reported_savings, subscriptions, entitlements, bookings, booking_offers, assignments, service_visits, partner_profiles, coverage_areas, compliance_checks, training_courses, lesson_attempts, qualifications, payment_events, accounting_ledger, partner_settlements, messages, campaign_leads, attribution_events, ai_agents, ai_jobs, ai_actions, approvals, activity_audit, feature_flags.

Avoid collecting actual account passwords, OTPs or bank login details. Bank transaction monitoring and mailbox connections are **later optional integrations**, not assumptions of universal provider support.

## 8. Department scorecards and operating economics

Use one scorecard per business domain, a measured target and threshold exceptions:

| Department | Example measurable outcomes |
| --- | --- |
| Operations | Unallocated jobs, missed SLAs, time-to-resolution |
| Customer Support | First-contact resolution, escalation quality, satisfaction, cost/contact |
| Dispatch | Fill rate, travel/time efficiency, cancellation and rework |
| Recruitment | Qualified active partners per area, onboarding completion time |
| Training | Passed competency, expired checks, service-quality outcomes |
| Marketing | Qualified lead cost, CAC, attribution quality |
| Sales | Lead-to-member conversion, average revenue per account |
| Customer Success | Churn, engagement, realised savings and retention |
| Finance | Failed payments, reconciliation exceptions, gross margin, cash runway |
| Household Care | Verified contract completeness, timely alerts, useful recommendations |
| Partner Network | Coverage density, job acceptance, partner retention |
| Quality/Governance | Complaint rate, incidents, audit closure, wrongful access |
| Technology | Reliability, defect escape, incident recovery, security findings |
| Commercial Partnerships | Verified offer coverage, referral quality, partner profitability |
| Business Intelligence | Forecast accuracy, contribution per cohort/area, tested opportunities |

Initial automation goal: **reduce routine human administration**. Do not advertise an “80% automated workforce” outcome without measuring actual task types, human minutes and failure rates. Keep human support capacity and escalation paths.

## 9. Delivery roadmap and release gates

**Stage 0 — Architecture and risk audit:** Inventory existing pages, APIs, Cloudflare resources and data stores; inspect repo/branch divergence, payments and security; decide re-use list; baseline tests. Deliver approved ADRs and backlog.

**Stage 1 — Platform foundations:** Shared household and identity model; role-based access; separate partner/admin workspaces; correct money/booking data integrity; signed uploads; logging; event queues; feature flags; operations health and data migration strategy.

**Stage 2 — First marketable product:** Reposition website; accessible customer My Home, sign-up/membership and booking; partner onboarding and job workflow; HQ dashboard; baseline partner training; approved marketing campaigns. Instrument activation and acquisition.

**Stage 3 — Home Tech Manager:** Tech Passport, upload bill + extraction confirmation, contract reminders, device/warranty vault, monthly reviews, member savings measurement, family consent. Comparisons only after licensed data source and suitability QA.

**Stage 4 — AI workforce:** Operations Manager plus Customer Support and Dispatch assistants first; then household monitoring, partner recruitment, training, marketing, customer success, finance exceptions. Expand only after evaluation results and cost controls.

**Stage 5 — App store / national expansion:** Mobile app packaging/native needs, push and engineer tooling; postcode growth, supplier/employer partnerships and operational scalability.

**Stage 6 — Future household management:** Enable additional household bills/insurance/energy categories and concierge flows only through separate customer value, data protection, commercial and legal release gates. Keep disabled at original launch.

The stages overlap in design, not in unreviewed production access. Prioritise real initial customer validation over feature breadth.

**Every launch gate includes:** accessible desktop/mobile journeys; understandable error/recovery states; secure authentication and authorisation tests; automated regression; contract/money reconciliations; tested concurrency and duplicate-event handling; permission/retention review; AI red-team and false-reassurance testing; backup/rollback; human escalation; production environment readiness; written owner sign-off.

## 10. ChatGPT / Codex + Claude development agreement

GitHub is the shared source of truth, not either model's chat history.

- **Owner:** decides product scope, economics, branding, approvals and deployments.
- **ChatGPT/Codex:** requirements, acceptance scenarios, architecture challenge, security/privacy/code review and tests; may implement bounded work in separately owned branches.
- **Claude Code:** implementation of assigned bounded milestones, updated docs and tests, pull requests.
- **Coordinator (future option):** programmatic GitHub-triggered task routing, limited review iterations, budget ceilings and approval requests. ChatGPT and Claude consumer chat windows do not talk autonomously without integration.

**Repository workflow:** Because \`development\` diverged from \`main\`, first reconcile it by owner-approved procedure. Until then start documentation/review branches from \`main\`, and keep the implementation base consistent. Every change uses a fresh branch and a PR; no competing agent writes to the same files; require explicit task issue, architecture contract, PR review, tests and owner merge. Do not auto-merge or auto-deploy. Add protected-branch policies and GitHub Actions gates as allowed by repo/settings.

**First proposed issues:**
1. Audit repo + live Cloudflare bindings and persistence with no writes.
2. Reconcile \`main\`/\`development\` history and establish protected workflow.
3. Complete UX sitemap and functional wireframes for all three roles.
4. Define household schema, permission matrices and API contracts.
5. Verify booking/payment concurrency, reconciliation and versioned pricing.
6. Build shared operations/AI audit event architecture and approve action tiers.
7. Specify Home Tech Manager extraction, reminder rules and data-feed evaluation.
8. Scope training/onboarding/marketing reuse and modernisation.
9. Select mobile approach after an implementation spike.
10. Produce a phased release backlog with effort and cost ranges.

## 11. Explicit non-goals and open decisions

**Not first-release commitments:** insurance/energy switching, autonomous high-value financial decisions, full mailbox reading, bank account feeds, device-agent monitoring, every UK provider's pricing, 15 always-running models, expensive native app parity before validating use, new franchise services without due diligence.

**Decisions for owner review after technical audit:** current Cloudflare bindings and cost, preferred app packaging, payment merchant-of-record/agency model, partner vetting and safeguarding, data protection impact assessment, exact membership inclusions/fair-use and price points, comparative offer-source licences, scope of customer-uploaded statements, critical-human support operating hours, first-region marketing budget.

## 12. First milestone acceptance criteria

The specification is ready to become implementation work only when:
- the owner confirms this product scope and revised public message;
- technical auditors provide a reuse/replace inventory tied to exact source files;
- the data and payment authority are agreed;
- each role has a reviewed permissions matrix and essential end-to-end journeys;
- the branch-divergence issue is resolved for implementation;
- a release MVP backlog with estimates and explicit test gates exists.

**No production deployments or code rewrites are authorised by acceptance of this document alone.**
