# Checkout email in use

Roadmap Phase 5 item "Checkout refuses an email that already belongs to an org, with a clear message" (decision 9). One feature at a time (decision 22). Plan limits, the template preview, the SMTP sender and the demo video stay separate items (Out of scope).

## Problem

Today the only place an email that already belongs to an org is refused is the Stripe webhook, after the visitor has paid. `private.provision_workspace` raises `email_in_use`, the ledger row gets that code, and nothing else happens: the visitor has paid by card (14-day trial, card collected up front), is told by `/register/success` that their workspace "could not be set up" (the code is hidden on purpose, workspace-pending-state AC 5), and has no way to learn that the reason is that they already have an account. A person who signs up twice, or who was invited to a colleague's org and then registers with the same email, hits this. The roadmap gives no support volume or sign-up figure, so none is claimed here.

When this ships, `/register` tells that visitor before Checkout opens, in words that say what to do (sign in), and no card is taken for a workspace that cannot be built.

## Flow

Reuses the exact predicate the webhook already applies (a membership or a live invitation for the email, AD-131 and workspace-provisioning), the anonymous security-definer RPC pattern (AD-068, AD-143, AD-182) and the `makeStartTrial` use case with its `CheckoutStarter` hand-off, instead of a second definition of "in use" or a new public route.

1. Visitor submits `/register` -> `startTrialAction` (exists) - passes the posted fields to `startTrial`
2. `makeStartTrial` (exists, changed) - `parseCheckoutSelection` as today; on a valid selection it asks the new `WorkspaceEmailCheck` port about the parsed (lower-cased) email before `checkout.start`
3. `WorkspaceEmailCheck` port (new, door 1) -> `supabaseWorkspaceEmailCheck` (new, placement per conventions) -> `public.email_has_workspace(p_email)` (new, door 1) - which calls `private.email_in_use` (new, door 2), the predicate `provision_workspace` now calls too
4. `makeStartTrial` - `true` answers `email_in_use` and stops; `false` continues to `checkout.start` exactly as today; a failed check answers `unavailable`
5. out: `PricingState` (exists, changed) gains `email_in_use`; `RegisterFields` (exists, changed) shows the message with a Sign in link and marks the email field

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `email_in_use` - a lower-cased email that has a membership in any org or a live (unaccepted, unexpired) invitation; lives in `private.email_in_use` and is the same rule `provision_workspace` applied inline. Branches on it today: only `provision_workspace` and the ledger's `process_error` check constraint |
| domain | existing term: `StartTrialOutcome` and `PricingState` statuses gain `email_in_use`. Branches on them today: `startTrialAction`, `RegisterFields`, `start-trial.test.ts`, `register-action.test.ts`, `status-panel` is unaffected |
| stored data | nothing to migrate. `provision_workspace` is replaced to call the shared predicate; its behaviour and its refusal code are unchanged, and the webhook backstop stays for a race |
| composition | `getBillingContainer` builds the Supabase-backed check beside the Stripe starter; it needs an anon-key client, as `workspaceStatus` already does |
| advisors | one more `anon` security-definer lint, the accepted kind (AD-143, AD-182) |
| tests | `workspace_provisioning.sql` must still pass unchanged (it proves the refusal through the replaced function). C2512 (a configured Stripe touches no Supabase client) no longer holds and is amended; `runner.test.ts` counts its recipes and SQL files |
| not changed | the Checkout request body, the webhook route, the ledger's process codes, `/register/success`, RLS |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| Server Action `startTrialAction` on `/register` | the existing form fields | adds the state `email_in_use` beside `redirect`, `no_trade`, `invalid_choice`, `invalid_details`, `not_configured`, `unavailable` | `200` |
| `rpc public.email_has_workspace` | `p_email text` | `boolean`, never a role, an org or a count | `200` always: null, empty and malformed input answer `false` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. The anonymous email read | `public.email_has_workspace(p_email text) returns boolean`, `stable`, `security definer`, `search_path = ''`, `revoke all ... from public, anon, authenticated`, `grant execute ... to anon, authenticated`; lower-cases and trims its input; reads, writes nothing else | Reading `auth.users` or `memberships` through a policy for `anon`: exposes tenant tables to an anonymous caller. A service-role lookup in the server action: AD-037 and AD-073 keep that key out of request paths. Asking Stripe whether a customer with the email exists: it knows nothing of invitations and a membership created by invitation |
| 2. One definition of "in use" | `private.email_in_use(p_email text) returns boolean`, definer, `search_path = ''`, not executable by `anon` or `authenticated`; `provision_workspace` and door 1 both call it | Copying the `exists (...)` into the new RPC: two copies drift, and the webhook would accept an email the form refuses (or the reverse) |

- This is the first anonymous read that answers about a person's email (AD-183 and workspace-pending-state door 3 refused one as an oracle). The answer here is the point of the feature (decision 9); assumption 1 records the exposure and its limit. A later rate limit (M15) does not need a different shape.
- Door 2 amends the body of `provision_workspace` (AD-174); an AD for both goes to `STATE.md` at the end of the build.
- Nothing else in this change is hard to reverse: the message wording, the field marking, the port's name and where the check sits in the use case are edits.

## Criteria

### S1: The register form refuses a taken email before Checkout (P1)

**Acceptance Criteria**

1. WHEN a valid selection is submitted with an email that has a membership in any org THEN `startTrial` SHALL answer `email_in_use` and SHALL NOT call `checkout.start`
2. WHEN a valid selection is submitted with an email that has an invitation not yet accepted and not yet expired THEN `startTrial` SHALL answer `email_in_use` and SHALL NOT call `checkout.start`
3. WHEN the email has only an accepted-and-no-membership or an expired invitation, or none, THEN `startTrial` SHALL call `checkout.start` as today
4. The system SHALL compare emails ignoring case and surrounding spaces, so `Owner@Acme.com ` matches a membership held by `owner@acme.com`
5. IF the selection is invalid THEN `startTrial` SHALL answer the existing `no_trade`, `invalid_choice` or `invalid_details` and SHALL NOT call the email check
6. IF the email check throws THEN `startTrial` SHALL answer `unavailable`, SHALL NOT call `checkout.start` and SHALL log one line without the email
7. WHEN `/register` shows `email_in_use` THEN it SHALL say that this email already has a workspace, link to `/login` as "Sign in", keep every typed value and ticked trade, and mark the email field as the one in error
8. The page SHALL NOT say whether the email belongs to an owner, a member or an invitee, nor name an org

**Independent test:** with the migration applied, call `email_has_workspace` for an email in each situation (rolled back), then submit the form against a fake check answering `true` and assert no Checkout call.

### S2: One rule for the form and the webhook (P1)

**Acceptance Criteria**

9. The `email_has_workspace` function SHALL be executable by `anon` and `authenticated` only and SHALL write nothing
10. IF `email_has_workspace` is given null, an empty string or text that is not an email THEN it SHALL answer `false` and raise no error
11. WHEN `provision_workspace` runs for an email `email_in_use` reports taken THEN it SHALL still refuse with `email_in_use` and create no org (unchanged behaviour, now through the shared predicate)
12. IF two Checkout sessions for the same new email are open at once and both complete THEN the second webhook SHALL be refused with `email_in_use` (the form cannot prevent this race; the backstop does)

**Independent test:** the existing `workspace_provisioning.sql` plus a new SQL file for the predicate's rows.

## Out of scope

| Excluded | Why |
| --- | --- |
| Refunding or alerting on a payment refused by the webhook backstop (the race in AC 12) | Refusals stay a code on the stored event (workspace-provisioning, workspace-pending-state) |
| A live "email taken" hint while typing | Each keystroke would be an oracle call; the check runs once, on submit |
| An org switcher or attaching a plan to an existing org | Decision 9: refuse with a message; a switcher is a separate feature |
| Rate limiting the anonymous read | M15 covers portal rate limits later; see assumption 1 |
| Sending the existing owner a "someone tried to register" email | A second send path and an abuse surface |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Telling an anonymous visitor that an email has an account is acceptable | Yes, on submit only, with a sign-in link | Decision 9 says "refuse with a clear message", and sign-up forms commonly do this; the alternative (a generic message) cannot tell the visitor what to do. It does let someone test whether an email has an account, one submit at a time | y (owner, 2026-11-12) |
| A failed check blocks Checkout | Answer `unavailable` (AC 6) | Refusing to start is cheaper than taking a card for a workspace the webhook may then refuse; the form already has an `unavailable` message | n |
| The check runs after validation, before Stripe | As in Flow | A malformed email never reaches the database; Stripe is never called for a taken one | n |
| Check uses the anon client | Same as `workspaceStatus` | AD-037, AD-073 | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | open | Resolved 2026-11-12: the owner accepted the exposure ("go with your recommendation"). Was: is the account-existence exposure of assumption 1 acceptable before a rate limit exists? | The default is written; reversing it means a generic message, which loses the "Sign in" hint and changes AC 7 and 8 |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/register` | error state | AC 7, AC 8, AC 6 (unavailable) |
| screen `/register` | empty state | n/a - the form is unchanged when idle |
| screen `/register` | loading state | existing - the form's pending state during the action |
| screen `/register` | unauthorised state | n/a - the page is public |
| screen `/register` | destructive action confirms | n/a - nothing is deleted |
| API Server Action `startTrialAction` | error shape and codes | AC 1, AC 5, AC 6 |
| API Server Action `startTrialAction` | who may call, rate limit | n/a - public by design; rate limit is out of scope (assumption 1) |
| API `rpc public.email_has_workspace` | error shape and codes | AC 10 |
| API `rpc public.email_has_workspace` | who may call | AC 9 |
| API `rpc public.email_has_workspace` | versioning, rate limit | n/a - an internal RPC consumed only by this app; rate limit is out of scope |

## Sources

- ROADMAP.md decision 9 (returning email: refuse with a clear message) and the Phase 5 item - what this settles
- AD-131, AD-174 (the predicate and its webhook refusal), AD-182 and AD-183 (the anonymous-read pattern and the oracle they refused)
