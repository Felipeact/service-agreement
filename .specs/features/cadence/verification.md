# Cadence verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 635a493..93e0337
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

Steps not run: the profile is `light`, so there was no fault injection, no `Coverage` recompute and no `Test policy` verdicts (checks.md has no `Test policy` section). A test that would still pass under a wrong implementation, or a set member nobody proved, is therefore not caught here. `standard` covers those.

## Round 3 scope (verified at 93e0337)

- **The fix:** `93e0337` "docs(cadence): record c1097 save at 375". `git diff --stat 04ec278..93e0337` gives only `.specs/features/cadence/checks.md | 12 ++++++++++++`: twelve added Handoff lines, `checks.md:335-346`. It is docs-only. No source, test, migration or SQL suite changed since round 1 (`724d5f9`), so every carried citation below still points at the same lines.
- **Re-judged:** C1097, the only verdict that was not PASS in round 2. Everything else carries forward and says where from.
- **Isolation:**
  - The main tree holds uncommitted edits from another feature (seasonal-tasks) that is in progress. They are not in HEAD and were not touched.
  - Every proof ran in a detached worktree at `93e0337` in the session scratchpad. It had `web/node_modules` as a junction to the main tree's and a copy of `web/.env.local`, and its own `git status --porcelain` stayed empty throughout.
- **Proofs re-run in full at `93e0337`** (worktree):
  - **vitest:** one invocation from `web/`: `npx vitest run domain/agreement components/agreements "app/(app)" infrastructure/supabase infrastructure/documents components/review application/use-cases -t "C10[6-9][0-9]:" --reporter=verbose`. Result: 7 files and 44 tests passed, 905 skipped, exit 0. Each named test for C1061-C1069, C1072, C1074, C1075, C1080-C1086, C1089 and C1096 appears individually as passed. The two `stderr` lines (C1061, C1067) are logged output from passing tests.
  - **test:db:** `npm run test:db` ran all recipes on the remote, rolled back. Every recipe printed `PASS`, including `cadence` and `demo_seed`: `19 passed, 0 failed`, exit 0.
  - **npm test:**
    - The first run (alone, cold worktree) gave `Tests 2 failed | 1862 passed (1864)`, exit 1. The two failures are the known lint-driven timeouts: C32 (`domain/purity.test.ts`, 5514 ms) and C873 (`boundaries.test.ts`, 5568 ms), both over the 5000 ms default.
    - The second run gave `Test Files 90 passed (90)`, `Tests 1864 passed (1864)`, exit 0.
    - The two files alone gave `62 passed`, exit 0.
    - Neither file is in the diff (finding 2).
  - **tsc:**
    - The first `npx tsc --noEmit` exited 2, only with `TS2304 Cannot find name 'PageProps'` / `'LayoutProps'` and two knock-on `TS7006`.
    - Those names are Next.js's generated route globals. `web/tsconfig.json:30` includes them from `.next/types/**/*.ts`, and a fresh worktree has no `.next`.
    - After `npx next typegen` in the worktree (output in the gitignored `.next`, porcelain still empty), `npx tsc --noEmit` exited 0. The cause is the environment, not the code.
  - **lint:** `npm run lint` exit 0.
- **MCP:** not re-run. The SELECT-only `execute_sql` results for C1077, C1091 and C1092 are carried from `04ec278`, which carried them from `724d5f9`. The fix touched no data path that could change them.

## Binding sources (carried from 04ec278, originally 724d5f9)

Step 1 runs only under `ui`, and this feature is `light`. ROADMAP.md (Phase 3.5 item 2, `## Cadence`) and the STATE.md decisions were read only as context for C1098. No contradiction search or per-screen enumeration was done.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 3.5 item 2 / `## Cadence` | yes (C1098 tick at `ROADMAP.md:148`); not compared, step 1 is `ui` only | - | - |
| `.specs/STATE.md` AD-003, AD-008, AD-053-055, AD-058, AD-064, AD-068 | yes (AD-008 and AD-055 amended, AD-080-084 added); not compared, step 1 is `ui` only | - | - |

## Checks (proofs verified at 93e0337; evidence carried from 04ec278, originally 724d5f9, except C1095 and C1097, re-judged at 93e0337)

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1060 | door 1 refuses `{}`, `{6,3}`, `{3,3}`, `{0}`, `{13}` and a count of 5 with `23514`; `{3,6,9,12}` with 4 is accepted | `npm run test:db cadence` PASS | `supabase/tests/cadence.sql:92-95` - loop over the five arrays, `tests.expect_error('C1060 ' concatenated with v, ...update ... set visit_months = %L..., '23514')`; `:97` `expect_error('C1060 count', ...visits_per_year = 5..., '23514')`; `:99` `expect_rows('C1060 accepted', ...visits_per_year = 4..., 1)` | PASS |
| C1061 | the RPC stores 4 visits; the reader gives `visitsPerYear: 4`, `annualCents: 100000` | test:db cadence PASS; vitest `infrastructure/supabase` `C1061:` passed | `supabase/tests/cadence.sql:110` - `(select visits_per_year ...) = 4`; `:112` - `visits_per_year * cost_per_visit_cents = 100000`; `web/infrastructure/supabase/cadence.test.ts:45` - `toMatchObject({ visitsPerYear: 4, annualCents: 100000, visitMonths: [3, 6, 9, 12] })` | PASS |
| C1062 | `Visit months` fieldset, twelve `visitMonths` checkboxes 1..12 labelled Jan..Dec, `grid-cols-6` and `md:grid-cols-12`, three presets | vitest `components/agreements` `C1062:` passed | `web/components/agreements/cadence.test.ts:93` `toHaveLength(12)`; `:95` values `["1",...,"12"]`; `:97` labels `["Jan",...,"Dec"]`; `:98` `toMatch(/<div class="...\bgrid-cols-6\b...\bmd:grid-cols-12\b...">/)`; `:99` the three `<button type="button">` presets | PASS |
| C1063 | presets give `[3,6,9,12]`, `[4,10]`, `[1..12]`; `checked=[4,10]` checks exactly 4 and 10 | vitest `domain/agreement` and `components/agreements` `C1063:` passed | `web/domain/agreement/cadence.test.ts:11-13` - `MONTH_PRESETS.quarterly toEqual([3,6,9,12])`, `.semiAnnual toEqual([4,10])`, `.monthly toEqual([1..12])`; `web/components/agreements/cadence.test.ts:104` - `checked.map(value) toEqual(["4", "10"])` | PASS |
| C1064 | no month gives `Choose at least one visit month` (validator, action with no store call, form) | vitest `domain/agreement`, `app/(app)`, `components/agreements` `C1064:` passed | `web/domain/agreement/cadence.test.ts:20` - `toEqual({ ok: false, errors: { visitMonths: "Choose at least one visit month" } })`; `web/app/(app)/agreements.test.ts:190-193` - `toMatchObject({ status: "invalid", ... })` and `expect(write).not.toHaveBeenCalled()` for add/update/remove; `web/components/agreements/cadence.test.ts:109` - fieldset `toContain("Choose at least one visit month")` | PASS |
| C1065 | no `visitsPerYear` input and no `Visits per year` text | vitest `components/agreements` `C1065:` passed | `web/components/agreements/cadence.test.ts:114-115` - `not.toMatch(/name="visitsPerYear"/)`, `not.toContain("Visits per year")` | PASS |
| C1066 | row shows `Mar, Jun, Sep, Dec` and `4 visits/yr`; `[12,1]` gives `Jan, Dec` | vitest `components/agreements` `C1066:` passed | `web/components/agreements/cadence.test.ts:145-147` - `toContain("Mar, Jun, Sep, Dec")`, `toContain("4 visits/yr")`, row with `visitMonths: [12, 1]` `toContain("Jan, Dec")` | PASS |
| C1067 | editable detail lists the site's types plus covered types, by name, with `defaultVisitMonths`; the form has one `assetTypeIds` box per choice, in order | vitest `infrastructure/supabase` and `components/agreements` `C1067:` passed (3 tests) | `web/infrastructure/supabase/cadence.test.ts:61-65` - `equipmentChoices toEqual([AHU (covered, no asset), BOILER, RTU])` with `defaultVisitMonths`; `web/components/agreements/cadence.test.ts:128` - `checks.map(value) toEqual(["t-ahu", "t-boiler", "t-rtu"])` | PASS |
| C1068 | no type gives `Choose at least one equipment type`; update action is `invalid` with no store call | vitest `domain/agreement`, `app/(app)` `C1068:` passed | `web/domain/agreement/cadence.test.ts:25` - `errors: { assetTypeIds: "Choose at least one equipment type" }`; `web/app/(app)/agreements.test.ts:198-201` - `status: "invalid"` and `not.toHaveBeenCalled()` on all three store methods | PASS |
| C1069 | prefill gives `[3,6,9,10,12]`, `[10]`, `[]`; once edited the current months stay | vitest `domain/agreement` `C1069:` passed (2 tests) | `web/domain/agreement/cadence.test.ts:43-45` - `toEqual([3,6,9,10,12])`, `toEqual([10])`, `toEqual([])`; `:49` - `edited: true` `toEqual([1, 7])` | PASS |
| C1070 | org B type raises `23503`; line count and coverage unchanged on add, line kept on update | test:db cadence PASS | `supabase/tests/cadence.sql:133` `expect_error('C1070 add', ..., '23503')`; `:134` line count `= lines`; `:136` coverage count `= cover`; `:138` update `23503`; `:140` description/months kept; `:143` `cd_cover(line) = cd_ids('{typeA}')` | PASS |
| C1071 | RPC returns uuid, two coverage rows; second call with `[RTU]` leaves one | test:db cadence PASS | `supabase/tests/cadence.sql:151` `line is not null`; `:152` `cd_cover(line) = cd_ids('{typeA,cd:boiler}')`; `:156` `cd_cover(line) = cd_ids('{typeA}')` | PASS |
| C1072 | error map `55000/42501/P0002/23503/54000/other`; six named args, `p_line_id: null` on add | vitest `infrastructure/supabase` `C1072:` passed (13 tests) | `web/infrastructure/supabase/cadence.test.ts:91` - `rpc.mock.calls toEqual([["save_service_line", { ...ARGS, p_line_id: null }]])`; `:95-97` six sorted keys; `:100-110` table `[55000 locked, 42501 forbidden, P0002 not_found, 23503 not_found, 54000 too_many, 23514/XX000 unavailable]` `toEqual({ ok: false, code: expected })`; `:113-121` same on update | PASS |
| C1073 | `54000` at 50 lines, `42501` viewer, `P0002` missing agreement | test:db cadence PASS | `supabase/tests/cadence.sql:167` `expect_error('C1073 50 lines', ..., '54000')`; `:170` missing agreement (`P0002`); `:177` `expect_error('C1073 viewer', ..., '42501')` | PASS |
| C1074 | no equipment: link text to `/sites/<siteId>`, no `LineForm` | vitest `components/agreements` `C1074:` passed | `web/components/agreements/cadence.test.ts:134` - `toMatch(/<a[^>]*href="\/sites\/s1"[^>]*>Add equipment to this site before adding a service line<\/a>/)`; `:135-136` - no `new-line-description`, no `Add line` button | PASS |
| C1075 | RTU + AHU shows `AHU, RTU` | vitest `components/agreements` `C1075:` passed | `web/components/agreements/cadence.test.ts:151-152` - equipment given `[RTU, AHU]`, `toContain("AHU, RTU")` | PASS |
| C1076 | catalog defaults over all 40 codes, 19/8/13 | test:db cadence PASS | `supabase/tests/cadence.sql:196` sizes `19, 8, 13`; `:198` `count(*) = 40`; `:199-202` per code `default_visit_months = r.months::smallint[]` | PASS |
| C1077 | remote: 0 `asset_types` differing from the catalog default | MCP `execute_sql` (SELECT) re-run 2026-10-30: `c1077 = 0` | query result `{"c1077":0}`; Handoff `checks.md` Post-apply records `0` | PASS |
| C1078 | fresh org: RTU `{3,6,9,12}`, EXHAUST_FAN `{4,10}`, BOILER `{10}`, all equal to catalog | test:db cadence PASS | `supabase/tests/cadence.sql:212-215` the three codes; `:216-219` `count = 40 and not exists (... default_visit_months is distinct from c.default_visit_months)` | PASS |
| C1079 | `{}` and `{13}` give `23514`, null gives `23502` | test:db cadence PASS | `supabase/tests/cadence.sql:224-229` - `expect_error('C1079 empty', ..., '23514')`, `('C1079 13', ..., '23514')`, `('C1079 null', ..., '23502')` | PASS |
| C1080 | `visitSchedule` gives the five rows exactly, RTU once in March; `[]` for none | vitest `domain/agreement` `C1080:` passed | `web/domain/agreement/cadence.test.ts:59-66` - `toEqual([{month:3,["AHU","RTU"]},{6,...},{9,...},{10,["Boiler"]},{12,...}])`, `visitSchedule([]) toEqual([])` | PASS |
| C1081 | document carries the schedule; PDF prints `Visit schedule` between `Service and price` and `Service included`, with `March AHU, RTU` and `October Boiler` | vitest `domain/agreement` and `infrastructure/documents` `C1081:` passed | `web/domain/agreement/cadence.test.ts:95` - `buildAgreementDocument(...).schedule toEqual(visitSchedule(...))`; `web/infrastructure/documents/schedule.test.ts:36-40` - `at("Visit schedule") > at("Service and price")`, `at("Service included") > at("Visit schedule")`, section `toMatch(/March\s*AHU, RTU/)`, `/October\s*Boiler/` | PASS |
| C1082 | `portal_view` null for unknown hash; per line `visitMonths` and `equipment` by name; adapter maps them | test:db cadence PASS; vitest `infrastructure/supabase` `C1082:` passed (2 tests) | `supabase/tests/cadence.sql:250` `portal_view(<unknown>) is null`; `:252` `visitMonths = '[3,6,9,12]'`; `:254-256` `equipment = [{AHU},{BOILER},{RTU}]` ordered by name; `web/infrastructure/supabase/cadence.test.ts:155` `view.lines toEqual([...visitMonths, equipment...])` | PASS |
| C1083 | review view `Visit schedule` after lines, before `Service included`, March and October rows | vitest `components/review` `C1083:` passed | `web/components/review/schedule.test.ts:36-40` - `at("Visit schedule") > at("Total per year")`, `< at("Service included")`, section `toContain("March AHU, RTU")`, `toContain("October Boiler")` | PASS |
| C1084 | agreement view, same section and order | vitest `components/agreements` `C1084:` passed | `web/components/agreements/cadence.test.ts:160-164` - same ordering and `March AHU, RTU` / `October Boiler` | PASS |
| C1085 | `No visits scheduled yet` in PDF, review and agreement view | vitest `infrastructure/documents`, `components/review`, `components/agreements` `C1085:` passed (3 tests) | `web/infrastructure/documents/schedule.test.ts:46`, `web/components/review/schedule.test.ts:45`, `web/components/agreements/cadence.test.ts:170` - section `toContain("No visits scheduled yet")` | PASS |
| C1086 | `portalDocument(view).schedule` equals `buildAgreementDocument(detail).schedule` | vitest `application/use-cases` `C1086:` passed | `web/application/use-cases/cadence.test.ts:55` - `portalDocument(view)?.schedule toEqual(staff)`; `:56` `staff toEqual([...five rows...])` | PASS |
| C1087 | revise copies `{4,10}` and two types to v2; v1 unchanged | test:db cadence PASS | `supabase/tests/cadence.sql:276` v2 months `= '{4,10}'`; `:278` v2 `cd_cover = cd_ids('{typeA,cd:boiler}')`; `:279` v1 line kept; `:281` v1 coverage kept | PASS |
| C1088 | estimator insert/delete coverage on sent or past version gives `55000`; owner passes; line delete cascades | test:db cadence PASS | `supabase/tests/cadence.sql:294-303` four `expect_error(..., '55000')` (sent insert/delete, past-version insert/delete); `:310` `expect_rows('C1088 owner insert', ..., 1)`; `:318-320` cascade count `= 0` | PASS |
| C1089 | `locked` shows `This version can no longer be changed.` | vitest `components/agreements` `C1089:` passed | `web/components/agreements/cadence.test.ts:119` - `toMatch(/role="alert"[^>]*>This version can no longer be changed\.</)` | PASS |
| C1090 | `months_for_visits` table for 1,2,3,4,6,8,12; raises for 13 and 0 | test:db cadence PASS | `supabase/tests/cadence.sql:329-332` - `private.months_for_visits(r.n) = r.months::smallint[]` over the seven rows; `:334-342` - 13 and 0 must raise (re-raises only the sentinel `no exception`) | PASS |
| C1091 | remote: 0 count mismatches; AG-1046/AG-1048 keep 4 visits and their amounts; 0 uncovered lines on sites with assets | MCP `execute_sql` (SELECT) re-run 2026-10-30 | result `c1091_mismatch = 0`, `c1091_uncovered = 0`; AG-1046 v1 `4, {3,6,9,12}, 2160000` (540000 x 4), AG-1048 v1 and v2 `4, {3,6,9,12}, 1428000` (357000 x 4); 14 lines, 55 coverage rows, as in the Handoff | PASS |
| C1092 | backfill runs through `months_for_visits` (raises n > 12) in the migration; pre-apply count recorded as 0 | Handoff record (pre-apply cannot be re-run) + test:db cadence C1090 PASS; MCP re-run: `visits_per_year > 12` now `0` | `supabase/migrations/20261030120000_cadence.sql:45` - `update public.service_lines set visit_months = private.months_for_visits(visits_per_year);`; `:31` - `raise exception ... using errcode = '22023'`; raise proven at `supabase/tests/cadence.sql:334-342`; Handoff Pre-apply: `visits_per_year > 12` = `0` | PASS |
| C1093 | backfill: frozen version from snapshot, unfrozen from site; second run adds nothing | test:db cadence PASS | `supabase/tests/cadence.sql:358` frozen `cd_cover = cd_ids('{cd:boiler}')`; `:360` draft `cd_cover = cd_ids('{typeA,cd:ahu}')`; `:364` `count(*) = n` after the second run | PASS |
| C1094 | after seed twice: every demo line has months, covered when its site has assets; rerun changes nothing | `npm run test:db demo_seed` PASS | `supabase/tests/demo_seed.sql:187-190` no line with empty `visit_months`; `:191` no uncovered line on a site with assets; `supabase/tests/demo_seed_rerun.sql:46-51` no changed months/coverage; `:52-54` coverage-row count unchanged | PASS |
| C1095 | `npm run test:db`, `npm test`, `npm run lint`, `npx tsc --noEmit` exit 0 | at 93e0337 in the worktree: `npm run test:db` `19 passed, 0 failed` exit 0; `npm test` 90 files, 1864 passed, exit 0 (second run); lint exit 0; tsc exit 0 after `next typegen` | Runner output `19 passed, 0 failed`; `Test Files 90 passed (90)`, `Tests 1864 passed (1864)`. The first `npm test` run timed out on C873 (`web/boundaries.test.ts:56`) and C32 (`web/domain/purity.test.ts`) at 5000 ms. Both pass alone (`62 passed`), and neither file is in the diff (finding 2). The first tsc run lacked the generated `.next/types` globals (`web/tsconfig.json:30`) in the fresh worktree; with them generated, it exits 0 | PASS |
| C1096 | `database.types.ts` lists the column, column, table and function | vitest `infrastructure/supabase` `C1096:` passed | `web/infrastructure/supabase/cadence.test.ts:184-188` - `block("service_lines") toContain("visit_months: number[]")`, `asset_types` `default_visit_months: number[]`, `service_line_asset_types` `service_line_id: string`, `save_service_line` `p_visit_months: number[]` and `p_asset_type_ids: string[]` | PASS |
| C1097 | live at 1440 and 375 (`checks.md:220-222`): add a line on AG-1046 covering one type, Quarterly, save; row reads `Mar, Jun, Sep, Dec · 4 visits/yr`, `Visit schedule` shown, PDF 200, no console error | not re-run (live check, settled by its recorded runs); judged from the Handoff record at `93e0337` | Both runs are on draft AG-1051. **At 1440** (`.specs/features/cadence/checks.md:324-334`): one type (`RTU ticked`) and Quarterly pressed, checked `3, 6, 9, 12`, then "Add line" (`:328`). Row `C1097 live check / Mar, Jun, Sep, Dec · 4 visits/yr / RTU` (`:329-330`). `Visit schedule` March/June/September/December (`:330-331`). `Download PDF` `200 application/pdf` (`:331`). Console 0 errors (`:332`). **At 375** (`.specs/features/cadence/checks.md:335-346`, new in `93e0337`): viewport set to 375x812 before AG-1051 was opened (`:337`). `RTU ticked`, Quarterly pressed, checked `3, 6, 9, 12` (`:338`), then "Add line" pressed at width 375 (`:339`). Right after the save and after a reload, both at 375: row `C1097 live check 375 / Mar, Jun, Sep, Dec · 4 visits/yr / RTU` (`:340`); `Visit schedule` March, June, September, December, each `RTU` (`:341`); `Download PDF` `200 application/pdf` (`:342`); console 0 errors, 0 warnings (`:342-343`). The line was then removed and AG-1051 is back to `No service lines yet.` (`:343-345`). **AG-1046 to AG-1051:** carried from round 2 and approved by the user. AG-1046 is `sent` and read-only (`:314-316`); AG-1051 is a draft and the user approved each write (`:324`, `:335-336`). The check text naming AG-1046 remains a precision gap (finding 1) | PASS |
| C1098 | STATE AD rows for doors 1-4 and 6, AD-008 amended, CONTEXT/DESIGN/ROADMAP updated | `grep -c "visit_months" .specs/STATE.md CONTEXT.md` -> `5`, `3` | `.specs/STATE.md:86-90` AD-080 (door 1), AD-081 (door 2), AD-082 (door 3), AD-083 (door 4), AD-084 (door 6); `.specs/STATE.md:14` AD-008 "amended by AD-082"; `CONTEXT.md:101`, `:120`; `DESIGN.md:264` Checkbox control; `ROADMAP.md:148` `- [x] Cadence` | PASS |
| C1099 | `send_agreement` raises `23514` with no lines, sends a version with months and coverage | test:db cadence PASS | `supabase/tests/cadence.sql:239-241` `expect_error('C1099 no lines', ...send_agreement..., '23514')`; `:244` `status = 'sent'` | PASS |

## Level and sampling (carried from 04ec278, originally 724d5f9)

- **C1062 "two rows of six below md".** After `d737b13` the grid is still `grid grid-cols-6 gap-1.5 md:grid-cols-12` (`web/components/agreements/line-form.tsx:122`). The change only switches each cell's `<label>` to `flex-col` below md (`:127`), so the box sits above its month. Twelve cells in six columns still make two rows of six, so AC 3 and the check as written hold. The C1062 regex at `cadence.test.ts:96` still matches `<label><input/>Jan</label>`, because the stacking is done with classes and not markup.
- **AC 19 and AC 23 with a four-field `DocumentLine`.** The schedule does not need to be on `DocumentLine`. It travels on `AgreementDocument.schedule`.
  - The staff PDF is covered by C1081 (domain): `buildAgreementDocument` fills it.
  - C1081 (renderer) shows the one layout prints it between `Service and price` and `Service included`.
  - The portal PDF route calls `portalDocument` (`web/app/review/[token]/pdf/route.ts:19`), and C1086 proves its `schedule` equals the staff one for the equivalent detail.
  - Both routes share `reactPdfDocumentRenderer`, so both PDFs are proven at the unit level.
  - No test renders a PDF from a route with a non-empty schedule. Under `light` this is noted, not failed, because C1081 does not name a route.
- **C1061 vitest half.** The stub row already carries `visits_per_year: 4`, so the adapter test only proves the mapping. The derivation of 4 from the months is proven at the database (`cadence.sql:110`). That is the right level for that claim.
- **C1092.** The backfill expression and the raise are both proven. The transaction guarantee depends on how the file was applied: the SQL editor, per Handoff item 3, which runs a multi-statement script as one implicit transaction. The pre-apply count was `0`, so the abort path never ran on the remote. The claim only asks for the count to be recorded, and it was.
- **Sampling:** no check claims more cases than its proof runs. C1072 is table-driven over every code it names, plus `23514` and `XX000` for "anything else". C1076 is table-driven over all 40 codes.

## Superseded tests (batch 2, "Settled mid-build") (carried from 04ec278, originally 724d5f9)

I checked every hunk of `git diff 635a493..HEAD -- '*.test.ts' 'supabase/tests/*.sql'` against the approved list.

- `web/domain/agreement/service-line.test.ts`: retired `C720 visits %j are refused...`, `C720 visits %j give %i` and `C720 ...returns all three messages`. The `accepted and returned trimmed` value takes the new shape. This matches the list. The remaining C720 description and cost cases are untouched.
- `web/components/agreements/agreements.test.ts` C715: the one `new-line-visitsPerYear` assertion became twelve unchecked `visitMonths` boxes. This matches. The other C715 lines are unchanged, and the C716-area `initial`/`values` edits are fixture shape only.
- `web/infrastructure/supabase/agreements.test.ts`: C719, C722, C724, C737, C741, `a 42501 is forbidden` and C744 moved to `rpc("save_service_line")`. This matches the list.
  - C719 dropped its position assertions. "After the last line" is now asserted in SQL at `supabase/tests/cadence.sql:118`.
  - C741 dropped "add with no version is not_found" and gained the `P0002` case.
  - C744 gained a "thrown update" case.
  - Remove-path assertions are unchanged.
- **C725 (flagged by the builder as outside the list):** the expected line in `toEqual` gained `visitMonths: [3, 6, 9, 12]` and `equipment: [...]`, and its amounts are unchanged. This is a fixture-shape update: `toEqual` is exact, so the assertion now pins more fields, not fewer. Nothing got weaker.
- Other `*.test.ts` hunks only add the new required fields (`visitMonths`, `equipment`, `equipmentChoices`, `schedule: []`) to fixtures:
  - `composition/*.test.ts`
  - `pdf/route.test.ts`
  - `domain/agreement/document.test.ts`
  - `infrastructure/documents/agreement-pdf.test.ts`
  - `application/portal-view.testing.ts`
  - `app/(app)/agreements.test.ts`
- `web/scripts/test-db/runner.test.ts`: counts 18 -> 19 recipes and 20 -> 21 files, plus `cadence` in `ALL`. This is the batch 1 approved pin bump.
- SQL suites: changes to `fixture.sql`, `agreement_builder.sql`, `customer_portal.sql`, `outbox_dispatch.sql` and the `rls_isolation.sql` C5 insert are setup only (inserts gain `visit_months`).
  - `rls_isolation.sql` C35 gains `service_line_asset_types` (approved).
  - `catalog_seed.sql` C25/C6 catalog inserts name `default_visit_months` (Landing row 7, setup).
  - No expected state or value changed.
- No `.skip`, `.only` or `todo` was added. I found no other weakened, deleted or skipped assertion.

## Swept (carried from 04ec278, originally 724d5f9)

- **concurrency (existing).** The cited constraint is there: `service_lines_frozen` reads the agreement `for share of a` (`supabase/migrations/20261027202354_agreement_builder.sql:81`, AD-054), and the new coverage trigger copies it (`supabase/migrations/20261030120000_cadence.sql:171`).
- The `n/a` rows (dependency failure, observability) are user-approved policy and were not re-read.

## Findings

1. **Precision gap, not failing: C1097 names AG-1046** (`.specs/features/cadence/checks.md:220`). AG-1046 is `sent` and read-only (`checks.md:314-316`), so the claim as written cannot be run. Both recorded runs used draft AG-1051 with the user's approval (`checks.md:324`, `:335-336`). This keeps the claim's intent: a draft, one type, Quarterly, save. Round 2 accepted it and the user approved it; this round carries that judgment. Round 2's blocking gap is closed: the add-and-save at 375 px is now recorded at `checks.md:335-346`, with the viewport set before the page was opened and "Add line" pressed at width 375.
2. **Not blocking: the C873 and C32 lint-driven tests time out under load.** `web/boundaries.test.ts:56` and `web/domain/purity.test.ts` hit the 5000 ms default on this round's first cold `npm test`, as in batch 1 and round 2. They pass on a re-run of the full suite and alone, and neither file is in this diff.
3. **Environment note, not a finding about the code:** in a fresh worktree `npx tsc --noEmit` needs Next.js's generated route types (`web/tsconfig.json:30`, `.next/types/**/*.ts`). With `npx next typegen` run first, it exits 0.

## Gate (verified at 93e0337)

All runs were in a worktree at `93e0337`:
- `npx vitest run <7 dirs> -t "C10[6-9][0-9]:"`: 44 passed, 0 failed (exit 0)
- `npm run test:db`: 19 passed, 0 failed (exit 0)
- `npm test`: 1864 passed, 0 failed, 90 files (exit 0 on the re-run; the first run had 2 known lint-test timeouts)
- `npx tsc --noEmit`: exit 0 (after `next typegen`)
- `npm run lint`: exit 0

40 of 40 checks are proven with located evidence. C1097 now has a recorded add, Quarterly and save at both 1440 and 375.
