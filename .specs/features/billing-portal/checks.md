# Stripe Customer Portal checks

Profile: standard
Plan: `.specs/features/billing-portal/plan.md`

17 checks in 3 slices · 2 one-way doors (approved by "approved") · 3 open, of which 2 block go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C2900:`). This feature numbers from C2900 (no id above C2821 exists). `npx vitest run <file> -t "C2900:"` selects one. No SQL recipe: the plan adds no migration, policy or function.
- **Stripe** is never called by a proof: the adapter tests stub `fetch` as `checkout.test.ts` does.
- **Live** check (C2915) follows AGENTS.md: Playwright MCP at 375, 768 and 1440 px, nothing committed. The Stripe round trip needs the owner's test keys and the saved portal configuration (open question 1), so that half stays owner-run.
- Concurrency is not driven by any proof; see Swept.

## Checks

### S1 - An owner or admin reaches Stripe's portal from Settings · 9 files · ~60 KB · ~15k

**C2900** - The Billing section decision over role × subscription × configuration: only an owner or an admin of an org that has an `org_billing` row sees a section; with the Stripe key and base url present it is `ready` with the plan name ("Starter", "Team" or "Business"), without them it is `unavailable`; every other combination is `hidden` (AC 1, AC 5, AC 6, AC 9)
Proof: `cd web && npx vitest run domain/billing/portal.test.ts -t "C2900:"`

**C2901** - The section renders the plan name and a "Manage billing" submit button when `ready`; renders "Billing isn't available yet" and no button when `unavailable`; renders nothing when `hidden` (AC 1, AC 9)
Proof: `cd web && npx vitest run components/settings/billing-section.test.ts -t "C2901:"`

**C2902** - The Stripe adapter makes one `POST https://api.stripe.com/v1/billing_portal/sessions` with the bearer key, `Stripe-Version` equal to `STRIPE_VERSION`, a form body whose keys are exactly `customer` (the given id) and `return_url` (`<base>/settings`, a trailing slash on the base removed), and the key appearing nowhere else in the request (AC 2)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-portal.test.ts -t "C2902:"`

**C2903** - A signed-in owner or admin submitting the action causes exactly one portal request for the org's stored customer id and a redirect to the `url` Stripe returned (AC 2)
Proof: `cd web && npx vitest run app/\(app\)/settings/billing-action.test.ts -t "C2903:"`
Proof: `cd web && npx vitest run application/use-cases/billing-portal.test.ts -t "C2903:"`

**C2904** - The billing read selects only `stripe_customer_id` and `plan` from `org_billing` filtered by the org id on the request's own client (no service-role client, no org filter bypass), and answers `null` for no row (AC 3, Landing door 1, `ORG_BILLING` relation)
Proof: `cd web && npx vitest run infrastructure/supabase/org-billing.test.ts -t "C2904:"`

**C2905** - The action takes nothing from the browser: its form data carrying `customerId`, `customer`, `orgId` and `return_url` fields changes neither the customer id nor the return url sent to Stripe, and its source reads no `formData` (AC 3)
Proof: `cd web && npx vitest run app/\(app\)/settings/billing-action.test.ts -t "C2905:"`

**C2906** - A Stripe answer of 200 with a non-empty string `url` is ok with that url; every other answer is `unavailable`: 200 with no `url`, 200 with `url` `""`, 200 with a non-string `url`, 200 with a body that is not JSON, 400, 401, 429, 500 (AC 4)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-portal.test.ts -t "C2906:"`

### S2 - Everyone else is kept out and failures are visible · 7 files · ~45 KB · ~12k

**C2907** - For an estimator and for a viewer the use case answers `forbidden` and neither the billing read nor the portal call is made (AC 7)
Proof: `cd web && npx vitest run application/use-cases/billing-portal.test.ts -t "C2907:"`

**C2908** - The action shows "You don't have permission to change this" for an estimator or viewer and calls no Stripe port; for a signed-out visitor and for a signed-in user with no membership it redirects to `/login` and calls no Stripe port (AC 7, AC 8)
Proof: `cd web && npx vitest run app/\(app\)/settings/billing-action.test.ts -t "C2908:"`

**C2909** - Without `STRIPE_SECRET_KEY` or without `APP_BASE_URL` the container's billing summary says not configured and opening the portal answers `not_configured` with no `fetch` made; with both set it builds the Stripe adapter from them (AC 9)
Proof: `cd web && npx vitest run composition/billing-portal-wiring.test.ts -t "C2909:"`

**C2910** - A Stripe failure (a 500 answer, a refused connection, a request still open after 10 s) logs exactly one line holding the HTTP status and Stripe's `error.code` only; the log, the result and the thrown value never hold the customer id, the secret key or any part of the response body (AC 10)
Proof: `cd web && npx vitest run infrastructure/stripe/billing-portal.test.ts -t "C2910:"`

**C2911** - The settings page shows "We couldn't open billing. Try again in a moment." for an `unavailable` result of the action, and the permission text for `forbidden` (AC 10)
Proof: `cd web && npx vitest run components/settings/billing-section.test.ts -t "C2911:"`
Proof: `cd web && npx vitest run app/\(app\)/settings/billing-action.test.ts -t "C2911:"`

**C2912** - A database error while reading `org_billing` makes the use case answer `unavailable`, makes no portal call, and the settings page still renders without the Billing button (AC 11)
Proof: `cd web && npx vitest run application/use-cases/billing-portal.test.ts -t "C2912:"`
Proof: `cd web && npx vitest run app/\(app\)/settings/billing-action.test.ts -t "C2912:"`

### S3 - The new screen works on every size · 3 files · ~15 KB · ~4k

**C2913** - While the action is pending the button is disabled and shows a pending label, and the form carries no second submit path, so one press makes one portal request (AC 13)
Proof: `cd web && npx vitest run components/settings/billing-section.test.ts -t "C2913:"`

**C2914** - Wiring: the container exposes the billing summary and the open-portal function built on the request's one Supabase client, and the Settings page and its action read them from `getContainer()`; `STRIPE_SECRET_KEY` appears only under `composition/` among non-test sources (Flow hops 1 to 4)
Proof: `cd web && npx vitest run composition/billing-portal-wiring.test.ts -t "C2914:"`
Proof: `cd web && npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C2510:"`
Proof: `cd web && npx vitest run infrastructure/stripe/billing-boundaries.test.ts -t "C2511:"`

**C2915** - `/settings` as an owner with a subscription at 375, 768 and 1440 px shows no horizontal scroll, the "Manage billing" button is at least 44 by 44 px on mobile and tablet, a touch tap on it responds (to Stripe, or to the notice when Stripe refuses), and the console has no error (AC 12)
Proof: `cd web && npx vitest run components/settings/billing-section.test.ts -t "C2913:"` for the markup, then the live Playwright MCP run per AGENTS.md (author-run, nothing committed); the report lists pages, sizes, touch actions and fixes. The Stripe leg runs only with the owner's test keys

**C2916** - The Settings page asks the container for the Billing section of the signed-in member's org and role and hands it, with the portal action, to `SettingsView`; `SettingsView` mounts the section for `ready` and `unavailable` and leaves the page without a Billing heading for `hidden` or no section; a signed-out visitor goes to `/login` with no billing read. Added after verifier round 1 found no proof that the page mounts the section (AC 1, AC 5, AC 6, Surface `GET /settings` 200)
Proof: `cd web && npx vitest run components/settings/billing-in-settings.test.ts -t "C2916:"`
Proof: `cd web && npx vitest run app/\(app\)/settings/page.test.ts -t "C2916:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| Billing section decision: role × subscription × configured (16) | owner billing configured C2900 · owner billing not configured C2900 · owner no billing configured C2900 · owner no billing not configured C2900 · admin billing configured C2900 · admin billing not configured C2900 · admin no billing configured C2900 · admin no billing not configured C2900 · estimator billing configured C2900 · estimator billing not configured C2900 · estimator no billing configured C2900 · estimator no billing not configured C2900 · viewer billing configured C2900 · viewer billing not configured C2900 · viewer no billing configured C2900 · viewer no billing not configured C2900 | - |
| plan names (3) | starter C2900 · team C2900 · business C2900 | - |
| section render states (3) | ready C2901 · unavailable C2901 · hidden C2901 | - |
| `GET /settings` statuses (2) | 200 with or without the section C2901 C2912 · 303 /login unchanged C2908 | - |
| `openBillingPortalAction` statuses (3) | 303 to Stripe C2903 · 200 with notice C2908 C2911 C2912 · 303 /login C2908 | - |
| Stripe `POST /v1/billing_portal/sessions` statuses (2) | 200 with url C2902 C2906 · anything else unavailable C2906 | - |
| Stripe answers that are `unavailable` (8) | no url C2906 · empty url C2906 · non-string url C2906 · not JSON C2906 · 400 C2906 · 401 C2906 · 429 C2906 · 500 C2906 | - |
| failure paths that log one line (3) | HTTP 500 C2910 · connection refused C2910 · 10 s timeout C2910 | - |
| request fields (2) | `customer` C2902 · `return_url` C2902 | - |
| browser-supplied fields ignored (4) | `customerId` C2905 · `customer` C2905 · `orgId` C2905 · `return_url` C2905 | - |
| roles that reach the action (4) | owner C2903 · admin C2903 · estimator C2907 C2908 · viewer C2907 C2908 | - |
| no-session cases (2) | signed out C2908 · no membership C2908 | - |
| `OrgBilling` columns read (2) | stripe_customer_id C2904 · plan C2904 | - |
| `org_billing` entity relation (1) | read under the member's own client C2904 | - |
| Landing door 2: portal over `fetch`, no SDK (1) | adapter C2902 · no `stripe` dependency C2914 | - |
| startup config: container assembly (1) | `getContainer` with `STRIPE_SECRET_KEY` and `APP_BASE_URL` C2909 C2914 | - |

- Claims naming a status code, route or response shape: C2902, C2903, C2906, C2908 - each has a proof that crosses the boundary at its own layer; the redirect is asserted through the action's mocked `redirect`
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (domain, use case) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (Server Action, page) | one at the boundary | accepted input, each rejected input, each error path |
| Adapter (Supabase, Stripe) | one against the client or `fetch` double | request keys, filters and each error reply |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:

- `domain/billing/portal.ts` (new): decision over role, subscription and configuration (16 rows) -> decides
- `application/use-cases/billing-portal.ts` (new): role gate, read, portal call, four outcomes (`forbidden`, `no_subscription`, `unavailable`, ok) -> decides
- `infrastructure/stripe/billing-portal.ts` (new): one request, one conditional on status and `url` (9 rows with the ok case) -> adapter
- `infrastructure/supabase/org-billing.ts` (new): one query, one conditional (no row is `null`) -> adapter
- closest analogues: `infrastructure/stripe/checkout.ts` with `checkout.test.ts` and `infrastructure/supabase/setup.ts` with `setup.test.ts`, same shapes, already proven at this level

Cost: 8 test files at their own layer, no SQL recipe.

## Swept

- validation: C2906 (the only external input is Stripe's answer; every shape of it), C2905 (nothing is taken from the browser)
- failure modes: C2910 (status, connection, timeout), C2912 (read failure), C2911 (the notice)
- idempotency: C2913 (a double press is one request). Opening a portal session twice is harmless at Stripe; each session is a new one-time link
- authorization: C2900, C2907, C2908; RLS `org_billing_select` (owner and admin, workspace-provisioning door 1) is the database rule and C2904 proves the read goes through it
- concurrency: n/a - the feature only reads one row and asks Stripe for a link; nothing is written, so no interleaving changes an outcome. No proof drives one
- data lifecycle: n/a - nothing is stored; the session link is Stripe's and short-lived, and an org with no `org_billing` row shows no section (C2900)
- dependency failure: C2906, C2910 (Stripe down, slow or refusing, including the unsaved portal configuration, which is a 400), C2909 (not configured)
- state transitions: n/a - the feature adds no state; the section is a pure function of role, subscription and configuration (C2900)
- observability: C2910 (one log line with status and code, never the id, key or body), as `checkout.ts` does

## Out of scope

See the plan's table: cancel-on-failed-payment rule, reacting to subscription events, in-app invoices or plan switcher, portal configuration through the API, trial end date, seat enforcement, a sidebar entry.

## Handoff

- S1 = 15k, S2 = 12k, S3 = 4k: 31k total, one surface (web, no migration), under the 150k budget - one builder
- Mechanism: one builder
