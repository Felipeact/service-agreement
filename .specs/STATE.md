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
| AD-007 | The standard equipment catalog lives in `private.catalog_asset_types` / `private.catalog_asset_type_tasks`, filled by migration, unreadable by `anon` and `authenticated`; orgs read only their own copy in `public.asset_types` / `asset_type_tasks` | SQL onboarding (Phase 5) can read it with no app runtime, and it never shows up as a second catalog queries could hit | active | 2026-10-19 |
| AD-008 | An org gets the catalog only through `private.seed_org_catalog(org)` (security invoker, `search_path = ''`, `on conflict (org_id, code) do nothing`, tasks copied only for types that call inserted); no trigger on `orgs`. The copy is the org's own, with no FK back to the template | re-runs are no-ops and existing types keep their checklists; a trigger would break fixtures that pre-insert `RTU` and would stop onboarding from creating an empty catalog | active | 2026-10-19 |
| AD-009 | Demo data lives only in `supabase/seed.sql` (one `begin`/`commit`, fixed ids `md5('demo:<kind>:<n>')::uuid`, demo org id `00000000-0000-4000-8000-00000000de30`, every insert `on conflict do nothing`), never in a migration | a migration would plant a fictitious tenant in every future environment, production included; fixed ids make re-runs idempotent and let the auth item attach a member to a known org | active | 2026-10-19 |
| AD-010 | Pure domain code lives in `web/domain/<area>/index.ts`; `web/eslint.config.mjs` forbids `next*`, `react*`, `@supabase/*`, `@/lib`, `@/components` and `@/app` imports there, and domain sources read no clock and no randomness | ports, adapters and use cases depend on the domain, never the reverse; a lint rule makes "pure" checkable instead of a convention | active | 2026-10-23 |
| AD-011 | A transition returns `{ ok: true, status, event }` or `{ ok: false, error: { code, from, command } }`, never throws for a domain refusal; event `type` is `<entity>.<to-status>` (`agreement.sent`, `contract.completed`), `entityType` is `agreement` or `contract` | n8n W1-W4 bind to these names and `events.type` stores them; the portal shows a refusal to the customer, so it is a value the type checker sees | active | 2026-10-23 |
| AD-012 | Money in TypeScript is `Cents = number & { __brand: "Cents" }`, made only by `cents(n)` (non-negative safe integer, else `RangeError`) | a dollar amount cannot pass as cents unnoticed; PostgREST returns `bigint` as a JSON number, so `bigint` would mean converting at every boundary | active | 2026-10-23 |
| AD-013 | Unit tests use Vitest (`npm test` in `web/`), as `*.test.ts` beside the code | one runner for every later unit test; it resolves the `@/` alias | active | 2026-10-23 |

## Handoff

**Feature**: domain-layer
**Where**: verified - PASS (light, round 1 full), report in `.specs/features/domain-layer/verification.md`
**In progress**: none
**Next step**: next ROADMAP item (Phase 1: ports, Supabase adapters and composition root)
**Blockers**: none
**Uncommitted**: none
**Branch**: development (not pushed)
**Supabase project**: `service-agreement`, ref `gnxebrtcpbujhvcamtoe`, `ca-central-1`
