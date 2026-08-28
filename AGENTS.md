# CookTeamTool — Agent & Developer Guide (`AGENTS.md`)

Welcome to **CookTeamTool**! This document provides context, architectural guidelines, domain rules, and standard workflows for AI pair programmers and human developers working in this repository.

---

## 1. Project Overview & Core Mission

**CookTeamTool** is a zero-cost, web-based planning application designed for community meal coordinators (Brenda) to generate optimal, constraint-compliant monthly cook and clean teams from Google Form availability surveys.

* **Full Specification:** [`docs/SPEC.md`](./docs/SPEC.md)
* **Target Users:** Community Meal Coordinators (non-technical coordinators managing 30+ residents).
* **Execution Environment:** Google Apps Script (GAS) Web App + Local Vite HMR development.

---

## 2. Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT / FRONTEND (src/client/)                             │
│ • React 18 + Tailwind CSS + Lucide Icons                    │
│ • Bundled into a single self-contained HTML (dist/index.html)│
│   via `vite-plugin-singlefile` for GAS `HtmlService`        │
│ • 4-Step Coordinator Wizard + Member Directory Modal        │
└──────────────────────────────┬──────────────────────────────┘
                               │ RPC Bridge (`callGas`)
┌──────────────────────────────▼──────────────────────────────┐
│ SERVER / BACKEND (src/server/)                              │
│ • Google Apps Script V8 Runtime (dist/Code.js)              │
│ • Constraint Satisfaction Problem (CSP) Matchmaker Solver   │
│ • SpreadsheetApp reader/writer for Survey & Master Sheets   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Key Domain Rules & Business Logic

### Team Sizes & Sizing Policies
* **Cook Team Size Policy:**
  * `DINNER_3_BRUNCH_2` (Default): Dinner = 3 cooks, Brunch = 2 cooks.
  * `TWO_REGARDLESS`: Dinner = 2 cooks, Brunch = 2 cooks.
* **Clean Team Size:** Dinner = 3 cleaners, Brunch = 2 cleaners.

### Quotas & Shift Capacity
* **Cook Quota:** Sourced from respondent's survey answer (*"How many meals can you cook this month?"*).
* **Clean Quota:** Default max 1 clean shift per month per member (balanced across community).
* **Same-Day Shift Rule:** By default, members **cannot** cook and clean on the same day unless:
  1. Member answered `"Yes"` to *"Can you cook and clean on the same day?"*, OR
  2. A `PREF_SAME_DAY` exception rule is configured.

### Member Lifecycle & Completeness Audit
* **Audit Nag Screen:** Shows active members who have not yet submitted a survey:
  $$\text{Missing Active Members} = \{ m \in \text{Members} \mid m.\text{active} = \text{true} \} \setminus \text{Survey Respondents}$$
* **`[Mark Inactive]` Action:** Sets `active: false` in the Master Sheet, instantly clearing dormant members from current and future missing audits.
* **Auto-Reactivation:** If an inactive/dormant member submits a survey in a future month, the parser automatically flips them back to `active: true`.
* **Unrecognized Members:** New respondents not in the registry are surfaced with an alert to add them to `Members`.

### Exception Rule Types (`src/server/types.ts`)
* `NOT_SAME_TEAM`: Person A and B cannot be on the same team (Cook or Clean).
* `NOT_SAME_DAY`: Person A and B cannot be scheduled on the same date for any shift.
* `SAME_DAY_DIFF_TEAM`: Person A and B must be on the same day if either is scheduled, but on different teams.
* `PAIR_WITH_ROLE`: Person A on Role X whenever Person B is on Role Y.
* `PREF_SAME_DAY`: Override non-overlap constraint for Person A.

---

## 4. Key Files Map

| Path | Purpose |
| :--- | :--- |
| [`docs/SPEC.md`](./docs/SPEC.md) | Product and technical specification. |
| [`src/server/types.ts`](./src/server/types.ts) | Canonical TypeScript data interfaces. |
| [`src/server/matchmaker.ts`](./src/server/matchmaker.ts) | Constraint Satisfaction Problem (CSP) solver engine. |
| [`src/server/parser.ts`](./src/server/parser.ts) | Google Form sheet parser & audit validator. |
| [`src/server/mockData.ts`](./src/server/mockData.ts) | 5 realistic synthetic mock scenarios for testing. |
| [`src/server/Code.ts`](./src/server/Code.ts) | Google Apps Script RPC entrypoints (`google.script.run`). |
| [`src/client/App.tsx`](./src/client/App.tsx) | 4-step coordinator wizard & member directory UI. |
| [`src/client/utils/gas.ts`](./src/client/utils/gas.ts) | Dual-mode RPC bridge (calls GAS in cloud, mocks locally). |

---

## 5. Development Workflows & Commands

### 1. Local Development (Fast HMR + Mock Bridge)
```bash
npm run dev
```
* Runs Vite dev server at `http://localhost:5173`.
* `callGas()` in `src/client/utils/gas.ts` intercepts all RPC calls and simulates server responses with stateful in-memory data.
* Includes scenario preset switcher (Standard, Holiday Desertion, Quota Deficit, High Conflict, Single Response).

### 2. Build & Type Checking
```bash
npm run build
```
* Compiles React frontend to single-file `dist/index.html`.
* Compiles TypeScript server to `dist/Code.js`.
* Copies `appsscript.json` to `dist/`.

### 3. Google Apps Script Deployment
```bash
clasp login        # One-time login to Google account
npm run deploy     # Builds bundles and pushes to GAS via clasp push
npm run open       # Opens project in Google Apps Script editor
```

### 4. Git Version Control
* Remote repository is hosted on **GitHub**.
* Always ensure `npm run build` succeeds before creating commits.
