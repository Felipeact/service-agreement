# Task library page

## Problem

Each tenant owns a copy of the equipment catalog (40 types, 174 tasks, default visit months), but nobody can change it. The only way to fix a checklist or a type's default months is SQL. A contractor whose RTU start-up differs from the seeded one gets the wrong "Service included" text on every new agreement and the wrong prefilled months on every new service line. CONTEXT.md records this as "Not yet: a catalog editing screen". The roadmap gives no other evidence.

When this ships, an owner or admin opens **Task library** in the sidebar, picks an equipment type, edits its checklist and default months, and the next agreement draft shows the change. Sent agreements stay frozen.

## Flow

Reuses the existing RLS (owner/admin write on `asset_types` and `asset_type_tasks`), `isVisitMonths`, `MONTH_SHORT`/`MONTH_PRESETS`, the page pattern of Imports/Agreements, and the `settings/actions.ts` form-state pattern. One migration adds the atomic save function (door 3).

1. `GET /task-library?type=<code>` -> `app/(app)/task-library/page.tsx` (new, placement) - `currentMember()` (exists), redirect `/login` unless member, reads via new port `TaskLibraryReader`.
2. `TaskLibraryReader` (new, door 1) -> Supabase adapter in `infrastructure/supabase` (exists dir) - types with default months and ordered tasks with months.
3. View renders type list and the selected type's editor. The month grid is extracted from `components/agreements/line-form.tsx` (exists) into a shared control, and the line form uses it unchanged.
4. Save action (new, door 2) -> `canEditTaskLibrary(role)` (owner/admin) -> `validateTaskLibrary...` in `domain` (new, pure; reuses `isVisitMonths`) -> `TaskLibraryStore` (new, door 1) calls `public.save_task_library_type` (new, door 3), which writes `asset_types.default_visit_months` and `asset_type_tasks` in one transaction.
5. Next draft: `site_service_scope` (exists) reads the library live, `prefillMonths` (exists) reads the defaults. `freeze_agreement_version` (exists) is untouched.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: Task library - the org's `asset_types` plus their tasks, edited in place |
| domain | existing term: draft agreement scope - already live (`site_service_scope`), so library edits now reach drafts before send. Callers: service-scope view, visit schedule, PDF |
| domain | `AssetTypeCatalog` (id, code, name) stays as is; the library gets its own richer port |
| UI | sidebar "Task library" gets an `href`; `nav-items.test.ts` list moves it from "no page yet" to linked; DESIGN.md lines ~200 and ~275 updated |
| stored data | nothing to backfill; no table or column change, one new function (door 3); frozen `agreement_versions.snapshot` never rewritten (AD-058/060/061/086) |
| docs | ROADMAP tick, CONTEXT.md (M6 "Not yet" line), STATE.md AD row |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /task-library` | `type` (code, optional) | page with the type list and selected type editor | 200, redirect `/login` when signed out |
| server action `saveTaskLibraryType` | form: type code, default months, task rows (description, months or all visits) | form state `{status, errors}` | `ok` (200), `invalid` (422), `forbidden` (403) - action states, not HTTP |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Ports `TaskLibraryReader` and `TaskLibraryStore` | two narrow ports in `application/ports/index.ts`, Supabase adapters, wired in `composition/index.ts` | widening `AssetTypeCatalog` - it is consumed by import and agreements and must stay `{id, code, name}` |
| 2. Save = replace the type's whole task list in one call | action receives the full ordered list for one type; adapter updates the type's months and replaces its tasks; positions are the list order | per-task row edits with stable ids - tasks have no stable key (seeded rows are matched by description) and positions are not unique, so partial edits cannot be made safe without a migration |
| 3. Atomic save as a SQL function (added while writing checks) | `public.save_task_library_type(p_type_code text, p_default_months smallint[], p_tasks jsonb) returns void`, `security invoker`, `set search_path = ''`, owner/admin check (`42501`), unknown type `P0002`, advisory lock per type, grant to `authenticated` only - the `save_service_line` pattern | delete-then-insert from the client - supabase-js has no transaction, so a failure between the two calls loses the checklist and AC 15 cannot hold |

- Nothing else is hard to reverse. Task count and description length caps are enforced in the domain validator, not in SQL (reversible; no data backfill).

## Criteria

### S1: Owner or admin sees the library (P1)

Read-only browse of every equipment type with its checklist and months.

**Acceptance Criteria**

1. WHEN a member opens `/task-library` THEN the system SHALL list every equipment type of the org by name with its default visit months label (for example `Mar, Jun, Sep, Dec`).
2. WHEN `type=<code>` names an existing type THEN the system SHALL show that type's tasks in position order, each with `All visits` or its months label.
3. IF `type` names no type of the org THEN the system SHALL show the first type and no error.
4. IF the viewer is signed out THEN the system SHALL redirect to `/login`.
5. WHERE the role is estimator or viewer the system SHALL show the library read-only with no Save control.
6. IF the org has no equipment types THEN the system SHALL show an empty panel stating the catalog is empty.

**Independent test:** sign in as the demo owner, open the page, select RTU, read its tasks.

### S2: Edit default months (P1)

**Acceptance Criteria**

7. WHEN an owner or admin saves a type with valid default months THEN the system SHALL persist them and the next new service line SHALL prefill those months.
8. IF the submitted default months are empty, unsorted, duplicated or outside 1..12 THEN the system SHALL return `invalid`, show a field error and persist nothing.
9. The system SHALL offer the quarterly, semi-annual and monthly presets on the default-months grid.

**Independent test:** change RTU to semi-annual, start a new service line covering RTU, see months prefilled.

### S3: Edit the checklist (P1)

**Acceptance Criteria**

10. WHEN an owner or admin saves a type THEN the system SHALL persist its tasks in the submitted order with their descriptions and months.
11. WHEN a task is marked `All visits` THEN the system SHALL store its months as null; WHEN it has selected months THEN the system SHALL store them as an ascending array.
12. IF a task description is blank after trimming, or over 200 characters, THEN the system SHALL return `invalid` naming the row and persist nothing.
13. IF a type has more than 40 tasks THEN the system SHALL return `invalid` and persist nothing.
14. IF the task months are not valid per `isVisitMonths` THEN the system SHALL return `invalid` and persist nothing.
15. IF the save fails partway THEN the system SHALL leave the type's previous tasks and months unchanged.

**Independent test:** add a seasonal task "Cooling start-up" for Mar-May on RTU, open a draft agreement covering an RTU site, see it in Service included for those visits.

### S4: Authorization and frozen agreements (P1)

**Acceptance Criteria**

16. IF the caller is an estimator or viewer THEN the save action SHALL return `forbidden` and persist nothing.
17. The system SHALL take the org from the signed-in member, never from the form.
18. WHEN the library is edited THEN the system SHALL NOT alter the `snapshot` of any sent agreement version.

**Independent test:** edit RTU tasks, open a sent agreement's portal, it still shows the old checklist.

## Out of scope

| Excluded | Why |
| --- | --- |
| Add, rename, deactivate or delete equipment types | types are FK-referenced by assets, lines and import rows and have no deactivated flag; needs its own plan |
| Reset to the seeded template | needs the template-vs-org diff semantics; later |
| Propagating edits to sent agreements | frozen by design (AD-060) |
| Per-site overrides of tasks | not on the roadmap |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Who may edit | owner and admin only | matches existing RLS write policy; estimator/viewer read-only | n |
| Caps | 40 tasks per type, 200 chars per description | seeded types are far below; matches the 50-line cap precedent | n |
| Edit model | one "Save" per type, whole checklist | forced by door 2 | n |
| Drafts see edits immediately | accepted | `site_service_scope` is already live for drafts | n |
| Reordering | up/down buttons, no drag | simplest accessible control, 44px targets | n |
| Delete a task | confirm before removing a row from the form, nothing persists until Save | form-local, reversible until Save | n |
| Shared month control | extract the grid from `line-form.tsx` and reuse | avoids a second copy (L-014: the control holds the months) | n |

**Open questions:** none blocking.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `Task library` | empty state | AC 6 |
| screen `Task library` | loading state | existing - `loading.tsx` with `PageLoading` as on Imports |
| screen `Task library` | error state (save failure, invalid) | AC 8, 12-15 |
| screen `Task library` | unauthorised | AC 4, 5, 16 |
| screen `Task library` | density and ordering | AC 1, 2 (types by name, tasks by position) |
| screen `Task library` | destructive action confirms | existing - row removal is form-local until Save (assumption) |
| server action `saveTaskLibraryType` | error shape and codes | AC 8, 12-16 (`invalid`, `forbidden`) |
| server action `saveTaskLibraryType` | versioning, rate limits | n/a - internal server action, authenticated members only |

Nine-dimension landings go in `checks.md` `## Swept`. Expected: concurrency (two admins saving the same type, last write wins, stated), data lifecycle (frozen snapshots, AC 18), observability n/a.

## Sources

- ROADMAP.md Phase 3.5, "Task library page: view and edit checklists and default months per equipment type"
- CONTEXT.md M6 "Not yet: a catalog editing screen"
- STATE.md AD-008 (org owns its catalog copy), AD-060 (freeze on send)

## Verification (after build)

- `npm test` and `npm run test:db` green (no new SQL expected; add a `supabase/tests` case only if a migration appears).
- `nav-items.test.ts` updated in the same commit as the `href`.
- Playwright live, one signed-in context only (see memory: playwright single context), at 375, 768 and 1440 px: browse, edit months, add a seasonal task, confirm a draft shows it and a sent agreement does not. Then a fresh Verifier over every check.
