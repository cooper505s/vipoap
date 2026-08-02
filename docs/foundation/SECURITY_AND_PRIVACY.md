# VIPOAP Security and Privacy

## Principle

Trust is the product. Security and privacy are part of the customer experience, not hidden technical work.

## Data minimisation

VIPOAP collects only the information needed to provide support, arrange visits, manage household technology records and protect customers from scams.

Do not collect passwords, banking credentials, one-time security codes or unnecessary identity documents.

## Sensitive information

Customer-submitted screenshots and messages may contain personal or financial details. The system must:

- warn customers not to include passwords or security codes;
- restrict access to authorised staff;
- encrypt information in transit;
- use secure storage;
- record administrative access where practical;
- support deletion under the retention policy.

## Authentication

- Admin accounts require strong passwords.
- Two-factor authentication should be enabled when available.
- Customer access should use secure, expiring sign-in links or another low-friction secure method.
- Sessions must expire and be revocable.
- Family access requires explicit household permission.

## Authorisation

Access follows least privilege.

Roles:

- Administrator: full platform administration.
- Home Technology Adviser: operational access to assigned households, visits and requests.
- Member: access to their own household information.
- Trusted Family Member: access only to information explicitly shared with them.

## Scam checker safeguards

- AI results are guidance, not a guarantee.
- The service must not instruct a user to make a payment or share credentials.
- High-risk and uncertain results must offer human review.
- Prompt injection or malicious content within submitted messages must be treated as untrusted data.
- Uploaded files must be type-checked and size-limited.

## Retention

Initial recommended policy:

- Unregistered contact enquiries: retain only as long as operationally necessary.
- Booking records: retain for service, accounting and legal requirements.
- Scam-check screenshots: delete after 90 days unless attached to an active support request or the member asks for earlier deletion.
- Closed help requests: review for deletion or anonymisation after 24 months.
- Audit logs: retain according to security and operational need.

Final retention periods must be confirmed against UK legal and accounting requirements before launch.

## Backups and recovery

- Structured data must have a documented backup or export process.
- Recovery steps must be tested before customer data becomes business-critical.
- Configuration and code remain version controlled in GitHub.
- Secrets must never be committed to GitHub.

## Incident response

If a security or privacy incident is suspected:

1. Contain the issue.
2. Preserve relevant logs.
3. Assess the affected information and people.
4. Reset or revoke affected credentials.
5. Notify affected people and regulators when legally required.
6. Document the cause and corrective action.

## Customer rights

VIPOAP must provide a clear route for customers to:

- request a copy of their data;
- correct inaccurate information;
- request deletion where applicable;
- withdraw consent;
- ask how their information is used.

## Release gate

No feature handling personal information may launch without:

- a named data owner;
- a clear purpose;
- documented access rules;
- a retention period;
- an error and breach response;
- plain-English privacy wording.
