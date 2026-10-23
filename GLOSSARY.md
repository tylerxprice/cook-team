# CookTeamTool

Monthly planning and scheduling domain for cohousing community meals, turning member availability surveys and pairing rules into balanced Cook Teams and Clean Teams.

## Language

### People & Roles

**Member**:
A resident or community participant registered in the Master Registry who can submit availability surveys and be scheduled onto meal teams.
_Avoid_: Resident, user, participant, neighbor, volunteer

**Active Member**:
A Member currently participating in the monthly meal rotation and expected to submit an Availability Survey each month.
_Avoid_: Current member, enabled member

**Inactive Member**:
A Member marked as dormant in the Master Registry who is skipped during the Completeness Audit until they submit a new Availability Survey.
_Avoid_: Dormant member, archived member, former member

**Meal Coordinator**:
The organizer responsible for staging monthly meal dates, auditing survey responses, configuring Exception Rules, running the Matchmaker Solver, and publishing the final schedule.
_Avoid_: Admin, planner, manager, scheduler

**Cook**:
A Member assigned to a Cook Team to plan, shop for, and prepare a community meal on a Meal Date.
_Avoid_: Chef, meal maker, kitchen lead

**Cleaner**:
A Member assigned to a Clean Team to wash dishes and clean the kitchen and dining space after a community meal.
_Avoid_: Dishwasher, clean-up crew, busser

**Teen**:
A younger Member who counts as a full core member of a Cook Team or Clean Team when paired with a patient, approved Mentor on the same team via a Mentor Whitelist.
_Avoid_: Youth, youth member, junior cook, minor

**Extra Helper**:
A Member of any age who feels they cannot contribute as a full core team member, attached as an additional helper onto an already fully-staffed Cook Team or Clean Team without counting toward the core team size requirement.
_Avoid_: Bonus cook, assistant, shadow, extra person

**Mentor**:
An experienced Member approved to be paired on the same team with a Teen (via a Mentor Whitelist) or an Extra Helper.
_Avoid_: Supervisor, chaperone, partner, co-worker

### Meals, Teams & Scheduling

**Meal Date**:
A specific calendar date and meal type (**Dinner** or **Brunch**) scheduled for a community meal within a planning month.
_Avoid_: Event, meal slot, shift day

**No-Meal Date**:
A calendar date in the monthly schedule where no community meal takes place, either planned in advance (such as a holiday) or cancelled due to insufficient availability.
_Avoid_: Blackout date, skipped meal, off day

**Cook Team**:
The group of core Cooks (plus at most one optional Extra Helper) assigned to prepare the meal on a Meal Date.
_Avoid_: Kitchen crew, cooking group

**Clean Team**:
The group of core Cleaners (plus at most one optional Extra Helper) assigned to clean up after the meal on a Meal Date.
_Avoid_: Clean-up team, dish team

**Shift**:
A single assignment of one Member to one role (Cook or Cleaner) on one Meal Date.
_Avoid_: Duty, turn, assignment

**Unfilled Slot**:
A required core Cook or Cleaner position on a Meal Date that remains vacant after the Matchmaker Solver runs.
_Avoid_: Shortage, empty shift, open spot

**Near-Complete Meal**:
A Meal Date that lacks a full Cook Team or Clean Team by only one or two Unfilled Slots and could become a complete meal if specific available Members take an extra Shift.
_Avoid_: Almost-full date, deficit opportunity, partial meal

**Cook Team Sizing Policy**:
The rule governing how many core Cooks are required per meal—either 3 on Dinners and 2 on Brunches, 2 on all meals, or adaptively allowing 2-person Dinners when all assigned Cooks opted in.
_Avoid_: Team size mode, cook count setting

### Surveys, Quotas & Rules

**Availability Survey**:
A Member's monthly submission declaring their per-date availability (`Available`, `Cook Only`, `Clean Only`, or `Unavailable`), shift Quotas, Same-Day Preference, and Special Instructions.
_Avoid_: Sign-up, shift sign-up, web sign-up, sign-up form, poll, questionnaire

**Completeness Audit**:
The intake check comparing Active Members in the Master Registry against submitted Availability Surveys to surface missing Active Members, auto-reactivated Members, and unrecognized respondents.
_Avoid_: Nag screen, attendance check, roster diff

**Quota**:
The maximum number of Shifts a Member volunteers to work in a single month, broken down into **Cook Quota**, **Clean Quota**, and optional **Max Total Shifts**.
_Avoid_: Capacity, shift limit, target count

**Oversubscription**:
When a Meal Coordinator manually assigns a Member more Shifts in a month than their requested Quota.
_Avoid_: Overload, over-allocation

**Same-Day Preference**:
A Member's stated willingness or preference to work both a Cook Shift and a Clean Shift on the same Meal Date.
_Avoid_: Double-shift setting, overlap preference

**Special Instructions**:
Freeform notes submitted by a Member on their Availability Survey describing pairing requests, scheduling caveats, or household constraints for the Meal Coordinator to review.
_Avoid_: Survey comments, member notes

**Exception Rule**:
A scheduling constraint between one or more Members—enforced as either a **Hard Rule** (strict requirement) or **Soft Rule** (preference)—that governs how the Matchmaker Solver pairs or separates them.
_Avoid_: Override, filter, custom constraint

**Mentor Whitelist**:
An Exception Rule requiring that a specific Member (typically a Teen) only be scheduled onto a team if at least one Member from their approved list of Mentors is also on that team.
_Avoid_: Approved partner list, supervision rule

### Engine & Workbooks

**Matchmaker Solver**:
The constraint-satisfaction scheduling engine that assigns Members to Cook Teams and Clean Teams across a month's Meal Dates while respecting Availability Surveys, Quotas, Cook Team Sizing Policy, and Exception Rules.
_Avoid_: Auto-scheduler, algorithm, optimizer, generator

**Master Registry**:
The persistent spreadsheet that stores the canonical directory of Members, standing Exception Rules, and global settings across months.
_Avoid_: Master sheet, member database, config workbook

**Monthly Survey Sheet**:
The spreadsheet for a single planning month that holds raw Availability Survey responses and the solved team schedule tab.
_Avoid_: Response sheet, monthly workbook

**Meal Sign-Up**:
A Member's per-meal registration to attend and eat a specific community meal before its deadline, recorded in the Common Meal Sign-Up Workbook (never used to mean submitting an Availability Survey).
_Avoid_: Diner registration, meal RSVP, attendance entry

**Common Meal Sign-Up Workbook**:
The community-facing spreadsheet where the finalized monthly Cook Teams and Clean Teams are published so Members can record their Meal Sign-Ups to attend and eat each meal.
_Avoid_: Diner sign-up sheet, attendance workbook, meal sign-up sheet
