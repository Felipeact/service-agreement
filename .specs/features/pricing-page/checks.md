# Pricing page checks

Profile: standard
Plan: `.specs/features/pricing-page/plan.md`

36 checks in 4 slices · 3 one-way doors · 4 open, of which 2 block go-live and none blocks the build

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C2401:`). This feature numbers from C2401, as `.specs/STATE.md` Handoff asks (the highest id in use is C2316). `npx vitest run <file> -t "C2401:"` selects one. The include pattern is `**/*.test.ts`, so a component is rendered with `createElement` and `renderToStaticMarkup`, as `app/login/login.test.ts` does.
- **Test files** (named in each proof): `proxy.pricing.test.ts`, `domain/billing/index.test.ts`, `application/use-cases/start-trial.test.ts`, `application/ports/checkout-starter.types.test.ts`, `app/pricing/pricing.test.ts`, `app/pricing/pricing-catalog.test.ts` (its own file because it mocks `@/domain/billing` for the whole file), `app/pricing/pricing-action.test.ts`, `app/pricing/pricing-docs.test.ts`, `composition/billing-container.test.ts`, and two assertions at the end of `supabase/tests/starter_packs.sql`, run by `npm run test:db starter_packs`.
- **Expected values are copied from the plan**, never read back from the source: plan names and figures, the four refusal texts, the trial line, the trade labels and codes.
- **Live proofs** (C2427 to C2431) are the Playwright MCP validation `AGENTS..md` requires for any change under `web/`: one signed-in-or-out context kept open (see the memory note on a single Playwright context), `browser_resize`, `browser_snapshot`, no screenshots, nothing committed. They are reported in the verification.
- **`tsc` proofs** (C2426, C2433) run `npx tsc --noEmit` from `web/`; the file that C2426 names carries `@ts-expect-error` lines, so a port that grows a code fails the compile.
- **The `303` on the wire** needs a Checkout url, and the only starter until billing-checkout answers `not_configured`. C2415 proves the action calls `redirect(url)` once, and C2436 proves the status in a production build of a scratch worktree whose starter is swapped for one answering an https url (the swap is never committed). Next's docs say a Server Action `redirect` is a client-side navigation with JavaScript and a `303` for a plain form post (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`).

## Checks

### S1 - Anyone can read the plans · 6 files · 30 KB · ~8k

**C2401** - A signed-out `GET /pricing` through `proxy` answers `200` with no `location` header (plan AC 1, door 1)
Proof: `npx vitest run proxy.pricing.test.ts -t "C2401:"`

**C2402** - A signed-in `GET /pricing` through `proxy` answers `200` with no `location` header, not a redirect to `/pipeline` (plan AC 2)
Proof: `npx vitest run proxy.pricing.test.ts -t "C2402:"`

**C2403** - Signed out, `/pricing/x`, `/pricingx` and `/pricing/x/y` redirect (`307`) to `/login`, while `/pricing?plan=team` still answers `200` (the public path is the exact `/pricing`; a query is not part of it) (plan AC 3, door 1)
Proof: `npx vitest run proxy.pricing.test.ts -t "C2403:"`

**C2404** - The rendered page lists exactly three plans in the order Starter, Team, Business, and each plan's block contains its price, live-agreement limit, AI-import figure and "Unlimited seats": Starter $49 / 15 / 10, Team $99 / 60 / 40, Business $199 / 200 / 120 (plan AC 4)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2404:"` (table-driven over the 3 plans)

**C2405** - With `PLANS` in `@/domain/billing` replaced by a catalog of one plan named "Zeta" at 12,300 cents with limits 7 and 9, the page shows "Zeta", "$123", "7" and "9" and none of "$49", "$99", "$199", "Starter", "Team" or "Business" (the page takes every name, price and limit from the catalog) (plan AC 5)
Proof: `npx vitest run app/pricing/pricing-catalog.test.ts -t "C2405:"`

**C2406** - The page text contains "14-day free trial. A card is required to start, and billing is monthly after the trial." exactly once, and it appears before the first plan's name (plan AC 6)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2406:"`

**C2407** - The rendered page text contains none of "trusted by", "most popular", "best value", "testimonial" or "save", case-insensitive (plan AC 7)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2407:"`

**C2408** - The scan that C2407 uses reports each of the five banned strings when run on a sample text containing it (in a different case), and reports none for the page's own trial line (the scan can fail) (plan AC 7)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2408:"` (table-driven over the 5)

**C2409** - The page has exactly one link whose text is "Sign in", and its `href` is `/login` (plan AC 8)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2409:"`

**C2410** - The page's `metadata.title` is "Pricing" and, through the root layout's title template, reads "Pricing · Service Agreement" (plan AC 9)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2410:"`

**C2411** - The rendered page, with its form, contains no "equipment" (case-insensitive) in any state of the form (idle and the four refusals) (plan AC 9)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2411:"` (over the 5 states)

### S2 - Pick trades and a plan and be handed on · 9 files · 55 KB · ~16k

**C2412** - The form has exactly four checkboxes named `trade`, in the order "Heating and cooling" (`hvac`), "Plumbing" (`plumbing`), "Electrical" (`electrical`), "Other" (`other`), each with a visible label of that text, and none is checked in the idle state (plan AC 10)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2412:"`

**C2413** - The form has exactly three submit buttons named `plan`, with the values `starter`, `team`, `business` in that order, each with visible text "Start 14-day trial" and accessible name "Start 14-day trial, Starter plan", "Start 14-day trial, Team plan" and "Start 14-day trial, Business plan" (plan AC 11)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2413:"` (table-driven over the 3)

**C2414** - A submit with a known plan and known trades calls `CheckoutStarter.start` exactly once with `{ plan, trades }`, the trades de-duplicated and in the order `hvac`, `plumbing`, `electrical`, `other`: `["other","hvac","hvac","plumbing"]` becomes `["hvac","plumbing","other"]`, one trade stays one, all four stay four, and five values with repeats collapse to the distinct ones in order (plan AC 12)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C2414:"` (use case over 5 inputs)
Proof: `npx vitest run domain/billing/index.test.ts -t "C2414:"` (`parseCheckoutSelection` over the same 5)
Proof: `npx vitest run app/pricing/pricing-action.test.ts -t "C2414:"` (a `FormData` with `plan=team` and `trade` repeated in shuffled order reaches the starter as the ordered array)

**C2415** - When the starter answers `{ ok: true, url: "https://checkout.example.com/c/pay_1" }` the action calls Next's `redirect` once with exactly that url and returns no refusal state (plan AC 13; the wire status is the framework's, see How proofs run)
Proof: `npx vitest run app/pricing/pricing-action.test.ts -t "C2415:"`
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C2415:"` (the use case answers a redirect outcome carrying the url, and calls the starter once)

**C2416** - A submit with a valid plan and no trade never calls the starter and answers the state `no_trade`; the page then shows "Choose at least one trade." inside the trades fieldset (plan AC 14)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C2416:"`
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2416:"`

**C2417** - A submit with a forged value never calls the starter and answers the state `invalid_choice`, and the page then shows "Choose a plan and your trades again.": plan missing, plan `enterprise`, plan `Team` (wrong case), plan sent as a `File`, trade `fire`, trade empty, trade `HVAC` (wrong case), a valid trade beside an unknown one, trade sent as a `File`. A bad plan with no trades is `invalid_choice`, not `no_trade` (plan AC 15)
Proof: `npx vitest run domain/billing/index.test.ts -t "C2417:"` (`parseCheckoutSelection` over the 9 inputs and the precedence)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C2417:"` (starter not called, over the 9)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2417:"` (the text)

**C2418** - When the starter answers `{ ok: false, code: "not_configured" }` the outcome is the state `not_configured` and the page shows "Sign-up isn't open yet. Please check back soon." (plan AC 16)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C2418:"`
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2418:"`

**C2419** - The outcome is the state `unavailable` and the page shows "We couldn't start sign-up. Try again in a minute." when the starter answers `{ ok: false, code: "unavailable" }`, throws, or answers `ok` with a url that is not `https:` (`http://checkout.example.com/c/1`, `javascript:alert(1)`, `//evil.example/x`, an empty string, `not a url`); each of these seven cases writes exactly one `console.error` line, and no logged argument contains the selection's values (plan `business` and trade `electrical`) or the url's path (plan AC 17)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C2419:"` (over the 7 cases, with a spy on `console.error`)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2419:"` (the text)

**C2420** - While any of the four refusals is shown, the checkboxes the visitor ticked are still checked and the others are not: ticked `hvac` and `other` stay checked, `plumbing` and `electrical` stay unchecked; and the action returns the known trades it received in the refusal state, leaving out a forged value (plan AC 18)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2420:"` (render over the 4 refusals)
Proof: `npx vitest run app/pricing/pricing-action.test.ts -t "C2420:"` (state carries `["hvac","other"]` for a post of `hvac`, `fire`, `other`)

**C2421** - While a submit is pending all three plan buttons are disabled, the pressed plan's button reads "Starting…" and the other two keep "Start 14-day trial"; at rest none is disabled (plan AC 19)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2421:"` (rest, then pending with each of the 3 plans pressed)

**C2422** - `getBillingContainer()` builds with none of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` set, calls no `cookies()`, no `connection()` and no Supabase client constructor, and its start-trial answers the state `not_configured` for every plan (`starter`, `team`, `business`) with one trade and with all four (plan AC 20)
Proof: `npx vitest run composition/billing-container.test.ts -t "C2422:"` (over the 6 selections)

**C2423** - Each of the four refusal texts is inside an element with `role="alert"`, and the idle form has no `role="alert"` element (plan AC 21)
Proof: `npx vitest run app/pricing/pricing.test.ts -t "C2423:"` (over the 4 refusals and idle)

**C2424** - `PLAN_KEYS` is exactly `["starter","team","business"]` and `TRADE_CODES` exactly `["hvac","plumbing","electrical","other"]`; `PLANS` has one entry per key in that order, each with a display name that differs from its key; `TRADES` has one entry per code in that order, each with a label that differs from its code (door 2)
Proof: `npx vitest run domain/billing/index.test.ts -t "C2424:"`

**C2425** - The packs released in `private.catalog_packs` are exactly `electrical`, `hvac` and `plumbing`, so the first three trade codes of C2424 are the released packs, and `other` is not a registered pack (door 2)
Proof: `cd web && npm run test:db starter_packs` (the last row is `starter_packs: pass`; the two C2425 assertions sit at the end of `supabase/tests/starter_packs.sql`, beside the pack-release checks)

**C2426** - The `CheckoutStarter` port takes `{ plan: PlanKey; trades: TradeCode[] }` and returns only `{ ok: true; url: string }`, `{ ok: false; code: "not_configured" }` or `{ ok: false; code: "unavailable" }`: a fake typed as the port compiles for each of the three, and a fake returning code `"rejected"` or a Stripe-shaped object fails with `@ts-expect-error` standing guard (door 3)
Proof: `cd web && npx tsc --noEmit` exits 0, with `application/ports/checkout-starter.types.test.ts` in the compile (it carries the three accepted fakes and the two `@ts-expect-error` lines); and `npx vitest run application/ports/checkout-starter.types.test.ts -t "C2426:"` runs its one runtime test, which asserts the file's three fakes return the three shapes

### S3 - It works on every screen · live, nothing committed · ~3k

**C2427** - At 375, 768 and 1440 px wide, `/pricing` has `document.documentElement.scrollWidth <= window.innerWidth`, and no element of the page has a bounding box outside the viewport horizontally (plan AC 22)
Proof: live Playwright MCP run per `AGENTS..md`: `browser_navigate` to `/pricing`, `browser_resize` to each width, `browser_evaluate` the scroll-width comparison and the box test over every element, `browser_snapshot` to read the page. Reported in the verification, not committed

**C2428** - At 375 and 768 px wide every button, every link and every checkbox's label (the whole tappable row) on `/pricing` measures at least 44 by 44 px (plan AC 23)
Proof: live Playwright MCP run: `browser_evaluate` of `getBoundingClientRect()` over `button`, `a` and `label` with a checkbox inside, at each width; the three plan buttons, the "Sign in" link and four trade labels are all listed in the report

**C2429** - At 375, 768 and 1023 px wide the three plans are in one column in the order Starter, Team, Business (equal left edge, increasing top edge), and at 1024 and 1440 px they are in three columns (equal top edge, increasing left edge), in the same order (plan AC 24)
Proof: live Playwright MCP run: `browser_resize` to each of the 5 widths and `browser_evaluate` of the three plan blocks' rectangles

**C2430** - On touch emulation at 375 and 768 px, tapping a trade checkbox toggles it and tapping a plan button submits the form, with nothing depending on hover; and at all three widths `browser_console_messages` has no error or warning and `browser_network_requests` shows no request that fails with an error status or gets no response (`AGENTS..md` rules 4 and 5); a Server Action `POST` that Chrome reports as `net::ERR_ABORTED` after it already returned `200` is Next's own client behaviour, identical on the existing `/login`, and does not count (amended 2026-11-09 with the owner's approval, see Handoff)
Proof: live Playwright MCP run: `browser_run_code_unsafe` with `hasTouch`/`isMobile`, `browser_click` taps, then the console and network reads. Reported in the verification, not committed

**C2431** - In a real browser against the real Server Action: pressing Team with nothing ticked shows "Choose at least one trade."; ticking "Plumbing" and "Electrical" and pressing Team shows "Sign-up isn't open yet. Please check back soon." with exactly those two still checked and the other two unchecked; the plan figures are unchanged afterwards (plan AC 14, 16, 18 through Next's wiring)
Proof: live Playwright MCP run at 1440 px: `browser_click`, `browser_snapshot` and `browser_evaluate` of the checkboxes' `checked`. Reported in the verification, not committed

**C2436** - In a production build (`next build`, `next start`) of a scratch copy of `HEAD` whose only change is a starter answering `{ ok: true, url: "https://checkout.example.com/c/pay_1" }`, a plain form post with JavaScript disabled (plumbing ticked, the Team button pressed) gets `POST /pricing` answered `303` with `Location: https://checkout.example.com/c/pay_1` (plan AC 13 on the wire; the status in Surface)
Proof: live run in a scratch `git worktree` outside the repo (copy `web/node_modules` and `web/.env.local` in, edit only the starter in `web/composition/index.ts`), `playwright-core` with `javaScriptEnabled: false`, reading the POST response's status and `location` header. Reported in the verification, not committed; the scratch is removed afterwards

### S4 - The change leaves the repo consistent · 5 files · 140 KB read in part · ~12k

**C2432** - `app/product-copy.test.ts` and `domain/purity.test.ts` are unchanged since the base commit, and their C2305 and C2021 tests pass with the new files in place (the trade labels carry no "HVAC" and the page says no "equipment"; no allowlist row was added)
Proof: `cd web && git diff --quiet 2717595 HEAD -- app/product-copy.test.ts domain/purity.test.ts && npx vitest run app/product-copy.test.ts domain/purity.test.ts -t "C2305:|C2021:"` (exit 0)

**C2433** - The whole web project passes its own gates: `npx tsc --noEmit`, `npx eslint` and `npx vitest run` all exit 0 (the layer rules of AD-010 and AD-014 hold for `domain/billing`, the port, the use case and the composition function)
Proof: `cd web && npx tsc --noEmit && npx eslint && npx vitest run` (exit 0)

**C2434** - `CONTEXT.md` has an entry for the pricing page (what it is, what was built, with links to the files) and a Build log line dated 2026-11-09 that names `pricing-page` (`AGENTS..md` Context rule)
Proof: `npx vitest run app/pricing/pricing-docs.test.ts -t "C2434:"`

**C2435** - `.specs/STATE.md` has one active decision row whose text names `/pricing`, `AD-072`, `PLAN_KEYS`, `TRADE_CODES` and `CheckoutStarter` (plan Impact and the note under Landing)
Proof: `npx vitest run app/pricing/pricing-docs.test.ts -t "C2435:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plans (3) | Starter C2404, C2413, C2421 · Team C2404, C2413, C2421 · Business C2404, C2413, C2421 | - |
| plan figures shown (15) | all 5 for each of the 3 plans in C2404 (table-driven, 15 cells); the catalog-driven rendering in C2405 | - |
| trades (4) | `hvac` C2412, C2414, C2420 · `plumbing` C2412, C2414, C2420 · `electrical` C2412, C2414, C2420 · `other` C2412, C2414, C2420 | - |
| trades submitted, bound (4 edges) | 0 C2416 · 1 C2414 · 4 C2414 · repeats beyond 4 values C2414 | - |
| starter answers (5) | ok with https url C2415 · ok with a non-https url C2419 · `not_configured` C2418 · `unavailable` C2419 · throws C2419 | - |
| non-https urls (5) | `http://` C2419 · `javascript:` C2419 · `//evil.example/x` C2419 · empty C2419 · `not a url` C2419 | - |
| forged inputs (9) | plan missing C2417 · plan `enterprise` C2417 · plan `Team` C2417 · plan as File C2417 · trade `fire` C2417 · trade empty C2417 · trade `HVAC` C2417 · valid beside unknown C2417 · trade as File C2417 | - |
| form states (5) | idle C2411, C2412, C2423 · `no_trade` C2416, C2423 · `invalid_choice` C2417, C2423 · `not_configured` C2418, C2423 · `unavailable` C2419, C2423 | - |
| refusal text and place (4) | `no_trade` text C2416 · `invalid_choice` text C2417 · `not_configured` text C2418 · `unavailable` text C2419; each in `role="alert"` C2423; each keeps the ticked trades C2420; each free of "equipment" C2411 | - |
| banned strings (5) | `trusted by` C2407, C2408 · `most popular` C2407, C2408 · `best value` C2407, C2408 · `testimonial` C2407, C2408 · `save` C2407, C2408 | - |
| `GET /pricing` statuses (1) | 200 C2401, C2402, C2403 (query still 200) | - |
| `POST /pricing` statuses (2) | 303 C2415 (`redirect(url)` called), C2436 (the status and `Location` on the wire) · 200 with a refusal C2416, C2417, C2418, C2419, C2431 | - |
| `POST /pricing` inputs (2) | `plan` C2413, C2414, C2417 · `trade` (repeatable) C2412, C2414, C2417, C2420 | - |
| signed-out paths through the proxy (5) | `/pricing` C2401 · `/pricing?plan=team` C2403 · `/pricing/x` C2403 · `/pricingx` C2403 · `/pricing/x/y` C2403 | - |
| one-way doors (3) | door 1 public exact path C2401, C2402, C2403 · door 2 identifiers C2424, C2425 · door 3 port shape C2426 | - |
| port result shapes (3) | `ok` + url C2426 · `not_configured` C2426 · `unavailable` C2426 | - |
| viewport widths, no overflow (3) | 375 C2427 · 768 C2427 · 1440 C2427 | - |
| viewport widths, touch targets (2) | 375 C2428 · 768 C2428 | - |
| viewport widths, stacking (5) | 375 C2429 · 768 C2429 · 1023 C2429 · 1024 C2429 · 1440 C2429 | - |
| touch and console widths (3) | 375 C2430 · 768 C2430 · 1440 C2430 (console and network; taps at 375 and 768) | - |
| startup configuration: the billing container (1 assembly) | `getBillingContainer()` built with no environment C2422; the page and action reach it only through `@/composition` (mocked in C2414, C2415, C2420, which proves the call site, and unmocked in C2422, which proves the assembly) | - |
| `TRADE_CODES` that are released packs (3) | `hvac` C2425 · `plumbing` C2425 · `electrical` C2425 (`other` asserted absent C2425) | - |
| docs and decisions (3) | CONTEXT.md entry C2434 · CONTEXT.md build log C2434 · STATE.md decision C2435 | - |

- Claims naming an exact string: C2404, C2405, C2406, C2410, C2413, C2416, C2417, C2418, C2419; each asserts the whole string
- Claims naming a status or boundary: C2401, C2402, C2403 (HTTP through `proxy`), C2415 (the `redirect` call at the action boundary), C2431 (the real action in a browser), C2436 (the `303` on the wire)
- C2427 to C2431 and C2436 are the only proofs that are not committed tests; they are the `AGENTS..md` live validation
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides (`parseCheckoutSelection`, `makeStartTrial`, the url scheme test) | one at its own layer, and one at the boundary the action crosses | one asserted case per row of the decision table: 5 accept shapes, 9 forged shapes, no trade, 5 starter answers, 5 non-https urls |
| Entry point that decides nothing but maps (`app/pricing/actions.ts`) | one at the boundary | accepted input (repeated `trade`), the redirect, each refusal state it returns, the known trades it echoes |
| Decides, presentation (the fields component: which text, which `role`, which boxes are checked, which button is disabled) | one at its own layer over every state | every state of the form and every plan |
| Static catalog (`PLANS`, `TRADES`, `PLAN_KEYS`, `TRADE_CODES`) | one at its own layer | the exact identifiers (door 2) and the catalog-driven page (C2405) |
| Instrumentation (`getBillingContainer`, the proxy path list, the page's markup that forwards the catalog) | none of its own beyond C2422, C2401 to C2403, C2404 | covered by the consumer's proof |

Evidence:

- `domain/billing` `parseCheckoutSelection` (planned): one plan check, a trade set check against `TRADE_CODES`, a de-duplication, an ordering, and the precedence of `invalid_choice` over `no_trade` -> about 6 branch points, decides
- `application/use-cases/start-trial.ts` (planned): parse, call, a scheme test on the url, a catch, a log -> about 5 branch points, decides
- `infrastructure/supabase/session.ts` `redirectTarget`: 3 branch points over `PUBLIC_PATHS` and `PUBLIC_PREFIXES`; the edit adds one list member -> instrumentation of the new member, proven through the proxy (C2401 to C2403), the closest analogue being `proxy.webhooks.test.ts` C1737 (one path through, three near-misses that still redirect)
- `app/login/login-fields.tsx` and `login.test.ts` C4 to C7: the same shape as the fields component, already proven by rendering each state; the pricing fields copy that
- `application/use-cases/invite-member.test.ts` C1514: the closest analogue for a use case over a port with a table of outcomes (9 rows)

Cost: 3 decision proofs at their own layer (domain parse, use case, fields over its states) plus 2 boundary proofs (action, proxy), 5 test files and 1 SQL file. Without the own-layer rows a path through the action that happened to traverse a forged value would stand for the 9-row table.

## Swept

- validation: C2417 (plan and trades from the form are whitelisted against `PLAN_KEYS` and `TRADE_CODES`, nine forged shapes, precedence over "no trade"), C2414 (bounds: 0, 1, 4 and repeats), C2419 (a Checkout url must be `https:`)
- failure modes: C2419 (the starter answers `unavailable`, throws, or hands back a bad url: one message, one log line, no selection in the log), C2418 (not configured)
- idempotency: n/a - a repeated submit calls the starter again and persists nothing, so it is safe to retry; billing-checkout owns idempotency of session creation (plan Observable, rate limit row)
- authorization: C2401, C2402, C2403 (public to everyone, signed in or not, and only the exact path; the route reads no member and the container no cookie, C2422)
- concurrency: C2421 (a double press is blocked in the page while pending); n/a on the server - the starter has no shared state today, and a duplicate Checkout session is billing-checkout's to dedupe
- data lifecycle: n/a - nothing is stored; the selection lives for one submit (plan Impact, stored data)
- dependency failure: C2419 (the starter is the only dependency, and every failure of it ends in `unavailable`), C2422 (the container needs nothing external)
- state transitions: n/a - no status or state machine is touched; the form's five states are presentation, proven by C2411, C2420, C2423
- observability: C2419 (one `console.error` line per failure, with no selection or url in it); n/a for metrics - no requirement in this slice

## Out of scope

Plan `## Out of scope` is the record: Stripe, provisioning, the returning-email refusal, plan-limit enforcement, a comparison table, annual price and discount claims, "Other" catalog drafting, any link to `/pricing`, brand work, Quebec and other currencies, and a remembered choice.

## Handoff

- S1 = ~8k: `session.ts` 3 KB, `layout.tsx` 1 KB, new `domain/billing` ~4 KB, new page and fields ~10 KB, 3 test files ~14 KB. S2 = ~16k: `app/login` 6 KB read as the pattern, `composition/index.ts` 14.6 KB (one function added), `application/ports/index.ts` 52 KB read in part (one port added), new use case ~3 KB, action and state ~3 KB, 5 test files ~25 KB, SQL test and `runner.mts` recipe ~6 KB. S3 = ~3k (live). S4 = ~12k: `CONTEXT.md` 132 KB and `STATE.md` 37 KB read by section only, one new docs test ~2 KB. Whole-file worst case 391 KB / 4 = ~98k; as read ~40k. Under the 150k budget - one builder
- Mechanism: one builder
- **Settled mid-build:** C2425's proof moved from a new `pricing_trades` recipe to the end of `starter_packs.sql`: `web/scripts/test-db/runner.test.ts` pins the recipe list and its count (27), so a new recipe would have meant editing ten approved assertions of an earlier feature. Same claim, same assertions, a different file; no other check changed
- The UI is built with `/impeccable` (AGENTS..md), to DESIGN.md and PRODUCT.md on existing tokens (AD-002), inside S2's page and fields files; it changes no check
- **Boundary:** C2401-C2435 built at `0ee84e1` (feature code, tests and the C2425 assertions) with the docs commit after it; vitest 194 files, 3,660 tests, `tsc --noEmit` and `eslint` clean, `npm run test:db starter_packs` green; C2427-C2431 run live on 2026-11-09 (see Abandoned for the browser used)
- **Abandoned:** a new `pricing_trades` SQL recipe (see Settled mid-build). The Playwright MCP browser was locked by another session's Chrome (profile `mcp-chrome-e837010`, started 10:05), so the live checks ran through `playwright-core` from the same `@playwright/mcp` package in a fresh temporary profile, driven by a script in the session scratchpad (page evaluation only, no screenshot saved, the profile deleted). The same widths, touch taps, console and network reads and the real Server Action run were made; the one false alarm was a second `[role="alert"]` that is Next's empty route announcer, not a page element
- **UI route:** `/impeccable` was loaded but its concept round was not run: the page is a precisely specified surface inside the established world (DESIGN.md tokens, plan AC 10 to 24 fix its structure). The design detector found nothing on `web/app/pricing`; the finish reviewer was not spawned
- **Round 1 (Verifier FAIL) and its fixes:** (1) a surviving mutant on the port's input side: the types test gained three `@ts-expect-error` lines, so `start(selection: unknown)` now fails tsc (`64b436c`); (2) the Test policy row for the action lacked `unavailable`: the action test now drives it, and a throwing starter (`64b436c`); (4) the Coverage row listed `303` as proven with only the `redirect()` call behind it: C2436 is new and additive, and proved `303` with `Location: https://checkout.example.com/c/pay_1` on 2026-11-09. No other check changed
- **C2430 and `net::ERR_ABORTED`:** the Verifier saw Chrome report `POST /pricing net::ERR_ABORTED` after a delivered `200` on repeat submits. It is not the pricing page: the existing `/login` action does the same, in dev and in a production build (4 submits each, 2026-11-09), and the UI result is always correct. C2430's text says "no failed request"; whether that excludes a Server Action post that Next's own client aborts after its `200` is a change to a frozen check, so it is the owner's call and is left open
- **Settled mid-build:** the owner approved amending C2430 on 2026-11-09 (asked after the round-1 FAIL): an `ERR_ABORTED` on a Server Action `POST` that already returned `200` is not a failed request, because the existing `/login` action shows the same in dev and in a production build. The claim otherwise stands: error statuses, requests with no response, and console errors or warnings still fail it
