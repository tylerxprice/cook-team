# Product & Technical Specification: Community Meal Team Scheduler (`CookTeamTool`)

## 1. Overview & Objectives

**CookTeamTool** is a zero-cost, web-based planning application designed for community meal coordinators (Brenda) to generate optimal, constraint-compliant monthly cook and clean teams from Google Form availability surveys.

---

## 2. System Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT / FRONTEND (Browser UI)                              │
│ • Single-Page App served via Google Apps Script HtmlService │
│ • React 18 + Tailwind CSS (bundled via Vite Singlefile)     │
│ • Step wizard: Intake -> Audit -> Rules -> Solver -> Export │
│ • Modal dialogs for exception management & member directory │
└──────────────────────────────┬──────────────────────────────┘
                               │ google.script.run (RPC)
┌──────────────────────────────▼──────────────────────────────┐
│ SERVER / BACKEND (Google Apps Script V8 Runtime)            │
│ • Code.gs: API handler, Google Sheets reader/writer         │
│ • Matchmaker Engine: Constraint Solver (CSP/Backtracking)   │
│ • Execution Mode: Runs as script owner                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Direct DriveApp / SpreadsheetApp
┌──────────────────────────────▼──────────────────────────────┐
│ DATA STORAGE & INTEGRATION (Google Workspace)               │
│ • Google Form: Community monthly availability survey        │
│ • Survey Spreadsheet: Raw responses linked from Form        │
│ • Master Cohousing Sheet: Member directory & Exceptions tab │
└─────────────────────────────────────────────────────────────┘
```

* **Frontend:** React 18, Tailwind CSS, Lucide icons, bundled into a single self-contained HTML file via `vite-plugin-singlefile` and served via Google Apps Script `HtmlService`.
* **Backend Runtime:** Google Apps Script (V8 Engine, Serverless JavaScript/TypeScript).
* **Developer Tooling & Deployment:**
  * **CLI & Deployment:** `@google/clasp` for local development, pushing code, and versioned deployments (`/dev` for dev, `/exec` for production).
  * **Source Control:** Git repository.
  * **Dev Environment:** Devcontainer (Ubuntu 24.04 LTS, Node.js 22 LTS, `clasp`, `git`, `agy`) with local Vite mock mode (`npm run dev`).

---

## 3. Data Schema & Structures

### 3.1. Master Spreadsheet Tabs

#### `Members` Tab (Community Member Registry)

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Full name (e.g., `"Tyler"`, `"Brenda"`, `"Cyrena"`) |
| `google_email` | String | Associated Google account email |
| `active` | Boolean | `true` if active participant, `false` if dormant / long-term inactive |
| `last_active_survey` | String (Nullable) | Month/year of last submitted survey (e.g., `"2026-08"`) |

#### `Exceptions` Tab (Persistent & Ad-Hoc Rule Registry)

| Field | Type | Options / Example |
| :--- | :--- | :--- |
| `person_a` | String | `"Tyler"` |
| `person_b` | String (Nullable) | `"Rose"` |
| `rule_type` | Enum | `NOT_SAME_TEAM`, `NOT_SAME_DAY`, `SAME_DAY_DIFF_TEAM`, `PAIR_WITH_ROLE`, `PREF_SAME_DAY` |
| `target_role_a` | Enum (Nullable) | `COOK`, `CLEAN`, `ANY` |
| `target_role_b` | Enum (Nullable) | `COOK`, `CLEAN`, `ANY` |
| `is_hard_rule` | Boolean | `true` (strict constraint) vs `false` (soft preference) |
| `notes` | String (Nullable) | Freeform rationale or duration (e.g. `"Roommates"`, `"Childcare"`) |

#### `Settings` Tab (Global Configuration Registry)

| Field | Type | Description / Example |
| :--- | :--- | :--- |
| `key` | String | Setting key (e.g. `"cook_policy"`, `"default_clean_quota"`) |
| `value` | String / Number | Setting value (e.g. `"ADAPTIVE_3_OR_2"`, `1`) |
| `description` | String (Nullable) | Rationale or documentation |

### 3.2. Google Drive Workspace Architecture & Folder Hierarchy

The tool organizes all spreadsheets within a designated Google Drive root folder (`1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl`) partitioned into production and testing environments:

```
📁 CookTeamTool Root Workspace (1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl)
│
├── 📁 01_Live_Production/
│   ├── 📄 Master Community Registry (Live)
│   │   ├── 📑 Members       (name, google_email, active, last_active_survey)
│   │   ├── 📑 Exceptions    (person_a, person_b, rule_type, roles, is_hard, notes)
│   │   └── 📑 Settings      (cook_policy, default_clean_quota)
│   └── 📁 Monthly_Surveys/
│       └── 📄 2026-10 Cook Team Survey (Responses)   <-- Live Google Form response sheet
│
└── 📁 02_Dev_and_Testing/
    ├── 📄 Master Community Registry (Dev/Test)
    ├── 📄 Test Scenario - Standard (30 Responses, 13 meals, 0 shortages)
    ├── 📄 Test Scenario - Holiday Shortage (Thanksgiving deficit, 7 unfilled slots)
    ├── 📄 Test Scenario - Quota Deficit (Community undersubscribed, 25 unfilled slots)
    ├── 📄 Test Scenario - High Conflict (Roommates & complex constraints)
    └── 📄 Test Scenario - Single Respondent (Single respondent edge case)
```

### 3.3. Dev vs. Live Environment Isolation

| Dimension | **Live Production** | **Dev & Testing** |
| :--- | :--- | :--- |
| **Master Registry** | Live community roster & persistent exception rules. | Sandbox copy for testing member status flips and rule changes safely. |
| **Survey Inputs** | Live Google Form responses linked monthly. | Synthetic test scenario sheets mirroring real Form response headers. |
| **Mutation Scope** | `[Mark Inactive]`, `[+ Add Member]`, and `[Add Rule]` persist directly to Live Sheet. | Mutations only modify the Dev Master Sheet. |
| **Configuration** | Configured via Script Property `MASTER_REGISTRY_SHEET_ID` or UI. | Switchable via Global Settings or preset selector. |

---

## 4. Core Shift Rules & Constraints

### 4.1. Team Size Definitions & Policy Options

* **Cook Team Size Policy:**
  * Option A (Default): **Dinner = 3 cooks, Brunch = 2 cooks**
  * Option B: **2 cooks regardless of meal type** (Dinner = 2, Brunch = 2)
  * *Coordinator can toggle this policy or follow survey consensus.*
* **Clean Team Size:**
  * **Dinner Clean Team:** 3 cleaners
  * **Brunch Clean Team:** 2 cleaners

### 4.2. Default Global Constraints & Quotas

* **Clean Shift Quota:** Sourced from respondent's survey answer (*"How many meals can you clean this month?"* — options: **0, 1, 2**, defaulting to 1 for legacy responses).
* **Cook Shift Quota:** Sourced from respondent's survey answer (*"How many meals can you cook this month?"*).
* **Different Shift Rule (Default):** A person cannot be scheduled to `COOK` and `CLEAN` on the same day unless:
  * The member answered `"Yes"` to *"Can you cook and clean on the same day?"* in their survey, OR
  * An explicit `PREF_SAME_DAY` exception rule is configured.
* **Capacity Constraint & Coordinator Oversubscription:** The solver adheres to member quotas; however, coordinators can manually override rosters and oversubscribe members based on offline discussions.

### 4.3. Manual Coordinator Overrides & Volunteer Oversubscription

* **Interactive Slot Filling (1-Click Assignment Modal):** Unfilled cook and cleaner slots on day cards are interactive buttons (`[+ Fill Missing Cook Slot]`, `[+ Fill Missing Cleaner Slot]`). Clicking opens a candidate picker showing available respondents on that date, their current shift counts, and real-time rule conflict validation.
* **Volunteer Oversubscription:** Coordinators can assign members who have already fulfilled their requested quota. The system tracks this and highlights the volunteer with a **`⭐ Oversubscribed (e.g., 2/1 Cleans, 3/2 Cooks)`** badge in the Quota & Shift Distribution Summary table.
* **Meal Completeness & Pending Status:** A meal date is incomplete if it lacks a complete cook team or cleaner team. Shifts assigned on incomplete dates are flagged as **`⚠️ Pending (N on Incomplete Meals)`** to notify the coordinator that human intervention / volunteer recruitment is needed before the meal is viable.

### 4.4. Exception Rule Types & Supported Logic

| Rule Pattern | Constraint Formulation |
| :--- | :--- |
| **A and B NOT on same TEAM** (`NOT_SAME_TEAM`) | For all days $d$, roles $r$: $\text{Assign}(A, d, r) + \text{Assign}(B, d, r) \le 1$ |
| **A and B NOT on same DAY** (`NOT_SAME_DAY`) | For all days $d$: $\text{Assigned}(A, d) + \text{Assigned}(B, d) \le 1$ |
| **A and B SAME DAY, DIFF TEAM** (`SAME_DAY_DIFF_TEAM`) | For all days $d$: $\text{Assigned}(A, d) = \text{Assigned}(B, d)$ AND $\text{Assign}(A, d, r) + \text{Assign}(B, d, r) \le 1$ |
| **A on CLEAN when B on COOK** (`PAIR_WITH_ROLE`) | For all days $d$: $\text{Assign}(A, d, \text{CLEAN}) = \text{Assign}(B, d, \text{COOK})$ |
| **A prefers COOK & CLEAN same day** (`PREF_SAME_DAY`) | Override default non-overlap constraint for Person A |

---

## 5. End-to-End User Workflows

```
  [ Monthly Google Form Survey Sent ] 
                 │
                 ▼
  ┌─────────────────────────────────┐
  │ 1. Survey Intake & Validation   │ ──── Format Invalid? ──► [ Show Diagnostic Banner / Alert Lead ]
  └──────────────┬──────────────────┘
                 │ Valid
                 ▼
  ┌─────────────────────────────────┐
  │ 2. Completeness Audit           │ ◄─── Auto-Reactivate Inactive Survey Respondents
  │    (Missing Active Members)     │ ──── [Mark Inactive] ──► Set active=false (Clear from list)
  └──────────────┬──────────────────┘ ──── [Add Manual Rows]
                 │ Audit Passed / Confirmed
                 ▼
  ┌─────────────────────────────────┐
  │ 3. Review Notes & Rules         │ ◄─── Special Instructions from Survey
  │    (Configure Exceptions)       │ ──── Add / Edit / Toggle Hard vs Soft Rules
  └──────────────┬──────────────────┘
                 │ Confirm Rules
                 ▼
  ┌─────────────────────────────────┐
  │ 4. Run Matchmaker Solver        │ ──── Backtracking / CSP Solver Engine
  └──────────────┬──────────────────┘
                 │
                 ▼
  ┌─────────────────────────────────┐
  │ 5. Review, Inspect & Adjust     │ ──── Need adjustments? ──► [ Add Exception -> Re-Solve ]
  └──────────────┬──────────────────┘
                 │ Satisfied
                 ▼
  ┌─────────────────────────────────┐
  │ 6. Export & Publish             │ ──── Write to Google Sheet ('Schedule_Output')
  └─────────────────────────────────┘ ──── [Copy Email Summary to Clipboard]
```

### 5.1. Survey Generation & Intake

1. Coordinator builds new Google Form survey based on previous month.
2. Results automatically populate linked Google Sheet.

### 5.2. Matchmaking Workflow (Brenda's Experience)

1. **Open Tool:** Brenda accesses the Web App URL (`/exec`).
2. **Sheet Intake & Validation:** Brenda inputs next month's survey sheet URL/ID.
   * *Validation Gate:* Validates headers and data structure. If invalid, displays diagnostic banner with specific format errors.
   * *Auto-Reactivation Trigger:* If any respondent is present in the `Members` registry with `active == false`, the system automatically reactivates them (`active: true`), updates `last_active_survey`, and surfaces a badge: *"✨ Reactivated returning member: [Name]"*.
   * *Unrecognized Respondent Check:* If an incoming respondent is not found in the `Members` registry, prompts Brenda to add them as a new active member.

3. **Completeness Audit (Missing Active Members):**
   * Computes missing active members:
     $$\text{Missing Active Members} = \{ m \in \text{Members} \mid m.\text{active} = \text{true} \} \setminus \text{Survey Respondents}$$
   * *Interactive Audit List:* For each missing active member, Brenda has two clear options:
     1. `[Manually Add Responses]`: Enter their shift preferences and quota on their behalf.
     2. `[Mark Inactive]`: Flips `active: false` in the Master Sheet, instantly clearing them from the missing list for this month and skipping them in future months.

4. **Special Instructions & Exception Editor:**
   * App displays all raw text submitted in the survey's "Special Instructions" column.
   * UI displays current active exception rules with options to `[+ Add New Rule]` or edit existing ones.

5. **Solve Engine:** Brenda clicks `[Run Matchmaker]`. The constraint satisfaction engine computes assignments across all calendar days.
6. **Result Inspection & Iteration:**
   * Visual calendar & team breakdown displayed.
   * If a team conflict or soft preference violation is spotted, Brenda adds/adjusts an exception and clicks `[Re-Run]`.

7. **Export & Output:**
   * App writes final schedule tab into the Google Sheet (`Schedule_Output`).
   * App generates a pre-formatted plain text / Markdown summary with a `[Copy Email to Clipboard]` button for the community listserv.

### 5.3. Member Directory & Maintenance Workflows

* **Member Directory Tab / Modal:**
  * Search and filter members by `Active` and `Inactive` status.
  * One-click toggle between `Active` and `Inactive`.
  * Add new members with `Name` and `Google Account Email`.
  * View historical engagement (`last_active_survey`).

---

## 6. Implementation & Status Tracking

* Detailed implementation milestones, completed work, and remaining tasks are tracked in [`docs/ROADMAP.md`](./ROADMAP.md).
