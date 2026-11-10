# In-app billing page verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 97225fd..56bc401 (round 2 scope: a75b2b7..56bc401, the one fix commit 56bc401, plus every non-PASS verdict of round 1)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Summary: 42 of 43 checks are proven at 56bc401, each with a located assertion. Every round-1 gap the fix aimed at is closed: C3122, C3125 and C3135 now pass; C3139 to C3142 prove what they say; and all five faults injected on the fix's surfaces were killed, including the round-1 survivor (Cancel skipping the confirm).

Two things keep the verdict at FAIL:
1. **C3138's live half is still author-run.** I could not observe it, and it can no longer be re-run because the author's sandbox objects were deleted. The author's record still has no touch tap on **Resume**, which the check names.
2. **The Adapter Test policy row is still half unmet.** In `finishCardUpdate`, a subscription-default write that fails after the customer write succeeded is never driven (`web/infrastructure/stripe/billing-gateway.ts:127`). Reading the tests, a mutant that ignores that write's answer would survive. I did not inject it because the five-fault cap was reached.

## Binding sources

Partly carried from a75b2b7. The `Surface` outbound-reads row and the door 1 literal were re-done at 56bc401, because the fix touched them. The profile is `standard`, so this step is not required; the section is kept so the round-1 rows show what happened to them.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| plan `Surface`, outbound reads row (verified at 56bc401) | yes - plan.md:52 | none. The row now lists `GET /v1/customers/{id}` and drops `GET /v1/payment_methods/{id}`, which matches the code (billing-gateway.ts:76-78) | - (a failing customer read is now `unavailable` when there is no subscription card, billing-gateway.ts:97, proven by C3142) |
| plan `Surface`, page and four Server Actions (carried from a75b2b7) | yes - plan.md:48-51 | none | - |
| plan `Surface`, outbound writes (carried from a75b2b7) | yes - plan.md:53 | none | - |
| plan `Landing` door 1 (verified at 56bc401) | yes - plan.md:59 | none | - (`confirmSetup({ elements, redirect: "if_required" })` at card-update.tsx:31 is now proven by C3141, card-update.test.ts:107; fault 3a killed) |
| plan `Landing` amendment bullet (verified at 56bc401) | yes - plan.md:63 | none in code. AC 16 (plan.md:97) and open question 1 (plan.md:168) are corrected. One stale line remains: the Impact `env` row at plan.md:30 still names `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (doc drift, does not gate) | - |
| plan `Landing` doors 2 and 3 (carried from a75b2b7) | yes - plan.md:60-61 | none | - |
| plan `Relations` (carried from a75b2b7) | yes - plan.md:37-42 | none | - |

## Checks

Verified at 56bc401. All proofs ran in one invocation from PowerShell in `C:\Users\dispa\Music\repos\ServiceAgreement\web`:

`npx vitest run domain/billing/overview.test.ts infrastructure/stripe/billing-gateway.test.ts components/billing/billing-view.test.ts "app/(app)/settings/billing/page.test.ts" "app/(app)/settings/billing/actions.test.ts" application/use-cases/billing-page.test.ts components/billing/card-flow.test.ts components/billing/card-update.test.ts components/billing/subscription-controls.test.ts composition/billing-page-wiring.test.ts components/settings/settings-menu.test.ts "app/(app)/settings/page.test.ts" infrastructure/supabase/org-billing.test.ts infrastructure/stripe/billing-boundaries.test.ts app/billing-docs.test.ts -t "C31[0-4][0-9]:|C2510:|C2511:|C2529:|C3004:|C2536:" --reporter=verbose`

Result:
- Exit 0 over 15 files: 224 passed and 1 skipped. The skip is C2622, which is outside the filter.
- Every id from C3100 to C3142 except C3138 appears individually in the verbose output. C3138 has no vitest test of its own; its vitest half is C3119. Hits per id: C3139 6, C3140 9, C3141 6, C3142 1, C3135 1.
- C2510, C2511, C2529, C3004 and C2536 each appear and pass.
- Every name pattern matched at least one test.

jsdom:
- Both new DOM test files start with `// @vitest-environment jsdom` (line 1 of `subscription-controls.test.ts` and of `card-update.test.ts`).
- `web/vitest.config.mts` sets no `environment`, so the default is node, where `document` does not exist. Both files call `document.createElement` in `beforeEach`.
- All 9 C3140 cases and all 6 C3141 cases, plus the 6 C3139 cases, reported as passed (✓), not skipped (↓). They therefore ran under jsdom.

Citations in files that 56bc401 did not touch are carried from a75b2b7. Those files are unchanged, so their line numbers still hold. Citations in touched files were refreshed: `billing-gateway.test.ts` (+8 lines from :145), `card-flow.test.ts`, `page.test.ts`, `billing-docs.test.ts`, and the two new files.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C3100 | nine status labels | batch, 9 cases | `web/domain/billing/overview.test.ts:21` `expect(statusLabel(status)).toBe(label)` over :10-19 (carried) | PASS |
| C3101 | Trial ends / Renews / Ends, Vancouver day | batch, 5 cases | `web/domain/billing/overview.test.ts:27`, `:31`, `:35`, `:40` (carried) | PASS |
| C3102 | card line, "No payment method" | batch, 2 | `web/domain/billing/overview.test.ts:46`, `:51` (carried) | PASS |
| C3103 | invoice row, https-only View, newest 12 | batch, 5 | `web/domain/billing/overview.test.ts:67`, `:72-76`, `:82-84`; `web/components/billing/billing-view.test.ts:52` (carried) | PASS |
| C3104 | actions for every status except canceled | batch, 9 | `web/domain/billing/overview.test.ts:108` `expect(canChangeBilling(status)).toBe(allowed)` (carried) | PASS |
| C3105 | exactly three GETs, bearer, version, expand, limit 12 | batch | `web/infrastructure/stripe/billing-gateway.test.ts:76-93` (above the insertion, unchanged) | PASS |
| C3106 | item-level period end, end date, card source, invoice fields | batch, 6 | `web/infrastructure/stripe/billing-gateway.test.ts:99-109`, `:115`, `:121`, `:130`, `:136`, `:142` (unchanged) | PASS |
| C3107 | page shows plan, label, date, card, rows; View `_blank` `noopener noreferrer`; canceled hides actions | batch, 2 | `web/components/billing/billing-view.test.ts:30-38`, `:44-46` (carried) | PASS |
| C3108 | empty states; invoice read failure keeps the page | batch, 3 | `web/components/billing/billing-view.test.ts:51-52`, `:57-59`; `web/infrastructure/stripe/billing-gateway.test.ts:157` `expect(result.ok && result.overview.invoices).toBe("unavailable")` (refreshed) | PASS |
| C3109 | subscription read failures `unavailable`, one log line, no ids, key or body | batch, 9 | `web/infrastructure/stripe/billing-gateway.test.ts:175-179` (`toEqual({ ok: false, code: "unavailable" })`, `errorLog` `toHaveBeenCalledTimes(1)` at :176), `:186-187`, `:195-197`, `:215-219` (refreshed +8) | PASS |
| C3110 | page renders the state; no subscription, not configured, error with retry | batch, 8 | `web/app/(app)/settings/billing/page.test.ts:52-55`, `:65`; `web/components/billing/billing-view.test.ts:64-65`, `:71`, `:77-78`; `web/composition/billing-page-wiring.test.ts:42` (page.test.ts lines above the change, unchanged) | PASS |
| C3111 | estimator and viewer 303 /settings; signed out and no membership 303 /login, no read | batch, 4 | `web/app/(app)/settings/billing/page.test.ts:34`, `:39-40`, `:45-46` `rejects.toThrow("NEXT_REDIRECT /login")` (unchanged) | PASS |
| C3112 | ids from org_billing; forbidden, no_subscription and error make no gateway call | batch, 7 | `web/application/use-cases/billing-page.test.ts:28-31`, `:36-38`, `:43-44`, `:54-56` (carried) | PASS |
| C3113 | one POST /v1/setup_intents with exactly customer + usage=off_session | batch, 5 | `web/infrastructure/stripe/billing-gateway.test.ts:227` `expect(posts()).toHaveLength(1)`, keys `toEqual(["customer","usage"])` at :226-233; `:243` failures -> `unavailable` (refreshed) | PASS |
| C3114 | retrieves the SetupIntent, then exactly two default writes | batch, 2 | `web/infrastructure/stripe/billing-gateway.test.ts:251` `toBe("/v1/setup_intents/seti_1")`, writes at :250-258; `:291-294` failure logged without ids or `pm_new` (refreshed) | PASS |
| C3115 | four statuses, another customer, no payment method -> mismatch, no write | batch, 7 | `web/infrastructure/stripe/billing-gateway.test.ts:270` `toEqual({ ok: false, code: "mismatch" })`, `posts()` `toEqual([])` at :271; `:276-277` (refreshed) | PASS |
| C3116 | same SetupIntent twice -> same writes, ok both times | batch | `web/infrastructure/stripe/billing-gateway.test.ts:287` `expect(secondWrites).toEqual(firstWrites)`, :286-288 (refreshed) | PASS |
| C3117 | start, confirm, finish with only the id; Stripe error skips finish; failure -> card notice | batch, 6 | `web/components/billing/card-flow.test.ts:29` `expect(finish.mock.calls[0]).toEqual(["seti_1AbC"])`; `:35-36` `stripe_error`, `finish` `not.toHaveBeenCalled()`; `:41` failed -> `{ status: "failed" }` (refreshed). The island shows the card notice for `failed`: `web/components/billing/card-update.test.ts:134` (C3139 case `{"status":"failed"}`) | PASS |
| C3118 | key unset -> "Card updates aren't set up yet", no Stripe code, no SetupIntent | batch, 3 | `web/components/billing/billing-view.test.ts:92-93`, `:97`; `web/composition/billing-page-wiring.test.ts:70`, `:72` (carried). Round 1's precision note is closed: `web/components/billing/card-update.test.ts:68` `expect(loadStripe).not.toHaveBeenCalled()` | PASS |
| C3119 | submit disabled with a pending label; one submit control | batch, 2 | `web/components/billing/billing-view.test.ts:102-106`, `:112-113` (carried); in the DOM, `web/components/billing/card-update.test.ts:144` `expect(button("Saving…")?.hasAttribute("disabled")).toBe(true)` | PASS |
| C3120 | cancel = one POST `cancel_at_period_end=true`; resume clears; failures unavailable, logged once without ids | batch, 4 | `web/infrastructure/stripe/billing-gateway.test.ts:300-304`, `:311`, `:316-318` (`errorLog` once at :317) (refreshed) | PASS |
| C3121 | cancel twice and resume twice -> same write, ok | batch | `web/infrastructure/stripe/billing-gateway.test.ts:324` bodies `toEqual(["cancel_at_period_end=true", x2, "cancel_at_period_end=false" x2])` (refreshed) | PASS |
| C3122 | Cancel asks first; Cancel alone calls nothing; only confirm calls cancel once; dismiss calls nothing; Resume or Cancel by state | batch, 5 + C3140 | Static markup: `web/components/billing/billing-view.test.ts:122-152` (carried). Behaviour, now proven in the DOM: `web/components/billing/subscription-controls.test.ts:47` `expect(actions.cancel).not.toHaveBeenCalled()` after Cancel subscription; `:58` the same after Keep subscription; `:66` `expect(actions.cancel).toHaveBeenCalledTimes(1)` only after Yes, cancel; `:118` `expect(button("Cancel subscription")).toBeUndefined()` while ending. Fault 1 (the round-1 survivor) is now killed by 7 C3140 cases. Precision note: C3122's own Proof line still names only `billing-view.test.ts`, which alone would still pass that mutant. The behaviour half rests on C3140 | PASS |
| C3123 | estimator and viewer forbidden on all four actions; ids from org_billing; DB error unavailable | batch | `web/application/use-cases/billing-page.test.ts:78-80`, `:89-90`, `:100-101` (carried; round-1 fault 5 killed) | PASS |
| C3124 | /login redirects; no-arg actions; `seti_` format; no form data | batch | `web/app/(app)/settings/billing/actions.test.ts:48-49`, `:54-55`, `:62-65`, `:70`, `:76-77`, `:83` (carried) | PASS |
| C3125 | each action's result maps to its page state: forbidden -> permission notice; unavailable -> subscription or card notice; success refreshes | batch, 16 + C3139 + C3140 | Action return values: `web/app/(app)/settings/billing/actions.test.ts:99`, `:114`, `:123-125`, `:129-131` (carried). The page mapping, which round 1 found unproven, is now asserted at the page in the DOM. **Subscription islands:** `web/components/billing/subscription-controls.test.ts:93` `expect(container.querySelector('[role="alert"]')?.textContent).toBe(text)` for forbidden and unavailable on cancel; `:109` for a throw; `:128` for forbidden on resume. **Card islands:** `web/components/billing/card-update.test.ts:96` for forbidden and unavailable on start; `:134` for failed and forbidden on finish. **Refresh on success:** `subscription-controls.test.ts:68` and `:122` `expect(refresh).toHaveBeenCalledTimes(1)`; `card-update.test.ts:110`. **No refresh on a notice:** `subscription-controls.test.ts:94`, `card-update.test.ts:135`. The wrong card mapping is fixed at `web/components/billing/card-update.tsx:39` and `:65`; fault 2 was killed | PASS |
| C3126 | menu order, Billing link, no item without record or role | batch, 8 | `web/components/settings/settings-menu.test.ts:49`, `:54-55`, `:59` (carried) | PASS |
| C3127 | no billing card or Manage billing; no portal code | batch, 2 | `web/components/settings/settings-menu.test.ts:65-66`, `:72` (carried) | PASS |
| C3128 | Settings asks the container; billing page links back | batch, 7 | `web/app/(app)/settings/page.test.ts:29-32`, `:39`; `web/components/billing/billing-view.test.ts:84` (carried) | PASS |
| C3129 | selects exactly three columns on the member's client | batch, 3 | `web/infrastructure/supabase/org-billing.test.ts:10`, `:13-15`; `web/composition/index.ts:138` (carried) | PASS |
| C3130 | not_configured with no fetch; Stripe adapter with both | batch, 6 | `web/composition/billing-page-wiring.test.ts:39-42`, `:54-55`; assembly `web/composition/index.ts:137-150` (carried) | PASS |
| C3131 | publishable and secret keys read only in composition | batch | `web/infrastructure/stripe/billing-boundaries.test.ts:54-57`, `:24-29` (carried) | PASS |
| C3132 | exactly the two browser packages; `@stripe/` imports only under components/billing | batch | `web/infrastructure/stripe/billing-boundaries.test.ts:63`, `:66` (carried). The packages are now exact pins (`web/package.json:17-18`), and C3132 still passes with them. `jsdom` is not a Stripe package, so C3132 is unaffected | PASS |
| C3133 | .env.example documents STRIPE_PUBLISHABLE_KEY | batch | `web/infrastructure/stripe/billing-boundaries.test.ts:71-76` (carried) | PASS |
| C3134 | no card input of ours; PaymentElement only | batch | `web/infrastructure/stripe/billing-boundaries.test.ts:82-83` (carried) | PASS |
| C3135 | `loading.tsx` renders a loading state naming "Billing" and "Loading" | batch, 1 | `web/app/(app)/settings/billing/page.test.ts:73-75` `renderToStaticMarkup(createElement(Loading))`, then `expect(out).toContain("Billing")` and `expect(out).toContain("Loading")`. "Loading" comes from `web/components/shell/page-loading.tsx:9` (`Loading…`). Fault 4 (`return null`) was killed: `expected '' to contain 'Billing'` | PASS |
| C3136 | a finish failure leaves the card unchanged | batch, 2 | `web/application/use-cases/billing-page.test.ts:117-119`, `:124` (carried) | PASS |
| C3137 | components/billing reads no env and holds no secret | batch | `web/infrastructure/stripe/billing-boundaries.test.ts:89` (carried). Re-run at 56bc401 with the two new test files under components/billing; still passes | PASS |
| C3138 | live sandbox at 375, 768 and 1440 px: layout, 44 px controls, touch on Update card, Cancel and Resume, 4242 saved, decline message, Cancel then Resume, no console error | vitest half: C3119 ran and passed (`web/components/billing/billing-view.test.ts:112-113`). Live half: AUTHOR-RUN, not re-run and **not re-runnable** (the author deleted the sandbox objects) | **Quoted from the author, not observed by me.** Round 1 (carried): the page showed "Team / Trial / Trial ends Nov 24, 2026" and "Visa ending 4242, expires 11/2027"; the cancel prompt named Nov 24, 2026; Keep changed nothing; Yes, cancel led to "Ends Nov 24, 2026" + Resume, and Resume restored "Trial ends"; Mastercard 4444 saved; 4000 0000 0000 0002 led to "Your card has been declined." with the card unchanged; no horizontal scroll and 44x44 controls at 375 and 768 px; no console errors apart from Stripe's 402 on the decline. Added since round 1: at 1440 px the content has equal 209 px left and right gaps (centred); touch taps on Cancel subscription, Keep subscription, Update card and the card form's Cancel worked at 375 px and, with a short settle, at 768 px; every control was at least 44x44 px at 375 and 768 after the View link fix. **Outstanding:** (1) there is still **no touch tap on Resume** in the record, although the check names it; (2) "no horizontal scroll" at 1440 px is implied by the 209 px gaps but not stated; (3) none of it was observed by the Verifier, and verify.md section 2 does not let an author's run stand in for one; (4) the behaviours the live run carried alone in round 1 (the cancel confirm, card notices, `confirmSetup` with `redirect: "if_required"`, only the SetupIntent id sent) are now proven in vitest by C3140 and C3141. What rests only on the live half is real Stripe acceptance and decline, real layout at three widths, and touch | AUTHOR-RUN (not observed; Resume touch absent; sandbox deleted, so not re-runnable) |
| C3139 | non-owner card actions show "You don't have permission to change this"; forbidden start opens no form; forbidden finish does not refresh; unavailable/failed/mismatch keep the card notice | batch, 6 | `web/components/billing/card-flow.test.ts:12` `toEqual({ status: "forbidden" })` for begin and `:13` unavailable -> `{ status: "failed" }`; `:46` finish forbidden -> `{ status: "forbidden" }`. In the DOM: `web/components/billing/card-update.test.ts:96` `expect(alertText()).toBe(text)` ("You don't have permission to change this" / "We couldn't update your card") and `:97` `expect(button("Save card")).toBeUndefined()`; `:134-135` finish failed / forbidden -> its text, `expect(refresh).not.toHaveBeenCalled()`. `mismatch` maps to `failed` before the island (C3124 at actions.test.ts:76-77, C3117 at card-flow.test.ts:41). Fault 2 killed | PASS |
| C3140 | DOM: Cancel only opens the prompt; Keep calls nothing; only Yes, cancel calls once then refreshes once; second submit while pending no second call; Resume calls resume once, never cancel; forbidden/unavailable/throw show notice, no refresh | batch, 9 | `web/components/billing/subscription-controls.test.ts:46` prompt text `toContain("Service ends on Nov 24, 2026 and you keep access until then.")`, `:47` cancel not called; `:56-58`; `:66`, `:68`; `:77` `button("Cancelling…")` disabled, `:81` `expect(cancel).toHaveBeenCalledTimes(1)` after a second `requestSubmit`; `:120-122`; `:93-94`, `:109-110`, `:128-129`. Fault 1 killed | PASS |
| C3141 | DOM card island: no key -> not set up, no Stripe code; Update card asks once, shows field and Save card; Cancel closes; Save confirms with `redirect: "if_required"`, sends only the id, refreshes once; Stripe error shown, form stays, finish not called; double submit confirms once | batch, 6 | `web/components/billing/card-update.test.ts:66-68`; `:75-78`; `:85-87`; `:107` `expect(confirmSetup.mock.calls[0][0]).toMatchObject({ redirect: "if_required", elements: { id: "elements" } })`, `:109` `expect(actions.finishCardUpdate.mock.calls[0]).toEqual(["seti_1AbC"])`, `:110` refresh once; `:120-123` `toBe("Your card has been declined.")`, finish not called, Save card still there; `:144`, `:146` `expect(confirmSetup).toHaveBeenCalledTimes(1)`. `@stripe/stripe-js/pure` and `@stripe/react-stripe-js` are mocked at :13-22. Faults 3a and 3b killed | PASS |
| C3142 | a failed customer read is `unavailable` with no subscription card, tolerated with one | batch, 1 | `web/infrastructure/stripe/billing-gateway.test.ts:147` `expect(await gateway().overview(IDS)).toEqual({ ok: false, code: "unavailable" })` with `default_payment_method: null`; `:150` `expect(result.ok && result.overview.card?.last4).toBe("4242")` when the subscription has its card. Code: `web/infrastructure/stripe/billing-gateway.ts:97`. Fault 5 killed | PASS |

Amended and deleted approved tests: carried from a75b2b7 for C2510, C2511, C2529, C2904, C3003, C3004, C2916 and C2900 to C2914. Changes since round 1:
- **C2536** (`web/app/billing-docs.test.ts:13`) now pins `/^- \[x\] Stripe Customer Portal/`.
  - The weakening is gone: un-ticking the roadmap line would fail again. The roadmap line is `[x]` (ROADMAP.md:309).
  - The approved C2536 pinned `[ ]` (`git show 97225fd:web/app/billing-docs.test.ts:12`), so this is a flipped expectation on an approved test. It is recorded only in an inline comment and the commit message. It is still missing from the checks.md "How proofs run" amendment list (checks.md:13) and from the plan's Impact `existing tests` row (plan.md:32).
  - It does not pin a billing-page reference on that line, although the line carries one.
  - Judged adequate as a proof and inadequate as a record. Doc drift; does not gate.
- **jsdom 31.0.0** (dev dependency, exact pin, `web/package.json`) is recorded in checks.md:217 ("jsdom, a new dev dependency"). It is not recorded in the plan's Impact `dependency` row (plan.md:29), which lists only the two Stripe packages. It is test-only and outside door 1's scope, so the checks.md line is a sufficient record of the decision. Adding it to the Impact row would be tidier. Does not gate.
- **The plan's Impact numbering** now says C2900 to C2914, which closes the round-1 drift note.

## Coverage

Rows the fix touched were recomputed at 56bc401 from the plan's Surface and Landing and from the code (`subscription-controls.tsx`, `card-update.tsx`, `card-flow.ts`, `loading.tsx`, `billing-gateway.ts`). The other rows are carried from a75b2b7, where they had nothing unproven.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| page states (6) (verified at 56bc401) | page-view kinds + loading | ready C3107 · no_subscription C3110 · not_configured C3110 · error C3110 · invoices unavailable C3108 · loading C3135 (rendered, fault 4 killed) | - |
| outbound reads per plan Surface (4) (verified at 56bc401) | plan.md:52 (corrected), billing-gateway.ts:76-78, :120 | subscriptions C3105 · customers C3105 C3142 · invoices C3105 · setup_intents C3114 | - |
| outbound read failures -> `unavailable` (4 endpoints) (verified at 56bc401) | plan Surface "anything else is unavailable", billing-gateway.ts:81, :97 | subscription C3109 · invoices C3108 (partial by design, AC 10) · setup_intents C3115 · customers C3142 (unavailable with no subscription card; tolerated with one, so a card is never silently dropped) | - |
| action outcome -> notice shown on page (verified at 56bc401) | AC 13, 23, 24; subscription-controls.tsx:35-38 (one mapping shared by cancel and resume); card-update.tsx:39, :65; card-flow.ts | cancel: forbidden, unavailable, throw, success refresh C3140 · resume: forbidden, success refresh C3140 (resume-unavailable goes through the same `run` mapping at :38 as cancel-unavailable, which is asserted) · start: forbidden, unavailable C3139 · finish: failed, forbidden C3139, Stripe error C3141, success refresh C3141 | - |
| cancel two-step interaction (3) (verified at 56bc401) | AC 19, subscription-controls.tsx:55 | start asks only C3140 :47 · confirm calls once C3140 :66 · dismiss calls nothing C3140 :58 · fault 1 killed | - |
| Landing door 1 literal (4) (verified at 56bc401) | plan.md:59 + amendment :63 | two packages C3132 · key name and location C3131 C3133 · Payment Element C3134 · `confirmSetup` with `redirect: "if_required"` C3141 :107 (fault 3a killed) | - |
| card flow outcomes (5) (verified at 56bc401) | card-flow.ts `BeginResult`, `CompleteResult` | ready C3117 · saved C3117 C3141 · stripe_error C3117 C3141 · failed C3117 C3139 · forbidden C3139 | - |
| outbound writes (3 endpoints) and failures (carried from a75b2b7, re-read at 56bc401) | plan.md:53, billing-gateway.ts:125-127 | setup_intents C3113 (+400) · customers default C3114 (+500) · subscriptions default C3114 · cancel/resume flag C3120 (+500). The subscription write in `finishCardUpdate` failing after the customer write succeeded is still not driven (see the Adapter row) | - |
| responsive and touch (3 widths x layout and 44 px; touch on 3 controls) (verified at 56bc401 against the author's added record) | AC 28, C3138 | author-run, not observed: 375, 768 and 1440 px now recorded; touch on Update card and Cancel recorded; none observed by the Verifier | touch tap on Resume (absent from the author's record); the live half as a whole is unobserved and can no longer be re-run |
| Stripe statuses (9), status -> actions (9), date line (5), page statuses (3), Server Action statuses, SetupIntent refusals (6), roles at page (4) and actions (16), Landing doors 2 and 3, `org_billing` columns (3), Relations, container assembly (carried from a75b2b7) | as in round 1 | as in round 1 | - |

Swept rows that resolve to existing guards: carried from a75b2b7. Those are the RLS `org_billing_select` policy, `STRIPE_TIMEOUT_MS = 10_000`, the pinned version and the fixed log labels. The fix did not touch `http.ts` or the migration.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (re-judged at 56bc401, `card-flow.ts` touched) | `domain/billing/overview.ts`, `application/use-cases/billing-page.ts`, `components/billing/card-flow.ts` | own layer | yes - card-flow now has its forbidden rows (card-flow.test.ts:12, :46) beside ready, failed, throw, stripe_error and saved |
| Entry point that decides nothing (carried from a75b2b7) | `page.tsx`, `actions.ts`, `app/(app)/settings/page.tsx` | boundary | yes |
| Adapter (re-judged at 56bc401) | `infrastructure/stripe/billing-gateway.ts`, `infrastructure/supabase/org-billing.ts` | fetch or client double | no - the customer-read half of the round-1 gap is closed (C3142, fault 5 killed). The other half is not. In `finishCardUpdate`, a subscription-default write that fails after the customer write succeeded is never driven: the C3114 failure test stubs every write as 500 (billing-gateway.test.ts:292), so the customer write fails first and returns at billing-gateway.ts:126. By reading, changing billing-gateway.ts:127 to ignore that write's answer and return `{ ok: true }` would pass C3114, C3115 and C3116. A card would then be reported saved while the subscription's own default, which wins at Stripe, still names the old card. I did not inject it because the cap of 5 was reached |
| Presentational component (re-judged at 56bc401) | `billing-view.tsx`, `billing-parts.tsx`, `subscription-controls.tsx`, `card-update.tsx`, `loading.tsx` | one markup test per state | yes - the islands now have DOM tests per state. `SubscriptionControls` has closed, confirming, pending, each notice and ending/Resume (C3140). `CardUpdate` has no key, closed, form open, saving, Stripe error and each notice (C3139, C3141). Loading renders its text (C3135). The view's static states are carried (C3107, C3108, C3110, C3118, C3119, C3122). Faults 1, 2, 3 and 4 were killed |
| Instrumentation, pass-throughs (carried from a75b2b7) | `components/billing/state.ts` | none | yes |

## Faults injected

Verified at 56bc401, run in a scratch worktree.

Isolation:
- Worktree: `git worktree add --detach <scratchpad>\wt HEAD` at 56bc401, with `web\node_modules` junctioned to the real one.
- Real tree `git status --porcelain` before: `?? .specs/features/billing-portal/verification.md`.
- Real tree after: the same line plus `?? .specs/features/plan-change/`, the author's concurrent unrelated planning. The brief says to ignore it, and the worktree never wrote to it. Excluding that path, before and after are identical.
- Each fault was reverted with `git checkout -- <file>` inside the scratch, and the scratch porcelain was empty before removal.
- The junction was removed with `rmdir`; the real `node_modules` is intact (`web\node_modules\vitest` exists).
- The worktree was removed with `git worktree remove --force`.
- `git stash list` is empty; no stash was used.

| Mutation | Location | Killed |
| --- | --- | --- |
| Round-1 survivor re-run. Cancel skips the confirm: `onStart={() => setConfirming(true)}` -> `onStart={() => void run(actions?.cancel)}`. Ran `subscription-controls.test.ts billing-view.test.ts -t "C3140:\|C3122:"`: 7 C3140 cases failed (e.g. `expected 'Cancel subscription' to contain 'Service ends on Nov 24, 2026 and you …'`, `no button "Yes, cancel"`). The 5 static C3122 cases still pass | `web/components/billing/subscription-controls.tsx:55` | yes |
| A forbidden start shows the card notice: `else setNotice(begun.status === "forbidden" ? BILLING_MESSAGES.forbidden : BILLING_MESSAGES.card)` -> `else setNotice(BILLING_MESSAGES.card)`. Ran `card-update.test.ts -t "C3139:"`: 1 failed, `expected 'We couldn't update your card' to be 'You don't have permission to change …'` | `web/components/billing/card-update.tsx:65` | yes |
| `confirmSetup` surface, two variants on one surface: (a) `redirect: "if_required"` -> `redirect: "always"` gave 1 failed, `expected {…} to match object { redirect: 'if_required', … }`; (b) the id sent to finish -> `String(confirmed.setupIntent.payment_method ?? "pm_from_browser")` gave 1 failed, `expected [ 'pm_from_browser' ] to deeply equal [ 'seti_1AbC' ]`. Both ran `card-update.test.ts -t "C3141:"` | `web/components/billing/card-update.tsx:31`, `:33` | yes |
| The loading screen renders nothing: `return <PageLoading title="Billing" />` -> `return null`. Ran `page.test.ts -t "C3135:"`: 1 failed, `expected '' to contain 'Billing'` | `web/app/(app)/settings/billing/loading.tsx:4` | yes |
| The gateway tolerates a failed customer read with no card: removed `if (!customer.ok && !subscriptionCard) return unavailable;`. Ran `billing-gateway.test.ts -t "C3142:"`: 1 failed, `expected { ok: true, overview: {…} } to deeply equal { ok: false, code: 'unavailable' }` | `web/infrastructure/stripe/billing-gateway.ts:97` | yes |

Carried from a75b2b7 (code untouched since):
- item-level period end, billing-gateway.ts:91: killed.
- another customer's SetupIntent, :124: killed.
- role gate, billing-page.ts:28: killed.

The round-1 loading and cancel survivors are re-run above and now killed.

Not injected, because the cap of 5 was reached: ignoring the subscription-default write's answer in `finishCardUpdate` (billing-gateway.ts:127). The Test policy row argues by reading that it would survive.

## Gate

Verified at 56bc401. `npx vitest run` (the full suite, no filter) in the clean scratch worktree of HEAD (`C:\...\scratchpad\wt\web`, porcelain empty before the run): exit 0, 227 files passed, 4121 tests passed, 0 failed.

The C3138 live half was not run by me. It is author-run, and the sandbox objects it used have been deleted.

## Ranked gaps

1. **C3138's live half is unobserved and can no longer be re-run** (C3138, AC 28).
   - The author's record still lacks a touch tap on **Resume**, which the check names. It states the 1440 px centring, but not explicitly "no horizontal scroll" at 1440.
   - The sandbox objects are deleted, so the next round cannot close this with the current fixtures. The owner must either authorise a fresh sandbox run that includes a Resume tap, or amend C3138 to accept the author-run record and say so explicitly.
   - Everything the live run carried alone in round 1 except real-Stripe behaviour, real layout and touch is now proven in vitest (C3140, C3141).
   - No evidence observed by the Verifier.
2. **The Adapter Test policy row is still unmet** (C3114 surface).
   - A subscription-default write that fails after the customer write succeeded is never driven: `web/infrastructure/stripe/billing-gateway.ts:127`, test at `web/infrastructure/stripe/billing-gateway.test.ts:291-294`, where every write is stubbed as 500.
   - A mutant that ignores that answer would report the card saved while the subscription keeps the old default.
   - Fix: a test with the customer POST answering 200 and the subscription POST answering 500, which expects `unavailable`.
3. **Record drift, which does not gate.**
   - The C2536 flip from `[ ]` to `[x]` is not listed in checks.md:13 or plan.md:32.
   - `jsdom` is not in the plan's Impact dependency row (plan.md:29).
   - The plan's Impact `env` row (plan.md:30) and door 1's literal (plan.md:59) still name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; the amendment bullet at :63 covers it.
   - C3122's and C3125's own Proof lines still name only their round-1 files. The behaviour they claim is proven by C3140 and C3139, and naming those files in the Proof lines would make the link explicit.
