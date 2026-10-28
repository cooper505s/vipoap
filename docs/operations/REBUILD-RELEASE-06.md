# Release 06: engineer workspace navigation

Signed-in engineer pages now use the software sidebar and mobile menu. My Work, My Payments, Training, Knowledge Base, Safety and Local Marketing appear according to the session's effective permissions. Shared destinations appear once. HQ-only links remain unavailable to the standard engineer role. Existing backend authorization and assignment checks remain authoritative.

The anonymous engineer sign-in page retains its login flow. Sign-out clears both password and email-session state and returns to engineer sign-in. Invalid sessions are cleared before redirecting, avoiding a stale-session loop. The shell preserves the blue OS browser icon and existing install controls; offline assets advance to v46.

Validation: all 303 tests pass. A synthetic local engineer session verified role-specific navigation without HQ links, the knowledge page, a 390px mobile layout without document overflow, menu/Escape and sign-out back to a usable email-code form. No live engineer session, customer record, email, payment or assignment was changed for verification. Public website appearance is unchanged.

This is the navigation increment. Deeper booking/assignment/payment reliability, remaining screen workflows, retention scheduling and recovery evidence remain outstanding. Google submissions stay deferred.
