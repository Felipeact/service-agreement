# First-login setup verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: a79cb83..HEAD (verified at cc8e11d)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

None - the plan marks no binding source (profile `standard`; step 1 is a `ui` step). AGENTS..md "Web validation" is the basis of C2820 only.

## Checks

Vitest proofs ran in one invocation over 8 files (67 passed, 0 failed, every named test listed individually in the output). SQL: `cd web && npm run test:db first_login_setup` -> `PASS first_login_setup`, 1 passed, 0 failed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2800 | owner/admin of pending org -> "setup" | vitest `-t C2800:` ran 3 tests (domain 1, adapter 2) | `domain/org-settings/setup.test.ts:7-8` - `expect(setupGate("owner", true)).toBe("setup")`, admin same | PASS (domain decision only; see Coverage for the Pipeline page) |
| C2801 | estimator/viewer pending -> proceed | ran | `setup.test.ts:12-13` - `expect(setupGate("estimator", true)).toBe("proceed")`, viewer same | PASS |
| C2802 | four roles not pending -> proceed | ran | `setup.test.ts:17` - `for (role of 4 roles) expect(setupGate(role, false)).toBe("proceed")` | PASS |
| C2803 | provisioned org has null `setup_completed_at` | `test:db first_login_setup` exit 0 | `supabase/tests/first_login_setup.sql:41` - `(select setup_completed_at ... where org_id = v_org) is null` after a real `stripe_receive_event` | PASS |
| C2804 | existing rows non-null; row without value gets near now() | same | `first_login_setup.sql:48` (`count(*) ... is not null) = 2`), `:52` (`between now() - interval '1 minute' and now() + interval '1 minute'`) | PASS |
| C2805 | only Pipeline page redirects to /setup | ran | `app/setup/setup-wiring.test.ts:27` - `expect(hits).toEqual(["app/(app)/pipeline/page.tsx"])` | PASS (textual search; it proves the redirect exists in the file, not that it fires for the right case - see F3 survivor) |
| C2806 | /setup, owner/admin, not pending -> /pipeline | ran | `setup.test.ts:23-24` - `toEqual({ to: "/pipeline" })` | PASS (decision function only; the page does not call it for this branch with real data) |
| C2807 | estimator/viewer/no membership -> /pipeline; signed out -> /login; proxy sends signed-out to /login | ran (domain 1, action 1, proxy 2) | `setup.test.ts:28-31`; `proxy.setup.test.ts:30` - `expect(locationPath(response)).toBe("/login")` | PASS for the claim as written; note the page's own signed-out / no-membership branch is inline (`app/setup/page.tsx:14`) and is not what `setupEntry` tests exercise |
| C2808 | form opens prefilled | ran | `components/setup/setup.test.ts:42-43,46-47` - `tag(markup,"legalName")` contains `value="Flow Plumbing Ltd."`, itemSingular `value="equipment"`; `:52` selected `BC` option | PASS |
| C2809 | save updates exactly 7 columns + updated_at, stamps, redirects | ran (adapter + action) | `infrastructure/supabase/setup.test.ts:28-30` - exact sorted key list; `:32` - `updates[1].args[0]` equals `{ setup_completed_at: ... }`; `app/setup/actions.test.ts:47` - `rejects.toThrow("NEXT_REDIRECT /pipeline")` | PASS |
| C2810 | invalid input -> all field errors, nothing stored/stamped | ran (domain 2, action 1) | `setup.test.ts:79,83` - `Object.keys(result.errors)` equals `[field]` for 6 cases, 3 together; `actions.test.ts:65,68-69` - three keys, `saveSetupProfile`/`skipSetup` `not.toHaveBeenCalled()` | PASS (the rendered field errors in `SetupView` are not asserted anywhere; that is outside the claim as written) |
| C2811 | RLS refusal -> `forbidden`, no stamp, notice "You don't have permission to change this"; DB estimator update changes 0 rows | ran (adapter 2, action 4, SQL) | `setup.test.ts(infra):37-38` - `toEqual({ok:false,code:"forbidden"})`, 1 update; `actions.test.ts:76` - `status: "forbidden"`; `first_login_setup.sql:75` - `n = 0` | PASS on the status; **precision gap**: the notice text itself is asserted by no test (`components/setup/setup-view.tsx:23`; search `rg "permission to change this"` hits only that source line) |
| C2812 | skip stamps only, then redirects | ran (adapter + action) | `infra setup.test.ts:54` - `toEqual({ setup_completed_at: ... })` with 1 update; `actions.test.ts:88-89` - `skipSetup` called with `"org-1"`, `saveSetupProfile` not called | PASS |
| C2813 | stamp filters `is null`; DB keeps first value | ran (adapter + SQL) | `infra setup.test.ts:61` - `toContainEqual({... method:"is", args:["setup_completed_at", null]})`; `first_login_setup.sql:105` - `n = 0 and ... = v_first` | PASS |
| C2814 | column type/nullable/default; owner stamps, viewer cannot | SQL | `first_login_setup.sql:59,61,63` (`'timestamp with time zone'`, `'YES'`, `'now()'`), `:79` (`viewer ... n = 0`), `:86` (`owner stamps, n = 1`) | PASS |
| C2815 | groups ordered hvac, plumbing, electrical, added by you; counts in org's words | ran (3 tests) | `setup.test.ts:99-104` - `toEqual([["hvac","Heating and cooling","1 equipment type",["Boiler"]], ...[null,"Added by you",...]])`; `:109` - `"2 fixture types"` | PASS |
| C2816 | catalog selects `pack, name`, ordered by name, no org filter | ran | `infra setup.test.ts:79-81` - `select args ["pack, name"]`, `order args ["name"]`, `filter(eq or in)).toHaveLength(0)` | PASS |
| C2817 | empty -> "No types yet", task library, no draft control | ran (2 tests) | `components/setup/setup.test.ts:69-71` - contains `"No types yet"`, `"task library"`, `not.toMatch(/<button\|<a \|<input\|draft\|generate/i)` | PASS |
| C2818 | review has no form control | ran | `components/setup/setup.test.ts:85` - `not.toMatch(/<(input\|select\|textarea\|button\|form)\b/)` | PASS |
| C2819 | loading.tsx, error.tsx "Try again" wired to reset, page writes nothing | ran (2 tests) | `app/setup/setup-wiring.test.ts:35-36` - `toContain("Try again")`, `toMatch(/onClick=\{\(\) => reset\(\)\}/)`; `:41` - `not.toMatch(/saveSetupProfile\|skipSetup/)` | PASS (the "error state with a retry when a read fails" is by Next error boundary convention, asserted structurally only) |
| C2820 | live Playwright at 375/768/1440, no horizontal scroll, controls >= 44x44, touch on select/Continue/Skip, console clean | not run by the author; not run here (the screen cannot be reached on the hosted project until the migration is applied, which needs the owner's go-ahead; running the dev server against the hosted database was forbidden) | none | **NOT PROVEN** - no located run exists |
| C2821 | container exposes the setup store built on the request's client; both pages read it | ran (2 tests) | `composition/setup-wiring.test.ts:26,28` (`setupPending`, `setupCatalog` through the container); `:44` - Pipeline source `toMatch(/container\.setupPending\(/)`; `composition/index.ts` diff shows `supabaseOrgSetup(supabase)` on the same `supabase` client as `settings` | PASS |

AC 20 loading/error and AC 19 (S4 sizes) beyond C2819 rest on C2820, which has no proof.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| gate decision role x pending (8) | plan AC 1-3, `setupGate` (4 roles x 2) | owner/admin pending C2800 (`setup.test.ts:7-8`); estimator/viewer pending C2801 (`:12-13`); all four not pending C2802 (`:17`) | - |
| `/setup` entry decision (5) | plan AC 7, 8 and the Flow, `setupEntry` + `app/setup/page.tsx:14-18` | render C2808 (`setup.test.ts:35-36`); not pending C2806 (`:23-24`); estimator/viewer/no membership C2807 (`:28-30`); signed out C2807 (`:31`) - all at the `setupEntry` function. The page never feeds `signed_out` or `no_membership` into `setupEntry` (it branches inline at `page.tsx:14` and passes only `member`), so the page's own five outcomes have no boundary test at all | page entry decision: no test drives `SetupForRequest` (redirects to /login, /pipeline, render, `!settings` -> /pipeline) |
| `GET /setup` statuses (3) | plan Surface | 200 C2808 (markup only); 303 /login C2807 (proxy for the signed-out cookie-less case); 303 /pipeline C2806/C2807 (function only) | the page's status behaviour, same as above |
| `POST /setup` statuses (3) | plan Surface | 303 save C2809 `actions.test.ts:47`; 303 skip C2812 `:88`; errors/notice C2810 `:63`, C2811 `:76` | - (the permission notice text is not asserted, see C2811) |
| `GET /pipeline` new 303 to /setup (1) | plan Surface | C2800 proves `setupGate` only; the Pipeline page's own branch (`app/(app)/pipeline/page.tsx` `if (setupGate(member.role, pending) === "setup") redirect("/setup")`) is asserted only by text search (C2805, C2821) | **yes** - injected fault F3 (condition inverted to `!== "setup"`) left C2805, C2819, C2821 and the action tests green; no test would catch Pipeline redirecting the wrong people, or the `.catch(() => false)` on a failed read |
| `POST /setup` intents (2) | plan Surface | save C2809; skip C2812 | - |
| invalid input cases (6) | checks C2810, plan AC 12 | all six in `setup.test.ts:68-73` with `expect(...).toEqual([field])` | - |
| profile columns written (7) | plan AC 10/11 | exact key set `infra setup.test.ts:28-30` | - |
| `setup_completed_at` stampers (3) | plan door 1 | provision null C2803; backfill/default C2804; keep-first C2813 | - |
| catalog groups (4) | plan AC 16 | `setup.test.ts:99-104` all four in order | - |
| `org_settings` relation (1) | plan Relations | column and policy C2814 | - |
| `asset_types` relation (1) | plan Relations | read C2816 | - |
| startup config: container assembly (1 place) | read `web/composition/index.ts` directly: `const setup = supabaseOrgSetup(supabase)` beside `const settings = supabaseOrgSettingsStore(supabase)`, exposed as `setupPending`, `setupCatalog`, `saveSetupProfile`, `skipSetup` | C2821 imports the real `getContainer` (`composition/setup-wiring.test.ts:23`), store module mocked | - |
| roles for `POST /setup` (4: owner, admin, estimator, viewer) (not in the author's table; from plan AC 8, 13 and `actions.ts`) | `actions.ts:28` (`setupGate(member.role, true)`) | estimator and viewer `actions.test.ts:106-111`; owner `:47`; admin has no proof of its own (same branch as owner) | none material; `no_membership` -> `/login` in `actions.ts:27` has no test (only `signed_out` at `actions.test.ts:100`) |
| acceptance criteria with no check at all | plan AC 1-20 against `checks.md` | AC 19 -> C2820 (unproven above); AC 20 error with retry -> C2819 (structural only) | AC 19, via C2820 |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (domain) | `domain/org-settings/setup.ts` | one at its own layer; one asserted case per decision-table row | yes (8 gate rows, 5 entry rows, 6 invalid cases, catalog groups all asserted) |
| Entry point that decides nothing (Server Action, page) | `app/setup/actions.ts`, `app/setup/page.tsx`, `app/(app)/pipeline/page.tsx` | one at the boundary: accepted input, each rejected input, each error path | **no** - `actions.ts` is covered except its `no_membership` -> `/login` path; `app/setup/page.tsx` and the Pipeline page have no boundary test, only regex over their source text, and the page's redirect outcomes (signed out, no membership, not pending, missing settings row, read failure) are unasserted |
| Adapter | `infrastructure/supabase/setup.ts` | one against the client double; payload keys, filters, each error reply | yes (keys C2809, filters C2813/C2816, forbidden/unavailable C2811, read error C2800) |
| Instrumentation, pass-throughs | `composition/index.ts` additions, `components/setup/state.ts`, `error.tsx`, `loading.tsx` | none of its own | yes (C2821, C2819) |

## Faults injected

Scratch worktree of cc8e11d (node_modules junctioned, .env.local copied), removed afterwards. Real tree `git status --porcelain` was empty before and after.

| Mutation | Location | Killed |
| --- | --- | --- |
| `setupGate` drops the pending condition (`return MANAGERS.includes(role)`) | `web/domain/org-settings/setup.ts` (setupGate) | yes - C2802 fails |
| stamp loses `.is("setup_completed_at", null)` | `web/infrastructure/supabase/setup.ts` (stamp) | yes - C2813 fails |
| `validateSetupProfile` province-required rule disabled (`if (false)`) | `web/domain/org-settings/setup.ts` | yes - C2810 fails in the domain and the action test |
| `provision_workspace` inserts `now()` instead of explicit `null` | `supabase/migrations/20261110110000_first_login_setup.sql:83` | yes - SQL recipe `FAIL ... C2803 pending` |
| Pipeline page redirect condition inverted (`=== "setup"` -> `!== "setup"`, sending everyone except pending managers to /setup) | `web/app/(app)/pipeline/page.tsx` | **no** - C2805, C2819, C2821 and the action tests all stayed green (5 passed, 0 failed) |

## Gate

`cd web && npx vitest run <8 files>` - 67 passed, 0 failed; `npm run test:db first_login_setup` - 1 passed, 0 failed. `rls_isolation` and `customer_portal` not run (pre-existing failures, not this feature's checks).
