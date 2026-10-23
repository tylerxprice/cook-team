# 05: Idempotent Google Sheets → Supabase Importer & Community Equity Reports

**What to build:** Developers and **Meal Coordinators** can run an idempotent import utility (both via a CLI command and via an Admin import action in the Coordinator UI) that uses the Google Cloud Service Account to read the live Google Apps Script **Master Registry** spreadsheet (`Members`, `Exceptions`, `Settings`), historical schedule tabs (`2026-01` onward), and any selected Google Form **Monthly Survey Sheet**, and upserts them into Supabase Postgres without creating duplicate records. Using the relational historical **Shifts** in Postgres, the **Meal Coordinator** can also view the multi-month **Community Equity Report** (total meals served, per-member **Cook** and **Cleaner** counts, monthly breakdowns, and equity badges).

**Blocked by:** 03: Planning Month Staging, Custom Survey Questions & Member Availability Survey, 04: Coordinator Scheduling Wizard (Steps 1–3), Matchmaker Solver & Authenticated Schedule View

**Status:** ready-for-agent

- [ ] A server-side Google Sheets/Drive Service Account adapter authenticates via service account credentials and exposes clean read methods behind an injectable interface for testing.
- [ ] The importer upserts `members` (matching by email or name/alias), `exception_rules` (resolving `person_a`, `person_b`, and **Mentor Whitelist** names to **Member** UUIDs), and `community_settings` from the **Master Registry** spreadsheet.
- [ ] The importer parses historical schedule tabs (`2026-01` onward) and upserts the corresponding `planning_months`, `meal_dates`, and `shifts` in Supabase Postgres.
- [ ] The importer (and an optional Step 1 sync button) can import a Google Form **Monthly Survey Sheet** for a **Planning Month**, merging form responses into `availability_surveys` and `availability_entries` without duplicating existing **Member** surveys.
- [ ] Running the import multiple times against the same spreadsheet data is strictly idempotent (zero duplicate **Members**, **Exception Rules**, **Planning Months**, **Meal Dates**, **Availability Surveys**, or **Shifts**).
- [ ] The **Community Equity Report** view computes multi-month statistics and badges directly from relational `planning_months`, `meal_dates`, and `shifts` in Postgres using the shared reporting logic.
- [ ] Integration tests against local Supabase Postgres with fixture spreadsheet payloads verify idempotent repeated imports and accurate **Community Equity Report** calculations.
