# First-login setup verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: a79cb83..HEAD (verified at d5fe63d; this round's fix range is 8a3d157..d5fe63d)
**Round**: 4 - scoped
**Verifier**: independent sub-agent (author != verifier)

Two reasons for FAIL. (1) New and found this round: `npm run test:db first_login_setup` now FAILS at HEAD, because the migration is applied to the hosted project and the recipe still replays it, so the five SQL-proven checks (C2803, C2804, C2811, C2813, C2814) have no green proof at HEAD. (2) C2820 is proven only by the author's own account; the artifacts left on disk corroborate part of it and contradict none of it, but do not evidence the sizes, the 44 px claim, touch, or the second fix.

Scope of this round: the fix diff `8a3d157..HEAD` (commits 62daa34 and d5fe63d; source change is `web/components/setup/setup-view.tsx`, 2 lines, plus a comment-only line removed from the migration file) and every round 3 non-PASS item (C2820). Everything else is `carried from 8a3d157` / earlier.

## Binding sources

None - the plan marks no binding source. `carried from cc8e11d`.

## Checks

verified at d5fe63d (proofs re-run in full):

- `cd web && npx vitest run <the 9 files holding a C28xx test> --reporter=verbose` (one invocation) -> **9 files passed, 59 tests passed, 0 failed, exit 0**. Each named test is listed individually in the verbose output; files: `app/(app)/pipeline/setup-gate.test.ts`, `app/setup/actions.test.ts`, `app/setup/page.test.ts`, `app/setup/setup-wiring.test.ts`, `components/setup/setup.test.ts`, `composition/setup-wiring.test.ts`, `domain/org-settings/setup.test.ts`, `infrastructure/supabase/setup.test.ts`, `proxy.setup.test.ts`. The file set was found by `grep -rl "C28[0-2][0-9]:"` over `web/` (excluding `node_modules`): exactly these nine.
- `cd web && npm run test:db first_login_setup` -> **`FAIL first_login_setup: column "setup_completed_at" of relation "org_settings" already exists`, 0 passed, 1 failed, exit 1.** This contradicts the brief's premise that it "still works because the recipe inlines the migration": the inlined migration (`web/scripts/test-db/runner.mts:61`, `FIRST_LOGIN_MIGRATION` at `:27`) is a plain `alter table ... add column`, which now collides with the applied column. Diagnosis in a scratch worktree only: with the migration part removed from that recipe (`parts: ["fixture.sql", "first_login_setup.sql"]`) the same recipe reports `PASS first_login_setup`, 1 passed, 0 failed, so the SQL assertions hold against the hosted state (including C2814's column shape and C2803's provisioning through the redefined function). Nothing was fixed in the real tree. The repo has precedent for the fix: `a79cb83 chore(billing): drop the in-transaction migration from the recipes`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2800 | owner/admin of pending org -> setup; Pipeline redirects them | vitest batch, exit 0 | `app/(app)/pipeline/setup-gate.test.ts:29` `C2800: a admin of a pending org is redirected to /setup`; `domain/org-settings/setup.test.ts:7-8` | PASS |
| C2801 | estimator/viewer pending -> proceed | vitest batch | `setup-gate.test.ts:35`; `setup.test.ts:12-13` | PASS |
| C2802 | four roles not pending -> proceed | vitest batch | `setup-gate.test.ts:41,55`; `setup.test.ts:17` | PASS |
| C2803 | provisioned org has null `setup_completed_at` | `npm run test:db first_login_setup` exit 1 at HEAD (recipe replays an applied migration); passes with the replay removed (scratch) | `supabase/tests/first_login_setup.sql:41` | FAIL at HEAD as shipped |
| C2804 | backfill and default | same | `first_login_setup.sql:48,52` (note: with the migration applied, the "fixture rows exist before the migration" premise at `first_login_setup.sql:4` can no longer hold, so the backfill half now only shows a non-null value, not a backfill) | FAIL at HEAD as shipped |
| C2805 | only Pipeline redirects to /setup | vitest batch | `app/setup/setup-wiring.test.ts:27`; direction proven by `setup-gate.test.ts` (M1 killed again) | PASS |
| C2806 | /setup owner/admin not pending -> /pipeline | vitest batch | `setup.test.ts:23-24`; `app/setup/page.test.ts:53` | PASS |
| C2807 | estimator/viewer/no membership -> /pipeline; signed out -> /login; proxy | vitest batch | `setup.test.ts:28-31`; `page.test.ts:36,41,47`; `proxy.setup.test.ts:30` | PASS |
| C2808 | form opens prefilled | vitest batch (re-run after the d5fe63d diff) | `components/setup/setup.test.ts:40,51` (`/<option value="BC"[^>]*selected/`) | PASS |
| C2809 | save writes exact columns, stamps, redirects | vitest batch | `infrastructure/supabase/setup.test.ts:28-32`; `actions.test.ts:47` | PASS |
| C2810 | invalid input -> every field error together, nothing stored | vitest batch | `setup.test.ts:79,83`; `actions.test.ts:65,68-69`; `components/setup/setup.test.ts:82` | PASS |
| C2811 | RLS refusal -> forbidden, no stamp, notice; DB 0 rows | vitest batch for the TS halves; SQL half failing at HEAD as shipped (see above) | `infra setup.test.ts:37-38`; `components/setup/setup.test.ts:71`; `first_login_setup.sql:75` | FAIL at HEAD as shipped (SQL proof) |
| C2812 | skip stamps only | vitest batch | `infra setup.test.ts:54`; `actions.test.ts:88-89` | PASS |
| C2813 | stamp filters is null; DB keeps first | TS half green; SQL half failing at HEAD as shipped | `infra setup.test.ts:61`; `first_login_setup.sql:105` | FAIL at HEAD as shipped (SQL proof) |
| C2814 | column shape and privileges | SQL, failing at HEAD as shipped | `first_login_setup.sql:59,61,63,79,86` | FAIL at HEAD as shipped |
| C2815 | catalog groups and counts | vitest batch | `setup.test.ts:99-104,109` | PASS |
| C2816 | catalog read shape | vitest batch | `infra setup.test.ts:79-81` | PASS |
| C2817 | empty catalog text | vitest batch (after d5fe63d) | `components/setup/setup.test.ts:92,99` | PASS |
| C2818 | no form control in review | vitest batch (after d5fe63d) | `components/setup/setup.test.ts:104` | PASS |
| C2819 | loading and error states, page writes nothing | vitest batch | `setup-wiring.test.ts:35-36,41` | PASS |
| C2820 | live Playwright at 375/768/1440 | author-run on 2026-11-10; verifier did not and could not re-run (no signed-in session, no dev server against the hosted DB). See "C2820 evidence" below | the artifacts on disk, not assertions: `.playwright-mcp/console-2026-11-10T17-37-52-221Z.log` .. `console-2026-11-10T17-50-23-591Z.log`, `page-2026-11-10T17-49-22-032Z.yml`, `page-2026-11-10T17-49-48-545Z.yml`, `page-2026-11-10T17-50-27-407Z.yml` | SELF-REPORT, partly corroborated - not independently proven |
| C2821 | container wiring | vitest batch | `composition/setup-wiring.test.ts:26,28,44` | PASS |

### C2820 evidence (judged against what is on disk)

The `.playwright-mcp/` directory is gitignored, so nothing here is committed; checks.md says "nothing committed", which is met. It holds 10 console logs and 11 accessibility snapshots dated 2026-11-10, and no screenshot, no network capture and no box or size data from that day (`ls | grep 2026-11-10` shows only `console-*.log` and `page-*.yml`). Claim by claim:

| Claim of the author | What the artifacts show | Verdict |
| --- | --- | --- |
| console 0 errors/warnings | All ten 2026-11-10 logs contain only `[INFO]` React DevTools and `[LOG]` HMR / Fast Refresh lines; no `[ERROR]` or `[WARNING]` line in any. Logs are per page load and not tied to a viewport. | Corroborated for the loads logged |
| `/setup` renders prefilled, controls present | `page-2026-11-10T17-49-22-032Z.yml`: heading "Set up your workspace", Legal name, Phone, Address, Province select (BC selected), Accent colour, Item singular/plural, the 40-type "Heating and cooling" group, Continue and Skip for now buttons | Corroborated (one viewport, size unknown) |
| invalid Continue shows both field errors | `page-2026-11-10T17-49-48-545Z.yml`: province `[invalid]` with "Choose your province or territory", accent colour `[invalid]` with "Accent colour must look like #1f6f8b" and value `blue` kept | Corroborated for the two errors. Stamping nothing is not visible in any artifact. |
| Skip for now stamps and lands on /pipeline, other columns untouched | `page-2026-11-10T17-50-27-407Z.yml` shows the Pipeline ("Good morning", "Agreement pipeline"). No database read, no network record. | Landing corroborated; "stamps" and "touches no other column" rest on the author alone (and this proof is also the SQL recipe's C2812/C2813, TS-proven) |
| no horizontal scroll at 375, 768, 1440 | No `scrollWidth`/`clientWidth` figure, screenshot or resize record for any size | Not evidenced |
| controls >= 44 px on mobile and tablet; touch on province select, Continue, Skip | No bounding boxes, no touch event record | Not evidenced |
| defect 1 fixed: Settings link has a 48 px tap area | Source diff `setup-view.tsx` adds `inline-block py-3.5 -my-3.5 lg:py-0 lg:my-0`; arithmetic 17 + 2x14 = 45 px of line box before the -my offset does not change the hit area; no measured box | Plausible from the diff, not measured on disk |
| defect 2 fixed: province keeps "Choose one" after an error | The only post-error snapshot (`17-49-48`) shows `British Columbia [selected]` beside the error "Choose your province", i.e. the pre-fix state; the later snapshots (`17-50-07`, `17-50-14`, `17-50-24`) are pristine forms with BC selected. No snapshot shows the fixed behaviour. | Not evidenced; no post-fix capture of the error state |

Also noted: the demo org was backfilled to a non-null stamp by the applied migration, yet `/setup` rendered for it, so the author must have nulled `setup_completed_at` for the demo org to run this pass (inference from the snapshots; no artifact shows it). That is a hosted-database write by the author that the report should list.

Judgement on the checks.md wording ("author-run, nothing committed; the report lists pages, sizes, touch actions and fixes"): the wording asks for a list from the author and is met on its face if the author's report lists those four things, which it does by the author's account. It is a self-report and stays labelled as one. The disk evidence supports four of the nine sub-claims (console, render, invalid errors, landing); the other five (three sizes with no scroll, 44 px, touch, both fixes verified) have nothing behind them but the author's word. I do not mark it PASS and I do not mark it failed.

## Coverage

verified at d5fe63d for the rows touched; the rest `carried from 8a3d157`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `setup_completed_at` stampers (3) | plan Landing door 1; `supabase/migrations/20261110110000_first_login_setup.sql` | provision leaves null C2803 · migration backfill C2804 · stamp keeps first value C2813 -> `first_login_setup.sql:41,48,52,105` | all three SQL members have no green proof at HEAD (recipe fails, see Checks); the backfill member can no longer be exercised at all against an applied migration |
| `org_settings` entity relation (1) | plan Relations | column and policy C2814 -> `first_login_setup.sql:59-86` | no green proof at HEAD as shipped |
| `/setup` rendered controls (setup-view) | `components/setup/setup-view.tsx` at HEAD | province select and its error -> `setup.test.ts:51,82` (renders markup only); the new `key` on the Select and the new link class | the `key` remount behaviour and the 44 px tap area have no automated check (markup-only `renderToStaticMarkup` cannot see either); they rest on C2820 self-report |
| `GET /setup` statuses (3), `/setup` entry (5), `GET /pipeline` 303 (1), gate (8), invalid cases (6), columns (7), catalog groups (4), intents (2), container (1) | `carried from 8a3d157` | unchanged by the fix diff; the same tests re-ran green at d5fe63d | - |
| acceptance criteria with no check | plan AC 1-20 | AC 19 -> C2820 (self-report only) | AC 19 not independently proven |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (domain) | `domain/org-settings/setup.ts` | one at its layer, one case per row | yes - re-run green at d5fe63d |
| Entry point that decides nothing (Server Action, page) | `app/setup/actions.ts`, `app/setup/page.tsx`, `app/(app)/pipeline/page.tsx` | accepted input, each rejected input, each error path | yes - re-run green at d5fe63d; M1 killed again |
| Adapter | `infrastructure/supabase/setup.ts` | one against the client double | yes - re-run green; M5 killed again |
| Instrumentation, pass-throughs | composition additions, `state.ts`, `error.tsx`, `loading.tsx`, `setup-view.tsx` presentation lines | none of its own | yes - carried; the two `setup-view.tsx` lines are presentation and covered only by C2820 |

## Faults injected

verified at d5fe63d. Scratch `git worktree` at HEAD (path under the session scratchpad), `web/node_modules` junctioned, `web/.env.local` copied. Real tree `git status --porcelain` before: empty; after: identical (compared with `diff`, "SAME"); the worktree was removed and pruned and the junction removed with `rmdir` (real `node_modules` intact). The scratch edits and the recipe experiment were made only in the scratch.

| Mutation | Location | Killed |
| --- | --- | --- |
| M1: Pipeline redirect inverted (`=== "setup"` -> `!== "setup"`) | `web/app/(app)/pipeline/page.tsx:48` | yes - 6 failed in `setup-gate.test.ts` (C2800 owner, C2800 admin, C2800 failed read, C2801 estimator, C2801 viewer, C2802 done) |
| M5: stamp filter flipped (`.is("setup_completed_at", null)` -> `.not("setup_completed_at", "is", null)`) | `web/infrastructure/supabase/setup.ts:16` | yes - 3 failed (C2809, C2812, C2813) |

Not injected by instruction: the new `key={values.governingProvince}` on the province Select and the changed link class. **Coverage gap (stated, not a surviving mutant):** no check asserts either; the unit tests render with `renderToStaticMarkup`, which neither remounts nor lays out, so deleting the `key` or the class would leave all 59 tests green. Round 2 mutants M2, M3, M4 are `carried from 8a3d157` / `f740a64`.

## Regression review of d5fe63d (`web/components/setup/setup-view.tsx`)

verified at d5fe63d. The diff is two lines: a class change on the inline Settings `Link` and `key={values.governingProvince}` on the province `Select`. No logic, props or markup structure changed besides those two attributes. C2808 (prefill, `<option value="BC"` selected), C2810 (errors render under fields), C2811 (notices render, typed values kept), C2817 and C2818 (catalog review markup, no form control) all re-ran green in the 59-test batch. Reasoning on the `key`: it equals the current province value, so the Select remounts only when that value changes (initial render and after an invalid result with a different province); with an unchanged value there is no remount, so a user's in-progress edit elsewhere in the form is unaffected. No regression found; neither change is asserted by any test.

## Gate

verified at d5fe63d: vitest batch 9 files / 59 tests / 0 failed. `npm run test:db first_login_setup`: 0 passed, 1 failed at HEAD as shipped (migration already applied; passes 1/0 once the replay is dropped from the recipe, shown in a scratch). M1 and M5 die. C2820 is a self-report with partial corroboration.

## Ranked gaps

1. SQL proofs broken at HEAD - C2803, C2804, C2811, C2813, C2814 - `web/scripts/test-db/runner.mts:61` replays `20261110110000_first_login_setup.sql` (constant at `:27`, comment at `:26` still says "until the owner applies it") against a project that already has the column: `npm run test:db first_login_setup` exits 1. Fix as `a79cb83` did for billing: drop `FIRST_LOGIN_MIGRATION` from the recipe parts, update `first_login_setup.sql:3-5` and `:4`, and note that C2804's "rows created before the migration" can no longer be exercised against an applied migration (restate or retire that half of C2804 in checks.md).
2. C2820 / AC 19 is a self-report: no on-disk evidence for the three sizes with no horizontal scroll, the 44 px claim, touch actions, or either defect fix being verified (the only post-error snapshot shows the pre-fix province state). The wording in checks.md is met on its face; the proof is not independent.
3. Coverage gap: the province Select `key` and the 48 px Settings link tap area have no automated check; deleting either leaves all tests green. Candidate: a jsdom or Playwright-less test is not available under the current `renderToStaticMarkup` setup, so this stays on C2820 unless a client render test is added.
4. The author's live pass required nulling `setup_completed_at` for the demo org (inferred); the report should state any hosted-database write it made.
