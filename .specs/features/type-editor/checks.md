# Type editor and catalog packs checks

Profile: standard
Plan: `.specs/features/type-editor/plan.md`

40 checks in 6 slices · 5 one-way doors · 0 open, 0 block

## How proofs run

- **SQL** recipes run with `npm run test:db type_editor` from `web/` (one file, `supabase/tests/type_editor.sql`, run after `fixture.sql`, rolled back). Every assertion is labelled with its check id (`C1901 ...`). They need the migration `20261109120000_type_editor.sql` applied to the database `SUPABASE_DB_URL` points at; applying it to the hosted project needs the owner's go-ahead (rule 8), so until then these proofs are written but not green.
- **vitest** runs from `web/`; every test name starts with its check id and a colon (`C1906:`). This feature numbers from C1901 (the last used is C1822). The task-library page tests removed on 2026-11-06 come back under their old ids (`C1408:`, `C1411:`, `C1412:`, `C1414:`, `C1420:`, `C1428:`, `C1431:`, `C1432:`, `C1434:`).
- Fixture: `fixture.sql` gives org A (owner uA, estimator uE, viewer uV, an admin added in the recipe) and org B (owner uB). The recipe adds its own template pack `tl_plumb` inside the rolled-back transaction.

## Checks

### S1 - Add a type · 1 migration, 2 web files · ~25 KB · ~8k

**C1901** - An owner adding "Sump pump" gets one org type with name `Sump pump`, code `SUMP_PUMP`, pack null, default months `{3,6,9,12}` and zero tasks, and the function returns `SUMP_PUMP` (AC 1)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1901 ...`)

**C1902** - After "Sump pump", adding "Sump-pump!" and then "Sump_pump" gives codes `SUMP_PUMP_2` and `SUMP_PUMP_3` (AC 2)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1902 ...`)

**C1903** - "2-pipe fan coil" gets code `T_2_PIPE_FAN_COIL` (AC 3)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1903 ...`)

**C1904** - A 60-character name made of the letter `a` gets a code of exactly 40 characters (AC 1, door 5 cap)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1904 ...`)

**C1905** - The empty name, a name of spaces, a 61-character name and `--- !!!` each raise `23514` from `create_task_library_type` and add no row (AC 4)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1905 ...`)

**C1906** - `validateTypeName` returns the message "Name the type in 1 to 60 characters, with at least one letter or number" for the empty string, 61 characters and `--- !!!`, and returns the trimmed name for `  Sump pump  ` (AC 4)
Proof: `npx vitest run domain/task-library/index.test.ts -t "C1906:"` in `web/`

**C1907** - Adding "SUMP PUMP" after "Sump pump" raises `23505` and leaves one row (AC 5)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1907 ...`)

**C1908** - A direct `insert` of a second type named "sump PUMP" in the same org, bypassing the functions, is refused with `23505` by `asset_types_org_name_key`, whose definition is `(org_id, lower(name))`; the same name in org B is accepted (door 4)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1908 ...`)

**C1909** - For each of the four functions, an estimator of org A, a viewer of org A and the owner of org B are refused with `P0002` (RLS hides the type or org from them) or `42501` where the type is visible, and an anonymous caller is refused with `42501`; 4 functions x 4 callers, each combination asserted with its SQLSTATE (AC 6)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1909 ...`)

**C1940** - An admin of org A can create, rename, reset and remove a type (AC 1, 7, 12, 22 for the admin role)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1940 ...`)

### S2 - Rename a type · 3 files · ~10 KB · ~3k

**C1910** - Renaming `SUMP_PUMP` to "Sump pump (duplex)" changes `name` only; id, code, pack, default months and the task list are as before (AC 7)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1910 ...`)

**C1911** - Renaming to another type's name in other case raises `23505`; renaming a type to its own name in other case ("Sump Pump") succeeds (AC 8)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1911 ...`)

**C1912** - Renaming to the empty string and to 61 characters raises `23514` and keeps the name (AC 9)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1912 ...`)

**C1913** - After a rename, an agreement version already sent has the same snapshot digest as before (AC 10)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1913 ...`)

**C1939** - `rename`, `remove` and `reset` with an unknown code raise `P0002` and change nothing (Surface P0002)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1939 ...`)

### S3 - Remove a type · 4 files · ~20 KB · ~6k

**C1914** - Choosing Remove renders a confirmation naming the type, and no store call happens until it is confirmed (AC 11)
Proof: `npx vitest run components/task-library/type-controls.test.ts -t "C1914:"` in `web/`

**C1915** - Removing an unused type with 3 tasks deletes the type and its 3 tasks; other types and tasks are untouched (AC 12)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1915 ...`)

**C1916** - Removing a type used by one asset, then one used by one service line, then one used by one import row, each raises `23503` and deletes nothing (AC 13; 3 users)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1916 ...`)

**C1917** - After a removal, a sent version's snapshot digest and a contract's stored wording are unchanged (AC 14)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1917 ...`)

**C1918** - After a refused removal the type's row and its task count are exactly as before (AC 15)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1918 ...`)

**C1919** - `removeTypeAction` returns the message "This type is still used by assets, service lines or import rows" when the store answers `in_use`, and never calls the store when the member is an estimator (AC 13, 27)
Proof: `npx vitest run "app/(app)/task-library-types.test.ts" -t "C1919:"` in `web/`

### S4 - Seed from a named pack · 1 migration, 3 SQL tests · ~30 KB · ~8k

**C1920** - With a template pack `tl_plumb` of 2 types and 3 tasks, `seed_org_catalog(orgX, 'tl_plumb')` returns 2, inserts 2 types with `pack = 'tl_plumb'` and 3 tasks, and no `hvac` type (AC 16)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1920 ...`)

**C1921** - `seed_org_catalog(orgX)` with one argument returns 40, inserts 174 tasks and stamps `pack = 'hvac'` on all 40 (AC 17)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1921 ...`)

**C1922** - `seed_org_catalog(orgX, 'nope')` raises `22023` and the org gains no type (AC 18)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1922 ...`)

**C1923** - Seeding `hvac` twice returns 40 then 0 and leaves 40 types and 174 tasks (AC 19)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1923 ...`)

**C1924** - Running the migration's backfill over an org whose `ERV` and `RTU` types have pack null and a hand-made `SUMP_PUMP` leaves `ERV` and `RTU` at `hvac` and `SUMP_PUMP` null (AC 20); `fixture.sql` deletes the demo org, so the same read on the live demo org (every template-coded type at `hvac`, no other type with a pack) is run once after the migration is applied and reported in the handoff
Proof: `npm run test:db type_editor` in `web/` (assertions `C1924 ...`)

**C1925** - `anon` and `authenticated` calling `seed_org_catalog(uuid, text)` and `seed_org_catalog(uuid)` are refused with `42501` (AC 21)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1925 ...`)

**C1935** - Setting `asset_types.pack` to `Hvac`, `1abc` or `a-b` is refused with `23514`; `hvac` and `a_1` are accepted (door 2)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1935 ...`)

**C1936** - A second template row `(tl_plumb, PUMP)` beside `(hvac, PUMP)` is accepted; the same `(pack, code)` twice raises `23505`; a task naming a missing `(pack, code)` raises `23503` (door 1)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1936 ...`)

### S5 - Reset a type to its pack · 3 files · ~12 KB · ~4k

**C1926** - Resetting an `hvac` type "Rooftop unit" whose tasks were replaced by one task and months set to `{1}` restores name `RTU`, the template months, and the template's 10 `RTU` tasks in template order, with the task months of its 2 seasonal tasks, keeping id and code (AC 22)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1926 ...`)

**C1927** - Resetting a hand-made type (pack null) and an `hvac` type whose template row was deleted each raise `55000` and change nothing (AC 23)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1927 ...`)

**C1928** - Resetting a type whose template name is held by another type of the org raises `23505` and leaves its months and tasks as they were (AC 24)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1928 ...`)

**C1929** - The editor renders Reset for a type with a pack and renders no Reset for a type whose pack is null (AC 25)
Proof: `npx vitest run components/task-library/type-controls.test.ts -t "C1929:"` in `web/`

### S6 - The Task library screen · 8 files · ~45 KB · ~14k

**C1930** - `/task-library` reads the library once, `?type=` picks the type, and the view lists every type with its months and links, with the editor showing months and one row per task (AC 26)
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1412:"` in `web/`
Proof: `npx vitest run components/task-library/task-library.test.ts -t "C1408:"` in `web/`
Proof: `npx vitest run components/task-library/task-library.test.ts -t "C1428:"` in `web/`

**C1941** - `saveTaskLibraryAction` rejects an invalid form without calling the store, saves a valid one once, ignores an `orgId` in the form, and a signed-out caller goes to `/login` (AC 26)
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1431:"` in `web/`
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1432:"` in `web/`
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1434:"` in `web/`
Proof: `npx vitest run "app/(app)/task-library.test.ts" -t "C1411:"` in `web/`

**C1931** - For an estimator and for a viewer the view renders no Add, Rename, Remove, Reset or Save control; for an owner and an admin it renders all five (AC 27)
Proof: `npx vitest run components/task-library/type-controls.test.ts -t "C1931:"` in `web/`

**C1932** - With no types the view renders "No equipment types yet" and, for an owner, the Add form; for an estimator, no form (AC 28)
Proof: `npx vitest run components/task-library/task-library.test.ts -t "C1414:"` in `web/`
Proof: `npx vitest run components/task-library/type-controls.test.ts -t "C1932:"` in `web/`

**C1933** - The Company settings view renders a link to `/task-library` (AC 29)
Proof: `npx vitest run components/settings/settings.test.ts -t "C1933:"` in `web/`

**C1934** - An owner's direct `update` of an org type's `code` or `org_id` is refused with `23514`, while an update of `name` through the table succeeds (AC 30, door 5)
Proof: `npm run test:db type_editor` in `web/` (assertions `C1934 ...`)

**C1937** - `createTypeAction` returns "Name the type in 1 to 60 characters, with at least one letter or number" for an invalid name without calling the store, and "A type with that name already exists" when the store answers `conflict` (AC 4, 5)
Proof: `npx vitest run "app/(app)/task-library-types.test.ts" -t "C1937:"` in `web/`

**C1938** - The Supabase store maps SQLSTATE `42501` to `forbidden`, `P0002` to `not_found`, `23505` to `conflict`, `23514` to `invalid`, `23503` to `in_use`, `55000` to `no_pack` and anything else to `unavailable`, for each of create, rename, remove and reset (Surface statuses)
Proof: `npx vitest run infrastructure/supabase/task-library.test.ts -t "C1938:"` in `web/`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `create_task_library_type` statuses (3) | 403 `42501` C1909 · 400 `23514` C1905 · 409 `23505` C1907 | - |
| `rename_task_library_type` statuses (4) | 403 `42501` C1909 · 400 `P0002` C1939 · 400 `23514` C1912 · 409 `23505` C1911 | - |
| `remove_task_library_type` statuses (3) | 403 `42501` C1909 · 400 `P0002` C1939 · 409 `23503` C1916 | - |
| `reset_task_library_type` statuses (4) | 403 `42501` C1909 · 400 `P0002` C1939 · 400 `55000` C1927 · 409 `23505` C1928 | - |
| store failure mapping (7) | forbidden, not_found, conflict, invalid, in_use, no_pack, unavailable - C1938, table-driven over all 7 | - |
| callers of each function (6) | estimator C1909 · viewer C1909 · anon C1909 · other-org owner C1909 · owner C1901 · admin C1940 | - |
| uses that block a removal (3) | asset C1916 · service line C1916 · import row C1916 | - |
| name-to-code cases (5) | plain C1901 · collision suffix C1902 · digit prefix C1903 · 40-character cap C1904 · punctuation and case C1902 | - |
| invalid names (4) | empty C1905 · spaces C1905 · 61 characters C1905 · no letter or digit C1905 | - |
| `seed_org_catalog` outcomes (4) | named pack C1920 · default `hvac` C1921 · unknown pack C1922 · rerun C1923 | - |
| `pack` format check (5) | `Hvac` C1935 · `1abc` C1935 · `a-b` C1935 · `hvac` C1935 · `a_1` C1935 | - |
| reset refusals (3) | no pack C1927 · template row missing C1927 · name taken C1928 | - |
| doors (5) | 1 C1936 · 2 C1935, C1926 · 3 C1921, C1922, C1925 · 4 C1908 · 5 C1902, C1934 | - |
| relations entities (5) | catalog pack C1936 · catalog type C1936 · catalog task C1936 · org type C1901 · org task C1915 | - |
| acceptance criteria (30) | 1 C1901 · 2 C1902 · 3 C1903 · 4 C1905, C1906, C1937 · 5 C1907, C1937 · 6 C1909 · 7 C1910 · 8 C1911 · 9 C1912 · 10 C1913 · 11 C1914 · 12 C1915 · 13 C1916, C1919 · 14 C1917 · 15 C1918 · 16 C1920 · 17 C1921 · 18 C1922 · 19 C1923 · 20 C1924 · 21 C1925 · 22 C1926 · 23 C1927 · 24 C1928 · 25 C1929 · 26 C1930, C1941 · 27 C1931 · 28 C1932 · 29 C1933 · 30 C1934 | - |

- Claims naming a status code, route or response shape: C1905, C1907, C1909, C1911, C1912, C1916, C1922, C1925, C1927, C1928, C1934, C1935, C1936, C1938, C1939 - each has a proof that crosses the boundary (a function call as the signed-in role, not a unit over its body)
- No startup configuration is added: the new functions and routes need no assembly-level setting
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1905, C1906, C1912, C1935
- failure modes: C1918 (a refused removal changes nothing), C1928 (a refused reset changes nothing), C1938 (an unexpected error is `unavailable`)
- idempotency: C1923 (seeding twice adds nothing), C1907 (a retried add creates no second type)
- authorization: C1909, C1931, C1940
- concurrency: C1908 - the unique index refuses a duplicate name below the functions, and C1916 relies on the foreign keys for a removal racing an asset insert; `test:db` runs one connection per recipe, so two parallel sessions are not exercised
- data lifecycle: C1915, C1917, C1924
- dependency failure: n/a - the feature calls no external service; the database is the only dependency and its failures map to `unavailable` (C1938)
- state transitions: n/a - a type has no status; the only guarded changes are removal (C1916) and reset (C1927)
- observability: n/a - no logging or metric requirement; the store keeps the existing `console.error` for unexpected failures

## Out of scope

- see the plan's `Out of scope` table

## Handoff

- S1 = ~8k (migration 15 KB + SQL test 10 KB), S2 = ~3k, S3 = ~6k, S4 = ~8k, S5 = ~4k, S6 = ~14k (restored page 11 KB + new controls)
- Total ~43k from `wc -c` on the files touched, divided by four, all in `supabase/` and `web/`; under the 150k budget - one builder
- Mechanism: one builder

- **Settled mid-build:** (1) C1924's proof could not read the demo org, because `fixture.sql` deletes it, so the claim now says the backfill statement is run over fixture rows and the live demo org is read once after the migration is applied. (2) C1926 said 6 RTU tasks; the template has 10, 2 of them seasonal, so the claim was corrected. (3) Door 6 was added to the plan before the code: reset is `security definer` because `authenticated` cannot read the private template. (4) C1407 and the `test:db` runner counts (23 to 24 recipes, 25 to 26 files) changed because `pack` joined `LibraryType` and one recipe was added; no assertion was loosened.
- **Abandoned:** nothing.
