# Next.js & Supabase Migration with Google OAuth and Sheets Integration

Status: ready-for-agent

## Problem Statement

CookTeamTool currently runs as a single-file React application inside Google Apps Script (`HtmlService`) backed entirely by Google Sheets. While this zero-cost setup enabled initial adoption, it imposes several growing pains for both **Meal Coordinators** and **Members**:

1. **Fragile Unstructured Storage**: **Planning Month** state is scattered across loose, stringly-typed key-value rows in the **Master Registry** settings tab (`month_status_YYYY-MM`, `month_dates_YYYY-MM`, `open_months`, `published_months`), script properties, and separate per-month spreadsheets.
2. **Append-Only Survey Rows & Name Coupling**: **Availability Surveys** append rows to a spreadsheet and link **Members** by display name string rather than stable IDs. If a **Member** updates their name or submits an updated **Availability Survey**, reconciliation relies on heuristic deduplication, and string-keyed **Exception Rules** or historical **Shifts** can become orphaned.
3. **Lack of Authenticated Member Self-Service**: **Members** cannot simply sign in with their Google account to view the schedule, manage their own profile details (name, aliases, alternate emails, active status), or view and edit their own **Availability Survey** in place. Meanwhile, publishing the app via an unauthenticated Google Apps Script URL exposes community schedules without login protection.
4. **High Cost of Evolving the Survey**: Adding a new question to the monthly **Availability Survey**—such as asking whether a **Member** is willing to serve as a **Mentor** for **Teens**, or adding custom community questions—currently requires changing spreadsheet column parsers and code rather than configuring questions in the coordinator UI.
5. **Slow RPC Latency & Runtime Limits**: Every action in the Google Apps Script web app incurs multi-second `google.script.run` round-trips and spreadsheet I/O overhead.

At the same time, the live Google Apps Script version is actively used in production each month and must remain unbroken and maintainable throughout the migration, and the **Meal Coordinator** still needs an on-demand view of **Members**, **Availability Surveys**, and solved **Cook Teams** and **Clean Teams** in Google Sheets—plus automated export to the **Common Meal Sign-Up Workbook** when the monthly schedule announcement is broadcast.

## Solution

Migrate CookTeamTool to a Next.js web application deployed on Vercel and backed by Supabase (PostgreSQL + Google OAuth), while coexisting side-by-side in the same repository with the legacy Google Apps Script application until cutover:

1. **Coexisting Architecture with Shared Domain Core**: Keep the existing Google Apps Script build and deployment workflow completely untouched while building the Next.js application in an isolated workspace directory that shares the pure TypeScript **Matchmaker Solver**, parser, and equity reporting logic.
2. **Authenticated Member & Coordinator Portal (Google OAuth)**: Require Google OAuth sign-in across all views (including viewing published monthly schedules). Match signed-in users against **Member** primary and alternate emails in Supabase Postgres. Provide a one-click **"Request Access"** flow (recording an access request and emailing **Meal Coordinators**) for unrecognized Google accounts.
3. **Member Self-Service**: Allow signed-in **Members** to view published monthly schedules (with personal **Shift** highlighting and calendar export), edit their own profile (`name`, `aliases`, `alternate_emails`, `active`), and submit or edit their own single canonical **Availability Survey** for any open **Planning Month** (automatically reactivating **Inactive Members** upon submission, and locking edits once the **Planning Month** advances past `SIGN_UPS_OPEN`).
4. **Structured Relational Database Schema**: Replace loose spreadsheet keys with relational Postgres tables for the **Master Registry** (`members` with UUID primary keys and coordinator role, `exception_rules` with UUID foreign keys and **Mentor Whitelist** arrays, `community_settings` using `key` + `jsonb` values validated against a schema with defaults, and `access_requests`) and for each **Planning Month** (`planning_months`, `meal_dates`, `availability_surveys`, `availability_entries`, and `shifts`).
5. **First-Class Mentor Willingness & Coordinator-Configurable Custom Survey Questions**: Add a survey-level `willing_to_mentor` boolean on **Availability Surveys** (surfaced to the **Meal Coordinator** when configuring **Mentor Whitelists** and inspecting teams) and a JSONB-backed custom survey questions engine (`custom_questions` on **Planning Months** and `custom_answers` on **Availability Surveys**) so **Meal Coordinators** can add, edit, or retire survey questions from the web UI without schema migrations.
6. **Google Cloud Service Account Integration & Gmail SMTP Broadcasts**:
   * Provide an idempotent import utility (CLI and Coordinator UI) using a Google Cloud Service Account to migrate and re-sync the live **Master Registry**, historical schedules, and any active **Monthly Survey Sheet** from Google Sheets into Supabase Postgres through cutover.
   * Provide on-demand one-way export from Supabase Postgres back to Google Sheets for **Members**, monthly **Availability Surveys**, and solved **Cook Teams** / **Clean Teams**.
   * Send outbound emails (schedule broadcasts, survey invitations, and access-request alerts) via Gmail SMTP (`nodemailer` + App Password), and automatically trigger the export to the **Common Meal Sign-Up Workbook** whenever the **Meal Coordinator** sends the schedule announcement email or marks the broadcast as sent.
   * Keep the Supabase Free Tier project awake between monthly scheduling cycles via a twice-weekly Vercel Cron keep-alive ping.

## User Stories

### Authentication, Access Control & Unrecognized Accounts

1. As a **Member**, I want to sign in with my Google account, so that I can securely access the community meal schedule, my profile, and my monthly **Availability Survey**.
2. As a **Member** who signs in with an alternate email address listed in my `alternate_emails`, I want the system to recognize and link me to my existing **Member** record automatically, so that I do not get locked out when using a secondary Google account.
3. As an unauthenticated visitor following a schedule link from an email, I want to be prompted to sign in with Google before viewing the monthly schedule and ** automatically redirected back to the requested **Planning Month** after signing in, so that community member names and schedules are never exposed publicly.
4. As an unrecognized Google user whose email is not yet in the **Master Registry**, I want to see a clear "Unregistered Account" screen with a one-click **"Request Access"** form (pre-filled with my Google email and display name, plus an optional note), so that I can ask the **Meal Coordinator** to grant me access.
5. As a **Meal Coordinator**, I want to receive an immediate email notification whenever an unrecognized user clicks **"Request Access"** and see their pending request in an in-app approval queue, so that I can either create a new **Member** record for them or link their email as an `alternate_email` on an existing **Member** in one click.
6. As a **Meal Coordinator**, I want my coordinator role (`role = 'COORDINATOR'`) to unlock the 4-step scheduling wizard, **Master Registry** management, **Exception Rules**, custom survey question configuration, and Google Sheets import/export tools, while regular **Members** only see the schedule, their own profile, and their own **Availability Survey**.

### Member Self-Service (Schedule, Profile & Availability Survey)

7. As a **Member**, I want to view the published schedule of **Cook Teams** and **Clean Teams** for any completed or published **Planning Month**, with my own assigned **Shifts** highlighted, so that I can quickly see when I am cooking or cleaning.
8. As a **Member**, I want to download `.ics` calendar events or add my assigned **Cook** and **Cleaner** **Shifts** to my phone or Google Calendar from the schedule view, so that I don't miss my scheduled shifts.
9. As a **Member**, I want to view and edit my own profile information (`name`, `aliases`, `alternate_emails`, and `active` status) without breaking any historical **Shifts**, **Availability Surveys**, or **Exception Rules** that reference me, so that my contact and display details stay accurate.
10. As a **Member** who will be away or unable to participate for an extended period, I want to toggle my own status to **Inactive Member** (`active = false`) on my profile, so that I am not flagged as missing during the monthly **Completeness Audit**.
11. As an **Active Member**, I want to select an open **Planning Month** (`SIGN_UPS_OPEN`) and fill out my **Availability Survey**—including per-date availability (`Available`, `Cook Only`, `Clean Only`, `Unavailable`) for each **Meal Date**, **Cook Quota**, **Clean Quota**, optional **Max Total Shifts**, **Cook Team Sizing Policy** preference, **Same-Day Preference**, willingness to serve as a **Mentor** for **Teens** (`willing_to_mentor`), **Special Instructions**, and any coordinator-configured custom questions—so that the **Meal Coordinator** has my preferences for the month.
12. As a **Member** who has already submitted an **Availability Survey** for an open **Planning Month**, I want to reopen `/survey/[monthKey]`, see my previously saved answers pre-populated, and update them in place (updating my single survey record rather than creating duplicate rows), so that I can revise my availability while sign-ups are still open.
13. As an **Inactive Member**, I want my status to automatically flip back to **Active Member** (`active = true`) and my `last_active_survey` month to update whenever I submit an **Availability Survey** for an open **Planning Month**, so that I re-enter the community rotation seamlessly.
14. As a **Member** viewing my **Availability Survey** for a **Planning Month** whose status has moved past `SIGN_UPS_OPEN` (into `RESPONSES_RECEIVED`, `TEAMS_READY`, `EMAIL_SENT`, or `CLOSED`), I want my survey to be displayed as read-only with a clear notice to contact the **Meal Coordinator** for late changes, so that I cannot silently alter availability while or after teams are solved.

### Coordinator: Planning Month Staging & Custom Survey Questions

15. As a **Meal Coordinator**, I want to stage a new **Planning Month** (`YYYY-MM`) by generating default **Meal Dates** (Dinners and Brunches), toggling included dates or **No-Meal Dates**, adding special notes (e.g., holidays or community meetings), and setting the **Planning Month** status to `STAGING_DATES` or `SIGN_UPS_OPEN` in Postgres, so that **Members** can immediately begin submitting their **Availability Surveys** on the web.
16. As a **Meal Coordinator**, I want to create, edit, reorder, and toggle custom survey questions (supporting Yes/No boolean, single-select, multi-select, text, and number types) either as community-wide defaults or for a specific **Planning Month**, so that I can gather extra planning answers from **Members** without needing a developer or a database migration.
17. As a **Meal Coordinator**, I want changing custom survey questions for an upcoming **Planning Month** to snapshot onto that **Planning Month** without mutating the questions or answers recorded on past **Planning Months**, so that historical survey records remain intact.

### Coordinator: Step 1 (Intake & Completeness Audit)

18. As a **Meal Coordinator**, I want Step 1 of the wizard to load the selected **Planning Month** directly from Supabase Postgres and display the **Completeness Audit** (listing missing **Active Members**, auto-reactivated **Members**, and total respondent counts), so that I can see who still needs a reminder.
19. As a **Meal Coordinator**, I want to mark a missing **Member** as an **Inactive Member** (`[Mark Inactive]`) directly from the **Completeness Audit** or manually enter/edit an **Availability Survey** on behalf of a **Member**, so that I can finalize intake quickly.
20. As a **Meal Coordinator** during the transition period, I want an optional button to pull/merge responses from a linked Google Form **Monthly Survey Sheet** into the **Planning Month's** `availability_surveys` in Postgres, so that any **Member** who submitted a legacy Google Form is included alongside web submissions.

### Coordinator: Step 2 (Special Instructions, Exception Rules & Mentor Whitelists)

21. As a **Meal Coordinator**, I want Step 2 to display all **Members'** **Special Instructions** alongside their answers to any custom survey questions (`custom_answers`) and their `willing_to_mentor` status for the current **Planning Month**, so that I can configure **Exception Rules** with full context.
22. As a **Meal Coordinator**, I want to create, edit, and delete **Exception Rules** (`NOT_SAME_TEAM`, `NOT_SAME_DAY`, `SAME_DAY_DIFF_TEAM`, `PAIR_WITH_ROLE`, `PREF_SAME_DAY`, `REQUIRE_ONE_OF_TEAM` **Mentor Whitelist**, and `EXTRA_HELPER`) stored relationally by **Member** UUID, so that renaming a **Member** never breaks standing rules.
23. As a **Meal Coordinator** configuring a **Mentor Whitelist** (`REQUIRE_ONE_OF_TEAM`) for a **Teen**, I want the UI to badge **Members** who answered `willing_to_mentor = true` on their **Availability Survey**, so that I can easily identify and add willing **Mentors** to the whitelist.

### Coordinator: Step 3 (Matchmaker Solver, Overrides & Team Review)

24. As a **Meal Coordinator**, I want to run the **Matchmaker Solver** on the current **Planning Month** with my chosen **Cook Team Sizing Policy** (`ADAPTIVE_3_OR_2`, `DINNER_3_BRUNCH_2`, or `TWO_REGARDLESS`) and deficit-cancellation toggle, and persist the resulting **Shifts** (`COOK`, `CLEAN`, and optional `is_extra_helper`) to Postgres, so that solved teams are saved reliably.
25. As a **Meal Coordinator** manually filling an **Unfilled Slot** or inspecting a **Member's** calendar in Step 3, I want the candidate picker to display each candidate's **Quotas**, assigned **Shifts**, rule conflicts, `willing_to_mentor` badge, **Special Instructions**, and custom question answers (`custom_answers`), so that I can make informed manual assignments and **Oversubscriptions**.
26. As a **Meal Coordinator**, I want to review **Near-Complete Meals** and suggested outreach messages in Step 3, and save my finalized **Cook Teams** and **Clean Teams** to advance the **Planning Month** to `TEAMS_READY`.

### Coordinator: Step 4 (Broadcast Email & Google Sheets Exports)

27. As a **Meal Coordinator**, I want to send the monthly schedule announcement email to the community listserv (`announcement_to` / `announcement_cc`) directly from Step 4 via Gmail SMTP (or mark the broadcast as sent if sent externally), recording the broadcast metadata and transitioning the **Planning Month** status to `EMAIL_SENT`.
28. As a **Meal Coordinator**, I want sending the schedule announcement email (or clicking **"Mark as Broadcast Sent"**) to automatically trigger the export of the finalized schedule tab into the community's **Common Meal Sign-Up Workbook** in Google Sheets (using default meal deadlines and labels if not already exported), so that **Members** can immediately record their **Meal Sign-Ups** to eat once the announcement goes out.
29. As a **Meal Coordinator**, I want to retain the ability in Step 4 to open the **Common Meal Sign-Up Workbook** export configuration modal to customize per-meal deadlines or day labels beforehand, or re-export to the workbook after making schedule adjustments.
30. As a **Meal Coordinator**, I want an on-demand **"Export to Google Sheets"** action that writes clean, human-readable spreadsheet tabs for `Members`, `Availability_YYYY-MM` (including `willing_to_mentor` and custom question columns), and `Schedule_YYYY-MM` using the Google Cloud Service Account, so that I always have a spreadsheet view of our community data in Google Drive without relying on legacy GAS internal formats.

### Migration, Coexistence & Operations

31. As a developer and **Meal Coordinator**, I want an idempotent Google Sheets → Supabase import utility (runnable via CLI and from the Coordinator Admin UI) that imports the live **Master Registry** (`Members`, `Exceptions`, `Settings`), historical schedule tabs (`2026-01` onward for **Community Equity Reports**), and any active **Monthly Survey Sheet** into Supabase Postgres, so that I can test with real production data and re-sync cleanly at final cutover.
32. As a developer, I want the existing Google Apps Script build (`npm run build`, `npm run deploy`, `npm run test:e2e`) to continue working without modification while the Next.js + Supabase app is developed and deployed to Vercel from the same repository, so that I can maintain and patch the live GAS app until cutover day.
33. As an operator on the Supabase Free Tier, I want an automated Vercel Cron job to ping the Supabase database twice a week, so that the production database never pauses due to 7 days of inactivity between monthly scheduling cycles.

## Implementation Decisions

### 1. Repository Layout & Shared Domain Core
- Keep the existing root Google Apps Script application (`src/client`, `src/server`, Vite singlefile build, esbuild server bundle, and `clasp` deployment scripts) completely intact at the repository root.
- Create the Next.js application inside a dedicated `web/` directory (configured as the Vercel Root Directory for GitHub auto-deploys).
- Import the pure, environment-agnostic TypeScript modules—the **Matchmaker Solver**, survey/schedule parsers, date utilities, and **Community Equity Report** calculator—directly from the shared domain layer so solver improvements and bug fixes apply to both GAS and Next.js simultaneously.

### 2. Relational Database Schema (Supabase Postgres)
```sql
-- Core Registry & Settings
members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  google_email text NOT NULL UNIQUE,
  alternate_emails text[] NOT NULL DEFAULT '{}',
  aliases text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  role text NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'COORDINATOR')),
  is_beta_tester boolean NOT NULL DEFAULT false,
  last_active_survey text,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

exception_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_a_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_b_id uuid REFERENCES members(id) ON DELETE CASCADE,
  mentor_member_ids uuid[] NOT NULL DEFAULT '{}',
  rule_type text NOT NULL,
  target_role_a text,
  target_role_b text,
  is_hard_rule boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
)

community_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
)

access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DISMISSED')),
  resolved_by uuid REFERENCES members(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)

-- Planning Months, Surveys & Shifts
planning_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key text NOT NULL UNIQUE, -- 'YYYY-MM'
  title text NOT NULL,
  status text NOT NULL DEFAULT 'STAGING_DATES' CHECK (
    status IN ('STAGING_DATES', 'SIGN_UPS_OPEN', 'RESPONSES_RECEIVED', 'TEAMS_READY', 'EMAIL_SENT', 'NOT_OPEN', 'OPEN', 'CLOSED')
  ),
  cook_policy_override text,
  custom_questions jsonb NOT NULL DEFAULT '[]',
  survey_sheet_id text,
  google_form_id text,
  google_form_url text,
  signup_export_tab_name text,
  signup_exported_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  teams_saved_at timestamptz,
  broadcast_sent_at timestamptz,
  broadcast_sent_by text,
  broadcast_subject text,
  broadcast_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

meal_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_month_id uuid NOT NULL REFERENCES planning_months(id) ON DELETE CASCADE,
  date_key text NOT NULL, -- 'YYYY-MM-DD'
  date_label text NOT NULL,
  day_of_week text NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('DINNER', 'BRUNCH')),
  included boolean NOT NULL DEFAULT true,
  is_no_meal boolean NOT NULL DEFAULT false,
  special_note text,
  target_cook_count int NOT NULL DEFAULT 3,
  target_clean_count int NOT NULL DEFAULT 3,
  custom_deadline text,
  custom_day_label text,
  meal_name text,
  UNIQUE (planning_month_id, date_key)
)

availability_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_month_id uuid NOT NULL REFERENCES planning_months(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  cook_quota int NOT NULL DEFAULT 1,
  clean_quota int NOT NULL DEFAULT 1,
  max_total_shifts int,
  cook_team_size_pref text NOT NULL DEFAULT '3 for dinner, 2 for brunch',
  same_day_pref text NOT NULL DEFAULT 'NO' CHECK (same_day_pref IN ('NO', 'YES', 'PREFERRED')),
  willing_to_mentor boolean NOT NULL DEFAULT false,
  special_instructions text NOT NULL DEFAULT '',
  custom_answers jsonb NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'WEB' CHECK (source IN ('WEB', 'FORM', 'COORDINATOR')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planning_month_id, member_id)
)

availability_entries (
  survey_id uuid NOT NULL REFERENCES availability_surveys(id) ON DELETE CASCADE,
  meal_date_id uuid NOT NULL REFERENCES meal_dates(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('AVAILABLE', 'COOK_ONLY', 'CLEAN_ONLY', 'UNAVAILABLE')),
  PRIMARY KEY (survey_id, meal_date_id)
)

shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_date_id uuid NOT NULL REFERENCES meal_dates(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('COOK', 'CLEAN')),
  is_extra_helper boolean NOT NULL DEFAULT false,
  slot_index int NOT NULL DEFAULT 0,
  UNIQUE (meal_date_id, member_id, role)
)
```

### 3. Settings & Custom Survey Questions Schema
- `community_settings` stores JSONB values validated at runtime through a TypeScript/Zod schema with default fallbacks (`communityName`, `announcementTo`, `announcementCc`, `cookPolicy`, `defaultCleanQuota`, `autoCancelDeficitDates`, `signupWorkbookId`, `exportWorkbookId`, `defaultCustomQuestions`). Adding a new setting only requires adding a property and default to the TypeScript schema.
- Custom survey questions follow a typed definition array (`id`, `label`, `helpText`, `type: 'boolean' | 'single_select' | 'multi_select' | 'text' | 'number'`, `options?: string[]`, `required: boolean`, `active: boolean`). When a **Planning Month** is created, `defaultCustomQuestions` from `community_settings` is snapshotted into `planning_months.custom_questions`, and **Meal Coordinators** can customize them per month.

### 4. Authentication & Row-Level Security (RLS)
- All routes in the Next.js app require an authenticated Supabase session via Google OAuth.
- A database helper function resolves the current session's email (`auth.jwt() ->> 'email'`) case-insensitively against `members.google_email` or `ANY(members.alternate_emails)`.
- **RLS Policies**:
  - Anonymous users have zero read/write access to `members`, `exception_rules`, `planning_months`, `meal_dates`, `availability_surveys`, `availability_entries`, or `shifts`.
  - Authenticated users whose email does not match any **Member** can only insert into `access_requests` (with their own authenticated email).
  - Matched **Members** (`role = 'MEMBER'`) can `SELECT` published/open `planning_months`, `meal_dates`, `shifts`, and basic `members` directory info; `UPDATE` their own row in `members` (restricted to `name`, `aliases`, `alternate_emails`, `active`); and `SELECT` / `INSERT` / `UPDATE` their own `availability_surveys` and `availability_entries` **only when** the parent `planning_months.status IN ('SIGN_UPS_OPEN', 'OPEN')`.
  - **Meal Coordinators** (`role = 'COORDINATOR'`) have full `SELECT / INSERT / UPDATE / DELETE` privileges across all tables.

### 5. Google Sheets Service Account & Email Transport Adapters
- **Google Sheets / Drive Adapter**: Uses a Google Cloud Service Account key (`GOOGLE_SERVICE_ACCOUNT_JSON`) on the server for:
  1. **Idempotent Import**: Reading the live GAS **Master Registry**, historical schedule tabs, and any active **Monthly Survey Sheet**, and upserting them into Supabase Postgres.
  2. **On-Demand Data Export**: Writing clean `Members`, `Availability_YYYY-MM` (including `willing_to_mentor` and custom question columns), and `Schedule_YYYY-MM` tabs to a Google Spreadsheet.
  3. **Common Meal Sign-Up Workbook Export**: Cloning the `Template` tab in `signupWorkbookId` and populating meal columns, deadlines, **Cooks**, and **Cleaners**.
- **Broadcast-Linked Sign-Up Workbook Export**: In Step 4, when the **Meal Coordinator** triggers **"Send Schedule Announcement"** or **"Mark as Broadcast Sent"**, the backend marks `planning_months.status = 'EMAIL_SENT'`, records the broadcast metadata, and automatically executes the **Common Meal Sign-Up Workbook** export for that month if `signup_exported_at` is null (while still allowing manual deadline customization and re-export at any time).
- **Email Transport Adapter**: Uses `nodemailer` with a Gmail App Password (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) to send schedule announcements to the community Google Group, survey invitations, and unrecognized-user **"Request Access"** alerts to **Meal Coordinators**.

## Testing Decisions

### Philosophy & Seams
- Tests must verify external behavior and domain invariants through high-level seams rather than testing implementation details or mocking SQL queries.
- **Primary Seam (Next.js Data/Action Service Layer + Real Local Supabase Postgres)**:
  - Integration tests run against a real local Supabase Postgres database (`supabase start`) with thin in-memory/fake adapters injected only at the external Google Sheets/Drive API and `nodemailer` SMTP boundaries.
  - Tests at this seam verify:
    1. **Auth & RLS Enforcement**: Unrecognized Google users cannot read schedules or members and can only submit `access_requests`; regular **Members** can update their own profile (`name`, `aliases`, `alternate_emails`, `active`) without breaking foreign-keyed **Exception Rules** or **Shifts**, and cannot escalate their own `role`; regular **Members** can upsert their own **Availability Survey** while a **Planning Month** is `SIGN_UPS_OPEN` (automatically reactivating them if inactive) and are blocked by RLS once the status changes to `RESPONSES_RECEIVED`, `TEAMS_READY`, `EMAIL_SENT`, or `CLOSED`.
    2. **Custom Questions & Mentor Willingness**: Configuring `custom_questions` on a **Planning Month**, saving `willing_to_mentor` and `custom_answers` on an **Availability Survey**, and surfacing those fields in the Coordinator intake/solver views and Google Sheets export payloads.
    3. **Solver & Relational Persistence**: Running the shared **Matchmaker Solver** against relational `meal_dates`, `availability_surveys`, and UUID-keyed `exception_rules` (including `mentor_member_ids` **Mentor Whitelists**), and persisting solved **Shifts**.
    4. **Idempotent Sheets Import & Broadcast-Triggered Export**: Importing mock/fixture Google Sheets data twice produces zero duplicate **Members**, **Availability Surveys**, or **Shifts**; sending or marking a schedule broadcast automatically triggers the **Common Meal Sign-Up Workbook** export adapter and sets `status = 'EMAIL_SENT'`.
- **Browser E2E Seam (Playwright)**:
  - Keep the existing root `npm run test:e2e` Playwright suite running untouched to guarantee the Google Apps Script app never regresses.
  - Add a Playwright E2E test suite for the Next.js app testing the authenticated **Member** flow, the unrecognized user **"Request Access"** flow, and the **Meal Coordinator** 4-step wizard.

### Prior Art in Codebase
- Existing unit/domain tests in `test/*.test.mjs` using Node's native test runner (`npx tsx --test test/*.test.mjs`).
- Existing headless Chromium Playwright suite in `scripts/test-e2e.mjs`.

## Out of Scope

- Modifying or breaking the existing Google Apps Script (`src/client`, `src/server`) production workflow prior to cutover.
- Real-time two-way synchronization where edits inside Google Sheets automatically push back into Supabase via webhooks (sync from Sheets is an explicit idempotent import; sync to Sheets is an explicit one-way export).
- Replacing the **Common Meal Sign-Up Workbook** in Google Sheets with an in-app diner RSVP/attendance billing system (diner **Meal Sign-Ups** continue to live in the **Common Meal Sign-Up Workbook**).
- Server-side creation of drafts inside the coordinator's Gmail "Drafts" folder (replaced by direct SMTP send, copy-to-clipboard, and mark-as-broadcast).

## Further Notes

- Reference Architecture Decision Record: `docs/adr/0001-nextjs-supabase-migration-and-gas-coexistence.md`.
- Domain terminology throughout implementation must adhere strictly to `GLOSSARY.md`.
