# Change plan verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 200d08b..97ee854
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

FAIL on four things, ranked at the end. One is the live check C3217, which has not been run. One is the SQL recipe, which passed once at HEAD and then went red during this session. The other two are surviving or unasserted behaviour in the gateway and stale proof commands. All 147 vitest proofs pass at HEAD.

## Binding sources

Step 1 is `ui`-only. This feature is `standard` and has no design mock. The plan's `Landing` (doors 1 to 3), `Surface` and `Relations` are binding, and they are compared under Coverage below.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| plan `Landing` doors 1-3, `Surface`, `Relations` | yes - `.specs/features/plan-change/plan.md` | none | - |

## Checks

**Run 1 (vitest):** one invocation from `web/` in PowerShell, with no failures:

```
npx vitest run domain/billing/plan-change.test.ts infrastructure/stripe/billing-gateway-plan.test.ts infrastructure/stripe/billing-gateway.test.ts components/billing/billing-view.test.ts components/billing/plan-switcher.test.ts application/use-cases/billing-change-plan.test.ts "app/(app)/settings/billing/actions.test.ts" infrastructure/stripe/checkout.test.ts infrastructure/supabase/org-plan.test.ts infrastructure/supabase/org-billing.test.ts composition/billing-change-plan-wiring.test.ts scripts/test-db/runner.test.ts -t "C32[01][0-9]:|C3105:|C3106:|C830:|C1045:|C20[0-9]:|C21[0-9]:" --reporter=verbose
```

The run exited 0 with 12 files and `147 passed | 137 skipped`. Each test named below shows a ✓ in the verbose output. An extra run of the unchanged `app/(app)/settings/billing/page.test.ts` also passed (10 tests, C3110, C3111, C3135), which covers the unchanged `303` statuses.

**The literal proof commands in checks.md match zero tests for C3201, C3206, C3207, C3208, C3209 and C3214.** The check names `infrastructure/stripe/billing-gateway.test.ts`, `application/use-cases/billing-page.test.ts` and `composition/billing-page-wiring.test.ts`, but the tests live in `billing-gateway-plan.test.ts`, `billing-change-plan.test.ts` and `billing-change-plan-wiring.test.ts`. Running those three named files with `-t "C3201:|C3206:|C3207:|C3208:|C3209:|C3214:"` gives `Test Files 3 skipped`, `Tests 81 skipped`, exit 0. That is a green proof with no test behind it. The claims are still proven by the real files cited below, so these rows read PASS on evidence. The stale commands are ranked gap 3.

**SQL recipe:** `npm run test:db set_org_plan`, run from `web/`.

- **Run 1** (real tree, before any fault work) printed `PASS set_org_plan` and `1 passed, 0 failed`, exit 0.
- **Run 2** (the fault worktree with the mutated body) printed `FAIL set_org_plan: function "set_org_plan" already exists with same argument types`.
- **Run 3** (real tree, unmodified HEAD) printed the same `FAIL ... already exists with same argument types` and `0 passed, 1 failed`, exit 1.

Between run 1 and run 2, `public.set_org_plan(text, integer)` appeared on the hosted project as a committed object. The runner keeps everything in one transaction (`fixture.sql:3` `begin;`, `set_org_plan.sql:125` `rollback;`), so neither run could have created it. The migration was most likely applied by the owner or author. As a result, the recipe's replay block (`set_org_plan.sql:9-33`, which the file says is "to be removed once the migration is applied") now collides with the applied function, and the proof for C3215 and C3216 is red at HEAD. No other database inspection was done, as instructed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C3200 | seat and total summary over the plans, sign-up seat rule | run 1, 12 tests ✓ | `web/domain/billing/plan-change.test.ts:17` `expect(summary.seats).toBe(newSeats)`, `:18` `expect(summary.extraSeats).toBe(extra)`, `:19` `expect(money(summary.totalCents)).toBe(total)` over rows `:11-14` (2→5 $99.00; 5→2 $49.00; 7→7/5 $124.00; 4→10 $199.00); all six pairs `:27` `expect(summary.seats).toBe(included(to))` | PASS |
| C3201 | overview carries `plan` from the tagged item and `extraSeats`; unknown or untagged is null | run 1, 6 tests ✓ (literal proof file matches 0) | `web/infrastructure/stripe/billing-gateway-plan.test.ts:89` `expect(result.ok && result.overview.plan).toBe(plan)`, `:90` `...extraSeats).toBe(extra)` (the business item listed after the seat item, `:85`); `:100` `...plan).toBeNull()` for untagged, `platinum` and unexpanded items; the expand is in `web/infrastructure/stripe/billing-gateway.test.ts:82` `toEqual(["default_payment_method", "items.data.price.product"])` (amended C3105) | PASS |
| C3202 | three plans in price order, prices, seats, Current plan, Switch on the other two | run 1, 3 + 2 tests ✓ | `web/components/billing/billing-view.test.ts:161` `expect(out.indexOf("$49/month")).toBeLessThan(out.indexOf("$99/month"))`, `:162`, `:163-165` seats, `:166` `expect(out.match(/Current plan/g)).toHaveLength(1)`, `:167-169` Switch to Starter and Business, not Team | PASS |
| C3203 | ending: no switch and the resume line; canceled: no list; unknown plan: the "can't be changed" line | run 1, 3 tests ✓ | `web/components/billing/billing-view.test.ts:174` `toContain("Resume your subscription to change plan")`, `:176` `not.toContain("Switch to")`; `:181` `not.toContain("$49/month")`; `:188` "This plan can't be changed here", `:191` `not.toContain("Switch to")` | PASS |
| C3204 | prompt: plan, price, seat line, total, trial line or prorated line | run 1, 4 tests ✓ | `web/components/billing/plan-switcher.test.ts:68` `toContain("Included seats: 5. Extra seats: 0.")`, `:69` `"New monthly total: $99.00."`, `:70` `"Nothing is charged until your trial ends on Nov 24, 2026."`, `:77` `"The change takes effect now and the difference is prorated."` | PASS |
| C3205 | open, keep, confirm once and refresh, pending, notices, throw | run 1, 8 tests ✓ in jsdom | `web/components/billing/plan-switcher.test.ts:93` `expect(changePlan).not.toHaveBeenCalled()`, `:104`, `:112` `toHaveBeenCalledTimes(1)`, `:113` `toEqual(["business"])`, `:114` refresh once, `:127` still once after `requestSubmit`, `:140` `[role="alert"]` text equals the notice, `:141` no refresh | PASS |
| C3206 | read with expand, product ensured (200 creates nothing, 404 creates), update keys with proration, the three seat cases | run 1, 7 tests ✓ (literal proof file matches 0) | `web/infrastructure/stripe/billing-gateway-plan.test.ts:112` expand, `:113` `expect(productPosts()).toEqual([])`, `:114-121` exact key set incl. `proration_behavior`, `:123` `items[0][id]` `si_plan`, `:127` product `sa_plan_team`, `:128` `create_prorations`; `:142-148` one create with id, name and both tags; `:157` quantity 3; `:166` `items[1][deleted]` `true`; `:175-179` added on `sa_extra_seat` at 1500 | PASS |
| C3207 | no-op: only the read, `changed` false | run 1, 2 tests ✓ (literal proof file matches 0) | `web/infrastructure/stripe/billing-gateway-plan.test.ts:209` `toEqual({ ok: true, changed: false })`, `:210` `expect(calls).toHaveLength(1)`, `:212` `expect(posts()).toEqual([])` | PASS |
| C3208 | each failure is unavailable or unsupported, logged once with no id, key or body, and writes nothing more | run 1, 8 tests ✓ (literal proof file matches 0) | `web/infrastructure/stripe/billing-gateway-plan.test.ts:229` `toEqual({ ok: false, code: "unavailable" })`, `:231` update count, `:232` `toHaveBeenCalledTimes(1)`, `:235` `not.toContain(secret)`; `:242` `unsupported`; `:275` no log at 9 999 ms, `:277` unavailable at 10 s | PASS |
| C3209 | use case: role first, invalid key, same_plan, seat rule, gateway then record, recording failure still ok | run 1, 21 tests ✓ (literal proof file matches 0) | `web/application/use-cases/billing-change-plan.test.ts:34` `toHaveBeenCalledWith(IDS, { plan: "team", extraSeats: 0 })`, `:36` `record` `("team", 5)`; `:42` extraSeats 5, `:43` `("starter", 7)`; `:48-49` forbidden and `get` not called; `:56` invalid; `:63-64` same_plan with no gateway call; `:70` no_subscription; `:76-77` unavailable with no gateway call; `:85` nothing recorded on a gateway failure; `:90-93` ok and one log line holding the code; `:100` heals the record | PASS |
| C3210 | action: login redirects, only the three keys, maps the answers, the notices | run 1, 20 tests ✓ | `web/app/(app)/settings/billing/actions.test.ts:141` `rejects.toThrow("NEXT_REDIRECT /login")`, `:142`; `:147` `toHaveBeenCalledWith({ orgId: "org-1", role: "owner" }, key)`; `:151-152` failed and not called; `:165` `toEqual({ status })`; `:169-172` arity 1 and the three notices | PASS |
| C3211 | Checkout tags plan (kind and key) and seat (kind only) | run 1, 3 tests ✓ | `web/infrastructure/stripe/checkout.test.ts:197` `...[metadata][sa_kind]")).toBe("plan")`, `:198` `sa_plan` `toBe(plan)`, `:199` seat `toBe("seat")`, `:200` seat carries only `sa_kind` | PASS |
| C3212 | one rpc; 42501, P0002 and other codes mapped; logged once with the code | run 1, 6 tests ✓ | `web/infrastructure/supabase/org-plan.test.ts:12` `toHaveBeenCalledWith("set_org_plan", { p_plan: "team", p_seats: 5 })`, `:24` `toEqual({ ok: false, code: outcome })`, `:25` once, `:27-29` code present, body and id absent | PASS |
| C3213 | read selects exactly four columns for the org (amends C3129) | run 1, 3 tests ✓ | `web/infrastructure/supabase/org-billing.test.ts:10` `toEqual({ ..., plan: "team", seats: 5 })`, `:13` sorted columns `["plan", "seats", "stripe_customer_id", "stripe_subscription_id"]` | PASS |
| C3214 | container: not_configured with no fetch; with both keys uses Stripe and the recorder | run 1, 4 tests ✓ (literal proof file `billing-page-wiring.test.ts` matches 0) | `web/composition/billing-change-plan-wiring.test.ts:42` `toEqual({ ok: false, code: "not_configured" })`, `:43` `fetchMock).not.toHaveBeenCalled()`; `:55` one POST to `/v1/subscriptions/sub_1`, `:57` `record` `("team", 5)` | PASS |
| C3215 | owner or admin updates only plan and seats of their own org | recipe run 1 PASS; runs 2 and 3 at HEAD FAIL `function "set_org_plan" already exists` | `supabase/tests/set_org_plan.sql:53-54` owner plan and seats, `:55` other columns unchanged, `:59` org B untouched, `:71-72` admin | FAIL - proof red at HEAD since the hosted project gained the function; the replay block must go |
| C3216 | 42501 (estimator, viewer, non-member), P0002, 22023 (plan, 0, 51, nulls), anon has no execute, authenticated does, no update grant | recipe run 1 PASS; runs 2 and 3 at HEAD FAIL (as above) | `supabase/tests/set_org_plan.sql:82,84,86` `expect_error(..., '42501')`, `:98` `'P0002'`, `:100-104` `'22023'`, `:114` `not has_function_privilege('anon', ...)`, `:115` authenticated, `:116` `not has_table_privilege('authenticated', 'public.org_billing', 'update')`, `:119` anon call 42501, `:121` direct update 42501 | FAIL - as C3215 |
| C3217 | live Playwright at 375, 768 and 1440 px, touch, no scroll, at least 44 px controls, switch and back changes Stripe and `org_billing.plan` | NOT RUN - author-run and outstanding | no evidence: no live report exists. Still owed: the run against the Stripe sandbox, the pages, sizes and touch actions, the subscription on the new price, `org_billing.plan` equal to `team`, and no console error | NOT RUN |

## Coverage

These sets are recomputed from the plan's Surface, Landing and Relations, and from the code and the provider. They are not copied from the author's table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `GET /settings/billing` statuses (3) | plan Surface; `page.tsx` diff only adds `changePlan` to `actions` | 200 with the plan list C3202 C3203 · 303 /login C3111 (`page.test.ts`, run, green) · 303 /settings C3111 | - |
| `changePlanAction` statuses (2) | Surface; `actions.ts:60-67` | 200 page state C3210 · 303 /login C3210 `actions.test.ts:141` | - |
| `changePlanAction` answers (4 statuses, 7 use-case codes) | `actions.ts:65-67`, `ChangePlanResult` | done, forbidden, same_plan, and invalid, unavailable, not_configured, no_subscription, unsupported → failed: C3210 `:163-165` | - |
| use-case codes (`ChangePlanResult`, 8) | `billing-page.ts:18-20` | ok, forbidden, invalid, same_plan, no_subscription, unavailable (db), and not_configured, unsupported, unavailable (gateway): C3209; recording failure → ok C3209 | - |
| Stripe product read statuses (3) | Surface; `ensureProduct` | 200 creates nothing C3206 `:113` · 404 creates C3206 `:142` · other (500, 403, refused) unavailable C3208 | - |
| Stripe product create (2) | Surface | 200 C3206 · failure C3208 "product create failing" | - |
| Stripe subscription update (3) | Surface | 200 C3206 · non-200 C3208 · 10 s timeout C3208 `:274-277` | - |
| Stripe subscription read in a change (2) | `changePlan` | 200 with expand C3206 `:112` · failure C3208 | - |
| door 1 update keys (6) | Landing door 1 | `items[0][id]`, `price_data[currency]`, `unit_amount`, `recurring[interval]`, `product`, `proration_behavior`: C3206 `:114-128` (exact key set) | - |
| door 1 product ids (4) | Landing door 1 | `sa_plan_starter`, `sa_plan_team`, `sa_plan_business` C3206 `:139-148` · `sa_extra_seat` C3206 `:183-193` | - |
| door 1 metadata keys (`sa_kind`, plus `sa_plan` beyond the literal door, recorded in "How proofs run") | Landing door 1 and checks.md | sa_kind C3206 C3211 · sa_plan C3206 C3211 | - |
| door 1 item identification in a **change** (plan item and seat item by tag, not position) | `changePlan` `taggedItems` + `find` | seat by tag C3206 · plan by tag: no proof orders the seat item first for a change (fault 2 survived) | plan item chosen by position in `changePlan` |
| door 1 item identification in the **overview** (by tag) | `overview` | C3201 `:85` (business after the seat item) | - |
| seat item cases (4) | `changePlan` | update C3206 `:157` · delete C3206 `:166` · add C3206 `:175` · untouched when only the plan changes C3206 (default rows) · seat-only change leaves the plan item out C3206 `:196-201` | - |
| plans (3) and switch pairs (6) | `PLANS`, `PLAN_KEYS` | C3202, and C3200 `:23-30` over all six pairs | - |
| seat outcomes (3) | `seatsAfterPlanChange` | moves C3200 `:27` · stays C3200 `:33` · raised C3200 `:34` | - |
| plan list states (5) | AC 1-5; `billing-view.tsx:77-85` | switchable C3202 · ending C3203 · canceled C3203 · unknown C3203 · non-ready states C3202 `:194` | - |
| `set_org_plan` statuses (4) | Surface | 200 C3215 · 42501 C3216 · P0002 C3216 · 22023 C3216, all in a recipe that is red at HEAD | 200, 42501, P0002, 22023 (proof red since the hosted function appeared) |
| `set_org_plan` callers (5) | AC 22; fixture roles | owner, admin C3215 · estimator, viewer, non-member C3216 (recipe red) | as above |
| `set_org_plan` privileges (3) | door 2 | anon, authenticated, no update grant: C3216 (recipe red) | as above |
| `ORG_BILLING` relation and column checks (2) | Relations; `20261110100000_workspace_provisioning.sql:12-13` | `plan in (...)` and `seats between 1 and 50`, re-validated in the function at `20261110190000_set_org_plan.sql:19` and asserted at C3216 `:100-104` (recipe red) | as above |
| roles in the app (4) | `canManageBilling` | owner, admin C3209 `:29` · estimator, viewer C3209 `:46` | - |
| AC 24 sizes (3) and touch | AC 24 | 375, 768, 1440: C3217 NOT RUN | 375, 768, 1440 px, touch |
| startup config (1) | `composition/index.ts:150-152` (`makeBilling(orgBilling, billingGateway, supabaseOrgPlanRecorder(supabase))`), with not_configured `:150` | C3214 | - |

**Swept rows checked against the code:**

- **RLS `org_billing_select`** is at `supabase/migrations/20261110100000_workspace_provisioning.sql:22-23`, `for select to authenticated using ((select private.has_org_role(org_id, array['owner', 'admin'])))`. Present.
- **No update grant** is at `:20` (`revoke all on public.org_billing from public, anon, authenticated;`) and `:21` (`grant select ... to authenticated`). Nothing else grants update. Present, and asserted at `set_org_plan.sql:116` and `:121`.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `domain/billing/plan-change.ts`, `application/use-cases/billing-page.ts` (changePlan) | C3200 at own layer · C3209 at own layer | yes - every row of both decision tables is asserted (fault 1 killed) |
| Entry point that decides nothing | `app/(app)/settings/billing/actions.ts` (`changePlanAction`), `page.tsx` | C3210 at the boundary | yes - accepted keys, 7 rejected keys, every answer, login redirects |
| Adapter | `infrastructure/stripe/billing-gateway.ts`, `infrastructure/stripe/checkout.ts`, `infrastructure/supabase/org-plan.ts`, `infrastructure/supabase/org-billing.ts` | C3201, C3206-C3208, C3211, C3212, C3213 against the fetch or client double | no - gap in `billing-gateway.ts`: the plan-item filter in `changePlan` is unasserted (fault 2 survived). The other three adapters are met |
| Client island with behaviour | `components/billing/plan-switcher.tsx` | C3204, C3205 in jsdom | yes (fault 4 killed) |
| Presentational component | `components/billing/billing-view.tsx` | C3202, C3203 markup | yes |
| Database function | `supabase/migrations/20261110190000_set_org_plan.sql` | one rolled-back SQL recipe | no - the recipe covers each role, refusal and privilege and passed once, but fails at HEAD against the hosted project since the function was applied; the replay block must be removed |

## Faults injected

Every fault ran in a scratch `git worktree add --detach <scratch>/wt HEAD`, with `web/node_modules` junctioned in and `web/.env.local` copied. The real tree's porcelain read `?? .specs/features/billing-portal/verification.md` before and after, and the worktree and junction were removed afterwards (`cmd /c rmdir` on the junction first, then `git worktree remove --force`). The real `web/node_modules` was intact afterwards.

| Mutation | Location | Killed |
| --- | --- | --- |
| record the plan before checking the Stripe result (records even when Stripe failed) | `web/application/use-cases/billing-page.ts:81-82` | yes - C3209 "a gateway answer of unavailable / not_configured / unsupported ... nothing is recorded" (3 failed) |
| `changePlan` picks the plan item by position (`items[0]`) instead of `kind === "plan"` | `web/infrastructure/stripe/billing-gateway.ts:169` | no - survived: C3206, C3207 and C3208 were all green (19 passed). Every change test lists the plan item first, so with a seat item first a change would rewrite the seat item's price |
| create the product even when the read answered 200 | `web/infrastructure/stripe/billing-gateway.ts:100-101` (`ensureProduct`) | yes - C3206 `:113` and the seat-product test (2 failed) |
| drop the `pending` guard from the switcher's submit | `web/components/billing/plan-switcher.tsx:38` | yes - C3205 "a second submit while the change is pending makes no second call" |
| replayed `set_org_plan` updates every org's row (`where org_id is not null`), only the function body edited in the worktree copy of `supabase/tests/set_org_plan.sql:26` | SQL recipe | inconclusive - the recipe fails at setup with `function "set_org_plan" already exists` before any assertion, and so does the unmodified recipe at HEAD. `C3215 other org untouched` (`:59`) targets this mutant but could not be shown to fail |

## Gate

- **vitest:** the batch above gave 147 passed and 0 failed, plus `page.test.ts` with 10 passed.
- **SQL recipe:** `npm run test:db set_org_plan` passed once, then failed on two later runs at HEAD (`function "set_org_plan" already exists with same argument types`).
- **Live C3217:** not run.

## History weighed

- **C3105, C3106 and C3129 → C3213.** These are amended as the plan's Impact says. The C3105 expand list gains `items.data.price.product` (`billing-gateway.test.ts:82`). The C3106 overview shape gains `plan: null, extraSeats: 0` (`:106-107`). C3129 is renamed C3213 with `seats` added. checks.md "How proofs run" names C3105 and C3129 but not C3106. The C3106 change follows directly from the plan's Impact row (`BillingOverview` gains the items), so it is acceptable but undeclared. checks.md also says "Checkout tests that pin line-item keys are amended", but none were: `checkout.test.ts` only gained C3211 and the existing tests stay green.
- **`runner.test.ts` pinned counts.** These went from 30 to 31 recipes and from 32 to 33 SQL files in C830, C1045, C203, C204, C205, C210 and C212. The change is mechanical: C210 requires every SQL file to sit in a recipe, so adding `set_org_plan.sql` forces the new counts. checks.md does not list these amendments, though "registered in `RECIPES`" implies them. Acceptable, but undeclared.
- **`metadata[sa_plan]`.** This goes beyond door 1's literal shape and is recorded in checks.md "How proofs run". It is needed because a Checkout-made product has a random id, and it is asserted at C3206 `:148` and C3211 `:198`. Acceptable.
- **`jsdom`.** It is already a dev dependency. The `plan-switcher.test.ts:1` header is `// @vitest-environment jsdom`.

## Other findings (not counted against a row)

- **`same_plan` is decided from `org_billing.plan`, not from Stripe** (`billing-page.ts:77`). AC 2 and the Assumptions say the current plan is the Stripe plan item, and that the column "may lag after a failed write". After a recording failure, for example Starter → Team with `set_org_plan` failing, the page shows Team as current and offers "Switch to Starter". Pressing it answers "You're already on this plan" and Stripe is never called, so the member cannot go back until something else heals the row. AC 13's "repeat of the same change" works, but no check covers a switch back to the stale recorded plan. This is a precision gap in C3209 and AC 12.
- **A recording failure logs two lines, not one.** The recorder logs `Recording the plan failed: <code>` (`org-plan.ts:17`), and the use case logs the same text again (`billing-page.ts:83`). AC 13 asks for one line. Each proof mocks the other side, so neither sees the pair.
- **AC 19's "Billing isn't available yet" is not reachable through the action.** `not_configured` maps to the plan notice (`actions.test.ts:160`). The page's `not_configured` state shows no plan list (C3202 `:194`), so in practice the switch control never shows. This is consistent with C3210's wording.

## Ranked gaps

1. **The live run has not been done** (C3217, `no evidence`). AC 24 at 375, 768 and 1440 px with touch, and the S1 to S3 independent tests against the Stripe sandbox, are still owed. The hosted project now appears to have `set_org_plan` (see 2), so the run's precondition may now be met.
2. **The SQL proof is red at HEAD** (C3215, C3216). `supabase/tests/set_org_plan.sql:9-33` replays a migration that the hosted project now holds, and the recipe fails with `function "set_org_plan" already exists`. Remove the replay block, as the file's own header says, and re-run so the recipe asserts the applied function. The SQL fault (`where org_id = v_org` widened) could not be evaluated.
3. **A mutant survives on plan-item identification in `changePlan`** (C3206 to C3208, `web/infrastructure/stripe/billing-gateway.ts:169`). Choosing `items[0]` passes every change test. Add a change test where the seat item precedes the plan item and assert `items[0][id]` is the plan item's id and the seat entry targets the seat item.
4. **checks.md proof commands for C3201, C3206, C3207, C3208, C3209 and C3214 select zero tests and exit 0.** They name `billing-gateway.test.ts`, `billing-page.test.ts` and `billing-page-wiring.test.ts` instead of `billing-gateway-plan.test.ts`, `billing-change-plan.test.ts` and `billing-change-plan-wiring.test.ts`. Correct the paths.
5. **Precision gap: `same_plan` is checked against the lagging `org_billing.plan`** (`web/application/use-cases/billing-page.ts:77`). It is not decided against Stripe's plan item, so switching back after a failed recording is refused.
6. **AC 13 asks for one log line, but a recording failure emits two** (`web/infrastructure/supabase/org-plan.ts:17` and `web/application/use-cases/billing-page.ts:83`).
7. **Undeclared amendments of approved tests.** These are C3106 (`billing-gateway.test.ts:106-107`) and the runner pins (C830, C1045, C203, C204, C205, C210, C212). Both are justified, but neither is listed in checks.md "How proofs run".
