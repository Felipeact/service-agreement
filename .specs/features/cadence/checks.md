# Cadence - checks

Profile: light
Plan: `.specs/features/cadence/plan.md`

40 checks in 5 slices · 6 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C1060:`).
  This feature numbers from C1060, because pipeline-site-cards owns up to `C1059:`.
  - Pure domain code (`validateServiceLine`, `visitSchedule`, the month presets, the prefill union,
    the month labels) is tested in `domain/agreement` with literal values.
  - Adapters are tested in `infrastructure/supabase` with the recording `stubClient`.
  - Components are asserted with `renderToStaticMarkup`. A client control's state is passed as
    props to its presentational component (lesson L-014): the grid takes `checked` months and the
    preset and prefill logic are pure functions the control calls.
  - The PDF is read with `pdf-text.testing.ts` (`pdfPages`), as `agreement-pdf.test.ts` does.
  - Server Actions are called directly with `@/composition` mocked, as `app/(app)/agreements.test.ts` does.
- **test:db** - `npm run test:db cadence` in `web/` (AD-026) runs `fixture.sql` and then the new
  `supabase/tests/cadence.sql`, rolled back, passing only when its last row is `cadence: pass`. Each
  assertion is labelled with its check id. `demo_seed` is the existing seed-twice recipe.
- **mcp** - a Supabase MCP `execute_sql` on project `gnxebrtcpbujhvcamtoe` after the migration is
  applied; the query and its result go in the Handoff.
- **live** - a real browser on `npm run dev` through the Playwright MCP, in one signed-in context as
  the demo owner (memory: one context only).

Terms: "the RPC" is `public.save_service_line`; "the coverage table" is `service_line_asset_types`;
"the line form" is the presentational `LineForm`; "the line row" is the presentational row in
`line-row.tsx`; "the schedule" is the output of `visitSchedule`; "door 1 rule" is non-empty,
strictly ascending, every value in 1-12.

## Checks

### S1 - months on a line

**C1060** - `update public.service_lines set visit_months = <v>` on `lineA` is refused with `23514` for each of
`'{}'`, `'{6,3}'`, `'{3,3}'`, `'{0}'`, `'{13}'`, and `visits_per_year = 5` with months `{3,6,9,12}` is refused
with `23514`; `{3,6,9,12}` with `visits_per_year = 4` is accepted (AC 1, door 1)
Proof: `npm run test:db cadence` (assertions `C1060`)

**C1061** - The RPC called by an estimator with months `{3,6,9,12}` and cost `25000` stores
`visits_per_year = 4`; the reader returns that line with `visitsPerYear: 4` and `annualCents: 100000` (AC 2)
Proof: `npm run test:db cadence` (assertions `C1061`)
Proof: `npx vitest run infrastructure/supabase -t "C1061:"`

**C1062** - The line form markup holds a `fieldset` whose `legend` is `Visit months`, twelve
`input type="checkbox" name="visitMonths"` with values `1`..`12` labelled `Jan`..`Dec` in that order, a grid
classed `grid-cols-6` and `md:grid-cols-12`, and buttons `Quarterly`, `Semi-annual`, `Monthly` (AC 3)
Proof: `npx vitest run components/agreements -t "C1062:"`

**C1063** - `MONTH_PRESETS` (or the preset function) gives `quarterly` -> `[3,6,9,12]`, `semiAnnual` -> `[4,10]`,
`monthly` -> `[1..12]`; the line form rendered with `checked = [4,10]` checks exactly the boxes `4` and `10` (AC 4)
Proof: `npx vitest run domain/agreement -t "C1063:"`
Proof: `npx vitest run components/agreements -t "C1063:"`

**C1064** - `validateServiceLine` with no months returns error `visitMonths: "Choose at least one visit month"`;
`addServiceLineAction` with no `visitMonths` returns `status: "invalid"` with that message and calls no store
method; the line form given that error renders it (AC 5)
Proof: `npx vitest run domain/agreement -t "C1064:"`
Proof: `npx vitest run "app/(app)" -t "C1064:"`
Proof: `npx vitest run components/agreements -t "C1064:"`

**C1065** - The line form markup contains no input named `visitsPerYear` and no text `Visits per year` (AC 6)
Proof: `npx vitest run components/agreements -t "C1065:"`

**C1066** - A line row for months `[3,6,9,12]` shows `Mar, Jun, Sep, Dec` and `4 visits/yr`; for `[12,1]` given
unsorted to the label function the text is `Jan, Dec` (AC 7)
Proof: `npx vitest run components/agreements -t "C1066:"`

### S2 - equipment covered by a line

**C1067** - The reader's editable `AgreementDetail` lists as equipment choices exactly the site's types with
an asset, plus a type a line covers that has no asset on the site, ordered by name, each with `id`, `name` and
`defaultVisitMonths`; the line form renders a `fieldset` `Equipment covered` with one
`input type="checkbox" name="assetTypeIds"` per choice in that order (AC 8)
Proof: `npx vitest run infrastructure/supabase -t "C1067:"`
Proof: `npx vitest run components/agreements -t "C1067:"`

**C1068** - `validateServiceLine` with no type returns `assetTypeIds: "Choose at least one equipment type"`, and
`updateServiceLineAction` without types returns `invalid` with it and calls no store method (AC 9)
Proof: `npx vitest run domain/agreement -t "C1068:"`
Proof: `npx vitest run "app/(app)" -t "C1068:"`

**C1069** - The prefill function over choices RTU `[3,6,9,12]` and BOILER `[10]` gives `[3,6,9,10,12]` for both
checked, `[10]` for BOILER alone and `[]` for none; it returns the current months unchanged once the grid is
marked as edited by hand (AC 10)
Proof: `npx vitest run domain/agreement -t "C1069:"`

**C1070** - The RPC with a valid line and one asset type id of org B (called by org A's estimator) raises
`23503`, and afterwards the version has the same line count and no coverage row was added; on update of an
existing line the same call leaves its description, months and coverage unchanged (AC 11, AC 12, door 4)
Proof: `npm run test:db cadence` (assertions `C1070`)

**C1071** - The RPC as estimator on the current version of a draft with types `[RTU, BOILER]` returns a uuid, and
the coverage table then holds exactly those two rows for it; calling it again on that line with `[RTU]` leaves
exactly one row (AC 11, door 2, door 4)
Proof: `npm run test:db cadence` (assertions `C1071`)

**C1072** - The line store maps RPC errors: `55000` -> `locked`, `42501` -> `forbidden`, `P0002` and `23503` ->
`not_found`, `54000` -> `too_many` (add), anything else `unavailable`; it calls `rpc("save_service_line")` with
the six named arguments (`p_line_id: null` on add) (door 4)
Proof: `npx vitest run infrastructure/supabase -t "C1072:"`

**C1073** - The RPC raises `54000` when the version already has 50 lines, `42501` for a viewer, and `P0002` for an
agreement id that does not exist (Surface statuses)
Proof: `npm run test:db cadence` (assertions `C1073`)

**C1074** - On an editable agreement whose site has no equipment, the agreement view renders
`Add equipment to this site before adding a service line` linking to `/sites/<siteId>` and no `LineForm` (AC 13)
Proof: `npx vitest run components/agreements -t "C1074:"`

**C1075** - A line row covering `RTU` and `AHU` shows `AHU, RTU` (AC 14)
Proof: `npx vitest run components/agreements -t "C1075:"`

### S3 - default months per equipment type

**C1076** - `private.catalog_asset_types.default_visit_months` holds, table-driven over all 40 codes, the
plan's S3 table: 19 codes `{3,6,9,12}`, 8 codes `{4,10}`, 13 codes `{10}` (AC 15)
Proof: `npm run test:db cadence` (assertions `C1076`)

**C1077** - On the remote after the migration, `select count(*) from public.asset_types t left join
private.catalog_asset_types c using (code) where t.default_visit_months is distinct from
coalesce(c.default_visit_months, '{3,6,9,12}')` returns `0` (AC 15)
Proof: mcp `execute_sql` (query above, result recorded in the Handoff)

**C1078** - `private.seed_org_catalog(org)` on a fresh org gives `RTU` `{3,6,9,12}`, `EXHAUST_FAN` `{4,10}`, `BOILER`
`{10}`, and every inserted type equal to its catalog default (AC 16, door 3)
Proof: `npm run test:db cadence` (assertions `C1078`)

**C1079** - `update public.asset_types set default_visit_months = <v>` is refused with `23514` for `'{}'` and
`'{13}'`, and a `null` is refused with `23502` (AC 17, door 3)
Proof: `npm run test:db cadence` (assertions `C1079`)

### S4 - visit schedule

**C1080** - `visitSchedule` over HVAC (`AHU`, `RTU`; `[3,6,9,12]`) and Boiler (`Boiler`; `[10]`) and a third line
(`RTU`; `[3]`) returns exactly `[{month: 3, equipment: ["AHU", "RTU"]}, {6, [AHU, RTU]}, {9, [AHU, RTU]},
{10, ["Boiler"]}, {12, [AHU, RTU]}]` - March lists RTU once; over no lines it returns `[]` (AC 18)
Proof: `npx vitest run domain/agreement -t "C1080:"`

**C1081** - `buildAgreementDocument` puts that schedule on `AgreementDocument.schedule`; the rendered PDF's text has
`Visit schedule` after `Service and price` and before `Service included`, and the lines `March` `AHU, RTU` and
`October` `Boiler` (AC 19)
Proof: `npx vitest run domain/agreement -t "C1081:"`
Proof: `npx vitest run infrastructure/documents -t "C1081:"`

**C1082** - `portal_view` returns null for an unknown token hash and, per line, `visitMonths` (ascending ints) and `equipment` `[{code, name}]` ordered
by name; the portal adapter maps them onto `PortalView.lines` (AC 20, door 6)
Proof: `npm run test:db cadence` (assertions `C1082`)
Proof: `npx vitest run infrastructure/supabase -t "C1082:"`

**C1083** - The review view renders a section labelled `Visit schedule` after the service lines and before
`Service included`, with rows `March` `AHU, RTU` and `October` `Boiler` (AC 20)
Proof: `npx vitest run components/review -t "C1083:"`

**C1084** - The agreement view renders the same `Visit schedule` section for the shown version, after the lines
and before `Service included` (AC 21)
Proof: `npx vitest run components/agreements -t "C1084:"`

**C1085** - With no lines, the PDF text, the review view and the agreement view each show
`No visits scheduled yet` under `Visit schedule` (AC 22)
Proof: `npx vitest run infrastructure/documents -t "C1085:"`
Proof: `npx vitest run components/review -t "C1085:"`
Proof: `npx vitest run components/agreements -t "C1085:"`

**C1086** - `portalDocument(view)` over a portal view whose lines carry months and equipment yields the same
`schedule` as `buildAgreementDocument` over the equivalent `AgreementDetail` (AC 23)
Proof: `npx vitest run application/use-cases -t "C1086:"`

### S5 - versions, freeze and existing data

**C1087** - Revising a `changes_requested` agreement whose v1 line has months `{4,10}` and types `[RTU, BOILER]`
gives v2 a line with `{4,10}` and the same two types; v1's line and its two coverage rows are unchanged (AC 24)
Proof: `npm run test:db cadence` (assertions `C1087`)

**C1088** - As estimator, inserting or deleting a coverage row whose line is on a `sent` agreement, or on a past
version of a draft, is refused with `55000`; as the table owner (no `auth.uid()`) the insert passes; deleting a
line of the current draft version cascades its coverage rows (AC 25, door 2)
Proof: `npm run test:db cadence` (assertions `C1088`)

**C1089** - The line form given status `locked` shows `This version can no longer be changed.` (AC 25)
Proof: `npx vitest run components/agreements -t "C1089:"`

**C1090** - `private.months_for_visits(n)` returns, table-driven: 1 `{1}`, 2 `{4,10}`, 3 `{1,5,9}`, 4 `{3,6,9,12}`,
6 `{1,3,5,7,9,11}`, 8 `{1,2,4,5,7,8,10,11}`, 12 `{1..12}`, and raises for 13 and 0 (AC 26, AC 27, door 5)
Proof: `npm run test:db cadence` (assertions `C1090`)

**C1091** - On the remote after the migration: no `service_lines` row has `visits_per_year <> cardinality(visit_months)`,
AG-1046 and AG-1048 lines keep `visits_per_year` 4 and their pre-migration annual amounts (540000 × 4, 357000 × 4
cents), and no line on a site with assets lacks coverage (AC 26, AC 28)
Proof: mcp `execute_sql` (queries and results recorded in the Handoff)

**C1092** - The migration runs its backfill through `private.months_for_visits`, which raises for n > 12, inside
the migration's transaction; `select count(*) from service_lines where visits_per_year > 12` on the remote before
applying is recorded as `0` (AC 27)
Proof: mcp `execute_sql` (pre-apply count recorded in the Handoff)
Proof: `npm run test:db cadence` (assertions `C1090`)

**C1093** - `private.backfill_line_coverage()` (used by the migration and seed) gives a line on a frozen version the
org types whose codes are in `snapshot.types`, and a line on an unfrozen version the types with an asset on its
site; running it twice adds nothing (AC 28)
Proof: `npm run test:db cadence` (assertions `C1093`)

**C1094** - After `seed.sql` runs twice, every demo line has a non-empty `visit_months` and at least one coverage
row when its site has assets, and the second run changes no row's months or coverage (AC 29)
Proof: `npm run test:db demo_seed` (assertions `C1094`)

### Delivery

**C1095** - Every existing recipe still passes: `npm run test:db` exits 0 over all recipes, and `npm test`, `npm run
lint` and `npx tsc --noEmit` exit 0 in `web/`
Proof: `npm run test:db`
Proof: `npm test`

**C1096** - `database.types.ts` lists `visit_months` on `service_lines`, `default_visit_months` on `asset_types`, the
`service_line_asset_types` table and the `save_service_line` function
Proof: `npx vitest run infrastructure/supabase -t "C1096:"`

**C1097** - Live at 1440 and 375 px: on AG-1046 add a line covering one type, press Quarterly, save; the row reads
`Mar, Jun, Sep, Dec · 4 visits/yr`, the page shows `Visit schedule`, and `Download PDF` returns 200 with no console
error
Proof: live (Playwright MCP, result recorded in the Handoff)

**C1098** - STATE.md has AD rows for doors 1-4 and 6, AD-008 is marked amended, CONTEXT.md describes visit months,
coverage and the schedule, DESIGN.md records the checkbox control, and ROADMAP.md ticks the Cadence item
Proof: `grep -c "visit_months" .specs/STATE.md CONTEXT.md` prints a non-zero count for each

**C1099** - `send_agreement` still raises `23514` on a version with no lines, and sends a version whose lines carry
months and coverage (regression across the redefined functions)
Proof: `npm run test:db cadence` (assertions `C1099`)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `visit_months` rule (6) | empty C1060 · descending C1060 · duplicate C1060 · 0 C1060 · 13 C1060 · count mismatch C1060 | - |
| presets (3) | Quarterly C1063 · Semi-annual C1063 · Monthly C1063 | - |
| form validation errors (2) | no month C1064 · no type C1068 | - |
| `rpc save_service_line` statuses (7) | 200 C1071 · 422 C1060 · 404 type C1070 · 409 locked C1088 · 409 too many C1073 · 404 missing C1073 · 403 C1073 | - |
| `rpc portal_view` statuses (2) | 200 jsonb C1082 · 200 null C1082 | - |
| line store error map (5) | `55000` C1072 · `42501` C1072 · `P0002` C1072 · `23503` C1072 · `54000` C1072 | - |
| catalog defaults (40) | C1076, table-driven over all 40 | - |
| `months_for_visits` inputs (9) | 1 C1090 · 2 C1090 · 3 C1090 · 4 C1090 · 6 C1090 · 8 C1090 · 12 C1090 · 13 raises C1090 · 0 raises C1090 | - |
| backfill coverage source (2) | frozen snapshot C1093 · live site C1093 | - |
| schedule surfaces (4) | staff PDF C1081 · portal page C1083 · staff page C1084 · portal PDF C1086 | - |
| schedule empty state (3) | PDF C1085 · portal C1085 · staff C1085 | - |
| one-way doors (6) | 1 C1060 · 2 C1071, C1088 · 3 C1078, C1079 · 4 C1070, C1071 · 5 C1090 · 6 C1082 | - |
| entities (3) | `service_lines.visit_months` C1060 · `service_line_asset_types` C1071 · `asset_types.default_visit_months` C1079 | - |
| frozen-trigger ops on coverage (3) | insert C1088 · delete C1088 · cascade C1088 | - |
| startup config: generated DB types (1 place) | `database.types.ts` C1096 | - |

- Claims naming a status code or a payload key: C1060, C1070, C1072, C1073, C1079, C1082, C1088 - each proof
  crosses the database boundary.
- No other check claims more than the single case its proof exercises.

## Swept

- validation: C1060, C1064, C1068, C1079
- failure modes: C1070 (a refused coverage write leaves the line as it was)
- idempotency: C1093, C1094
- authorization: C1073 (viewer `42501`); RLS on the coverage table copies `service_lines` - C1088
- concurrency: existing - `service_lines_frozen` reads the agreement `for share` (AD-054); the coverage trigger copies it, C1088
- data lifecycle: C1088 (cascade on line delete), C1091 (backfill)
- dependency failure: n/a - no external service is added; the PDF and portal keep their existing 503 paths
- state transitions: C1087, C1088, C1099
- observability: n/a - no new log line is required; adapter failures keep the existing `unavailable` logging

## Handoff

- Read set measured with `wc -c` before building: the five migrations this redefines from, `seed.sql`,
  `fixture.sql`, `agreement_builder.sql`, the runner, domain agreement and document with tests, ports, the
  agreement and portal adapters with tests, the portal use case, every `components/agreements` file, the review
  view, the PDF layout and its test, the actions and their test, the stub client: 345,517 bytes, about 86k tokens.
  `database.types.ts` and the other five SQL suites to adjust fixtures in: about 15k more, so about 101k.
- Written: migration and `cadence.sql` ~30 KB; domain (validator, presets, prefill, schedule, labels) with tests
  ~12 KB; adapters, use case and tests ~20 KB; line form, row, view, review view, PDF and tests ~35 KB; fixture
  and seed edits, docs ~10 KB. About 107 KB, about 27k tokens. Test-run output about 10k.
- Live (C1097): about 30k tokens of snapshots.
- S1-S3 with the shared read set reach about 120k; S4 enters at about 132k, S5 at about 140k, delivery and the
  live run bring it to about 168k against the 150k budget. Over the budget.
- Proposed cut, where the surface changes: batch 1 = the database (migration, `cadence.sql`, fixture and seed
  edits, C1060, C1061 SQL half, C1070-C1073, C1076-C1079, C1082 SQL half, C1087, C1088, C1090-C1094, C1099);
  batch 2 = the app (domain, adapters, form, views, PDF, portal, C1061-C1069, C1072, C1074, C1075, C1080-C1086,
  C1089, C1095-C1098).
- Mechanism: handoff - chosen by the user 2026-10-30; batch 1 the database, batch 2 the app, sequential and only on green
- Pre-apply (mcp `execute_sql`, 2026-10-30, project `gnxebrtcpbujhvcamtoe`): `select count(*) from public.service_lines where
  visits_per_year > 12` = `0` (C1092). AG-1046 v1: 4 visits × 540000 = 2160000; AG-1048 v1 and v2: 4 visits × 357000 =
  1428000 each (C1091 baseline). 14 service lines, 40 asset types, none outside the catalog.
- Post-apply (mcp `execute_sql`, 2026-10-30): C1077 query = `0`. C1091: `0` lines with `visits_per_year <> cardinality(visit_months)`;
  AG-1046 v1 4 visits `{3,6,9,12}` annual 2160000 (540000 × 4), AG-1048 v1 and v2 4 visits `{3,6,9,12}` annual 1428000
  (357000 × 4), unchanged from the pre-apply baseline; `0` lines on a site with assets lack coverage (14 lines, 55
  coverage rows). `get_advisors` security: no new finding (outbox `rls_enabled_no_policy`, the five AD-068 / outbox
  definer RPCs, leaked-password protection - all pre-existing).
- Migration history: the user applied `cadence_draft.sql` (md5 f25a6d5e5682da3d2f4dc4e7ca41dad2) in the SQL editor after
  `apply_migration` was declined; it is committed unchanged as `20261030120000_cadence.sql`, and the row
  `('20261030120000', 'cadence')` was inserted into `supabase_migrations.schema_migrations` (list_migrations shows it),
  so `supabase db push` will not re-apply it (AD-006).
- **Boundary (batch 1):** at `4f87593` (on `aaa8e6a`), C1060, C1061 SQL half, C1070, C1071, C1073, C1076, C1077, C1078,
  C1079, C1082 SQL half, C1087, C1088, C1090, C1091, C1092, C1093, C1094, C1099 closed. Proofs: `npm run test:db cadence`
  PASS, `npm run test:db demo_seed` PASS, `npm run test:db` 19 passed, 0 failed; C1077/C1091/C1092 by mcp above.
  `database.types.ts` regenerated (C1096's vitest is batch 2's). Left for batch 2: `npx tsc --noEmit` fails at
  `infrastructure/supabase/agreements.ts(255,19)` (the line insert lacks `visit_months`); the live app's add/update line
  fails at the database until the adapter calls `save_service_line`. `npm test`: 1825 passed, 2 failed under full-suite
  load (`boundaries.test.ts` C873, `domain/purity.test.ts` C32, lint-driven), both pass when run alone.
- **Settled mid-build:** (1) Landing row 7: `asset_types.default_visit_months` defaults to `{3,6,9,12}`, the catalog column
  has none, so `catalog_seed.sql` C25/C6 catalog inserts name `default_visit_months` (setup only). (2) The user approved
  bumping the pins the new table and recipe break: `rls_isolation.sql` C35 lists `service_line_asset_types` (20 tables),
  and `runner.test.ts` counts 19 recipes and 21 files (C830, C1045, C203-C205, C210-C212) with `cadence` in `ALL`.
  (3) `apply_migration` was declined; the user applied the file in the SQL editor and the history row was inserted by
  `execute_sql`. (4) "Frozen" for `backfill_line_coverage` means any version but the current version of a draft
  (AD-062's rule) that holds `snapshot.types`; it fills only lines with no coverage, so a saved choice is never widened.
- **Abandoned:** nothing.
- **Live (C1097, 2026-10-30, `npm run dev`, Playwright MCP, the one signed-in demo-owner context):** AG-1046 is `sent`
  (version 1, read-only), not a draft, so no line can be added to it and the add/save half was **not run**; no other
  agreement was authorised for a write, so no demo data changed. Run instead, at 1440 and 375 px: AG-1046's row reads
  `Mar, Jun, Sep, Dec · 4 visits/yr` (backfilled line, equipment `Backflow preventer, Chiller, Exhaust fan, RTU`), the
  `Visit schedule` section shows March, June, September and December, and `Download PDF` (`/pdf?version=1`) answers 200
  `application/pdf`; no horizontal scroll; console 0 errors, 0 warnings. On the draft AG-1051 without submitting: Equipment
  covered lists `Backflow preventer, MUA, RTU, Walk-in cooler`; checking Backflow preventer prefills `[10]`, Semi-annual
  gives `[4, 10]`, Quarterly gives `[3, 6, 9, 12]`; the grid is 6 columns at 375 and 12 at 1440, each month cell 44x44 at
  375. The 375 run found the month text clipped beside the box; fixed by stacking box over month below md (d737b13
  commit). Remaining for the user: an add-and-save on a draft, e.g. AG-1051, then removing the line.
- **Live (C1097, add-and-save, 2026-10-30, after Verifier round 1 at `724d5f9`; the user approved one line on AG-1051):** on
  `npm run dev` (a stale dev server on :3000 answering 500 "Jest worker encountered 2 child process exceptions" was stopped
  and restarted first), Playwright MCP, the one signed-in demo-owner context, every control scoped to its region or row.
  Before: AG-1051 `Version 1`, draft, no lines, `Total per year $0.00`, `No visits scheduled yet`. At 1440 px, in "Add a
  line": description `C1097 live check`, RTU ticked, Quarterly pressed (checked `3, 6, 9, 12`), cost `250.00`, "Add line".
  After save, at 1440 and again after a reload at 375: the row reads `C1097 live check | Mar, Jun, Sep, Dec · 4 visits/yr |
  RTU | ... $250.00 | $1,000.00`, `Total per year $1,000.00`; `Visit schedule` lists March, June, September, December, each
  `RTU`; `Download PDF` (`/pdf?version=1`) answers `200 application/pdf` (6,060 bytes) at both widths; no horizontal scroll
  at either width; console 0 errors, 0 warnings since the restart. Then the row's "Remove", the prompt `Remove C1097 live
  check?`, and "Remove": after a reload AG-1051 shows `No service lines yet.`, `Total per year $0.00` and `No visits
  scheduled yet`, as before. C1097 passes; the only demo-data write was that one line, now deleted.
- **Live (C1097, save at 375, 2026-10-30, after Verifier round 2 at `04ec278`; the user approved one more line on
  AG-1051):** fresh `npm run dev`, the one signed-in demo-owner context, controls scoped to "Add a line" and the row. The
  viewport was set to 375x812 before AG-1051 was opened. Before: `Version 1`, no lines, `Total per year $0.00`, `No visits
  scheduled yet`. At 375: description `C1097 live check 375`, RTU ticked, Quarterly pressed (checked `3, 6, 9, 12`), cost
  `250.00`, "Add line" pressed at width 375. Right after the save and again after a reload, both at 375: the row reads
  `C1097 live check 375 | Mar, Jun, Sep, Dec · 4 visits/yr | RTU | Visits per year: 4 | Per visit: $250.00 | Per year:
  $1,000.00`, `Total per year $1,000.00`; `Visit schedule` lists March, June, September, December, each `RTU`;
  `Download PDF` (`/pdf?version=1`) answers `200 application/pdf` (6,063 bytes); `scrollWidth - innerWidth` = 0; console 0
  errors, 0 warnings. Then the row's "Remove", the prompt `Remove C1097 live check 375?`, and "Remove", still at 375: after
  a reload AG-1051 shows `No service lines yet.`, `Total per year $0.00` and `No visits scheduled yet`. With the 1440 run
  above, the add, Quarterly and save now pass at both widths; the only demo-data write was that one line, now deleted. The
  dev server and its child process were stopped afterwards (port 3000 free).
- **Boundary (batch 2):** at `ec679e5` (on `237362f`, `d737b13`), C1061 vitest half, C1062, C1063, C1064, C1065, C1066, C1067,
  C1068, C1069, C1072, C1074, C1075, C1080, C1081, C1082 vitest half, C1083, C1084, C1085, C1086, C1089, C1095, C1096,
  C1098 closed; C1097 partly run (above). Proofs: each named `npx vitest run <dir> -t "<id>:"` passed; `npm test` 90 files,
  1864 passed (C873 and C32 passed in the full run this time); `npm run lint`, `npx tsc --noEmit`, `npm run build` clean;
  `npm run test:db` 19 passed, 0 failed; `grep -c "visit_months" .specs/STATE.md CONTEXT.md` = 5, 3.
- **Settled mid-build (batch 2):** the user approved superseding the existing vitest assertions that pinned the typed visits
  input and the direct table writes, keeping each claim's outcome (2026-10-30):
  - `domain/agreement/service-line.test.ts` C720 `visits %j are refused...`, `visits %j give %i` and `...returns all three
    messages` retired; C1064 and C1068 replace them. The `accepted and returned trimmed` case's value takes the new shape.
  - `components/agreements/agreements.test.ts` C715: the `new-line-visitsPerYear` value assertion is now twelve
    `visitMonths` boxes, none checked (C1062, C1065); the rest of C715 is unchanged.
  - `infrastructure/supabase/agreements.test.ts`, moved to `rpc("save_service_line")` (C1072): C719 (`p_line_id: null`, the
    id comes back), C722 (`54000` -> `too_many`), C724 (update calls the RPC with the line's id; the remove asserts
    unchanged), C737 (`55000` -> `locked`), C741 (`P0002` -> `not_found`), the `42501 is forbidden` case, and C744 (an RPC
    error and a thrown RPC -> `unavailable` with one `console.error`). Remove-path assertions are untouched.
  - The C725 reader case's expected line gains `visitMonths` and `equipment` (the line shape, as its fixture row now
    carries them); its amounts are unchanged.
  - Port signatures unchanged: `update(lineId, value)` reads the line's agreement id before the RPC (plan Flow hop 3).
    The printed `DocumentLine` keeps its four fields, so the C858-area `doc.lines[0]` assertion is untouched; the
    schedule rides on `AgreementDocument.schedule` (plan Impact, ports row).
