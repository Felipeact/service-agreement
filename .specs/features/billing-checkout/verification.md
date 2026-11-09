# Billing checkout verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: working tree vs c4467e3 (uncommitted)
**Round**: 2 - scoped (proofs and gate re-run in full on the current working tree; rows the fixes did not touch are `carried from round 1`)
**Verifier**: independent sub-agent (author != verifier)

Round 2 scope: the coordinator's four fixes (C2532 title assertion, C2516 second proof named, pricing-page plan hop 5, C2535 live run redone by the orchestrator) plus every round-1 non-PASS. All C2500-C2536 proofs were re-run at the current tree. Round 1 scope: all 36 checks, C2500-C2536. Real tree `git status --porcelain` recorded before and identical after fault injection. Nothing was committed, pushed or applied; nothing was sent to Stripe.

## Checks

Gate run, verified at the current tree (round 2), from `web/`, one invocation, verbose: `npx vitest run infrastructure/supabase/stripe-events.test.ts scripts/test-db/runner.test.ts infrastructure/stripe/checkout.test.ts infrastructure/stripe/billing-boundaries.test.ts composition/billing-container.stripe.test.ts composition/billing-container.test.ts application/use-cases/start-trial.test.ts app/api/webhooks/stripe/route.test.ts application/use-cases/stripe-webhook.test.ts proxy.billing.test.ts app/register/success/success.test.ts app/billing-docs.test.ts` - 12 files, 133 passed, 0 failed, every named test listed individually (stripe-events.test.ts 8 C2516 tests, stripe-webhook.test.ts 8 C2516 tests, the C2532 test passing with the new layout assertion, runner.test.ts 26 passed with 28 recipes and 30 files). `npx tsc --noEmit` exit 0. `npx eslint` over the touched directories exit 0.

SQL proofs C2517-C2528, re-run in round 2: the migration is now applied on the hosted database (the owner applied it), so a plain scratch run fails with `relation "stripe_events" already exists`. The runner copy therefore drops both objects at the top of the rolled-back transaction and re-creates them from the migration file, then runs `stripe_events.sql`: `[{"result":"stripe_events: pass"}]`. This proves the migration file, not the applied copy; the applied objects were unchanged afterwards (table and function present, 0 rows, rollback intact). The C2517-C2528 evidence lines are carried from round 1 (`stripe_events.sql` is unchanged). Round 1 text follows. SQL proof run with the scratch runner (`sqlrun.cjs`, fixture + migration + `stripe_events.sql` in one transaction ending in rollback, refuses `commit`): `[{"result":"stripe_events: pass"}]`. This is not the committed `npm run test:db stripe_events` command; see the hosted-database note under Gate.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2500 | one POST, bearer key, form body, key nowhere else | vitest batch, test listed | `checkout.test.ts:41` `expect(calls[0].url).toBe("https://api.stripe.com/v1/checkout/sessions")`; `:43` `Authorization` `Bearer ${KEY}`; `:46-48` key absent from url, body, other headers | PASS |
| C2501 | 3 plans x 2 trade sets: mode, qty, cad, cents, month, name | listed, 6 cases | `checkout.test.ts:66` `unit_amount` `toBe(cents)` with literals 4900/9900/19900 (`:52-54`); `:68` name | PASS |
| C2502 | trial 14, always, cancel | listed, 3 cases | `checkout.test.ts:75-77` | PASS |
| C2503 | metadata on session and subscription, TRADE_CODES order | listed, 2 cases | `checkout.test.ts:88-89` `toBe(joined)` with input `["other","hvac"]` -> `hvac,other` | PASS |
| C2504 | success and cancel urls per plan | listed, 3 cases | `checkout.test.ts:94-95` | PASS |
| C2505 | Stripe-Version begins with a date, same each request | listed | `checkout.test.ts:102` `toMatch(/^\d{4}-\d{2}-\d{2}/)`; `:103` equal across two requests. The amendment is honest (the plan leaves the value open, question 4); code pins `2026-10-28.endive` at `checkout.ts:7` | PASS |
| C2506 | 200 with url -> `{ok,url}`; redirect for https | listed + `start-trial.test.ts` (C2415 listed, passed) | `checkout.test.ts:107` `toEqual({ ok: true, url: ... })` | PASS |
| C2507 | key unset/empty, base unset/empty -> `not_configured`, no fetch | listed, 4 cases | `billing-container.stripe.test.ts:42` `toEqual({ status: "not_configured" })`; `:43` `fetchMock` not called. Assembly read at `composition/index.ts:295-297` | PASS |
| C2508 | 7 failures -> unavailable, abort at 10,000 ms | listed, 7 cases | `checkout.test.ts:141` `toEqual({ ok: false, code: "unavailable" })`; `:136-139` not aborted at 9,999, aborted at 10,000 | PASS |
| C2509 | each failure logs once, status and code only, nothing sensitive | listed, 7 cases | `checkout.test.ts:159` `toHaveBeenCalledTimes(1)`; `:161` forbidden list incl. key, `@`, `https://`, `cs_`; `:162-163` status and `parameter_invalid_empty` | PASS |
| C2510 | secret read only in composition, no NEXT_PUBLIC_STRIPE, adapter reads no process.env | listed | `billing-boundaries.test.ts:25-29` | PASS |
| C2511 | no stripe dependency or import | listed | `billing-boundaries.test.ts:34`, `:36` | PASS |
| C2512 | container reaches adapter, no cookies/connection/Supabase; C2422 holds | listed + C2422 (6 cases) listed | `billing-container.stripe.test.ts:51-56`; `billing-container.test.ts` C2422 passed | PASS |
| C2513 | 5 bad headers -> 401, container never built | listed, 5 cases | `route.test.ts:45-47` | PASS |
| C2514 | raw body and exact header reach use case | listed | `route.test.ts:55` `toHaveBeenCalledWith({ body, signature })`, body has `é` and double spaces (`:52`) | PASS |
| C2515 | 6 answers -> status, shape, no-store; throw -> 503 with clean log | listed, 7 cases | `route.test.ts:68-70`; `:76-82`. Test titles print `NaN` for the status (`%i` over a string); cosmetic | PASS |
| C2516 | use case calls the RPC once; maps outcomes, 42501, 22023, unconfigured, other | `stripe-webhook.test.ts` (8 tests) and `stripe-events.test.ts` (8 tests), both now named in checks.md:73-74 (verified round 2) | `stripe-webhook.test.ts:34-36` result `toEqual(expected)`, `receive` called once with the delivery; the RPC name, `{p_body, p_signature}` and SQLSTATE mapping are asserted only in `infrastructure/supabase/stripe-events.test.ts:17-18,31-35`. checks.md:74 now carries `npx vitest run infrastructure/supabase/stripe-events.test.ts -t "C2516:"`, so the named proofs reach both halves | PASS |
| C2517 | recorded; one row with id, type, body, received_at | SQL scratch runner pass | `stripe_events.sql:52` outcome `{"outcome":"recorded"}`; `:54-57` row columns and `received_at` within 5 s | PASS |
| C2518 | six types recorded | SQL pass | `stripe_events.sql:69-70` per type, `:72` set size 6 | PASS |
| C2519 | duplicate; first body kept; one row | SQL pass | `stripe_events.sql:82-85` | PASS |
| C2520 | three ignored types add no row | SQL pass | `stripe_events.sql:96-97` | PASS |
| C2521 | other secret, changed body, v1 over body alone -> 42501 | SQL pass | `stripe_events.sql:107-111` | PASS |
| C2522 | +/-300 accepted, +/-301 refused | SQL pass; mutant killed | `stripe_events.sql:120-127` | PASS |
| C2523 | two v1, first or second matches, neither refused | SQL pass | `stripe_events.sql:138-146` | PASS |
| C2524 | secret absent or empty -> 55000, no row | SQL pass | `stripe_events.sql:156-160` | PASS |
| C2525 | five bad bodies -> 22023 | SQL pass | `stripe_events.sql:168-171` | PASS |
| C2526 | five bad header shapes -> 42501 with the secret absent | SQL pass | `stripe_events.sql:182-189` (secret nulled first, so "before any secret is read" is really tested) | PASS |
| C2527 | no table privilege; definer, empty search_path; execute grants; not public | SQL pass | `stripe_events.sql:202-209` (8 privilege asserts, 2 execute, public, definer plus `search_path=""`) | PASS |
| C2528 | primary key on id; sole write is insert on conflict do nothing | SQL pass; mutant killed | `stripe_events.sql:215-222` (pg_index, prosrc regex, single `insert into`). Level gap named in Swept; interleaving not driven | PASS (named level gap) |
| C2529 | .env.example documents key, base url, Vault secret; no STRIPE_WEBHOOK_SECRET | listed | `billing-boundaries.test.ts:41-47` | PASS |
| C2530 | signed-out GET /register/success and POST /api/webhooks/stripe pass | listed, 2 cases | `proxy.billing.test.ts:28-29` status 200, no `location`. Door 4 literal confirmed: `session.ts` adds exact `"/register/success"` to `PUBLIC_PATHS`, not a prefix | PASS |
| C2531 | /register/success/x and /register/successx redirect to /login | listed, 2 cases | `proxy.billing.test.ts:34-35` 307 and `/login` | PASS |
| C2532 | copy, Sign in link, title "Thanks · Service Agreement", banned words | listed, passed at the current tree | `success.test.ts:19` `expect(metadata.title).toBe("Thanks")`; `:21-22` reads `app/layout.tsx` and `expect(layout).toContain('template: "%s · Service Agreement"')`; `:16-18` copy and link. Title-template mutant killed (Faults). The assertion is a source read of the template, not a resolved title; the orchestrator's live read of the title ('Thanks · Service Agreement') backs it | PASS |
| C2533 | page reads no cookie, searchParams or Supabase | listed | `success.test.ts:27` forbidden words incl. `cookies`, `searchParams`, `supabase`, `await `. `site-shell.tsx` also contains none of cookies, supabase or headers (grep) | PASS |
| C2534 | links are LinkButton, h-11, no fixed px width | listed | `success.test.ts:32-36`; `button.tsx:13` has `h-11` and `lg:h-[34px]`. Amendment (LinkButton/h-11 instead of min-h-11) is honest. The test never renders the class on the link, it reads `button.tsx`; weak but the check text is source-contract | PASS |
| C2535 | live at 375/768/1440, no horizontal scroll, links >= 44; /register no-key shows "Sign-up isn't open yet" | live run redone by the orchestrator in the shared browser; reported to me, not re-observed by me | /register/success: title 'Thanks · Service Agreement'; 375 px scrollWidth 360 of 375 and every link 44 px high (my own round-1 measurement); 768 px scrollWidth 753 of 768, no link under 44 px; 1440 px scrollWidth 1425 of 1440 (orchestrator). Also live: /register?plan=team with one trade, the plan button reached a Stripe test Checkout page reading 'Team plan, 14 days free, then CA$99.00 per month' (AC 6). Deviation: the dev server now has the Stripe env, so the check's no-key 'not open yet' half was not run live; it rests on the unit proofs C2507 (`billing-container.stripe.test.ts:42-43`) and C2422. checks.md C2535 still words that half as live | PASS (deviation noted) |
| C2536 | ROADMAP split, CONTEXT entry and build-log line, STATE ADs | listed | `billing-docs.test.ts:11-12` roadmap item checked and Portal left unchecked; `:17-18` CONTEXT; `:22-27` four AD groups and AD-072 | PASS |

## Coverage

Recomputed from the code, the migration and the plan's Surface, Landing and Relations, not read back from checks.md.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plans (3) | `PLANS` use in `checkout.ts:38` | starter/team/business C2501, C2502, C2504 (`checkout.test.ts:52-54`) | - |
| webhook statuses (4) | `route.ts:4,19,26-27,30` | 200 `route.test.ts:59-61`; 401 `:43`, `:62`; 400 `:63`; 503 `:64`, `:73`, SQL 55000 | - |
| webhook outcomes (3) | `stripe-webhook.ts:3`, migration `:86,91` | recorded C2517/18; duplicate C2519; ignored C2520 | - |
| error codes (3) | `route.ts:4` | unauthorized/malformed/unavailable `route.test.ts:62-64` | - |
| failure causes (7) | `checkout.ts:81-87` | each `checkout.test.ts:112-128`, logged `:154-164` | - |
| not-configured cases (4) | `composition/index.ts:295-297` | `billing-container.stripe.test.ts:30-35` | - |
| header shapes (5 + non-numeric t) | migration `:44-52`, route regex `:10` | route C2513 (5); SQL C2526 (5, `t=abc` at `stripe_events.sql:185`) | - |
| stored types (6) | migration `:84-85` | `stripe_events.sql:66-67` | - |
| signature failures (3), timestamp edges (4), v1 combos (3), secret states (2), bad bodies (5) | migration `:55-82` | C2521, C2522, C2523, C2524, C2525 as in the Checks table | - |
| SQLSTATE codes at the adapter (3 + other) | `stripe-events.ts:15-19` | `stripe-events.test.ts:31-35` (not cited by any check's Proof line) | - |
| privileges and grants (4 + 3) | migration `:16,95-96` | C2527 | - |
| doors (4) | plan Landing | 1 `checkout.ts:68-75` (url, header names, 10 s) C2500/C2505/C2508; 2 body fields C2501-C2503; 3 migration table, function, grants, 300 s C2517-C2528; 4 `session.ts` exact path C2530/C2531 | - |
| plan Flow statement: `getWebhookContainer` extended with `receiveStripe` | `composition/index.ts` diff | consistent; route test mocks it (`route.test.ts:6`) | - |
| startup config assembly (1) | `composition/index.ts:291-298` read directly | C2507, C2512 build the real `getBillingContainer` | - |
| `POST /register` 303 (1) | existing action | the 303 is the pricing-page action test; C2512 asserts the container's `{status:"redirect"}`, not the HTTP status. Not re-verified here | - |
| plan Impact: pricing-page plan line "it reads no cookie, no database and no secret" updated in the build commit | `.specs/features/pricing-page/plan.md:19` | `.specs/features/pricing-page/plan.md:19` now says billing-checkout made it read `STRIPE_SECRET_KEY` and `APP_BASE_URL`, and only those (verified round 2) | - |
| plan AC 26 `<title>` "Thanks · Service Agreement" | `app/layout.tsx:17-18` template + `page.tsx` metadata | `success.test.ts:19,21-22` both halves | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `public.stripe_receive_event` (decides, across a boundary) | `20261109190000_stripe_events.sql` | route C2513-C2515 plus SQL C2517-C2528: one case per header shape, per signature failure, per timestamp edge, per stored type | yes |
| `infrastructure/stripe` builder and mapper (decides) | `checkout.ts` | own layer with fake fetch: per plan, per failure cause, per body field | yes |
| `app/api/webhooks/stripe/route.ts` (boundary) | `route.ts` | accepted input, each rejected header, each use-case answer | yes |
| success page (instrumentation) | `register/success/page.tsx` | none beyond C2532-C2534, static copy | yes (round 2: title suffix now asserted) |

## Faults injected

Scratch copy of `web/` outside the repo (`verify-copy`, node_modules junctioned, removed afterwards with the junction first). SQL mutants ran through a copy of the runner pointed at a scratch migration that drops the existing objects inside the rolled-back transaction.

| Mutation | Location | Killed |
| --- | --- | --- |
| trades joined unsorted: `knownTrades(trades).join(",")` -> `trades.join(",")` | `infrastructure/stripe/checkout.ts:40` | yes, C2503 `hvac,other` case failed |
| route maps unavailable to 500 instead of 503 | `app/api/webhooks/stripe/route.ts:4` | yes, C2515 `unavailable` case failed |
| `not_configured` guard drops the base-url half: `secretKey && appBaseUrl` -> `secretKey` | `composition/index.ts:296` | yes, both C2507 base-url cases failed |
| timestamp tolerance 300 -> 301 s | migration `:60` | yes, `C2522 -301: expected SQLSTATE 42501, statement succeeded` |
| `on conflict (id) do nothing` removed | migration `:89` | yes, C2519 `same body` raised duplicate key (C2528's regex also covers it) |
| title template `%s · Service Agreement` -> `%s - Service Agreement` (round 2, scratch copy of `layout.tsx`) | `web/app/layout.tsx:18` | yes, `C2532` failed in `success.test.ts` |

The first five rows are carried from round 1 (the fixes touched none of their surfaces); the sixth is the new round-2 surface. Real tree `git status --porcelain` after the scratch runs is identical to the baseline in each round (diffed).

## Gaps

Round 1 gaps 1-4 are closed (C2535 redone live, C2532 asserted, C2516 second proof named, pricing-page line updated). Gap 5 is explained: the owner applied the migration themselves; the Vault secret `stripe_webhook_secret` is not yet set, so the endpoint answers 503 until it is.

Open, non-blocking:
1. checks.md C2535 still says the `/register` no-key text is shown live; the live run could not show it with the Stripe env set. Amend the wording to point at C2507 and C2422 for that half.
2. The SQL proofs ran against the migration file inside a rolled-back transaction, not against the applied copy. Run `npm run test:db stripe_events` once against the hosted database to confirm the applied copy matches.
3. Not a check: `schema_migrations` does not list `20261109190000`, so migration history is out of sync until it is recorded.

## Gate

`npx vitest run` over the 12 files above: 133 passed, 0 failed; `npx tsc --noEmit` exit 0; `npx eslint` (app/register, infrastructure, application, composition) exit 0; SQL runner (drop and recreate inside the rolled-back transaction) `stripe_events: pass`.
