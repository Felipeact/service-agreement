# Workspace provisioning checks

Profile: standard
Plan: `.specs/features/workspace-provisioning/plan.md`

31 checks in 5 slices · 3 one-way doors (approved by "implement"; door 3 reuses an existing port, see the plan's Landing note) · 4 open, of which 2 block go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C2704:`). This feature numbers from C2700 (no id above C2624 exists). `npx vitest run <file> -t "C2704:"` selects one.
- **SQL** recipe `workspace_provisioning` runs with `npm run test:db workspace_provisioning` from `web/` (new file `supabase/tests/workspace_provisioning.sql`, registered in `RECIPES`, run after `fixture.sql`, rolled back). The migration is **not applied to the hosted project** without the owner's go-ahead (rule 8), so the recipe puts the migration file between the fixture and the test, inside the rolled-back transaction. Every assertion is labelled with its check id. Signing helpers are copied from `stripe_events.sql` (`sx_*`), which this recipe's migration extends.
- Expected values (codes, the 30-day expiry, row counts) are written in the tests from the plan, never read back from the migration.
- Concurrency is not driven by any proof (one rolled-back connection); see Swept.

## Checks

### S1 - A completed Checkout becomes a ready workspace · 3 files · ~60 KB · ~15k

**C2700** - A recorded `checkout.session.completed` with valid metadata, a customer id, a subscription id and an email creates exactly one org named by `company`, one `org_settings` with `legal_name` = company and `phone` = phone, and one `org_billing` row holding customer id, subscription id, plan, seats and trades (AC 1)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2700`)

**C2701** - Trades `hvac`, `plumbing`, `electrical` each seed that pack's types into the new org (counts 40, 20, 20 as the packs hold today, read from `private.catalog_asset_types` by pack in the test, plus each pack's code present) and `org_settings.trade_context` holds exactly the seeded packs' phrases (AC 2)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2701`)

**C2702** - `other` alone seeds 0 types and sets `other_trade` true; `other` with `plumbing` seeds the plumbing pack and sets `other_trade` true; a pack alone sets it false (AC 3)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2702`)

**C2703** - The owner invitation is for the lower-cased trimmed email, role `owner`, `invited_by` null, `expires_at` between 29 days 23 hours and 30 days 1 hour from now, not accepted (AC 4)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2703`)

**C2704** - A successful provisioning sets the event's `processed_at` and leaves `process_error` null (AC 5)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2704`)

**C2705** - A user created with the checkout address who calls `accept_invitations` becomes the `owner` member of the new org (AC 6)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2705`)

**C2706** - Events of the other five stored types, recorded with provisioning-shaped metadata, create no org and leave `processed_at` and `process_error` null (AC 7)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2706`)

### S2 - Nothing is created twice · same files · ~8k

**C2707** - Re-delivering a processed event id answers `{"outcome": "duplicate"}` with no `provisioned` key, and the org, invitation and `org_billing` counts stay 1 (AC 8)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2707`)

**C2708** - Re-delivering a stored event id whose `processed_at` is null (a refused attempt that has since become valid, or a pre-existing row) provisions it: the answer is `duplicate` with `provisioned` holding the owner email, `processed_at` is set and `process_error` is cleared to null (AC 9)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2708`)

**C2709** - A second `checkout.session.completed` with a new event id and an already-provisioned subscription id creates no org and stamps `process_error` `already_provisioned`; one `org_billing` row remains for that subscription (AC 10)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2709`)

**C2710** - The mechanism that serialises two simultaneous deliveries exists: `stripe_events` is keyed by id so the second insert waits and then conflicts, the retry path locks the row (`for update`) before reading `processed_at`, and `org_billing` is unique on subscription id and on customer id (AC 11)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2710`; the interleaving itself is a named gap, see Swept)

**C2711** - The `receiveStripe` use case does not call the link sender for `duplicate`, `ignored`, or `recorded` without `provisioned`, and the SQL answer carries `provisioned` only on the delivery that created the org (AC 12, AC 21)
Proof: `cd web && npx vitest run application/use-cases/stripe-provisioning.test.ts -t "C2711:"`
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2711`)

### S3 - A checkout that cannot be provisioned leaves a reason, not a half-built tenant · same files · ~10k

**C2712** - Each invalid metadata case creates no org and stamps `invalid_metadata`: plan `gold`, plan missing, trades empty, trades `fire`, seats below the plan's included seats, seats above 50, seats `abc`, company empty, company of 121 characters, email missing (AC 13)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2712`, table-driven over all 10)

**C2713** - An email that already has a membership in another org, or a live invitation in another org, creates no org and stamps `email_in_use`; an expired invitation or an accepted one does not block (AC 14)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2713`)

**C2714** - A failure after the org insert leaves no `orgs`, `org_settings`, `org_billing`, `asset_types` or `invitations` row from the attempt: a trigger that raises on the invitation insert gives `failed`, and a pack whose `released_at` is null gives `no_pack` (AC 15)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2714`)

**C2715** - A session with `mode` `payment`, or no customer id, or no subscription id creates no org and stamps `not_a_subscription` (AC 16)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2715`)

**C2716** - A refused or failed provisioning still answers `{"outcome": "recorded"}` and keeps the event row with its code (AC 17)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2716`)

**C2717** - `process_error` can only hold one of the six codes (a check constraint refuses any other value, including one containing the email), and no refused case above stores the email, company or phone in any column of the event beyond its original body (AC 18)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2717`)

### S4 - The owner receives a sign-in link · 5 files · ~40 KB · ~10k

**C2718** - When the database answer holds `provisioned: { email }`, the use case calls `InvitationLinkSender.send` exactly once with that email; the adapter passes the `provisioned` email through and omits it when absent or malformed (AC 19)
Proof: `cd web && npx vitest run application/use-cases/stripe-provisioning.test.ts -t "C2718:"`
Proof: `cd web && npx vitest run infrastructure/supabase/stripe-events.test.ts -t "C2718:"`

**C2719** - `getWebhookContainer()` builds the sender from a client with the publishable key and no session, never a service-role key, and a provisioned delivery through the container reaches `signInWithOtp` with `shouldCreateUser: true` (AC 19)
Proof: `cd web && npx vitest run composition/provisioning-wiring.test.ts -t "C2719:"`

**C2720** - If the sender answers `{ ok: false }` or throws, the use case still returns `{ ok: true, outcome: "recorded" }` and logs once, with the error name or code and no email (AC 20)
Proof: `cd web && npx vitest run application/use-cases/stripe-provisioning.test.ts -t "C2720:"`

**C2721** - The route's response body for a provisioned delivery is exactly `{"outcome":"recorded"}` (no `provisioned`, no email) and its statuses stay `200`, `401`, `400`, `503` (AC 22)
Proof: `cd web && npx vitest run app/api/webhooks/stripe/route.test.ts -t "C2721:"`

### S5 - Billing details are private to the tenant's managers · same SQL file · ~5k

**C2722** - An `owner` and an `admin` of org A select org A's `org_billing` row and not org B's (AC 23)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2722`)

**C2723** - An `estimator`, a `viewer`, a member of another org and `anon` select no `org_billing` rows (AC 24)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2723`)

**C2724** - `anon` and `authenticated` have no insert, update, delete or truncate privilege on `org_billing`, and a direct insert as `authenticated` fails with `42501` (AC 25)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2724`)

**C2725** - An org inserted without any `org_billing` row works as before: the fixture orgs have none, and `public.orgs`, `org_settings` and `memberships` accept rows with no billing row (AC 26)
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2725`)

### Doors

**C2726** - Door 1: `org_billing` has RLS enabled, is keyed by `org_id` referencing `orgs` with cascade (deleting the org removes the row), and `trades` / `plan` hold the strings exactly as the metadata sent them
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2726`)

**C2727** - Door 2: `private.stripe_events` has nullable `processed_at` and `process_error`; `anon` and `authenticated` still have no privilege on it; `stripe_receive_event` keeps `security definer`, `search_path = ''` and execute only for `anon` and `authenticated`
Proof: `npm run test:db workspace_provisioning` (assertions labelled `C2727`)

**C2728** - The existing `stripe_events` recipe still passes with the migration applied inside it (no earlier answer changed)
Proof: `npm run test:db stripe_events` (recipe includes the migration part too)

**C2729** - The existing `InvitationLinkSender` is the only sender used: `web/infrastructure` holds no second `signInWithOtp` caller added by this feature
Proof: `cd web && npx vitest run composition/provisioning-wiring.test.ts -t "C2729:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| trade selections (6) | `hvac` C2701 · `plumbing` C2701 · `electrical` C2701 · `other` alone C2702 · `other` + pack C2702 · pack alone C2702 | - |
| process error codes (6) | `invalid_metadata` C2712 · `email_in_use` C2713 · `already_provisioned` C2709 · `no_pack` C2714 · `not_a_subscription` C2715 · `failed` C2714 | - |
| stored event types (6) | `checkout.session.completed` C2700 · `customer.subscription.created` C2706 · `customer.subscription.updated` C2706 · `customer.subscription.deleted` C2706 · `invoice.paid` C2706 · `invoice.payment_failed` C2706 | - |
| invalid metadata cases (10) | plan `gold` C2712 · plan missing C2712 · trades empty C2712 · trades `fire` C2712 · seats below included C2712 · seats above 50 C2712 · seats `abc` C2712 · company empty C2712 · company 121 chars C2712 · email missing C2712 | - |
| email collisions (4) | membership elsewhere C2713 · live invitation elsewhere C2713 · expired invitation allowed C2713 · accepted invitation allowed C2713 | - |
| non-subscription shapes (3) | mode `payment` C2715 · no customer id C2715 · no subscription id C2715 | - |
| use-case sender calls (4) | provisioned once C2718 · duplicate none C2711 · ignored none C2711 · recorded without `provisioned` none C2711 | - |
| sender failure modes (2) | `{ ok: false }` C2720 · throws C2720 | - |
| `org_billing` readers (6) | owner C2722 · admin C2722 · estimator C2723 · viewer C2723 · other org's member C2723 · `anon` C2723 | - |
| `org_billing` write privileges refused (4) | insert C2724 · update C2724 · delete C2724 · truncate C2724 | - |
| `POST /api/webhooks/stripe` statuses (4) | `200` C2721 · `401` C2721 · `400` C2721 · `503` C2721 | - |
| `stripe_receive_event` answers (3) | `recorded` C2700, C2716 · `duplicate` C2707, C2708 · `ignored` C2706 | - |
| `stripe_receive_event` raise codes (3) | `42501` C2728 · `55000` C2728 · `22023` C2728 (unchanged, proven by the existing recipe run with the migration) | - |
| doors (3) | 1 `org_billing` C2700, C2709, C2722 to C2726 · 2 ledger columns and subtransaction C2704, C2708, C2714, C2727 · 3 sender C2718, C2719, C2729 | - |
| entities (3) | `ORG_BILLING` C2700, C2726 · `INVITATION` C2703, C2705 · `STRIPE_EVENT` (columns) C2704, C2727 | - |
| startup config: the link sender in `getWebhookContainer` (1 assembly) | `getWebhookContainer` C2719 (the only builder of `receiveStripe`; the members page builds its own sender separately for invitations and is unchanged) | - |

- Claims naming a status code, route or response shape: C2716, C2721 - each has a proof that crosses the boundary it names (the database function and the route)
- C2710 proves the serialising mechanism, not an interleaving; see Swept, concurrency
- No other check claims more than the single case its proof exercises

## Test policy

The repo answers the levels: a database function that decides is proven by a rolled-back SQL recipe (`stripe_events`, `members`, `starter_packs`), a use case and an adapter by vitest with a fake port or client, a route by `route.test.ts`. This feature adds no new row to the repo's guidelines.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `private.provision_workspace` and the changed `stripe_receive_event` (decide, reached across a boundary) | one at the route (C2721) and one at the SQL layer | one asserted case per trade selection, per error code, per invalid-metadata case, per collision case |
| `makeReceiveStripeEvent` sender branch (decides) | one at its own layer | one case per branch of the sender-call table |
| `supabaseStripeEvents` pass-through of `provisioned` (maps with one conditional) | one at its own layer | present, absent, malformed |
| `app/api/webhooks/stripe/route.ts` (unchanged, decides only header shape and status map) | the existing route tests plus C2721 | unchanged |

Evidence:

- `private.provision_workspace`: 6 error codes, 10 invalid-metadata cases, 6 trade selections, 4 collision cases -> about 26 branch points -> decides
- `stripe-webhook.ts`: one new branch on `provisioned` and a try/catch around the sender -> 3 branch points -> decides
- closest analogues: `supabase/tests/members.sql` (definer functions, error codes) and `starter_packs.sql` (seed and release gate)

Cost: 3 proofs at their own layer across 4 vitest files plus 1 SQL file. Without them, the provisioner's 26 branch points are proven only by a route test that traverses one path.

## Swept

- validation: C2712 (metadata), C2717 (the code column is closed), C2703 (email normalised)
- failure modes: C2714, C2715, C2716 (all-or-nothing, event kept), C2720 (sender failure)
- idempotency: C2707, C2708, C2709, C2711 (event id, retry rule, subscription id, sender not repeated)
- authorization: C2722 to C2724 (who reads and writes `org_billing`); the webhook's own signature gate is existing (billing-checkout's signature checks, re-run by C2728)
- concurrency: C2710 proves the mechanism (primary key wait, row lock, unique subscription and customer). The actual interleaving of two simultaneous deliveries is not driven by any proof, because the SQL runner uses one rolled-back connection. A level gap, named here rather than hidden
- data lifecycle: n/a - provisioning only inserts; the cascade on `org_billing` is proven by C2726 and retention of events stays with the ledger (nothing deleted)
- dependency failure: C2714 (a failing step inside the database), C2720 (Supabase Auth refusing the link); Stripe is not called by this feature
- state transitions: C2704, C2708 (an event goes from unprocessed to processed or refused and a refused one can be retried); the subscription lifecycle after provisioning is out of scope
- observability: C2720 (the one log line carries a name or code and never the email); C2717 (the stored reason is a closed code). Metrics and tracing n/a - no service target in this slice

## Out of scope

- None beyond the plan's own Out of scope table.

## Handoff

- S1 to S3 = the migration (~14 KB), the SQL test (~35 KB) and `supabase/tests/fixture.sql`-style helpers: ~12k tokens; S4 = `stripe-webhook.ts`, the port, the adapter, `composition/index.ts` (15 KB), three vitest files: ~15k; S5 shares the SQL file: ~3k. Total ~30k, under the 150k budget - one builder, no ask
- The migration is written and tested inside the rolled-back recipe but applied to the hosted project only with the owner's go-ahead (rule 8)
- Mechanism: one builder

- **Boundary:** C2700-C2729 closed at `f03c7c9` (migration and SQL tests at `ff56d41`)
- **Settled mid-build:** the user's "implement" accepted the plan as written. Plan edits made before any check existed: AC 17 lost its log clause (the database cannot log; the code on the event is the record), and door 3 reuses the existing `InvitationLinkSender`
- **Abandoned:** stamping `processed_at` inside `stripe_receive_event`: it broke billing-checkout C2528 (the function's one write is the insert), so the stamping moved to `private.process_checkout_event`. `runner.test.ts` counts (28 to 29 recipes, 30 to 31 files) were updated for the new recipe. The `customer_portal` recipe fails on the hosted database before and after this feature (checked at `925cb5e`)
