# Seasonal tasks - checks

Profile: light
Plan: `.specs/features/seasonal-tasks/plan.md`

29 checks in 4 slices · 4 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C1100:`).
  This feature numbers from C1100, because cadence owns up to `C1099:`.
  - Pure domain code (`parseServiceScope`, the months label, the task label, the unreached rule, `visitSchedule`,
    `buildAgreementDocument`) is tested in `domain/agreement` with literal values.
  - Adapters are tested in `infrastructure/supabase` with the recording `stubClient`.
  - Components are asserted with `renderToStaticMarkup`: `AgreementView` in `components/agreements`, `ReviewView` in
    `components/review`, as cadence's C1084 and C1083 do.
  - The PDF is read with `pdf-text.testing.ts` (`pdfPages`), as `schedule.test.ts` does.
  - `portalDocument` is tested in `application/use-cases`, as cadence's C1086 does.
- **test:db** - `npm run test:db service_included` and `npm run test:db demo_seed` in `web/` (AD-026). They run
  against project `gnxebrtcpbujhvcamtoe`, rolled back, so they pass only once the migration is applied there. The new
  assertions go into the existing `service_included.sql` and `demo_seed.sql`, labelled with their check ids. There is no
  new recipe, so the runner's pinned counts (C830, C203-C212) do not move.
- **mcp** - a Supabase MCP `execute_sql` on project `gnxebrtcpbujhvcamtoe`, before and after the migration is applied.
  The query and its result go in the Handoff.

Terms:
- "the heating task" is RTU `Inspect heat exchanger during heating season`.
- "the cooling task" is RTU `Check compressor operation during cooling operation`.
- "the ERV task" is ERV `Check heating operation`.
- "heating months" are `{1,2,3,10,11,12}`, and "cooling months" are `{4,5,6,7,8,9}`.
- "door 1 rule" is cadence's `private.is_visit_months`: non-empty, strictly ascending, every value in 1-12.
- "the label" is the checklist text for one task. "Unreached" is AC 14's condition.

## Checks

### S1 - months on a task

**C1100** - Each of these is refused with `23514`: `update public.asset_type_tasks set visit_months = <v>` and
`update private.catalog_asset_type_tasks set visit_months = <v>`, for `<v>` in `'{}'`, `'{6,3}'`, `'{3,3}'`, `'{0}'` and
`'{13}'`. `null` and `'{4,5,6,7,8,9}'` are accepted on both tables (AC 1, door 1)
Proof: `npm run test:db service_included` (assertions `C1100`)

**C1101** - `private.catalog_asset_type_tasks` has exactly 3 rows with a non-null `visit_months`: the heating task
`{1,2,3,10,11,12}`, the cooling task `{4,5,6,7,8,9}` and the ERV task `{1,2,3,10,11,12}` (AC 2)
Proof: `npm run test:db service_included` (assertions `C1101`)

**C1102** - After `private.seed_org_catalog(<new org>)`, that org has exactly 3 `asset_type_tasks` with a non-null
`visit_months`, with the same type code, description and months as C1101 (AC 3, door 4)
Proof: `npm run test:db service_included` (assertions `C1102`)

**C1103** - After the migration, these are both `0` on the project: the `asset_type_tasks` rows whose `visit_months`
differs (`is distinct from`) from the catalog task with the same type `code` and `description`, and the rows with a
non-null `visit_months` and no such catalog task. The demo org has exactly 3 rows with a non-null `visit_months` (AC 4,
door 3)
Proof: mcp `execute_sql` (queries and results recorded in the Handoff)

**C1104** - After `supabase/seed.sql` runs twice, the demo org's heating, cooling and ERV tasks carry the C1101 months.
The second run leaves `asset_type_tasks` unchanged, compared as an md5 over every row ordered by id (AC 5)
Proof: `npm run test:db demo_seed` (assertions `C1104`)

### S2 - the scope keeps the months

**C1105** - `public.site_service_scope(s801)`, with fixture task `Check belts` set to cooling months, has
`"schema": 2`. Each task has exactly the keys `description` and `visitMonths`. RTU's tasks equal
`[{"description": "Replace filters", "visitMonths": null}, {"description": "Check belts", "visitMonths": [4,5,6,7,8,9]}]`.
The position-order case reads `First`, then `Second`. Org B's site gives exactly `{"schema": 2, "types": []}`. This
supersedes the literal values of C801 `schema`, `RTU tasks` and `position order`, of C802 `other org`, and of C808's
`["Check oil"]` (AC 6, door 2)
Proof: `npm run test:db service_included` (assertions `C1105`, and the superseded C801, C802 and C808 assertions)

**C1106** - Sending a draft through `apply_agreement_transition(draft -> sent)` freezes a snapshot whose RTU
`Check belts` task has `visitMonths` `[4,5,6,7,8,9]` and `"schema": 2`. A later
`update asset_type_tasks set visit_months = '{6}'` on that task leaves the snapshot byte-equal (AC 7)
Proof: `npm run test:db service_included` (assertions `C1106`)

**C1107** - The md5 of every `agreement_versions` row's `id || snapshot::text`, ordered by id, is the same before and
after the migration is applied (AC 8)
Proof: mcp `execute_sql` (pre-apply and post-apply results recorded in the Handoff)

**C1108** - `parseServiceScope` of a schema 1 document with tasks `["Replace filters", "Check belts"]` gives tasks
`[{ description: "Replace filters", visitMonths: null }, { description: "Check belts", visitMonths: null }]` (AC 9)
Proof: `npx vitest run domain/agreement -t "C1108:"`

**C1109** - `parseServiceScope` returns `null` for each of these: `schema` 0, `schema` 3, `schema` `"2"`, and a schema 2
task that is a bare string, has no `visitMonths` key, or has `visitMonths` `[]`, `[6, 3]`, `[3, 3]`, `[0]`, `[13]`,
`[1.5]` or `"4"`. It parses a schema 2 task with `visitMonths: [4, 10]` to `{ description, visitMonths: [4, 10] }`, and
one with `null` to `visitMonths: null` (AC 10, door 2)
Proof: `npx vitest run domain/agreement -t "C1109:"`

**C1110** - The agreement reader, given a sent version whose `snapshot` is `{"schema": 3, "types": []}`, returns
`serviceScope` `{ source: "not_recorded" }`. The portal adapter, given a `portal_view` `scope` with
`"schema": 2` and a task with `visitMonths: [10]`, returns that task as `{ description, visitMonths: [10] }` (AC 10, Surface
`portal_view`)
Proof: `npx vitest run infrastructure/supabase -t "C1110:"`

### S3 - the checklist marks seasonal tasks

**C1111** - The months label gives each of these: `[4,5,6,7,8,9]` -> `Apr–Sep`; `[1,2,3,10,11,12]` -> `Oct–Mar`;
`[3,4,5]` -> `Mar–May`; `[4,10]` -> `Apr, Oct`; `[6]` -> `Jun`; `[1,2]` -> `Jan, Feb`; `[12,1]` -> `Dec, Jan`;
`[1,2,3,5]` -> `Jan–Mar, May`; `[12,1,3]` -> `Dec, Jan, Mar`. The dash is U+2013 (AC 12)
Proof: `npx vitest run domain/agreement -t "C1111:"`

**C1112** - The task label gives `Check belts (Apr–Sep visits)` for `visitMonths` `[4,5,6,7,8,9]`. It gives
`Replace filters` for `null`, and `Replace filters` for all twelve months (AC 11, AC 13)
Proof: `npx vitest run domain/agreement -t "C1112:"`

**C1113** - `AgreementView`'s Service included list renders a task with cooling months as the text
`Check belts (Apr–Sep visits)`, and a task with `null` months as `Replace filters` with no parenthesis (AC 11, staff
page)
Proof: `npx vitest run components/agreements -t "C1113:"`

**C1114** - `ReviewView`'s Service included list renders `Check belts (Apr–Sep visits)` for the same task (AC 11,
customer page)
Proof: `npx vitest run components/review -t "C1114:"`

**C1115** - The rendered PDF's text has the line `- Check belts (Apr–Sep visits)` under Service included, and
`- Replace filters` for the null task (AC 11, PDF)
Proof: `npx vitest run infrastructure/documents -t "C1115:"`

**C1116** - The unreached rule: a type with a line visiting `{6}` and a task with heating months -> unreached. The
same type with a line visiting `{3,6,9,12}` -> reached. A type no line covers, with a heating task -> unreached. A task
with `null` months, or with all twelve, is never unreached. Two lines covering the type, `{6}` and `{12}` -> reached (AC 14)
Proof: `npx vitest run domain/agreement -t "C1116:"`

**C1117** - With RTU covered only by a line visiting `{6}` and the heating task on RTU, `AgreementView` renders
`No visit in these months` after that task's label, and the cooling task gets no such text. For the same data, the
`ReviewView` markup and the PDF text contain no `No visit in these months` (AC 14)
Proof: `npx vitest run components/agreements -t "C1117:"`
Proof: `npx vitest run components/review -t "C1117:"`
Proof: `npx vitest run infrastructure/documents -t "C1117:"`

### S4 - the schedule lists seasonal tasks

**C1118** - `visitSchedule(lines, types)` gives the following. The lines are HVAC `{3,6,9,12}`, covering RTU
(`Rooftop unit`) and AHU (`Air handling unit`), and Boiler `{10}`, covering BOILER. RTU's tasks are `Replace filters`
(`null`), the heating task (position 3) and the cooling task (position 4). AHU has a task `Belts` with all twelve months.
BOILER has `Fall test` with `{10}`. The rows' `tasks` are:
- March: `[{ type: "Rooftop unit", description: <heating task> }]`
- June: `[{ type: "Rooftop unit", description: <cooling task> }]`
- September: the same as June
- October: `[{ type: "Boiler", description: "Fall test" }]`
- December: the same as March
A third type `CHILLER` with a task `{3}` and no line covering it adds nothing to March. A second line `{3}` covering RTU
does not list the heating task twice in March (AC 15)
Proof: `npx vitest run domain/agreement -t "C1118:"`

**C1119** - With two types due in one month, the March row's tasks are ordered by type name and then by task
position. `Air handling unit` with tasks at positions 2 and 1 sorts before `Rooftop unit`, and its position 1 task
comes first (AC 15)
Proof: `npx vitest run domain/agreement -t "C1119:"`

**C1120** - `VisitScheduleSection` renders, inside the `data-month="3"` row, the equipment names and then the text
`Rooftop unit: Inspect heat exchanger during heating season`. A row with no tasks renders no `:` task line (AC 16)
Proof: `npx vitest run components/agreements -t "C1120:"`

**C1121** - `AgreementView` and `ReviewView` each render `Rooftop unit: Inspect heat exchanger during heating season`
inside the March row of `Visit schedule`, built from their lines and service scope (AC 16, staff and customer pages)
Proof: `npx vitest run components/agreements -t "C1121:"`
Proof: `npx vitest run components/review -t "C1121:"`

**C1122** - `buildAgreementDocument` over a source with the C1118 lines and a listed scope puts the C1118 tasks on
`schedule`. Over a source whose scope is `not_recorded`, every row's `tasks` is `[]`. The rendered PDF's text has
`Rooftop unit: Inspect heat exchanger during heating season` after the `March` row's equipment and before the `June` row
(AC 16, PDF)
Proof: `npx vitest run domain/agreement -t "C1122:"`
Proof: `npx vitest run infrastructure/documents -t "C1122:"`

**C1123** - `portalDocument(view)` over a portal view whose scope carries the C1118 tasks gives the same `schedule`,
tasks included, as `buildAgreementDocument` over the equivalent `AgreementDetail` (AC 17)
Proof: `npx vitest run application/use-cases -t "C1123:"`

**C1124** - Over a scope parsed from a schema 1 document, with the C1118 lines, every row's `tasks` is `[]` (AC 18)
Proof: `npx vitest run domain/agreement -t "C1124:"`

### Delivery

**C1125** - `database.types.ts` gives `asset_type_tasks.Row.visit_months` the type `number[] | null`, and
`npx tsc --noEmit` exits 0
Proof: `npx tsc --noEmit`
Proof: `npx vitest run infrastructure/supabase -t "C1125:"`

**C1126** - `npm test` passes with every pre-existing test unchanged, apart from the fixture shape changes listed under
Handoff `Settled mid-build`
Proof: `npm test`

**C1127** - `npm run test:db` passes all 19 recipes
Proof: `npm run test:db`

**C1128** - `portal_view` still returns `null` for an unknown token hash once scopes are schema 2. This is a regression
run of cadence's existing assertion, unchanged (Surface `portal_view`)
Proof: `npm run test:db cadence` (assertions `C1082`)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| door 1 refusals, 5 values on 2 tables (10) | tasks `{}` C1100 · tasks `{6,3}` C1100 · tasks `{3,3}` C1100 · tasks `{0}` C1100 · tasks `{13}` C1100 · catalog `{}` C1100 · catalog `{6,3}` C1100 · catalog `{3,3}` C1100 · catalog `{0}` C1100 · catalog `{13}` C1100 | - |
| door 1 accepted, 2 values on 2 tables (4) | tasks `null` C1100 · tasks `{4..9}` C1100 · catalog `null` C1100 · catalog `{4..9}` C1100 | - |
| seasonal catalog tasks (3) | heating C1101 · cooling C1101 · ERV C1101 | - |
| where a task's months come from (3) | catalog C1101 · `seed_org_catalog` copy C1102 · backfill of existing orgs C1103 | - |
| scope document schemas, 2 valid and 3 invalid (5) | schema 1 C1108 · schema 2 C1109 · `0` C1109 · `3` C1109 · `"2"` C1109 | - |
| schema 2 invalid task shapes (9) | bare string C1109 · no key C1109 · `[]` C1109 · `[6,3]` C1109 · `[3,3]` C1109 · `[0]` C1109 · `[13]` C1109 · `[1.5]` C1109 · `"4"` C1109 | - |
| months label shapes (9) | long run C1111 · wrapping run C1111 · three-month run C1111 · two singles with a tie C1111 · one month C1111 · two-month run C1111 · two-month wrap C1111 · run plus single C1111 · wrap plus single C1111 | - |
| task label cases (3) | months C1112 · `null` C1112 · all twelve C1112 | - |
| checklist marker places (3) | staff page C1113 · customer page C1114 · PDF C1115 | - |
| unreached rule cases (5) | missed C1116 · reached C1116 · no line C1116 · `null` or all twelve C1116 · two lines C1116 | - |
| unreached warning places (3) | staff page shows it C1117 · customer page does not C1117 · PDF does not C1117 | - |
| schedule task rule (5) | due C1118 · not in the task's months C1118 · no covering line C1118 · listed once C1118 · `null` or all twelve never listed C1118 | - |
| schedule task places (3) | staff page C1121 · customer page C1121 · PDF C1122 | - |
| `rpc site_service_scope` results (2) | `200` jsonb schema 2 C1105 · another org's site empty C1105 | - |
| `rpc portal_view` results (2) | `200` with a schema 2 scope, mapped C1110 · `200` null for an unknown link C1128 | - |
| Landing doors (4) | 1 C1100 · 2 C1105, C1109 · 3 C1103 · 4 C1102 | - |

- Claims naming a status or response shape: C1100, C1105, C1106, C1110. C1100 and C1105 cross the database boundary.
  C1110 is at the adapter, the boundary the app consumes `portal_view` through.
- No other check claims more than the cases its proof lists.

## Swept

- validation: C1100, C1109
- failure modes: existing - a Supabase migration applies in one transaction, so a failed backfill leaves nothing; a
  malformed stored scope shows `Not recorded for this version.` (C1110)
- idempotency: C1104
- authorization: existing - `asset_type_tasks` writes are owner and admin only by RLS (`0001_init`), and
  `site_service_scope` is security invoker (AD-059), so another org gives no types (C1105)
- concurrency: n/a - no new write path; the one snapshot write stays in `freeze_agreement_version` under
  `apply_agreement_transition`'s row lock (AD-060)
- data lifecycle: C1103, C1107
- dependency failure: n/a - no external call is added
- state transitions: C1106
- observability: n/a - no logging requirement; the only failure is a malformed document, which already renders as
  not recorded

## Handoff

- Read set, measured with `wc -c` before building:
  - the service-included, cadence and catalog migrations, `seed.sql`, and the `service_included`, `demo_seed`,
    `catalog_seed` and `fixture` SQL suites
  - domain `index.ts`, `cadence.ts` and `document.ts` with their tests
  - `service-scope.tsx`, `visit-schedule.tsx`, `agreement-view.tsx`, `review-view.tsx` and `agreement-pdf.tsx`, with
    the cadence tests beside them
  - the portal adapter and `portal-view.testing.ts`
  - That is 209,482 bytes. The other test files holding `tasks:` fixtures add 88,409, and `database.types.ts` adds
    35,869. Allowing for overlap, about 300 KB, about 75k tokens.
- Written: migration and SQL assertions about 15 KB; domain and tests about 15 KB; components, PDF and tests about 20 KB;
  docs about 8 KB. That is about 58 KB, about 15k tokens. Test output is about 10k.
- S1-S4 and delivery come to about 100k against the 150k budget. One builder.
- Mechanism: one builder (under the budget, no ask)
- Before code: the cadence Verifier over `635a493..HEAD` was dispatched on 2026-10-30. Per plan Assumptions, the build
  starts on that verdict.
- **Settled mid-build:** the user approved two things on 2026-10-30. (1) Applying the migration to `gnxebrtcpbujhvcamtoe`
  through mcp `apply_migration` once the code and SQL tests are written, with the C1103 and C1107 queries run before and
  after. (2) Superseding only the literal values of `service_included.sql` C801 (`schema`, `RTU tasks`, `position order`,
  `BOILER tasks` stays `[]`), C802 (`other org`) and C808 (`asset added`). Schema 1 becomes 2 and tasks become
  `{description, visitMonths}`; each assertion keeps its claim.
