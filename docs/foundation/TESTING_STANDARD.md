# VIPOAP Testing Standard

## Purpose

Testing protects member confidence. A feature that is confusing, inaccessible or unreliable is not complete even when its code works.

## Required test areas

Every customer-facing change must be considered across:

- Functional behaviour.
- Mobile, tablet and desktop layouts.
- Keyboard and screen-reader use.
- Large text and zoom.
- Slow connections and offline behaviour where relevant.
- Invalid, incomplete and unexpected input.
- Third-party service failure.
- Privacy and security.
- Plain-English comprehension.

## Critical journeys

The following journeys receive the highest level of testing:

1. Calling or contacting VIPOAP.
2. Booking and selecting an available time.
3. Booking confirmation and duplicate prevention.
4. Admin login and availability changes.
5. Asking for help.
6. Scam-check submission, result and human escalation.
7. Accessing a member or household record.
8. Uploading screenshots or documents.

## Accessibility checks

- All interactive controls can be reached and used with a keyboard.
- Focus is visible and follows a logical order.
- Form fields have persistent labels and useful error messages.
- Colour is never the only way meaning is communicated.
- Motion respects reduced-motion preferences.
- Text remains usable at 200% zoom.
- Tap targets are comfortably sized.

## Content checks

A reviewer should confirm:

- The member knows what will happen next.
- Technical language has been removed or explained.
- Error messages help recovery.
- The tone is calm and never blaming.
- Contact alternatives are present when an automated route fails.

## Security checks

- Server-side validation is present.
- Authentication and authorisation are tested separately.
- Direct access to another member’s records is prevented.
- Secrets and private data do not appear in client code, URLs or logs.
- Upload restrictions and rate limits are effective.

## Release evidence

A significant pull request should state:

- What was tested.
- Which devices or viewport sizes were checked.
- Known limitations.
- Any account configuration required.
- How to roll back.

## Defect priorities

- Critical: risk of harm, data exposure, incorrect booking, payment or dangerous reassurance.
- High: a key journey cannot be completed.
- Medium: degraded experience with a reasonable workaround.
- Low: cosmetic or minor wording issue.

Critical and high defects block release.

## The Kitchen Table test

Before release, someone unfamiliar with the feature should attempt the journey without coaching. If they need the designer or developer to explain it, the journey requires improvement.