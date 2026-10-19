# Project state

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | Pipeline stage keys are `in_progress`, `sent`, `accepted`, `completed`, `refused`, in that order; the Phase 1 domain layer owns them and the UI imports them | a stage spans agreement and contract statuses, so it cannot reuse either enum; UI, filters and later URL params bind to these names | active | 2026-10-19 |
| AD-002 | Colours, radii and shadows are read only through the Tailwind `@theme` role tokens in `web/app/globals.css`; no hex literal or default-palette class in components | one source of truth, and role names let customer-facing surfaces swap in the tenant accent | active | 2026-10-19 |
| AD-003 | Every tenant table has `org_id uuid not null references orgs on delete cascade`, and every child-to-parent reference is a composite FK on `(parent_id, org_id)` against a parent `unique (id, org_id)` | a reference cannot cross orgs even when RLS is bypassed (service role, seeds); every later table copies this | active | 2026-10-19 |
| AD-004 | RLS policies call only `private.is_org_member(org)` and `private.has_org_role(org, roles[])` (security definer, `search_path = ''`, in the unexposed `private` schema), wrapped as `(select ...)` | one place decides membership; JWT claims would go stale after a role change | active | 2026-10-19 |
| AD-005 | Statuses are `text` with a `check` constraint, never Postgres enums; ids are `uuid default gen_random_uuid()`; money is `bigint` `_cents` | a check can be changed in a migration while an enum value cannot be removed; the TS state machine owns transitions | active | 2026-10-19 |
| AD-006 | Migration files are named `<version>_<name>.sql`, where `<version>` is the timestamp `apply_migration` recorded on the remote | the local history then matches the remote one, so a later `supabase db push` does not re-apply them | active | 2026-10-19 |

## Handoff

**Feature**: supabase-init
**Where**: verified - PASS (light), report in `.specs/features/supabase-init/verification.md`
**In progress**: none
**Next step**: next ROADMAP item (Phase 1: seed the equipment-type catalog and task library, with a fictitious demo org)
**Blockers**: none
**Uncommitted**: none
**Branch**: development (not pushed)
**Supabase project**: `service-agreement`, ref `gnxebrtcpbujhvcamtoe`, `ca-central-1`
