# First-login setup checks

Profile: standard
Plan: `.specs/features/first-login-setup/plan.md`

22 checks in 4 slices · 1 one-way door (approved by "implement") · 2 open, of which 1 blocks go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C2800:`). This feature numbers from C2800 (no id above C2731 exists). `npx vitest run <file> -t "C2800:"` selects one.
- **SQL** recipe `first_login_setup` runs with `npm run test:db first_login_setup` from `web/` (new `supabase/tests/first_login_setup.sql`, registered in `RECIPES`, run after `fixture.sql`, rolled back). The migration is **not applied to the hosted project** without the owner's go-ahead (rule 8), so the recipe puts the migration file between the fixture and the test, inside the rolled-back transaction (the way workspace-provisioning did until it was applied). Assertions are labelled with the check id. Expected values come from the plan, never read back from the migration.
- **Live** checks (C2820) follow AGENTS.md: Playwright MCP at 375, 768 and 1440 px, nothing committed.
- Concurrency is not driven by any proof; see Swept.

## Checks

### S1 - A freshly provisioned owner is taken to setup once · 8 files · ~70 KB · ~18k

**C2800** - For an owner and for an admin of an org whose setup is pending, the gate decision is "go to setup" (AC 1)
Proof: `cd web && npx vitest run domain/org-settings/setup.test.ts -t "C2800:"`

**C2801** - For an estimator and for a viewer of an org whose setup is pending, the gate decision is "proceed" (AC 2)
Proof: `cd web && npx vitest run domain/org-settings/setup.test.ts -t "C2801:"`

**C2802** - For all four roles of an org whose setup is not pending, the gate decision is "proceed" (AC 3)
Proof: `cd web && npx vitest run domain/org-settings/setup.test.ts -t "C2802:"`

**C2803** - An org created by `private.provision_workspace` (a real Checkout event through `stripe_receive_event`) has `org_settings.setup_completed_at` null (AC 4)
Proof: `npm run test:db first_login_setup` (assertions labelled `C2803`)

**C2804** - After the migration every `org_settings` row that the fixture created before it holds a non-null `setup_completed_at`, and an `org_settings` row inserted with no value for the column gets one near `now()` (AC 5)
Proof: `npm run test:db first_login_setup` (assertions labelled `C2804`)

**C2805** - Only the Pipeline page redirects to `/setup`: no other file under `web/app` or `web/components` contains a redirect to `/setup`, and the Pipeline page does (AC 6)
Proof: `cd web && npx vitest run app/setup/setup-wiring.test.ts -t "C2805:"`

**C2806** - Opening `/setup` as an owner or admin when setup is not pending decides "redirect to /pipeline" (AC 7)
Proof: `cd web && npx vitest run domain/org-settings/setup.test.ts -t "C2806:"`

**C2807** - Opening `/setup` as an estimator, a viewer or a signed-in user with no membership decides "redirect to /pipeline"; a signed-out visitor decides "redirect to /login", and the proxy sends a signed-out request for `/setup` to `/login` (AC 8)
Proof: `cd web && npx vitest run domain/org-settings/setup.test.ts -t "C2807:"`
Proof: `cd web && npx vitest run proxy.setup.test.ts -t "C2807:"`

### S2 - The company profile is confirmed in one form · 9 files · ~90 KB · ~25k

**C2808** - The setup form opens with the legal name and phone from the stored settings, and with address, accent colour, province and the two item words showing their stored values (blank when none) (AC 9)
Proof: `cd web && npx vitest run components/setup/setup.test.ts -t "C2808:"`

**C2809** - Saving a valid form updates exactly `legal_name`, `address`, `phone`, `accent_color`, `governing_province`, `item_singular`, `item_plural` and `updated_at` on `org_settings` (no other column), stamps `setup_completed_at`, and the Server Action redirects to `/pipeline` (AC 10, AC 11)
Proof: `cd web && npx vitest run infrastructure/supabase/setup.test.ts -t "C2809:"`
Proof: `cd web && npx vitest run app/setup/actions.test.ts -t "C2809:"`

**C2810** - Invalid input returns every field error together (legal name empty, legal name of 121 characters, accent colour `blue`, item word `Fixtures!`, province empty, province `ZZ`), stores nothing and never calls the stamp (AC 12)
Proof: `cd web && npx vitest run domain/org-settings/setup.test.ts -t "C2810:"`
Proof: `cd web && npx vitest run app/setup/actions.test.ts -t "C2810:"`

**C2811** - When the profile update changes no row (RLS refusal) the store answers `forbidden`, the stamp is not requested, and the action shows "You don't have permission to change this"; in the database an estimator's update of `org_settings` changes 0 rows and leaves `setup_completed_at` null (AC 13)
Proof: `cd web && npx vitest run infrastructure/supabase/setup.test.ts -t "C2811:"`
Proof: `cd web && npx vitest run app/setup/actions.test.ts -t "C2811:"`
Proof: `npm run test:db first_login_setup` (assertions labelled `C2811`)

**C2812** - Skip stamps only: one update touching only `setup_completed_at`, no profile column, then the action redirects to `/pipeline` (AC 14)
Proof: `cd web && npx vitest run infrastructure/supabase/setup.test.ts -t "C2812:"`
Proof: `cd web && npx vitest run app/setup/actions.test.ts -t "C2812:"`

**C2813** - The stamp only touches a null value: the adapter filters `setup_completed_at is null`, and in the database that statement run twice as the owner leaves the first timestamp (AC 15)
Proof: `cd web && npx vitest run infrastructure/supabase/setup.test.ts -t "C2813:"`
Proof: `npm run test:db first_login_setup` (assertions labelled `C2813`)

**C2814** - Door 1's shape: `org_settings.setup_completed_at` is `timestamp with time zone`, nullable, default `now()`; and `anon` and `authenticated` gain no new privilege path (an owner can stamp through the existing update policy, a viewer cannot) (Landing door 1)
Proof: `npm run test:db first_login_setup` (assertions labelled `C2814`)

### S3 - The owner sees what the catalog gave them · 5 files · ~40 KB · ~10k

**C2815** - The review groups the org's types by pack in the order hvac, plumbing, electrical, then types of no pack under "Added by you"; each group shows its count in the org's words ("20 plumbing types", "1 type" in the singular) and the names in the order given (AC 16)
Proof: `cd web && npx vitest run domain/org-settings/setup.test.ts -t "C2815:"`

**C2816** - The catalog read selects `pack` and `name` from `asset_types` ordered by name and carries no org filter of its own (RLS scopes it) (AC 16)
Proof: `cd web && npx vitest run infrastructure/supabase/setup.test.ts -t "C2816:"`

**C2817** - With no types the review shows "No types yet" and says they are added in the task library, with no Claude draft or generate control (AC 17)
Proof: `cd web && npx vitest run components/setup/setup.test.ts -t "C2817:"`

**C2818** - The catalog review markup holds no input, select, textarea or form control (AC 18)
Proof: `cd web && npx vitest run components/setup/setup.test.ts -t "C2818:"`

### S4 - The screen works on every size and fails visibly · 3 files · ~10 KB · ~5k

**C2819** - A reader failure does not stamp setup: the page has a `loading.tsx`, an `error.tsx` renders "Try again" wired to `reset`, and the page itself writes nothing (a GET stamps no flag) (AC 20)
Proof: `cd web && npx vitest run app/setup/setup-wiring.test.ts -t "C2819:"`

**C2820** - `/setup` at 375, 768 and 1440 px shows no horizontal scroll, every control is at least 44 by 44 px on mobile and tablet, touch taps work on the province select, Continue and Skip, and the console has no error (AC 19)
Proof: live Playwright MCP run per AGENTS.md (author-run, nothing committed); the report lists pages, sizes, touch actions and fixes

**C2821** - The container exposes the setup store built on the request's one Supabase client, and the Pipeline page and the setup page read it from `getContainer()` (Flow hops 1, 2, 3)
Proof: `cd web && npx vitest run composition/setup-wiring.test.ts -t "C2821:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| gate decision: role × pending (8) | owner pending C2800 · admin pending C2800 · estimator pending C2801 · viewer pending C2801 · owner not pending C2802 · admin not pending C2802 · estimator not pending C2802 · viewer not pending C2802 | - |
| `/setup` entry decision (5) | owner/admin pending render C2808 · not pending C2806 · estimator/viewer C2807 · no membership C2807 · signed out C2807 | - |
| `GET /setup` statuses (3) | 200 C2808 · 303 /login C2807 · 303 /pipeline C2806 C2807 | - |
| `POST /setup` statuses (3) | 303 save C2809 · 303 skip C2812 · 200 with errors or notice C2810 C2811 | - |
| `GET /pipeline` new status (1) | 303 /setup C2800 | - |
| `POST /setup` intents (2) | save C2809 · skip C2812 | - |
| invalid input cases (6) | name empty C2810 · name 121 C2810 · accent `blue` C2810 · item word `Fixtures!` C2810 · province empty C2810 · province `ZZ` C2810 | - |
| profile columns written (7) | legal_name C2809 · address C2809 · phone C2809 · accent_color C2809 · governing_province C2809 · item_singular C2809 · item_plural C2809 (exact key set) | - |
| `setup_completed_at` stampers (3) | provision leaves null C2803 · migration backfill C2804 · stamp keeps first value C2813 | - |
| catalog groups (4) | hvac C2815 · plumbing C2815 · electrical C2815 · added by you C2815 | - |
| `org_settings` entity relation (1) | column and policy C2814 | - |
| `asset_types` entity relation (1) | read C2816 | - |
| startup config: container assembly (1 place) | `getContainer` C2821 | - |

- Claims naming a status code, route or response shape: C2800, C2806, C2807, C2809, C2812 - each has a proof that crosses the decision at its own layer; the redirect itself is `redirect()` in a Server Component or Action, asserted through the action's mocked `redirect` (C2809, C2812) and the wiring test (C2805)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (domain) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (Server Action, page) | one at the boundary | accepted input, each rejected input, each error path |
| Adapter | one against the client double | payload keys, filters and each error reply |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:

- `domain/org-settings/setup.ts` (new): gate and entry decisions over role and pending (8 and 5 rows), the validation (6 failure cases) -> decides
- `infrastructure/supabase/setup.ts` (new): three queries, one decision (empty result is `forbidden`) -> adapter
- closest analogue: `infrastructure/supabase/settings.ts` with `settings.test.ts` (C146, C149, C150), same shape, already proven at this level

Cost: 3 test files at their own layer plus one SQL recipe.

## Swept

- validation: C2810 (every field with its bound, province required here)
- failure modes: C2811 (RLS refusal), C2819 (read failure), C2809 (stamp after profile: a failure between them leaves a saved, unstamped profile the owner re-submits)
- idempotency: C2813 (a second stamp keeps the first), C2812
- authorization: C2801, C2807, C2811, C2814 (RLS on `org_settings` already gates the write; the gate and the page add the role check)
- concurrency: n/a - last write wins on the profile columns like `/settings`, and the stamp is a conditional update; two owners finishing together both redirect to `/pipeline`. No proof drives an interleaving (one rolled-back connection)
- data lifecycle: C2804 (every existing org is marked done), C2803 (a provisioned org starts pending)
- dependency failure: C2819
- state transitions: C2800, C2802, C2813 (pending to done only; there is no way back in this feature)
- observability: n/a - the stamp's own timestamp is the record; adapter failures are logged once with the code and message as the Settings store does (settings.ts), asserted in C2811

## Out of scope

See the plan's table: logo upload, template preview, the "Other" draft, editing types, other pages redirecting, banners and reopening, terms defaults, setup for existing orgs.

## Handoff

- S1 = 18k, S2 = 25k, S3 = 10k, S4 = 5k: 58k total, one surface (web plus one migration), under the 150k budget - one builder
- Mechanism: one builder
