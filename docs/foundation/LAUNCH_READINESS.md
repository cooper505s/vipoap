# VIPOAP Launch Readiness

## Purpose

This checklist defines the minimum standard for a public VIPOAP release. It exists to prevent incomplete features, missing account configuration and avoidable customer confusion.

## Brand and content

- Approved logo is used without alteration.
- Contact details are consistent: help@vipoap.co.uk and 07977 254158.
- Pages use the agreed colours and Calm Design rules.
- Wording has been reviewed against the copy guidelines.
- No placeholder testimonials, claims or prices are presented as real.
- Privacy and terms links are available where required.

## Customer journeys

- Main navigation works on desktop and mobile.
- Telephone and email links work.
- Booking can be completed using a valid available slot.
- Unavailable dates and duplicate slots are handled clearly.
- Confirmation and error states explain what happens next.
- The app can be opened and installed from a secure production URL.
- A non-digital alternative is always visible for key journeys.

## Technical and hosting

- Production deployment is built from the intended GitHub branch.
- Required Cloudflare bindings and environment secrets are configured.
- No secrets are present in source code.
- Custom domain, HTTPS, redirects and canonical URLs are correct.
- Service worker and cache versions are current.
- Database migrations have been applied and recorded.
- Error logging and basic monitoring are active.
- A rollback path has been documented.

## Email

- Sending domain is verified.
- Booking and support emails reach help@vipoap.co.uk.
- Member-facing confirmation emails have been tested.
- Reply-to addresses and sender names are correct.
- Email content is readable on mobile and contains plain-text fallbacks.

## Security and privacy

- Admin pages require authentication.
- Authorisation checks protect every private record.
- Rate limiting and spam controls are present on public forms.
- Data retention and deletion procedures are defined.
- Uploads are restricted and handled safely.
- Privacy wording accurately reflects the actual system.

## Accessibility and quality

- Keyboard navigation, focus and zoom have been checked.
- Colour contrast and reduced-motion behaviour are acceptable.
- Pages have useful titles, headings and alternative text.
- Broken links and missing assets have been checked.
- Core journeys have been tested on at least one iPhone-sized viewport, one Android-sized viewport and desktop.

## Business readiness

- Service area and opening availability are accurate.
- Prices and cancellation terms are agreed before publication.
- Dan knows how to view and respond to bookings and requests.
- A simple process exists for failures, complaints and safeguarding concerns.
- The first week of launch has a manual fallback plan.

## Launch decision

Launch only when:

- No critical or high defects remain.
- Required account configuration is complete.
- Customer contact and recovery routes work.
- The release has a named owner.

A smaller reliable launch is preferred to a larger incomplete one.

## VIPOAP 2.0 launch blockers

Apply the evidence requirements and ownership in [AI team launch decisions](../VIPOAP-2-AI-TEAM-DECISIONS.md). These checks are open/unverified in this planning update; existing pages and prior fixes do not constitute end-to-end proof.

- [ ] Engineer join form verified through persistence, HQ review, onboarding/vetting and human HQ-only activation, including failure/retry paths (#64, #63).
- [ ] HQ portal sign-in/recovery, role/territory isolation, approvals and operational journeys verified; distinguish staff/task UI from running AI managers (#64, #63).
- [ ] Google indexing evidence recorded for agreed public pages: canonical/sitemap/robots checks, authorised Search Console submission and actual URL Inspection status; private portals excluded (#64).
- [ ] Core payment and security tests pass in approved test environments, including failure, duplicate-event, concurrency, authorisation and reconciliation cases (#62, #63).
- [ ] AI roles, cost hard stops, verified HQ-only manager voice handoffs, human approval controls, urgent alerts and 24/7 receptionist fallback evaluated before enablement (#67, #61).
- [ ] Dylan's release evidence, monitoring, rehearsed rollback/recovery and explicit owner release approval recorded (#65); Olly's consolidated blocker review recorded in #66.

Do not merge or deploy without owner approval. This checklist update neither runs these tests nor closes these blockers.
