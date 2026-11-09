# Starter packs checks

Profile: standard
Plan: `.specs/features/starter-packs/plan.md`

28 checks in 4 slices · 4 one-way doors (3 approved, 1 added) · 2 open, of which 1 blocks go-live and 0 block

## How proofs run

- **SQL** recipes run with `npm run test:db starter_packs` from `web/` (new file `supabase/tests/starter_packs.sql`, run after `fixture.sql`, rolled back). Every assertion is labelled with its check id (`C2201 ...`). They need the new migration applied to the database `SUPABASE_DB_URL`, which is the hosted project; applying it needs the owner's go-ahead (rule 8), so until then the SQL proofs are written, not green. S3 releases the two packs **inside the rolled-back transaction** (`update private.catalog_packs set released_at = now()`); the shipped migration releases nothing (AC 23).
- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C2222:`). This feature numbers from C2201 (no id above C2127 exists). `npx vitest run -t "C2222:"` selects one.
- Expected data in the tests (the two 20-type lists with codes, names and months) is copied from `.specs/features/starter-packs/types-draft.md`, never read back from the migration.
- Words used in tests: spelling comparison uses `normalized` from `web/domain/imports` (lowercase, every run of non-letters and non-digits one space, trimmed) and its SQL equivalent `btrim(regexp_replace(lower(x), '[^[:alnum:]]+', ' ', 'g'))`.
- Door 3 as approved is a saved query file. A loose file cannot be run by the SQL runner, so door 4 (added) puts the query body in `private.pack_review_sheet(text)` and the file calls it: the reviewer's sheet is the function's output, and the function is what C2223 and C2224 prove.
- Existing recipes that register or seed their own test packs (`type_editor`, `synonyms_as_data`) release them in setup. That is a setup line in each file, written from C2228, not an edit of any assertion.

## Checks

### S1 - The template holds the two packs · 4 files · ~145 KB · ~36k

**C2201** - The `plumbing` pack holds exactly 20 types, and for each of the 20 codes in `types-draft.md` its name and default visit months equal the list's (plan AC 1)
Proof: `npm run test:db starter_packs` (assertions `C2201 ...`, table-driven over the 20 expected rows)

**C2202** - The `electrical` pack holds exactly 20 types, and for each of the 20 codes in `types-draft.md` its name and default visit months equal the list's (plan AC 1)
Proof: `npm run test:db starter_packs` (assertions `C2202 ...`, table-driven over the 20 expected rows)

**C2203** - `private.catalog_packs` has the rows `plumbing` with trade phrase `plumbing` and `electrical` with trade phrase `electrical`, and both phrases satisfy the existing rule `^[A-Za-z0-9 ,&/'-]{1,200}$` (plan AC 2, door 1)
Proof: `npm run test:db starter_packs` (assertions `C2203 ...`)

**C2204** - Every type in the two packs has between 1 and 8 tasks, positions are 1..n with no gap, and every description is 1 to 120 characters after trimming (plan AC 3)
Proof: `npm run test:db starter_packs` (assertions `C2204 ...`, per type over the 40)

**C2205** - The codes that exist in both `hvac` and a new pack are exactly `BACKFLOW_PREVENTER`, `PRESSURE_REGULATING_VALVE` and `EXPANSION_TANK`, all in `plumbing`, and each carries the name the `hvac` type has (`Backflow preventer`, `Pressure regulating valve`, `Expansion tank`) (plan AC 4)
Proof: `npm run test:db starter_packs` (assertions `C2205 ...`)

**C2206** - Across the three packs, two types with the same name ignoring case have the same code (plan AC 5)
Proof: `npm run test:db starter_packs` (assertions `C2206 ...`)

**C2207** - Across the three packs, no spelling of a type equals, after `normalized`, the name, the code or the spelling of a type with a different code (plan AC 6; codes added because matching reads a code before a spelling)
Proof: `npm run test:db starter_packs` (assertions `C2207 ...`, over every spelling of every pack)

**C2208** - Every one of the 40 new types has at least 1 spelling, and no type lists the same spelling twice after `normalized` (plan AC 7)
Proof: `npm run test:db starter_packs` (assertions `C2208 ...`, per type over the 40)

### S2 - A pack seeds only once it is released · 3 files · ~95 KB · ~24k

**C2209** - After the migration `private.catalog_packs.released_at` is not null for `hvac` and null for `plumbing` and `electrical`, and a pack registered without naming it has `released_at` null (plan AC 8, AC 23, door 2)
Proof: `npm run test:db starter_packs` (assertions `C2209 ...`)

**C2210** - `seed_org_catalog(org, 'plumbing')` on an unreleased pack raises `55000`, inserts no type and no task for the org, and leaves the org's `trade_context` as it was, for an org whose context is null and for one that holds `HVAC and mechanical`; the same for `electrical` (plan AC 9)
Proof: `npm run test:db starter_packs` (assertions `C2210 ...`)

**C2211** - `seed_org_catalog(org, 'nope')` raises `22023` and inserts nothing (plan AC 10)
Proof: `npm run test:db starter_packs` (assertions `C2211 ...`)

**C2212** - `seed_org_catalog(org)` with no pack seeds the 40 `hvac` types, returns 40 and stamps pack `hvac` (plan AC 11)
Proof: `npm run test:db starter_packs` (assertions `C2212 ...`)

**C2213** - `anon` and `authenticated` cannot select or update `private.catalog_packs.released_at`, cannot execute `private.seed_org_catalog` and cannot execute `private.pack_review_sheet`: each raises `42501` (plan AC 12, door 4)
Proof: `npm run test:db starter_packs` (assertions `C2213 ...`, as each real role)

**C2214** - After the test release, `seed_org_catalog(org, 'plumbing')` returns 20 and `seed_org_catalog(org, 'electrical')` returns 20 for a fresh org each (plan AC 13)
Proof: `npm run test:db starter_packs` (assertions `C2214 ...`)

### S3 - Released packs seed, combine and reset correctly · 3 files · ~110 KB · ~28k

**C2215** - After the test release, a fresh org with a settings row seeded with `plumbing` holds 20 types whose name, months, spellings, pack stamp `plumbing` and task descriptions in order equal the template's, and its `trade_context` is `plumbing` (plan AC 14)
Proof: `npm run test:db starter_packs` (assertions `C2215 ...`)

**C2216** - The same for `electrical`: 20 types equal to the template, pack stamp `electrical`, `trade_context` `electrical` (plan AC 15)
Proof: `npm run test:db starter_packs` (assertions `C2216 ...`)

**C2217** - An org seeded `hvac` then `plumbing`: the second call returns 17, the three shared types keep the task descriptions of the `hvac` pack and pack stamp `hvac`, the 17 others are stamped `plumbing`, and the context is `HVAC and mechanical, plumbing` (plan AC 16)
Proof: `npm run test:db starter_packs` (assertions `C2217 ...`)

**C2218** - An org seeded `plumbing` then `hvac`: the second call returns 37, the three shared types keep the task descriptions of the `plumbing` pack and pack stamp `plumbing`, and the context is `plumbing, HVAC and mechanical` (plan AC 17)
Proof: `npm run test:db starter_packs` (assertions `C2218 ...`)

**C2219** - An org seeded with `hvac`, `plumbing` and `electrical` holds 77 types and a context listing the three phrases once each in seed order, and seeding each of the three again returns 0 and leaves a digest of the org's types, tasks and context unchanged (plan AC 18)
Proof: `npm run test:db starter_packs` (assertions `C2219 ...`)

**C2220** - `reset_task_library_type` on a `plumbing` type and on an `electrical` type restores that type's name, months, spellings and tasks to its own pack's, after each had been edited (plan AC 19)
Proof: `npm run test:db starter_packs` (assertions `C2220 ...`)

**C2221** - `reset_task_library_type` on `BACKFLOW_PREVENTER` restores the `plumbing` tasks in an org whose copy is stamped `plumbing` and the `hvac` tasks in an org whose copy is stamped `hvac`, though both packs hold that code (plan AC 19)
Proof: `npm run test:db starter_packs` (assertions `C2221 ...`)

**C2222** - With the types of all three packs as one org's list, `matchAssetType` returns the id of the type that holds a spelling, for every spelling of the `plumbing`, `electrical` and `hvac` packs, read from the migrations' own spelling lists, and returns that type's id and nothing else (plan AC 20)
Proof: `npx vitest run domain/imports -t "C2222:"` (table-driven over every spelling in the three packs; the shared codes appear once, as one org holds one row per code)

### S4 - The reviewer can read what they sign · 3 files · ~25 KB · ~6k

**C2223** - `private.pack_review_sheet('plumbing')` returns one row per task with columns pack, type code, type name, default visit months, spellings, position and description, ordered by code then position, and the first row's values equal the template's first task (plan AC 21, door 4)
Proof: `npm run test:db starter_packs` (assertions `C2223 ...`)

**C2224** - `pack_review_sheet('plumbing')` returns as many rows as the pack has tasks, `pack_review_sheet('electrical')` likewise, and `pack_review_sheet('nope')` returns 0 rows (plan AC 22)
Proof: `npm run test:db starter_packs` (assertions `C2224 ...`)

**C2225** - After the migration neither `plumbing` nor `electrical` can be seeded by the shipped data: with no test release, `seed_org_catalog` raises `55000` for both (plan AC 23)
Proof: `npm run test:db starter_packs` (assertions `C2225 ...`, run before the test release)

**C2226** - `supabase/packs/sheet.sql` exists, runs `private.pack_review_sheet` for `plumbing` and for `electrical`, and names no other table (plan door 3)
Proof: `npx vitest run domain/imports -t "C2226:"`

### Existing proofs kept true

**C2227** - The SQL runner registers a recipe named `starter_packs` made of `fixture.sql` then `starter_packs.sql`, and refuses nothing it did not before (plan Impact, tests)
Proof: `npx vitest run scripts/test-db -t "C2227:"`

**C2228** - The recipes that seed or register packs still pass with test packs released in their setup: `catalog_seed`, `type_editor`, `synonyms_as_data`, `cadence`, `service_included`, `demo_seed` (plan Impact, tests)
Proof: `npm run test:db catalog_seed type_editor synonyms_as_data cadence service_included demo_seed` (each prints `PASS`)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `plumbing` pack types (20) | `BACKFLOW_PREVENTER` C2201 C2204 C2208 · `PRESSURE_REGULATING_VALVE` C2201 C2204 C2208 · `EXPANSION_TANK` C2201 C2204 C2208 · `WATER_HEATER_COMMERCIAL` C2201 C2204 C2208 · `TANKLESS_WATER_HEATER` C2201 C2204 C2208 · `MIXING_VALVE` C2201 C2204 C2208 · `RECIRCULATION_PUMP` C2201 C2204 C2208 · `BOOSTER_PUMP` C2201 C2204 C2208 · `SUMP_PUMP` C2201 C2204 C2208 · `SEWAGE_EJECTOR_PUMP` C2201 C2204 C2208 · `GREASE_INTERCEPTOR` C2201 C2204 C2208 · `OIL_INTERCEPTOR` C2201 C2204 C2208 · `FLOOR_DRAIN` C2201 C2204 C2208 · `BACKWATER_VALVE` C2201 C2204 C2208 · `ROOF_DRAIN` C2201 C2204 C2208 · `WATER_SOFTENER` C2201 C2204 C2208 · `WATER_FILTRATION` C2201 C2204 C2208 · `DRINKING_FOUNTAIN` C2201 C2204 C2208 · `EYEWASH_STATION` C2201 C2204 C2208 · `FLUSH_VALVE` C2201 C2204 C2208 | - |
| `electrical` pack types (20) | `SWITCHGEAR` C2202 C2204 C2208 · `SWITCHBOARD` C2202 C2204 C2208 · `DISTRIBUTION_PANEL` C2202 C2204 C2208 · `BRANCH_PANEL` C2202 C2204 C2208 · `MOTOR_CONTROL_CENTER` C2202 C2204 C2208 · `DRY_TRANSFORMER` C2202 C2204 C2208 · `DISCONNECT_SWITCH` C2202 C2204 C2208 · `VFD` C2202 C2204 C2208 · `GENERATOR` C2202 C2204 C2208 · `TRANSFER_SWITCH` C2202 C2204 C2208 · `UPS` C2202 C2204 C2208 · `BATTERY_SYSTEM` C2202 C2204 C2208 · `EMERGENCY_LIGHTING` C2202 C2204 C2208 · `EXIT_SIGN` C2202 C2204 C2208 · `LIGHTING_CONTROL_PANEL` C2202 C2204 C2208 · `SITE_LIGHTING` C2202 C2204 C2208 · `GFCI_DEVICE` C2202 C2204 C2208 · `SURGE_PROTECTOR` C2202 C2204 C2208 · `EV_CHARGER` C2202 C2204 C2208 · `GROUNDING_SYSTEM` C2202 C2204 C2208 | - |
| codes shared with `hvac` (3) | `BACKFLOW_PREVENTER` C2205 C2221 · `PRESSURE_REGULATING_VALVE` C2205 C2217 · `EXPANSION_TANK` C2205 C2218 | - |
| new packs (2) | `plumbing` C2203 C2214 C2215 · `electrical` C2203 C2214 C2216 | - |
| trade phrases (3 in one org) | `HVAC and mechanical` C2217 C2219 · `plumbing` C2215 C2219 · `electrical` C2216 C2219 | - |
| `seed_org_catalog` outcomes (5) | unreleased `55000` C2210 C2225 · unregistered `22023` C2211 · no pack argument C2212 · released pack inserts and returns its count C2214 · pack seeded again returns 0 C2219 | - |
| `seed_org_catalog` return values (4) | 20 C2214 · 17 C2217 · 37 C2218 · 0 C2219 | - |
| seed orders (3) | `hvac` then `plumbing` C2217 · `plumbing` then `hvac` C2218 · all three C2219 | - |
| unreleased seed, org context before (2) | null C2210 · `HVAC and mechanical` C2210 | - |
| release state after the migration (3 packs) | `hvac` released C2209 · `plumbing` null C2209 C2225 · `electrical` null C2209 C2225 | - |
| roles on the gate (8) | `anon` read C2213 · `anon` update C2213 · `anon` seed C2213 · `anon` sheet C2213 · `authenticated` read C2213 · `authenticated` update C2213 · `authenticated` seed C2213 · `authenticated` sheet C2213 | - |
| reset cases (4) | `plumbing` type C2220 · `electrical` type C2220 · shared code in a `plumbing` org C2221 · shared code in an `hvac` org C2221 | - |
| task count bounds (2 edges) | at least 1 C2204 · at most 8 C2204 | - |
| task description bounds (2 edges) | 1 character minimum C2204 · 120 characters maximum C2204 | - |
| collision classes over spellings (4) | spelling = other type's name C2207 · = other type's code C2207 · = other type's spelling C2207 · same type repeated C2208 | - |
| review sheet cases (4) | `plumbing` C2223 C2224 · `electrical` C2224 · unregistered pack C2224 · row order C2223 | - |
| door 1: pack ids and phrases (4) | `plumbing` id C2203 · `electrical` id C2203 · `plumbing` phrase C2203 · `electrical` phrase C2203 | - |
| door 2: release gate (3) | column and default C2209 · refusal C2210 · roles C2213 | - |
| door 3: the saved query file (1) | `supabase/packs/sheet.sql` C2226 | - |
| door 4: the sheet function (3) | rows and order C2223 · counts C2224 · roles C2213 | - |
| `Relations` entities (4) | pack C2203 · type C2201 · task C2204 · release C2209 | - |
| functions replaced in place (1) | `seed_org_catalog` C2210 C2211 C2212 C2214 | - |
| startup configuration (0 assemblies) | n/a - no env var, flag or assembly step is added; the migration is the only prerequisite (see Handoff) | - |

- Claims naming a status code or SQLSTATE: C2210, C2211, C2213, C2225 - each has a proof that crosses the boundary (SQL as the real role, or the real function call)
- `Surface` is `None`, so no route row is owed
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (`seed_org_catalog` guard and combination, `reset_task_library_type`) | one at the boundary **and** one at its own layer | the contract at the boundary; each outcome and each transition at the layer |
| Pack data (rows that carry no conditional but are checked for shape) | one at its own layer | every member of each set, table-driven, with the size stated |
| Instrumentation (`supabase/packs/sheet.sql`, the function's select) | one round trip | the columns and the empty case |

Evidence:

- `seed_org_catalog` gains 1 branch (released or not) and keeps 4 others (unknown pack, conflict skip, context append, no settings row) -> decides (C2210, C2211, C2212, C2214, C2217 to C2219)
- `reset_task_library_type` is unchanged in code and gains behaviour from data: it reads the type's own pack (2 packs with a shared code) -> decides (C2220, C2221)
- the pack rows are data with 6 shape rules (counts, bounds, names, collisions, spellings, phrases) -> pack data (C2201 to C2208)
- `pack_review_sheet` is a select with an `order by` and no conditional -> instrumentation (C2223, C2224)
- closest analogue in the repo: synonyms-as-data `synonyms_as_data.sql` C2109 (the `hvac` pack's 27 spellings, table-driven) and C2117 (the seed's context transitions), same shape, proven at this level with 27 and 5 cases

Cost: 6 decision proofs at their own layer (C2210, C2211, C2212, C2217, C2218, C2220) across 1 new file, plus 8 data-shape proofs. Without these rows, the release gate and the shared-code rule would be proven only by a seed that happens to pass through them.

## Swept

- validation: C2203 (phrase shape), C2204 (task count and length), C2206 and C2207 (names, codes and spellings across packs), C2208 (spellings present and unique)
- failure modes: C2210 (an unreleased pack raises and changes nothing), C2211 (an unknown pack raises and changes nothing)
- idempotency: C2219 (each pack seeded again returns 0 and changes nothing)
- authorization: C2213 (the gate and the function closed to `anon` and `authenticated`); `seed_org_catalog` stays closed as AD-154 says, proven there
- concurrency: n/a - the seed runs once per org at provisioning and the context is one `UPDATE` under the row lock (AD-162); the SQL runner holds one session and cannot interleave two, so no proof is claimed
- data lifecycle: C2209 and C2225 (the shipped migration releases nothing), C2219 (a re-seed is a no-op); the migration moves no org data and the rows are template rows that nothing else deletes
- dependency failure: n/a - the packs and the guard are database-only; no network, queue or provider is touched
- state transitions: C2209 (the one transition, unreleased to released, is a later migration; here a pack's state after the migration is pinned) and C2210 (the refusal while unreleased)
- observability: n/a - no logging or metric requirement; the refusal is a SQLSTATE the Phase 5 caller will surface

## Out of scope

- see the plan's `Out of scope` table

## Handoff

- S1 = ~36k (new migration ~35 KB written, `types-draft.md` ~5 KB, `synonyms-as-data` migration ~10 KB read, `domain/imports/index.ts` 15 KB read, new vitest ~6 KB), S2 = ~24k (`type_editor.sql` ~30 KB, `synonyms_as_data.sql` ~30 KB read for their setup lines, new SQL test ~25 KB), S3 = ~28k (same new SQL test, `runner.mts` and `runner.test.ts` ~12 KB), S4 = ~6k (the function in the migration, `sheet.sql`, the file check)
- Total ~94k from `wc -c` on the files touched, divided by four, all in `supabase/` and `web/`, plus `CONTEXT.md`, `STATE.md`, `ROADMAP.md` and `PRODUCT.md` edits at ~15k; under the 150k budget - one builder
- Build order: the migration (doors 1, 2 and 4 with the content), then `starter_packs.sql` and the setup lines of the two recipes, then the vitest files, then docs. Door 4 goes in `plan.md` before the migration that closes it
- Mechanism: one builder
- Applying the migration to the hosted project and running the SQL proofs need the owner's go-ahead (rule 8); until then C2201 to C2221, C2223 to C2225 and C2228 are written and not run
