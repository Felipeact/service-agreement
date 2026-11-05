# Seasonal tasks

## Problem

Every checklist task in the task library applies at every visit. Three catalog tasks are seasonal in their own words: RTU "Inspect heat exchanger during heating season", RTU "Check compressor operation during cooling operation" and ERV "Check heating operation". Today they print under Service included as if the technician did them on all four quarterly visits. The customer cannot tell which visit includes the heating check, and an estimator who wants a spring cooling start-up can only write the season into the task's text. ROADMAP's Cadence section sets the rule: "A checklist task can apply to some visits only, for example the cooling start-up in spring and the heating start-up in fall." The source gives no usage figures.

When this ships:
- A task can carry visit months. It applies at a line's visits that fall in those months; a task with no months applies at every visit.
- The Service included checklist marks a seasonal task with its months, for example `Check compressor operation during cooling operation (Apr–Sep visits)`.
- Each month of the Visit schedule lists the seasonal tasks due that month.
- This shows on the PDF, the customer page and the staff page.

## Flow

This reuses what exists instead of adding a second version of it:
- cadence's month rule `private.is_visit_months` and its `visitSchedule`
- the one scope builder `site_service_scope` (exists, AD-059) and the one snapshot writer `freeze_agreement_version` (exists, AD-060)
- the one scope parser `parseServiceScope` (exists)
- the shared `ServiceScopeSections` (exists) and `VisitScheduleSection` (exists) components, and the one PDF layout

The path:

1. The migration adds `visit_months` to `asset_type_tasks` and `private.catalog_asset_type_tasks` (door 1). It sets the three catalog tasks' months and backfills each org's copies (door 3). It redefines `private.seed_org_catalog` (exists) to copy the months (door 4).
2. `public.site_service_scope` (exists, redefined) returns the scope document `schema` 2, where each task is `{description, visitMonths}` (door 2).
3. `freeze_agreement_version` (exists, unchanged) writes that document into the snapshot at send. So a version sent after the migration keeps the months it was sent with.
4. `AgreementReader.get` (exists) and the portal adapter (exists, through `portal_view`'s `scope`) pass the document to `parseServiceScope` (exists, extended). It reads schema 1 and schema 2. Every task comes out as `{ description, visitMonths: number[] | null }`.
5. `visitSchedule` (exists, from cadence) also takes the scope's types. Each month row gains the seasonal tasks due that month. `buildAgreementDocument` (exists) carries the rows to the PDF.
6. `ServiceScopeSections` (exists) and the PDF's Service included block mark each seasonal task with its months. `VisitScheduleSection` (exists, from cadence) and the PDF's Visit schedule list the due tasks under their month. These render on `/agreements/[agreementId]`, `/review/[token]` and both PDF routes.

## Impact

| Front | What changes |
| --- | --- |
| domain | New term `seasonal task`: a checklist task with visit months. It applies at a visit whose month is in them. A task without months applies at every visit. |
| domain | Existing term `ScopeType.tasks` was `string[]` and becomes `{ description, visitMonths }[]`. Who reads it today: `ServiceScopeSections`, the PDF layout, `portalScope` in `review-view.tsx`, and the fixtures in `service-scope.test.ts`, `portal-view.testing.ts`, `agreements.test.ts` and `portal.test.ts`. |
| domain | `ScheduleRow` (cadence) gains `tasks`. Its readers are `VisitScheduleSection`, the PDF layout and `buildAgreementDocument`. `visitSchedule` gains a second argument, the scope's types. |
| tests | Existing assertions whose literal moved to the new shape, each claim kept, approved by the user on 2026-10-30: `service_included.sql` C801 (`schema`, `RTU tasks`, `position order`), C802 (`other org`) and C808 (`asset added`, `task updated`), from schema 1 to 2 and text tasks to `{description, visitMonths}`; `demo_seed.sql` C821 `frozen` (schema `1` or `2`); vitest C803 (parsed tasks, and its unknown-schema row moved from `2` to `3`), C804's expected types, C1080, C1081 and C1086 (rows gain `tasks: []`); and the `ScopeType` fixtures in five other test files. |
| stored data | Frozen snapshots are not rewritten. Schema 1 stays readable, and its tasks apply at every visit (AC 9). Org tasks are backfilled from the catalog by type code and description (AC 4). Only demo data exists in `service-agreement`. AG-1046 and AG-1048 were sent before the migration, so they keep schema 1 and show no seasonal markers. |
| SQL functions | Each is redefined: `site_service_scope` (amends AD-059's document) and `private.seed_org_catalog` (amends AD-008 again). `freeze_agreement_version`, `apply_agreement_transition` and `portal_view` are unchanged; they pass the document through. |
| docs | CONTEXT.md task library and Service included sections, DESIGN.md checklist marker and schedule rows, ROADMAP tick, and STATE.md rows for doors 1 to 4 (AD-058 amended) |

## Relations

None - no new entity and no cardinality change. Door 1 is a nullable column on two existing task tables.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `rpc public.site_service_scope` (signature unchanged, document changed) | `p_site_id` | `{"schema": 2, "types": [{code, name, tasks: [{description, visitMonths}], assets}]}` | `200` jsonb; another org's site gives `{"schema": 2, "types": []}` |
| `rpc public.portal_view` (signature unchanged) | `p_token_hash` | `scope` is whatever the version froze: schema 1 or schema 2 | `200` jsonb, or `200` null for an unknown link (unchanged) |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. months on a task | `asset_type_tasks.visit_months smallint[] null check (visit_months is null or private.is_visit_months(visit_months))`, and the same column and check on `private.catalog_asset_type_tasks`. `null` means every visit. | A season enum (`every`/`cooling`/`heating`) with fixed windows: the user chose months (2026-10-30), and with an enum a start-up task repeats on every visit in its season. Empty array as "every visit": the door 1 rule already refuses `{}`, and two spellings would mean one thing. `not null default {1..12}`: the checklist marker and the later Task library editor could not tell "not seasonal" from a choice of all twelve months. |
| 2. scope document schema 2 | `{"schema": 2, "takenAt"?, "types": [{"code", "name", "tasks": [{"description": text, "visitMonths": [int ascending] \| null}], "assets": [...]}]}`; `terms` unchanged (AD-071). Schema 1 stays valid input, forever. Amends AD-058. | Rewriting frozen schema 1 snapshots to schema 2: that changes a record of what the customer was sent. Keeping schema 1 with a parallel `taskMonths` array: two arrays must stay aligned by index, and a schema 1 reader would ignore the months silently. Mixing strings and objects inside `tasks`: every reader branches per element, with no version to say which shape to expect. |
| 3. backfill rule for org tasks | `update asset_type_tasks k set visit_months = c.visit_months from asset_types t, private.catalog_asset_type_tasks c where t.id = k.asset_type_id and c.code = t.code and c.description = k.description`; unmatched tasks stay `null` | Matching by `position`: the catalog's positions are per type and an org's copy can be reordered, so position alone could give a task another task's months. |
| 4. catalog copy | `seed_org_catalog` inserts `(org_id, asset_type_id, position, description, visit_months)` from the catalog (amends AD-008) | Leaving new orgs without months until the Task library page exists: a new tenant would get a different checklist from the demo org. |

- Nothing else in this change is hard to reverse. The marker wording, the range format and the row layout are settled in the diff.

## Criteria

### S1: months on a task (P1)

A checklist task can carry the months of the visits it applies to.

**Acceptance Criteria**

1. IF an `asset_type_tasks` or `private.catalog_asset_type_tasks` write carries a non-null `visit_months` that fails cadence's door 1 rule (empty, not strictly ascending, or a value outside 1-12), THEN the database SHALL refuse it with `23514`.
2. WHEN the migration runs THEN the catalog tasks SHALL carry these months, and every other catalog task SHALL carry `null`: RTU "Inspect heat exchanger during heating season" `{1,2,3,10,11,12}`, RTU "Check compressor operation during cooling operation" `{4,5,6,7,8,9}`, ERV "Check heating operation" `{1,2,3,10,11,12}`.
3. WHEN `private.seed_org_catalog(org)` copies the catalog into an org THEN each inserted task SHALL carry the catalog task's `visit_months`.
4. WHEN the migration runs THEN each existing `asset_type_tasks` row SHALL carry the months of the catalog task with the same type `code` and `description` (door 3), or `null` when there is none.
5. WHEN `supabase/seed.sql` runs twice THEN the demo org's three seasonal tasks SHALL carry the months in AC 2, and the second run SHALL change no row.

**Independent test:** `select t.code, k.description, k.visit_months from asset_type_tasks k join asset_types t on t.id = k.asset_type_id where k.visit_months is not null` for the demo org returns exactly the three rows in AC 2.

### S2: the scope keeps the months (P1)

What the customer was sent records which visits each task applies to.

**Acceptance Criteria**

6. The system SHALL make `public.site_service_scope` return `"schema": 2`, with each task as an object holding exactly `description` and `visitMonths` (`null` or ascending ints), in position order.
7. WHEN an agreement is sent THEN its frozen snapshot SHALL hold schema 2 with each task's months as they were at send, and a later update to `asset_type_tasks.visit_months` SHALL leave that snapshot unchanged.
8. WHEN the migration runs THEN no `agreement_versions.snapshot` SHALL change.
9. WHEN a schema 1 document is parsed THEN each of its tasks SHALL read as `{ description: <the text>, visitMonths: null }`.
10. IF a scope document's `schema` is neither 1 nor 2, or a schema 2 task's `visitMonths` is neither `null` nor valid under the door 1 rule, THEN `parseServiceScope` SHALL return `null`, which the pages already show as `Not recorded for this version.`

**Independent test:** send an agreement for a site with an RTU, then change the RTU heating task's months in SQL. The version's PDF still shows the months it was sent with.

### S3: the checklist marks seasonal tasks (P1)

The Service included checklist says which visits a seasonal task is done on.

**Acceptance Criteria**

11. The Service included checklist on `/agreements/[agreementId]`, on `/review/[token]` and in both PDFs SHALL show a task with months as `<description> (<months> visits)`, and a task without months as its description alone.
12. The system SHALL write the `<months>` of AC 11 as runs of consecutive months, with December followed by January. A run of three or more months is written `Start–End` with an en dash; a run of one or two is written as three-letter names. Runs are joined with `, `, starting from the run after the largest gap. Examples: `{4,5,6,7,8,9}` -> `Apr–Sep`, `{1,2,3,10,11,12}` -> `Oct–Mar`, `{3,4,5}` -> `Mar–May`, `{4,10}` -> `Apr, Oct`.
13. WHERE a task's months are all twelve, the checklist SHALL show its description alone, as for a task without months.
14. IF none of a seasonal task's months is a visit month of a line covering its type THEN the staff page `/agreements/[agreementId]` SHALL show `No visit in these months` after that task. The PDF and the customer page SHALL NOT show it.

**Independent test:** on a site with an RTU and a quarterly line covering it, the staff page checklist reads `Inspect heat exchanger during heating season (Oct–Mar visits)`. Change the line to `{6}` only, and that task gains `No visit in these months`.

### S4: the schedule lists seasonal tasks (P1)

Each month of the Visit schedule shows which seasonal tasks happen on that visit.

**Acceptance Criteria**

15. The system SHALL list a seasonal task of type T with months M under schedule month m if and only if m is in M and at least one line covering T visits in m. Tasks are ordered by type name, then task position, and listed once per month even when two lines cover T. A task without months, or with all twelve, is never listed.
16. The PDF, `/review/[token]` and `/agreements/[agreementId]` SHALL show each listed task under its month row as `<type name>: <description>`, after the row's equipment names.
17. The PDF from `/review/[token]/pdf` SHALL print the same schedule rows, tasks included, as `/agreements/[agreementId]/pdf?version=<n>` for that version.
18. WHILE the shown version holds a schema 1 snapshot, the schedule SHALL list no seasonal tasks.

**Independent test:** take a quarterly HVAC line covering RTU and AHU (Mar, Jun, Sep, Dec). The schedule reads: March, AHU and RTU, with `RTU: Inspect heat exchanger during heating season`. June, AHU and RTU, with `RTU: Check compressor operation during cooling operation`. September is the same as June. December is the same as March.

## Out of scope

| Excluded | Why |
| --- | --- |
| Editing a task's months, or adding and removing tasks | ROADMAP "Task library page" item |
| New catalog tasks such as a cooling start-up and a heating start-up | the catalog keeps the proposal template's checklist (catalog-seed); a tenant adds them with the Task library page |
| Choosing per agreement or per line which visits do a task | ROADMAP puts seasonal tasks in the task library (M6); per-agreement edits would be a second checklist owner |
| A task applying at only the first visit of a season | the user chose months on the task (2026-10-30) |
| Dated visits with per-visit checklists | ROADMAP Phase 6 |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Display places | both the checklist marker and the schedule (S3, S4) | user chose "Schedule and checklist" | y |
| Which catalog tasks are seasonal | only the three whose own wording names a season (AC 2) | the rest of the catalog is not seasonal in the proposal template; inventing more would change every tenant's checklist | n |
| Heating and cooling months | heating Oct–Mar, cooling Apr–Sep | the BC heating season; the two sets split the year with no gap, so a quarterly line gets each task twice | n |
| `No visit in these months` audience | staff page only (AC 14) | it is a prompt to fix the line before sending; the customer would read it as a promise not kept | n |
| Build order | built after cadence batch 2 is verified | S4 extends cadence's `visitSchedule` and `ScheduleRow`, which are uncommitted today | n |

**Open questions:** none. Everything is resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/agreements/[id]`, `/review/[token]` checklist | seasonal marker copy | AC 11, AC 12, AC 13 |
| screen `/agreements/[id]` checklist | warning state (a seasonal task no visit reaches) | AC 14 |
| screen `/agreements/[id]`, `/review/[token]` checklist | empty, loading, error, unauthorised | existing - service-included's empty notes, `loading.tsx`, `review-loading.tsx`, the `portalGate` 404 |
| screen `/agreements/[id]`, `/review/[token]` schedule | empty state | existing - cadence AC 22 `No visits scheduled yet` |
| screen `/agreements/[id]`, `/review/[token]` schedule | ordering and duplicates | AC 15 |
| screen any | destructive action confirms | n/a - this feature adds no action |
| document agreement PDF | structure | AC 11, AC 16, AC 17 |
| document old frozen versions | what an old reader sees | AC 9, AC 18 |
| API `rpc site_service_scope`, `portal_view` | error shape | n/a - no new error; another org's site still gives an empty types list (Surface) |
| API `rpc site_service_scope`, `portal_view` | versioning | AC 6, AC 10 - the document's `schema` key is the version |
| API `rpc site_service_scope`, `portal_view` | rate limits | n/a - in-repo callers only; portal rate limiting is carried as an outbox-dispatch open question |

## Sources

- ROADMAP.md, Phase 3.5 item 3, the `## Cadence` section and M6: they settle that a task applies to some visits, with the spring and fall example, and that it lives in the task library.
- `.specs/features/cadence/plan.md` doors 1 and 3 and AC 18: the month rule and the schedule this extends.
- `.specs/STATE.md` AD-008, AD-058 to AD-061 and AD-071: the catalog copy, the scope document and its single writer, which doors 2 and 4 amend.
