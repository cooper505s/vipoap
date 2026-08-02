# VIPOAP Technical Standards

## Purpose

These standards define how VIPOAP software is designed, built, reviewed and operated. They apply to the public website, PWA, booking system, scam checker, member portal and VIPOAP Core.

## Core principles

1. Simplicity before sophistication.
2. Security and privacy by design.
3. Accessibility is part of completion, not an optional enhancement.
4. The live service must remain deployable and recoverable.
5. Prefer free or low-cost managed services while usage is small.
6. Avoid vendor lock-in where a simple interface can preserve portability.
7. Build around the household record and shared customer history.

## Initial platform

- Static website and PWA hosted on Cloudflare Pages.
- Cloudflare Pages Functions for server-side endpoints.
- Cloudflare D1 for structured relational records.
- Cloudflare KV for configuration, availability and short-lived state.
- Cloudflare R2 for approved uploads and generated documents.
- Resend for transactional email.
- OpenAI API for carefully bounded AI features.
- GitHub as the source of truth for code and documentation.

## Source control

- `main` must always be deployable.
- Significant changes use a feature branch and pull request.
- Pull requests must explain purpose, customer impact, testing and deployment requirements.
- Secrets must never be committed.
- Generated, temporary and local development files must be ignored.

## Code quality

- Use clear names and small, focused functions.
- Validate all external input on the server.
- Do not trust browser-side checks as security controls.
- Return consistent error structures from APIs.
- Log useful operational events without recording unnecessary personal data.
- Keep business rules separate from presentation code.

## API conventions

- API routes use `/api/`.
- JSON is the default request and response format.
- Successful responses include an explicit result.
- Errors include a safe user-facing message and an internal code.
- Dates are stored in UTC and displayed in the user’s local timezone.
- Booking and payment-style operations use idempotency controls where practical.

## Data rules

- Use stable internal identifiers rather than names or email addresses as keys.
- Record created and updated timestamps.
- Important administrative changes create audit records.
- Deletion and retention behaviour must be defined for each data category.
- Sensitive data is collected only when it has a clear service purpose.

## Performance

- Keep public pages lightweight.
- Optimise images and avoid unnecessary JavaScript.
- Core information must remain usable on slower mobile connections.
- Progressive enhancement is preferred: essential journeys must not depend on decorative motion.

## Availability and recovery

- Deployment must be reproducible from GitHub.
- Database migrations must be version controlled.
- Backup and restore procedures must be documented before storing production customer records.
- A failed third-party service must not expose secrets or corrupt customer data.

## Definition of technically complete

A change is not technically complete until it has been reviewed for security, accessibility, failure behaviour, mobile use, privacy, deployment and rollback.