# CookTeamTool — Implementation Roadmap & Task Tracker (`ROADMAP.md`)

This document tracks completed milestones, current progress, and remaining implementation items for **CookTeamTool**.

---

## 📊 Milestone Summary

| Phase | Description | Status | Progress |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Data Modeling, Parser & Test Fixtures | **Completed** | 100% |
| **Phase 2** | Matchmaker Constraint Solver Engine | **Completed** | 100% |
| **Phase 3** | 4-Step Coordinator Wizard & Client Bridge | **Completed** | 100% |
| **Phase 4** | GAS Deployment, Master Sheet & Live UAT | **In Progress** | 25% |

---

## 🛠 Detailed Progress Tracker

### ✅ Phase 1: Data Model, Parser & Local Scaffolding
- [x] **TypeScript Interface Schema ([`src/server/types.ts`](../src/server/types.ts))**:
  - `Member`, `ExceptionRule`, `MealDate`, `SurveyResponse`, `ScheduleOutput`, `CompletenessAudit`.
- [x] **Google Form Sheet Parser ([`src/server/parser.ts`](../src/server/parser.ts))**:
  - Dynamic date header parsing (`Select your available dates [...]`), meal type deduction (Dinner vs Brunch), and special note extraction.
  - Normalization of availability (`AVAILABLE`, `COOK_ONLY`, `CLEAN_ONLY`, `UNAVAILABLE`).
  - Quota extraction and same-day shift preference parsing.
- [x] **Completeness Audit & Member Lifecycle Logic**:
  - Filtering missing active members ($\text{Active} \setminus \text{Respondents}$).
  - Automatic reactivation of returning dormant members upon survey submission.
  - Unrecognized respondent detection.
- [x] **Synthetic Test Presets ([`src/server/mockData.ts`](../src/server/mockData.ts))**:
  - `standard`: 30 respondents, 13 meals, 0 unfilled slots.
  - `holiday_shortage`: Thanksgiving weekend availability deficit (Oct 11–12).
  - `quota_deficit`: Community under-subscribed cook quotas.
  - `high_conflict`: 8 entangled roommate & childcare hard constraints.
  - `single_respondent`: Tyler's single live Google Sheet response.
- [x] **Build & Bundle Pipeline**:
  - Singlefile React + Tailwind client bundle (`dist/index.html`).
  - GAS V8 backend bundle (`dist/Code.js`).

---

### ✅ Phase 2: Matchmaker Constraint Solver Engine
- [x] **Backtracking CSP Algorithm ([`src/server/matchmaker.ts`](../src/server/matchmaker.ts))**:
  - Sub-5ms execution for 13 meals and 74 shift assignments.
  - Most-constrained-first ordering with dynamic constraint propagation.
- [x] **Cook Team Sizing Policy Support**:
  - `DINNER_3_BRUNCH_2`: Dinner = 3 cooks, Brunch = 2 cooks (Default).
  - `TWO_REGARDLESS`: 2 cooks regardless of meal type.
- [x] **Quota Balancing**:
  - Enforces requested cook quotas from survey responses.
  - Balances clean shifts across community members (default max 1 clean shift/month).
- [x] **Constraint & Exception Enforcement**:
  - Hard constraint checks (`NOT_SAME_DAY`, `NOT_SAME_TEAM`) evaluated dynamically at assignment time.
  - Same-day cook & clean non-overlap enforcement with `PREF_SAME_DAY` / survey answer override.
  - Soft preference violation reporting (`PAIR_WITH_ROLE`, `SAME_DAY_DIFF_TEAM`).
- [x] **Automated Solver Test Verification**:
  - Verified across all 5 test presets with zero hard rule violations and sub-5ms latency.

---

### ✅ Phase 3: Web App UI & Dual-Mode RPC Bridge
- [x] **4-Step Coordinator Wizard ([`src/client/App.tsx`](../src/client/App.tsx))**:
  - **Step 1 (Intake & Audit)**: Google Sheet URL input, missing active member nag list with one-click `[Mark Inactive]`, auto-reactivated badges, and test scenario switcher.
  - **Step 2 (Notes & Rules)**: Review respondent special instructions and interactive Exception Rule editor (Hard vs Soft toggles).
  - **Step 3 (Solve & Review)**: Cook policy selector, `[Run Matchmaker]`, visual calendar shift cards, unfilled slot warnings, and quota fulfillment summary.
  - **Step 4 (Publish & Share)**: Google Sheet tab exporter (`Schedule_YYYY-MM`) and formatted listserv email generator with 1-click clipboard copy.
- [x] **Member Directory Modal**:
  - Filter active vs. inactive members, one-click status toggle, and new member addition form.
- [x] **Dual-Mode RPC Bridge ([`src/client/utils/gas.ts`](../src/client/utils/gas.ts))**:
  - Seamless fallback between production `google.script.run` and stateful in-memory local mock with instant hot module reloading.
- [x] **GAS Server RPC Endpoints ([`src/server/Code.ts`](../src/server/Code.ts))**:
  - `getIntakeData`, `solveSchedule`, `setMemberActiveStatus`, `saveExceptionRule`, `exportScheduleToSheet`.

---

### ⏳ Phase 4: Google Cloud Integration, Sheet Binding & UAT (Current Focus)
- [ ] **Master Google Sheet Setup**:
  - Establish canonical Master Sheet with `Members` and `Exceptions` tabs.
  - Populate initial 30 community member rows.
- [ ] **Google Apps Script Project Linking**:
  - Log in via `clasp login`.
  - Link script ID in `.clasp.json`.
- [ ] **End-to-End Live Sheet Integration**:
  - Test live `SpreadsheetApp` read against Google Form linked responses.
  - Test live `Schedule_YYYY-MM` tab export.
- [ ] **Web App Deployment**:
  - Deploy production version via `clasp push` / Apps Script Web App (`/exec`).
  - Configure execution permissions ("Execute as me", access for coordinator).
- [ ] **User Acceptance Testing (UAT)**:
  - Walkthrough with coordinator (Brenda) on October survey generation.
  - Gather feedback on UI clarity and export workflow.

---

## 🎯 Next Immediate Tasks

1. **Link `clasp` to Apps Script Project**: Create or bind an Apps Script project ID (`.clasp.json`).
2. **Setup Master Sheet Template**: Create the `Members` and `Exceptions` tabs in Google Drive.
3. **Conduct Live Test Run**: Ingest the live survey link and export a real schedule tab.
