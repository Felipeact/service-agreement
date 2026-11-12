# Plan limits verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: fea83cd..HEAD (HEAD = 491ead3)
**Round**: 2 - scoped (round 1 at 5c24ef9 is kept below as the superseded record; its table headers were renamed so the gate reads only round 2)
**Verifier**: independent sub-agent (author != verifier)

## Round 2 (scoped), verified at 491ead3

Scope: the fix commit 491ead3 ("close the verifier round 1 gaps") and every round-1 verdict that was not PASS. The rest is carried from 5c24ef9: `git diff 5c24ef9..HEAD --stat` lists only tests and the two spec files, so the migration and all source files are unchanged. Proofs were re-run in full at the new HEAD.

Round 2 result: all 31 numbered checks are proven by their claims as now written (6 were not in round 1). The verdict stays FAIL because one mutant survives (M15, admin on `import_allowance`, a role the plan names), which leaves one Test policy row unmet, and the fix introduced one new `tsc` error.

### Round 2 gate runs at 491ead3

| Run | Command | Result |
| --- | --- | --- |
| Named vitest proofs | `npx vitest run <12 files> -t "C51[0-4][0-9]:" --reporter=verbose` from `web/` | 48 passed, 0 failed (was 35); every id still has a test that ran; new ones: C5111 x1, C5128 x1, C5130 x1, C5145 x2 (page, wiring), C5112 x5 and C5129 x4 in `plan-limit-actions.test.ts` |
| SQL recipe | `npm run test:db plan_limits` | `PASS plan_limits`, 1 passed, 0 failed |
| Full suite | `npm test` | 270 files, 4510 tests passed, 0 failed |
| Types | `npx tsc --noEmit -p .` | 5 errors: the 4 pre-existing (`.next/types/validator.ts` x2, `app/setup/draft-actions.test.ts` x2) and one new, introduced by 491ead3: `app/(app)/settings/billing/page.test.ts(60,40)` TS2345. The double at `page.test.ts:8` is `vi.fn(async () => null)`, typed to return `null`, so `mockResolvedValue({ plan: "team", ... })` at `:60` does not compile. Vitest does not type check, so the suite is green and `tsc` is not |

### Round 2 checks

Re-judged: the checks whose proof or claim text changed. Every other check carries from 5c24ef9 and was re-run green in the gate above.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5104 | detail `<plan>\|<limit>\|<used>`, now with limit != used | `npm run test:db plan_limits` PASS | `supabase/tests/plan_limits.sql:123` `split_part(tests.pl_create('s5106'), '/', 3) = 'starter\|1\|2'` (limit 1, used 2 after the downgrade); the original `plan_limits.sql:107` `starter\|2\|2` stays. M12 (swap) killed: "C5104 limit and count differ: detail is starter\|2\|1" | PASS |
| C5110 | adapter maps `starter\|15\|15` and now `starter\|15\|17` | `npx vitest run infrastructure/supabase/agreements.test.ts -t "C5110:"` 1 passed | `web/infrastructure/supabase/agreements.test.ts:170` `toEqual({ ok:false, code:"plan_limit", plan:"starter", limit:15, used:17 })` from `details: "starter\|15\|17"` at `:169`; T1 killed | PASS |
| C5111 | exact agreements message, now also 15 vs 17 | `npx vitest run domain/billing/plan-limits.test.ts -t "C5111:"` 2 passed | `web/domain/billing/plan-limits.test.ts:31` message `"Your Starter plan allows 15 live agreements and you have 17."`; T2 killed | PASS |
| C5112 | three screens show the message, link for a manager only; and the actions give the manager message to an owner and an admin, the staff message to an estimator | `npx vitest run components/agreements/plan-limit-views.test.tsx "app/(app)/plan-limit-actions.test.ts" -t "C5112:"` 8 passed | views `web/components/agreements/plan-limit-views.test.tsx:24,35,45`; actions `web/app/(app)/plan-limit-actions.test.ts:37-38` message contains `allows 15 live agreements and you have 17` and `billingHref` is `/settings/billing` for owner and admin and `null` for estimator; `:66-67` the same for startAgreementAction (owner and estimator only, low, same `audienceOf`). A1 and A3 killed | PASS |
| C5124 | `42501` for a viewer; `P0002` for a non-member, another org's job and a missing id | SQL PASS | `plan_limits.sql:250` viewer `42501`; `:252` non-member `P0002`; `:254` other org `P0002`; `:256` missing `P0002`. `checks.md:74` now says exactly this and why; it matches `supabase/migrations/20261112220000_plan_limits.sql:170-172`. The amended claim is honest | PASS |
| C5128 | exact imports message, now also 40 vs 42 | `npx vitest run domain/billing/plan-limits.test.ts -t "C5128:"` 2 passed | `web/domain/billing/plan-limits.test.ts:36-38` `"Your Team plan allows 40 AI imports a month and you have used 42. The count resets on January 1."`; T2b killed | PASS |
| C5130 | allowance adapter maps allowed, refusal, errors; now with used != limit | `npx vitest run infrastructure/supabase/import-allowance.test.ts -t "C5130:"` 7 passed | `web/infrastructure/supabase/import-allowance.test.ts:29` `toEqual({ ok:true, allowed:false, plan:"team", limit:40, used:42, resetsOn:"2027-01-01" })` from a row `used:42, limit:40`; swap mutant T1b killed | PASS |
| C5145 | `makeBilling.usage` answers `null` on failure; the page passes it as its own `usage` prop beside the unchanged state; the view shows "Usage unavailable" | `npx vitest run application/use-cases/billing-usage.test.ts "app/(app)/settings/billing/page.test.ts" composition/plan-limits-wiring.test.ts components/billing/billing-usage.test.tsx -t "C5145:"` 7 passed | use case `web/application/use-cases/billing-usage.test.ts:35,39` null on a null answer and on a throw, `:29` `load` unchanged; page `web/app/(app)/settings/billing/page.test.ts:62-63` `loadBillingUsage` called with `{ orgId:"org-1", role:"owner" }` and `element.props.usage` equals the usage; container `web/composition/plan-limits-wiring.test.ts:58-60` `loadBillingUsage` reads once for an owner and answers `null` with no read for an estimator; view `web/components/billing/billing-usage.test.tsx:42-45`. `checks.md:113` and `plan.md:18` now describe `makeBilling.usage` plus the page's `usage` prop, which is what `web/app/(app)/settings/billing/page.tsx:26-27` and `web/composition/index.ts:164,203` do. T12, C1 and C2 killed | PASS |
| C5140 | owner of Starter: plan, 3 of 15, 2 of 10, month start; an admin may also read | SQL PASS | owner `plan_limits.sql:273-276`; new admin case `plan_limits.sql:288` `(public.org_usage() ->> 'plan') = 'starter'` with the estimator promoted at `:284`; M13 killed (raw "not allowed to read usage") | PASS |

### Round 2 Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| refusal detail fields (3: plan, limit, used) | `20261112220000_plan_limits.sql:51`, `web/infrastructure/supabase/agreements.ts:404-408`, `web/domain/billing/plan-limits.ts:45-46`, `web/infrastructure/supabase/import-allowance.ts` | distinguished by `plan_limits.sql:123` (1 vs 2), `agreements.test.ts:170` (15 vs 17), `plan-limits.test.ts:31` (15 vs 17), `:36-38` (40 vs 42), `import-allowance.test.ts:29` (40 vs 42) | - |
| roles on the new RPCs (5) | `20261112220000_plan_limits.sql:38,170,173,205` | `org_usage`: owner `plan_limits.sql:273`, admin `:288`, estimator `:281`, viewer `:283`, non-member `:285`. `import_allowance`: estimator `:202`, owner (org B owner in C5123 `:245`; removing owner from the list fails the recipe), viewer `:250`, non-member `:252`. admin on `import_allowance`: no assertion; changing line 173 to `array['owner','estimator']` leaves the recipe green (M15) | admin on `import_allowance` |
| `plan_limit` refusal surfaces and their actions (4 views, 3 actions) | `new-agreement-form.tsx:72`, `sites/new-agreement.tsx:34`, `new-agreement-dialog.tsx:153`, `imports/extract-control.tsx:37`; `agreement-actions.ts:48`, `new-agreement-actions.ts:49`, `import-actions.ts:73` | views as round 1; actions `plan-limit-actions.test.ts:37-38,51-52,66-67` for owner, admin, estimator (start action owner and estimator) | - |
| billing page chain (3 hops) | `composition/index.ts:164,203`; `settings/billing/page.tsx:26-27` | composition `plan-limits-wiring.test.ts:58-60`; page `page.test.ts:62-63`; view `billing-usage.test.tsx:42-45`; C1, C2, T12 killed | - |
| `create_agreement` statuses (6) | plan Surface | unchanged from round 1: `P0002`, `42501`, `23505`, `site_inactive` branches of the replaced body rest on existing recipes against the pre-migration function and on my reading that the body is verbatim; carried, low | - |

### Round 2 Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `20261112220000_plan_limits.sql` (`create_agreement` guard, `import_allowance`, `org_usage`), `agreements.ts`, `import-allowance.ts`, `org-usage.ts` | boundary (SQL as the role) and adapter, one case per decision-table row | no: detail fields, boundary, statuses and the five `org_usage` roles are now asserted, but `import_allowance` has no admin case (M15 survives), so one role row has no asserted case |
| Decides, not reached across a boundary | `extract-import.ts` allowance branch, `plan-limits.ts`, `billing-view.tsx` usage rows | one at its own layer, one case per table row | yes: `planLimitMessage` has limit != used cases for both kinds (T2, T2b killed); the extract branch and usage rows as in round 1 |
| Instrumentation (composition wiring, action pass-through) | `composition/index.ts`, the three actions, `settings/billing/page.tsx` | one wiring proof | yes: allowance wiring C5126, usage reader wiring `plan-limits-wiring.test.ts:58-60` (C1, C2 killed), page prop `page.test.ts:62-63` (T12 killed), actions `plan-limit-actions.test.ts` (A1, A2, A3 killed) |

### Round 2 Faults injected

Real tree, exact file, restored with `git checkout -- <file>`; `git status --porcelain` afterwards showed only `?? node_modules/` (and this file once written).

| Mutation | Location | Killed |
| --- | --- | --- |
| M12 refusal detail `plan\|limit\|used` -> `plan\|used\|limit` | `supabase/migrations/20261112220000_plan_limits.sql:51` | yes (C5104 limit and count differ) |
| M13 `org_usage` role list -> `['owner']` | `20261112220000_plan_limits.sql:205` | yes (C5140 admin) |
| M15 `import_allowance` role list -> `['owner','estimator']` (admin removed) | `20261112220000_plan_limits.sql:173` | no (recipe still passes; no admin calls `import_allowance`) |
| T1 adapter parses limit and used swapped | `web/infrastructure/supabase/agreements.ts:407` | yes (C5110) |
| T1b allowance adapter swaps limit and used | `web/infrastructure/supabase/import-allowance.ts` (refusal return) | yes (C5130) |
| T2 agreements message swaps limit and used | `web/domain/billing/plan-limits.ts:45` | yes (C5111) |
| T2b imports message swaps allowance and use | `web/domain/billing/plan-limits.ts:46` | yes (C5128) |
| T12 page stops passing `usage` | `web/app/(app)/settings/billing/page.tsx:27` | yes (C5145 page) |
| C1 composition builds `makeBilling` without `supabaseOrgUsage` | `web/composition/index.ts:164` | yes (C5145 wiring) |
| C2 `loadBillingUsage` replaced by a stub | `web/composition/index.ts:203` | yes (C5145 wiring) |
| A1 `createAgreementAction` audience forced to `manager` | `web/app/(app)/agreement-actions.ts:48` | yes (C5112 estimator) |
| A2 `extractImportAction` audience forced to `manager` | `web/app/(app)/import-actions.ts:73` | yes (C5129 estimator) |
| A3 `startAgreementAction` audience forced to `manager` | `web/app/(app)/new-agreement-actions.ts:49` | yes (C5112 estimator) |

Round 2: 13 injected, 12 killed, 1 survived (M15). Cumulative with round 1: 43 injected; round-1 survivors M12, M13, T1, T2, T2b, T12, A1, A2, C1 are all killed now.

### Round 2 ranked gaps

1. `import_allowance` admin branch unproven (M15): add an admin case beside the new `C5140 admin` block (`supabase/tests/plan_limits.sql:282-290`) that calls `public.import_allowance(...)` as the promoted estimator.
2. New type error from the fix: `web/app/(app)/settings/billing/page.test.ts:8` types `loadBillingUsage` as returning `null`, so `page.test.ts:60` fails `tsc` (TS2345). Type the double (for example `vi.fn<() => Promise<unknown>>(async () => null)`).
3. Accepted low items, unchanged and not counted: the dialog redirect after an allowance refusal, refusal order at the limit, `org_usage` `limit 1`, C5120 stamp not compared to `now()`.

Round 2 gate: `npm test` 270 files, 4510 passed, 0 failed; `npm run test:db plan_limits` 1 passed, 0 failed; named vitest proofs 48 passed, 0 failed.

---

# Round 1 record (superseded, verified at 5c24ef9)

Summary: every proof runs green at HEAD (35 named vitest tests across 10 files, the `plan_limits` SQL recipe, full `npm test` 269 files / 4497 tests), but fault injection found nine surviving mutants on eight assertion surfaces, one check (C5124) whose claim and proof disagree, and one check (C5145) whose claim text no longer describes the code. 25 of 31 checks are proven; 6 are not.

Count note: `checks.md:6` says "32 checks", the ids it lists are C5100-C5112 (13), C5120-C5130 (11) and C5140-C5146 (7) = 31. All 31 are accounted for below. The "32" is a miscount in checks.md, not a missing check.

## Gate runs at HEAD

| Run | Command | Result |
| --- | --- | --- |
| Named vitest proofs, one invocation | `npx vitest run <10 files> -t "C51[0-4][0-9]:" --reporter=verbose` from `web/` | 10 files, 35 tests ran and passed, 83 skipped (other tests in the same files); each named test appears individually below |
| SQL recipe | `npm run test:db plan_limits` from `web/` | `PASS plan_limits`, 1 passed, 0 failed (rolled back; replays `20261112220000_plan_limits.sql` between fixture and test) |
| Full suite | `npm test` from `web/` | 269 files passed, 4497 tests passed, 0 failed |
| Types | `npx tsc --noEmit -p .` | 4 errors, all pre-existing and outside the diff: `.next/types/validator.ts(432,39)`, `.next/types/validator.ts(440,69)`, `app/setup/draft-actions.test.ts(62,64)`, `app/setup/draft-actions.test.ts(104,64)`; none in a file this feature touched |
| Live Playwright pass | not run (the author did not run it either: `checks.md:176` item 4, needs a signed-in session and the migration on the hosted project); not one of the numbered checks | not run |

Named tests that ran (count > 0 for every vitest id): C5107 x1, C5110 x1, C5111 x1, C5112 x3, C5125 x2, C5126 x1 (use case) + x1 (wiring), C5127 x1, C5128 x1, C5129 x2, C5130 x6, C5143 x1, C5144 x4, C5145 x3 (use case) + x2 (view), C5146 x5. Vitest reported 35 passed; none of these ids is absent from the tree.

## Binding sources

Profile is `standard`; step 1 (binding sources) runs under `ui` only. The plan marks no design source as binding. Nothing to compare.

## Checks

SQL proofs cite `supabase/tests/plan_limits.sql` (abbreviated `pl.sql`); the label starts with the check id and the assertion is concrete.

| Check | Claim | Proof run | Evidence | Round 1 status |
| --- | --- | --- | --- | --- |
| C5100 | refused at limit 2 with 2 live: `55000`/`plan_limit_agreements`, no agreement, no version | `npm run test:db plan_limits` PASS | `pl.sql:103` `split_part(r,'/',1) = '55000' and split_part(r,'/',2) = 'plan_limit_agreements'`; `pl.sql:104` agreement count unchanged; `pl.sql:105` version count unchanged | PASS |
| C5101 | boundary `live >= limit`: create at 1 ok, at 2 refused | same | `pl.sql:98` `tests.pl_create('s5101a') = 'ok'` at 1 of 2; `pl.sql:106` `'55000'` at 2 of 2 (mutant `>` killed) | PASS |
| C5102 | draft, sent, changes_requested count; accepted, refused, expired, withdrawn do not | same | `pl.sql:148` the four non-live statuses allow a create at limit 1; `pl.sql:149-151` each of draft, sent, changes_requested refuses (mutant dropping changes_requested killed) | PASS |
| C5103 | org with no billing row creates 3 in a row with every limit 1 | same | `pl.sql:162-164` three `= 'ok'` as `uB` after `pl.sql:156` sets every limit to 1 | PASS |
| C5104 | detail is `<plan>\|<limit>\|<used>`, `starter\|2\|2` | same | `pl.sql:107` `split_part(r,'/',3) = 'starter|2|2'`; limit and used are both 2, so a swap of the two fields is invisible (mutant M12 survived) | FAIL |
| C5105 | `private.run_renewals` creates a renewal draft for an org at its limit; org then holds limit + 1 | same | `pl.sql:130` renewal draft exists; `pl.sql:132` live count `> 1` with limit 1. Migration does not touch `run_renewals` (no redefinition after `20261102180706_renewal.sql:27`; renewal inserts directly at `:78`). Caveat: a trigger-based implementation made the recipe fail (mutant M14) but the failure was a raw exception, not a `C5105` label, so attribution to this check is unproven | PASS |
| C5106 | after downgrade a member can still save a service line, create still refused | same | `pl.sql:116` `expect_rows ... update public.service_lines ... 1` as estimator at 2 live vs limit 1; `pl.sql:122` `plan_limit_agreements`. The edit is a direct `update`, not the `save_service_line` RPC the claim names (low) | PASS |
| C5107 | seeded rows 15/10, 60/40, 200/120, equal `PLANS` | `npm run test:db plan_limits` PASS + `npx vitest run domain/billing/plan-limits.test.ts -t "C5107:"` 1 passed | `pl.sql:72-74` three plans with both numbers, `pl.sql:75` exactly three rows; `web/domain/billing/plan-limits.test.ts:13` `expect(seeded.find(...)).toEqual({ plan, agreements: plan.liveAgreements, imports: plan.aiImports })` (mutant team 61 killed by the SQL side) | PASS |
| C5108 | deleting `team` limit row while an org holds `team` fails `23503` | SQL PASS | `pl.sql:304` `expect_error(... delete from private.plan_limits where plan = 'team', '23503')` (mutant removing the FK killed) | PASS |
| C5109 | `authenticated` and `anon` cannot read `private.plan_limits` | SQL PASS | `pl.sql:81` `not has_table_privilege('authenticated', ..., 'select')`; `pl.sql:82` anon (mutant granting select killed) | PASS |
| C5110 | adapter maps `55000`+`plan_limit_agreements`+`starter\|15\|15` to `{ok:false,code:"plan_limit",plan,limit,used}`; `site_inactive` as before | `npx vitest run infrastructure/supabase/agreements.test.ts -t "C5110:"` 1 passed | `web/infrastructure/supabase/agreements.test.ts:168` `toEqual({ ok:false, code:"plan_limit", plan:"starter", limit:15, used:15 })`; `:170` site_inactive `unavailable`. limit equals used, so swapping them survives (mutant T1) | FAIL |
| C5111 | `planLimitMessage("agreements", starter 15/15, "manager")` exact text + `/settings/billing`; staff text, no link | `npx vitest run domain/billing/plan-limits.test.ts -t "C5111:"` 1 passed | `web/domain/billing/plan-limits.test.ts:21-24` exact message and `billingHref`; `:26-27` staff text and `toBeNull()`. limit equals used, so `allows ${used} ... have ${limit}` survives (mutant T2); manager/staff mutant T6 killed | FAIL |
| C5112 | three screens show the message, link for manager only, no agreement id | `npx vitest run components/agreements/plan-limit-views.test.tsx -t "C5112:"` 3 passed | `web/components/agreements/plan-limit-views.test.tsx:24-26` form (message, `<a href="/settings/billing">`, no `/agreements/`); `:35-37` site control; `:45-46` `startNotice` equals; staff cases `:29-30`, `:40-41`. Proves the views given a state; the action that builds the state from the role is untested (see Defects D1) | PASS |
| C5120 | first chunk stamps `now()`; second chunk and stale retry leave it | SQL PASS | `pl.sql:174` stamp not null after null-cursor call; `pl.sql:182` unchanged after chunk 2; `pl.sql:183` `40001`; `pl.sql:187` unchanged after retry (mutant "always stamp" killed). Low: "= now()" is asserted only as not null | PASS |
| C5121 | allowance 2: `allowed=true, used=1` at one job; `allowed=false, used=2` at two; limit 2 | SQL PASS | `pl.sql:202` `used = 1 and limit = 2 and allowed and plan = 'starter'`; `pl.sql:211` `used = 2 and limit = 2 and not allowed` (mutant `<=` killed) | PASS |
| C5122 | month edges in America/Vancouver: -1s no, first instant yes, next-month first instant no | SQL PASS | `pl.sql:233` `used = 2` over five edge jobs set at `pl.sql:223-227` (-7h, -1s, first instant, next-month instant -1s, next-month instant); mutant swapping the zone to UTC counted 3 and was killed. The claim says "one second after" the next month's first instant; the test uses the instant itself, which is stricter | PASS |
| C5123 | no billing row: `allowed = true`, null limit | SQL PASS | `pl.sql:245` `allowed and a -> 'limit' = 'null'::jsonb and a -> 'plan' = 'null'::jsonb` (mutant killed) | PASS |
| C5124 | `42501` for a viewer **and a non-member**, `P0002` for another org's job or a missing id | SQL PASS | `pl.sql:250` viewer `42501`; `pl.sql:252` the non-member `uX` expects `P0002`, not `42501`; `pl.sql:254` other org `P0002`; `pl.sql:256` missing `P0002`. The proof asserts `P0002` for the non-member where the check says `42501`; the code (`20261112220000_plan_limits.sql:170-172`) cannot tell a non-member from another org's member, so the check text is self-contradictory. Fix the checks | FAIL |
| C5125 | no progress + `allowed:false` returns `plan_limit`, extractor 0, `recordExtraction` 0; `allowed:true` calls extractor once | `npx vitest run application/use-cases/extract-import-limit.test.ts -t "C5125:"` 2 passed | `web/application/use-cases/extract-import-limit.test.ts:50` `toEqual({ ok:false, code:"plan_limit", ..., limit:10, used:10, resetsOn })`; `:53-54` extractor and `recordExtraction` `toHaveBeenCalledTimes(0)`; `:69` extractor once, `:70` order (mutant removing the refusal killed) | PASS |
| C5126 | stored progress: allowance asked 0 times, extractor once; composition passes an allowance | `npx vitest run ... extract-import-limit.test.ts -t "C5126:"` 1 passed; `npx vitest run composition/plan-limits-wiring.test.ts -t "C5126:"` 1 passed | `extract-import-limit.test.ts:76-77` `check` 0 times, `extract` once under a refusing allowance; `web/composition/plan-limits-wiring.test.ts:48-50` the real `getContainer().extractImport` answers `plan_limit` and `extract` 0 times. Assembly read directly: `web/composition/index.ts:253` passes `supabaseImportAllowance(supabase)`. Mutants "ask on every chunk" and "drop the argument" both killed | PASS |
| C5127 | allowance throws or answers unavailable: `unavailable`, extractor 0 | `... -t "C5127:"` 1 passed | `extract-import-limit.test.ts:85-86` thrown -> `{ok:false,code:"unavailable"}`, extractor 0; `:89-90` unavailable answer, extractor 0 | PASS |
| C5128 | imports message exact text with `December 1` | `npx vitest run domain/billing/plan-limits.test.ts -t "C5128:"` 1 passed | `plan-limits.test.ts:32` exact string `"... allows 10 AI imports a month and you have used 10. The count resets on December 1."`. limit equals used (10/10): `allows ${used} ... used ${limit}` survives (mutant T2b) | FAIL |
| C5129 | extract control renders the message for `plan_limit`; job row not shown as failed | `npx vitest run components/imports/plan-limit-views.test.tsx -t "C5129:"` 2 passed | `web/components/imports/plan-limit-views.test.tsx:17` message text; `:18` billing link; `:19` button kept; `:25-26` staff, no link. No assertion for "not shown as failed"; it follows from C5125's `recordExtraction` 0 (`extract-import-limit.test.ts:54`) and the unchanged job list (low, noted) | PASS |
| C5130 | allowance adapter maps allowed row, refusal row, any error to `unavailable` | `npx vitest run infrastructure/supabase/import-allowance.test.ts -t "C5130:"` 6 passed | `web/infrastructure/supabase/import-allowance.test.ts:18` allowed -> `{ok:true,allowed:true}`; `:24` refusal row -> `{ ok:true, allowed:false, plan, limit:10, used:10, resetsOn }`; `:34` `42501`/`P0002`/`XX000`; `:41-42` thrown and non-row (mutant 42501 -> unavailable killed). Refusal row uses used 10 / limit 10 again (see Defects D2), but this adapter keeps the two fields apart by name from the row, so a swap there is caught only by the 3/10 allowed row not asserting fields (low) | PASS |
| C5140 | `org_usage()` owner of Starter: plan, agreements 3 of 15, imports 2 of 10, month start | SQL PASS | `pl.sql:273` plan `starter`; `pl.sql:274` `used = 3 and limit = 15`; `pl.sql:275` `used = 2 and limit = 10`; `pl.sql:276` `resets_on` | PASS |
| C5141 | `org_usage()` `42501` for estimator, viewer, non-member | SQL PASS | `pl.sql:281` estimator; `pl.sql:283` viewer; `pl.sql:285` non-member (mutant allowing estimator killed) | PASS |
| C5142 | withdrawing lowers agreements by 1, deleting a started job lowers imports by 1 | SQL PASS | `pl.sql:296` `live_agreements.used = 2` after 3; `pl.sql:297` `ai_imports.used = 1` after 2 | PASS |
| C5143 | billing view renders "Live agreements 7 of 15", "AI imports this month 3 of 10", reset date | `npx vitest run components/billing/billing-usage.test.tsx -t "C5143:"` 1 passed | `web/components/billing/billing-usage.test.tsx:20` `/Live agreements[\s\S]*?7 of 15/`; `:21` `/AI imports this month[\s\S]*?3 of 10/`; `:22` `resets on December 1` (mutant swapping the figure killed) | PASS |
| C5144 | "Full" at used = limit and over, not at limit - 1 | `... -t "C5144:"` 4 passed | `billing-usage.test.tsx:31` `out.split(">Full<").length - 1` equals 0 at 14/9, 2 at 15/10, 2 at 16/12; `:36-37` only the full row (mutant `>` killed) | PASS |
| C5145 | usage read fails: `makeBilling.load` still `ready` with usage `null`; view shows "Usage unavailable" beside the rest | `npx vitest run application/use-cases/billing-usage.test.ts -t "C5145:"` 3 passed; `npx vitest run components/billing/billing-usage.test.tsx -t "C5145:"` 2 passed | `web/application/use-cases/billing-usage.test.ts:35-39` `billing.usage(owner)` is `null` on `null` and on a throw; `:29` `billing.load(owner)` unchanged. `billing-usage.test.tsx:42-45` "Usage unavailable" plus "Payment method" and "Invoices". The claim text (`checks.md:112`) still says `load` returns the usage, the code does not (`web/application/use-cases/billing-page.ts:66`); and the link that matters, page to view, is untested: removing `usage={usage}` from `web/app/(app)/settings/billing/page.tsx:27` leaves all 66 tests in that folder green (mutant T12) | FAIL |
| C5146 | usage adapter maps the row, and `42501` or any error to `null` | `... infrastructure/supabase/org-usage.test.ts -t "C5146:"` 5 passed | `web/infrastructure/supabase/org-usage.test.ts:19` row -> `{ plan, liveAgreements:{7,15}, aiImports:{3,10}, resetsOn }`; `:33` `42501`/`XX000` null; `:40-41` thrown and malformed null (mutant swapping the two figures killed) | PASS |

Proven: 25 of 31. Not proven: C5104, C5110, C5111, C5124, C5128, C5145.

## Coverage

Sets recomputed from the code and the plan, not from the author's table.

| Set (size) | Recomputed from | Member -> proof | Round 1 gap |
| --- | --- | --- | --- |
| agreement statuses and the live rule (7) | `supabase/migrations/20261019174738_init.sql:125` check constraint; SQL `20261112220000_plan_limits.sql:48`; TS `web/domain/agreement/index.ts:82` | `draft`, `sent`, `changes_requested` C5102 (`pl.sql:149-151`); `accepted`, `refused`, `expired`, `withdrawn` C5102 (`pl.sql:148`, aggregate: any one counting would refuse). Plan Impact says `LIVE_STATUSES` is in `infrastructure/supabase/agreements.ts`; it is in `domain/agreement/index.ts:82` (same set) | - |
| plans and seeded limits (3) | `20261112220000_plan_limits.sql:15-18` and `PLANS` | `starter`, `team`, `business` each both numbers: `pl.sql:72-74` and `plan-limits.test.ts:13` | - |
| `create_agreement` statuses (6) | plan Surface | 200 `pl.sql:98`; `55000` `plan_limit_agreements` `pl.sql:103`; `P0002`, `42501`, `23505`, `site_inactive` on the **replaced** function: `checks.md` credits C5110, but `agreements.test.ts:165-171` only asserts `plan_limit` and `site_inactive` at the adapter, and no assertion in `plan_limits.sql` calls the new body for `P0002`, `42501`, `23505` or `site_inactive`. The existing `agreement_builder` recipe runs against the hosted (pre-migration) function. I read the new body against `20261103173437`: identical but line 86 | `P0002`, `42501`, `23505`, `site_inactive` branches of the new function body (verbatim copy verified by reading only) |
| `create_agreement` refusal detail fields (3: plan, limit, used) | `20261112220000_plan_limits.sql:51` | plan: `pl.sql:107`; limit and used: not distinguished anywhere because every test uses limit == used (`pl.sql:107` 2/2, `agreements.test.ts:168` 15/15, `plan-limits.test.ts:21` 15/15, `:32` 10/10) | limit versus used order |
| `import_allowance` statuses (4) | plan Surface | 200 allowed and refused `pl.sql:202`, `pl.sql:211`; `42501` `pl.sql:250`; `P0002` `pl.sql:254`, `pl.sql:256`. The check also lists non-member as `42501`; code returns `P0002` (C5124) | - |
| `org_usage` statuses (2) | plan Surface | 200 `pl.sql:273-276`; `42501` `pl.sql:281-285` | - |
| roles on the new RPCs (5: owner, admin, estimator, viewer, non-member) | `20261112220000_plan_limits.sql:38,170,173,205`; fixture holds owner `uA`, estimator `uE`, viewer `uV`, no admin | owner `pl.sql:273`; estimator `pl.sql:281` (refused usage), `pl.sql:202` (allowance allowed); viewer `pl.sql:250`, `pl.sql:283`; non-member `pl.sql:252`, `pl.sql:285`. `admin` is named by AC 17 and AC 20 and the source (`:205` `array['owner','admin']`) but no test signs in as an admin: changing the role list to `array['owner']` leaves the recipe green (mutant M13). Owner on `import_allowance` and on `create_agreement` is never exercised either | `admin` on `org_usage` and `import_allowance`; `owner` on `import_allowance` |
| month edges (3) | `20261112220000_plan_limits.sql:153` | just before this month `pl.sql:224`; first instant `pl.sql:225`; first instant of next month `pl.sql:227`; asserted in one number `pl.sql:233`, plus the UTC-zone mutant killed | - |
| limit boundary (2) | `20261112220000_plan_limits.sql:49,183` | `limit - 1` allowed and `limit` refused: C5101 `pl.sql:98,106`; C5121 `pl.sql:202,211` | - |
| `plan_limit` refusal surfaces (4 in code: New agreement form, site control, start dialog, extract control) | `web/components/agreements/new-agreement-form.tsx:72`, `web/components/sites/new-agreement.tsx:34`, `web/components/agreements/new-agreement-dialog.tsx:153`, `web/components/imports/extract-control.tsx:37` | views C5112 `plan-limit-views.test.tsx:24,35,45`, C5129 `plan-limit-views.test.tsx:17`. The server actions that turn `plan_limit` and the member's role into the state (`web/app/(app)/agreement-actions.ts:48`, `web/app/(app)/new-agreement-actions.ts:49`, `web/app/(app)/import-actions.ts:73`) have no test: forcing `audienceOf(...)` to `"manager"` in the first two leaves 2146 tests green (mutants A1, A2) | the three actions' role-to-audience step (AC 6 end to end) |
| billing page chain (3 hops: composition builds the reader, page loads usage, page passes it to the view) | `web/composition/index.ts:164,203`; `web/app/(app)/settings/billing/page.tsx:26-27` | adapter C5146, use case C5145, view C5143-C5145. Dropping `supabaseOrgUsage(supabase)` from `makeBilling(...)` at `composition/index.ts:164` leaves 2146 tests green (mutant C1); dropping `usage={usage}` at `page.tsx:27` leaves the folder green (mutant T12) | composition wiring of the usage reader; page-to-view hand-off |
| plan_limits exposure (3) | `20261112220000_plan_limits.sql:13,20-21` | `authenticated` `pl.sql:81`; `anon` `pl.sql:82`; FK `pl.sql:304` | - |

## Test policy rows

| Row | Files it classifies | Required proof | Round 1 expectation |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `20261112220000_plan_limits.sql` (`create_agreement` guard, `import_allowance`, `org_usage`), `agreements.ts`, `import-allowance.ts`, `org-usage.ts` | boundary (SQL as the role) and adapter, one case per decision-table row | no for the `create_agreement` guard: the refusal's three detail fields are not told apart (M12, T1); no admin case for `org_usage` and `import_allowance` (M13); C5124 asserts a different code than its claim. Met for the rest: `org_usage` and `import_allowance` have SQL and adapter proofs (C5140-C5142, C5121-C5124, C5130, C5146) |
| Decides, not reached across a boundary | `extract-import.ts` allowance branch, `plan-limits.ts` (`planLimitMessage`, `isFull`), `billing-view.tsx` usage rows | one at its own layer, one case per table row | no for `planLimitMessage`: both kinds x both audiences have a case, but no case has limit != used so wrong-field messages pass (T2, T2b). Met for the `makeExtractImport` branch (first chunk, allowed or not, read failed: `extract-import-limit.test.ts:50,69,76,85`) and for `isFull` and the usage rows (`billing-usage.test.tsx:31,36`) |
| Instrumentation (composition wiring, action pass-through) | `composition/index.ts`, `agreement-actions.ts`, `new-agreement-actions.ts`, `import-actions.ts`, `billing/page.tsx` | one wiring proof | no: the row's own coverage text names only the allowance reaching `makeExtractImport` (C5126, met and killed twice), but the row title also covers action pass-through, and none of the three actions, the usage reader's wiring, or the page's `usage` prop has a proof (A1, A2, C1, T12 survive) |

### Edits to existing registries

Compared with `git diff fea83cd -- <file>`.

- `web/scripts/test-db/runner.test.ts`: every change is a count moved 35 to 36 and 37 to 38 plus the new `plan_limits` entry in `ALL` (`runner.test.ts:45`); no assertion was removed or relaxed. Not weakened.
- `web/scripts/test-db/runner.mts:65`: one recipe added, as the plan says.
- `web/app/(app)/settings/billing/page.test.ts:8,11`: the container double gained `loadBillingUsage`; no assertion changed. Not weakened, but it also means no existing page test looks at `usage` (T12).
- `web/composition/composition.test.ts:241` (C537): the regex changed from requiring exactly `...supabaseAssetTypeCatalog(supabase))` to `...supabaseAssetTypeCatalog(supabase)(, supabaseImportAllowance(supabase))?)`. The allowance argument is optional in the new pattern, so C537 would pass with or without it (shown: dropping the argument left C537 green and failed only `C5126` in `plan-limits-wiring.test.ts:45`). The assertion about the four original arguments is intact; the loosening is covered by C5126. Judged: not a net weakening, but C537 alone no longer proves the allowance is wired.
- C5145's proof moved from `makeBilling.load` to `makeBilling.usage` (`checks.md:176` item 1). The reason given (C3130 and C3110 would fail) is credible, but `checks.md:112` and `plan.md:18` (Flow step 4: "`makeBilling.load` -> `public.org_usage`") were not updated and now describe code that does not exist.

Swept existing: `checks.md` "concurrency: existing - `create_agreement` already takes a per-org advisory lock before it numbers the agreement, and the live count sits after it": confirmed in the code, the lock is at `20261112220000_plan_limits.sql:85` and the capacity call at `:86`. Not proven by this feature's tests (no concurrent session in `plan_limits.sql`).

## Faults injected

Each fault was applied to the real tree on the exact file named, the narrowest covering proof was run, and the file was restored with `git checkout -- <file>`; `git status --porcelain` before and after shows only `?? node_modules/`. The `plan_limits` recipe replays the migration from the working tree, so migration mutants were run through `npm run test:db plan_limits`. Nothing was applied to the hosted project beyond the project's rolled-back replay.

| Mutation | Location | Round 1 outcome |
| --- | --- | --- |
| M1 `v_used >= v_limit` -> `v_used > v_limit` | `supabase/migrations/20261112220000_plan_limits.sql:49` | yes (C5100 refused: answered ok) |
| M2 month zone `America/Vancouver` -> `UTC` in `month_start` | `20261112220000_plan_limits.sql:153` | yes (C5122 edges: counted 3 of 5) |
| M3 stamp `extract_started_at = now()` on every chunk | `20261112220000_plan_limits.sql:128` | yes (C5120 second chunk moved the stamp) |
| M4 allowance `v_used < v_limit` -> `<=` | `20261112220000_plan_limits.sql:183` | yes (C5121 two used: allowed) |
| M5 `org_usage` also allows `estimator` | `20261112220000_plan_limits.sql:205` | yes (C5141 estimator) |
| M6 `import_allowance` allows `viewer` | `20261112220000_plan_limits.sql:173` | yes (C5124 viewer) |
| M7 no billing row answers `allowed = false` | `20261112220000_plan_limits.sql:183` | yes (C5123 allowed) |
| M8 live set without `changes_requested` | `20261112220000_plan_limits.sql:48` | yes (C5102 changes_requested) |
| M9 seed `team` 60 -> 61 | `20261112220000_plan_limits.sql:16` | yes (C5107 team) |
| M10 grant `select` on `private.plan_limits` to `authenticated` | `20261112220000_plan_limits.sql:13` | yes (C5109 authenticated) |
| M11 drop the `org_billing.plan` foreign key | `20261112220000_plan_limits.sql:20-21` | yes (C5108) |
| M12 refusal detail `plan\|limit\|used` -> `plan\|used\|limit` | `20261112220000_plan_limits.sql:51` | no (recipe still passes; C5104 is 2/2) |
| M13 `org_usage` role list `['owner','admin']` -> `['owner']` | `20261112220000_plan_limits.sql:205` | no (recipe still passes; no admin in the fixture) |
| M14 capacity check moved into a before-insert trigger with the membership gate removed (a renewal would be refused) | `20261112220000_plan_limits.sql:38-40` plus an appended trigger | yes (recipe failed with the raw exception "the starter plan allows 1 live agreements"; not attributable to a `C5105` label) |
| T1 adapter parses `limit` and `used` swapped | `web/infrastructure/supabase/agreements.ts:407` | no (C5110 passes; 15/15) |
| T2 agreements message `allows ${used} ... you have ${limit}` | `web/domain/billing/plan-limits.ts:45` | no (C5111 passes; 15/15) |
| T2b imports message `allows ${used} ... used ${limit}` | `web/domain/billing/plan-limits.ts:46` | no (C5128 passes; 10/10) |
| T3 allowance asked on every chunk (`cursor === null && allowance` -> `allowance`) | `web/application/use-cases/extract-import.ts:78` | yes (C5126 stored progress) |
| T4 refusal branch disabled (`if (!allowed.allowed)` -> `if (false)`) | `web/application/use-cases/extract-import.ts:87` | yes (C5125 refused) |
| T5 `isFull` `>=` -> `>` | `web/domain/billing/plan-limits.ts:55` | yes (C5144 at 15/10 and only-the-full-row) |
| T6 audience gate always gives the link | `web/domain/billing/plan-limits.ts:47` | yes (C5111, and three C5112 tests) |
| T7 `usage` ignores the role gate | `web/application/use-cases/billing-page.ts:67` | yes (C5145 member who may not see billing) |
| T8 composition drops `supabaseImportAllowance(supabase)` | `web/composition/index.ts:253` | yes (C5126 wiring); C537 stayed green |
| T9 adapter maps `42501` to `unavailable` | `web/infrastructure/supabase/import-allowance.ts` (42501 branch) | yes (C5130 `42501` is forbidden) |
| T10 usage adapter swaps the two figures | `web/infrastructure/supabase/org-usage.ts` (return statement) | yes (C5146 row, C5146 no plan) |
| T11 billing view shows the AI figure on the Live agreements row | `web/components/billing/billing-view.tsx` (`UsageRow` for Live agreements) | yes (C5143) |
| T12 page stops passing `usage` to `BillingView` | `web/app/(app)/settings/billing/page.tsx:27` | no (66 tests in `app/(app)/settings/billing` pass) |
| A1 `createAgreementAction` always uses audience `manager` | `web/app/(app)/agreement-actions.ts:48` | no (app, composition, components, application: 2146 passed) |
| A2 `extractImportAction` always uses audience `manager` | `web/app/(app)/import-actions.ts:73` | no (2146 passed) |
| C1 composition builds `makeBilling` without `supabaseOrgUsage` | `web/composition/index.ts:164` | no (2146 passed) |

30 faults injected, 21 killed, 9 survived (M12, M13, T1, T2, T2b, T12, A1, A2, C1). The survivors collapse into six root causes: refusal numbers never differ (M12, T1, T2, T2b), no admin session (M13), page-to-view wiring (T12), action-level role-to-audience (A1, A2), usage reader wiring (C1).

## Defects the checks do not cover

Ranked. D1 to D3 contradict a check or the plan and are FAIL reasons; D4 onward are observations.

- D1 (FAIL reason, AC 6 and AC 17 end to end): the role-to-audience mapping that decides whether a refused member gets the billing link is in three untested server actions (`web/app/(app)/agreement-actions.ts:48`, `web/app/(app)/new-agreement-actions.ts:49`, `web/app/(app)/import-actions.ts:73`). Forcing it to `manager` ships a billing link to estimators and viewers and 2146 tests stay green. C5112 and C5129 prove the views only from a pre-built state.
- D2 (FAIL reason, AC 5, AC 15): every number-bearing test uses limit == used (15/15, 10/10, 2/2). The SQL detail order, the adapter parse and both message templates can each swap limit and used undetected (M12, T1, T2, T2b). A real refusal on a Starter org with limit 15 at 15 used reads the same either way; a Team org with 60 and 60 also; but any future downgrade case (limit 1 with 2 live, which AC 8 expressly allows) would print "allows 2 ... you have 1".
- D3 (FAIL reason, plan accuracy): `plan.md:18` Flow step 4 and `checks.md:112` C5145 say `makeBilling.load` carries the usage. The code reads it through `makeBilling.usage` (`web/application/use-cases/billing-page.ts:66`) called from the page (`web/app/(app)/settings/billing/page.tsx:26`). The usage read does stay out of `load` (true, and `billing-usage.test.ts:29` shows `load` unchanged), but the artefacts were not updated and the page-to-view hand-off has no proof (T12). `plan.md:25` also places `LIVE_STATUSES` in `infrastructure/supabase/agreements.ts`; it is `web/domain/agreement/index.ts:82`.
- D4 (observation, FAIL for C5124): the plan Surface and C5124 say `42501` for a non-member; `import_allowance` answers `P0002` (`20261112220000_plan_limits.sql:170-172`), which is the better design (it does not confirm that another org's job exists) and is what `pl.sql:252` asserts. The check text is wrong, not the code.
- D5 (observation): after a plan-limit refusal on the extract step inside the "Create agreement and read the list" dialog, `web/components/agreements/new-agreement-dialog.tsx:188-191` pushes to the site import page for any status other than `extracted`. The agreement already exists, the allowance message is never shown, and the member lands on the site import page and meets the refusal only when pressing Extract there. Not contradicted by AC 15 but a silent path with no check.
- D6 (observation): the capacity check runs after the site and role checks but before the insert (`20261112220000_plan_limits.sql:86`), so an org at its limit that picks a site which already has a live agreement is told it is at its limit instead of "already in progress" (`23505` mapping in `web/infrastructure/supabase/agreements.ts:413`). Low.
- D7 (observation): `org_usage` picks the caller's org with `limit 1` and no `order by` (`20261112220000_plan_limits.sql:204`); for a person in two orgs the answer is arbitrary. Decision 9 (one org per person) is cited in the code. Low.
- D8 (observation): `import_allowance` is open to estimators and returns plan name and limit (`20261112220000_plan_limits.sql:173,181-184`) while `org_usage` is owner and admin only "money and plan figures". The refusal text names the plan to every member anyway (AC 5), so nothing new leaks. Low.
- D9 (observation): `C5120 stamped` asserts only `extract_started_at is not null` (`pl.sql:174`); the claim says `now()`. The mutant that stamped a constant would pass. Low.
- D10 (observation): deleting a started job lowers the count (C5142, door 3 by design), so a member can regain an AI import allowance by deleting a job after its Claude cost was spent. Accepted by the plan's door 3 rationale; not a defect against the checks.

Security: a member cannot read another org's plan through the new functions. `import_allowance` answers `P0002` for another org's job and for a missing id (`pl.sql:254,256`); `org_usage` reads only the caller's own membership (`20261112220000_plan_limits.sql:204-206`); `private.assert_agreement_capacity` returns silently for a non-member (`:38-40`), is in the non-exposed `private` schema and its only call site is `create_agreement` (`:86`). `private.plan_limits` is not readable by `authenticated` or `anon` (C5109). The `55000` detail parsing (`web/infrastructure/supabase/agreements.ts:404-408`) requires the hint to be exactly `plan_limit_agreements` and both numbers to be digits, otherwise the refusal falls through to `unavailable`; `site_inactive` is unaffected (`agreements.test.ts:170`). Month boundary: `private.month_start` (`20261112220000_plan_limits.sql:153`) truncates in Vancouver time and converts back, the upper bound is exclusive (`:180`), and `resets_on` is the next Vancouver month start as a date (`:184`); the UTC mutant is killed. `private.run_renewals` is unaffected, as the plan says: not redefined by the migration, inserts directly (`20261102180706_renewal.sql:78`). Existing `create_agreement` and `record_extraction_chunk` bodies are verbatim apart from the capacity call (`:86`) and the stamp (`:128`) (diffed against `20261103173437` and `20261027045548`).

## Gate

`npm test` (web/) - 269 files, 4497 passed, 0 failed; `npm run test:db plan_limits` - 1 passed, 0 failed; named vitest proofs - 35 passed, 0 failed; `npx tsc --noEmit -p .` - 4 errors, all pre-existing (`.next/` and `app/setup/draft-actions.test.ts`).

Ranked gaps to route back as fix work:

1. C5104, C5110, C5111, C5128: add refusal cases with limit != used (for example limit 1, used 2 after a downgrade, and 60/59) at the SQL detail, the adapter parse and both message templates (`pl.sql:107`, `agreements.test.ts:168`, `plan-limits.test.ts:21,32`).
2. C5145: update `plan.md:18` and `checks.md:112` to the `makeBilling.usage` design, and add a proof that the page passes `usage` to `BillingView` and that the container builds the reader (`web/app/(app)/settings/billing/page.tsx:27`, `web/composition/index.ts:164`).
3. Actions: add a proof that each of the three actions maps `plan_limit` plus the role to the manager or staff notice (`web/app/(app)/agreement-actions.ts:48`, `web/app/(app)/new-agreement-actions.ts:49`, `web/app/(app)/import-actions.ts:73`).
4. C5124: fix the check text so a non-member is `P0002` (`checks.md:73`), or change the code; and add an admin to the SQL fixture for `org_usage` and `import_allowance` (`pl.sql:268-285`).
5. Coverage: add `P0002`, `42501` and `23505` cases against the replaced `create_agreement` in `plan_limits.sql`, or state that they rely on the existing recipe.
