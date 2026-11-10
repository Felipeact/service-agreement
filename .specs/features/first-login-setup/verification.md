# First-login setup verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: a79cb83..HEAD (verified at 8a3d157)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

The only remaining reason for FAIL is C2820 (live Playwright), which is NOT PROVEN, not failed. Every automated check is green and every injected fault is killed under the real vitest config.

Scope of this round: the fix diff `f740a64..8a3d157` (two pure renames, 0 content lines: `page.test.tsx` -> `page.test.ts`, `setup-gate.test.tsx` -> `setup-gate.test.ts`) and every round 2 non-PASS item (C2800/C2801/C2806/C2807 page branches, M1, M2, Test policy "Entry point that decides nothing", the two Coverage members, C2820). The `cc8e11d..f740a64` fix was reviewed in round 2 and is `carried from f740a64`. Everything else is `carried from cc8e11d`.

## Binding sources

None - the plan marks no binding source. `carried from cc8e11d`.

## Checks

verified at 8a3d157 (proofs re-run in full, one batched invocation):

- `cd web && npx vitest run <the 9 files holding a C28xx test> --reporter=verbose` -> **9 files passed, 59 tests passed, 0 failed**. The two renamed files are discovered by name (`app/(app)/pipeline/setup-gate.test.ts` 7 tests, `app/setup/page.test.ts` 7 tests); no "No test files found". Each named test is listed individually in the verbose output (C2800 x7, C2801 x3, C2802 x4, C2805, C2806 x2, C2807 x8, C2808 x6, C2809 x2, C2810 x5, C2811 x7, C2812 x3, C2813, C2815 x3, C2816, C2817 x2, C2818, C2819 x2, C2821 x2).
- Full suite `npx vitest run` in the scratch worktree at HEAD (baseline for the mutants): 217 files, 3944 tests, all passed.
- `cd web && npm run test:db first_login_setup` -> `PASS first_login_setup`, 1 passed, 0 failed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2800 | owner/admin of pending org -> setup; Pipeline redirects them | domain, adapter and Pipeline page tests all ran | `domain/org-settings/setup.test.ts:7-8`; `app/(app)/pipeline/setup-gate.test.ts:29` (`C2800: a owner/admin of a pending org is redirected to /setup`), `:48` (failed read does not redirect) | PASS (M1 now killed) |
| C2801 | estimator/viewer pending -> proceed | ran (domain + page) | `setup.test.ts:12-13`; `setup-gate.test.ts:35` | PASS |
| C2802 | four roles not pending -> proceed | ran (domain + page) | `setup.test.ts:17`; `setup-gate.test.ts:41,55` | PASS |
| C2803 | provisioned org has null `setup_completed_at` | `test:db first_login_setup` exit 0 | `supabase/tests/first_login_setup.sql:41` | PASS |
| C2804 | backfill and default | same | `first_login_setup.sql:48,52` | PASS |
| C2805 | only Pipeline redirects to /setup | ran | `app/setup/setup-wiring.test.ts:27`; the inverted-condition blind spot is covered by `setup-gate.test.ts` (M1 killed) | PASS |
| C2806 | /setup owner/admin not pending -> /pipeline | ran (domain + page) | `setup.test.ts:23-24`; `app/setup/page.test.ts:53` | PASS |
| C2807 | estimator/viewer/no membership -> /pipeline; signed out -> /login; proxy | ran (domain, page, action, proxy) | `setup.test.ts:28-31`; `page.test.ts:36,41,47`; `actions.test.ts` (`no_membership` -> /login); `proxy.setup.test.ts:30` | PASS (M2 now killed) |
| C2808 | form opens prefilled; pending owner sees the screen | ran | `components/setup/setup.test.ts:42-52`; `page.test.ts:60,70` | PASS |
| C2809 | save writes exact columns, stamps, redirects | ran | `infrastructure/supabase/setup.test.ts:28-32`; `actions.test.ts:47` | PASS |
| C2810 | invalid input -> every field error together, nothing stored; errors render | ran | `setup.test.ts:79,83`; `actions.test.ts:65,68-69`; `components/setup/setup.test.ts` "field errors render under their fields" | PASS |
| C2811 | RLS refusal -> forbidden, no stamp, notice; DB 0 rows | ran + SQL | `infra setup.test.ts:37-38`; `components/setup/setup.test.ts` permission notice; `first_login_setup.sql:75` | PASS |
| C2812 | skip stamps only | ran | `infra setup.test.ts:54`; `actions.test.ts:88-89` | PASS |
| C2813 | stamp filters is null; DB keeps first | ran + SQL | `infra setup.test.ts:61`; `first_login_setup.sql:105` | PASS |
| C2814 | column shape and privileges | SQL | `first_login_setup.sql:59,61,63,79,86` | PASS |
| C2815 | catalog groups and counts | ran | `setup.test.ts:99-104,109` | PASS |
| C2816 | catalog read shape | ran | `infra setup.test.ts:79-81` | PASS |
| C2817 | empty catalog text | ran | `components/setup/setup.test.ts:69-71` | PASS |
| C2818 | no form control in review | ran | `components/setup/setup.test.ts:85` | PASS |
| C2819 | loading and error states, page writes nothing | ran | `setup-wiring.test.ts:35-36,41` | PASS |
| C2820 | live Playwright at 375/768/1440 | NOT RUN. The migration is not applied and applying it needs the owner's go-ahead; by instruction no migration applied and no dev server started against the hosted DB. No run is invented. | none | **NOT PROVEN** |
| C2821 | container wiring | ran | `composition/setup-wiring.test.ts:26,28,44` | PASS |

## Coverage

verified at 8a3d157 for the first two rows; the rest `carried from f740a64` / `cc8e11d`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `/setup` entry decision (5) | plan AC 7, 8; `app/setup/page.tsx:14-18` | signed out, no membership, estimator/viewer, not pending, render, no settings row -> `app/setup/page.test.ts:36-70`, discovered and passing; M2 dies | - |
| `GET /pipeline` new 303 to /setup (1) | plan Surface; `app/(app)/pipeline/page.tsx:48` | owner, admin, estimator, viewer, done, failed read, signed out -> `setup-gate.test.ts:29-55`, discovered and passing; M1 dies | - |
| gate decision role x pending (8) | `setupGate` | `setup.test.ts:7-17` | - |
| `POST /setup` statuses and roles (3 + 4) | `actions.ts` | save, skip, errors, notices, `no_membership` | - |
| `GET /setup` statuses (3) | plan Surface | 200 via page test + C2808; /login via proxy and page test; /pipeline via page test | page rendering at real widths is C2820 |
| remaining sets (invalid cases 6, columns 7, stampers 3, catalog groups 4, relations 2, container 1, intents 2) | `carried from cc8e11d` | unchanged by both fixes; the same tests re-ran green at 8a3d157 | - |
| acceptance criteria with no check | plan AC 1-20 | AC 19 -> C2820 (not proven) | AC 19 |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (domain) | `domain/org-settings/setup.ts` | one at its layer, one case per row | yes - re-run green at 8a3d157 |
| Entry point that decides nothing (Server Action, page) | `app/setup/actions.ts`, `app/setup/page.tsx`, `app/(app)/pipeline/page.tsx` | accepted input, each rejected input, each error path at the boundary | **yes** - `page.test.ts` and `setup-gate.test.ts` are now discovered under `include: ["**/*.test.ts"]`, run in `npm test`, and kill the mutants on both pages; `actions.ts` covered as in round 2 |
| Adapter | `infrastructure/supabase/setup.ts` | one against the client double | yes - re-run green, and M5 killed |
| Instrumentation, pass-throughs | composition additions, `state.ts`, `error.tsx`, `loading.tsx` | none of its own | yes - `carried from cc8e11d` |

## Faults injected

verified at 8a3d157. Scratch `git worktree` at HEAD (`../sa-scratch-r3`), `node_modules` junctioned, `web/.env.local` copied, no config change; the repo's real `vitest.config.mts` was in force. Real tree `git status --porcelain` before: ` M .specs/features/first-login-setup/verification.md`; after: identical. Worktree removed and pruned; the real `node_modules` is intact (junction removed with rmdir). Baseline in the worktree: 217 files, 3944 tests, all passed.

| Mutation | Location | Result under the real config |
| --- | --- | --- |
| M1: Pipeline redirect inverted (`=== "setup"` -> `!== "setup"`) | `web/app/(app)/pipeline/page.tsx:48` | **killed** - 6 failed in `setup-gate.test.ts` (C2800 owner and admin, C2800 failed read, C2801 estimator and viewer, C2802 done) |
| M2: `SetupForRequest` targets swapped (`"signed_out" ? "/login" : "/pipeline"` -> `? "/pipeline" : "/login"`) | `web/app/setup/page.tsx:15` | **killed** - 2 failed in `page.test.ts` (C2807 signed out, C2807 no membership) |
| M5 (my choice): stamp filter flipped (`.is("setup_completed_at", null)` -> `.not("setup_completed_at", "is", null)`) | `web/infrastructure/supabase/setup.ts:16` | **killed** - 3 failed (C2809, C2812, C2813) |

Round 2 mutants M3 (notice text) and M4 (field errors detached) and the round 1 mutants are `carried from f740a64` / `cc8e11d` (killed; their tests re-ran green at 8a3d157, and the fix diff touches no source).

## Gate

verified at 8a3d157: 9 files / 59 tests / 0 failed under the real config; full suite 217 files / 3944 tests green; `npm run test:db first_login_setup` PASS 1/0. M1, M2 and M5 die. C2820 is NOT PROVEN (live run needs the migration applied with the owner's go-ahead). Per the verification rule an unproven check keeps the verdict at FAIL.

## Ranked gaps

1. C2820 / AC 19 NOT PROVEN. Needs the owner's go-ahead to apply the `org_settings.setup_completed_at` migration, then the Playwright pass on `/setup` at 375, 768 and 1440 px (touch on the two smaller, province select, Continue, Skip, console clean) in one signed-in context. Once recorded by the author, the feature is otherwise complete.
2. C2805 remains a textual search; no longer a gap, since `setup-gate.test.ts` proves the condition's direction.
