# 02: Member Self-Service Profile & Master Registry Directory

**What to build:** Signed-in **Members** can visit their profile view to inspect and update their own `name`, `aliases`, `alternate_emails`, and `active` status (`Active Member` vs `Inactive Member`) without breaking any relational references across the system. **Meal Coordinators** can open the **Master Registry** management views to add, edit, or deactivate **Members** (including `role` and `is_beta_tester`), configure standing **Exception Rules** (`NOT_SAME_TEAM`, `NOT_SAME_DAY`, `SAME_DAY_DIFF_TEAM`, `PAIR_WITH_ROLE`, `PREF_SAME_DAY`, `REQUIRE_ONE_OF_TEAM` **Mentor Whitelist**, and `EXTRA_HELPER`) linked by **Member** UUIDs, and edit community-wide settings (`communityName`, `announcementTo`, `announcementCc`, `cookPolicy`, `defaultCleanQuota`, `autoCancelDeficitDates`, `signupWorkbookId`) stored as JSONB values validated against a typed schema with defaults.

**Blocked by:** 01: Next.js + Local Supabase Tracer Bullet: Google OAuth Sign-In, Member Matching & Access Requests

**Status:** ready-for-agent

- [ ] Database migration adds `exception_rules` (referencing `members(id)` via UUID foreign keys and storing **Mentor Whitelist** `mentor_member_ids` as a UUID array) and `community_settings` (`key text PK, value jsonb`) with RLS policies.
- [ ] Community settings are read and written through a TypeScript/Zod schema with default fallbacks so adding new settings requires no SQL schema changes.
- [ ] A signed-in **Member** can update their own `name`, `aliases`, `alternate_emails`, and `active` status, and renaming a **Member** preserves all `exception_rules` referencing their UUID.
- [ ] RLS and server actions prevent a regular **Member** (`role = 'MEMBER'`) from modifying another **Member's** record, changing their own `role` or `is_beta_tester` flag, or mutating `exception_rules` and `community_settings`.
- [ ] A **Meal Coordinator** (`role = 'COORDINATOR'`) can create, update, and filter **Members**, create/edit/delete UUID-linked **Exception Rules** (including selecting multiple **Mentors** for a **Mentor Whitelist**), and update `community_settings`.
- [ ] Integration tests against local Supabase Postgres verify profile self-editing, UUID preservation across renames, coordinator **Master Registry** CRUD, and RLS enforcement between `MEMBER` and `COORDINATOR` roles.
