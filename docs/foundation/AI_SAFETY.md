# VIPOAP AI Safety

## Purpose

AI may assist VIPOAP members and the Home Technology Advisor, but it must never replace judgement in situations involving money, identity, personal safety or significant risk.

## Member-facing principle

Members interact with VIPOAP, not with technical model names. VIPOAP must still be honest that an automated assessment is being used when that matters to understanding or consent.

## Approved initial uses

- Explain simple technology topics in plain English.
- Collect troubleshooting information before human follow-up.
- Assess common scam warning signs in supplied text.
- Summarise a support request for the Home Technology Advisor.
- Draft visit summaries and follow-up messages for human review.

## Prohibited or restricted uses

AI must not:

- Guarantee that a message, caller, website or payment is safe.
- Instruct a member to transfer money, disclose passwords or reveal security codes.
- Present itself as Dan or another real person.
- Make final legal, medical, financial or safeguarding decisions.
- Contact third parties or take account actions without explicit authority and suitable controls.
- Store personal data in prompts merely because it is available.

## Scam checker outcomes

The checker uses cautious categories:

- Likely scam.
- Suspicious — be careful.
- Not enough information.
- Probably genuine, but verify independently.

It never uses “completely safe”. Every result provides practical next steps and a route to ask Dan for review.

## Safe advice pattern

Where risk is present, advice should normally include:

1. Do not click links or reply yet.
2. Do not share passwords, PINs or one-time codes.
3. Contact the organisation using independently obtained details.
4. Contact the bank immediately if money or account details may be involved.
5. Ask a trusted person or VIPOAP for help.

## Privacy

- Tell members what will be analysed.
- Remove unnecessary identifiers before model submission where practical.
- Define retention for text, screenshots and model results.
- Do not use member submissions to train VIPOAP systems without explicit informed consent.
- Restrict uploaded files by type and size and scan them before storage or processing.

## Human escalation

Escalation must be prominent when:

- The model is uncertain.
- Money has been sent.
- Credentials or security codes were disclosed.
- Remote-access software was installed.
- The member feels threatened or distressed.
- The situation involves impersonation of police, banks, government, healthcare or family.

## Reliability controls

- Use structured outputs for risk categories and reasons.
- Keep prompts and model versions under change control.
- Test against both scams and genuine messages.
- Monitor false reassurance as the highest-severity product failure.
- Apply rate limiting and abuse controls.
- Log model failures without unnecessarily logging customer content.

## Tone

AI responses must be calm, clear and non-judgemental. Never blame a member for clicking, replying or being deceived.

## Review requirement

Any new AI capability requires a documented purpose, risk assessment, data flow, evaluation set, fallback route and owner before release.