# Task library page - checks

Profile: light
Plan: `.specs/features/task-library-page/plan.md`

33 checks in 5 slices · 3 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1407:`). This feature numbers
  from C1407, because imports-page owns up to `C1406:`.
  - The pure rules are tested in `domain/task-library/index.test.ts` (new file).
  - The reader and the store are tested in `infrastructure/supabase/task-library.test.ts` (new file) with the
    recording `stubClient`.
  - The shared month grid is tested in `components/ui/month-grid.test.ts` (new file); the views in
    `components/task-library/task-library.test.ts` (new file), both with `renderToStaticMarkup`.
  - The page and the action are tested in `app/(app)/task-library.test.ts` (new file), in the style of
    `app/(app)/imports-history.test.ts`, with `next/navigation` mocked.
  - The sidebar is asserted in `components/shell/nav-items.test.ts`.
- **sql** runs with `npm run test:db task_library` from `web/`: `supabase/tests/task_library.sql` (new file), after
  `fixture.sql`, in one rolled-back transaction. It needs the migration applied to the database the script targets.
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context) at 375, 768
  and 1440 px, recorded in the Handoff.
- One migration, `supabase/migrations/20261104120000_task_library.sql`, adds `public.save_task_library_type` (door 3).
  No table or column changes, so `database.types.ts` only gains the function's entry.

Terms:
- "the form tasks" are the rows the editor submits: `{ description, visitMonths }`, where `visitMonths` is a list of
  month numbers as text and an empty list means every visit.
- "valid months" are those `isVisitMonths` accepts: non-empty, whole months 1 to 12, strictly ascending.
- "the fixture library" is two types of one org: `RTU` "Rooftop unit" with default months `[3,6,9,12]` and tasks
  "Inspect belts" (every visit) and "Cooling start-up" (`[3,4,5]`), and `BOILER` "Boiler" with `[10]` and one task.
- Replaced assertions: the plan's `Impact` row authorizes replacing two claims in `nav-items.test.ts`, "Task library
  has no page yet" (C1393 and the `C156: %s has no page yet` list, which loses "Task library"), and adding
  "Task library" to the link list. They are edited in the commit that adds the `href`, and its message names them.
  No other test is edited.

## Checks

### S1 - browse the library · 10 files · ~120 KB · ~30k

**C1407** - `TaskLibraryReader.list()` returns one entry per asset type ordered by name, each with `id`, `code`, `name`,
`defaultVisitMonths` and `tasks` in position order, each task `{ description, visitMonths }` where `visitMonths` is `null`
for every visit or an ascending array; the query reads `asset_types` with their `asset_type_tasks`, orders types by
`name` and limits to 500 (AC 1, 2, door 1)
Proof: `npx vitest run infrastructure/supabase/task-library.test.ts -t "C1407:"` in `web/`

**C1408** - For the fixture library the view lists "Rooftop unit" with `Mar, Jun, Sep, Dec` and "Boiler" with `Oct`, as
many list entries as types (2), each linking to `/task-library?type=<code>` (AC 1)
Proof: `npx vitest run components/task-library/task-library.test.ts -t "C1408:"` in `web/`

**C1409** - With `RTU` selected the view shows "Inspect belts" with `All visits` and "Cooling start-up" with
`Mar–May`, in that order, and the entry for `RTU` carries `aria-current="page"` (AC 2)
Proof: `npx vitest run components/task-library/task-library.test.ts -t "C1409:"` in `web/`

**C1410** - `pickType(types, code)` returns the type whose code is `code`; for an unknown code, `undefined`, an empty
string and a repeated parameter it returns the first type; for an empty list it returns `null` (4 inputs plus the
empty list, table-driven) (AC 2, 3)
Proof: `npx vitest run domain/task-library/index.test.ts -t "C1410:"` in `web/`

**C1411** - A signed-out request to `/task-library` redirects to `/login` and nothing is read (AC 4)
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1411:"` in `web/`

**C1412** - The page reads the library once, resolves the selected type from `?type=` with `pickType`, and renders the
view with the member's role; the container exposes `listTaskLibrary` and `saveTaskLibraryType` (AC 1, 2, 3)
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1412:"` in `web/`
Proof: `npx vitest run composition/composition.test.ts -t "C1412:"` in `web/`

**C1413** - `canEditTaskLibrary` is true for `owner` and `admin` and false for `estimator` and `viewer` (4 roles,
table-driven), and the view rendered for an estimator and for a viewer has no submit button and no editable field
(AC 5)
Proof: `npx vitest run components/task-library/task-library.test.ts -t "C1413:"` in `web/`

**C1414** - With no types the view shows "No equipment types yet" in an empty panel and no editor (AC 6)
Proof: `npx vitest run components/task-library/task-library.test.ts -t "C1414:"` in `web/`

**C1415** - `MAIN_NAV` "Task library" has `href` `/task-library` (AC 1)
Proof: `npx vitest run components/shell/nav-items.test.ts -t "C1415:"` in `web/`

**C1416** - On `/task-library` and `/task-library?type=RTU` the Task library item is current
(`aria-current="page"`); on `/pipeline`, `/sites` and `/imports` it is not (4 paths) (AC 1)
Proof: `npx vitest run components/shell/nav-items.test.ts -t "C1416:"` in `web/`

### S2 - edit default months · 6 files · ~60 KB · ~15k

**C1417** - `validateTaskLibraryType` with default months `["3","6","9","12"]` returns `ok` with
`defaultVisitMonths` `[3,6,9,12]` (numbers, ascending) (AC 7)
Proof: `npx vitest run domain/task-library/index.test.ts -t "C1417:"` in `web/`

**C1418** - `validateTaskLibraryType` returns `invalid` with an error on `defaultVisitMonths` for each of an empty
list, `["6","3"]` (unsorted), `["3","3"]` (duplicated), `["0"]` and `["13"]` (5 inputs, table-driven) (AC 8)
Proof: `npx vitest run domain/task-library/index.test.ts -t "C1418:"` in `web/`

**C1419** - `MonthGrid` renders 12 checkboxes named as given with values 1 to 12 and labels `Jan` to `Dec`, checked as
given, and three preset buttons labelled `Quarterly`, `Semi-annual` and `Monthly`; the line form still renders its 12
`visitMonths` boxes and three presets through it (AC 9)
Proof: `npx vitest run components/ui/month-grid.test.ts -t "C1419:"` in `web/`

**C1420** - The editor's default-months grid is a `MonthGrid` named `defaultVisitMonths` with the selected type's months
checked (`RTU`: Mar, Jun, Sep, Dec) (AC 7, 9)
Proof: `npx vitest run components/task-library/task-library.test.ts -t "C1420:"` in `web/`

**C1421** - After `save_task_library_type('RTU', '{4,10}', ...)` the type's `default_visit_months` is `{4,10}` and the
other type's is unchanged (AC 7)
Proof: `npm run test:db task_library` in `web/` (assertion `C1421`)

### S3 - edit the checklist · 8 files · ~85 KB · ~22k

**C1422** - `validateTaskLibraryType` returns `ok` with the tasks in submitted order, descriptions trimmed, a task with an
empty `visitMonths` as `visitMonths: null` and a task with `["3","4","5"]` as `[3,4,5]` (AC 10, 11)
Proof: `npx vitest run domain/task-library/index.test.ts -t "C1422:"` in `web/`

**C1423** - A task description of `""`, `"   "` and 201 characters is `invalid` with an error on that row's index; 1 and
200 characters are accepted (5 inputs, table-driven) (AC 12)
Proof: `npx vitest run domain/task-library/index.test.ts -t "C1423:"` in `web/`

**C1424** - 40 tasks are accepted and 41 are `invalid` with an error on `tasks` (2 inputs) (AC 13)
Proof: `npx vitest run domain/task-library/index.test.ts -t "C1424:"` in `web/`

**C1425** - A task whose `visitMonths` is `["0"]`, `["13"]`, `["3","3"]`, `["6","3"]` or `["x"]` is `invalid` with an error
on that row's index (5 inputs, table-driven) (AC 14)
Proof: `npx vitest run domain/task-library/index.test.ts -t "C1425:"` in `web/`

**C1426** - After `save_task_library_type('RTU', ..., '[{"description":"A","visitMonths":null},{"description":"B","visitMonths":[3,4]}]')`
the type has exactly two tasks, `A` at position 0 with `visit_months` null and `B` at position 1 with `{3,4}`, and the
other type's tasks are unchanged (AC 10, 11)
Proof: `npm run test:db task_library` in `web/` (assertion `C1426`)

**C1427** - A call whose second task has months `[13]` raises and leaves the type's previous tasks, their positions and
its default months exactly as they were (AC 15)
Proof: `npm run test:db task_library` in `web/` (assertion `C1427`)

**C1428** - The editor for the fixture `RTU` renders one description input per task (2), each with `maxLength` 200, a
`MonthGrid` per task with an "All visits" choice checked for the task with no months, "Move up" disabled on the first
row and "Move down" on the last, a "Remove" button per row, and an "Add task" button that is disabled at 40 rows (AC 10, 12, 13)
Proof: `npx vitest run components/task-library/task-library.test.ts -t "C1428:"` in `web/`

**C1429** - `TaskLibraryStore.save` calls `rpc("save_task_library_type", { p_type_code, p_default_months, p_tasks })` once,
with the months as numbers and `p_tasks` as `[{ description, visitMonths }]`, and returns `{ ok: true }`; it does not
touch `asset_types` or `asset_type_tasks` directly (AC 10, door 2)
Proof: `npx vitest run infrastructure/supabase/task-library.test.ts -t "C1429:"` in `web/`

**C1430** - A database error of code `42501` gives `{ ok: false, code: "forbidden" }`, `P0002` gives `not_found`, and
`23514` and any other code give `unavailable` (4 codes, table-driven) (AC 15, 16)
Proof: `npx vitest run infrastructure/supabase/task-library.test.ts -t "C1430:"` in `web/`

**C1431** - The action with an invalid form returns `{ status: "invalid", errors, values }`, keeps what was typed and does
not call the store (AC 8, 12, 13, 14)
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1431:"` in `web/`

**C1432** - The action with a valid form as an owner calls the store once with the type code and the validated value and
returns `{ status: "saved", values }`; a store failure of `unavailable` returns `{ status: "unavailable", values }`
(AC 7, 10)
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1432:"` in `web/`

### S4 - who may edit, and frozen agreements · 3 files · ~25 KB · ~8k

**C1433** - The action as an estimator and as a viewer returns `{ status: "forbidden", values }` and does not call the
store (2 roles) (AC 16)
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1433:"` in `web/`

**C1434** - The action takes the member from `currentMember`; a form field named `orgId` or `org_id` never reaches the
store, and a signed-out call redirects to `/login` (AC 4, 17)
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1434:"` in `web/`

**C1435** - `save_task_library_type` called as an estimator and as a viewer of the org raises `42501` and changes
nothing; called as the admin of another org for this org's type code it raises `P0002` and changes nothing (3 callers)
(AC 16, 17)
Proof: `npm run test:db task_library` in `web/` (assertion `C1435`)

**C1436** - After a save on a type used by a sent agreement, that agreement version's `snapshot` is byte-identical to
what it was before (AC 18)
Proof: `npm run test:db task_library` in `web/` (assertion `C1436`)

**C1437** - After a save, `site_service_scope` for a site with an `RTU` asset returns the new tasks and months for
`RTU` (AC 10, 11)
Proof: `npm run test:db task_library` in `web/` (assertion `C1437`)

### S5 - fit on a phone, live · live

**C1438** - `/task-library` at 375, 768 and 1440 px has no horizontal scroll and no overlapping boxes, and at 375 and
768 px every control and row link is at least 44 px high (AC 1, 2)
Proof: live, recorded in the Handoff (author-side Playwright, one signed-in context)

**C1439** - Signed in as the demo owner, the page lists the types, a default-months change and an added seasonal task
save and survive a reload, the sidebar item is current, and the console has no errors (AC 1, 2, 7, 10, 11)
Proof: live, recorded in the Handoff (author-side Playwright, one signed-in context)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| roles -> may edit (4) | `owner` C1413 · `admin` C1413 · `estimator` C1413 · `viewer` C1413 | - |
| roles -> action result (4) | `owner` C1432 · `admin` C1432 · `estimator` C1433 · `viewer` C1433 | - |
| invalid default months (5) | empty C1418 · unsorted C1418 · duplicated C1418 · 0 C1418 · 13 C1418 | - |
| invalid task months (5) | 0 C1425 · 13 C1425 · duplicated C1425 · unsorted C1425 · non-numeric C1425 | - |
| description bound (5 edges) | empty C1423 · blank C1423 · 1 C1423 · 200 C1423 · 201 C1423 | - |
| task count bound (2 edges) | 40 C1424 · 41 C1424 | - |
| `pickType` inputs (5) | existing code C1410 · unknown C1410 · undefined C1410 · empty string C1410 · repeated C1410 · empty list C1410 | - |
| store error codes (4) | `42501` C1430 · `P0002` C1430 · `23514` C1430 · other C1430 | - |
| `save_task_library_type` callers (4) | admin C1426 · estimator C1435 · viewer C1435 · other-org admin C1435 | - |
| `GET /task-library` statuses (2) | 200 C1412 · 307 to `/login` C1411 | - |
| `saveTaskLibraryType` states (4) | `saved` C1432 · `invalid` C1431 · `forbidden` C1433 · `unavailable` C1432 | - |
| ports (door 1) (2) | reader C1407 · store C1429 | - |
| whole-list replace (door 2) (2) | order and positions C1426 · rollback C1427 | - |
| function contract (door 3) (3) | role and type errors C1435 · atomic C1427 · grants and signature C1435 | - |
| sidebar item (2 behaviours) | href C1415 · current on `/task-library*` C1416 | - |
| widths (3) | 375 C1438 · 768 C1438 · 1440 C1438 | - |
| empty and read-only states (2) | no types C1414 · read-only C1413 | - |

- Claims naming a status code, route or response shape: C1411, C1412, C1430 and C1435 - the first two call the page
  function with `next/navigation` mocked, so the 200 and the redirect are seen live (C1439), accepted under `light`; the
  other two cross the database boundary
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1418, C1423, C1424, C1425
- failure modes: C1427, C1430
- idempotency: n/a - saving the same value twice writes the same rows; the whole list is replaced, so no row can duplicate
- authorization: C1433, C1435, existing - the `asset_types` and `asset_type_tasks` write policies are owner/admin (AD-008)
- concurrency: existing - the function takes an advisory lock per type, so two admins saving one type take turns and the
  last one wins; stated, not a check
- data lifecycle: C1436 - sent versions keep their frozen snapshot; drafts read the library live (C1437)
- dependency failure: existing - one database dependency; the reader throws through `unexpected` and the segment's `error.tsx` renders
- state transitions: n/a - no status changes; no agreement or contract transition runs
- observability: n/a - no logging requirement in this slice

## Out of scope

- Add, rename, deactivate or delete equipment types - referenced by assets, lines and import rows; needs its own plan
- Reset to the seeded template
- Propagating edits to sent agreements
- Per-site overrides of tasks
- Drag-and-drop reordering

## Handoff

- Read set, measured with `wc -c`: `ports/index.ts` 35.0 KB, `composition/index.ts` 9.7 KB, `line-form.tsx` 7.7 KB,
  `imports/page.tsx` 1.2 KB, `settings/actions.ts` 1.8 KB, `settings/state.ts` 1.8 KB, `nav-items.test.ts` 2.6 KB,
  `import-history.tsx` about 6 KB, `stub-client.ts` 4 KB, `cadence.sql` test head, the `save_service_line` migration
  about 5 KB: about 80 KB, about 20k tokens, plus the new files.
- S1 ~30k, S2 ~15k, S3 ~22k, S4 ~8k, live ~6k. About 81k against the 150k budget, all in one surface (the web app and
  one migration) - one builder, no ask.
- Mechanism: one builder.
- Applying the migration to the Supabase project that `test:db` and the live run target is a database change, so it
  waits for an explicit go-ahead; until then S1, S2 and S3's vitest checks run and the sql checks (C1421, C1426, C1427,
  C1435 to C1437) and the live checks stay open.
- Before the last commit the builder also runs `npm test`, `npm run lint` and `npx tsc --noEmit` in `web/` and reviews
  `git diff <feature base>..HEAD -- "*.test.ts"` against the Terms. This is a hygiene gate, not a check.

- **Boundary:** C1407-C1437 closed at `537929e` (`dc59d0b` domain, store, function and SQL test; `efaf893` month grid; `b2b1429` page, action, sidebar; `537929e` SQL cross-org fix, plus the C1435 grants assertion in the docs commit); C1438 and C1439 ran live (below)
- **Settled mid-build:**
  - Door 3 (`save_task_library_type`) was found while writing the checks: AC 15 cannot hold with a client-side delete then insert. It is a `Landing` row, and `Flow` and `Impact` were corrected in the same commit that added it. AD-124.
  - The migration was applied by the owner in the Supabase SQL editor, because `apply_migration` was declined twice by the permission layer. It is therefore not in the project's migration list; it was confirmed on the project with a `pg_proc` query (security invoker, `authenticated` may execute, `anon` may not), and C1435 now asserts that.
  - C1435's "another org" case uses `BOILER`, a code only org A has: the fixture gives org B its own `RTU`, so org B's owner `uB` legitimately saved that one. `uB` is an owner, not an admin; both pass `has_org_role(owner, admin)`.
  - C1416 names `/task-library?type=RTU`, but `usePathname` never carries a query string. `SidebarNav` now ignores any `?` suffix so the check holds as written.
  - Replaced assertions, besides the nav ones the plan authorised: the `test:db` runner pins in `scripts/test-db/runner.test.ts` count one more recipe (20 recipes over 22 SQL files; `19 passed, 1 failed` in the failing-recipe case), and `task_library` is listed after `cadence`.
  - UI behaviours not in a check: unchecking "All visits" selects the type's default months, and clearing a task's last month returns it to "All visits", so a row is never in an invalid empty state.
  - The `next dev` server on port 3000 served a stale container (`listTaskLibrary is not a function`) and was restarted with the owner's go-ahead; the new one is left running.
- **Live C1439 (1440 px, one signed-in context, demo owner):** `/task-library` lists 40 types, RTU selected through `?type=RTU`. Semi-annual preset plus a new task "Cooling start-up (live check)" on Mar-May saved with "Saved." and survived a reload (defaults 4 and 10, 11 tasks, last task `[3,4,5]`). A blank description gave "Describe the task in 1 to 200 characters" and "Fix the highlighted fields", and a reload showed nothing had been saved. RTU was then restored to its original 10 tasks and months 3, 6, 9, 12, and checked after a reload. Console: no errors after the restart.
- **Live C1439, sidebar (added after verifier round 1, same signed-in context, 1440 px):** the Task library item has `aria-current="page"` on `/task-library` and on `/task-library?type=BOILER`, and has none on `/imports`.
- **Live C1438:** 375, 768 and 1440 px: no horizontal scroll (scrollWidth equals clientWidth at each); at 375 and 768 px none of 227 controls and links is under 44 px and none overlaps; at 1440 px controls are 34 px, the same desktop sizing as Sites and Imports.
- **Abandoned:** nothing.
