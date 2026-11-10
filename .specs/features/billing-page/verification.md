# In-app billing page verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 97225fd..a75b2b7 (a5b4b69 spec, f9c2d31 build, a75b2b7 live-run fixes + C3113 amendment + AD-178)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Summary: 35 of 39 checks are proven, each with a located assertion, at HEAD. Four are not proven:
- C3122 and C3135 each let a plausible wrong implementation pass (mutant survived).
- C3125 claims the page shows the permission notice for all four actions, and the card half of that is wrong in the code.
- C3138 is an author-run live pass that I could not observe, and the author's own notes leave out 1440 px and a touch tap on Resume.

Three of five injected faults were killed. Coverage found four unproven members, and two Test policy rows are not met.

## Binding sources

No design mock. The binding sources are the plan's `Landing` (doors 1 to 3 and the amendment bullet), `Surface` and `Relations`. I opened each one in `.specs/features/billing-page/plan.md` and checked it against the code.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| plan `Surface`, outbound reads row | yes - plan.md:52 | Surface lists `GET /v1/payment_methods/{id}`, which the code never calls: the card comes from `expand[]`. The code calls `GET /v1/customers/{id}` (billing-gateway.ts:78), which Surface does not list. C3105 pins the code's set, not the plan's, and the plan was not amended | the `GET /v1/customers/{id}` error reply: Surface says "anything else is `unavailable`", but the code silently drops the customer's card (billing-gateway.ts:95) and no test drives a failing customer read |
| plan `Surface`, page and four Server Actions | yes - plan.md:48-51 | none | - |
| plan `Surface`, outbound writes | yes - plan.md:53 | none | - |
| plan `Landing` door 1 (client Stripe dependency, `confirmSetup` with `redirect: "if_required"`) | yes - plan.md:59 | none | `stripe.confirmSetup({ elements, redirect: "if_required" })` (card-update.tsx:31) has no vitest proof. Only the author-run live pass covers it (C3138, not observed by me) |
| plan `Landing` amendment bullet (`STRIPE_PUBLISHABLE_KEY` read in `composition/`, passed as a prop) | yes - plan.md:63 | none in code (composition/index.ts:137). Stale text: AC 16 (plan.md:97) and open question 1 (plan.md:168) still name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | - |
| plan `Landing` door 2 (gateway over `fetch`, item-level period end) | yes - plan.md:60 | none. The literal parameter shapes `startCardUpdate(customerId)` and `cancel(subscriptionId)` became `(ids: StripeIds)`, a superset. I note it and do not gate on it | - |
| plan `Landing` door 3 (server verifies the SetupIntent) | yes - plan.md:61 | none | - |
| plan `Relations` (ORG ‖--o‖ ORG_BILLING; ids unique and not null) | yes - plan.md:37-42, supabase/migrations/20261110100000_workspace_provisioning.sql:8-12 | none | - |

## Checks

All vitest proofs ran in one invocation from PowerShell, in `C:\Users\dispa\Music\repos\ServiceAgreement\web` at a75b2b7:

`npx vitest run domain/billing/overview.test.ts infrastructure/stripe/billing-gateway.test.ts components/billing/billing-view.test.ts "app/(app)/settings/billing/page.test.ts" "app/(app)/settings/billing/actions.test.ts" application/use-cases/billing-page.test.ts components/billing/card-flow.test.ts composition/billing-page-wiring.test.ts components/settings/settings-menu.test.ts "app/(app)/settings/page.test.ts" infrastructure/supabase/org-billing.test.ts infrastructure/stripe/billing-boundaries.test.ts app/billing-docs.test.ts -t "C31[0-3][0-9]:|C2510:|C2511:|C2529:|C3004:|C2536:" --reporter=verbose`

Result: exit 0, 13 files, 205 passed, 1 skipped (C2622, outside the filter). Every check id from C3100 to C3137 appears individually in the verbose output, and so do C2510, C2511, C2529, C3004 and C2536. No name pattern matched nothing.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C3100 | nine status labels | batch, 9 cases ran | `web/domain/billing/overview.test.ts:21` - `expect(statusLabel(status)).toBe(label)` over the table at :10-19, including `something_new` -> "Unknown" | PASS |
| C3101 | Trial ends / Renews / Ends, Vancouver day | batch, 5 cases | `web/domain/billing/overview.test.ts:27` `toBe("Trial ends Nov 24, 2026")`; `:31` `toBe("Renews Dec 10, 2026")`; `:35` `toBe("Ends Dec 10, 2026")` for active and trialing; `:40` 03:00 UTC -> `"Renews Dec 10, 2026"` | PASS |
| C3102 | card line, "No payment method" | batch | `web/domain/billing/overview.test.ts:46` `toBe("Visa ending 4242, expires 04/2030")`; `:51` `toBe("No payment method")` | PASS |
| C3103 | invoice row, https-only View, newest 12 | batch | `web/domain/billing/overview.test.ts:67` row `toEqual({... amount: "$99.00", url: "https://..."})`; `:72-76` http, null and `javascript:alert(1)` -> `url` `toBeNull()`; `:82-84` length 12, `in_14` first; "No invoices yet" is rendered at `web/components/billing/billing-view.test.ts:52` | PASS |
| C3104 | actions for every status except canceled | batch, 9 cases | `web/domain/billing/overview.test.ts:108` - `expect(canChangeBilling(status)).toBe(allowed)`, with `canceled` -> false at :102 | PASS |
| C3105 | exactly three GETs, bearer, version, expand, limit 12 | batch | `web/infrastructure/stripe/billing-gateway.test.ts:76-80` sorted method+path `toEqual([...customers, invoices, subscriptions])`; `:82` / `:84` `expand[]`; `:87` `limit` `toBe("12")`; `:89-93` Authorization, `Stripe-Version`, null body, key not in url | PASS |
| C3106 | item-level period end, trial end, end date, card source, invoice fields | batch, 6 cases | `web/infrastructure/stripe/billing-gateway.test.ts:99-109` full `toEqual` with `periodEnd: PERIOD_END` against a subscription-level decoy `current_period_end: 1` (:29); `:115` `cancel_at`; `:121` period end when `cancel_at_period_end`; `:130` customer card; `:136` subscription card wins; `:142` null | PASS |
| C3107 | page shows plan, label, date, card, rows; View `_blank` `noopener noreferrer`; canceled hides actions | batch | `web/components/billing/billing-view.test.ts:30-38` `toContain("Trial ends Nov 24, 2026")`, `'target="_blank"'`, `'rel="noopener noreferrer"'`; `:44-46` `not.toContain("Update card" / "Cancel subscription" / "Resume")` | PASS |
| C3108 | empty states, invoice read failure keeps the page | batch, 3 cases | `web/components/billing/billing-view.test.ts:51-52`, `:57-59` `toContain("We couldn't load your invoices")` plus card and date; `web/infrastructure/stripe/billing-gateway.test.ts:149-150` `invoices` `toBe("unavailable")`, status kept | PASS |
| C3109 | subscription read failures `unavailable`, one log line, no ids, key or body | batch, 9 cases | `web/infrastructure/stripe/billing-gateway.test.ts:167-171` `toEqual({ ok: false, code: "unavailable" })`, `toHaveBeenCalledTimes(1)`, `not.toContain(secret)` for both ids, the key and the body text; `:178-179` "500" and "api_error"; `:187-189` refused connection; `:207-211` not logged at 9,999 ms, aborted at 10,000 ms | PASS |
| C3110 | page renders the state; no subscription, not configured, error with retry | batch, 8 cases | `web/app/(app)/settings/billing/page.test.ts:52-55` `loadBilling` called with org and role, `element.type` `toBe(BillingView)`; `:65` states pass unchanged; `web/components/billing/billing-view.test.ts:64-65`, `:71`, `:77-78` `toMatch(/<a[^>]*href="\/settings\/billing"[^>]*>\s*Try again/)`; the "no Stripe call" half is at `web/composition/billing-page-wiring.test.ts:42` | PASS |
| C3111 | estimator and viewer get 303 to /settings; signed out and no membership get 303 to /login with no read | batch, 4 cases | `web/app/(app)/settings/billing/page.test.ts:34` `rejects.toThrow("NEXT_REDIRECT /settings")`; `:39-40` and `:45-46` `/login` with `loadBilling` `not.toHaveBeenCalled()`. That a forbidden role reads nothing is proven one layer down at `web/application/use-cases/billing-page.test.ts:37-38` | PASS |
| C3112 | load reads ids from org_billing; forbidden, no_subscription and error make no gateway call | batch, 7 cases | `web/application/use-cases/billing-page.test.ts:28-31` `toEqual({kind:"ready", plan:"Team"...})`, `overview` `toHaveBeenCalledWith(IDS)`; `:36-38` forbidden, `get` not called; `:43-44`; `:54-56` error, no gateway call, log free of `cus_secret` | PASS |
| C3113 | one POST /v1/setup_intents with exactly customer + usage=off_session (amended) | batch, 5 cases | `web/infrastructure/stripe/billing-gateway.test.ts:218-225` `posts()` `toHaveLength(1)`, keys `toEqual(["customer","usage"])`, `usage` `toBe("off_session")`; `:235` 400, missing, empty or non-string secret -> `unavailable` | PASS |
| C3114 | retrieves the SetupIntent, then exactly two default writes | batch, 2 cases | `web/infrastructure/stripe/billing-gateway.test.ts:242-250` first call `GET /v1/setup_intents/seti_1`, `posts()` length 2, customer form keys `["invoice_settings[default_payment_method]"]` = `pm_new` (taken from Stripe's SetupIntent, not the browser), subscription `["default_payment_method"]`; `:285-286` failure logged without ids or `pm_new` | PASS |
| C3115 | four statuses, another customer, no payment method -> mismatch, no write | batch, 7 cases | `web/infrastructure/stripe/billing-gateway.test.ts:262-263` `toEqual({ ok: false, code: "mismatch" })`, `posts()` `toEqual([])`; `:268-269` unreadable SetupIntent -> unavailable, no write | PASS |
| C3116 | same SetupIntent twice -> same two writes, ok both times | batch | `web/infrastructure/stripe/billing-gateway.test.ts:278-280` `[first, second]` `toEqual([{ok:true},{ok:true}])`, `secondWrites` `toEqual(firstWrites)`, length 2 | PASS |
| C3117 | start, confirm, then finish with only the id; Stripe error skips finish; mismatch or unavailable -> card notice | batch, 9 cases | `web/components/billing/card-flow.test.ts:26-28` `finish.mock.calls[0]` `toEqual(["seti_1AbC"])`; `:34-35` `stripe_error` with Stripe's message, `finish` `not.toHaveBeenCalled()`; `:40` failed -> `{status:"failed"}` | PASS |
| C3118 | key unset -> "Card updates aren't set up yet", no SetupIntent; set -> Update card | batch, 3 cases | `web/components/billing/billing-view.test.ts:92-93`, `:97`; `web/composition/billing-page-wiring.test.ts:70`, `:72`. Precision note: "loads no Stripe code" is not asserted. I read the code instead: `loadStripe` is called only when there is a key (card-update.tsx:51) | PASS |
| C3119 | submit disabled with a pending label; one submit control | batch, 2 cases | `web/components/billing/billing-view.test.ts:102-106` `toMatch(/<button[^>]*disabled=""/)` with no "Update card" while pending; `:112-113` `match(/type="submit"/g)` `toHaveLength(1)`, disabled while saving | PASS |
| C3120 | cancel = one POST `cancel_at_period_end=true` (no DELETE); resume clears it; failures unavailable, logged once without ids | batch, 4 cases | `web/infrastructure/stripe/billing-gateway.test.ts:292-296` `calls` length 1, method `toBe("POST")`, form `toEqual([["cancel_at_period_end","true"]])`; `:303` `"false"`; `:308-310` unavailable, logged once, no secrets | PASS |
| C3121 | cancel twice and resume twice -> same write, ok | batch | `web/infrastructure/stripe/billing-gateway.test.ts:315-316` bodies `toEqual(["cancel_at_period_end=true", ...x2, "cancel_at_period_end=false" x2])` | PASS |
| C3122 | Cancel asks first; "Cancel subscription" alone calls nothing; only confirm calls cancel once; dismiss calls nothing; Resume or Cancel by state | batch, 5 cases | `web/components/billing/billing-view.test.ts:124-126` no `<form`, no submit before confirming; `:131-134` prompt holds the date, "keep access until then", one submit; `:144-145`, `:150-152`. These render `CancelPrompt` in isolation with no handlers. Nothing asserts what `SubscriptionControls` wires to `onStart` or `onConfirm`, or that dismissing or confirming calls anything. **Fault 1 survived**: `onStart` calling `cancel` directly passes every C3122 test | FAIL |
| C3123 | estimator and viewer forbidden on all four actions, no write; ids from org_billing; DB error unavailable | batch, 17 cases | `web/application/use-cases/billing-page.test.ts:78-80` `toEqual({ ok:false, code:"forbidden" })`, `get` and every gateway write `not.toHaveBeenCalled()` over 4 actions x 2 roles; `:89-90` `call[0]` `toEqual(IDS)`; `:100-101` | PASS |
| C3124 | signed out and no membership -> /login; no-arg actions; `seti_` format; no form data | batch, 16 cases | `web/app/(app)/settings/billing/actions.test.ts:48-49`, `:54-55` `rejects.toThrow("NEXT_REDIRECT /login")` and use case not called; `:62-65` `.length` `toBe(0)`; `:70`; `:76-77` nine malformed ids -> `{status:"failed"}`, not called; `:83` `not.toMatch(/formData|FormData/)` | PASS |
| C3125 | each action's result maps to its page state: forbidden -> "You don't have permission to change this"; unavailable -> subscription or card notice; success refreshes | batch, 16 cases | `web/app/(app)/settings/billing/actions.test.ts:99`, `:114`, `:123-125` assert only the actions' return statuses, and `:129-131` only the constant strings. No test reaches the page mapping (subscription-controls.tsx:38, card-update.tsx:39, :65), and nothing asserts `router.refresh()` on success. The card island shows `BILLING_MESSAGES.card` for a `forbidden` start or finish (card-update.tsx:65, :39), which contradicts AC 24 ("any of the four actions"), and `web/components/billing/card-flow.test.ts:38-40` pins forbidden -> `failed`. Level gap plus a wrong mapping for 2 of the 4 actions | FAIL |
| C3126 | menu order ends Members, Billing; Billing links to /settings/billing; no item without a record or role | batch, 8 cases | `web/components/settings/settings-menu.test.ts:49` order `toEqual([... "Members","Billing"])`; `:54-55` `href="/settings/billing"`, no `#billing`; `:59`; `web/application/use-cases/billing-page.test.ts:135` role table | PASS |
| C3127 | no billing card or Manage billing on /settings; no portal code in source | batch, 2 cases | `web/components/settings/settings-menu.test.ts:65-66` `not.toContain('id="billing"')`, `not.toContain("Manage billing")`; `:72` portal names: no hits `toEqual([])` | PASS |
| C3128 | Settings asks the container for the link; billing page links back to /settings | batch, 7 cases | `web/app/(app)/settings/page.test.ts:29-32` `billingLink` called once with ("org-1","admin"), prop `toBe(true)`; `:39`; `web/components/billing/billing-view.test.ts:84` `toMatch(/<a[^>]*href="\/settings"[^>]*>[^<]*Settings/)` in all four states | PASS |
| C3129 | selects exactly customer id, subscription id and plan for the org, on the given client | batch, 3 cases | `web/infrastructure/supabase/org-billing.test.ts:10` value `toEqual({customerId, subscriptionId, plan})`; `:13` columns `toEqual(["plan","stripe_customer_id","stripe_subscription_id"])`; `:14` `eq("org_id", ORG)`; `:15` no writes. Session client confirmed by reading `web/composition/index.ts:138` (`supabaseOrgBilling(supabase)`, the `createServerClient` client of :103) | PASS |
| C3130 | not_configured with no fetch when a var is missing; Stripe adapter with both | batch, 6 cases | `web/composition/billing-page-wiring.test.ts:39-42` `toEqual({kind:"not_configured"})`, `fetchMock` `not.toHaveBeenCalled()`; `:54-55` the three paths with `Bearer sk_test_x`. The assembly itself, read directly: `web/composition/index.ts:137-150` | PASS |
| C3131 | publishable and secret keys read only in composition | batch (C3131 and C2510) | `web/infrastructure/stripe/billing-boundaries.test.ts:54-57` outside-composition hits `toEqual([])`, composition holds the name `toBe(true)`; `:24-29` (C2510) | PASS |
| C3132 | exactly the two browser packages; `@stripe/` imports only under components/billing | batch | `web/infrastructure/stripe/billing-boundaries.test.ts:63` `toEqual(["@stripe/react-stripe-js","@stripe/stripe-js"])`; `:66` importers outside `components/billing/` `toEqual([])` | PASS |
| C3133 | .env.example documents STRIPE_PUBLISHABLE_KEY, keeps base url and Vault notes | batch | `web/infrastructure/stripe/billing-boundaries.test.ts:71-76` `toMatch(/^STRIPE_PUBLISHABLE_KEY=/m)`, `pk_`, the "browser" wording, `stripe_webhook_secret` | PASS |
| C3134 | no card input of ours; PaymentElement is the only card field | batch | `web/infrastructure/stripe/billing-boundaries.test.ts:82` own card-field names `toEqual([])`; `:83` `PaymentElement` present under components/billing | PASS |
| C3135 | `loading.tsx` shows a loading state | batch | `web/app/(app)/settings/billing/page.test.ts:69` - `expect(existsSync(path.join(__dirname, "loading.tsx"))).toBe(true)` asserts that the file exists, not that it shows a loading state. **Fault 2 survived**: `return null` passes | FAIL |
| C3136 | a finish failure leaves the card unchanged; the use case writes nothing else | batch, 2 cases | `web/application/use-cases/billing-page.test.ts:117-119` mismatch passed on, `startCardUpdate`, `cancel` and `resume` `not.toHaveBeenCalled()`; `:124` unavailable passed on | PASS |
| C3137 | components/billing reads no env and holds no secret | batch | `web/infrastructure/stripe/billing-boundaries.test.ts:89` `/process\.env\|STRIPE_SECRET_KEY\|sk_(test\|live)_/` hits `toEqual([])` | PASS |
| C3138 | live sandbox at 375, 768 and 1440 px: layout, 44 px controls, touch on Update card, Cancel and Resume, 4242 saved, decline message, Cancel then Resume, no console error | vitest half: C3119 ran and passed (`web/components/billing/billing-view.test.ts:112-113`). Live half: AUTHOR-RUN on 2026-11-10. I did not and could not re-run it, and I observed none of it | Author's report, not observed by me: `/settings/billing` showed "Team / Trial / Trial ends Nov 24, 2026", "Visa ending 4242, expires 11/2027" and invoice L5LKBHH8-0001 $0.00 paid with View. The cancel prompt read "Cancel your subscription? Service ends on Nov 24, 2026 and you keep access until then." Keep subscription changed nothing. Yes, cancel -> "Ends Nov 24, 2026" + Resume, and Resume restored "Trial ends Nov 24, 2026". Update card opened the Payment Element in the page; Mastercard 4444 replaced the Visa ("Mastercard ending 4444, expires 12/2031"). Card 4000 0000 0000 0002 -> "Your card has been declined." beside the field, saved card unchanged. No card inputs of ours. At 375 and 768 px: no horizontal scroll and every control at least 44x44 after a fix (View was 31 px wide). CDP touch taps opened and closed the cancel prompt and the card form. No console errors apart from Stripe's 402 on the decline. Menu: Company, Default terms, Renewal, Members, Billing. Verify.md section 2 says "Run them yourself ... Never trust a report that the author already ran them", so this report is not evidence I can certify. It is also incomplete against the check: there is no measurement at **1440 px**, and no touch tap on **Resume** (taps cover only the cancel prompt and the card form). Not done live: Checkout, webhook and real sign-up subscription; the Dashboard Cards-only setting (go-live item) | AUTHOR-RUN (not observed; 1440 px and Resume touch absent from the author's record) |

Amended and deleted approved tests:
- **C2510, C2511, C2529** pass at HEAD. Their amendments are listed in the plan's Impact (plan.md:29) and in checks.md "How proofs run". C2511 still forbids the `stripe` server package (`web/infrastructure/stripe/billing-boundaries.test.ts:34-36`), and C3132 bounds the browser packages.
- **C2904** became C3129 and **C3003** became C3126. **C3004** is kept and widened so that Billing must also be unmarked (`web/components/settings/settings-menu.test.ts:77-82`). **C2916** became C3128.
- **C2900 to C2914** were deleted, all inside the 7 deleted test files, which I enumerated at 97225fd: C2900 to C2903 and C2905 to C2914, plus C2904 renamed. All of these are listed in "How proofs run". C2915 was a live check and has no test.
- Mismatch: the plan's Impact says "C2901 to C2914 in part", but checks.md says C2900 to C2914. I note the drift and do not gate on it.
- **C2536** (`web/app/billing-docs.test.ts:13`) was widened from `[ ]` to `[ x]`, and **neither the plan's Impact nor checks.md lists it**. The roadmap line is now `[x]`. Accepting either state reduces the assertion to "the line exists", so un-ticking it by accident would no longer fail. The honest amendment pins `[x]` and the billing-page reference. It is a low-severity weakening of a pinned check made outside the approved amendment list (gap 7).
- **C3113** amendment: owner-approved. It is recorded in checks.md:63 and in the plan's Assumptions row with Confirmed `y` (plan.md:162), and the test pins exactly `customer` and `usage`. Accepted. One knock-on is not reconciled: the plan's Out-of-scope row still says "the Payment Element is limited to them" (plan.md:144), but card-only now depends on a Dashboard setting (open question 4). The checks.md header still says "3 open, of which 1 blocks go-live", while the plan now has 4 open questions, 2 of which block go-live (1 and 4).

## Coverage

I recomputed every set from the plan's Surface, Landing and Relations and from the code (billing-gateway.ts, overview.ts, billing-page.ts, actions.ts, page.tsx, card-update.tsx, subscription-controls.tsx), not from the author's table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Stripe statuses -> label (9) | plan AC 2, overview.ts:34-47 | all 9 C3100 (overview.test.ts:10-21) | - |
| status -> actions allowed (9) | overview.ts:108-110 | all 9 C3104 | - |
| date line branches (5) | overview.ts:60-66 | canceled -> none (view C3107 :43), ends C3101, trial ends C3101, renews C3101, other -> none (not asserted; plan names only 3) | - |
| `GET /settings/billing` statuses (3) | plan Surface :48, page.tsx:20-24 | 200 C3110 · 303 /login C3111 · 303 /settings C3111 | - |
| Server Action statuses (4 actions x {200, 303 /login}) | plan Surface :49-51, actions.ts | 303 C3124 x4 · 200 value C3125 x4 | - |
| page states (6) | page-view kinds + loading | ready C3107 · no_subscription C3110 · not_configured C3110 · error C3110 · invoices unavailable C3108 · loading C3135 (existence only, mutant survived) | loading state content |
| outbound reads per plan Surface (4) | plan.md:52 | subscriptions C3105 · invoices C3105 · setup_intents C3114 · payment_methods: never called (expansion used) | `GET /v1/payment_methods/{id}`: Surface member with no call and no proof (plan not amended); `GET /v1/customers/{id}` called but not in Surface |
| outbound read failures -> `unavailable` (4 endpoints) | plan Surface "anything else is unavailable", billing-gateway.ts:76-98, :117-118 | subscription C3109 (8 shapes) · invoices C3108 · setup_intents C3115 (404) · customers: none | customer read failure (no test; the code degrades silently to the subscription's card or "No payment method") |
| outbound writes (3 endpoints) and failures | plan.md:53 | setup_intents C3113 (+400) · customers default C3114 (+500) · subscriptions default C3114 · cancel/resume flag C3120 (+500). Subscription write failing after the customer write succeeded is not driven (the 500 stub fails the first write) | - |
| SetupIntent refusals (6) + unreadable | Landing door 3, billing-gateway.ts:121 | all 6 C3115 · unreadable C3115 · killed by fault 4 | - |
| roles at the page (4) | canManageBilling | owner C3110/C3112 · admin C3110/C3112 · estimator C3111/C3112 · viewer C3111/C3112 | - |
| roles at the use-case actions (4 roles x 4 actions) | billing-page.ts:28 | all 16 C3123 (killed by fault 5) | - |
| action outcome -> notice shown on page (4 actions x {forbidden, unavailable/failed, success refresh}) | plan AC 13, 23, 24; subscription-controls.tsx:35-38; card-update.tsx:39, :62-65 | cancel/resume: none at the page (C3125 stops at action return values) · start/finish forbidden: code shows the card notice, contradicting AC 24 · success `router.refresh()`: none | forbidden notice on startCardUpdate and finishCardUpdate (wrong in code); all 12 page mappings unasserted |
| cancel two-step interaction (3: start asks, confirm calls once, dismiss calls nothing) | AC 19, C3122, subscription-controls.tsx:55 | static markup of `CancelPrompt` only | start does not call cancel (fault 1 survived) · confirm calls cancel once · dismiss calls nothing |
| Landing door 1 literal (4) | plan.md:59 + amendment :63 | two packages C3132 · key name/location C3131 C3133 · Payment Element C3134 · `confirmSetup` with `redirect: "if_required"`: author-run only | `confirmSetup({ redirect: "if_required" })` (card-update.tsx:31) has no proof I could run |
| Landing door 2 (2) | plan.md:60 | gateway over fetch C3105 · item-level period end C3106 (killed by fault 3) | - |
| Landing door 3 (3) | plan.md:61 | status succeeded C3115 · customer equals org's C3115 (fault 4 killed) · payment method from the SetupIntent C3114 | - |
| `org_billing` columns read (3) | org-billing.ts:12 | C3129 | - |
| Relations: ORG-ORG_BILLING, unique and not null ids (1) | migration 20261110100000:8-12 | `stripe_customer_id text not null unique`, `stripe_subscription_id text not null unique`, read under RLS C3129 | - |
| startup config: container assembly (1) | composition/index.ts:134-150, read directly | C3130 | - |
| responsive and touch (3 widths x layout and 44 px, touch on 3 controls) | AC 28, C3138 | author-run, not observed: 375 and 768 recorded; touch on Update card and Cancel recorded | 1440 px; touch on Resume; and none of it observed by the Verifier |

Swept rows that resolve to existing guards:
- RLS `org_billing_select` is present: `supabase/migrations/20261110100000_workspace_provisioning.sql:19-23`. It enables RLS, revokes everything from `authenticated`, grants select only, and the policy uses `private.has_org_role(org_id, array['owner','admin'])`. No later migration alters it (`20261110110000_first_login_setup.sql` only reads and inserts).
- The 10 s timeout constant is present: `web/infrastructure/stripe/http.ts:4` (`STRIPE_TIMEOUT_MS = 10_000`).
- The pinned version is present at `http.ts:2`.
- Log lines carry a fixed `what` label and the HTTP status or code only (billing-gateway.ts:57, :60, :85).

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `domain/billing/overview.ts`, `application/use-cases/billing-page.ts`, `components/billing/card-flow.ts` | own layer: overview.test.ts, billing-page.test.ts, card-flow.test.ts | yes - one case per decision-table row (9 labels, 3 date lines, 2 card lines, invoice rules, 9 gates; role x action, no row, DB error). Fault 5 killed |
| Entry point that decides nothing | `app/(app)/settings/billing/page.tsx`, `actions.ts`, `app/(app)/settings/page.tsx` | boundary: page.test.ts, actions.test.ts | yes - accepted input, every rejected session state, malformed SetupIntent ids, each error code |
| Adapter | `infrastructure/stripe/billing-gateway.ts`, `infrastructure/supabase/org-billing.ts` | fetch or client double: billing-gateway.test.ts, org-billing.test.ts | no - "each error reply" is not met for `GET /v1/customers/{id}`, which no test fails, and a subscription-default write failing after a successful customer write is never driven |
| Presentational component | `components/billing/billing-view.tsx`, `billing-parts.tsx`, `subscription-controls.tsx`, `card-update.tsx`, `app/(app)/settings/billing/loading.tsx` | one markup test per state | no - the action-notice states of `SubscriptionControls` and `CardUpdate` (forbidden, unavailable, card failure) have no rendered test, the confirming state is never reached from the view, and `loading.tsx` is checked for existence only (fault 2 survived) |
| Instrumentation, pass-throughs | `components/billing/state.ts` (types and constants) | none | yes - its constants are asserted by its consumer (actions.test.ts:129-131) |

## Faults injected

Isolation:
- Scratch worktree: `git worktree add --detach <scratchpad>\wt HEAD` at a75b2b7, with a junction from `web\node_modules` to the real one.
- The real tree's `git status --porcelain`, before and after: `?? .specs/features/billing-portal/verification.md`, identical.
- Each fault was reverted with `git checkout -- <file>` inside the scratch worktree, and the scratch worktree was clean before removal.
- The junction was removed with `rmdir`; the real `node_modules` is intact.
- The worktree was removed with `git worktree remove --force`.
- No `git stash` was used.

| Mutation | Location | Killed |
| --- | --- | --- |
| "Cancel subscription" calls cancel directly, skipping the confirm step: `onStart={() => setConfirming(true)}` -> `onStart={() => void run(actions?.cancel)}`; ran `billing-view.test.ts -t "C3122:"` -> 5 passed | `web/components/billing/subscription-controls.tsx:55` | no - survived |
| the loading screen renders nothing: `return <PageLoading title="Billing" />` -> `return null`; ran `page.test.ts -t "C3135:"` -> 1 passed | `web/app/(app)/settings/billing/loading.tsx:4` | no - survived |
| period end read from the subscription-level field first: `num(sub.current_period_end) ?? num(firstItem.current_period_end)`; ran `billing-gateway.test.ts -t "C3106:"` -> 2 failed | `web/infrastructure/stripe/billing-gateway.ts:91` | yes |
| a SetupIntent of another customer accepted: dropped `read.body.customer !== customerId`; ran `billing-gateway.test.ts -t "C3115:"` -> "another customer" failed | `web/infrastructure/stripe/billing-gateway.ts:121` | yes |
| role gate admits estimator on the actions: `!canManageBilling(role) && role !== "estimator"`; ran `billing-page.test.ts -t "C3123:"` -> 4 failed (all four actions) | `web/application/use-cases/billing-page.ts:28` | yes |

Adversarial cases checked by reading the code, without spending a fault on them. Each one was ruled out:
- **Customer id from the browser:** ruled out. Actions take no form data (actions.test.ts:83), and the use case takes the ids from `billing.get` (billing-page.test.ts:89-90).
- **Cancel sent as a DELETE:** ruled out (billing-gateway.test.ts:293-294).
- **Browser's payment method trusted:** ruled out. `pm_new` comes from the stubbed SetupIntent (billing-gateway.test.ts:247, :250).
- **`javascript:` View link:** ruled out (overview.test.ts:75-76).
- **Id or key in a log line:** ruled out (billing-gateway.test.ts:170, :189, :286, :310).
- **Card form submitting twice:** guarded by `disabled` (C3119) and by an `if (pending) return` guard (card-update.tsx:26), which is not asserted.

## Gate

The `npx vitest run ...` batch above passed 205 tests and failed 0, with 1 skipped outside the filter, in 13 files at a75b2b7. The C3138 live half was author-run and not re-run.

`python3 .claude/skills/tlc-spec-lean/scripts/validate_verification.py billing-page` -> exit 1 ("verdict is FAIL - route the ranked gaps back as fixes, then re-verify"), 1 error and 0 warnings. The table rows raised no other error.

## Ranked gaps

1. **Cancel confirm is not proven, and a mutant skipping it survives** (C3122). `web/components/billing/subscription-controls.tsx:55`. This is a destructive action. It needs an interaction-level test of `SubscriptionControls`: start does not call cancel, Yes calls it once, Keep calls nothing.
2. **The page notice for a forbidden card action is wrong, and the proofs never reach the page** (C3125, AC 24). `web/components/billing/card-update.tsx:39` and `:65` show "We couldn't update your card" where AC 24 requires "You don't have permission to change this". `web/components/billing/card-flow.test.ts:38-40` pins the wrong mapping. No test asserts the cancel and resume notices at the page or `router.refresh()` on success.
3. **The live pass is author-run and not observed, and incomplete against its own check** (C3138). The record has no 1440 px measurement and no touch tap on Resume. AC 28 and the `confirmSetup({ redirect: "if_required" })` door-1 literal rest only on it.
4. **The loading state is unproven, and a `return null` mutant survives** (C3135). `web/app/(app)/settings/billing/page.test.ts:69` asserts only that the file exists.
5. **Surface drift and an untested read failure.** The plan's Surface names `GET /v1/payment_methods/{id}` (never called) and omits `GET /v1/customers/{id}`. A failing customer read has no proof and silently shows the subscription's card or "No payment method" rather than "unavailable" (`web/infrastructure/stripe/billing-gateway.ts:95`). The Adapter Test policy row is unmet as a result.
6. **The Presentational Test policy row is unmet.** No rendered test covers the notice states of `SubscriptionControls` and `CardUpdate`, or the confirming state reached from the view.
7. **C2536 was weakened outside the approved amendment list.** `web/app/billing-docs.test.ts:13` now accepts `[ ]` or `[x]`; it should pin `[x]`.
8. **Document drift, which does not gate.**
   - AC 16 (plan.md:97) and open question 1 (plan.md:168) still name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
   - The Out-of-scope row at plan.md:144 says the Payment Element is limited to cards.
   - The checks.md header open-question count is stale.
   - The plan's Impact says "C2901 to C2914" where checks.md says C2900.
   - `web/package.json` adds the two packages with caret ranges, while the neighbouring dependencies are exact pins.
