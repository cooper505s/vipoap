# Contributing to VIPOAP

VIPOAP is built around one outcome: helping people feel more confident with technology.

## Branch workflow

- `main` is production-ready and deployable.
- `development` is the integration branch for the next release.
- `feature/*`, `fix/*`, `docs/*` and `chore/*` branches are created from `development`.
- Feature branches are merged into `development` through a pull request.
- A tested release pull request moves `development` into `main`.

## Naming examples

- `feature/better-wifi-guide`
- `feature/booking-availability`
- `fix/mobile-navigation`
- `docs/privacy-update`
- `chore/engineering-framework`

## Before opening a pull request

1. Test the change on desktop and mobile.
2. Check keyboard navigation and visible focus.
3. Review all wording for plain English.
4. Confirm the approved logo has not been redrawn, stretched or placed inside an unintended box.
5. Check that no secret keys, passwords or personal customer information are included.
6. Update relevant documentation.

## Design and content rules

All work must follow the documents in `docs/foundation/`, including Calm Design, accessibility, copy guidelines, product principles, security and AI safety.

The approved palette is:

- Light green: `#7DBE7D`
- Green: `#5A8F5A`
- Navy: `#102957`
- Cream: `#F7F3EC`

## Definition of Done

A change is complete only when it:

- solves a clear customer or operational problem;
- works on common phone, tablet and desktop sizes;
- follows the VIPOAP design and writing standards;
- has appropriate accessibility behaviour;
- has been tested;
- includes documentation where required;
- introduces no known security or privacy regression.

## Commit messages

Use clear imperative messages, for example:

- `Add Better Wi-Fi troubleshooting flow`
- `Fix mobile booking layout`
- `Document scam-check retention rules`

## Sensitive information

Never commit customer data, passwords, API keys, tokens or private email contents. Use environment variables and documented placeholders.
