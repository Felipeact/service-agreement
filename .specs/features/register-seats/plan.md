# Register details and seats

Follows billing-checkout (ROADMAP Phase 5 item 2). The owner asked on 2026-11-09 for two changes to sign-up: charge per seat as well as per plan, and ask for the customer's email, company name, phone and trade on `/register` before payment. This amends decisions 10 and 20 ("plans limit volume only", "seats are not charged separately"). It does not build workspace provisioning, member-seat enforcement or the returning-email refusal.

## Problem

Today a visitor on `/register` ticks trades and a plan and is sent to Stripe, which asks for an email and a card and nothing else. The business learns the buyer's company name and phone only if provisioning later asks again, so the first-login setup screen starts empty and a sales follow-up has nothing to call. Every plan also gives unlimited seats at one price, so a Starter office with twelve staff pays the same $49 as a one-person shop, and the product has no way to grow revenue with the size of the team using it. The roadmap gives no figures on either (no customers yet), so none are claimed.

When this ships, `/register` asks for the buyer's email, company name, phone, trades, plan and number of seats. Each plan includes a few seats and every seat beyond that costs a monthly fee. Stripe's Checkout page opens with the email filled in and shows the plan and the extra seats as two lines. The details ride on the session so provisioning can read them.

## Flow

Reuses the register Server Action, `makeStartTrial`, `parseCheckoutSelection`, the `CheckoutStarter` port and the Stripe adapter from billing-checkout and pricing-page, instead of a second form, a second action or a second Stripe call.

1. visitor submits `/register` -> `app/register/actions.ts` (exists) - reads `plan`, every `trade`, `seats`, `email`, `company`, `phone` from the `FormData`
2. `makeStartTrial` (exists) -> `parseCheckoutSelection` in `domain/billing` (exists, changed) - validates and normalises the six fields, returns a refusal naming the field
3. `CheckoutStarter.start(selection)` (exists, selection widened, door 3) -> `infrastructure/stripe` (exists, changed) - builds one or two line items (door 1) and the metadata and `customer_email` (door 2)
4. out: redirect to Stripe, or the form again with one message under the field that failed and every value kept
5. `/pricing`, the home and FAQ copy read the seat figures from `PLANS` in `domain/billing` (exists, changed)

## Impact

| Front | What changes |
| --- | --- |
| domain | existing term: "seats". It meant "unlimited, free" (ROADMAP Pricing, decisions 10 and 20, PRODUCT.md, `/pricing` copy "Unlimited seats", the FAQ). It now means "a person who signs in": each plan includes some, extra ones are billed. Branches on it today: `domain/billing` `PLANS`, `app/pricing/page.tsx`, `components/site/content.ts` and its tests, pricing-page check C2404 and plan AC 4 |
| domain | new terms: `includedSeats` on a plan, `EXTRA_SEAT_CENTS`, `seats` on a selection (the total the buyer wants, never below the plan's included seats), `company`, `phone`, `email` on a selection |
| tests | pricing-page C2404 asserts the text "Unlimited seats" on each plan and C2401 to C2412 assert the old `{ plan, trades }` selection. They are approved checks that this feature contradicts by decision; they change only with the owner's approval of this plan, and each change is listed in the build report |
| tests | `checkout.test.ts` C2501 to C2504 assert one line item and the metadata keys. They stay true for a selection with no extra seats and gain cases |
| stored data | nothing in our database. The details live on the Stripe session and in the stored `checkout.session.completed` body that billing-checkout already keeps |
| privacy | an email and a phone number now travel to Stripe in the request and sit in session metadata. They are never logged (billing-checkout AC 9 extends to them) |
| not changed | the webhook, the ledger, the success page, the plan keys, the trade list, the 14-day trial and card-up-front rules, every tenant table |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /register` | optional `plan` | the form with the six fields | `200` |
| `POST /register` (the Server Action) | `plan`, `trade` (repeatable), `seats`, `email`, `company`, `phone` | a redirect to the Checkout url, or the page again with one message under the failed field and all values kept | `303`, `200` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. How seats are billed on Stripe | `PLANS` gains `includedSeats` (2, 5, 10) and one `EXTRA_SEAT_CENTS = 1500` for every plan. The session has line item 0 as today (plan, quantity 1) and, only when `seats > includedSeats`, line item 1: `price_data` currency `cad`, `unit_amount` 1500, `recurring[interval]=month`, `product_data[name]` "Extra seat", `quantity` `seats - includedSeats` | one line with `quantity = seats` at a per-seat price: cannot express seats included in the plan. Metered billing: needs usage reports from the app and a subscription that already exists |
| 2. What provisioning will read | session `metadata` and `subscription_data[metadata]` gain `seats` (the total), `company` and `phone`, next to `plan` and `trades`; the buyer's email goes in `customer_email`. Key names are a contract like `plan` and `trades` (AD-169) | Stripe `custom_fields` on the Checkout page: the asks would happen on Stripe's page, not on `/register` before payment, and a field's key and type cannot be reordered after sessions exist. `client_reference_id` packed with JSON: a field a consumer binds to by position |
| 3. The seam widens | `type CheckoutSelection = { plan: PlanKey; trades: TradeCode[]; seats: number; email: string; company: string; phone: string }`; every field required, so a caller cannot start Checkout without them (amends pricing-page door 3, AD-166) | optional fields: a caller (or a forged post) could start a session with no contact and the seat count would silently default |

- Nothing else is hard to reverse: field bounds, labels, layout, the price points and seat counts are edits to `PLANS` and one form. Door 1's numbers are draft (see Assumptions) but their shape is not.
- Door 2 reaches past this feature: provisioning reads these keys from `checkout.session.completed`. Record them as one AD at the end of the build, extending AD-169.

## Criteria

### S1: The form asks who is buying (P1)

**Acceptance Criteria**

1. The `/register` form SHALL show, in this order, "Work email" (`type="email"`, `autocomplete="email"`), "Company name" (`autocomplete="organization"`), "Phone" (`type="tel"`, `autocomplete="tel"`), the trades, the plan, "Team members" (a number field) and the submit button
2. IF the email is empty, over 254 characters, or not of the shape `x@y.z` with no spaces THEN the system SHALL not call the starter and SHALL show "Enter a work email we can reach you on." under the email field
3. IF the company name is empty after trimming, or over 120 characters, THEN the system SHALL not call the starter and SHALL show "Enter your company name." under that field
4. IF the phone, after trimming, has fewer than 7 or more than 20 characters, or any character outside digits, spaces and `+ - ( ) .` THEN the system SHALL not call the starter and SHALL show "Enter a phone number with area code." under that field
5. WHEN a refusal is shown THEN the system SHALL keep every other value the visitor typed, set `aria-invalid` on the failed field and place the message in an element with `role="alert"`
6. WHEN the form is valid THEN the starter SHALL receive the email trimmed and lowercased, the company and phone trimmed with inner runs of whitespace collapsed to one space
7. The system SHALL read no cookie and no database for any of this, and SHALL log no email, company or phone

**Independent test:** open `/register`, submit with each field wrong in turn, then valid.

### S2: Seats and the price (P1)

**Acceptance Criteria**

8. The plans SHALL include 2 (Starter), 5 (Team) and 10 (Business) seats, and each seat beyond that SHALL cost $15 a month in CAD, from `PLANS` and `EXTRA_SEAT_CENTS` in `domain/billing` with no literal repeated in a page
9. The "Team members" field SHALL start at the chosen plan's included seats, accept whole numbers from that plan's included seats to 50, and show under it the monthly total "<plan price> + <n> extra seats x $15 = <total>" whenever the count is above the included seats
10. IF the seats value is not a whole number, is below the plan's included seats, or is above 50 THEN the system SHALL not call the starter and SHALL show "Choose between <included> and 50 team members." under the field
11. WHEN the visitor changes the plan THEN the seat field SHALL move to the new plan's included seats if it was at the old plan's included seats, and otherwise keep its value if still valid
12. WHEN seats equal the plan's included seats THEN the Checkout request SHALL carry one line item; WHEN seats exceed it THEN it SHALL carry a second line item "Extra seat" priced 1500 cad per month with `quantity` `seats - included`
13. The Checkout request SHALL carry `customer_email` equal to the normalised email, and `metadata` and `subscription_data[metadata]` SHALL each carry `seats` (the total), `company` and `phone` beside `plan` and `trades`
14. The `/pricing` page, the home page and the FAQ SHALL state "<n> seats included" per plan and "Extra seats $15 a month", and SHALL no longer say "Unlimited seats"

**Independent test:** pick Team with 8 seats on `/register`, see "$99 + 3 extra seats x $15 = $144", press the button, and see two lines on Stripe's test page.

### S3: Failure and the screen (P1)

**Acceptance Criteria**

15. IF Stripe refuses or does not answer THEN the system SHALL show the existing "We couldn't start sign-up. Try again in a minute." and SHALL keep every field
16. WHILE a submit is pending the system SHALL disable the button and show "Starting…"
17. WHILE `/register` is shown at 375, 768 or 1440 px wide the system SHALL show no horizontal scroll and, at 375 and 768, every field and button SHALL be at least 44 px high

**Independent test:** open `/register` at the three sizes, fill, submit with the Stripe key unset.

## Out of scope

| Excluded | Why |
| --- | --- |
| Refusing an email that already belongs to a workspace | ROADMAP Phase 5 item 7. This feature only collects the email; the refusal needs an anonymous lookup and a message that reveals an account exists (AD-019 avoided that by design). The owner accepted that trade-off on 2026-11-09, so item 7 is unblocked and stays its own feature |
| Changing the seat count after sign-up, blocking an invite beyond the paid seats, syncing the Stripe quantity from the Members page | Needs the org and the Stripe subscription id (provisioning) |
| Showing or collecting a billing address, tax id, or Stripe's own phone field | Stripe's page keeps its own fields; asking twice is friction |
| Verifying the email or the phone (a code, a mailbox check) | A typo costs the buyer a missing sign-in link; verification is a feature of its own |
| Per-plan seat prices, annual seat pricing, seat discounts | One flat price is the simplest to explain; the shape in door 1 allows a change later |
| Using the details to prefill the first-login setup screen | Provisioning and the setup screen read them from the stored event |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Pricing shape | The three volume plans stay; each includes seats; extra seats cost a flat monthly fee | The owner chose it on 2026-11-09 | y |
| Seats chosen at sign-up and charged as a Stripe quantity | As door 1 | The owner took the recommendation on 2026-11-09 | y |
| Included seats | 2, 5, 10 | A proposal sized to the plans' live-agreement limits (15, 60, 200); decision 10 still needs the owner's numbers | n |
| Extra seat price | $15 a month in CAD, one price for all plans | A proposal, a quarter of the Starter price; draft like the plan prices | n |
| Seat ceiling at sign-up | 50 | A larger team talks to us (the contact page); an unbounded field invites a typo that charges for thousands | n |
| Phone format | Digits, spaces and `+ - ( ) .`, 7 to 20 characters, no country check | Canada first, but a contractor may give an extension or a mobile abroad; a stricter pattern refuses real numbers | n |
| Company and phone travel as Stripe metadata | Plain strings of at most 120 and 20 characters | Stripe allows 500 characters per value; the bounds keep them far below it | n |
| Email is only prefilled on Stripe's page | `customer_email` | The buyer can still change it there; the address Stripe ends with is the one provisioning invites (`checkout.session.completed` carries it) | n |
| Design | Built with `/impeccable` on existing tokens (AD-002) and the existing `TextInput` | AGENTS.md rule for UI work | n |

**Open questions:** two. Neither blocks the build.

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | The seat numbers and the $15 price (decision 10 again) | The draft numbers show on every public page |
| 2 | open | Does the buyer's company name belong in the Checkout line ("Team plan for <company>")? | The line says "Team plan" only |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/register` | empty state | n/a - a form, with the seat field starting at the plan's included seats (AC 9) |
| screen `/register` | loading state | AC 16 |
| screen `/register` | error state | AC 2, 3, 4, 5, 10, 15 |
| screen `/register` | unauthorised state | n/a - public to everyone; it reads no session |
| screen `/register` | density and ordering | AC 1, AC 9 (total shown only above the included seats) |
| screen `/register` | destructive action confirms | n/a - nothing deletes; money is confirmed on Stripe's page |
| screen `/register` | responsive and touch | AC 17 |
| screen `/pricing`, home, FAQ | document copy | AC 14 |
| API `POST /register` (Server Action) | response shape and error shape | AC 2 to 5, 10, 15 (a message per field), AC 12, 13 (the redirect) |
| API `POST /register` | who may call it, versioning | n/a - unchanged from billing-checkout: anyone, a framework-generated action id |
| API `POST /register` | rate limit | n/a - unchanged: open question 6 of billing-checkout stays open, and a session still charges nothing |
| outbound call to Stripe | failure, secret handling, what is logged | AC 7, AC 15 |
| collection of seats and plans | ordering, bounds, the exception | AC 8, 9, 10, 11 (included seats per plan, ceiling 50) |

## Sources

- Owner's request, 2026-11-09 - "charge user per seat too" and "when registering before payment should ask for customer email, company name, phone number, trade"; "Recommended" on the pricing shape, seats at sign-up and the email trade-off
- `ROADMAP.md` Pricing (draft), decisions 10 and 20 - amended by this plan; Phase 5 item 7 - the refusal stays separate
- `.specs/STATE.md` AD-166 (the seam, door 3 widened), AD-169 (the session contents and metadata contract, extended), AD-019 (why the refusal reveals an account)
