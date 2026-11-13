# Workspace pending state checks

Profile: standard
Plan: `.specs/features/workspace-pending-state/plan.md`

25 checks in 2 slices · 3 one-way doors (approved: "IMPLEMENT", 2026-11-12) · 0 open

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C4200:`). This feature numbers from C4200 (C4130 is the highest id in use). `npx vitest run <file> -t "C4200:"` selects one.
- **SQL** recipe `workspace_pending_state` runs with `npm run test:db workspace_pending_state` from `web/` (new `supabase/tests/workspace_pending_state.sql`, registered in `RECIPES` with the migration between `fixture.sql` and the test, as `other_trade_draft` does, so the hosted project needs no change). Every run is rolled back.
- Stripe and Supabase are never called by a proof: the adapter tests use a client double, the panel tests inject the action.

## Checks

### S1 - The page Stripe returns the visitor to · 8 files · ~60 KB · ~15k

**C4200** - Checkout asks Stripe for `success_url` `<base>/register/success?session_id={CHECKOUT_SESSION_ID}` with the braces literal, for each of the three plans; `cancel_url` is unchanged (AC 1, door 1)
Proof: `npx vitest run infrastructure/stripe/checkout.test.ts -t "C4200:"`

**C4201** - `/register/success` with no `session_id` renders the static copy "Your trial is registered." and the Sign in link, and the action is never called (AC 2)
Proof: `npx vitest run app/register/success/status-panel.test.ts -t "C4201:"`

**C4202** - With a `session_id` the panel renders "Setting up your workspace" and calls the action once, at once, with that id (AC 3)
Proof: `npx vitest run app/register/success/status-panel.test.ts -t "C4202:"`

**C4203** - On `ready` the panel says the workspace is ready and a sign-in link was emailed, offers a Sign in link to `/login`, and stops asking (AC 4)
Proof: `npx vitest run app/register/success/status-panel.test.ts -t "C4203:"`

**C4204** - On `refused` the panel says the workspace could not be set up and links to `/contact`; neither `email_in_use` nor `invalid_metadata` appears in the text, and it stops asking (AC 5)
Proof: `npx vitest run app/register/success/status-panel.test.ts -t "C4204:"`

**C4205** - While the answer is `pending` the panel asks again every 3000 ms and makes exactly 20 calls in all, never a 21st (AC 6)
Proof: `npx vitest run app/register/success/status-panel.test.ts -t "C4205:"`

**C4206** - After 20 `pending` answers the panel says it is taking longer than usual and shows the Sign in and contact links (AC 7)
Proof: `npx vitest run app/register/success/status-panel.test.ts -t "C4206:"`

**C4207** - When the action rejects, or answers `unavailable`, the panel shows the wording of C4206, stops asking and does not throw (AC 9)
Proof: `npx vitest run app/register/success/status-panel.test.ts -t "C4207:"`

**C4208** - The action returns the port's answer for `pending`, `ready` and `refused`, and returns `unavailable` when the port throws (AC 9)
Proof: `npx vitest run app/register/success/actions.test.ts -t "C4208:"`

**C4209** - `panelFor` maps the answer history to a panel: one `pending` -> waiting, 19 `pending` -> waiting, 20 `pending` -> the taking-longer panel, last `ready` -> ready (also after pendings), last `refused` -> refused, last `unavailable` -> the taking-longer panel (AC 4 to 7, 9)
Proof: `npx vitest run domain/billing/workspace-state.test.ts -t "C4209:"`

**C4210** - `checkout_workspace_status` answers `ready` for a stored `checkout.session.completed` whose session id matches and whose `processed_at` is set (AC 4)
Proof: `npm run test:db workspace_pending_state` (case C4210)

**C4211** - It answers exactly `refused`, with no code in the text, for a matching event with `process_error` set (AC 5)
Proof: `npm run test:db workspace_pending_state` (case C4211)

**C4212** - It answers `pending` and raises nothing for an unprocessed matching event, an unknown id, an empty string, null, a 5000-character string, `%` and a matching id on an event of another type (AC 8)
Proof: `npm run test:db workspace_pending_state` (case C4212)

**C4213** - When one session has two stored events, one processed and one refused, it answers `ready` (AC 4, door 2)
Proof: `npm run test:db workspace_pending_state` (case C4213)

**C4214** - The function is `security definer` with `search_path` empty, executable by `anon` and `authenticated` and not by `public`, and a call leaves `private.stripe_events` and every other table unchanged (AC 10, door 2)
Proof: `npm run test:db workspace_pending_state` (case C4214)

### S2 - A signed-in person with no workspace · 9 files · ~70 KB · ~18k

**C4215** - `my_workspace_state` answers `refused` for a caller whose email has a stored checkout event with `process_error` set and no processed event (AC 11, door 3)
Proof: `npm run test:db workspace_pending_state` (case C4215)

**C4216** - It answers `pending` for a caller whose email has a stored checkout event with neither stamp (AC 12)
Proof: `npm run test:db workspace_pending_state` (case C4216)

**C4217** - It answers `none` for a caller with no stored checkout event, for a caller whose email also has a processed event, and never reads another email's events (AC 13)
Proof: `npm run test:db workspace_pending_state` (case C4217)

**C4218** - `anon` calling `my_workspace_state` is refused with `42501` (AC 14)
Proof: `npm run test:db workspace_pending_state` (case C4218)

**C4219** - `NoWorkspace` renders: `refused` -> "payment was received" wording with a `/contact` link; `pending` -> "Setting up your workspace" with a Refresh link to the same page; `none` -> exactly today's copy (AC 11, 12, 13)
Proof: `npx vitest run components/shell/no-workspace.test.ts -t "C4219:"`

**C4220** - `MemberGate` calls `workspaceState` once for `no_membership`, never for a member, and falls back to `none` when it throws (AC 13, 15)
Proof: `npx vitest run "app/(app)/layout.test.ts" -t "C4220:"`

**C4221** - The two adapters map each RPC reply onto the port's answer, send `p_session_id` for the anonymous read, and throw on a database error or an unknown reply (AC 8, 13)
Proof: `npx vitest run infrastructure/supabase/workspace-state.test.ts -t "C4221:"`

**C4222** - `getWorkspaceStatusContainer` builds a cookie-less client and `getContainer` exposes `workspaceState` from the cookie client (door 2, 3)
Proof: `npx vitest run composition/workspace-state-wiring.test.ts -t "C4222:"`

**C4223** - `/register/success` is public and `/register/success/x` is not: no path was added to `PUBLIC_PATHS` (plan Assumptions row 4)
Proof: `npx vitest run infrastructure/supabase/workspace-state-public.test.ts -t "C4223:"`

**C4224** - The `workspace_pending_state` recipe is registered and every SQL file in `supabase/tests` is in a recipe (the recipe list of `runner.test.ts`)
Proof: `npx vitest run scripts/test-db/runner.test.ts`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plans in `success_url` (3) | starter C4200 · team C4200 · business C4200 | - |
| `GET /register/success` statuses (1) | 200 with and without `session_id` C4201 · C4202 | - |
| Server Action answers (4) | pending C4205 · ready C4203 · refused C4204 · unavailable C4207 | - |
| `checkout_workspace_status` answers (3) | pending C4212 · ready C4210 · refused C4211 | - |
| `checkout_workspace_status` pending inputs (7) | unprocessed C4212 · unknown C4212 · empty C4212 · null C4212 · 5000 characters C4212 · `%` C4212 · other event type C4212 | - |
| `my_workspace_state` answers and statuses (4) | none C4217 · pending C4216 · refused C4215 · 42501 C4218 | - |
| `panelFor` history table (7) | one pending C4209 · 19 pending C4209 · 20 pending C4209 · ready C4209 · ready after pendings C4209 · refused C4209 · unavailable C4209 | - |
| `NoWorkspace` states (3) | none C4219 · pending C4219 · refused C4219 | - |
| `MemberGate` cases (3) | member C4220 · no membership C4220 · call throws C4220 | - |
| adapter replies (5) | status pending C4221 · status ready C4221 · status refused C4221 · mine none/pending/refused C4221 · unknown reply C4221 | - |
| startup config: Supabase clients (2 assemblies) | cookie-less anon client for the status read C4222 · cookie client for `workspaceState` C4222 | - |
| doors in Landing (3) | success_url C4200 · anonymous read C4210 to C4214 · signed-in read C4215 to C4218 | - |

- Claims naming a status code, route or response shape: C4200, C4201, C4202, C4205, C4212, C4218 - each has a proof that crosses the boundary
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (`panelFor`) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (Server Action, page, `MemberGate`) | one at the boundary | accepted input, each rejected input, each error path |
| Client component with timers | one with the action injected | every panel state and the poll count |
| Adapter | one against the client double | request payload, each reply, each error |
| SQL function that decides | one rolled-back recipe | each answer, each excluded input, the grants |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:

- `domain/billing/workspace-state.ts` (new): six answer-history rows, one bound at 20 -> decides
- `public.checkout_workspace_status`, `public.my_workspace_state` (new): precedence ready > refused > pending, seven inputs that must answer `pending`, a grants rule -> decide
- `app/register/success/actions.ts` (new): forwards one call and maps a throw to `unavailable` -> entry point
- closest analogue: `components/billing/subscription-controls.test.ts` (injected actions, jsdom) and `supabase/tests/customer_portal.sql` (anonymous RPC, grants)

Cost: 1 domain proof, 1 component proof file, 1 SQL recipe of 9 cases, 2 adapter proofs. Without these rows the poll bound and the precedence rule are proven only by a path that happens to traverse them.

## Swept

- validation: C4212 (malformed id), C4221 (unknown reply)
- failure modes: C4207, C4208, C4220
- idempotency: n/a - both functions only read, nothing is retried into a second effect (C4214 proves they write nothing)
- authorization: C4214, C4218, C4223
- concurrency: C4213 (two events for one session) - a read racing the webhook transaction sees `pending` until it commits, which C4205 and C4206 already treat as the normal wait
- data lifecycle: n/a - the ledger rows are read as they are and nothing is added or removed
- dependency failure: C4207, C4220
- state transitions: C4209, C4213 (ready > refused > pending), C4217
- observability: n/a - no logging requirement; a refusal already leaves its code on the stored event

## Deviations

- C2504 (billing-checkout) asserts `success_url` equals `https://app.example.com/register/success`. The approved plan's AC 1 supersedes that exact value, so its one assertion line is amended to the new URL in the commit that changes the starter. Its `cancel_url` line stays untouched.

- The `test:db` runner's own test (`scripts/test-db/runner.test.ts`) hard-codes the recipe and file counts (33 recipes, 35 files); adding a recipe moved them to 34 and 36, as earlier features did. No assertion was weakened.
- `app/register/success/success.test.ts` (C2532 to C2534) gains one `vi.mock("./actions", ...)` line and a dynamic import of the page, because the page now mounts a client component whose Server Action reaches the composition root. Its assertions are untouched and still pass.

## Handoff

- S1 = ~15k (checkout.ts, success page, 3 new files, migration), S2 = ~18k (no-workspace, member-gate, composition, 2 adapters); total ~33k, under the 150k budget - one builder, no ask
- Mechanism: one builder
- **Boundary:** C4200-C4224 closed at `6b5642d`
