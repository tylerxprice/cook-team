# CookTeamTool — User Guide & Coordinator Manual

Welcome to **CookTeamTool**! This manual walks you through the entire end-to-end workflow for scheduling community meals, auditing survey responses, resolving volunteer shortages, publishing rosters, and announcing schedules to the community.

* **Live Web App URL:** [Open CookTeamTool in Browser](https://script.google.com/macros/s/AKfycbwFUo53qovtiFScRr8UufB62fdjjZiCQINHbkpj0U0nuJ6drjxkrJMj7LbJAPPQYN-8lQ/exec)
* **Master Community Registry:** `01_Live_Production/Master_Community_Registry`
* **Monthly Survey Folder:** `01_Live_Production/Monthly_Surveys`

---

## 1. The Monthly Coordinator Lifecycle (Overview)

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Survey Generation (Modal 9)                                         │
│    Auto-generate next month's Google Form & Response Sheet.            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ 2. Step 1: Intake & Completeness Audit                                 │
│    Load responses, audit missing active members, manage directory.     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ 3. Step 2: Special Instructions & Exception Rules                      │
│    Review childcare constraints, kitchen prefs, and pair rules.        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ 4. Step 3: Solve & Review Schedule                                     │
│    Run matchmaker solver, review roster, fill shortages, check quotas. │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ 5. Step 4: Publish & Listserv Announcement                             │
│    Export schedule tab to Google Sheet, create draft, send Gmail.      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ 6. Meal Sign-Up Sheet Generator (Modal 8)                              │
│    Generate monthly diner sign-up workbook for Rose & the community.   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Step 1: Intake & Completeness Audit

### Selecting the Survey Spreadsheet
* In the **Survey Spreadsheet** card, select a monthly survey from the dropdown (or paste any Google Sheet ID/URL).
* Click **[Load Survey Responses]**.

### The Completeness Audit ("Nag Screen")
The intake audit automatically compares your active community members against survey respondents:
$$\text{Missing Active Members} = \{ m \in \text{Members} \mid m.\text{active} = \text{true} \} \setminus \text{Survey Respondents}$$

* **Missing Active Members List:** Displays members who have not yet submitted their monthly survey so you can send them a gentle reminder.
* **`[Mark Inactive]` Button:** If a member is away for the season, on sabbatical, or dormant, click **Mark Inactive** to update the Master Registry. They will instantly be cleared from current and future missing audits.
* **Auto-Reactivation:** When an inactive member submits a survey in any future month, the tool automatically re-activates them in the registry (`active: true`).
* **Unrecognized Respondents:** If someone submits a survey under a new nickname or alternate email, an alert lets you link their alias to an existing resident or add them as a new member with one click.

### Member Directory & Roster Import (Modal 1)
* Click **[Member Directory]** in the top navigation bar at any time to:
  * View and search all registered residents.
  * Update Google email addresses and alternate emails.
  * Add aliases/nicknames (e.g., `Alex`, `Sasha`).
  * Use **[Bulk Import]** to copy/paste roster lists from Google Groups or CSV spreadsheets.

---

## 3. Step 2: Special Notes & Exception Rules

### Reviewing Special Instructions
* Displays all special requests submitted in the survey (*"must work with partner for childcare"*, *"cannot work with Person X"*, *"prefers cooking over cleaning"*, etc.).

### Managing Exception Rules (Modal 2)
Click **[+ Add Exception Rule]** to configure coordinator rules:
* **`NOT_SAME_TEAM`**: Person A and Person B cannot be scheduled on the same cook or clean team.
* **`NOT_SAME_DAY`**: Person A and Person B cannot be scheduled on the same date for any shift.
* **`SAME_DAY_DIFF_TEAM`**: Person A and Person B must work on the same day if either is scheduled, but on opposite teams (e.g., one cooks, one cleans).
* **`PAIR_WITH_ROLE`**: Person A is assigned to Role X whenever Person B is on Role Y.
* **`PREF_SAME_DAY`**: Overrides the default non-overlap constraint for Person A.

> **Hard vs. Soft Rules:** Hard rules are strictly enforced by the solver; soft rules are prioritized during optimization but will not cause schedule failures if unresolvable.

---

## 4. Step 3: Solve & Review Schedule

Click **[Run Matchmaker Solver]** to generate the optimal monthly schedule.

### Team Sizing Policies & Sizing Defaults
* **Cook Team Size:**
  * **Adaptive 3 or 2 (Default & Recommended):** Targets 3 cooks on Dinners and 2 cooks on Brunches. On tight dates, dynamically accepts 2 cooks on a Dinner without errors *if* all assigned cooks agreed to `"2 regardless of meal type"`.
  * **Dinner = 3, Brunch = 2 (Strict):** Strict 3 cooks on all Dinners, 2 on Brunches.
  * **2 Regardless (Strict):** Strict 2 cooks on every meal.
* **Clean Team Size:** Dinner = 3 cleaners, Brunch = 2 cleaners.

### Interactive Schedule Roster
* Each meal card displays the date, meal type, assigned cooks, and assigned cleaners.
* **Volunteer Shift Badges:** Click any member's name badge in the schedule to open the **Member Calendar Inspector (Modal 3)**, showing their availability, assigned dates, and same-day shifts.

### Resolving Shortages & Customizing Shifts
* **`[+ Fill Missing Slot]` (Modal 4):** Click directly on an unfilled cook or clean slot to see available volunteers ranked by quota deficit and add them with one click.
* **`[Swap Shifts]` (Modal 6):** Swap two scheduled members between dates with full availability validation.
* **`[Cancel Meal]` / `[Restore Meal]`:** If a date has a critical volunteer deficit, clicking **Cancel Meal** marks the date as `NO COMMUNITY MEAL` and releases assigned volunteers back into the quota pool to fulfill other meals. Clicking **Restore Meal** recovers the date and auto-populates it with available volunteers.
* **Near-Complete Meal Opportunities (Modal 10):** For dates missing only 1 volunteer, click **[View 1-Volunteer Opportunity]** to view tailored outreach copy you can text or email to candidates.

### Member Quota & Equity Table
* Shows requested cook quota, requested clean quota, available dates, and actual assigned shifts.
* **Oversubscribed Badges:** Highlights members assigned more shifts than requested so you can balance workloads fairly.

---

## 5. Step 4: Publish & Listserv Announcement

### 1. Export Schedule to Google Sheets
* Click **[Export Schedule to Google Sheet]**.
* Automatically appends a clean, formatted `Schedule_YYYY-MM` tab to your monthly survey spreadsheet with frozen headers and date formats.

### 2. Email Listserv Announcement
* **Clean Announcement Greeting:** Standardized greeting (*"Hi precious friends & neighbours,"*).
* **Clean Date Formatting:** Concise headers (e.g., `Oct 1 (Thur) (Dinner)`) with distinct `NO COMMUNITY MEAL` tags on cancelled dates.
* **One-Click Actions:**
  * **[Copy Email Text]:** Copies the plain-text announcement to your clipboard.
  * **[Create Gmail Draft]:** Creates a formatted draft in your Gmail account for review.
  * **[Send via Gmail]:** Sends the announcement directly to the listserv (`community-residents@googlegroups.com`).
* **Duplicate Email Safeguard:** If an announcement has already been sent for the month, the tool displays an alert banner and requires explicit confirmation in the **Duplicate Email Send Modal (Modal 11)** before resending.

---

## 6. Auxiliary Coordinator Tools

### Community Reports & Equity Leaderboard (Modal 7)
* Access from the top bar icon or button.
* Analyzes multi-month participation across all historical and active surveys.
* Generates the **Equity Leaderboard** with volunteer recognition badges:
  * 🌟 **Super Volunteer:** 15+ total shifts.
  * 🍳 **Cook Master:** 8+ cook shifts.
  * 🧼 **Clean Master:** 8+ clean shifts.
  * ⚡ **Same-Day Star:** 3+ same-day cook & clean shifts.
  * ⚖️ **Equity Leader:** Active across 6+ months with balanced participation.

### Monthly Meal Sign-Up Workbook Generator (Modal 8)
* Generates the monthly diner sign-up sheet used by Rose and the community.
* Pre-populates all meal dates, meal types, assigned cook/clean teams, sign-up deadlines, and special day labels (e.g., *Truth & Reconciliation Day*).

### Survey Form Generator (Modal 9)
* Automatically generates next month's Google Form availability survey and linked Google Sheet.
* Pre-configures standard Thursday Dinners and Sunday Brunches with dates, times, and sizing preference questions.

---

## 7. Frequently Asked Questions (FAQ)

**Q: What if a resident changes their mind after the schedule is published?**  
A: Use the **[Swap Shifts]** modal (Modal 6) or **Member Calendar Inspector** (Modal 3) to reassign the shift, then re-export the schedule tab and copy the updated date note.

**Q: How do I handle couples or roommates who want to work together?**  
A: On Step 2, click **[+ Add Exception Rule]** and select `PAIR_WITH_ROLE` or `SAME_DAY_DIFF_TEAM`.

**Q: Why is someone marked "Over Quota"?**  
A: If a coordinator manually assigns an extra shift to fill a shortage on a difficult date, the member's assigned count exceeds their requested quota. The yellow oversubscribed badge makes this visible so you can balance it in future months.

---

*CookTeamTool is maintained for Community Meal Planning.*
