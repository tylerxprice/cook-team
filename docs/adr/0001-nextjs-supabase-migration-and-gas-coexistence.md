---
status: accepted
---

# Migrate to Next.js and Supabase While Coexisting with Google Apps Script

We are migrating CookTeamTool from a Google Apps Script (GAS) web app backed by Google Sheets to a Next.js frontend on Vercel backed by Supabase Postgres and Google OAuth, while keeping the existing GAS application operational in the same repository (`src/client`, `src/server`) until cutover. Both applications share the pure TypeScript domain and solver modules (`matchmaker.ts`, `parser.ts`, `reports.ts`, `types.ts`), with Supabase Postgres serving as the single source of truth for the new app and a Google Cloud Service Account handling one-way exports back to Google Sheets.

## Considered Options

- **In-place replacement or separate branch**: Rejected because the live GAS app must remain deployable via `clasp` for monthly production scheduling while the Next.js + Supabase version is built and validated.
- **Two-way real-time sync between Supabase and Google Sheets**: Rejected due to conflict complexity and fragility around loose spreadsheet key-value settings; instead, an idempotent import utility seeds Supabase from live Google Sheets up through cutover, and Next.js performs explicit one-way exports to Google Sheets (and automatically updates the Common Meal Sign-Up Workbook when a schedule broadcast is sent or recorded).
- **Single-row column-per-setting vs. JSONB key-value settings**: Chosen `community_settings(key text PK, value jsonb)` validated by a TypeScript/Zod schema with defaults, plus `custom_questions` / `custom_answers` JSONB columns on `planning_months` and `availability_surveys`, so new settings and coordinator-defined survey questions do not require SQL schema migrations.

## Consequences

- Root-level GAS scripts (`npm run build`, `npm run deploy`, `npm run test:e2e`) remain untouched while Vercel deploys the isolated Next.js directory (`web/`) from GitHub.
- All application routes (including viewing published monthly schedules, editing Member profiles, and submitting Availability Surveys) require Google OAuth authentication matched against a Member's `google_email` or `alternate_emails`, enabling strict Supabase Row-Level Security (RLS) with no anonymous public read access to community data.
- A Vercel Cron keep-alive endpoint pings Supabase twice weekly to prevent the Supabase Free Tier from pausing after 7 days of inactivity between monthly scheduling cycles.
