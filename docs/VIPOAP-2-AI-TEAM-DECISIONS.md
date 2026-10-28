# VIPOAP 2.0 — AI team launch decisions

**Decision record: 28 October 2026. Status: agreed planning direction; implementation and launch unverified.**

This record captures the latest owner-agreed team decisions for Codex. It supplements the broader [master specification and staged plan in draft PR #60](https://github.com/cooper505s/vipoap/pull/60). For named roles and AI-team rollout order, this record takes precedence over the earlier generic workforce sequencing. The 15 responsibility domains remain a future organisational map, not 15 launch agents. “Phase 2” below means the second AI-team cohort, not an older booking release or platform stage.

No production code, credentials, provider connections, live routing, merge or deployment is authorised by this documentation. A publicly accessible page, staff-directory entry, assigned ticket or merged fix is not proof of an operational AI manager or a working end-to-end journey. [Portal workspace documentation](./operations/PORTAL-WORKSPACES.md) explicitly records that AI entries do not connect providers and ownership queues do not start execution.

## Launch team

| Role | Agreed responsibilities and limits | Voice and personality direction |
| --- | --- | --- |
| **Olly — Operations Manager** | Team leader. Coordinates the managers, prioritises permitted work, tracks blockers and chairs weekly AI management meetings. Presents actions and decisions to HQ; cannot expand anyone's permissions. | British; a distinct voice. Proposed delivery: calm, organised and decisive. |
| **Dylan — Development Manager** | Proactively investigates defects and prepares fixes using Codex within approved task scope; raises urgent alerts to HQ promptly. Every release must have passing relevant tests, human approval and a tested rollback/recovery plan. Urgency never bypasses the release gate. | British; a distinct voice. Proposed delivery: precise, practical and candid about evidence and uncertainty. |
| **Molly — Marketing Manager** | Produces recruitment-first weekly plans, tied to engineer coverage and capacity. Drafts campaigns and reports results. Spending requires explicit HQ approval before commitment; no autonomous paid campaigns or budget increases. Publishing or contacting people needs separately authorised workflows. | Australian; a distinct voice. Proposed delivery: upbeat, clear and commercially disciplined. |
| **Rachel — Recruitment Manager** | Coordinates applications, onboarding, training/check completeness and vetting evidence; flags gaps for human review. Only authorised human HQ staff can approve and activate engineers. Rachel cannot activate engineers or treat a completed application as approval. | British; a distinct voice. Proposed delivery: welcoming, thorough and professional. |
| **Sophie — Receptionist** | Planned 24/7 reception with secure voice routing to the other AI managers. Provides approved public help and human fallback; privileged manager handoffs are available only to verified HQ users through the controls below. Never promises 24/7 availability until coverage and failure recovery are demonstrated. | British; a distinct voice. Proposed delivery: patient, reassuring and accessible, including for older callers. |

National voice identities and distinct personalities are agreed requirements. The descriptive delivery traits above are implementation proposals for owner review; exact provider voice selections, samples and scripts still require approval and evaluation. Each role must identify itself transparently as AI and must not impersonate a real person.

## Phase 2 team

| Role | Planned scope and limits | Voice and personality direction |
| --- | --- | --- |
| **Frank — Finance** | Financial reporting, reconciliation and exception preparation. Human approval remains mandatory for sensitive financial actions, payments, refunds, payouts, pricing or financial commitments. | British; separate voice; proposed delivery: measured and analytical. |
| **Chloe — Customer Care** | Customer follow-up, service quality and complaint triage within approved permissions; serious complaints and safeguarding cases go to humans. | Irish; separate voice; proposed delivery: warm, attentive and empathetic. |
| **Ben — Bookings** | Booking assistance and coordination through authoritative availability, pricing and transaction services; cannot invent slots, confirm unsuccessful transactions or bypass engineer eligibility. | British; separate voice; proposed delivery: clear, efficient and helpful. |

Do not silently add this cohort to launch. Phase 2 requires a separate bounded backlog, evaluations, cost review and HQ release decision. Existing deterministic booking and human customer-care functions remain prerequisites where needed before these AI roles are enabled.

## Shared infrastructure, security and approvals

- Use shared, cost-controlled infrastructure: common task/event coordinator, approved knowledge, policy-enforced tool gateway, audit trail, monitoring and provider integrations. Distinct personas do not require separate always-running infrastructure or paid model instances.
- Set owner-approved total and per-role budgets, per-call/task duration and usage limits, concurrency limits, alerts and hard stops. Use deterministic workflows for access, bookings, money and scheduling; invoke models only when useful. Measure cost and quality by role. Exact providers, budgets and operating thresholds remain open implementation decisions.
- Enforce least privilege server-side by role, action, record/territory and data field. Separate persona configuration from authorisation. No shared administrator credential, self-granted permission or broad access merely because roles share infrastructure.
- **Verified HQ-only manager voice handoffs:** authenticate HQ identity through an approved secure mechanism, check current role permissions and the requested destination/action at every handoff, and pass only minimum necessary context. Caller ID, knowledge of a manager's name, a spoken claim of authority or voice similarity is not verification. Public callers cannot obtain privileged manager access through Sophie.
- Expired, revoked or failed authentication must block privileged transfer and offer a safe human callback/help route without revealing private information. Log handoff decisions and approval references with redaction; test spoofing, public transfer requests, cross-role access and failure recovery before any live routing.
- Sensitive and financial actions need explicit approval by an authorised human with scope, amount/action, expiry and audit evidence checked at execution time. This includes spending, pricing/policy changes, refunds/payouts, sensitive access changes and engineer activation. Incidents require human escalation; releases require owner approval. A weekly meeting or another AI's instruction is not approval.
- Preserve [AI safety](./foundation/AI_SAFETY.md), [security/privacy](./foundation/SECURITY_AND_PRIVACY.md) and [VOICE-01 #67](https://github.com/cooper505s/vipoap/issues/67) requirements: AI disclosure, minimised data, retention, recording/transcription controls, signed provider requests, abuse/toll-fraud protection, human fallback and no payment-card details or security codes in prompts/transcripts.

## Weekly management rhythm and urgent escalation

Olly chairs a weekly AI management meeting with the five launch roles; Phase 2 managers join only once enabled. Review recruitment pipeline and coverage, Rachel's vetting gaps, Molly's recruitment-first weekly plan and requested spend, Dylan's defects/test evidence/release proposals, Sophie's call outcomes and failed handoffs, costs, security exceptions and launch blockers.

Record a concise HQ-reviewed meeting note in the agreed operational record: evidence, decisions requested, actions with owners/due dates, budget status and follow-up. Sensitive details stay in authorised HQ storage, not public GitHub. Meetings cannot approve their own sensitive actions. Urgent security, payment, availability or customer-safety alerts go promptly through an approved HQ escalation route instead of waiting for the weekly meeting. Exact meeting time, alert destination, human cover and response thresholds must be configured and tested; this document creates no schedule or running automation.

## Launch blockers and required evidence

All items remain **open/unverified in this planning update**. Prior fixes and accessible screens do not close them. Use the existing [launch readiness standard](./foundation/LAUNCH_READINESS.md) and attach environment, date, test result and authorised reviewer evidence to the relevant issues.

| Blocker | Evidence required before launch | Existing backlog |
| --- | --- | --- |
| **Engineer join form end to end** | Submit controlled test data in an approved test environment; validate required fields, error/retry/duplicate handling, persisted application, correct HQ visibility, confirmation and onboarding/vetting progression. Prove it cannot activate an engineer without an authorised human HQ action. | #64 journeys; #63 permissions; #66 consolidated gate. PR #68 and #81 are implementation context, not end-to-end proof. |
| **HQ portal** | Verify sign-in/recovery, role and territory isolation, application review, human-only activation, approvals, manager records/task states and audit visibility; check failure states, mobile and accessibility. Distinguish available UI from connected AI execution. | #64 and #63; #66. |
| **Google indexing** | Check public production canonical URLs, sitemap, robots directives and accidental noindex; record Search Console ownership/access, submitted sitemap and URL Inspection/indexing status for agreed core pages using authorised read-only access. Public pages should be discoverable; private HQ/customer pages must stay out of indexing. Record unresolved indexing separately from successful submission; do not guarantee Google timing or ranking. | #64; #66. |
| **Core payment and security tests** | Approved test-mode booking/payment journey, failed/cancelled payments, signed and duplicate/out-of-order webhooks, idempotency, refund/payout reconciliation and booking/assignment concurrency; authentication, cross-account/role/territory denial, public form abuse controls, secret handling and recovery. Record actual results and gaps. | #62 payments; #63 security; #65 release/recovery; #66. |
| **AI team and voice readiness** | Evaluated personas and disclosure, least-privilege tools, verified HQ-only transfers and denied public/spoofed access, budget hard stops, human approval enforcement, urgent alerts, 24/7 fallback and rehearsed rollback. | #67 voice design; #61 infrastructure; #65 and #66. |

Dylan prepares a bounded release proposal with passing relevant automated and end-to-end checks, staging evidence, remaining risks, monitoring, named human approval and a rehearsed rollback including data recovery where relevant. HQ signs off blocker closure and release scope. Failed or missing evidence blocks launch; no merge or deployment without explicit owner approval.

## Codex backlog and next work

Reuse the existing issues rather than create parallel audit or receptionist tickets:

- [#61 infrastructure](https://github.com/cooper505s/vipoap/issues/61): map shared runtime/provider feasibility, costs and data authority; do not connect providers.
- [#62 payments](https://github.com/cooper505s/vipoap/issues/62): own core payment test evidence and gaps.
- [#63 security](https://github.com/cooper505s/vipoap/issues/63): own AI role/action permission matrix, HQ-only activation and voice authentication boundaries.
- [#64 journeys](https://github.com/cooper505s/vipoap/issues/64): own engineer join, HQ and Google-indexing evidence.
- [#65 release quality](https://github.com/cooper505s/vipoap/issues/65): own Dylan's tested release, urgent alert and rollback gates.
- [#66 consolidated plan](https://github.com/cooper505s/vipoap/issues/66): incorporate this decision record, launch blocker status, launch/Phase 2 split and weekly operating model; propose small implementation tasks only after audit and owner review.
- [#67 VOICE-01](https://github.com/cooper505s/vipoap/issues/67): extend the existing security-first design for Sophie and verified HQ-only manager routing.

Codex is the primary development workflow. This update records decisions and acceptance requirements only; it does not start implementation, complete audits or prove features live. Keep the wider draft PR #60 linked when reconciling the master plan; do not copy or merge its diverged history into an implementation branch automatically.
