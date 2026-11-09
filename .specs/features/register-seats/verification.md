# Register details and seats verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 925cb5e..HEAD
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Verified at HEAD 0794d0f. The real tree's `git status --porcelain` was empty before and after (identical). Fault injection ran in a scratch copy of `web/` outside the repo (`node_modules` junctioned, no `git stash`, no worktree).

## Checks

Proof run for every row except C2619, C2621 and C2622 detail: one batched `npx vitest run` from `web/` over the 10 feature files (`--reporter=verbose`) - 10 files, 228 passed, 0 failed. Every named test appeared individually as passed and was located with `rg -n`. Also `npx tsc --noEmit` exit 0 and `npx eslint` over the touched directories exit 0.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2600 | form field order, names, types, autocomplete | batched vitest, `C2600:` passed | `app/register/register.test.ts:112-115` - `order = ["email","company","phone","trade","plan","seats"].map(indexOf name=)`, sorted equals order, `html.indexOf("<button") > order[5]`; `:116-121` type/autoComplete attrs | PASS |
| C2601 | email refused (6) and 254 accepted | batched vitest, 7 `C2601:` passed | `domain/billing/index.test.ts:91-92` - `expect(fieldsOf({ email })).toEqual({ email: true })` over `"", 255 chars, a, a@b, "a b@c.d", "a@b c.d"`; `:95-98` 254 chars `accepts` true | PASS |
| C2602 | company refused (3) and 120 accepted | batched vitest, 4 passed | `index.test.ts:103-104` `toEqual({ company: true })` for empty, spaces, 121; `:107-108` 120 accepted | PASS |
| C2603 | phone refused (4), accepted (4) | batched vitest, 8 passed | `index.test.ts:113-119` 6 chars, 21 chars, `555-CALL-NOW`, `604 555 0199 ext 4` -> `{ phone: true }`; `:122-128` four accepted incl. `+1 (604) 555.0199`, 7 and 20 chars | PASS |
| C2604 | email trimmed+lowercased, company/phone collapsed | batched vitest, passed | `application/use-cases/start-trial.test.ts:102` - `toHaveBeenCalledWith({ ..., seats: 7, email: "owner@shop.ca", company: "A B Co", phone: "+1 604 555 0199" })` | PASS |
| C2605 | starter never called, every failed field named | batched vitest, 6 `C2605:` passed | `start-trial.test.ts:112-114` `toEqual({ status: "invalid_details", fields })` + `expect(start).not.toHaveBeenCalled()` over email, company, phone, seats and `email+phone` together (`fields: { email: true, phone: true }`); `:117-119` no_trade plus bad email -> `{ status: "no_trade", fields: { email: true } }` | PASS |
| C2606 | message under own field, role=alert, aria-invalid only that field, values kept | batched vitest, 4+1 in register.test + 1 in action test passed | `register.test.ts:134` `expect(alerts).toEqual([message])` (the only alert), `:136` `aria-invalid` present iff `name === field`, `:138` message after its own field; `:143-148` values, trades, plan kept; `register-action.test.ts:82-96` `toEqual({ status: "invalid_details", ..., fields: { email: true, phone: true } })`. Precision note: "directly under" is asserted as "after its own field" only (`:138`), not "before the next field" | PASS |
| C2607 | no email/company/phone in any log line | batched vitest, 2 use-case + 7 adapter passed | `start-trial.test.ts:132` `expect(logged).not.toContain(secret)` for `secret.owner`, `shop.ca`, `Secret Plumbing`, `604-555-0188` (starter unavailable and throws, plus a refusal); `checkout.test.ts:213` same over the 7 FAILURES (400, 401, 429, 500, 200 no url, reject, timeout). Code: `rg console\.` shows 5 `console.error` calls, none interpolating a selection field (`checkout.ts:93,96`, `start-trial.ts:33,38,42`); the action has none | PASS |
| C2608 | included 2/5/10, 1500 cents, ceiling 50 | batched vitest, passed | `index.test.ts:134-136` - `toEqual([["starter",2],["team",5],["business",10]])`, `EXTRA_SEAT_CENTS toBe(1500)`, `MAX_SEATS toBe(50)` | PASS |
| C2609 | per plan 6 refused, 3 accepted | batched vitest, 3 plans + normalised case passed | `index.test.ts:146-148` refused `[included-1,"0","","abc","2.5","51"]` -> `toEqual({ seats: true })`, accepted `[included,"50","20"]`; `:152-155` seats returned as number 8 | PASS |
| C2610 | seat field starts/min/max, no total at included | batched vitest, 3 plans passed | `register.test.ts:158-161` `value="${included}"`, `min="${included}"`, `max="50"`, `not.toMatch(/extra seats? x/)` | PASS |
| C2611 | totals $144 / $64 / $799 | batched vitest, 3 passed | `register.test.ts:170` `expect(textOf(html)).toContain("$99 + 3 extra seats x $15 = $144")` (and the two other literals in the table `:165-167`) | PASS |
| C2612 | plan-change rule, 6 cases | batched vitest, 6 passed | `index.test.ts:158-166` table 2->Team 5, 5->Business 10, 10->Starter 2, 8->8, 20->20, 3->Business 10 with `toBe(expected)` | PASS |
| C2613 | one line item at included count, 3 plans | batched vitest, 3 passed | `checkout.test.ts:177-178` `[...form().keys()].filter(startsWith("line_items[1]"))).toEqual([])` at `seats: included` | PASS |
| C2614 | second line "Extra seat", 1500 cad month, qty = seats - included | batched vitest, 6 passed | `checkout.test.ts:186-190` name `"Extra seat"`, currency `"cad"`, unit_amount `"1500"`, interval `"month"`, quantity `String(seats - included)` over included+1 and 50 | PASS |
| C2615 | customer_email and 3 metadata keys on both metadata objects | batched vitest, passed | `checkout.test.ts:197-203` `customer_email` `"owner@shop.ca"`; for `metadata` and `subscription_data[metadata]`: `[seats]` "8", `[company]` "Shop Ltd", `[phone]` "+1 604 555 0199", `[plan]` "team". `trades` is not re-asserted here (C2503 asserts it, unchanged) | PASS |
| C2616 | no "Unlimited seats" in 4 sources; pricing shows 2/5/10 in order and "Extra seats $15 a month"; FAQ has "$15 a month" | batched vitest, 3 passed | `app/pricing/pricing.test.ts:95-98` order of `"2 seats included"`, `"5 ..."`, `"10 ..."` and `toContain("Extra seats $15 a month")`; `:104-108` the four source files lack "unlimited seats" and "seats are never charged"; `components/site/site-pages.test.ts:71` `toContain("$15 a month")`. Passes the claim as written; the plan's AC 14 asks for more on the home page, see Coverage | PASS |
| C2617 | unavailable / not_configured keep values, trades, plan | batched vitest, 2 passed | `register.test.ts:175-180` email, company, phone, seats `value=` attrs; checked radio equals `["starter"]`, checked boxes equal `["hvac","other"]` | PASS |
| C2618 | pending: disabled and "Starting…" | batched vitest, passed | `register.test.ts:185-186` `button[1]` matches `\sdisabled=""`, `decode(button[2])` `toBe("Starting…")` | PASS |
| C2619 | live: 375/768/1440 no scroll, 44 px, plan change moves seats, Stripe page with extra seat | not re-observable by the Verifier; rests on the orchestrator's live Playwright run | Orchestrator reports: no horizontal scroll at the three widths, controls >= 44 px, Starter->Team 2->5, Business 8 raised to 10, Business 10 -> Team 5, text "$99 + 3 extra seats x $15 = $144", valid Team/8 submit reached Stripe test Checkout showing "Team plan and 1 more", CA$144.00 per month, email prefilled lowercased. CA$144 = 99 + 3 x 15 and "and 1 more" is the second line, so the report is consistent with quantity 3; the literal "Extra seat x 3" row was not quoted. The rule behind the plan-change observations is also proven at its layer by C2612 (`index.test.ts:166`) and the 44 px source rule by C2620 | PASS |
| C2620 | TextInput fields, min-h-11 choices, no fixed px width | batched vitest, passed | `register.test.ts:191` `(code.match(/<TextInput\b/g)).length toBe(4)`, `:192` `toContain("min-h-11")`, `:193` no `w-[Npx]`, `:195` text-input has `h-11`. The `min-h-11` check is a substring over the file, so it does not prove each radio label carries it; the live run covers that | PASS |
| C2621 | seam widened; four `@ts-expect-error` guard | batched vitest + `npx tsc --noEmit` exit 0 | `application/ports/checkout-starter.types.test.ts:24,26,28,30` `@ts-expect-error` for missing seats, email, company, phone; `:35` fake accepts `{ plan, trades, ...FULL }`. Code: `domain/billing/index.ts:50-58` all six fields required | PASS |
| C2622 | repo docs consistent | batched vitest, passed | `app/billing-docs.test.ts:32-33` ROADMAP header "Seats included" and rows `\| Starter \| $49 \| 15 \| 10 \| 2 \|` etc.; `:36-37` decisions 10 and 20 text; `:41-42` CONTEXT names `register-seats` with 2026-11-09; `:45` exactly one active AD row containing `EXTRA_SEAT_CENTS`, `customer_email`, `metadata`, `seats`; `:47` PRODUCT.md lacks "unlimited seats" (the check says "no longer says seats are free"; only that phrase is asserted) | PASS |
| C2623 | getBillingContainer with six-field selection: one request + redirect; unset -> not_configured, no request | batched vitest, 5 passed | `composition/billing-container.stripe.test.ts:42-43` `toEqual({ status: "not_configured" })`, `fetchMock not.toHaveBeenCalled()`; `:50-51` `redirect` and `toHaveBeenCalledTimes(1)`. Assembly read: `composition/index.ts:294-295` reads only `STRIPE_SECRET_KEY` and `APP_BASE_URL`; `composition/index.ts` is not in the diff, so no new variable | PASS |

Superseded approved checks (checks.md "How proofs run"): `git diff 925cb5e..HEAD` on `register-action.test.ts`, `start-trial.test.ts`, `checkout-starter.types.test.ts`, `checkout.test.ts`, `billing-container*.test.ts` and `pricing.test.ts` shows every old assertion kept and only the selection/state shape widened. Two notes: `register-action.test.ts:69` the thrown-starter case moved from `toEqual({status,trades})` to `toMatchObject({status,trades})` (same expected object, now tolerant of the added `values`/`fields`; the sibling unavailable case at `:60-66` asserts the full shape with `toEqual`); `checkout.test.ts` C2501-C2504 now run with the helper default of 10 seats, so Starter/Team/Business requests there carry a second line, but C2501 only reads `line_items[0]`, so the claim holds. No assertion was removed.

## Coverage

Recomputed from `PLANS` and the parser/adapter code (`domain/billing/index.ts:97-138`, `infrastructure/stripe/checkout.ts:37-73`), the form code (`register-fields.tsx`), the plan's Surface/Landing/Criteria, and the sources for the copy.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plans (3) | `PLANS` in code | starter/team/business -> C2608, C2609 (`index.test.ts:139-149`), C2610 (`register.test.ts:151-155`), C2613, C2614 (`checkout.test.ts:168-190`) | - |
| email branches (empty, >254, shape) (3 code conditions, 7 cases) | `index.ts:105` | 6 refused + 254 accepted -> C2601 | - |
| company branches (empty, >120) (2, 4 cases) | `index.ts:107` | C2602 | - |
| phone branches (<7, >20, charset) (3, 8 cases) | `index.ts:109` | C2603 | - |
| seat branches (non-integer, < included, > 50) (3, 9 cases per plan) | `index.ts:110-112` | C2609 | - |
| field errors (4) | `FieldErrors` type | email, company, phone, seats -> C2605, C2606 | - |
| outcomes of the parser (4: ok, no_trade, invalid_choice, invalid_details) | `SelectionResult` | `invalid_details` C2605/C2606, `no_trade` + field C2605 (`start-trial.test.ts:117`), `invalid_choice` and `no_trade` keep fields `{}` (existing C2411-style cases, `start-trial.test.ts` diff) | - |
| plan-change moves (6) | `seatsAfterPlanChange` (`index.ts:129-133`: equals-old, max) | 6 cases -> C2612 | - |
| line-item count (2) | `checkout.ts:54` | one -> C2613, two -> C2614 | - |
| extra-seat line fields (5 + absent key) | `checkout.ts:55-59` | C2614 (5 fields), C2613 (absent) | - |
| session fields added (7) | `checkout.ts:40,63,68,70` | `customer_email`, 3 x `metadata`, 3 x `subscription_data[metadata]` -> C2615 | - |
| Stripe failure causes (7) | `checkout.ts:91-97` and `FAILURES` | C2607 adapter | - |
| form states (6) | `PricingState` in `state.ts:9` | idle C2600/C2610; `no_trade`, `invalid_choice` (existing register.test cases, `REFUSALS` in `register-fields.tsx:8-13`); `invalid_details` C2606; `not_configured`/`unavailable` C2617 | - |
| `GET /register` statuses (1) | Surface | `200` -> C2600 | - |
| `POST /register` statuses (2) | Surface | `303` -> redirect case in `register-action.test.ts` (`NEXT_REDIRECT`) and C2623; `200` -> C2606, C2617 | - |
| doors (3) | Landing | 1 -> C2613/C2614 (all literal fields match `checkout.ts:54-59`); 2 -> C2615; 3 -> C2621 | - |
| startup config (1) | `composition/index.ts:294-295` | C2623 | - |
| public copy: AC 14 absence in 4 places (4) | plan AC 14 | pricing page, `content.ts`, `sections.tsx`, `home-concepts.tsx` -> C2616 (`pricing.test.ts:104-108`) | - |
| public copy: AC 14 presence "<n> seats included" and "Extra seats $15 a month" on the 3 surfaces (3 surfaces) | plan AC 14, Observable row "document copy" | pricing page -> C2616 (`pricing.test.ts:95-98`); FAQ -> C2616 (`site-pages.test.ts:71-74`, "$15 a month", "Starter 2"...); **home page** -> no proof. The code: `sections.tsx:94` renders "N seats included" in `PlansTeaser`, but "Extra seats $15 a month" is nowhere on the home page: `home-concepts.tsx:82` says "a small fee for each extra seat" with no figure, and `FAQ_PREVIEW` (`home-concepts.tsx:15`) leaves out "Do you charge per seat?". No test renders the home page's seat copy | home page presence of "<n> seats included" (code yes, unproven) and of "Extra seats $15 a month" (contradicted by the code) |
| interactive plan change in a browser (AC 11) | plan AC 11 | live only, C2619 (rests on the orchestrator) plus rule at C2612; no component-level test of `pickPlan` in `register-fields.tsx:69-72` | - (checks.md declares this) |

## Test policy rows

No new rows (checks.md: "the repo answers the two questions ... so no new rows"). The Evidence lines were judged:

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `parseCheckoutSelection` decides, one asserted case per row (C2601-C2603, C2609) | `domain/billing/index.ts` | one case per branch in own layer | yes - every branch of `index.ts:105,107,109,112` has a refused and an accepted case |
| `checkout.ts` decides line-item count, metadata, email (C2613-C2615) | `infrastructure/stripe/checkout.ts` | request body at the Stripe boundary | yes - body parsed from the fake `fetch` |
| `register-fields.tsx` decides state-to-message mapping and seat total (C2606, C2610, C2611, C2617) | `app/register/register-fields.tsx` | rendered output per state | yes - rendered HTML asserted per state; the `pickPlan` handler is covered only by the live run |
| closest analogue | pricing-page and billing-checkout suites | already proven at this level | yes |

## Faults injected

Scratch copy of `web/` outside the repo; each mutant was reverted and the scratch diffed back to the real tree (`diff -r` clean).

| Mutation | Location | Killed |
| --- | --- | --- |
| line-item count `extraSeats > 0` -> `extraSeats > 1` | `infrastructure/stripe/checkout.ts:54` | yes - C2614 (3 of the 6 cases, `included + 1` seats) |
| metadata key `phone` -> `telephone` | `infrastructure/stripe/checkout.ts:40` | yes - C2615 (`expected null to be '+1 604 555 0199'`) |
| seat ceiling `MAX_SEATS = 50` -> `51` | `domain/billing/index.ts:30` | yes - C2608 and the three C2609 plan cases |
| email lowercasing removed | `domain/billing/index.ts:104` | yes - C2604 (`toHaveBeenCalledWith` mismatch) |
| plan-change rule `Math.max(seats, after)` -> `seats` | `domain/billing/index.ts:132` | yes - C2612 `starter to business with 3 seats gives 10` (`expected 3 to be 10`) |

Five is the cap; the form surface (`register-fields.tsx`) was not mutated, so C2606/C2610/C2611 are judged by reading only.

## Findings

Ranked gaps behind the FAIL verdict:

1. AC 14 on the home page is contradicted by the code and has no check. The plan says the home page SHALL state "Extra seats $15 a month" per plan "<n> seats included"; `home-concepts.tsx:82` gives no figure and `FAQ_PREVIEW` omits the seat answer, and no test renders the home page's seat copy (C2616 proves only absence there). Fix either the copy (add "Extra seats $15 a month" to `PlansTeaser`) and add a check, or amend AC 14 with the owner's approval.

Non-blocking observations:

- Seats `"08"` is accepted and sent as 8, and `" 5 "` as 5 (`index.ts:111` trims and accepts 1-3 digits); the number input cannot produce the second, the first is harmless, neither is tested.
- Phone and company length are measured after inner-whitespace collapse (`index.ts:106,108`), where AC 3 and 4 say "after trimming". A 22-character phone with a double space is accepted. No check pins either reading.
- C2606 asserts a field message appears after its own field, not before the next one.
- C2619 rests on the orchestrator's run; the Stripe page was reported as "Team plan and 1 more" and CA$144.00, which fits Team with 8 seats but does not quote the extra-seat quantity.

## Gate

`npx vitest run` over the 10 feature files from `web/` - 228 passed, 0 failed; `npx tsc --noEmit` exit 0; `npx eslint` (touched directories) exit 0
