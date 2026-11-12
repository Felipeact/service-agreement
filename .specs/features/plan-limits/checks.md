# Plan limits checks

Profile: standard
Plan: `.specs/features/plan-limits/plan.md`

31 checks in 3 slices · 3 one-way doors (approved: "implement", 2026-11-12) · 1 open, 0 block (blocks go-live only)

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C5100:`). This feature numbers from C5100 (C4315 is the highest id in use). `npx vitest run <file> -t "C5100:"` selects one.
- **SQL** recipe `plan_limits` runs with `npm run test:db plan_limits` from `web/` (new `supabase/tests/plan_limits.sql`, registered in `RECIPES` with the migration between `fixture.sql` and the test, as `checkout_email_in_use` did, so the hosted project needs no change). Every run is rolled back. Each assertion label starts with its check id. Tests that need small limits update `private.plan_limits` inside the rolled-back transaction, after C5107 has read the seeded values.
- Stripe, Claude and Supabase are never called by a proof: use cases take fakes, adapters take a client double.
- Existing approved checks stay true and unedited. `makeExtractImport` takes the allowance as an optional fifth argument, so every existing `extract-import` test (built with four arguments) keeps its meaning; the composition always passes it (C5126).

## Checks

### S1 - A plan's live-agreement limit stops a new agreement · ~14 files · ~120 KB · ~30k

**C5100** - On a Starter org with the limit set to 2 and 2 live agreements, `create_agreement` raises `55000` with hint `plan_limit_agreements` and inserts no `agreements` row and no `agreement_versions` row (AC 2)
Proof: `npm run test:db plan_limits` (label C5100)

**C5101** - With limit 2, a create at 1 live agreement succeeds and a create at 2 is refused: the boundary sits at `live >= limit`, not `live > limit` (AC 1, AC 2 boundary)
Proof: `npm run test:db plan_limits` (label C5101)

**C5102** - Agreements in `draft`, `sent` and `changes_requested` each count toward the limit, and agreements in `accepted`, `refused`, `expired` and `withdrawn` do not: with limit 1, a site holding one agreement in each non-live status allows a create, and one in each live status refuses it (AC 3)
Proof: `npm run test:db plan_limits` (label C5102)

**C5103** - An org with no `org_billing` row creates 3 agreements in a row with every plan limit set to 1 (AC 4)
Proof: `npm run test:db plan_limits` (label C5103)

**C5104** - The refusal's `detail` is `<plan>|<limit>|<used>` (for the limit-2 Starter case, `starter|2|2`) so the screen can name them without a second read (AC 5 data)
Proof: `npm run test:db plan_limits` (label C5104)

**C5105** - `private.run_renewals` creates a renewal draft for an org already at its limit, and the org then holds limit + 1 live agreements (AC 7)
Proof: `npm run test:db plan_limits` (label C5105)

**C5106** - After a downgrade leaves an org with more live agreements than its limit, a member can still save a service line on one of them and create is still refused (AC 8)
Proof: `npm run test:db plan_limits` (label C5106)

**C5107** - The seeded `private.plan_limits` rows are `starter` 15 and 10, `team` 60 and 40, `business` 200 and 120, and each equals the same plan in `PLANS` (door 1 parity)
Proof: `npm run test:db plan_limits` (label C5107)
Proof: `npx vitest run domain/billing/plan-limits.test.ts -t "C5107:"`

**C5108** - `org_billing.plan` references `plan_limits`: deleting the `team` limit row while an org holds `team` fails with `23503` (door 1)
Proof: `npm run test:db plan_limits` (label C5108)

**C5109** - `authenticated` and `anon` cannot read `private.plan_limits` (door 1 exposure)
Proof: `npm run test:db plan_limits` (label C5109)

**C5110** - `supabaseAgreementStore.create` turns `55000` with hint `plan_limit_agreements` and details `starter|15|15` into `{ ok:false, code:"plan_limit", plan:"starter", limit:15, used:15 }`, and `55000` with hint `site_inactive` still maps as before (AC 5 adapter)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C5110:"`

**C5111** - `planLimitMessage("agreements", { plan:"starter", limit:15, used:15 }, "manager")` is exactly "Your Starter plan allows 15 live agreements and you have 15." plus a link target `/settings/billing`; for `"staff"` it says to ask an owner or admin to change the plan and carries no link target (AC 5, AC 6)
Proof: `npx vitest run domain/billing/plan-limits.test.ts -t "C5111:"`

**C5112** - The New agreement form, the site page's new-agreement control and the start dialog each show that message for a `plan_limit` state, with the `/settings/billing` link for a manager only, and no agreement id in the output; and the actions that produce the state give the manager message to an owner and an admin and the staff message to an estimator (AC 5, AC 6)
Proof: `npx vitest run components/agreements/plan-limit-views.test.tsx -t "C5112:"`
Proof: `npx vitest run "app/(app)/plan-limit-actions.test.ts" -t "C5112:"`

### S2 - A plan's AI-import allowance stops a new extraction · ~9 files · ~60 KB · ~16k

**C5120** - `record_extraction_chunk` sets `extract_started_at` to `now()` on the call with a null cursor, and a second chunk and a stale-cursor retry (`40001`) leave it unchanged (AC 9)
Proof: `npm run test:db plan_limits` (label C5120)

**C5121** - `import_allowance` for a Starter org with the allowance set to 2 answers `allowed = true, used = 1` at one started job and `allowed = false, used = 2` at two, with `limit = 2` (AC 10, AC 11 boundary)
Proof: `npm run test:db plan_limits` (label C5121)

**C5122** - A job started one second before the first instant of this month in America/Vancouver does not count, one started at that instant does, and one started one second after the first instant of next month does not (AC 13 edges)
Proof: `npm run test:db plan_limits` (label C5122)

**C5123** - An org with no `org_billing` row gets `allowed = true` with a null limit (AC 14)
Proof: `npm run test:db plan_limits` (label C5123)

**C5124** - `import_allowance` raises `42501` for a viewer, and `P0002` for a non-member, a job of another org and a missing id, so a job id never reveals that another org holds it (Surface: 403 and 404)
Proof: `npm run test:db plan_limits` (label C5124)

**C5125** - `makeExtractImport` on a job with no progress and an allowance of `allowed:false` returns `{ ok:false, code:"plan_limit", ... }` and calls the extractor 0 times and `recordExtraction` 0 times; with `allowed:true` it calls the extractor once (AC 10, AC 11, AC 15 job stays `parsed`)
Proof: `npx vitest run application/use-cases/extract-import-limit.test.ts -t "C5125:"`

**C5126** - On a job with stored progress (cursor 1 of 3) the allowance is asked 0 times and the extractor is called once even when the allowance would refuse; and the composition's `extractImport` is built with an allowance (AC 12)
Proof: `npx vitest run application/use-cases/extract-import-limit.test.ts -t "C5126:"`
Proof: `npx vitest run composition/plan-limits-wiring.test.ts -t "C5126:"`

**C5127** - When the allowance read throws or answers `unavailable`, `makeExtractImport` returns `unavailable` and the extractor is called 0 times (AC 16)
Proof: `npx vitest run application/use-cases/extract-import-limit.test.ts -t "C5127:"`

**C5128** - `planLimitMessage("imports", { plan:"starter", limit:10, used:10, resetsOn:"December 1" }, "manager")` is exactly "Your Starter plan allows 10 AI imports a month and you have used 10. The count resets on December 1." (AC 15)
Proof: `npx vitest run domain/billing/plan-limits.test.ts -t "C5128:"`

**C5129** - The extract control renders that message when the extract state is `plan_limit`, and the uploaded job's row is not shown as failed (AC 15 screen)
Proof: `npx vitest run components/imports/plan-limit-views.test.tsx -t "C5129:"`

**C5130** - The allowance adapter maps the RPC row `{ used:3, limit:10, allowed:true, resets_on }` to the use case's shape, maps a refusal row, and maps any RPC error to `unavailable` (adapter)
Proof: `npx vitest run infrastructure/supabase/import-allowance.test.ts -t "C5130:"`

### S3 - Owners and admins see usage on the billing page · ~6 files · ~40 KB · ~10k

**C5140** - `org_usage()` for an owner of a Starter org with 3 live agreements and 2 started jobs this month answers plan `starter`, live agreements 3 of 15, AI imports 2 of 10 and the month start (AC 17 data)
Proof: `npm run test:db plan_limits` (label C5140)

**C5141** - `org_usage()` raises `42501` for an estimator, a viewer and a non-member (AC 20)
Proof: `npm run test:db plan_limits` (label C5141)

**C5142** - Withdrawing an agreement lowers `org_usage()` live agreements by 1 and deleting a started job lowers AI imports by 1 (door 3: computed, never stored)
Proof: `npm run test:db plan_limits` (label C5142)

**C5143** - The billing view renders "Live agreements 7 of 15" and "AI imports this month 3 of 10" and the reset date for usage 7/15 and 3/10 (AC 17)
Proof: `npx vitest run components/billing/billing-usage.test.tsx -t "C5143:"`

**C5144** - A row shows the word "Full" at used equal to limit and over it, and not at limit minus 1 (AC 18)
Proof: `npx vitest run components/billing/billing-usage.test.tsx -t "C5144:"`

**C5145** - When the usage read fails, `makeBilling.usage(member)` answers `null`, the page passes it to the view as its own `usage` prop beside the unchanged Stripe state, and the view shows "Usage unavailable" beside the rest of the page (AC 19)
Proof: `npx vitest run application/use-cases/billing-usage.test.ts -t "C5145:"`
Proof: `npx vitest run "app/(app)/settings/billing/page.test.ts" -t "C5145:"`
Proof: `npx vitest run composition/plan-limits-wiring.test.ts -t "C5145:"`
Proof: `npx vitest run components/billing/billing-usage.test.tsx -t "C5145:"`

**C5146** - The usage adapter maps the RPC row to `{ liveAgreements:{used,limit}, aiImports:{used,limit}, resetsOn }` and a `42501` or any other error to `null` (adapter)
Proof: `npx vitest run infrastructure/supabase/org-usage.test.ts -t "C5146:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| agreement statuses and the live rule (7) | `draft` C5102 · `sent` C5102 · `changes_requested` C5102 · `accepted` C5102 · `refused` C5102 · `expired` C5102 · `withdrawn` C5102 | - |
| plans and their seeded limits (3) | `starter` C5107 · `team` C5107 · `business` C5107 (each row both numbers, SQL and `PLANS`) | - |
| `create_agreement` statuses (6) | 200 C5101 · 404 `P0002` C5110 · 403 `42501` C5110 · 409 `23505` C5110 · 409 `site_inactive` C5110 · 409 `plan_limit_agreements` C5100 | - |
| `import_allowance` statuses (4) | 200 allowed C5121 · 200 refused C5121 · 404 `P0002` C5124 · 403 `42501` C5124 | - |
| `org_usage` statuses (2) | 200 C5140 · 403 `42501` C5141 | - |
| month edges (3) | just before this month C5122 · first instant C5122 · first instant of next month C5122 | - |
| `plan_limit` refusal surfaces (3) | New agreement form C5112 · site page control C5112 · start dialog C5112 | - |
| limit boundary (2) | `used = limit - 1` allowed C5101, C5121 · `used = limit` refused C5101, C5121 | - |
| roles on the new RPCs (4) | owner C5140 · estimator C5141 (usage refused), C5121 (allowance allowed) · viewer C5124, C5141 · non-member C5124, C5141 | - |
| plan_limits exposure (3) | `authenticated` read C5109 · `anon` read C5109 · FK from `org_billing` C5108 | - |

- Claims naming a status code, route or response shape: C5100, C5104, C5110, C5124, C5141 - each has a proof that crosses the boundary (the SQL calls the function as a signed-in role; the adapter tests feed the error code in)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (`create_agreement` guard, `import_allowance`, `org_usage`) | one at the boundary (SQL, called as the role) **and** one at the adapter that maps its codes | the contract at the boundary; one asserted case per row of the decision table |
| Decides, not reached across a boundary (`makeExtractImport` allowance branch, `planLimitMessage`, usage row formatting) | one at its own layer | one asserted case per row of the decision table |
| Instrumentation (composition wiring, action pass-through) | one wiring proof | the allowance is passed to `makeExtractImport` (C5126) |

Evidence:

- `create_agreement` guard: branches on no billing row, count against limit, role, site status: 4 branch points -> decides
- `makeExtractImport` allowance step: branches on first chunk or not, allowed or not, read failed: 3 branch points -> decides
- `planLimitMessage`: 2 kinds x 2 audiences -> decides
- closest analogue in the repo: `checkout_email_in_use` (SQL function plus adapter plus use case), proven at the same three levels with 15 checks

Cost: 11 proofs at their own layer across 9 files. Without these rows, the refusal and the first-chunk rule would be proven only by a path that happens to traverse them.

## Swept

- validation: C5101, C5122 (boundaries of the limit and the month)
- failure modes: C5127 (allowance read fails), C5145 (usage read fails)
- idempotency: C5120 (a retry never re-stamps, so never counts twice)
- authorization: C5124, C5141, C5109
- concurrency: existing - `create_agreement` already takes a per-org advisory lock before it numbers the agreement, and the live count sits after it, so two creates cannot both pass at limit - 1 (the lock is proven by the existing `agreement_builder` recipe); the import allowance overshoot is accepted in the plan's Assumptions
- data lifecycle: C5142, C5122 (a withdrawn agreement or a new month frees the count)
- dependency failure: C5127, C5145, C5146
- state transitions: C5102, C5106 (which statuses count; a downgrade changes nothing already created)
- observability: n/a - no logging requirement in this slice; a refused create or extract is a normal answer, not a fault

## Out of scope

Same as the plan's `Out of scope`: draft catalog metering, paid-seat enforcement at invite time, warnings and overage purchase, new limits, hiding agreements on downgrade.

## Handoff

- S1 = ~30k (create path in SQL, adapter, message, three screens), S2 = ~16k (use case, adapter, SQL, one screen), S3 = ~10k (billing use case, adapter, view). Files touched weigh about 182 KB (about 45k tokens) plus about 25k of new tests and one migration: ~75k in total, all in Billing, Agreements and Imports, under the 150k budget - one builder
- Mechanism: one builder

- **Boundary:** C5100-C5146 closed at the commit that adds this line (database half at `86e52d2`)
- **Settled mid-build:** (1) C5145's proof moved from `makeBilling.load` carrying usage to a separate `makeBilling.usage(member)` that the page calls and passes to `BillingView` as its own `usage` prop: carrying usage inside `load` made the existing C3130 (every fetch is a Stripe URL) and C3110 (the page passes the state unchanged) fail, and those belong to an approved feature. The observable claim is unchanged. (2) Existing registries were mechanically updated, with no assertion weakened: the `test:db` runner counts (35 to 36 recipes, 37 to 38 files, `plan_limits` added to the list), C537's wiring regex now allows the fifth `makeExtractImport` argument, and `page.test.ts`'s container double gained `loadBillingUsage`. (3) Impact row "stored data": existing import jobs are not backfilled, so they never count (no tenant has usage yet). (4) The live Playwright pass was not run: it needs a signed-in session (a magic link from the owner's inbox) and the migration applied to the hosted project.
- **Abandoned:** carrying usage in `load`'s result (see above); counting a refused import against the allowance (a refusal never records a chunk)
