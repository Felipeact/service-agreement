# Workspace pending state

Roadmap Phase 5 item "Setting up your workspace" state while a paid org is pending. It is the first reader of the process state that workspace-provisioning stamps on the Stripe ledger (`processed_at`, `process_error`, AD-174). One feature at a time (decision 22). The duplicate-email refusal at Checkout, plan limits, the template preview and the Auth SMTP sender stay separate items (Out of scope).

## Problem

A visitor who has just paid is told "Your trial is registered. We will email a sign-in link" by a static page that knows nothing about their workspace. The Stripe webhook that builds the workspace can arrive after the redirect, or can refuse the checkout (`invalid_metadata`, `no_pack`, `email_in_use`); in both cases the page says the same reassuring thing and the visitor, who has paid with a card, waits for an email that may never come. If they try to sign in anyway, they meet "No workspace yet. Ask your company's owner to invite you", which is wrong for someone who is the owner and just paid. The roadmap gives no support volume or sign-up figure, so none is claimed here.

When this ships, the page Stripe returns the visitor to says whether the workspace is being built, is ready, or could not be built, and keeps checking for a short while. A signed-in person with no membership whose paid checkout was refused or is still unresolved is told that, instead of being told to ask an owner.

## Flow

Reuses the ledger and its process state (`private.stripe_events`, AD-170, AD-174), the exact public entry `/register/success` (AD-171), and the anonymous security-definer RPC pattern of `portal_view` and `signature_view` (AD-068, AD-143), instead of a new public route, a Stripe read per poll or a service-role key (AD-037, AD-073).

1. Stripe redirects the visitor -> `/register/success?session_id=cs_...` (exists, changed) - the checkout starter now asks Stripe to append the session id (door 1)
2. `RegisterSuccessPage` (exists, changed) - reads `session_id`; with none it renders today's static copy; with one it renders the status panel, a client component that polls
3. Server Action `checkWorkspace` on the same path (new, no door - a POST to an already public path) -> new `WorkspaceStatus` port -> `supabaseWorkspaceStatus` (new, placement) -> `public.checkout_workspace_status(p_session_id)` (new, door 2) - answers `pending`, `ready` or `refused` from the stored `checkout.session.completed` whose session id matches
4. out: the panel shows the answer; while `pending` it asks again every 3 seconds, 20 times at most, then shows the slow state
5. `MemberGate` (exists, changed) -> `NoWorkspace` (exists, changed) - for `no_membership` it asks `public.my_workspace_state()` (new, door 3) for the signed-in email and picks the copy

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: workspace state - `pending`, `ready` or `refused`, derived from a stored checkout event's `processed_at` and `process_error`; lives in `web/domain/billing` and the two RPCs |
| domain | existing term: "No workspace yet" meant "not a member of any org"; it still does for a signed-in person with no matching checkout event. Branches on it today: `MemberGate` and `layout.test.ts` (C19) |
| domain | existing term: `/register/success` was a static page that reads nothing from the request (billing-checkout S3); it now reads one query value and calls a Server Action |
| stored data | nothing to migrate: two read-only functions over `private.stripe_events`. Events stored before this ships answer from their existing columns |
| secrets / env | none new |
| tests | `checkout.test.ts` asserts the Checkout request body; its `success_url` row changes by the new suffix (a new check, the approved one stays true for the base). `billing-docs.test.ts` lists `PUBLIC_PATHS`; it does not change because no path is added |
| advisors | one more `anon` and one more `authenticated` security-definer lint, the accepted kind (AD-143) |
| not changed | the webhook route, `private.provision_workspace`, the Checkout metadata, `/register`, RLS on every table |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /register/success` | optional `session_id` query | the page: static copy without it, the status panel with it | `200` |
| Server Action on `/register/success` | `session_id` | `pending` · `ready` · `refused` · `unavailable` | `200` |
| `rpc public.checkout_workspace_status` | `p_session_id text` | `'pending'` · `'ready'` · `'refused'`, never the error code | `200` always, a malformed or unknown id answers `pending` |
| `rpc public.my_workspace_state` | none, reads the caller's email | `'none'` · `'pending'` · `'refused'` | `200`, `42501` for `anon` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Where Stripe sends the visitor | `success_url: ${base}/register/success?session_id={CHECKOUT_SESSION_ID}`, the braces left literal because Stripe substitutes them and would not match an encoded form | a cookie or a form post carrying the id: Stripe redirects with a GET only. Polling by the buyer's email: an anonymous caller could probe which emails have paid |
| 2. The anonymous read | `public.checkout_workspace_status(p_session_id text) returns text`, definer, `search_path = ''`, `revoke ... from public`, `execute` to `anon, authenticated`, reads and writes nothing else; `ready` when the matching event has `processed_at`, `refused` when it has `process_error`, `pending` for everything else including a malformed, unknown or empty id, so it is no oracle for ids | `select` on `private.stripe_events` through a policy: a platform table holding the whole Stripe body, one anon policy would expose it. Asking Stripe live per poll: an anonymous caller would spend the secret key's rate limit and each poll becomes a billed-by-time external call |
| 3. The signed-in read | `public.my_workspace_state() returns text`, definer, `search_path = ''`, `execute` to `authenticated` only; matches stored `checkout.session.completed` events by the lower-cased `auth.jwt()` email; `refused` if any has `process_error`, `pending` if any has neither stamp, else `none` | reusing door 2 with the email as input: that is the oracle door 1 refuses |

- Door 3, as built, answers `none` when any stored checkout for the caller's email is processed, before it looks for a refusal: a person whose first attempt was refused and whose later one succeeded is told nothing wrong. Otherwise as written: `refused`, then `pending`, then `none`.
- Nothing else in this change is hard to reverse: polling interval and count, copy, the panel's placement and the port's name are edits.
- Doors 2 and 3 are a pattern later features copy (anonymous status reads), so both go to `STATE.md` as ADs at the end of the build.

## Criteria

### S1: The page Stripe returns the visitor to says what happened (P1)

The visitor sees one of four states, not one reassuring sentence.

**Acceptance Criteria**

1. The system SHALL send Stripe a `success_url` of `<base>/register/success?session_id={CHECKOUT_SESSION_ID}` with the braces literal
2. WHEN `/register/success` is opened without a `session_id` THEN the system SHALL render today's static copy and make no status call
3. WHEN it is opened with a `session_id` THEN the system SHALL render "Setting up your workspace" and ask the Server Action for the state at once
4. WHEN the stored `checkout.session.completed` for that session has `processed_at` set THEN `checkout_workspace_status` SHALL answer `ready` and the panel SHALL say the workspace is ready, that a sign-in link was emailed, and offer a Sign in button
5. WHEN the matching event has `process_error` set THEN it SHALL answer `refused` and the panel SHALL say the workspace could not be set up and link to the contact page; the panel SHALL not show the error code
6. WHILE the answer is `pending` the panel SHALL ask again every 3 seconds, at most 20 times
7. WHEN 20 answers in a row are `pending` THEN the panel SHALL stop asking and say it is taking longer than usual, with the sign-in and contact links
8. IF a malformed, empty or unknown `session_id` is given THEN `checkout_workspace_status` SHALL answer `pending` and raise no error
9. IF the Server Action or its database call fails THEN the panel SHALL show the wording of AC 7, keep the visitor's page intact and not throw to the error boundary
10. The `checkout_workspace_status` function SHALL be executable by `anon` and `authenticated` only, SHALL read nothing but the stored checkout event matching the id and SHALL write nothing

**Independent test:** with the migration applied, insert a stored checkout event (rolled back) and call the function with its session id, then open the page with that id against a fake status port in each of the four answers.

### S2: A signed-in person with no workspace is told the truth (P2)

**Acceptance Criteria**

11. WHEN a signed-in user with no membership has a stored checkout event for their email with `process_error` set THEN `my_workspace_state` SHALL answer `refused` and `NoWorkspace` SHALL say their payment was received, the workspace could not be built, and link to the contact page
12. WHEN such a user has a stored checkout event for their email with neither `processed_at` nor `process_error` THEN it SHALL answer `pending` and `NoWorkspace` SHALL say "Setting up your workspace" with a Refresh link to the same page
13. WHEN such a user has no stored checkout event for their email, or the call fails, THEN `NoWorkspace` SHALL render exactly today's "No workspace yet" copy
14. IF `anon` calls `my_workspace_state` THEN the database SHALL refuse with `42501`
15. WHEN the user has any membership THEN `MemberGate` SHALL make no `my_workspace_state` call

**Independent test:** a rolled-back SQL test with three stored events for three emails, and a render test of `NoWorkspace` in each state.

## Out of scope

| Excluded | Why |
| --- | --- |
| Refusing an email that already belongs to an org at Checkout | Its own roadmap item; this feature only reports the outcome after the fact |
| Asking Stripe whether a paid session exists when no event has arrived | Needs a Stripe read from a signed-in or anonymous request; `none` stays today's copy (assumption 1) |
| Alerts, refunds or a retry button for a refused checkout | Refusals stay a code on the stored event (workspace-provisioning) |
| Resending the sign-in link from the success page | A second send path and an abuse surface; the visitor can use `/login` |
| Per-code explanations of why it was refused | The code stays internal; one message and a contact link |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| A late webhook cannot be seen by a signed-in user | Until the event is stored, `NoWorkspace` keeps today's copy; the success page covers the late case by polling | The app knows nothing of a payment before Stripe's event arrives; a live Stripe lookup is a separate decision | n |
| Poll rhythm | Every 3 s, 20 times (about 60 s) | Provisioning is a few inserts in the webhook transaction; a minute covers a delayed delivery without polling forever | n |
| `refused` hides the code | One generic message plus a contact link | Codes like `email_in_use` reveal whether an email has an account | n |
| The Server Action is the poller | A Server Action on the already public `/register/success`, not a new public route | Adds no `PUBLIC_PATHS` entry (AD-171 forbids prefixes) | n |
| Rate limiting the poll | None added | 20 calls per visit of a read-only function over a small table; ids are unguessable. Portal rate limits (M15) can cover it later | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/register/success` | empty state (no `session_id`) | AC 2 |
| screen `/register/success` | loading state | AC 3, AC 6 |
| screen `/register/success` | error state | AC 5, AC 7, AC 9 |
| screen `/register/success` | unauthorised state | n/a - a public page with no account; the id is the only input |
| screen `/register/success` | density and ordering | existing - `PageHero` and the same `SiteShell` as today; the panel replaces the hero's text |
| screen `/register/success` | destructive action confirms | n/a - no destructive action |
| screen `NoWorkspace` | empty, loading, error | AC 13 |
| screen `NoWorkspace` | unauthorised state | existing - `MemberGate` redirects signed-out users before it renders |
| screen `NoWorkspace` | destructive action confirms | n/a - Sign out already exists unchanged |
| API Server Action on `/register/success` | response shape and error shape | AC 9, Surface |
| API Server Action on `/register/success` | who may call it, versioning | n/a - public like its page; Server Actions are not versioned |
| API Server Action on `/register/success` | rate limit | Assumptions row 5 |
| API `rpc checkout_workspace_status` | error shape and codes | AC 8 |
| API `rpc checkout_workspace_status` | who may call it | AC 10 |
| API `rpc my_workspace_state` | error shape and who may call it | AC 14 |
| API both rpcs | versioning, rate limits | n/a - internal functions; rate limits per Assumptions row 5 |

## Sources

- `.specs/features/workspace-provisioning/plan.md` - the process state this reads (`processed_at`, `process_error`) and its error codes
- ROADMAP.md Onboarding, "Edge cases to design for" - the success page polls and the no-workspace state says "Setting up your workspace"
