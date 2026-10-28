# Portal workspace navigation

The shared role menu lives in assets/portal-navigation.js. Effective session permissions and territory scope filter it; page metadata never chooses a signed-in role. Partner, HQ and customer menus remain separate. Active paths normalise extensionless, .html and index URLs. Sidebar compact state is retained locally; labels remain available through accessible names and tooltips. Mobile uses an off-canvas menu.

Customers opens with a searchable directory. Add and selected records use a native dialog with the existing profile/equipment/files/history/contact controls and unsaved-change warning. Callbacks and applications open as filtered directories; selection opens a record dialog. Network has separate territories, engineers/users, roles and reporting views, with create/edit dialogs. Existing authenticated save endpoints and role restrictions remain in place.

Create ticket is available across authorised staff workspaces. It creates an internal OS task through the existing tickets endpoint, preserving a linked record identifier when supplied and including only the source pathname rather than query strings. It does not send messages. Callback, application and customer details can prefill a ticket. Existing Helpdesk filters include OS tasks.

Marketing has separate overview, social, Google/advertising, print/materials and activity pages. Approved copy, rules and activity logging use the existing marketing API. The photo upload is now in My profile. External channel connections, ad spend and publishing are NOT implemented. Human and AI staff can be registered in the Staff directory without granting login access or connecting AI providers. AI task ownership queues work but never starts execution. The organisation chart reads registered staff and reporting lines from the shared directory.

Platform health uses the same workspace chrome and component styling. Services, failures, business indicators, recovery and readiness are grouped with section navigation; older operational detail remains in a disclosure panel. This does not expand the coverage or reliability of existing health/backup checks.

No production schema, booking authority or provider configuration changes are part of this UI release. The separate transaction foundation remains inactive in PR76. Public website design is unchanged. Local visual review uses a read-only synthetic server outside the repository; fixture identities, preview authentication and mock responses must never be published.


Staff and ticket ownership use the existing KV store with separate staff: directory records and assignedToId ticket ownership. Assigned service engineers remain independent; changing a booking ticket owner does not write the booking or change its engineer. Existing legacy ticket-owner overlays still read correctly. Assignee lists include active authorised engineers, human staff and AI entries; missing, inactive or out-of-territory new targets are rejected. Partners remain restricted to their own ticket assignment. Staff creation requires manage_operators and creates no credential, account invitation, provider connection or message. Deactivation is reversible and leaves historical tickets intact. KV directory/ticket scans now follow every page and fail on repeated/incomplete cursors. Existing authenticated KV backup includes staff records; this does not resolve the broader transactional cutover/recovery gates in PR76.


Settings groups people/access, business setup, communications and system/recovery. Existing user/role/territory/brand/recovery controls are linked to their authorised editors. Channel configuration is reported as booleans without exposing credentials. The template library stores append-only draft records; drafts never replace live messages or send email. Live notification delivery settings and scheduled routines remain deployment-managed; a routine editor, quiet hours/digests and live template activation are not implemented and are labelled accordingly. New API writes are staff records, reversible status changes and inactive template drafts only when an authorised user submits the relevant form or runs the agreed company-team setup.


## Compact navigation and density

HQ navigation presents Overview and six expandable groups rather than every child link at once. Group state is saved per role and is not selected by the current page, so navigation does not automatically change shape during page transitions. The authorised destination list is unchanged; a group containing the current page is highlighted even when closed. Native disclosure controls work with keyboard input, including in the icon-only sidebar. Mobile keeps larger targets and the existing off-canvas menu/focus handling.

Staff and customer workspace chrome, cards, filters, directory rows and tables use tighter spacing. Intake directories no longer reserve the old two-pane editor minimum height when they contain few records. The public website remains unchanged. Desktop and a 390-pixel mobile breakpoint were reviewed using synthetic local fixtures only.


## Named company team and dense record views

The agreed launch roster is Dan Stevens (Managing Director), Olly (Operations Manager), Dylan (Development Manager), Molly (Marketing Manager), Rachel (Recruitment Manager) and Sophie (Receptionist). Frank (Finance), Chloe (Customer Care) and Ben (Bookings) are phase-two entries, initially inactive for task assignment. Voice profiles record the agreed British/Australian/Irish descriptions as metadata; no voice or AI provider is connected. Olly reports to Dan; other AI roles report to Olly. Staff directory, AI staff and Organisation read the same staff records. Company-wide staff managers can POST team-setup with action add-agreed-team. Stable identifiers and name matching make retries additive; existing records, edits and deactivation are preserved. This creates no login, permission grant, engineer activation, provider connection, message or running agent.

Authenticated legacy pages run a head bootstrap before login markup can paint. While the real session is checked, a neutral loading state replaces the obsolete sign-in form; failure offers reload and unauthenticated login pages remain available. Workspace assets use new versioned URLs.

Helpdesk uses a compact table, 50-row pagination and on-demand ticket details containing the existing actions. Customer directories also paginate loaded/searchable records in groups of 50. This bounds rendered rows, not the underlying KV scan. Other staff pages use tighter shared spacing and no forced minimum content height. HQ destinations have distinct icons. In the collapsed desktop sidebar, sections open labelled flyouts and preserve accessible destination names. Permission filtering is unchanged.
