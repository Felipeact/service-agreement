# Workspace provisioning verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 7376a23..HEAD (HEAD = d144116)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

All 30 checks C2700-C2729 are green at HEAD and every one has a located assertion. The verdict is FAIL because the Coverage recompute from the migration's actual branches found members with no proof (the `customer_email` owner-email fallback, a malformed or over-long email, more than four trades, a whitespace-only company), and the `Test policy` row for `private.provision_workspace` asks for one asserted case per invalid-metadata case. The mutation run also covered only the SQL surfaces (see Faults injected).

## Binding sources

The plan marks no source binding. Its Sources are prior features' ADs (AD-131, AD-154, AD-163, AD-003, AD-037, AD-073, AD-169, AD-170, AD-172) and billing-checkout's plan and checks, and the profile is `standard`, so step 1 does not run. The prior-feature contract still held: `stripe_events` (billing-checkout) passes with the migration applied inside it (C2728).

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none marked binding (profile standard, step 1 runs under ui only) | n/a | none | - |

## Checks

Proofs run at HEAD. Vitest: `cd web && npx vitest run application/use-cases/stripe-provisioning.test.ts infrastructure/supabase/stripe-events.test.ts composition/provisioning-wiring.test.ts app/api/webhooks/stripe/route.test.ts -t "C27(11|18|19|20|21|29):" --reporter=verbose` - 23 passed, each named test shown in the output. SQL: `npm run test:db workspace_provisioning stripe_events` - `PASS workspace_provisioning`, `PASS stripe_events`. SQL assertions are in `supabase/tests/workspace_provisioning.sql` (WP below); every label named by the check exists in the file (searched by label).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2700 | one org, settings, billing row from valid checkout | `npm run test:db workspace_provisioning` exit 0 | `WP:92` - `s.legal_name = 'Acme Plumbing Ltd' and s.phone = '604-555-0199'`; `WP:94-95` - `b.stripe_customer_id = 'cus_sub_wp_1' and b.stripe_subscription_id = 'sub_wp_1' and b.plan = 'team' and b.seats = 5 and b.trades = array['hvac']` | PASS |
| C2701 | each pack seeds its types, trade_context = seeded phrases | same SQL run | `WP:116-117` - seeded count `= (select count(*) from private.catalog_asset_types c where c.pack = p)` and `> 0`; `WP:120` - `trade_context = (select trade_context from private.catalog_packs where pack = p)`; `WP:128-130` two packs joined `', '` in order | PASS |
| C2702 | `other` alone / mixed / pack alone | same SQL run | `WP:141` - `count(*) ... = 0`; `WP:142` - `other_trade`; `WP:146-148` mixed seeds plumbing only, flag true; `WP:149` - `not (select other_trade ... wp_org('p1'))` | PASS |
| C2703 | invitation email, owner, no inviter, 30-day expiry | same SQL run | `WP:97-99` - `i.email = 'owner.one@shop.test' and i.role = 'owner' and i.invited_by is null and i.accepted_at is null and i.expires_at between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour'` (input was `'  Owner.One@Shop.TEST '`) | PASS |
| C2704 | processed_at set, process_error null | same SQL run | `WP:101` - `e.processed_at is not null and e.process_error is null` | PASS |
| C2705 | accept_invitations makes the owner member | same SQL run | `WP:162` - `v_n = 1`; `WP:163` - `m.org_id = v_org and m.user_id = tests.id('wpOwner1') and m.role = 'owner'` (user created as `Owner.One@Shop.test`) | PASS |
| C2706 | five other types create nothing | same SQL run | `WP:176` - `= '{"outcome": "recorded"}'::jsonb`; `WP:177` - `processed_at is null and process_error is null`; `WP:180` - `count(*) from public.orgs) = v_orgs` | PASS |
| C2707 | processed event again is plain duplicate | same SQL run | `WP:189-190` - `= '{"outcome": "duplicate"}'::jsonb` (twice); `WP:191-192` orgs unchanged, `org_billing` for sub_wp_1 `= 1`, invitations for the email `= 1` | PASS |
| C2708 | unprocessed stored row is provisioned on redelivery | same SQL run | `WP:269` - `= '{"outcome": "duplicate", "provisioned": {"email": "live@elsewhere.test"}}'::jsonb`; `WP:270` - `processed_at is not null and process_error is null`; `WP:278` pre-existing row case; `WP:272` third delivery plain duplicate | PASS |
| C2709 | same subscription, new event id | same SQL run | `WP:200-201` - `wp_refused(... 'already_provisioned', 'Second Co', ...)` (answer exactly `recorded`, code, no org/settings/invitation/types); `WP:202` - `org_billing ... sub_wp_1') = 1` | PASS |
| C2710 | the serialising mechanism exists (interleaving not driven) | same SQL run | `WP:330` - `v_src ~ 'from private\.stripe_events e where e\.id = p_event_id for update'`; `WP:331-336` primary key `= array['id']`, unique `= array['stripe_subscription_id']` and `array['stripe_customer_id']`; `WP:337-339` second customer id raises `23505`. The interleaving is not proven; see Coverage notes | PASS (mechanism only, as the claim says) |
| C2711 | no sender call for duplicate/ignored/recorded-without-provisioned; SQL carries `provisioned` only on creating call | `cd web && npx vitest run ... -t "C2711:"` (3 cases) + SQL run | `application/use-cases/stripe-provisioning.test.ts:42` - `expect(links.send).not.toHaveBeenCalled()`; `WP:88` - `v_answer = '{"outcome": "recorded", "provisioned": {"email": "owner.one@shop.test"}}'`; `WP:189` duplicates carry no key | PASS |
| C2712 | 10 invalid-metadata cases, no org, `invalid_metadata` | same SQL run | `WP:232-233` - `wp_refused('C2712 '||name, ..., 'invalid_metadata', ...)` over the 10-row values list (`WP:215-224`); `WP:236` - `i = 10`; edges accepted `WP:238-240` | PASS |
| C2713 | membership / live invitation block; expired / accepted do not | same SQL run | `WP:251-254` - `'email_in_use'` for membership (`' UA@Example.Test '`) and live invitation; `WP:255` - `wp_buy('c3', ..., 'expired@elsewhere.test') ? 'provisioned'`; `WP:256` accepted likewise | PASS |
| C2714 | failure after org insert leaves nothing; `failed` / `no_pack` | same SQL run | `WP:287-288` - trigger raising on invitation insert, `wp_refused(... 'failed' ...)` with types count unchanged; `WP:293-294` - `released_at = null` pack gives `'no_pack'`; `WP:289`, `WP:295` no billing row | PASS |
| C2715 | mode payment / no customer / no subscription | same SQL run | `WP:302-307` - three `wp_refused(... 'not_a_subscription' ...)` | PASS |
| C2716 | refused or failed still answers `recorded`, event kept | same SQL run | `WP:64` - `v_answer = jsonb_build_object('outcome', p_outcome)` (default `recorded`); `WP:234` - `exists (select 1 from private.stripe_events where id = 'evt_wp_m'||i)` | PASS |
| C2717 | `process_error` is a closed code; no email/company/phone stored | same SQL run | `WP:316` - `expect_error(... set process_error = 'owner@shop.test' ..., '23514')`; `WP:319` - each of the 6 codes `exists (... where process_error = c)`; `WP:322` - `not exists (... process_error ~ '[@ ]')`. Second clause is carried by the CHECK constraint alone (see Coverage notes) | PASS |
| C2718 | one sender call with the email; adapter passes through, omits when absent or malformed | `-t "C2718:"` (use case 2 cases, adapter 6 cases) | `stripe-provisioning.test.ts:31-32` - `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(EMAIL)`; `infrastructure/supabase/stripe-events.test.ts:45` - `toEqual({ ok: true, outcome: "recorded", provisionedEmail: "owner.one@shop.test" })`; `:56` - five absent/malformed shapes `toEqual({ ok: true, outcome: "recorded" })` | PASS |
| C2719 | container builds the sender from the publishable-key, session-less client; reaches `signInWithOtp` with `shouldCreateUser` | `-t "C2719:"` (2 cases) | `composition/provisioning-wiring.test.ts:39` - `toHaveBeenCalledWith({ email: "owner.one@shop.test", options: { shouldCreateUser: true } })`; `:41` - `slice(0, 2)).toEqual(["https://example.supabase.co", "sb_publishable_test"])`; `:43` - `not.toContain("sb_service_must_not_be_used")` | PASS |
| C2720 | sender `{ok:false}` or throws: still `recorded`, one log line, no email | `-t "C2720:"` (3 + 1 cases) | `stripe-provisioning.test.ts:58` - `expect(errorLog).toHaveBeenCalledTimes(1)`; `:60-61` - `not.toContain(EMAIL)`, `not.toContain("shop.test")`; result `toEqual({ ok: true, outcome: "recorded" })` at `:57` | PASS |
| C2721 | route body exactly `{"outcome":"recorded"}`; statuses 200/401/400/503 | `-t "C2721:"` (1 + 4 cases) | `app/api/webhooks/stripe/route.test.ts:92` - `expect(text).toBe('{"outcome":"recorded"}')`; `:103-104` - `expect((await call(SIGNATURE)).status).toBe(status)` for 200/401/400/503. The route test mocks the use case, which cannot carry the email; the end-to-end shape is also fixed by `provisioning-wiring.test.ts:37` | PASS |
| C2722 | owner and admin read own org's row, not others' | same SQL run | `WP:359` - `count(*) from public.org_billing where org_id = tests.wp_org('p1')) = 1`; `WP:360` - `(select count(*) from public.org_billing) = 1` for each of `wpOwnerP`, `wpAdmin` (other provisioned orgs exist) | PASS |
| C2723 | estimator, viewer, other-org member, anon read none | same SQL run | `WP:375` - `count(*) from public.org_billing) = 0` for `wpEst`, `wpView`, `uB`; `WP:379` - anon `expect_error(..., '42501')` (an error, not an empty set: stronger than "no rows") | PASS |
| C2724 | no insert/update/delete/truncate for anon, authenticated; direct insert `42501` | same SQL run | `WP:394` - `not has_table_privilege(r, 'public.org_billing', p)` over 2 x 4; `WP:397` - `i = 8`; `WP:399-400` direct insert as owner `'42501'` | PASS |
| C2725 | orgs without billing work as before | same SQL run | `WP:407` - `count(*) from public.org_billing where org_id in (orgA, orgB)) = 0`; `WP:408-409` - `execute tests.insert_sql('orgs','A')` and `('memberships','B')` run after the migration without raising (the load-bearing part). `WP:410` is weaker: `exists (... o.name ~ '^Org ' and not exists billing)` is also satisfied by the fixture orgs | PASS (weak second assertion) |
| C2726 | RLS on, cascade from orgs, trades as sent | same SQL run | `WP:418` - `relrowsecurity`; `WP:419-420` - `c.contype = 'f' and c.confrelid = 'public.orgs'::regclass and c.confdeltype = 'c'`; `WP:422` - `not exists (... org_id = v_org)` after delete; trades as sent `WP:131` - `= array['plumbing', 'hvac']` | PASS |
| C2727 | ledger columns nullable; no privilege for anon/authenticated; definer, empty search_path, execute for anon+authenticated | same SQL run | `WP:430-431` - `column_name in ('processed_at','process_error') and is_nullable = 'YES') = 2`; `WP:433-434` - `not has_table_privilege(... 'select') and not ... 'update'`; `WP:435` execute true; `WP:438-439` no public grantee; `WP:440` - `prosecdef and proconfig = array['search_path=""']`. Assertion proves anon and authenticated may execute and public may not; it does not assert the grantee list is exactly those two | PASS |
| C2728 | `stripe_events` recipe passes with the migration inside it | `npm run test:db workspace_provisioning stripe_events` | output `PASS stripe_events`; recipe parts at `web/scripts/test-db/runner.mts:59` - `{ name: "stripe_events", parts: ["fixture.sql", WORKSPACE_MIGRATION, "stripe_events.sql"] }`; its C2528 one-write assertion is `supabase/tests/stripe_events.sql:219` | PASS |
| C2729 | no second `signInWithOtp` caller in `web/infrastructure` | `-t "C2729:"` | `composition/provisioning-wiring.test.ts:70` - `expect(callers).toEqual(["infrastructure/supabase/auth.ts", "infrastructure/supabase/members.ts"])`; `:72` - `expect(outside).toEqual([])`. File-level, not call-level: a second call inside either file would pass | PASS |

## Coverage

Recomputed from the plan's Surface/Relations/Landing and from the migration's branches (`supabase/migrations/20261110100000_workspace_provisioning.sql`), not from the checks' table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| trade selections (6) | AC 2-3, migration `:87-114` | hvac/plumbing/electrical C2701 (`WP:112`), other alone / other+pack / pack alone C2702 | - |
| process_error codes (6) | migration CHECK `:29-30`, mapping `:146-150` | invalid_metadata C2712, email_in_use C2713, already_provisioned C2709, no_pack C2714 (`WP:293`), not_a_subscription C2715, failed C2714 (`WP:287`); `WP:317-319` asserts each stored | - |
| stored event types (6) | migration `:224-225` | checkout C2700, five others C2706 (`WP:174`) | - |
| invalid-metadata conditions in the migration (13) | migration `:80-95` | plan not a key C2712, plan missing C2712, trades empty C2712, trade not in list `fire` C2712, seats below included C2712, seats above 50 C2712, seats non-numeric C2712, company empty C2712, company 121 chars C2712, email missing C2712 | email present but malformed (regex `:80`) and over 254 characters (`:80`); trades list longer than 4 (`:82`); seats text of 4+ digits (`:83`); company whitespace-only (`:77`, `btrim`) |
| owner-email sources (2) | plan Assumptions row 1, migration `:70-72` | `customer_details.email` C2700 and all `wp_session` fixtures | `customer_email` fallback: no test builds a session without `customer_details` and with `customer_email` (`grep customer_email supabase/tests/workspace_provisioning.sql` finds nothing). "email missing" (C2712) removes `customer_details` only, with no `customer_email` present |
| email collisions (4) | AC 14, migration `:98-103` | membership C2713 (`WP:251`), live invitation C2713 (`WP:253`), expired allowed (`WP:255`), accepted allowed (`WP:256`) | - |
| non-subscription shapes (3) | AC 16, migration `:60` | mode payment, no customer, no subscription C2715 (`WP:302-307`) | - |
| refusal order (already_provisioned before email_in_use, migration `:64-68`) | migration comment | C2709 uses a fresh email (`someone.else@shop.test`), so email_in_use cannot trigger either way; the order is not pinned | order unproven (a precision gap, not a plan member) |
| use-case sender calls (4) | AC 12, 19, 21 | provisioned (recorded) and provisioned duplicate C2718, plain duplicate / ignored / recorded without provisioned C2711 | - |
| sender failure modes (3) | AC 20 | not ok x2 (rate_limited, unavailable) and throws C2720 | - |
| adapter answer shapes (6) | `stripe-events.ts:309-313` | present, absent, `provisioned: {}`, non-string, empty, non-object C2718 | - |
| `org_billing` readers (6) | AC 23-24, policy `:22-23` | owner, admin C2722; estimator, viewer, other-org member, anon C2723 | - |
| `org_billing` write privileges (4 x 2 roles) | AC 25 | insert, update, delete, truncate for anon and authenticated C2724 (`WP:394`) | - |
| route statuses (4) | Surface | 200, 401, 400, 503 C2721 | - |
| `stripe_receive_event` answers (3) | Surface | recorded C2700/C2716, duplicate C2707/C2708, ignored: the only SQL assertion is stripe_events.sql (existing, passes with the migration inside) | - |
| `stripe_receive_event` raise codes (3) | Surface | 42501, 55000, 22023 in `supabase/tests/stripe_events.sql:107, 156, 169` with the migration applied (C2728) | - |
| doors (3) | Landing | 1 C2722-C2726; 2 C2704, C2708, C2714, C2727; 3 C2718, C2719, C2729 | - |
| startup config (1 assembly) | `getWebhookContainer` | `web/composition/index.ts:283` - `receiveStripe: makeReceiveStripeEvent(supabaseStripeEvents(supabase), supabaseInvitationLinkSender(supabase)),` ; `grep -rn "makeReceiveStripeEvent("` finds only this production caller (`stripe-webhook.ts:12` is the definition). C2719 boots the real `getWebhookContainer` (`await import("./index")`), so it exercises this line | - |

Notes from the recompute, not set members:

- C2717 second clause: the added ledger columns are only `processed_at` and `process_error`. What is asserted is the closed-code CHECK (`WP:316`) and the `'[@ ]'` scan (`WP:322`). There is no per-refused-case assertion on the body or any other column. The constraint makes it structurally true, so PASS, but a reader should know it rests on the constraint.
- Concurrency (Swept) is honestly named: C2710 proves mechanism through a regex over `prosrc` (`WP:330`) and index shapes, not an interleaving. One case the mechanism does not turn into a clean code: two simultaneous deliveries with different event ids and the same subscription would both pass the `exists` check at migration `:66` and the loser would hit the unique index and be stamped `failed`, not `already_provisioned`. One org still results. No check claims otherwise.
- Swept rows marked existing, read against the code: webhook signature gate (billing-checkout) is in `stripe_receive_event` `:180-206` and re-run by C2728 (`PASS stripe_events`); "event id is the primary key" is `private.stripe_events` keyed by id, asserted at `WP:331-332`; the `on conflict (id) do nothing` write is at migration `:229`. All present.
- Unclaimed shapes without a row: repeated trades (`hvac,hvac`) pass the guard at `:82` and `:88` and call `seed_org_catalog` twice (`on conflict do nothing`), and `org_billing.trades` keeps the duplicate. Not asserted.
- Name nit: the `test.each` titles in `route.test.ts` render `status NaN` (a `%i` on the wrong argument). Cosmetic; selection by `C2721:` still works.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `private.provision_workspace` and the changed `stripe_receive_event` (decide, across a boundary) | `supabase/migrations/20261110100000_workspace_provisioning.sql` | route (C2721, present) + SQL layer (present: `workspace_provisioning.sql`); one asserted case per trade selection (6/6), per error code (6/6), per collision case (4/4), per invalid-metadata case | no - trade, code and collision cases are all asserted, but the invalid-metadata expectation is met only for the 10 listed cases; the migration has 4 more condition branches with no case (malformed or over-long email, more than four trades, four-plus-digit seats, whitespace-only company), and the `customer_email` source branch is unasserted |
| `makeReceiveStripeEvent` sender branch (decides) | `web/application/use-cases/stripe-webhook.ts` | one at its own layer; one case per branch of the sender-call table | yes - `stripe-provisioning.test.ts:31-32`, `:42`, `:58-61`: 2 provisioned, 3 not-provisioned, 3 failure cases |
| `supabaseStripeEvents` pass-through of `provisioned` (maps, one conditional) | `web/infrastructure/supabase/stripe-events.ts` | present, absent, malformed at its own layer | yes - `stripe-events.test.ts:45` present, `:56` absent plus 4 malformed shapes |
| `route.ts` (unchanged) | `web/app/api/webhooks/stripe/route.ts` | existing route tests plus C2721 | yes - the existing C2513-C2515 tests and C2721 all run in the batch (C2513-C2515 skipped by the `-t` filter; the full suite ran green, 3885 passed) |

## Faults injected

Isolated in a `git worktree` under the session scratchpad (removed afterwards, `git worktree list` shows only the real tree and a pre-existing unrelated one). Real tree `git status --porcelain` before and after: both empty, identical. Each fault was applied to the migration only and run with `npm run test:db workspace_provisioning`; the worktree was reset between faults. No stash.

| Mutation | Location | Killed |
| --- | --- | --- |
| invitation lifetime `interval '30 days'` -> `'14 days'` | migration `:116` | yes - `FAIL workspace_provisioning: C2703 invitation: invitation differs` |
| drop the row lock: `... where e.id = p_event_id for update;` -> `... where e.id = p_event_id;` | migration `:137` | yes - `FAIL ... C2710 row lock: the retry path does not lock the event row` |
| loosen the `org_billing` select policy from `has_org_role(org_id, array['owner','admin'])` to `is_org_member(org_id)` | migration `:23` | yes - `FAIL ... C2723 wpEst: wpEst reads a billing row` |
| map a seed `55000` to `failed`: `when sqlstate = '55000' then 'no_pack'` -> `then 'failed'` | migration `:147` | yes - `FAIL ... C2714 no_pack code: process_error was failed` |
| make the answer carry `provisioned` on every outcome: `if v_email is not null then` -> `if true then` | migration `:235` | yes - `FAIL ... C2707 answer: not a plain duplicate` |

The cap of five was spent on the SQL surfaces. No behaviour-level mutation was run against the TypeScript surfaces (`stripe-webhook.ts` sender branch, `stripe-events.ts` pass-through, `composition/index.ts:283`), so those tests have not been shown able to fail. The refusal-order fault suggested in the brief was not run; reading the C2709 fixture shows it would survive (the second event uses a fresh email), so that is recorded as a precision gap in Coverage, not as a killed mutant.

## Gate

- `cd web && npm run test:db workspace_provisioning stripe_events` - 2 passed, 0 failed (`PASS workspace_provisioning`, `PASS stripe_events`).
- `cd web && npm run test:db` (all recipes) - 28 passed, 1 failed. The one failure is `FAIL customer_portal: view tenant: ...`, a pre-existing failure that also occurs at 925cb5e (per checks.md, the brief and the plan's handoff); it is not caused by this feature and is not counted against it.
- `cd web && npx vitest run` (whole suite) - 208 files, 3885 passed, 0 failed (includes `scripts/test-db/runner.test.ts` with the 29-recipe, 31-file counts).
- Targeted C27xx vitest batch - 23 passed, 0 failed.
