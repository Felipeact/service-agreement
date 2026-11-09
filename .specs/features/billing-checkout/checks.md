# Billing checkout checks

Profile: standard
Plan: `.specs/features/billing-checkout/plan.md`

36 checks in 3 slices · 4 one-way doors (all approved) · 6 open, of which 3 block go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C2514:`). This feature numbers from C2500 (no id above C2436 exists). `npx vitest run <file> -t "C2514:"` selects one.
- **SQL** recipe `stripe_events` runs with `npm run test:db stripe_events` from `web/` (new file `supabase/tests/stripe_events.sql`, registered in `RECIPES` as `plain("stripe_events")`, run after `fixture.sql`, rolled back). Every assertion is labelled with its check id (`C2518 ...`). The recipe needs the new migration applied to the database `SUPABASE_DB_URL`, which is the hosted project; applying it needs the owner's go-ahead (rule 8), so until then the SQL proofs are written, not green. Each test makes its own Vault secret inside the rolled-back transaction (`vault.create_secret`) and signs with `extensions.hmac`; no test reads or needs a real Stripe secret.
- Expected values in the tests (plan cents, the six event types, the field names) are written out in the test from the plan, never read back from `PLANS` or the migration, except where a check says the test is table-driven over `PLANS`.
- The Stripe account's test keys are not used by any proof: the adapter is proven against a fake `fetch`. A live run against Stripe's test mode is the owner-run step of open question 1.
- The Playwright validation of AGENTS.md (375, 768, 1440 px, touch) is run live for `/register/success`, `/register` and the redirect, and nothing from it is committed; C2535 pins the part that is a source contract.

## Checks

### S1 - A visitor is sent to Stripe to start a trial · 6 files · 30 KB · ~8k

**C2500** - With key and base url set, starting a trial makes exactly one `fetch` to `POST https://api.stripe.com/v1/checkout/sessions` with `Authorization: Bearer <the key>`, `Content-Type: application/x-www-form-urlencoded` and a form-encoded string body, and the key appears in no other part of the request, url included (plan AC 1, door 1)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2500:"`

**C2501** - For each of the three plans, with one trade and with all four, the body decodes to `mode=subscription`, `line_items[0][quantity]=1`, `line_items[0][price_data][currency]=cad`, `[unit_amount]` equal to that plan's cents (4900, 9900, 19900), `[recurring][interval]=month` and `[product_data][name]` "Starter plan", "Team plan" or "Business plan" (AC 2, door 2)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2501:"` (6 cases)

**C2502** - The body decodes to `subscription_data[trial_period_days]=14`, `payment_method_collection=always` and `subscription_data[trial_settings][end_behavior][missing_payment_method]=cancel` for every plan (AC 3, door 2)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2502:"` (3 cases)

**C2503** - `metadata[plan]` and `subscription_data[metadata][plan]` hold the plan key, and `metadata[trades]` and `subscription_data[metadata][trades]` hold the codes joined by commas in `TRADE_CODES` order, for the selection `["other", "hvac"]` giving `hvac,other` and for all four giving `hvac,plumbing,electrical,other` (AC 4, door 2)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2503:"`

**C2504** - With `APP_BASE_URL` `https://app.example.com`, `success_url` is `https://app.example.com/register/success` and `cancel_url` is `https://app.example.com/register?plan=team` for the Team plan, and the plan key follows each plan (AC 5)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2504:"` (3 cases)

**C2505** - Every request carries a `Stripe-Version` header that begins with a date `YYYY-MM-DD` (Stripe's form is `2026-10-28.endive`), the same value on every request (door 1; the value itself is open question 4)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2505:"`

**C2506** - When Stripe answers `200` with a JSON `url` the starter answers `{ ok: true, url }` with that exact string, and `makeStartTrial` turns it into the redirect outcome for an `https:` url (AC 6)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2506:"`
Proof: `npx vitest run application/use-cases/start-trial.test.ts` (the existing redirect tests, still green)

**C2507** - With `STRIPE_SECRET_KEY` unset, `STRIPE_SECRET_KEY` empty, `APP_BASE_URL` unset or `APP_BASE_URL` empty, the container's start-trial answers `not_configured` and `fetch` is never called (AC 7)
Proof: `npx vitest run composition/billing-container.stripe.test.ts -t "C2507:"` (4 cases)

**C2508** - Each of Stripe answering `400`, `401`, `429` or `500`, answering `200` with no `url`, the `fetch` promise rejecting, and the request passing 10 s with no answer (fake timers; the `fetch` receives an `AbortSignal` that aborts at 10,000 ms) makes the starter answer `{ ok: false, code: "unavailable" }` (AC 8)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2508:"` (7 cases)

**C2509** - Each of the seven failures of C2508 calls `console.error` exactly once, and the text names the HTTP status (or "no answer") and Stripe's error `code` when the body has one, and contains none of: the key, the plan key, any trade code, `@`, `https://` and `cs_` (AC 9)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C2509:"` (7 cases)

**C2510** - `STRIPE_SECRET_KEY` appears in no non-test source file outside `web/composition`, no `NEXT_PUBLIC_STRIPE` name exists anywhere under `web/`, and the adapter takes the key as an argument and reads no `process.env` (AC 10)
Proof: `npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C2510:"`

**C2511** - `web/package.json` has no `stripe` dependency, and no source file imports `stripe` (door 1)
Proof: `npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C2511:"`

**C2512** - With key and base url set, `getBillingContainer().startTrial` for a valid selection reaches the Stripe adapter (the fake `fetch` is called once with the Stripe url) and touches no `cookies()`, no `connection()` and no Supabase client; with the environment empty, C2422 still holds (AC 1, AC 7)
Proof: `npx vitest run composition/billing-container.stripe.test.ts -t "C2512:"`
Proof: `npx vitest run composition/billing-container.test.ts -t "C2422:"`

### S2 - Stripe's events are received once and only when genuine · 8 files · 70 KB · ~18k

**C2513** - The route answers `401 { error: "unauthorized" }` and never builds the container when the `Stripe-Signature` header is missing, has no `t=`, has no `v1=`, has a `v1=` that is not 64 hex characters, or carries only `v0=` (AC 11)
Proof: `npx vitest run app/api/webhooks/stripe/route.test.ts -t "C2513:"` (5 cases)

**C2514** - The use case receives the exact raw text of the body (a body containing `é` and extra spaces, byte for byte) and the exact header string (AC 22)
Proof: `npx vitest run app/api/webhooks/stripe/route.test.ts -t "C2514:"`

**C2515** - The route maps the use case's answers to `200 { outcome: "recorded" }`, `200 { outcome: "duplicate" }`, `200 { outcome: "ignored" }`, `401 { error: "unauthorized" }`, `400 { error: "malformed" }` and `503 { error: "unavailable" }`, each with `Cache-Control: no-store`; a thrown error gives `503` and the log line contains neither the body nor the header (AC 12, 13, 14, 18, 19, 20)
Proof: `npx vitest run app/api/webhooks/stripe/route.test.ts -t "C2515:"` (7 cases)

**C2516** - The use case calls `stripe_receive_event` once with `{ p_body, p_signature }` and maps the result `{outcome}` to recorded, duplicate or ignored, SQLSTATE `42501` to `unauthorized`, `22023` to `malformed`, the unconfigured-secret code to `unavailable` and any other error to `unavailable` (AC 12 to 14, 18 to 20)
Proof: `npx vitest run application/use-cases/stripe-webhook.test.ts -t "C2516:"` (8 tests: the use case's mapping)
Proof: `npx vitest run infrastructure/supabase/stripe-events.test.ts -t "C2516:"` (the call shape and the SQLSTATE `42501`, `22023`, `55000` mapping)

**C2517** - A signed event of a stored type returns `{outcome: "recorded"}` and leaves one row whose `id` is the event's `id`, `type` its `type`, `body` equal to the posted JSON and `received_at` within 5 s of `now()` (AC 12)
Proof: `npm run test:db stripe_events` (assertion `C2517 ...`)

**C2518** - Each of `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed` is recorded (AC 12, door 3)
Proof: `npm run test:db stripe_events` (assertions `C2518 ...`, table-driven over the 6 types)

**C2519** - Posting the same event id a second time answers `{outcome: "duplicate"}`; a second post with the same id but a different body keeps the first body; the table still holds exactly one row for the id (AC 13)
Proof: `npm run test:db stripe_events` (assertions `C2519 ...`)

**C2520** - A signed event of type `charge.succeeded`, `invoice.created` or `customer.created` answers `{outcome: "ignored"}` and adds no row (AC 14)
Proof: `npm run test:db stripe_events` (assertions `C2520 ...`, 3 types)

**C2521** - A header signed with a different secret, a header whose body was changed by one character after signing, and a header whose only `v1` is the HMAC of the body without the timestamp each raise `42501` and add no row (AC 15)
Proof: `npm run test:db stripe_events` (assertions `C2521 ...`, 3 cases)

**C2522** - A timestamp exactly 300 s before `now()` and exactly 300 s after are accepted; 301 s before and 301 s after raise `42501` and add no row (AC 16)
Proof: `npm run test:db stripe_events` (assertions `C2522 ...`, 4 edges)

**C2523** - A header with two `v1` values is accepted when the first matches, accepted when the second matches, and raises `42501` when neither matches (AC 17)
Proof: `npm run test:db stripe_events` (assertions `C2523 ...`, 3 cases)

**C2524** - With the Vault secret `stripe_webhook_secret` absent, and again with it set to an empty string, a well-formed call signed with any value raises the unconfigured code (not `42501`) and adds no row (AC 18)
Proof: `npm run test:db stripe_events` (assertions `C2524 ...`, 2 cases)

**C2525** - After a valid signature, a body that is not JSON, a JSON array, an object with no `id`, an `id` not starting `evt_`, and a numeric `type` each raise `22023` and add no row (AC 19)
Proof: `npm run test:db stripe_events` (assertions `C2525 ...`, 5 cases)

**C2526** - The database refuses a header with no `t=`, a non-numeric `t`, no `v1=`, a `v1=` of 63 hex characters and a header with only `v0=` with `42501` before any secret is read (AC 11, database side)
Proof: `npm run test:db stripe_events` (assertions `C2526 ...`, 5 cases)

**C2527** - `anon` and `authenticated` hold no `select`, `insert`, `update` or `delete` on `private.stripe_events`; `stripe_receive_event` is `security definer` with an empty `search_path`, executable by `anon` and `authenticated` and not by `public` (AC 23, door 3)
Proof: `npm run test:db stripe_events` (assertions `C2527 ...`, 4 privileges and 3 execute grants)

**C2528** - `stripe_events.id` is the primary key, and the function's only write to the table is `insert ... on conflict (id) do nothing`, so two deliveries interleaving cannot create two rows (AC 21; the interleaving itself cannot be driven by a single rolled-back connection, so the proof is the mechanism)
Proof: `npm run test:db stripe_events` (assertions `C2528 ...`, reading `pg_index` and `pg_proc.prosrc`)

**C2529** - `web/.env.example` lists `STRIPE_SECRET_KEY` with where it comes from and `APP_BASE_URL` as required for Checkout, names the Vault secret `stripe_webhook_secret`, and the string `STRIPE_WEBHOOK_SECRET` appears nowhere under `web/` source (door 3: the webhook secret is never an env var)
Proof: `npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C2529:"`

### S3 - The visitor returns to a clear page · 4 files · 12 KB · ~3k

**C2530** - A signed-out `GET /register/success` passes the proxy with no redirect, and so does a signed-out `POST /api/webhooks/stripe` (AC 24; the second rides the existing `/api/webhooks/` prefix)
Proof: `npx vitest run proxy.billing.test.ts -t "C2530:"` (2 cases)

**C2531** - A signed-out request to `/register/success/x` and to `/register/successx` redirects to `/login` (AC 25, door 4)
Proof: `npx vitest run proxy.billing.test.ts -t "C2531:"` (2 cases)

**C2532** - The page renders text saying the trial is registered and that a sign-in link will be emailed to the address given at checkout, a link labelled "Sign in" to `/login`, `<title>` "Thanks · Service Agreement", and none of "equipment", "trusted by", "most popular", "best value", "testimonial" or "save", case-insensitive (AC 26)
Proof: `npx vitest run app/register/success/success.test.ts -t "C2532:"`

**C2533** - The page's source reads no cookie, no `searchParams` and no Supabase client, so it is prerendered and answers `200` for anyone (AC 24, observable "loading" and "error" n/a)
Proof: `npx vitest run app/register/success/success.test.ts -t "C2533:"`

**C2534** - Every link in the page's own markup (outside the shared site header and footer) is a `LinkButton`, whose class is `h-11` (44 px) below `lg`, and the page sets no fixed pixel width, which is the source contract for AC 27 (the rendered widths are checked live, see the next line)
Proof: `npx vitest run app/register/success/success.test.ts -t "C2534:"`

**C2535** - Live, in the Playwright browser: `/register/success` at 375, 768 and 1440 px shows no horizontal scroll and every link measures at least 44 by 44 px at 375 and 768; `/register` still renders and its plan button, with no key set, shows "Sign-up isn't open yet" (AC 27). Author-side live run, nothing committed
Proof: live run with the Playwright MCP tools (`browser_resize` to 375x812, 768x1024 and 1440x900, `browser_snapshot`, an in-page measurement of `document.documentElement.scrollWidth` against `innerWidth` and of each link's bounding box). Reported in the verification, not committed

**C2536** - The change leaves the repo consistent: `ROADMAP.md` item 2 is split with the Customer Portal left unchecked, `CONTEXT.md` has a Billing entry and a dated Build log line, and `.specs/STATE.md` holds the new ADs for doors 1 to 4 and the amended AD-072 line
Proof: `npx vitest run app/billing-docs.test.ts -t "C2536:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plans (3) | `starter` C2501 · `team` C2501 · `business` C2501 (also C2502, C2504) | - |
| trade selections in the body (2) | one trade C2501 · all four C2501 (order: C2503) | - |
| Stripe failure causes (7) | `400` C2508 · `401` C2508 · `429` C2508 · `500` C2508 · `200` with no url C2508 · fetch rejects C2508 · 10 s timeout C2508 (each logged: C2509) | - |
| not-configured cases (4) | key unset C2507 · key empty C2507 · base url unset C2507 · base url empty C2507 | - |
| `POST /api/webhooks/stripe` statuses (4) | `200` C2515, C2517 · `401` C2513, C2515, C2521 · `400` C2515, C2525 · `503` C2515, C2524 | - |
| `POST /api/webhooks/stripe` outcomes (3) | recorded C2517, C2518 · duplicate C2519 · ignored C2520 | - |
| `POST /api/webhooks/stripe` error codes (3) | unauthorized C2515 · malformed C2515 · unavailable C2515 | - |
| `GET /register/success` statuses (1) | `200` C2530, C2532 (the two redirects of C2531 are the proxy's) | - |
| `POST /register` statuses (1) | `303` to the Checkout url C2512 and the pricing-page check on the redirect | - |
| malformed header shapes (5) | no header C2513 · no `t` C2513, C2526 · no `v1` C2513, C2526 · short `v1` C2513, C2526 · only `v0` C2513, C2526 (non-numeric `t`: C2526) | - |
| stored event types (6) | `checkout.session.completed` C2518 · `customer.subscription.created` C2518 · `customer.subscription.updated` C2518 · `customer.subscription.deleted` C2518 · `invoice.paid` C2518 · `invoice.payment_failed` C2518 | - |
| ignored event types sampled (3) | `charge.succeeded` C2520 · `invoice.created` C2520 · `customer.created` C2520 | - |
| signature failures (3) | wrong secret C2521 · changed body C2521 · v1 over the body alone C2521 | - |
| timestamp edges (4) | -300 s C2522 · +300 s C2522 · -301 s C2522 · +301 s C2522 | - |
| `v1` combinations (3) | first matches C2523 · second matches C2523 · neither C2523 | - |
| secret not configured (2) | absent C2524 · empty C2524 | - |
| malformed bodies (5) | not JSON C2525 · array C2525 · no `id` C2525 · `id` without `evt_` C2525 · numeric `type` C2525 | - |
| table privileges refused (4) and function execute grants (3) | `select` C2527 · `insert` C2527 · `update` C2527 · `delete` C2527 · `anon` execute C2527 · `authenticated` execute C2527 · `public` not C2527 | - |
| use-case result mapping (7) | recorded C2516 · duplicate C2516 · ignored C2516 · `42501` C2516 · `22023` C2516 · unconfigured code C2516 · other error C2516 | - |
| doors (4) | 1 adapter C2500, C2505, C2511 · 2 session contents C2501, C2502, C2503 · 3 ledger C2517, C2527, C2528, C2529 · 4 success path C2530, C2531 | - |
| entity `stripe_events` (1) | one row per id C2517, C2519, C2528 | - |
| startup config: `STRIPE_SECRET_KEY`, `APP_BASE_URL` (1 assembly) | `getBillingContainer` C2507, C2512 (the only function the register action builds from; no other app path starts Checkout) | - |
| env or Vault placement (3) | `STRIPE_SECRET_KEY` in env C2510 · `stripe_webhook_secret` in Vault C2524, C2529 · no `STRIPE_WEBHOOK_SECRET` env var C2529 | - |

- Claims naming a status code, route or response shape: C2513, C2515, C2516, C2517, C2519, C2520, C2530, C2531, C2532 - each has a proof that crosses the boundary it names (the route, the database function or the proxy)
- C2528 and the interleaving half of AC 21 sit at a lower level than the claim "two deliveries at once": see Swept, concurrency
- No other check claims more than the single case its proof exercises

## Test policy

The repo answers the level question for a webhook (DocuSeal: `route.test.ts`, `signature-webhook.test.ts` and the SQL recipe) and for an adapter over `fetch` (the Resend adapter), so this feature reuses those rows and adds none. One narrow gap: nothing yet says that a verifier written in SQL (a decision table over header shapes and timestamps) needs a case per branch at its own layer. These rows say it:

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `public.stripe_receive_event` (decides, reached across a boundary) | one at the route and one at the SQL layer | the contract at the route; one asserted case per header shape, per signature failure, per timestamp edge and per stored type at the SQL layer |
| `infrastructure/stripe` request builder and response mapper (decides) | one at its own layer with a fake `fetch` | one asserted case per plan, per failure cause and per body field |
| `app/api/webhooks/stripe/route.ts` (entry point that decides only the header shape and the status mapping) | one at the boundary | accepted input, each rejected header shape, each use-case answer |
| the success page (instrumentation) | none of its own beyond C2532 to C2534 | static copy |

Evidence:

- `stripe_receive_event` (to be written): decides over 5 header shapes, 3 signature failures, 2 timestamp sides, the `v1` list, 2 secret states, 5 body shapes, 6 stored types, duplicate or not -> about 24 branch points -> decides
- `infrastructure/stripe/checkout.ts` (to be written): maps 3 plans, 2 configuration inputs, 7 failure causes -> decides
- `app/api/webhooks/stripe/route.ts`: the header shape check and one 6-row status table -> decides at the boundary
- closest analogues: `supabase/migrations/20261107175044_signature_webhook.sql` with its route and use case, proven with `route.test.ts` (the DocuSeal route) and the recipe for it; `infrastructure/email` for the adapter

Cost: 4 proofs at their own layer across 5 test files plus 1 SQL file. Without these rows, the signature function's 24 branch points are proven only by a route test that traverses one path through them.

## Swept

- validation: C2513, C2525, C2526 (header shapes at the route and in the database, malformed bodies); plan and trade values already validated by the existing `parseCheckoutSelection` and its pricing-page checks
- failure modes: C2508, C2515, C2524 (Stripe refusing, timing out, the secret unset; the database failing)
- idempotency: C2519 (one row per Stripe event id however many deliveries); a session creation sends no idempotency key by design (plan Assumptions: a duplicate session is harmless)
- authorization: C2521, C2522, C2527 (anyone may call; only a correctly signed, fresh body is stored; no direct table access)
- concurrency: C2528 proves the mechanism (primary key plus `on conflict do nothing`); the actual interleaving of two simultaneous deliveries is not driven by any proof, because the SQL runner uses one rolled-back connection. A level gap, named here rather than hidden
- data lifecycle: n/a - events are kept as received; no row is updated or deleted (C2527 refuses both) and nothing reads them until provisioning, which owns retention
- dependency failure: C2508 (Stripe), C2509, C2515 (database down gives `503` so Stripe retries)
- state transitions: n/a - a ledger row is inserted once and never changes state; the trial lifecycle is Stripe's and acted on by provisioning
- observability: C2509, C2515 (what the log carries and never carries: key, selection, email, url, body, header); metrics and tracing n/a - no service target in this slice

## Out of scope

- None beyond the plan's own Out of scope table.

## Handoff

- S1 = 6 files, ~30 KB read or written, ~8k tokens; S2 = 8 files, ~70 KB, ~18k tokens (the migration, the route, the use case, the port, `composition/index.ts` at 15 KB, the SQL test and four vitest files); S3 = 4 files, ~12 KB, ~3k. Total ~29k, under the 150k budget - one builder, no ask
- The migration is written and tested but applied to the hosted project only with the owner's go-ahead (rule 8); the live Stripe run waits for open question 1
- Mechanism: one builder
