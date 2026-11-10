# Change plan verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 200d08b..3afa9db (round 2 scope: 97ee854..3afa9db, commits 2339294 and 3afa9db)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 1 (FAIL at 97ee854) ranked seven gaps. Round 2 closes five of them: the SQL recipe is green at HEAD against the hosted function, the `items[0]` plan-item mutant is now killed, the six repointed proof commands now select their tests, `same_plan` is decided after a Stripe read, and a failed recording logs one line in total. The amended approved tests are also now declared. Two gaps remain, and they keep the verdict at FAIL:

1. The C3210 proof command, as written in checks.md, selects **no test file** and exits 1 in both PowerShell and Git Bash. It was not changed in this fix and round 1 did not catch it.
2. C3217 (live) rests only on the author's report, which this Verifier did not observe. That report does not record the 44 x 44 px control size or the horizontal scroll at 768 px, both of which the check requires on tablet.

All 149 vitest proofs pass at HEAD, the SQL recipe passes, and the Gate is 4236 passed with 0 failed.

## Binding sources

carried from 97ee854. Step 1 is `ui`-only, and the fix touched no interface (no `components/` or `app/` file changed in 2339294 or 3afa9db). The plan's AC 12 was amended in 3afa9db with the owner's approval, recorded at `.specs/features/plan-change/plan.md:95`. C3209 follows that amendment word for word (checks.md:53).

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| plan `Landing` doors 1-3, `Surface`, `Relations`; amended AC 12 and AC 13 | yes - `.specs/features/plan-change/plan.md` (re-read at 3afa9db, lines 92-96) | none | - |

## Checks

verified at 3afa9db (all proofs re-run in full at HEAD; citations refreshed for the files the fix touched, the rest carried from 97ee854 with line numbers unchanged).

**vitest, one invocation** from `web/` in PowerShell (`Set-Location 'C:\Users\dispa\Music\repos\ServiceAgreement\web'`):

```
npx vitest run domain/billing/plan-change.test.ts infrastructure/stripe/billing-gateway-plan.test.ts infrastructure/stripe/billing-gateway.test.ts components/billing/billing-view.test.ts components/billing/plan-switcher.test.ts application/use-cases/billing-change-plan.test.ts "app/(app)/settings/billing/actions.test.ts" infrastructure/stripe/checkout.test.ts infrastructure/supabase/org-plan.test.ts infrastructure/supabase/org-billing.test.ts composition/billing-change-plan-wiring.test.ts scripts/test-db/runner.test.ts -t "C32[01][0-9]:|C3105:|C3106:|C830:|C1045:|C20[0-9]:|C21[0-9]:" --reporter=default --reporter=json
```

The run exited 0 with `Test Files 12 passed (12)` and `Tests 149 passed | 137 skipped (286)`. Round 1 had 147. The two added tests are the new C3206 tag test and the new C3209 "record already says the plan" test; the C3209 same_plan test was rewritten, not added.

From the JSON report, here are the passed tests for each literal proof (file, check id). **No literal proof selects zero**: C3200 12 · C3201 6 · C3202 4 · C3203 3 · C3204 4 · C3205 8 · C3206 10 · C3207 2 · C3208 8 · C3209 22 · C3210 20 · C3211 3 · C3212 6 · C3213 3 · C3214 4. The amended approved tests also pass: C3105 1, C3106 6, and the runner pins C830, C1045, C201-C213.

**Literal-command spot runs.** `npx vitest run application/use-cases/billing-change-plan.test.ts -t "C3209:"` passed 22 of 22 with exit 0, which confirms the repointed path. The C3210 command as written, `npx vitest run "app/\(app\)/settings/billing/actions.test.ts" -t "C3210:"`, prints `No test files found, exiting with code 1` with `filter: app/(app/)/settings/billing/actions.test.ts` and exits 1. It fails the same way in Git Bash. vitest treats the argument as a path substring, not a regex, so the backslashes break it. This is a finding: the command fails loudly rather than giving a false green, and the C3210 claim stands on the 20 tests the unescaped path runs.

**SQL recipe.** `npm run test:db set_org_plan`, run from `web/` in PowerShell, printed `PASS set_org_plan` and `1 passed, 0 failed`, exit 0. The recipe no longer creates the function: a search for `create (or replace )?function|drop function|commit` over `fixture.sql` and `set_org_plan.sql` finds only the `tests.*` helpers, and `set_org_plan.sql:99` is `rollback;`. So it exercised the hosted `public.set_org_plan`. The mutated copy (fault 5) shows the hosted function's own message `got 42501 (not allowed to change the plan)`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C3200 | seat and total summary over the plans | batch, 12 ✓ (carried citation) | `web/domain/billing/plan-change.test.ts:17` `expect(summary.seats).toBe(newSeats)`, `:19` `expect(money(summary.totalCents)).toBe(total)` over rows `:11-14`; all six pairs `:27` | PASS |
| C3201 | overview `plan` from the tagged item, `extraSeats`; untagged or unknown is null | batch, 6 ✓ | `web/infrastructure/stripe/billing-gateway-plan.test.ts:89` `expect(result.ok && result.overview.plan).toBe(plan)`, `:90` extraSeats, `:100` `toBeNull()`; expand at `web/infrastructure/stripe/billing-gateway.test.ts:82` | PASS |
| C3202 | three plans in order, prices, seats, Current plan, Switch on the other two | batch, 4 ✓ in billing-view (carried citation) | `web/components/billing/billing-view.test.ts:161` price order, `:166` `expect(out.match(/Current plan/g)).toHaveLength(1)`, `:167-169` | PASS |
| C3203 | ending, canceled, unknown plan | batch, 3 ✓ (carried citation) | `web/components/billing/billing-view.test.ts:174` `toContain("Resume your subscription to change plan")`, `:181`, `:188` | PASS |
| C3204 | prompt lines | batch, 4 ✓ (carried citation) | `web/components/billing/plan-switcher.test.ts:68` `toContain("Included seats: 5. Extra seats: 0.")`, `:70` trial line, `:77` prorated line | PASS |
| C3205 | open, keep, confirm once, pending, notices | batch, 8 ✓ jsdom (carried citation) | `web/components/billing/plan-switcher.test.ts:112` `toHaveBeenCalledTimes(1)`, `:113` `toEqual(["business"])`, `:127` still once while pending, `:140` notice | PASS |
| C3206 | read with expand, product ensured, update keys, seat cases, **plan item by tag** | batch, 10 ✓ (round 1: 9) | `web/infrastructure/stripe/billing-gateway-plan.test.ts:123` `expect(body.get("items[0][id]")).toBe("si_plan")`; new test `:196` sets `subWith([seatItem(2), planItem("starter")])` (seat listed first) and asserts `:200` `expect(body.get("items[0][id]")).toBe("si_plan")`, `:201` `items[0][price_data][product]` `sa_plan_team`, `:202` `items[1][id]` `si_seat`, `:203` quantity `"3"`, `:204` no `price_data` key on `items[1]`; product create `:142-148`; seat delete `:166`, add `:175-179` | PASS |
| C3207 | no-op: only the read, `changed` false | batch, 2 ✓ | `web/infrastructure/stripe/billing-gateway-plan.test.ts:209` `toEqual({ ok: true, changed: false })`, `:210` `expect(calls).toHaveLength(1)` | PASS |
| C3208 | each failure unavailable or unsupported, one log line without secrets, no write | batch, 8 ✓ | `web/infrastructure/stripe/billing-gateway-plan.test.ts:229` `toEqual({ ok: false, code: "unavailable" })`, `:232` once, `:235` `not.toContain(secret)`, `:242` unsupported, `:277` 10 s | PASS |
| C3209 | use case (amended AC 12 and 13): role first, invalid, gateway then `same_plan` only when Stripe unchanged **and** record agrees, record after Stripe, recording failure ok with **no use-case log**, heal a lagging record | batch, 22 ✓; literal command 22/22 | `web/application/use-cases/billing-change-plan.test.ts:63` `toEqual({ ok: false, code: "same_plan" })` with `:64` `expect(changePlan).toHaveBeenCalledTimes(1)` and `:65` `expect(record).not.toHaveBeenCalled()`; record says the plan but Stripe differs, which is the switch back after a failed save: `:70` `toEqual({ ok: true })`, `:72` `expect(record).toHaveBeenCalledWith("team", 5)`; recording failure `:97` `toEqual({ ok: true })`, `:98` `expect(errorLog).not.toHaveBeenCalled()`; Stripe unchanged with a lagging record `:103-104` ok and `record("team", 5)`; role `:48-49`; invalid `:56`; gateway then record `:34-36`; gateway failure records nothing `:92` | PASS |
| C3210 | action: login redirects, three keys only, answers and notices | batch, 20 ✓; **literal command selects no file, exit 1** | `web/app/(app)/settings/billing/actions.test.ts:141` `rejects.toThrow("NEXT_REDIRECT /login")`, `:147`, `:151-152`, `:165` `toEqual({ status })`, `:169-172` | PASS (claim proven; the command is ranked gap 1) |
| C3211 | Checkout tags | batch, 3 ✓ (carried citation) | `web/infrastructure/stripe/checkout.test.ts:197` `toBe("plan")`, `:198` `toBe(plan)`, `:199` `toBe("seat")` | PASS |
| C3212 | one rpc; 42501, P0002 and other codes mapped; **one** log line with the code | batch, 6 ✓ | `web/infrastructure/supabase/org-plan.test.ts:12` `toHaveBeenCalledWith("set_org_plan", { p_plan: "team", p_seats: 5 })`, `:24` mapping, `:25` `expect(log).toHaveBeenCalledTimes(1)`, `:27-29` code present, body and id absent; thrown `:37` once | PASS |
| C3213 | four-column read | batch, 3 ✓ (carried citation) | `web/infrastructure/supabase/org-billing.test.ts:13` sorted columns `["plan", "seats", "stripe_customer_id", "stripe_subscription_id"]` | PASS |
| C3214 | container: not_configured with no fetch; with both keys uses Stripe and the recorder | batch, 4 ✓ (repointed command) | `web/composition/billing-change-plan-wiring.test.ts:42` `toEqual({ ok: false, code: "not_configured" })`, `:43` `fetchMock).not.toHaveBeenCalled()`, `:55` one POST, `:57` `record` `("team", 5)` | PASS |
| C3215 | owner or admin updates only plan and seats of their own org | `npm run test:db set_org_plan` → `PASS set_org_plan`, `1 passed, 0 failed`, exit 0, against the hosted function | `supabase/tests/set_org_plan.sql:27` `tests.ok('C3215 owner plan', a_after.plan = 'team', ...)`, `:28` seats `= 5`, `:29-31` every other column equal, `:33-34` org B still `business`/10, `:45-46` admin `business`/12 | PASS |
| C3216 | 42501 (estimator, viewer, non-member), P0002, 22023 (plan, 0, 51, nulls), privileges | same run, green | `supabase/tests/set_org_plan.sql:56,58,60` `expect_error(..., '42501')`, `:62-63` unchanged, `:72` `'P0002'`, `:74-78` `'22023'`, `:88` `not has_function_privilege('anon', ...)`, `:89` authenticated, `:90-91` no update grant, `:93` anon call 42501, `:95` direct update 42501 | PASS |
| C3217 | live at 375, 768, 1440 px: three plans, current marked, Starter to Team and back, prompt, no charge in trial, Stripe and `org_billing.plan` change, no horizontal scroll, controls at least 44 x 44 on mobile **and tablet**, touch taps, no console error | AUTHOR-RUN on 2026-11-10; this Verifier did not observe it and cannot re-run it (the sandbox objects were deleted); no report is in the repo (a search for `Nov 24, 2026`, `209 px` and `sandbox` over `*.md` finds none) | no file:line - author's report quoted below | AUTHOR-RUN - not independently observed; tablet 44 x 44 and 768 px horizontal scroll not reported |

**C3217, the author's report as given to the Verifier (quoted, not observed).** This was run on 2026-11-10 with the migration applied and the demo org pointed at a real sandbox subscription made the way Checkout makes it: tagged plan and seat products, and a trialing subscription with 2 extra seats.

- **1440 px.** `/settings/billing` listed Starter (current, read from the tag), Team and Business. Switch to Team showed "Switch to Team? $99/month. Included seats: 5. Extra seats: 0. New monthly total: $99.00. Nothing is charged until your trial ends on Nov 24, 2026." Keep my plan closed the prompt and changed nothing. Confirm switch then:
  - moved Stripe's plan item to a $99 price on a newly created `sa_plan_team` product tagged `sa_kind` plan and `sa_plan` team
  - deleted the seat item
  - left the trial unchanged
  - set `org_billing` to plan `team`, seats 5
- **375 px (CDP touch events).** No control was under 44x44 px and there was no horizontal scroll. Switching to Business by tap worked (prompt, Keep my plan, Confirm).
- **768 px.** A touch switch back to Starter worked, with the prompt "Included seats: 2. Extra seats: 0. New monthly total: $49.00." Cancel subscription then showed "Ends Nov 24, 2026", "Resume" and "Resume your subscription to change plan", with no switch controls. A Resume tap restored "Trial ends Nov 24, 2026" with the switch controls back.
- **1440 px, layout.** The content had equal 209 px gaps and no horizontal scroll.
- **Console.** No console errors from our code.
- **End state.** The final database row was starter with 2 seats, and Stripe's plan item was $49 on `sa_plan_starter`. The `sa_plan_starter`, `sa_plan_team` and `sa_plan_business` products exist, tagged.
- **Not exercised live:** the seat-item-added path, the 404-then-create path for the extra-seat product, and a recording failure.

**What is outstanding on C3217.**

1. The 44 x 44 px control size is reported only at 375 px. The check asks for "mobile and tablet", and nothing is reported for 768 px.
2. No horizontal scroll is reported at 375 and 1440 px, but not at 768 px.
3. "Charges nothing during the trial" rests on the prompt text and "left the trial unchanged". No invoice or upcoming-invoice amount is reported.
4. "No console error" is qualified as "from our code", so any other errors are not itemised.
5. The three paths the author did not exercise live are each proven at their own layer: the seat-item add (C3206 `:175-179`), the 404 product create (C3206 `:142-148`, and the seat product `:183-193`), and a recording failure (C3209 `:95-98` with C3212 `:25`).

The rest of the claim is covered by the quoted observations. That includes Starter to Team and back across the sizes, the touch taps on Switch, Keep my plan and Confirm switch, and the changes at both Stripe and `org_billing`. Because the Verifier did not observe the run, the row is not recorded as PASS.

## Coverage

Rows whose authority the fix touched were recomputed and are marked `verified at 3afa9db`. The other rows are `carried from 97ee854` and read as they did in round 1, all with nothing unproven.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| use-case decision after the gateway answers, amended AC 12 (4 cells) - verified at 3afa9db | `web/application/use-cases/billing-page.ts:79-85` (`changed.changed` × `found.value.plan === key`) | unchanged + record agrees → `same_plan`, no record C3209 `:63-65` · unchanged + record lags → record, ok C3209 `:103-104` · changed + record agrees (switch back after a failed save) → record, ok C3209 `:70-72` · changed + record differs → record, ok C3209 `:31-36` | - |
| use-case codes (`ChangePlanResult`) - verified at 3afa9db | `billing-page.ts:72-85` | ok `:31` · forbidden `:48` · invalid `:56` · same_plan `:63` · no_subscription `:77` · unavailable (db) `:83` · unavailable, not_configured, unsupported (gateway) `:91` · recording failure → ok `:97` | - |
| log lines on a recording failure, AC 13 "one line" (adapter + use case) - verified at 3afa9db | `org-plan.ts:17` and `:22` (adapter); `billing-page.ts:84` (use case, no log) | adapter exactly one C3212 `:25`, `:37` · use case zero C3209 `:98` · use case calls `record` once C3209 `:35` (success path) | - |
| door 1 item identification in a **change** (plan item by tag, seat item by tag) - verified at 3afa9db | `billing-gateway.ts:168-170` | plan by tag C3206 `:196-204` (seat listed first; fault 1 killed) · seat by tag C3206 `:202` | - |
| `set_org_plan` statuses (4) - verified at 3afa9db | Surface | 200 C3215 `:27-28` · 42501 C3216 `:56-60` · P0002 C3216 `:72` · 22023 C3216 `:74-78`, recipe green against the hosted function | - |
| `set_org_plan` callers (6) - verified at 3afa9db | AC 22; fixture roles | owner `:27`, admin `:45` C3215 · estimator `:56`, viewer `:58`, non-member `:60`, anon `:93` C3216 | - |
| `set_org_plan` privileges (3) - verified at 3afa9db | door 2 | anon no execute `:88` · authenticated execute `:89` · no update grant `:90-91`, `:95` | - |
| `ORG_BILLING` column checks re-validated in the function (2) - verified at 3afa9db | `20261110100000_workspace_provisioning.sql:12-13` | plan in three `:74-75` · seats 1-50 `:76-78` | - |
| AC 24 sizes (3) and touch - verified at 3afa9db | AC 24 | 375 (44 px, no scroll, touch) · 768 (touch) · 1440 (no scroll): C3217 AUTHOR-RUN, not observed | 768 px 44 x 44 controls and horizontal scroll not reported; whole set not independently observed |
| `GET /settings/billing` statuses (3) - carried from 97ee854 | Surface | 200 C3202 C3203 · 303 /login, 303 /settings C3111 | - |
| `changePlanAction` statuses (2) and answers - carried from 97ee854 | `actions.ts:60-67` | C3210 `:141`, `:163-165` | - |
| Stripe product read (3), product create (2), subscription update (3), subscription read (2) - carried from 97ee854 | Surface; `ensureProduct`, `changePlan` | C3206, C3208 | - |
| door 1 update keys (6), product ids (4), metadata keys (2) - carried from 97ee854 | Landing door 1 | C3206 `:114-128`, `:139-148`, `:183-193`; C3211 | - |
| door 1 item identification in the overview - carried from 97ee854 | `overview` | C3201 `:85` | - |
| seat item cases (4) - carried from 97ee854 | `changePlan` | C3206 `:157`, `:166`, `:175`, `:196-201` | - |
| plans (3), switch pairs (6), seat outcomes (3), plan list states (5) - carried from 97ee854 | `PLANS`, `seatsAfterPlanChange`, `billing-view.tsx` | C3200, C3202, C3203 | - |
| roles in the app (4) - carried from 97ee854 | `canManageBilling` | C3209 `:29`, `:46` | - |
| startup config (1) - carried from 97ee854 | `composition/index.ts:150-152` | C3214 | - |

**Swept rows** (carried from 97ee854): RLS `org_billing_select` at `supabase/migrations/20261110100000_workspace_provisioning.sql:22-23` and no update grant at `:20-21`. Both are present and now asserted green at `set_org_plan.sql:90-91` and `:95`.

## Test policy rows

verified at 3afa9db for the touched or previously unmet rows; the rest are carried from 97ee854.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (verified at 3afa9db) | `domain/billing/plan-change.ts`, `application/use-cases/billing-page.ts` (changePlan, touched) | C3200 · C3209 at own layer | yes - all four cells of the amended decision and every outcome are asserted; faults 2, 3 and 4 killed |
| Entry point that decides nothing (carried from 97ee854) | `actions.ts`, `page.tsx` | C3210 at the boundary | yes - accepted keys, rejected keys, every answer, login redirects (the claim holds; the broken literal command is ranked gap 1) |
| Adapter (verified at 3afa9db) | `billing-gateway.ts`, `checkout.ts`, `org-plan.ts`, `org-billing.ts` | C3201, C3206-C3208, C3211, C3212, C3213 against the fetch or client double | yes - the plan item by tag is now asserted (C3206 `:196-204`) and the `items[0]` mutant is killed (fault 1); request keys and each error reply as in round 1 |
| Client island with behaviour (carried from 97ee854) | `plan-switcher.tsx` | C3204, C3205 in jsdom | yes |
| Presentational component (carried from 97ee854) | `billing-view.tsx` | C3202, C3203 markup | yes |
| Database function (verified at 3afa9db) | `supabase/migrations/20261110190000_set_org_plan.sql` | one rolled-back SQL recipe | yes - recipe green against the hosted function, covering owner, admin, estimator, viewer, non-member and anon, each refusal (P0002, 22023 on plan, null plan, 0, 51, null seats) and the three privileges; fault 5 shows the recipe reports a wrong expectation as a failure |

On the Database function row: the hosted function itself could not be mutated (forbidden by the brief). The widened `where` fault from round 1 is therefore still not demonstrated against the function body. Two things make up for it:

- The recipe mutation shows the assertions run against the real function: the hosted function's own message `got 42501 (not allowed to change the plan)` was printed, and the runner reports a mismatch as `FAIL` with exit 1.
- The assertion that would kill a widened update, `set_org_plan.sql:33-34` (org B still `business`/10 after the owner of org A calls the function), is a concrete literal comparison.

This is enough to judge the row met. It is not a demonstration that the `C3215 other org untouched` assertion kills that particular mutant.

## Faults injected

verified at 3afa9db. Every fault ran in a scratch `git worktree add --detach <scratchpad>\wt HEAD` at 3afa9db, with `web/node_modules` junctioned in and `web/.env.local` copied. The real tree's `git status --porcelain` was empty before and empty after. Each mutated file was restored with `git checkout --` after its run. The junction was removed with `cmd /c rmdir`, then `git worktree remove --force`. The real `web/node_modules\vitest\package.json` was present afterwards.

| Mutation | Location | Killed |
| --- | --- | --- |
| plan item chosen by position: `const planItem = items[0];` (round-1 survivor) | `web/infrastructure/stripe/billing-gateway.ts:169` | yes - C3206 "the plan item is chosen by its tag, not its position" failed (1 failed, 19 passed of C3206-C3208) |
| `same_plan` answered from the stored plan alone, before any Stripe call (`if (found.value.plan === key) return same_plan`) | `web/application/use-cases/billing-page.ts:78` | yes - 2 failed: C3209 `:61` (gateway called once) and `:68` (record says the plan, Stripe differs) |
| the use case logs the failed recording again (`if (!recorded.ok) console.error(...)`) | `web/application/use-cases/billing-page.ts:84` | yes - 3 failed: C3209 `:95` for forbidden, not_found and unavailable |
| record before Stripe answers (`await plans.record(...)` moved above `gateway.changePlan`) | `web/application/use-cases/billing-page.ts:79` | yes - 6 failed: C3209 `:29` (owner, admin), `:61`, `:89` (three gateway failures) |
| recipe copy expects `22023` for the estimator instead of `42501` (the hosted function is not mutable) | worktree `supabase/tests/set_org_plan.sql:56` | yes - `FAIL set_org_plan: C3216 estimator: expected SQLSTATE 22023, got 42501 (not allowed to change the plan)`, `0 passed, 1 failed`, exit 1 |

## Gate

- **vitest, full suite.** `npx vitest run` in a clean worktree of 3afa9db, from PowerShell with the uppercase path, gave `Test Files 233 passed (233)` and `Tests 4236 passed (4236)`, with 0 failed and exit 0.
- **Proof batch.** 149 passed, 0 failed.
- **SQL recipe.** `npm run test:db set_org_plan` printed `PASS set_org_plan` and `1 passed, 0 failed`, exit 0.
- **Live C3217.** This is author-run evidence only and was not observed by the Verifier (see the Checks section).

## History weighed

- **Round 1 gaps.** Five are now closed:
  - Gap 2 (SQL red): the replay block is removed and the recipe is green.
  - Gap 3 (`items[0]` survivor): now killed.
  - Gap 4 (six stale paths): repointed, and each selects its tests.
  - Gap 5 (`same_plan` from the lagging record): decided after a Stripe read, per amended AC 12.
  - Gap 6 (two log lines): the use case no longer logs, so one line results.

  Gap 7 (undeclared amendments) is closed too: checks.md:14 now lists C3106, C3213 and the runner pins, and says no Checkout test was amended. Gap 1 (live) is now author-run evidence (see C3217).
- **AC 12 amendment.** It is recorded as owner-approved at plan.md:95 and checks.md:53. The Verifier accepts the record as written and did not see the approval itself.
- **The lagging-record scenario end to end.** After Starter to Team with `set_org_plan` failing, Stripe holds Team and `org_billing` holds Starter, and the page offers Switch to Starter (the current plan is read from Stripe). The action calls the use case with `starter`. The stored plan equals the key, the gateway changes Stripe (`changed: true`), and the use case records and answers ok. This is the shape C3209 `:68-73` asserts, and fault 2 shows the old refusal would be caught. A repeat of Team in the same state answers ok and heals the record (C3209 `:101-104`), which is AC 13's repeat.

## Other findings (not counted against a row)

- **"One line in total" is proven by composition, not by one test.** No test runs the real use case with the real recorder: C3214 mocks `org-plan`. The total is one line only because the adapter logs once (C3212 `:25`), the use case logs nothing (C3209 `:98`), and the use case calls `record` once. That last fact is asserted only on the success path (C3209 `:35`). In the recording-failure test (`:95-98`), the number of `record` calls is not asserted. A use case that retried a failed recording would emit two adapter lines and still pass every proof. This is a small precision gap in C3209.
- **The summary uses the stored seats when the record lags.** `planChangeSummary(found.value.plan, key, found.value.seats)` (`billing-page.ts:78`) reads `org_billing.seats`. After a failed recording those are the pre-change seats. For the plan-to-plan moves C3200 covers, the result is the same, because a move goes to the new included count. Nothing in the plan pins the lagging case.
- **checks.md Swept "observability"** still names C3209 among the "one log line" proofs. After 3afa9db, C3209 proves the use case logs nothing on a recording failure. This is wording only.

## Ranked gaps

1. **The C3210 proof command in checks.md runs no test** (C3210, checks.md:57). `npx vitest run "app/\(app\)/settings/billing/actions.test.ts" -t "C3210:"` gives `No test files found, exiting with code 1` in PowerShell and in Git Bash, because the backslash-escaped parentheses become `app/(app/)/...`. Write the path unescaped, as `"app/(app)/settings/billing/actions.test.ts"`, which the batch above ran: 20 tests passed.
2. **The live check is author-run evidence that this Verifier did not observe, and two tablet obligations are unreported** (C3217, no file:line). The quoted report covers the three sizes, touch, the switch there and back, and the Stripe and `org_billing` changes. It does not report the 44 x 44 px control size or horizontal scroll at 768 px. "Charges nothing" rests on the prompt and an unchanged trial, with no invoice amount. The run cannot be repeated, because the sandbox objects were deleted. Closing this needs a re-run at 768 px that records the control sizes and `scrollWidth`, or the owner's explicit acceptance of the author's report as the C3217 evidence.
3. **Precision gap: C3209's recording-failure test does not pin a single `record` call** (`web/application/use-cases/billing-change-plan.test.ts:95-98`). As a result, the AC 13 "exactly one line" holds by composition only on the success path assertion `:35`.
