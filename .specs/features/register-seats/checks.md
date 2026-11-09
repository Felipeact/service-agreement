# Register details and seats checks

Profile: standard
Plan: `.specs/features/register-seats/plan.md`

24 checks in 3 slices · 3 one-way doors (all approved) · 2 open, of which 1 blocks go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C2600:`). This feature numbers from C2600 (no id above C2536 exists). `npx vitest run <file> -t "C2600:"` selects one.
- Expected values (seats 2, 5, 10, the 1500 cents, the ceiling 50, message texts, field names) are written out in each test from the plan, never read back from `PLANS` or the code, except where a check says the test is table-driven over `PLANS`.
- No proof calls Stripe. The adapter is proven against a fake `fetch`; the live Stripe page and the three screen sizes are an author-side run with the Playwright MCP tools (C2619), reported in the verification and not committed.
- **Approved checks this feature supersedes**, with the owner's approval of the plan on 2026-11-09 (Impact row "tests"): pricing-page C2404 (the text "Unlimited seats"), and the state, outcome and selection shapes asserted by C2411 to C2423 and C2426 in `register.test.ts`, `register-action.test.ts`, `start-trial.test.ts` and `checkout-starter.types.test.ts`, billing-checkout C2501 to C2504, C2507 and C2512 (a selection now carries six fields). Each changed test keeps its claim and gains the new fields; the build report lists every one. No assertion is removed or loosened.

## Checks

### S1 - The form asks who is buying · 9 files · 45 KB · ~12k

**C2600** - `GET /register` renders, in this order, a "Work email" input (`type="email"`, `name="email"`, `autocomplete="email"`), a "Company name" input (`name="company"`, `autocomplete="organization"`), a "Phone" input (`type="tel"`, `name="phone"`, `autocomplete="tel"`), the trades, the plan radios, a "Team members" number input (`name="seats"`) and the submit button (plan AC 1)
Proof: `npx vitest run app/register/register.test.ts -t "C2600:"`

**C2601** - `parseCheckoutSelection` refuses the email `""`, 255 characters, `a`, `a@b`, `a b@c.d` and `a@b c.d` with the field error `email`, and accepts a 254-character address (plan AC 2)
Proof: `npx vitest run domain/billing/index.test.ts -t "C2601:"` (6 refused, 1 accepted)

**C2602** - It refuses the company `""`, `"   "` and 121 characters with the field error `company`, and accepts 120 characters (AC 3)
Proof: `npx vitest run domain/billing/index.test.ts -t "C2602:"` (3 refused, 1 accepted)

**C2603** - It refuses the phone of 6 characters, of 21 characters, `555-CALL-NOW` and `604 555 0199 ext 4` with the field error `phone`, and accepts `604-555-0199`, `+1 (604) 555.0199`, a 7-character and a 20-character number (AC 4)
Proof: `npx vitest run domain/billing/index.test.ts -t "C2603:"` (4 refused, 4 accepted)

**C2604** - A valid form gives the starter the email trimmed and lowercased (`"  Owner@Shop.CA "` -> `owner@shop.ca`), and the company and phone trimmed with each run of whitespace collapsed to one space (`"  A   B  Co "` -> `A B Co`) (AC 6)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C2604:"`

**C2605** - For each of the invalid email, company, phone and seats cases above, the starter is never called, and the outcome names every field that failed, so an invalid email together with an invalid phone reports both (AC 2, 3, 4, 10)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C2605:"` (4 single-field cases and 1 case with two fields)

**C2606** - The form after a refusal shows "Enter a work email we can reach you on.", "Enter your company name.", "Enter a phone number with area code." and "Choose between 2 and 50 team members." (for Starter) each directly under its own field in an element with `role="alert"`, sets `aria-invalid` on that field only, and keeps every value the visitor typed, the ticked trades and the chosen plan (AC 5)
Proof: `npx vitest run app/register/register.test.ts -t "C2606:"` (4 fields)

**C2607** - No log line written by the action, the use case or the Stripe adapter on a refusal or a failure contains the email, the company name or the phone number of the submission (AC 7, AC 15)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C2607:"`
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2607:"` (the 7 failure causes)

### S2 - Seats and the price · 8 files · 40 KB · ~10k

**C2608** - `PLANS` gives Starter 2, Team 5 and Business 10 included seats, `EXTRA_SEAT_CENTS` is 1500, and the seat ceiling is 50 (AC 8)
Proof: `npx vitest run domain/billing/index.test.ts -t "C2608:"`

**C2609** - For each plan, the seat values below the plan's included seats, `0`, `""`, `abc`, `2.5` and `51` are refused with the field error `seats`, and the included seats, 50 and one in between are accepted (AC 10)
Proof: `npx vitest run domain/billing/index.test.ts -t "C2609:"` (3 plans, 6 refused and 3 accepted each)

**C2610** - The form's seat field starts at the chosen plan's included seats (2, 5, 10), has `min` equal to them and `max` 50, and shows no total when the count equals the included seats (AC 9)
Proof: `npx vitest run app/register/register.test.ts -t "C2610:"` (3 plans)

**C2611** - For Team with 8 seats the form shows "$99 + 3 extra seats x $15 = $144", for Starter with 3 "$49 + 1 extra seat x $15 = $64", and for Business with 50 "$199 + 40 extra seats x $15 = $799" (AC 9)
Proof: `npx vitest run app/register/register.test.ts -t "C2611:"` (3 cases)

**C2612** - `seatsAfterPlanChange(oldPlan, newPlan, seats)` moves a seat count equal to the old plan's included seats to the new plan's, keeps a higher count that is valid for the new plan, and raises a count below the new plan's included seats to it: Starter 2 to Team gives 5, Team 5 to Business gives 10, Business 10 to Starter gives 2, Starter 8 to Team gives 8, Business 20 to Starter gives 20, Starter 3 to Business gives 10 (AC 11)
Proof: `npx vitest run domain/billing/index.test.ts -t "C2612:"` (6 cases)

**C2613** - With seats equal to the plan's included seats, for each of the three plans, the Checkout body has the `line_items[0]` fields and no `line_items[1]` key (AC 12)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2613:"` (3 plans)

**C2614** - With seats above the included seats (included + 1, and 50), for each plan, the body has `line_items[1][price_data][product_data][name]` "Extra seat", `[currency]` `cad`, `[unit_amount]` 1500, `[recurring][interval]` `month` and `line_items[1][quantity]` equal to `seats - included` (AC 12, door 1)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2614:"` (3 plans x 2 counts)

**C2615** - The body has `customer_email` equal to the normalised email, and `metadata[seats]`, `metadata[company]`, `metadata[phone]` and the same three under `subscription_data[metadata]` equal to the total seats, the company and the phone, beside `plan` and `trades` (AC 13, door 2)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2615:"`

**C2616** - The `/pricing` page, `components/site/content.ts`, `components/site/sections.tsx` and `components/site/home-concepts.tsx` contain none of "Unlimited seats", "unlimited seats" and "seats are never charged"; `/pricing` shows "2 seats included", "5 seats included" and "10 seats included" in the plans' order and "Extra seats $15 a month"; and the FAQ answer to "Do you charge per seat?" contains "$15 a month" (AC 14)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2616:"`
Proof: `npx vitest run components/site/site-pages.test.ts -t "C2616:"`

### S3 - Failure and the screen · 3 files · 8 KB · ~3k

**C2617** - After the starter answers `unavailable` or `not_configured`, the form shows the existing message and every typed value, the trades and the plan are kept (AC 15)
Proof: `npx vitest run app/register/register.test.ts -t "C2617:"` (2 states)

**C2618** - While a submit is pending the button is disabled and reads "Starting…" (AC 16)
Proof: `npx vitest run app/register/register.test.ts -t "C2618:"`

**C2619** - Live, in the Playwright browser: `/register` at 375, 768 and 1440 px shows no horizontal scroll; at 375 and 768 every input, radio label and the button measures at least 44 px high; changing the plan moves the seat field and the total as C2612 says; a valid submit against the test key reaches a Stripe test page showing the plan and, for Team with 8 seats, an "Extra seat" line with quantity 3 (AC 9, 11, 17). Author-side run, nothing committed
Proof: live run with the Playwright MCP tools (`browser_resize`, `browser_snapshot`, in-page measurement of `scrollWidth` and each control's bounding box, `browser_navigate` through the redirect). Reported in the verification, not committed

**C2620** - The page's fields are `TextInput` components (44 px below `lg`), the number field and the radios sit in controls of at least `min-h-11`, and the page sets no fixed pixel width (AC 17, source contract)
Proof: `npx vitest run app/register/register.test.ts -t "C2620:"`

**C2621** - The seam is widened as door 3 says: a fake `CheckoutStarter` typed with `{ plan, trades, seats, email, company, phone }` compiles, and one missing `seats`, `email`, `company` or `phone` fails with `@ts-expect-error` standing guard (door 3)
Proof: `npx vitest run application/ports/checkout-starter.types.test.ts -t "C2621:"`

**C2622** - The repo is consistent: `ROADMAP.md`'s pricing table has a Seats column showing 2, 5 and 10 included and the text "$15", decisions 10 and 20 say seats are charged beyond the included ones, `CONTEXT.md` names `register-seats` in its billing entry and Build log with 2026-11-09, `.specs/STATE.md` holds one active decision naming `EXTRA_SEAT_CENTS`, `customer_email` and `metadata[seats]` (extends AD-169), and `PRODUCT.md` no longer says seats are free
Proof: `npx vitest run app/billing-docs.test.ts -t "C2622:"`

**C2623** - `getBillingContainer` with the key and base url set sends a full six-field selection to Stripe once and redirects, and with either unset answers `not_configured` with no request, so no new configuration exists (startup config)
Proof: `npx vitest run composition/billing-container.stripe.test.ts -t "C2623:"` (the existing five cases, now with a six-field selection)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plans (3) | `starter` C2608, C2609, C2610, C2613, C2614 · `team` C2608, C2609, C2610, C2613, C2614 · `business` C2608, C2609, C2610, C2613, C2614 | - |
| invalid emails (6) and the edge (1) | `""` C2601 · 255 characters C2601 · `a` C2601 · `a@b` C2601 · `a b@c.d` C2601 · `a@b c.d` C2601 · 254 accepted C2601 | - |
| company cases (4) | `""` C2602 · spaces only C2602 · 121 C2602 · 120 accepted C2602 | - |
| phone cases (8) | 6 characters C2603 · 21 characters C2603 · letters C2603 · extension text C2603 · `604-555-0199` C2603 · `+1 (604) 555.0199` C2603 · 7 accepted C2603 · 20 accepted C2603 | - |
| seat cases per plan (9) | below included C2609 · `0` C2609 · `""` C2609 · `abc` C2609 · `2.5` C2609 · `51` C2609 · included accepted C2609 · 50 accepted C2609 · in between accepted C2609 | - |
| field errors reported (4) | `email` C2605, C2606 · `company` C2605, C2606 · `phone` C2605, C2606 · `seats` C2605, C2606 | - |
| plan-change moves (6) | 2 to Team C2612 · 5 to Business C2612 · 10 to Starter C2612 · 8 to Team C2612 · 20 to Starter C2612 · 3 to Business C2612 | - |
| line-item count (2) | one item C2613 · two items C2614 | - |
| extra-seat line fields (6) | name C2614 · currency C2614 · unit amount C2614 · interval C2614 · quantity C2614 · no `line_items[1]` at the included count C2613 | - |
| session fields added (7) | `customer_email` C2615 · `metadata[seats]` C2615 · `metadata[company]` C2615 · `metadata[phone]` C2615 · `subscription_data[metadata][seats]` C2615 · `subscription_data[metadata][company]` C2615 · `subscription_data[metadata][phone]` C2615 | - |
| Stripe failure causes (7) | `400` C2607 · `401` C2607 · `429` C2607 · `500` C2607 · no url C2607 · fetch rejects C2607 · timeout C2607 | - |
| form states (6) | idle C2600, C2610 · `no_trade` C2606 · `invalid_choice` C2606 · `invalid_details` C2606 · `not_configured` C2617 · `unavailable` C2617 | - |
| `GET /register` statuses (1) | `200` C2600 | - |
| `POST /register` statuses (2) | `303` C2615 with the existing redirect proofs · `200` C2606, C2617 | - |
| copy places free of "unlimited seats" (4) | pricing page C2616 · `content.ts` C2616 · `sections.tsx` C2616 · `home-concepts.tsx` C2616 | - |
| doors (3) | 1 line items C2613, C2614 · 2 metadata and email C2615 · 3 seam C2621 | - |
| startup config (1 assembly) | `getBillingContainer` C2623 (no new variable; the same two) | - |

- Claims naming a status code, route or response shape: C2600, C2606, C2615, C2617 - each has a proof that crosses the boundary it names (the rendered form, the Stripe request)
- C2619 and the interactive half of AC 11 (a plan radio changing the field in a browser) are proven live only; C2612 proves the rule at its own layer
- No other check claims more than the single case its proof exercises

## Test policy

The repo answers the two questions for the layers this touches (the pricing-page and billing-checkout test policy rows, the DocuSeal adapter and the Server Action tests), so no new rows. The decision tables are named so the Coverage join can hold them:

Evidence:

- `domain/billing` `parseCheckoutSelection`: decides over 2 choice codes, 4 field validators with 12 branch points, 1 seat range per plan -> decides, one asserted case per row (C2601 to C2603, C2609)
- `infrastructure/stripe/checkout.ts`: decides the line-item count, the metadata and the email -> decides (C2613 to C2615)
- `app/register/register-fields.tsx`: decides the state-to-message mapping and the seat total -> decides (C2606, C2610, C2611, C2617)
- closest analogue: the pricing-page and billing-checkout suites for the same files, already proven at this level

Cost: 0 new Test policy rows; 6 existing test files extended.

## Swept

- validation: C2601 to C2603, C2609 (email, company, phone, seats; plan and trade values by the existing choice checks)
- failure modes: C2617, C2607 (Stripe refusing or not answering keeps the form and logs no contact details)
- idempotency: n/a - starting a session creates nothing billable and stores nothing; a double click makes a second unused session (billing-checkout assumption), and the pending state C2618 disables the button
- authorization: n/a - public form for anyone; it reads no session (unchanged from pricing-page and billing-checkout)
- concurrency: n/a - no shared state is written by this feature
- data lifecycle: n/a - nothing is stored by the app; Stripe holds the session for 24 hours and the stored `checkout.session.completed` body (billing-checkout) now carries the details, with retention owned by provisioning
- dependency failure: C2607, C2617 (Stripe errors are the existing `unavailable` path)
- state transitions: C2612 (a plan change moves the seat count by one rule); no persisted state
- observability: C2607 (what is never logged: email, company, phone); metrics n/a - no service target in this slice

## Out of scope

- None beyond the plan's own Out of scope table.

## Handoff

- S1 = ~12k, S2 = ~10k, S3 = ~3k; `domain/billing`, the use case, the action, the form, the Stripe adapter, the pricing copy and about eight test files. Total ~25k, well under the 150k budget - one builder, no ask
- Mechanism: one builder
