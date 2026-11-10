# Change plan checks

Profile: standard
Plan: `.specs/features/plan-change/plan.md`

18 checks in 6 slices · 3 one-way doors (approved by "approve") · 3 open, of which 1 blocks go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/` in **PowerShell with the uppercase drive path** (`Set-Location 'C:\Users\dispa\Music\repos\ServiceAgreement\web'`); Git Bash's lowercase `c:` breaks vitest. Every new test name starts with its check id and a colon (`C3200:`). This feature numbers from C3200 (no id above C3142 exists). `npx vitest run <file> -t "C3200:"` selects one.
- **SQL** recipe `set_org_plan` runs with `npm run test:db set_org_plan` from `web/` (new `supabase/tests/set_org_plan.sql`, registered in `RECIPES`, run after `fixture.sql`, rolled back). The migration is **not applied to the hosted project** without the owner's go-ahead (rule 8), so the recipe puts the migration file between the fixture and the test, inside the rolled-back transaction. Assertions are labelled with the check id and take their expected values from the plan.
- **Stripe** is never called by a vitest proof: the gateway tests stub `fetch`.
- **Live** (C3217) is an author-run Playwright pass per AGENTS.md at 375, 768 and 1440 px against the Stripe sandbox with the owner's test keys; nothing is committed. It needs the migration applied (open question 1).
- Amended approved tests, named by the plan's Impact: C3105 (the subscription read's `expand[]` list gains `items.data.price.product`), C3129 (the `org_billing` read gains the `seats` column), and the Checkout tests that pin its line-item keys.
- Settled mid-build and recorded here, not a plan rewrite: each product also carries `metadata[sa_plan]` (the plan key), because a Checkout-made product has a random id and the page must know *which* plan an item is, not only that it is a plan.
- Concurrency is not driven by any proof; see Swept.

## Checks

### S1 - The page lists the plans and marks the current one · 6 files · ~45 KB · ~12k

**C3200** - The plan-change summary over the three plans: from Starter (2 seats) to Team gives 5 seats, 0 extra, a monthly total of $99.00; from Team (5 seats) to Starter gives 2 seats, 0 extra, $49.00; from Team with 7 seats to Starter gives 7 seats, 5 extra, $124.00; from Starter with 4 seats to Business gives 10 seats, 0 extra, $199.00; each from the sign-up seat rule `seatsAfterPlanChange` and the price from `monthlyTotalCents` (AC 6)
Proof: `cd web && npx vitest run domain/billing/plan-change.test.ts -t "C3200:"`

**C3201** - The overview is read with the subscription's items and their products expanded, and carries `plan` (the plan item's product `sa_plan`: `starter`, `team` or `business`) and `extraSeats` (the seat item's quantity, 0 with none); a subscription with no item whose product is tagged `sa_kind` `plan`, or a `sa_plan` outside the three, has `plan` null (AC 2, AC 5)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3201:"`

**C3202** - The plan list shows Starter, Team and Business in price order with "$49/month", "$99/month" and "$199/month" and included seats 2, 5 and 10, marks the current plan "Current plan" with no switch control, and offers "Switch to <plan>" on the other two (AC 1, AC 2)
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3202:"`

**C3203** - For a subscription set to end the list shows no switch control and says "Resume your subscription to change plan"; for a `canceled` one there is no plan list; when the plan is unknown it shows the list with no switch control and "This plan can't be changed here" (AC 3, AC 4, AC 5)
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3203:"`

### S2 - A confirming step says what will happen · 3 files · ~20 KB · ~6k

**C3204** - The switch prompt names the new plan and its monthly price, the seat line ("Included seats: 5. Extra seats: 0."), the new monthly total, and says "Nothing is charged until your trial ends on Nov 24, 2026." while `trialing` and "The change takes effect now and the difference is prorated." otherwise (AC 6, AC 7)
Proof: `cd web && npx vitest run components/billing/plan-switcher.test.ts -t "C3204:"`

**C3205** - In the browser DOM, Switch to Team only opens the prompt and calls nothing, Keep my plan closes it and calls nothing, only Confirm switch calls the action once with the plan key `team` and then refreshes once, a second press while pending makes no second call, and `forbidden`, `same_plan` and `unavailable` answers or a throw show their notices and do not refresh (AC 8, AC 12, AC 17, AC 18, AC 20)
Proof: `cd web && npx vitest run components/billing/plan-switcher.test.ts -t "C3205:"`

### S3 - Confirming changes the plan in Stripe and in the app · 8 files · ~70 KB · ~18k

**C3206** - A plan change reads the subscription with its items expanded, makes sure the product `sa_plan_team` exists (a `200` read creates nothing, a `404` read makes one `POST /v1/products` with `id` `sa_plan_team`, `name` "Team plan", `metadata[sa_kind]` `plan` and `metadata[sa_plan]` `team`), then makes one `POST /v1/subscriptions/{id}` whose plan item is `items[0][id]` with `price_data` of `currency` `cad`, the plan's `unit_amount`, `recurring[interval]` `month` and `product` `sa_plan_team`, with `proration_behavior` `create_prorations`; the seat item is set to the new quantity when one exists and extra seats remain, deleted (`deleted=true`) when none are needed, and added on `sa_extra_seat` at `EXTRA_SEAT_CENTS` when none exists and some are needed (AC 9, AC 10, Landing door 1)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3206:"`

**C3207** - A plan change whose plan item is already on the requested plan and whose seat quantity already matches makes only the subscription read, answers ok with `changed` false, and makes no product or subscription write (AC 13, AC 14)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3207:"`

**C3208** - A plan change that cannot proceed is `unavailable` (or `unsupported` when no item is a tagged plan item), logged once with the HTTP status and Stripe's error code only and never an id, the key or a body, and makes no subscription write: the subscription read failing, the product read answering anything but `200` or `404`, the product create failing, the subscription update failing, a refused connection, a request open after 10 s (AC 5, AC 18)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3208:"`

**C3209** - The change-plan use case checks the role first (an estimator or viewer is `forbidden` with nothing read), reads the ids, plan and seats from `org_billing`, refuses a key outside `starter`, `team`, `business` as `invalid` and the org's current plan as `same_plan` with no Stripe call, computes the seat count with `seatsAfterPlanChange`, calls the gateway with that plan and the extra seats the new plan needs, then records the plan and seats; a recording failure after Stripe changed still answers ok and logs one line with the error code only; an unchanged Stripe with a differing `org_billing.plan` records it and answers ok; no row is `no_subscription`; a database error is `unavailable` with no Stripe call (AC 9, AC 11, AC 12, AC 13, AC 14, AC 15, AC 17)
Proof: `cd web && npx vitest run application/use-cases/billing-page.test.ts -t "C3209:"`

**C3210** - The change-plan Server Action redirects a signed-out visitor and a no-membership user to `/login` without calling the use case, takes one argument that must be `starter`, `team` or `business` (any other value answers the plan notice and the use case is not called), reads no form data, and maps `done`, `forbidden`, `same_plan` and every other failure to its page state with the notices "You don't have permission to change this", "You're already on this plan" and "We couldn't change your plan. Try again." (AC 15, AC 17, AC 18, AC 19)
Proof: `cd web && npx vitest run "app/\(app\)/settings/billing/actions.test.ts" -t "C3210:"`

**C3211** - Checkout tags its products: the plan line's product has `metadata[sa_kind]` `plan` and `metadata[sa_plan]` the chosen plan key, and the extra-seat line's product has `metadata[sa_kind]` `seat` (AC 16)
Proof: `cd web && npx vitest run infrastructure/stripe/checkout.test.ts -t "C3211:"`

**C3212** - The recording adapter calls `rpc("set_org_plan", { p_plan, p_seats })` once as the signed-in member and maps `42501` to `forbidden`, `P0002` to `not_found` and any other error to `unavailable`, logged once with the code (AC 11, Landing door 2)
Proof: `cd web && npx vitest run infrastructure/supabase/org-plan.test.ts -t "C3212:"`

**C3213** - The `org_billing` read gives the customer id, the subscription id, the plan and the seats, selecting only those four columns for the org on the member's own client (AC 9, `ORG_BILLING` relation; amends C3129)
Proof: `cd web && npx vitest run infrastructure/supabase/org-billing.test.ts -t "C3213:"`

### S4 - Refusals and failures are visible · 2 files · ~15 KB · ~4k

**C3214** - The container exposes the change-plan use case built on the request's one Supabase client; without `STRIPE_SECRET_KEY` or `APP_BASE_URL` it answers `not_configured` and makes no `fetch`; with both it uses the Stripe adapter (AC 19, Flow hops 3 to 5)
Proof: `cd web && npx vitest run composition/billing-page-wiring.test.ts -t "C3214:"`

### S5 - The database function is safe · 3 files · ~25 KB · ~6k

**C3215** - `public.set_org_plan(p_plan, p_seats)` as an owner or an admin of the org updates that org's `org_billing.plan` and `seats` and no other column, and leaves other orgs' rows untouched (AC 21)
Proof: `npm run test:db set_org_plan` (assertions labelled `C3215`)

**C3216** - `set_org_plan` raises `42501` for an estimator, a viewer and a non-member and changes nothing, `P0002` for an org with no `org_billing` row, and `22023` for a plan outside the three and for seats 0 and 51; `anon` has no execute privilege and `authenticated` has it; `org_billing` still has no update grant for `authenticated` (AC 22, AC 23, Landing door 2)
Proof: `npm run test:db set_org_plan` (assertions labelled `C3216`)

### S6 - The plan list works on every size · live

**C3217** - Against the Stripe sandbox with the migration applied, `/settings/billing` at 375, 768 and 1440 px lists the three plans with the current one marked, switching Starter to Team and back shows the prompt, charges nothing during the trial, changes the subscription and `org_billing.plan`, has no horizontal scroll, controls of at least 44 by 44 px on mobile and tablet, a touch tap on Switch, Confirm switch and Keep my plan responding, and no console error (AC 24, S1 to S3 independent tests)
Proof: live Playwright MCP run per AGENTS.md (author-run, nothing committed); the report lists pages, sizes, touch actions and fixes

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plans (3) | starter C3202 · team C3202 · business C3202 | - |
| plan switch pairs (6) | starter to team C3200 · starter to business C3200 · team to starter C3200 · team to business C3200 · business to starter C3200 · business to team C3200 | - |
| seat outcomes on a switch (3) | moves to the new included count C3200 · stays above the new minimum C3200 · raised to the new minimum C3200 | - |
| plan list states (4) | listing with switch controls C3202 · set to end C3203 · canceled C3203 · plan unknown C3203 | - |
| `GET /settings/billing` changed response (1) | 200 with the plan list C3202 C3203 (the 303 statuses are unchanged and proved by billing-page) | - |
| `changePlanAction` statuses (2) | 200 with a page state C3210 · 303 /login C3210 | - |
| `changePlanAction` states (5) | done C3210 · forbidden C3210 · same_plan C3210 · invalid key C3210 · other failure C3210 | - |
| use-case outcomes (8) | ok C3209 · forbidden C3209 · invalid C3209 · same_plan C3209 · no_subscription C3209 · unavailable C3209 · not_configured C3209 · recorded after unchanged Stripe C3209 | - |
| Stripe `GET /v1/products/{id}` statuses (3) | 200 creates nothing C3206 · 404 creates the product C3206 · any other answer is unavailable C3208 | - |
| Stripe reads in a change (3) | subscription C3206 · product sa_plan_team C3206 · product exists vs 404 C3206 | - |
| Stripe writes in a change (3) | product create C3206 · subscription plan item C3206 · subscription seat item C3206 | - |
| seat item cases (3) | updated quantity C3206 · deleted C3206 · added on sa_extra_seat C3206 | - |
| no-op case (1) | already on the plan with matching seats C3207 | - |
| Stripe failures that make a change unavailable (6) | subscription read C3208 · product read non-200/404 C3208 · product create C3208 · subscription update C3208 · refused connection C3208 · 10 s timeout C3208 | - |
| unsupported (1) | no tagged plan item C3208 | - |
| subscription update keys (6) | items[0][id] C3206 · price_data currency C3206 · unit_amount C3206 · recurring interval C3206 · product C3206 · proration_behavior C3206 | - |
| product metadata keys (2) | sa_kind C3206 C3211 · sa_plan C3206 C3211 | - |
| `set_org_plan` statuses (4) | 200 C3215 · 42501 C3216 · P0002 C3216 · 22023 C3216 | - |
| `set_org_plan` refusals (6) | estimator C3216 · viewer C3216 · non-member C3216 · plan outside the three C3216 · seats 0 C3216 · seats 51 C3216 | - |
| `set_org_plan` privileges (3) | anon no execute C3216 · authenticated execute C3216 · no update grant on org_billing C3216 | - |
| columns changed by `set_org_plan` (2) | plan C3215 · seats C3215 | - |
| `org_billing` columns read (4) | stripe_customer_id C3213 · stripe_subscription_id C3213 · plan C3213 · seats C3213 | - |
| `org_billing` entity relation (1) | read C3213 · written only through the function C3216 | - |
| roles (4) | owner C3209 C3215 · admin C3209 C3215 · estimator C3209 C3216 · viewer C3209 C3216 | - |
| no-session cases (2) | signed out C3210 · no membership C3210 | - |
| switcher interactions (6) | open prompt C3205 · keep C3205 · confirm once C3205 · pending C3205 · notices C3205 · refresh after success C3205 | - |
| prompt lines (4) | plan and price C3204 · seat line C3204 · trial line C3204 · prorated line C3204 | - |
| Checkout product tags (3) | plan line kind C3211 · plan line key C3211 · seat line kind C3211 | - |
| Landing door 1: Stripe objects (2) | deterministic products C3206 · item identification C3201 | - |
| Landing door 2: database function (2) | definer function and checks C3215 C3216 · adapter C3212 | - |
| Landing door 3: effective immediately, prorated (1) | `create_prorations` C3206 | - |
| startup config: container assembly (1) | `getContainer` with `STRIPE_SECRET_KEY`, `APP_BASE_URL` C3214 | - |

- Claims naming a status code, route or response shape: C3206, C3208, C3210, C3212, C3215, C3216 - each has a proof that crosses the boundary at its own layer; the redirects are asserted through the mocked `redirect`, the database statuses in the rolled-back SQL recipe
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (domain, use case) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (page, Server Action) | one at the boundary | accepted input, each rejected input, each error path |
| Adapter (Supabase, Stripe) | one against the client or `fetch` double | request keys, filters and each error reply |
| Client island with behaviour | one in a browser DOM | each click, pending and notice state the plan names |
| Presentational component | one markup test per state | each state the plan names |
| Database function | one rolled-back SQL recipe | each role, each refusal and the privileges |

Evidence:

- `domain/billing/plan-change.ts` (new): the seat and total summary over six pairs and three seat outcomes -> decides
- `application/use-cases/billing-page.ts` (changed): the change-plan path has eight outcomes and three early refusals -> decides
- `infrastructure/stripe/billing-gateway.ts` (changed): a plan change has a read, a product check, a create, an update and three seat cases (about 20 more branch points) -> adapter
- `infrastructure/supabase/org-plan.ts` (new): one rpc, three error mappings -> adapter
- `components/billing/plan-switcher.tsx` (new): open, keep, confirm, pending, notices, refresh -> client island with behaviour, proved with jsdom as `subscription-controls.test.ts` is (C3140)
- closest analogues: `billing-gateway.test.ts` (C3105 to C3142), `subscription-controls.test.ts` (C3140), and `supabase/tests/first_login_setup.sql`, same shapes, already proven at these levels

Cost: 7 test files at their own layer plus one SQL recipe.

## Swept

- validation: C3210 (the plan key is one of three), C3216 (plan and seats bounds in the database), C3209 (the same checks again behind the action), C3201 (an unknown `sa_plan` is not guessed)
- failure modes: C3208 (every Stripe failure leaves the subscription unwritten), C3209 (a recording failure after Stripe changed is logged and the page still shows the new plan), C3205 (the notices)
- idempotency: C3207 (a repeat makes no write), C3209 (an unchanged Stripe with a differing record is healed, the same plan is refused), C3205 (one press, one call)
- authorization: C3209, C3210, C3216; RLS `org_billing_select` and the absence of any update grant (workspace-provisioning door 1) are the database rules, and C3216 proves the function is the only writer and checks the role itself
- concurrency: n/a - two owners switching at once both end with the last write at Stripe and the function writing the same final values; no proof drives an interleaving. A parallel Stripe update is handled by Stripe's own item ids
- data lifecycle: n/a - nothing new is stored; the function updates two existing columns, and a `canceled` subscription shows no plan list (C3203)
- dependency failure: C3208 (Stripe down, slow or refusing), C3214 (not configured), C3209 (the database function failing)
- state transitions: C3203 (what each subscription state offers), C3206 and C3207 (plan A to plan B, and B to B is a no-op), C3200 (seat outcomes)
- observability: C3208 and C3209 and C3212 (one log line with status or code only, never ids, key or body), as the rest of billing does

## Out of scope

See the plan's table: seat changes by themselves, scheduling or an exact proration preview, annual billing and other currencies, plan-limit enforcement on a downgrade, applying subscription events from the webhook, legacy subscriptions, changing prices.

## Handoff

- S1 = 12k, S2 = 6k, S3 = 18k, S4 = 4k, S5 = 6k, S6 = live: 46k total, one surface (web plus one migration), under the 150k budget - one builder
- Mechanism: one builder
