# Reporting checks

Profile: ui
Plan: `.specs/features/reporting/plan.md`

24 checks in 4 slices · 4 one-way doors · 0 open

Database proofs run as `cd web && npm run test:db reports` (recipe `reports`: fixture, the db-freeze migration, the reporting migration, `supabase/tests/reports.sql`); each assertion is labelled with its check id. Code proofs run as `cd web && npx vitest run <file> -t "<id>"`. Expected values come from the plan, never from the migration.

## Checks

### S1 - The report functions (door 1, door 2) · 2 files · ~30 KB · ~8k

**C5701** - Recurring revenue is 119999 cents for one accepted agreement in term whose latest version has lines 4 x 25000 and 1 x 19999 (AC 1)
Proof: `cd web && npm run test:db reports` (label C5701)

**C5702** - Pipeline value counts a `sent` agreement and an accepted agreement not yet in term, and counts an in-term agreement zero times (AC 2)
Proof: `cd web && npm run test:db reports` (label C5702)

**C5703** - The headline returns accepted 1, refused 1 and expired 1 for three agreements decided in the range, and an agreement with an `agreement.renewed` event adds 0 to accepted (AC 3)
Proof: `cd web && npm run test:db reports` (label C5703)

**C5704** - Average days to sign is 4.0 for contracts sent on day 1 and completed on day 5, and null when none completed in the range (AC 5)
Proof: `cd web && npm run test:db reports` (label C5704)

**C5705** - The funnel returns four rows, created, sent, accepted and signed, each counted by its own event date inside the range and not outside it (AC 6, 9)
Proof: `cd web && npm run test:db reports` (label C5705)

**C5706** - The aging report returns the median days of each of three stages and at most ten stuck agreements, oldest first, none of them decided or completed (AC 7)
Proof: `cd web && npm run test:db reports` (label C5706)

**C5707** - The losses report returns one row per refused, expired and withdrawn agreement in the range, with the refused agreement's reason "Price" and the expired reason null (AC 8)
Proof: `cd web && npm run test:db reports` (label C5707)

**C5708** - Renewals returns an agreement ending in 30 days in bucket 30 and one ending in 31 days in bucket 60, and none ending in 91 days; type is "auto" only when the org's CPI is set and below its threshold (AC 10)
Proof: `cd web && npm run test:db reports` (label C5708)

**C5709** - Revenue by customer lists customers largest first, ties by name, from in-term agreements only (AC 11)
Proof: `cd web && npm run test:db reports` (label C5709)

**C5710** - Revenue by type splits a 19999-cent line over two types as 10000 and 9999, so the by-type total equals the headline recurring revenue (AC 12)
Proof: `cd web && npm run test:db reports` (label C5710)

**C5711** - A viewer and a non-member get SQLSTATE 42501 from each of the seven functions (AC 13)
Proof: `cd web && npm run test:db reports` (label C5711)

**C5712** - An estimator gets 42501 from the headline and both revenue functions, and null `value_cents` from the funnel, aging, losses and renewals functions (AC 14)
Proof: `cd web && npm run test:db reports` (label C5712)

**C5713** - Org B's agreements, events and customers appear in none of org A's results (tenant isolation)
Proof: `cd web && npm run test:db reports` (label C5713)

**C5714** - A member of an org whose billing status is `canceled` still receives the headline rows (AC 17)
Proof: `cd web && npm run test:db reports` (label C5714)

**C5715** - An `agreement.sent` event at 2027-03-02 03:00 UTC is counted on 2027-03-01 and not on 2027-03-02 (door 2)
Proof: `cd web && npm run test:db reports` (label C5715)

**C5716** - An org with no agreements gets recurring 0, pipeline 0, win-rate counts 0 and four funnel rows of 0 (AC 9, 16)
Proof: `cd web && npm run test:db reports` (label C5716)

### S2 - Domain figures and CSV (door 3, door 4) · 2 files · ~12 KB · ~3k

**C5721** - `parseReportRange` with no params returns the 12 months ending today; with `from=2027-01-01&to=2027-03-31` returns those dates; with from after to, or `from=banana`, returns the default and a notice (AC 18)
Proof: `cd web && npx vitest run domain/reports -t "C5721"`

**C5722** - `winRate` returns "No decisions yet" for 0 decided and `50%` for accepted 1, refused 1 (AC 3, 4)
Proof: `cd web && npx vitest run domain/reports -t "C5722"`

**C5723** - `signLabel` returns "No signed contracts yet" for null and "4.0 days" for 4 (AC 5)
Proof: `cd web && npx vitest run domain/reports -t "C5723"`

**C5724** - `dropOff` returns 0% for the first stage and `50%` when 4 are created and 2 sent, and no division by zero when a stage has 0 (AC 6, 9)
Proof: `cd web && npx vitest run domain/reports -t "C5724"`

**C5725** - `toCsv` writes a header row, money 119999 cents as `1199.99`, dates as `YYYY-MM-DD`, quotes a cell holding a comma, doubles an inner quote, and prefixes a single quote to cells starting `=`, `+`, `-` or `@` (AC 15)
Proof: `cd web && npx vitest run domain/reports -t "C5725"`

**C5726** - `reportAccess` returns "money" for owner and admin, "operational" for estimator and "none" for viewer (AC 13, 14)
Proof: `cd web && npx vitest run domain/reports -t "C5726"`

### S3 - Adapter and routes (door 3, door 4) · 5 files · ~25 KB · ~7k

**C5731** - The Supabase `ReportReader` calls the rpc named for each report with `p_from` and `p_to`, maps SQLSTATE 42501 to `forbidden` and any other error to `unavailable` (AC 19)
Proof: `cd web && npx vitest run infrastructure/supabase/reports.test.ts -t "C5731"`

**C5741** - `GET /reports/export` answers 503 when the report cannot be read, 400 for an unknown `report` and for a bad date, 401 when signed out, 403 for a viewer, 403 for an estimator asking `revenue_customer`, and 200 with `text/csv` for an owner asking `funnel` (Surface)
Proof: `cd web && npx vitest run "app/(app)/reports/export" -t "C5741"`

**C5742** - The reports page redirects a viewer to `/pipeline`, shows an estimator no dollar sign, shows an empty org one empty state, and shows the error line of a failed section while the others render (AC 13, 14, 16, 19)
Proof: `cd web && npx vitest run "app/(app)/reports/page.test.tsx" -t "C5742"`

**C5743** - The nav shows Reports for owner, admin and estimator and not for viewer (plan Impact: nav)
Proof: `cd web && npx vitest run components/shell/nav-items.test.ts -t "C5743"`

### S4 - Live browser pass (profile ui) · author-run

**C5751** - `/reports` as the demo owner shows the headline, funnel, aging, losses, renewals and both revenue tables, and CSV downloads, at 375, 768 and 1440 px with no horizontal scroll, every touch target at least 44 px on mobile and tablet, and no console error (AC 1 to 16)
Proof: Playwright MCP pass per AGENTS.md (`npm run dev` in `web/`), recorded in the verification report as author-run

### S5 - Added after the first verification round (screen elements and wiring) · ~3k

**C5761** - Lost deals are grouped under Refused, Expired and Withdrawn headings with a count, empty groups are left out, and each row shows its agreement link, date and reason (AC 8)
Proof: `cd web && npx vitest run "app/(app)/reports/page.test.tsx" -t "C5761"`

**C5762** - The page links the stuck and renewal agreements, lists the sections in the order Headline, Funnel, Speed, Lost, Renewals, Revenue by customer, Revenue by type, lists revenue largest first, prefills the range form and shows "50% dropped off" for 4 created then 2 sent (AC 7, 10, 11)
Proof: `cd web && npx vitest run "app/(app)/reports/page.test.tsx" -t "C5762"`

**C5763** - `getContainer()` exposes `reports` on the session client, and `renewals()` calls the rpc `report_renewals` (door 3)
Proof: `cd web && npx vitest run composition/composition.test.ts -t "C5731: getContainer"`

**C5764** - `GET /reports/export?report=funnel&from=<a date after today>` with no `to` answers 400 and `from=<today>` answers 200 (AC 18)
Proof: `cd web && npx vitest run "app/(app)/reports/export" -t "after today with no end"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /reports` statuses (3) | 200 C5742 · 307 to sign-in C5742 · 307 to `/pipeline` C5742 | - |
| `GET /reports/export` statuses (5) | 200 C5741 · 400 C5741 · 401 C5741 · 403 C5741 · 503 C5741 | - |
| `public.report_*` statuses (2) | 200 C5701 · 403 C5711 | - |
| report functions (7) | headline C5701 · funnel C5705 · aging C5706 · losses C5707 · renewals C5708 · revenue_by_customer C5709 · revenue_by_type C5710 | - |
| functions refused to viewer (7) | headline C5711 · funnel C5711 · aging C5711 · losses C5711 · renewals C5711 · revenue_by_customer C5711 · revenue_by_type C5711 | - |
| export report keys (6) | funnel C5741 · aging C5741 · losses C5741 · renewals C5741 · revenue_customer C5741 · revenue_type C5741 (table-driven, 6 keys) | - |
| member roles (4) | owner C5726 · admin C5726 · estimator C5726 · viewer C5726 | - |
| nav roles (4) | owner C5743 · admin C5743 · estimator C5743 · viewer C5743 | - |
| decision events counted (3) | accepted C5703 · refused C5703 · expired C5703 | - |
| loss outcomes (3) | refused C5707 · expired C5707 · withdrawn C5707 | - |
| funnel stages (4) | created C5705 · sent C5705 · accepted C5705 · signed C5705 | - |
| renewal buckets (3) | 0-30 C5708 · 31-60 C5708 · 61-90 C5708 | - |
| Landing doors (4) | door 1 C5701 · door 2 C5715 · door 3 C5731 · door 4 C5741 | - |
| viewport widths (3) | 375 C5751 · 768 C5751 · 1440 C5751 | - |
| startup configuration: report reader wiring (1 assembly) | `getContainer()` in `composition/index.ts` C5731 | - |

- Claims naming a status code, route or response shape: C5711, C5712, C5741, C5742 - each has a proof that crosses the boundary (a database call as the role, or the route handler)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `public.report_*` (decides, reached across the Data API) | one SQL recipe as the real roles | one asserted case per branch: each event type, each bucket, each role |
| `domain/reports` (decides, pure) | one unit test at its own layer | one asserted case per row of each decision table |
| `app/(app)/reports/export` (entry point that decides role and input) | one test at the handler | accepted input, each rejected input, each error path |
| `infrastructure/supabase/reports.ts`, page markup (instrumentation) | covered by C5731, C5742 | none of its own |

Evidence:

- `domain/reports`: range parsing (4 branches), win rate (2), drop-off (2), CSV escaping (4), role access (4) -> decides
- `infrastructure/supabase/reports.ts`: maps seven rpc results and two error codes -> decides only the error mapping, proven in C5731
- closest analogue in the repo: `web/domain/pipeline/expiring.ts` with `expiring.test.ts`, same shape (a pure reader over rows), proven at its own layer

Cost: 4 proofs at their own layer across 4 files. Without these rows the date and role tables are proven only by a path that happens to traverse them.

## Swept

- validation: C5721 (dates), C5741 (report key, dates)
- failure modes: C5731 (rpc error), C5742 (a failed section does not take the page down)
- idempotency: n/a - every report is a read; calling it twice changes nothing
- authorization: C5711, C5712, C5713, C5741
- concurrency: n/a - each function is one statement in one snapshot, so a report cannot see half of a write
- data lifecycle: C5714 (a canceled org still reads); deactivated sites and customers stay in the figures because their agreements remain history
- dependency failure: C5731, C5742
- state transitions: n/a - reports read states and write none
- observability: n/a - no logging requirement; a failed section logs the rpc error code through `console.error` as the other adapters do (C5731)

## Out of scope

Per the plan: per-estimator performance, SaaS metrics, visit and invoicing reports, a per-org time zone, charts beyond a funnel bar, scheduled report emails.

## Handoff

- S1 = 8k (migration and recipe), S2 = 3k (domain), S3 = 7k (port, adapter, composition, two routes, nav), S4 = Playwright; about 20k in total across 14 files, under the 150k budget - one builder
- Mechanism: one builder
- **After verification round 1:** ROADMAP's revenue line amended to "as of today" and its automatic-renewal line to "left out of the figures" (owner chose the recommendations on 2026-11-15); C5712's claim about aging money is read as the funnel, losses and renewals only (aging has no money column); C5743 is proven by `nav-items.test.ts` (link toggle) together with `nav-gate.test.ts` (four roles); the owner applied the migration.
- **Settled mid-build:** the export route also answers 503 (added to Surface); `scripts/test-db/runner.test.ts` counts moved from 40 to 41 recipes and 42 to 43 SQL files for the new `reports` recipe; the domain avoids `new Date` because `domain/purity.test.ts` C33 forbids it; the plan's AC 2, 11 and 13 and the `GET /reports` viewer status were amended before any code (pipeline value no longer double-counts an in-term agreement; the two revenue reports are as of today; a viewer on the page is redirected, the export answers 403)
