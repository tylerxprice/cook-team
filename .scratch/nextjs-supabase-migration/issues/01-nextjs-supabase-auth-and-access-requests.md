# 01: Next.js + Local Supabase Tracer Bullet: Google OAuth Sign-In, Member Matching & Access Requests

**What to build:** A user can open the new Next.js web application (while the existing Google Apps Script build and E2E tests continue working without modification) and sign in with Google OAuth. If their signed-in Google email matches a **Member's** primary `google_email` or `alternate_emails` (case-insensitively) in Supabase Postgres, they enter the authenticated application with their resolved **Member** identity and role (`MEMBER` vs `COORDINATOR`). If their Google email is unrecognized, they are shown an "Unregistered Account" screen where they can click **"Request Access"** to submit their name, email, and an optional note—which records a pending request in Postgres and sends an email notification to the **Meal Coordinators**. **Meal Coordinators** can view pending access requests and approve a request in one click (either creating a new **Member** or linking the email as an `alternate_email` on an existing **Member**). Includes a keep-alive cron endpoint so the production Supabase Free Tier database never pauses after 7 days of inactivity.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Existing Google Apps Script build, unit tests, and Playwright E2E suite pass with zero regressions.
- [ ] Local Supabase configuration and initial migration define the `members` and `access_requests` tables with Row-Level Security (RLS) blocking all anonymous read/write access.
- [ ] Unauthenticated visitors to any application route are prompted to sign in via Google OAuth and redirected back to their requested route after authentication.
- [ ] A signed-in user whose Google email matches a **Member's** `google_email` or any entry in `alternate_emails` (case-insensitively) is resolved to that **Member** record and sees navigation appropriate to their `role` (`MEMBER` vs `COORDINATOR`).
- [ ] A signed-in user whose Google email does not match any **Member** cannot read community data via RLS and is shown the "Unregistered Account — Request Access" view.
- [ ] Submitting the **"Request Access"** form inserts a `PENDING` row into `access_requests` and dispatches an email alert to the **Meal Coordinators** via the SMTP transport adapter.
- [ ] A **Meal Coordinator** can approve a pending access request in one click by either creating a new **Member** record or appending the requester's email to an existing **Member's** `alternate_emails`, marking the request `APPROVED`.
- [ ] A keep-alive cron endpoint executes a lightweight database query and is configured in the Vercel cron schedule to run twice weekly.
- [ ] Integration tests against local Supabase Postgres and an injected SMTP fake verify **Member** matching (primary and alternate emails), RLS denial for unrecognized users, access request creation + email dispatch, and coordinator approval.
