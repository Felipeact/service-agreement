# In-app billing page checks

Profile: standard
Plan: `.specs/features/billing-page/plan.md`

39 checks in 5 slices · 3 one-way doors (approved by "APPROVED") · 3 open, of which 1 blocks go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/` in **PowerShell with the uppercase drive path** (`Set-Location 'C:\Users\dispa\Music\repos\ServiceAgreement\web'`); Git Bash's lowercase `c:` breaks vitest. Every new test name starts with its check id and a colon (`C3100:`). This feature numbers from C3100 (no id above C3004 exists). `npx vitest run <file> -t "C3100:"` selects one. No SQL recipe: no migration.
- **Stripe** is never called by a vitest proof: the adapter tests stub `fetch` as `checkout.test.ts` does.
- **Live** (C3138) is an author-run Playwright pass per AGENTS.md at 375, 768 and 1440 px against the Stripe sandbox with the owner's test keys; nothing is committed.
- Amended approved tests, by the plan's door 1 and Impact: C2510, C2511 and C2529 (`billing-boundaries.test.ts`), C2904 (`org-billing.test.ts`), the billing-portal menu tests C3003 and C3004 (`settings-menu.test.ts`) and C2916 (`billing-in-settings.test.ts`, `page.test.ts`). The billing-portal tests that pin code this feature deletes (C2900 to C2914) are deleted with that code.
- Concurrency is not driven by any proof; see Swept.

## Checks

### S1 - The billing page shows the plan, the card and the invoices · 9 files · ~70 KB · ~18k

**C3100** - The status label over the nine values: `trialing` "Trial", `active` "Active", `past_due` "Payment overdue", `unpaid` "Unpaid", `canceled` "Canceled", `incomplete` "Incomplete", `incomplete_expired` "Expired", `paused` "Paused", and any other value "Unknown" (AC 2)
Proof: `cd web && npx vitest run domain/billing/overview.test.ts -t "C3100:"`

**C3101** - The date line is "Trial ends Nov 24, 2026" while `trialing` and not ending, "Renews Dec 10, 2026" while `active` and not ending, and "Ends Dec 10, 2026" whenever the subscription is set to end, with the date taken in America/Vancouver from the unix time (AC 1)
Proof: `cd web && npx vitest run domain/billing/overview.test.ts -t "C3101:"`

**C3102** - The card line reads "Visa ending 4242, expires 04/2030" (brand capitalised, month padded) and a missing card reads "No payment method" (AC 3)
Proof: `cd web && npx vitest run domain/billing/overview.test.ts -t "C3102:"`

**C3103** - An invoice row shows number, day, amount in the invoice's own currency ("$99.00" for 9900 cad), status, and a View link only when the hosted url is https; rows are newest first and at most 12; none reads "No invoices yet" (AC 4)
Proof: `cd web && npx vitest run domain/billing/overview.test.ts -t "C3103:"`

**C3104** - The actions (Update card, Cancel, Resume) are allowed for every status except `canceled`, which allows none (AC 5)
Proof: `cd web && npx vitest run domain/billing/overview.test.ts -t "C3104:"`

**C3105** - The overview makes exactly three reads, each a GET with the bearer key and the pinned `Stripe-Version`: `/v1/subscriptions/{subscriptionId}` expanding `default_payment_method`, `/v1/customers/{customerId}` expanding `invoice_settings.default_payment_method`, and `/v1/invoices` with `customer` and `limit=12`, the key appearing nowhere else (AC 1, AC 4, Landing door 2)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3105:"`

**C3106** - The overview is mapped from Stripe's shapes: the period end is `items.data[0].current_period_end` and never the subscription-level field, the trial end is `trial_end`, the end date is `cancel_at` else the period end when `cancel_at_period_end` is true, the card is the subscription's default else the customer's, and each invoice carries number, created, total, currency, status and hosted url (AC 1, AC 3, AC 4)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3106:"`

**C3107** - The page shows the signed-in owner or admin's plan, label, date line, card and invoice rows, each View link opening a new tab with `rel="noopener noreferrer"`, and shows no Update card, Cancel or Resume for a `canceled` subscription (AC 1, AC 4, AC 5)
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3107:"`

**C3108** - The empty states read "No payment method" and "No invoices yet", and an invoice read that failed reads "We couldn't load your invoices" while the rest of the page still shows (AC 3, AC 4, AC 10)
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3108:"`
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3108:"`

**C3109** - A subscription read that is not HTTP 200 with a string `status`, whether it is no `status`, a body that is not JSON, 400, 401, 429, 500, a refused connection or a request open after 10 s, is `unavailable`, logged once with the HTTP status and Stripe's error code only, never the customer id, the subscription id, the key or any body text (AC 9)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3109:"`

**C3110** - The page for an owner or admin with a usable overview renders; with no `org_billing` row it says "This workspace has no subscription" and no actions; with Stripe not configured it says "Billing isn't available yet" and no Stripe call was made; with an error it says "We couldn't load billing. Try again." with a retry control (AC 7, AC 8, AC 9)
Proof: `cd web && npx vitest run "app/\(app\)/settings/billing/page.test.ts" -t "C3110:"`
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3110:"`

**C3111** - Opening the page as an estimator or viewer answers `303` to `/settings`, as a signed-out visitor or a user with no membership `303` to `/login`, and none of them reads billing (AC 6)
Proof: `cd web && npx vitest run "app/\(app\)/settings/billing/page.test.ts" -t "C3111:"`

**C3112** - The load use case reads the customer and subscription ids from `org_billing` for the member's org and passes only those to the gateway; an estimator or viewer is `forbidden` with no read; no row is `no_subscription` with no gateway call; a database error is `error` with no gateway call (AC 1, AC 6, AC 7, AC 18)
Proof: `cd web && npx vitest run application/use-cases/billing-page.test.ts -t "C3112:"`

### S2 - An owner or admin updates the card inside the app · 6 files · ~50 KB · ~14k

**C3113** - Starting a card update makes one `POST /v1/setup_intents` with exactly `customer`, `payment_method_types[0]=card` and `usage=off_session`, returns the `client_secret`, and a non-200 answer or a missing secret is `unavailable` (AC 11, AC 18)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3113:"`

**C3114** - Finishing a card update retrieves the SetupIntent itself, requires `status` `succeeded` and `customer` equal to the org's customer, then sets that payment method as `invoice_settings[default_payment_method]` on the customer and as `default_payment_method` on the subscription, with exactly those two writes (AC 12, Landing door 3)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3114:"`

**C3115** - A SetupIntent with status `requires_payment_method`, `requires_action`, `processing` or `canceled`, one belonging to another customer, or one with no payment method is `mismatch`, and no write endpoint is called for any of them (AC 13)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3115:"`

**C3116** - Finishing the same SetupIntent twice issues the same two writes both times and answers ok both times (AC 15)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3116:"`

**C3117** - The card flow starts a SetupIntent, confirms it with Stripe, then calls finish with only the SetupIntent id; a Stripe error from the confirm shows Stripe's message beside the field and finish is not called; a `mismatch` or `unavailable` from finish shows "We couldn't update your card" (AC 11, AC 12, AC 13, AC 14, AC 18)
Proof: `cd web && npx vitest run components/billing/card-flow.test.ts -t "C3117:"`

**C3118** - With the publishable key unset the card area says "Card updates aren't set up yet", loads no Stripe code and starts no SetupIntent; with it set the area offers Update card (AC 16)
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3118:"`
Proof: `cd web && npx vitest run composition/billing-page-wiring.test.ts -t "C3118:"`

**C3119** - While the card is being confirmed or saved the submit control is disabled with a pending label, and the form has one submit control (AC 17)
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3119:"`

### S3 - An owner or admin cancels and resumes · 6 files · ~40 KB · ~11k

**C3120** - Cancel makes one `POST /v1/subscriptions/{id}` that sets the subscription to end at the current period end, never immediately (no `DELETE`), and Resume makes one `POST` that clears that end date; either failing is `unavailable`, logged once without ids, key or body (AC 20, AC 21, AC 23)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3120:"`

**C3121** - Cancelling a subscription already set to end sends the same write and answers ok, and resuming one not set to end does the same (AC 22)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-gateway.test.ts -t "C3121:"`

**C3122** - Cancel asks first: the prompt names the end date and says access continues until then, "Cancel subscription" alone calls nothing, only the confirming button calls cancel once, and dismissing calls nothing; Resume shows only when the subscription is set to end and Cancel only when it is not (AC 19, AC 20, AC 21)
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3122:"`

**C3123** - For an estimator or viewer all four use-case actions answer `forbidden` and no gateway write is called, each action reads the ids from `org_billing` and takes none from its caller, and a database error is `unavailable` with no gateway call (AC 18, AC 24)
Proof: `cd web && npx vitest run application/use-cases/billing-page.test.ts -t "C3123:"`

**C3124** - Each Server Action redirects a signed-out visitor and a no-membership user to `/login` without calling the use case; `startCardUpdate`, `cancelSubscription` and `resumeSubscription` take no argument, `finishCardUpdate` takes one string matching `^seti_[A-Za-z0-9]+$` and answers the card notice without calling the use case for any other value, and no action reads form data (AC 18, AC 24)
Proof: `cd web && npx vitest run "app/\(app\)/settings/billing/actions.test.ts" -t "C3124:"`

**C3125** - Each action's result maps to its page state: `forbidden` shows "You don't have permission to change this", `unavailable` shows "We couldn't update your subscription. Try again." (card actions: "We couldn't update your card"), and a success changes the page by a refresh (AC 23, AC 24)
Proof: `cd web && npx vitest run "app/\(app\)/settings/billing/actions.test.ts" -t "C3125:"`

### S4 - The menu leads to the page and the old card is gone · 7 files · ~45 KB · ~12k

**C3126** - For an owner or admin of an org with a billing record the Settings menu lists Company, Default terms, Renewal, Members, then Billing, and Billing is a link to `/settings/billing`, not an in-page anchor; with no record or for another role it has no Billing item (AC 25)
Proof: `cd web && npx vitest run components/settings/settings-menu.test.ts -t "C3126:"`

**C3127** - `/settings` renders no element with id `billing` and no "Manage billing" text, and no source file under `web/` mentions `billing_portal`, `stripeBillingPortal` or `openBillingPortalAction` (AC 26)
Proof: `cd web && npx vitest run components/settings/settings-menu.test.ts -t "C3127:"`

**C3128** - The Settings page asks the container whether to show the Billing link for this member's org and role, and the billing page offers a link back to `/settings` (AC 25, AC 27)
Proof: `cd web && npx vitest run "app/\(app\)/settings/page.test.ts" -t "C3128:"`
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3128:"`

**C3129** - The billing read gives the customer id, the subscription id and the plan, selecting only those three columns of `org_billing` for the org on the member's own client (Landing door 1 of the portal item extended, `ORG_BILLING` relation)
Proof: `cd web && npx vitest run infrastructure/supabase/org-billing.test.ts -t "C3129:"`

### S5 - Wiring, dependency and sizes · 6 files · ~35 KB · ~9k

**C3130** - The container exposes the billing page and the four actions built on the request's one Supabase client; without `STRIPE_SECRET_KEY` or `APP_BASE_URL` the gateway answers `not_configured` and makes no `fetch`; with both it is the Stripe adapter built from them (AC 8, Flow hops 1 to 5)
Proof: `cd web && npx vitest run composition/billing-page-wiring.test.ts -t "C3130:"`

**C3131** - The publishable key is read only in `composition/`, handed to the page as a value and never as a secret: it appears under `components/` only as a prop name; `STRIPE_SECRET_KEY` is still read only in `composition/` (Landing door 1)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C3131:"`
Proof: `cd web && npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C2510:"`

**C3132** - The manifest has exactly `@stripe/stripe-js` and `@stripe/react-stripe-js` among Stripe packages, no `stripe` server package, and imports of `@stripe/` appear only under `web/components/billing/` (Landing door 1, amends C2511)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C3132:"`

**C3133** - `.env.example` documents `STRIPE_PUBLISHABLE_KEY` (a `pk_` key, safe in the browser) next to the secret key and keeps the base url and Vault notes (amends C2529)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C3133:"`

**C3134** - No route, action or component of the app accepts or posts a card number, expiry or CVC: no input named or labelled `cardNumber`, `cvc`, `exp` or `card_number` exists under `web/app` or `web/components`, and the only card field is Stripe's Payment Element (AC 18)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C3134:"`

**C3135** - The billing page has a `loading.tsx` showing a loading state (AC 29)
Proof: `cd web && npx vitest run "app/\(app\)/settings/billing/page.test.ts" -t "C3135:"`

**C3136** - A `finishCardUpdate` failure leaves the saved card unchanged: the page shows the same card after a `mismatch` and after an `unavailable` (the use case writes nothing before the checks pass) (AC 13)
Proof: `cd web && npx vitest run application/use-cases/billing-page.test.ts -t "C3136:"`

**C3137** - The billing page and its two client islands hold no `process.env` read and no secret: `components/billing/` source contains neither `process.env` nor `STRIPE_SECRET_KEY` (Landing door 1)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C3137:"`

**C3138** - Against the Stripe sandbox, `/settings/billing` at 375, 768 and 1440 px shows plan, status, date line, card and invoices with no horizontal scroll, controls of at least 44 by 44 px on mobile and tablet, a touch tap on Update card, Cancel and Resume responding, a test card 4242 4242 4242 4242 saved, the declined card 4000 0000 0000 0002 refused with Stripe's message, Cancel then Resume round-tripping, and no console error (AC 28, S1 to S3 independent tests)
Proof: live Playwright MCP run per AGENTS.md (author-run, nothing committed); the report lists pages, sizes, touch actions and fixes
Proof: `cd web && npx vitest run components/billing/billing-view.test.ts -t "C3119:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| Stripe subscription statuses (9) | trialing C3100 · active C3100 · past_due C3100 · unpaid C3100 · canceled C3100 · incomplete C3100 · incomplete_expired C3100 · paused C3100 · unknown C3100 | - |
| status × actions allowed (9) | trialing C3104 · active C3104 · past_due C3104 · unpaid C3104 · canceled C3104 · incomplete C3104 · incomplete_expired C3104 · paused C3104 · unknown C3104 | - |
| date line cases (3) | trial ends C3101 · renews C3101 · ends C3101 | - |
| `GET /settings/billing` statuses (3) | 200 C3107 C3110 · 303 /login C3111 · 303 /settings C3111 | - |
| page states (5) | ready C3107 · no subscription C3110 · not configured C3110 · error C3110 · loading C3135 | - |
| Server Action statuses: `startCardUpdate` (2) | 200 with value C3117 C3113 · 303 /login C3124 | - |
| Server Action statuses: `finishCardUpdate` (2) | 200 C3117 C3125 · 303 /login C3124 | - |
| Server Action statuses: `cancelSubscription` (2) | 200 C3125 C3120 · 303 /login C3124 | - |
| Server Action statuses: `resumeSubscription` (2) | 200 C3125 C3120 · 303 /login C3124 | - |
| Stripe reads: three outbound GETs (3) | subscription C3105 · customer C3105 · invoices C3105 | - |
| Stripe writes (4) | setup_intents C3113 · customer default C3114 · subscription default C3114 · subscription end flag C3120 | - |
| Stripe subscription answers that are `unavailable` (8) | no status C3109 · not JSON C3109 · 400 C3109 · 401 C3109 · 429 C3109 · 500 C3109 · refused connection C3109 · 10 s timeout C3109 | - |
| SetupIntent refusals (6) | requires_payment_method C3115 · requires_action C3115 · processing C3115 · canceled C3115 · other customer C3115 · no payment method C3115 | - |
| SetupIntent write calls on refusal (1) | none made C3115 | - |
| card source (2) | subscription default C3106 · customer default C3106 | - |
| end date source (2) | cancel_at C3106 · cancel_at_period_end with period end C3106 | - |
| roles at the page (4) | owner C3107 · admin C3107 · estimator C3111 · viewer C3111 | - |
| roles at the actions (4) | owner C3123 · admin C3123 · estimator C3123 · viewer C3123 | - |
| no-session cases (2) | signed out C3111 C3124 · no membership C3111 C3124 | - |
| card flow outcomes (4) | saved C3117 · Stripe confirm error C3117 · mismatch C3117 · unavailable C3117 | - |
| action notices (3) | forbidden C3125 · unavailable C3125 · card C3125 | - |
| empty and partial states (4) | no card C3108 · no invoices C3108 · invoices failed C3108 · canceled hides actions C3107 | - |
| menu variants (2) | link shown C3126 · no item C3126 | - |
| `org_billing` columns read (3) | stripe_customer_id C3129 · stripe_subscription_id C3129 · plan C3129 | - |
| `org_billing` entity relation (1) | read under the member's own client C3129 | - |
| Landing door 1: client dependency (3) | two packages only C3132 · key env C3131 C3133 · no card field of ours C3134 | - |
| Landing door 2: gateway over `fetch` (2) | adapter C3105 · period end from the item C3106 | - |
| Landing door 3: server verifies the SetupIntent (2) | checks C3114 · refusals C3115 | - |
| startup config: container assembly (1) | `getContainer` with `STRIPE_SECRET_KEY`, `APP_BASE_URL`, `STRIPE_PUBLISHABLE_KEY` C3130 | - |

- Claims naming a status code, route or response shape: C3105, C3107, C3109, C3111, C3113, C3114, C3120, C3124 - each has a proof that crosses the boundary at its own layer; the redirects are asserted through the mocked `redirect`
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (domain, use case) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (page, Server Action) | one at the boundary | accepted input, each rejected input, each error path |
| Adapter (Supabase, Stripe) | one against the client or `fetch` double | request keys, filters and each error reply |
| Presentational component | one markup test per state | each state the plan names |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:

- `domain/billing/overview.ts` (new): status labels (9 rows), date line (3), card line (2), invoice rows (4), action gate (9) -> decides
- `application/use-cases/billing-page.ts` (new): role gate, ids from `org_billing`, five outcomes per action -> decides
- `infrastructure/stripe/billing-gateway.ts` (new): five operations, each with conditionals on status and shape (about 30 branch points) -> adapter
- `components/billing/card-flow.ts` (new): start, confirm, finish with three failure paths -> decides
- closest analogues: `infrastructure/stripe/checkout.ts` with `checkout.test.ts`, and `application/use-cases/billing-portal.ts` with its tests, same shapes, already proven at this level

Cost: 9 test files at their own layer, plus the amended boundary tests; no SQL recipe.

## Swept

- validation: C3124 (the SetupIntent id format), C3109 and C3106 (every shape of Stripe's answers), C3103 (https-only links)
- failure modes: C3109 (reads), C3108 (invoices only), C3115 and C3136 (card refusals leave the card), C3120 (writes failing)
- idempotency: C3116 (same SetupIntent twice), C3121 (cancel twice, resume twice), C3119 (one press, one confirmation)
- authorization: C3111, C3123, C3124; RLS `org_billing_select` (owner and admin, workspace-provisioning door 1) is the database rule and C3129 proves the read goes through it
- concurrency: n/a - the page is read-only and each action is one assignment at Stripe; two owners pressing together both end with the same Stripe state, and no proof drives an interleaving
- data lifecycle: n/a - nothing is stored here; Stripe keeps the subscription, and a `canceled` one shows the page without actions (C3104, C3107)
- dependency failure: C3109 (Stripe down, slow or refusing), C3118 and C3130 (not configured), C3108 (partial failure)
- state transitions: C3100, C3101, C3104 (what each status shows and allows), C3120 and C3121 (active to ending and back)
- observability: C3109 and C3120 (one log line with status and code, never ids, key or body), as `checkout.ts` does

## Out of scope

See the plan's table: plan and seat changes, a database copy of the subscription, acting on payment-failure events, billing name, email and address, in-app invoice PDFs, other payment methods, proration previews, a portal fallback.

## Handoff

- S1 = 18k, S2 = 14k, S3 = 11k, S4 = 12k, S5 = 9k: 64k total, one surface (web, no migration), under the 150k budget - one builder
- Mechanism: one builder
