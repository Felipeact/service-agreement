# Checkout email in use checks

Profile: standard
Plan: `.specs/features/checkout-email-in-use/plan.md`

15 checks in 2 slices · 2 one-way doors (approved: "IMPLEMENT", 2026-11-12) · 1 open, 0 block

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C4300:`). This feature numbers from C4300 (C4224 is the highest id in use). `npx vitest run <file> -t "C4300:"` selects one.
- **SQL** recipe `checkout_email_in_use` runs with `npm run test:db checkout_email_in_use` from `web/` (new `supabase/tests/checkout_email_in_use.sql`, registered in `RECIPES` with the migration between `fixture.sql` and the test, as `workspace_pending_state` did, so the hosted project needs no change). The existing `workspace_provisioning` recipe now has the migration inserted between `fixture.sql` and its test (C4312); once the owner applies the migration that part is dropped, as `workspace_pending_state` did. Every run is rolled back.
- Stripe and Supabase are never called by a proof: the use case takes fakes, the adapter takes a client double.
- Existing approved checks stay true and unedited: C2422 (no environment: `not_configured`, no Supabase client) holds because the composition skips the email check while Stripe is not configured (C4314).

## Checks

### S1 - The register form refuses a taken email before Checkout · 7 files · ~60 KB · ~15k

**C4300** - WHEN the email check answers `true` for a valid selection, `startTrial` answers `{ status: "email_in_use" }` and the starter is called 0 times (AC 1, AC 2 at the use-case level)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C4300:"`

**C4301** - WHEN the email check answers `false`, `startTrial` calls the starter once and returns its redirect, and the check was asked exactly once with the lower-cased email (AC 3 use-case half)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C4301:"`

**C4302** - `email_has_workspace('ua@example.test')` answers `true` for an email that has a membership in any org (AC 1 database half)
Proof: `npm run test:db checkout_email_in_use` (label C4302)

**C4303** - `email_has_workspace` answers `true` for an email with an invitation that is unaccepted and unexpired (AC 2 database half)
Proof: `npm run test:db checkout_email_in_use` (label C4303)

**C4304** - `email_has_workspace` answers `false` for an email with only an expired invitation, only an accepted invitation and no membership, and for an email nowhere in the database (AC 3 database half)
Proof: `npm run test:db checkout_email_in_use` (label C4304)

**C4305** - A request with email ` Owner@Shop.CA ` asks the check about `owner@shop.ca`; and `email_has_workspace(' UA@Example.Test ')` answers `true` for the membership held by `ua@example.test` (AC 4)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C4305:"`
Proof: `npm run test:db checkout_email_in_use` (label C4305)

**C4306** - For each of `no_trade`, `invalid_choice` and `invalid_details` the email check is called 0 times and the answer is the existing one (AC 5)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C4306:"`

**C4307** - WHEN the check throws (an `Error` and a non-error), `startTrial` answers `{ status: "unavailable" }`, the starter is called 0 times, and the one logged line does not contain the email or the thrown message (AC 6)
Proof: `npx vitest run application/use-cases/start-trial.test.ts -t "C4307:"`

**C4308** - WHEN the action state is `email_in_use`, `RegisterFields` renders the text "This email already has a workspace." with a link `href="/login"` labelled "Sign in", `aria-invalid="true"` on `#register-email` described by a message element, and every typed value and ticked trade kept (AC 7)
Proof: `npx vitest run app/register/register.test.ts -t "C4308:"`

**C4309** - The `email_in_use` state `startTrialAction` returns is exactly `{ status, trades, values, fields: { email: true } }` with no role, org or count, and the rendered message names none (AC 8)
Proof: `npx vitest run app/register/register-action.test.ts -t "C4309:"`

**C4314** - `getBillingContainer`: with no environment the check is skipped and no Supabase client is created (C2422 stays true); with `STRIPE_SECRET_KEY`, `APP_BASE_URL` and the Supabase variables set, a selection makes one `anon` client from the publishable key and asks `email_has_workspace` once before any Stripe request; a taken email makes 0 Stripe requests
Proof: `npx vitest run composition/billing-container.stripe.test.ts -t "C4314:"`

**C4315** - `supabaseWorkspaceEmailCheck`: calls `rpc("email_has_workspace", { p_email })`, returns the boolean, throws an error naming only the function and the code on a database error (no email in the message), and throws on a non-boolean answer
Proof: `npx vitest run infrastructure/supabase/workspace-email.test.ts -t "C4315:"`

### S2 - One rule for the form and the webhook · 3 files · 14 KB · ~4k

**C4310** - `email_has_workspace` is executable by `anon` and `authenticated`, not by `public`, is `stable` (it writes nothing), and `private.email_in_use` is executable by neither `anon` nor `authenticated` (AC 9)
Proof: `npm run test:db checkout_email_in_use` (label C4310)

**C4311** - `email_has_workspace` answers `false` with no error for null, `''`, `'   '`, `'not-an-email'` and a 300-character string (AC 10)
Proof: `npm run test:db checkout_email_in_use` (label C4311)

**C4312** - The whole existing `workspace_provisioning.sql` passes with the new migration in place: a membership email and a live invitation are still refused `email_in_use`, expired and accepted ones are still provisioned (AC 11, door 2)
Proof: `npm run test:db workspace_provisioning`

**C4313** - Two checkout events for the same new email under different subscriptions: the first processes (`processed_at` set, an owner invitation exists), the second ends with `process_error = 'email_in_use'` and creates no org (AC 12)
Proof: `npm run test:db checkout_email_in_use` (label C4313)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `startTrialAction` states (7) | `redirect` C4301 · `no_trade` C4306 · `invalid_choice` C4306 · `invalid_details` C4306 · `not_configured` C4314 · `unavailable` C4307 · `email_in_use` C4300, C4309 | - |
| `rpc public.email_has_workspace` answers (2) | `true` C4302, C4303 · `false` C4304, C4311 | - |
| `rpc public.email_has_workspace` status (1) | `200` always, with an answer or `false`, never an error C4311 | - |
| email situations (6) | membership C4302 · live invitation C4303 · expired invitation C4304 · accepted invitation C4304 · none C4304 · padded mixed case C4305 | - |
| checks that make the check not run (3) | `no_trade` C4306 · `invalid_choice` C4306 · `invalid_details` C4306 | - |
| doors (2) | 1 `public.email_has_workspace` C4310, C4311, C4315 · 2 `private.email_in_use` C4310, C4312 | - |
| grants (3 roles) | `anon` C4310 · `authenticated` C4310 · `public` C4310 | - |
| startup config: Supabase anon client for the check (1 assembly) | `getBillingContainer` C4314 | - |
| register-form copy states (4) | `email_in_use` message C4308 · sign-in link C4308 · email field in error C4308 · values kept C4308 | - |

- Claims naming a status, route or response shape: C4300, C4309, C4311 - each has a proof that crosses the boundary
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (`makeStartTrial`) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (Server Action, `RegisterFields`) | one at the boundary | accepted input, each rejected input, each error path |
| Adapter | one against the client double | request payload, each reply, each error |
| SQL function that decides | one rolled-back recipe | each answer, each excluded input, the grants |
| Composition | one with fakes at the environment | each assembly branch |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:

- `application/use-cases/start-trial.ts`: validate, check, start, https test, 5 branch points (3 new: taken, check threw, order of the check) -> decides
- `private.email_in_use` (new): two `exists` arms, a lower-case and trim rule, an invitation window -> decides
- `register-fields.tsx`: maps a status to copy and field marking -> entry point
- closest analogue: `workspace-pending-state` (anonymous RPC, grants, adapter against a client double, composition test) with the same rows

Cost: 6 use-case cases, 1 SQL recipe of 8 cases plus one replay, 1 adapter proof, 1 composition proof, 2 rendering proofs. Without these rows the "in use" rule is proven only by the webhook path that happens to traverse it.

## Swept

- validation: C4305, C4306, C4311
- failure modes: C4307, C4315
- idempotency: n/a - the check reads only; asking twice changes nothing and a retried submit is a new Checkout session as today
- authorization: C4310 (grants); the page is public by design
- concurrency: C4313
- data lifecycle: n/a - nothing stored or expired by this change; the invitation window is read, not written
- dependency failure: C4307, C4314
- state transitions: n/a - no status machine; `email_in_use` is a refusal value
- observability: C4307 (one log line, no email); the rate-limit and alert signals are out of scope in the plan

## Deviations

- **C2512 (billing-container.stripe.test.ts) amended.** It asserted that a configured Stripe touches no Supabase client. By this plan (Impact, composition) a configured Stripe now asks the database first, so the test now sets the Supabase variables and no longer asserts `createClient` was not called; its cookie, connection and one-Stripe-call assertions are unchanged. C2422 (no environment) is untouched and still passes (C4314).
- **`runner.test.ts` counts moved from 34 to 35 recipes and from 36 to 37 SQL files** (one new recipe, one new SQL file); the `ALL` list gained `checkout_email_in_use`. No assertion was relaxed.
- **`makeStartTrial`'s second parameter is optional**, so the approved tests that build it with one argument stay unedited; the composition always passes it when Stripe is configured.
- **C4312's proof is the `workspace_provisioning` recipe with the migration inserted**, not a second recipe: the runner's fake expects a recipe's name to equal its last file.

## Handoff

- S1 = ~15k, S2 = ~4k, total ~19k across 10 files, under the 150k budget - one builder
- Mechanism: one builder
