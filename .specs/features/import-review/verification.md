# Import review verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: caa104f..be16688 (fix range 9091a31..be16688)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier). A fresh round-2 sub-agent that wrote none of this feature and none of its fixes. It worked read-only over the real tree, injected faults only in a scratch `git worktree`, and fixed nothing.

58 checks. 56 are proven with located evidence at be16688. C656 (MCP advisors) and C658 (live browser run) were not re-run by this Verifier; they are accounted for from the author's Handoff, as in round 1. 5 faults were injected in round 2 and all 5 were killed, including round 1's surviving fault.

## Round 1 findings, re-verified at be16688

Round 1 (FAIL, `caa104f..9091a31`, committed in 0bc91f0) raised four findings. Each was re-checked against the code and the tests at be16688.

1. **C640: `mapType` returned `{ ok: true, rows: 0 }` for a missing or other-org job.** Fixed. `web/infrastructure/supabase/import-review.ts:122-125` now reads the job first. No job means `not_found`, and a job that is not `extracted` means `locked`. Both answers come before any row is read or written. The new test `web/infrastructure/supabase/import-review.test.ts:176` asserts `toEqual({ ok: false, code: "not_found" })`, and `:177` asserts `calls.some((c) => c.table === "import_rows")).toBe(false)`. To check this, the whole job lookup (`:121-125`) was deleted in the scratch. The store then went back to round 1's behaviour (`expected { ok: true, rows: +0 } to deeply equal { ok: false, code: 'not_found' }`), and C640 and C636 both failed. A missing job and an other-org job are the same case here, because RLS hides the other org's job and `maybeSingle` returns null. The SQL half of C640 (other org: `P0002`, 0 rows updated) is unchanged and passes.
2. **C615: the dimming assertion matched the column-label spans.** Fixed. `web/components/imports/review.test.ts:171` now takes the class list of the row's own grid `div`. `:172` asserts that the skipped row's grid contains `text-ink-2`. `:173-174` assert that an included row's grid contains `text-ink` and not `text-ink-2`. The skipped row's ink is set on that grid at `web/components/imports/review-view.tsx:151`, `:154`. The round-1 survivor (`ink` always `text-ink`) was re-injected and is now killed.
3. **C638: the viewer's flag was satisfied by the type cell.** Fixed. `web/components/imports/review.test.ts:255` now requires the attention pill, `toMatch(/data-tone="attention"[^>]*>Needs a type</)`. `StatusPill` puts `data-tone` on the pill's own span (`web/components/ui/status-pill.tsx:28`), and the type cell carries no `data-tone` (`review-view.tsx:157`). A view that dropped flags only for viewers now fails C638.
4. **Flag labels for AC 9-13 had no positive proof.** Fixed. `web/components/imports/review.test.ts:179-190` is a 7-case table. It asserts `new RegExp(\`data-tone="attention"[^>]*>${label}<\`)` (`:189`) for each of "Needs a type", "Too long: Unit #", "Too long: Type/model", "Too long: Location/access", "Check this row", "Same as row 1" and "Already on this site". The labels come from `review-view.tsx:34-47`. With the attention pills removed, all 7 cases and C638 fail (8 tests).

**Nothing else broke.** The fix diff touches `web/infrastructure/supabase/import-review.ts` (`mapType` only), `web/infrastructure/supabase/import-review.test.ts` and `web/components/imports/review.test.ts`. The checks it touches are C609-C613 and C615 (new view cases), C619, C622 and C636 (stub gains an `import_jobs` reply), C638 and C640. All of them pass at be16688. The C622 assertion change (`eq` scoped to `import_rows`, `web/infrastructure/supabase/import-review.test.ts:141`) still pins `["job_id", JOB]` on the row read. It does not weaken the claim, because the job read is now the first `eq`. The full suite, lint and test:db are green (see Gate).

**The new `mapType` branches map onto existing members.** The fix adds three branches: `not_found`, `locked` and a job-read error that goes through `failure()`. All three outcomes are already members of the `mapImportTypeAction` state set. The job-read error branch has no store-level case. It shares `failure()` with the row writes, whose `unavailable` mapping round 1 accepted at the action layer (C647), and no check names it.

## Binding sources

Carried from 9091a31. The fix touched no interface or screen composition, only an adapter branch and tests. Step 1 runs under `ui`; this feature is `standard`.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 2 item 4, pipeline steps 5-6 | yes (round 1) - `ROADMAP.md:68-69`, `:110` | none | - |
| STATE.md AD-003/004/015/023/028-030/038-050 | yes (round 1) - `.specs/STATE.md:9-56` | none | - |
| `.specs/features/import-extract/plan.md` | yes (round 1) | none | - |

## Checks

Proofs verified at be16688. Every proof re-ran at HEAD. Citations in the two touched test files were refreshed. In `web/components/imports/review.test.ts`, lines after `:176` moved +18, and lines after `:253` moved +19. In `web/infrastructure/supabase/import-review.test.ts`, lines after `:170` moved +14. All other citations are carried from 9091a31, and their files are unchanged in `9091a31..be16688`.

**Vitest proofs** ran in one invocation from `web/`:
`npx vitest run components/imports domain/imports infrastructure/supabase "app/(app)" composition -t "C601:|C602:|…|C658:" --reporter=verbose`. It exited 0 with **144 passed**, 391 skipped and 0 failed, and every test was listed individually. Per id: C601 7, C602 1, C603 1, C604 11, C605 1, C606 1, C607 9, C608 6, C609 2, C610 9, C611 4, C612 5, C613 2, C614 1, C615 2, C616 1, C617 1, C618 5, C619 1, C620 2, C621 3, C622 1, C623 2, C624 1, C625 4, C626 1, C628 2, C629 1, C630 1, C631 1, C632 1, C634 2, C635 2, C636 7, C638 1, C639 4, C640 7, C641 1, C642 1, C646 6, C647 15, C648 6, C649 1, C652 1. That is 9 more than round 1's 135: the 7 flag-pill cases, plus one new case each for C640 and C636.

**Other proofs at be16688:** `npm run test:db`: `14 passed, 0 failed`, including `PASS import_review`. `npm test`: 50 files, 1,037 passed. `npm run lint`: exit 0. SERVICE_ROLE grep under `web/app`, `web/infrastructure`, `web/composition`, `web/components` and `web/domain`: `0`. The shell greps for C650, C651 and C657 and `npx next build` (C655) are carried from 9091a31; the files they read are unchanged, and the fix touches no route, migration or doc file.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C601 | "Review rows" link, 7 statuses, both roles | vitest 7 (be16688) | `web/components/imports/review.test.ts:92` `expect(html.includes(...) && html.includes("Review rows")).toBe(shown)` | PASS |
| C602 | rows in position order, every column | vitest 1 | `web/components/imports/review.test.ts:112` `toEqual([1, 2, 3])`; `:114`, `:116-118` | PASS |
| C603 | counts line, filter links, attention rows | vitest 1 | `web/components/imports/review.test.ts:130-133` | PASS |
| C604 | pager over 9 cases; filter kept | vitest 11 | `web/domain/imports/review.test.ts:42`; `web/components/imports/review.test.ts:140-149` | PASS |
| C605 | empty attention message | vitest 1 | `web/components/imports/review.test.ts:154-155` | PASS |
| C606 | 0 rows: message, no commit button | vitest 1 | `web/components/imports/review.test.ts:160-161` | PASS |
| C607 | 404, /login, reader null for 5 statuses | vitest 9 | `web/app/(app)/import-review.test.ts:82-83`, `:88`, `:93`; `web/infrastructure/supabase/import-review.test.ts:51-52`, `:57-58` | PASS |
| C608 | `.range()` pages over 4 sizes; "2,000 rows" | vitest 6 | `web/infrastructure/supabase/import-review.test.ts:73-76`; `web/components/imports/review.test.ts:165` | PASS |
| C609 | untyped row needs type; on screen "Needs a type" pill | vitest 2 | `web/domain/imports/review.test.ts:51-52`; `web/components/imports/review.test.ts:189` (case `:180`) | PASS |
| C610 | 6 length edges; 3 "Too long: <field>" pills | vitest 9 | `web/domain/imports/review.test.ts:64`; `web/components/imports/review.test.ts:189` (cases `:181-183`) | PASS |
| C611 | low -> check; "Check this row" pill | vitest 4 | `web/domain/imports/review.test.ts:73`; `web/components/imports/review.test.ts:189` (case `:184`) | PASS |
| C612 | duplicates, 4 cases; "Same as row 1" pill | vitest 5 | `web/domain/imports/review.test.ts:81-83`, `:90-91`, `:99-100`, `:106`; `web/components/imports/review.test.ts:189` (case `:185`) | PASS |
| C613 | on site; "Already on this site" pill | vitest 2 | `web/domain/imports/review.test.ts:113-114`; `web/components/imports/review.test.ts:189` (case `:186`) | PASS |
| C614 | null unit never a duplicate | vitest 1 | `web/domain/imports/review.test.ts:121-122` | PASS |
| C615 | skipped: no flag; "Skipped" label; fields in secondary ink | vitest 2 | `web/domain/imports/review.test.ts:127`; `web/components/imports/review.test.ts:172` `expect(gridOf(1).split(" ")).toContain("text-ink-2")`, `:174` included row `not.toContain("text-ink-2")`, `:175` `toMatch(/data-tone="neutral"[^>]*>Skipped</)`; round-1 survivor now killed | PASS |
| C616 | row editor fields, Save/Cancel | vitest 1 | `web/components/imports/review.test.ts:266-272` | PASS |
| C617 | trimmed update, refresh once | vitest 1 | `web/app/(app)/import-review.test.ts:101-104` | PASS |
| C618 | 4 invalid edits refused; errors under fields | vitest 5 | `web/app/(app)/import-review.test.ts:114-117`; `web/components/imports/review.test.ts:277-278` | PASS |
| C619 | each write sends only its own columns | vitest 1 | `web/infrastructure/supabase/import-review.test.ts:118-123` | PASS |
| C620 | spelling list; count and select | vitest 2 | `web/domain/imports/review.test.ts:143`; `web/components/imports/review.test.ts:195-197` | PASS |
| C621 | map by normalized text; "Applied to 14 rows" | vitest 3 | `web/app/(app)/import-review.test.ts:135-137`, `:141-142`; `web/components/imports/review.test.ts:284` | PASS |
| C622 | mapType ids, `is null` on read and update | vitest 1 | `web/infrastructure/supabase/import-review.test.ts:138` `toEqual({ ok: true, rows: 3 })`, `:141` `["job_id", JOB]` on `import_rows`, `:143` `["id", ["w1", "w2", "w3"]]`, `:144` | PASS |
| C623 | skip/include; Skip and Include buttons | vitest 2 | `web/app/(app)/import-review.test.ts:124-130`; `web/components/imports/review.test.ts:202-203` | PASS |
| C624 | "Add 3 assets to Brookhaven" / "Add 1 asset" | vitest 1 | `web/components/imports/review.test.ts:208-210` | PASS |
| C625 | disabled + fix line, 4 cases | vitest 4 | `web/components/imports/review.test.ts:220-221` over `:214-217` | PASS |
| C626 | prompt idle vs confirming | vitest 1 | `web/components/imports/review.test.ts:294-300` | PASS |
| C627 | RPC adds 2, links rows, commits job | test:db PASS (be16688) | `supabase/tests/import_review.sql:82-92` | PASS |
| C628 | atomic commit; adapter unavailable + log; copy | test:db; vitest 2 | `supabase/tests/import_review.sql:110-113`; `web/infrastructure/supabase/import-review.test.ts:213-214`; `web/components/imports/review.test.ts:304` | PASS |
| C629 | 23514 over 4 jobs; action incomplete | test:db; vitest 1 | `supabase/tests/import_review.sql:124-125`, `:131`; `web/app/(app)/import-review.test.ts:151-152` | PASS |
| C630 | all skipped / 0 rows refused | test:db; vitest 1 | `supabase/tests/import_review.sql:128-129`; `web/app/(app)/import-review.test.ts:158-160` | PASS |
| C631 | second RPC 40001; stored result | test:db; vitest 1 | `supabase/tests/import_review.sql:99-100`; `web/infrastructure/supabase/import-review.test.ts:219` | PASS |
| C632 | result line 3 forms + link | vitest 1 | `web/components/imports/review.test.ts:231-232` over `:226-228` | PASS |
| C633 | deleted asset nulls link, keeps row | test:db | `supabase/tests/import_review.sql:138-142` | PASS |
| C634 | committed: Added/Skipped, no controls | vitest 2 | `web/components/imports/review.test.ts:238-240`, `:247-248` | PASS |
| C635 | "Added to site" pill; forSite mapping | vitest 2 | `web/components/imports/review.test.ts:98-100`; `web/infrastructure/supabase/import-review.test.ts:239` | PASS |
| C636 | locked: 55000 x3; mapType on a non-extracted job; discard; actions; copy | vitest 7 | `web/infrastructure/supabase/import-review.test.ts:157`, `:182` `toEqual({ ok: false, code: "locked" })`, `:183` no `update` on `import_rows`, `:227-229`; `web/app/(app)/import-review.test.ts:187-190`; `web/components/imports/review.test.ts:308-310` | PASS |
| C637 | trigger 6 cases, definer, search_path | test:db | `supabase/tests/import_review.sql:147-156`, `:162-163` | PASS |
| C638 | viewer: rows and flags, no control | vitest 1 | `web/components/imports/review.test.ts:253` rows; `:255` `toMatch(/data-tone="attention"[^>]*>Needs a type</)`; `:256` no control | PASS |
| C639 | viewer forbidden x4; SQL 42501, 0 rows | vitest 4; test:db | `web/app/(app)/import-review.test.ts:173-174`; `supabase/tests/import_review.sql:169-171` | PASS |
| C640 | not_found: malformed ids; store on no row back; missing/other-org job for mapType; P0002; other org in SQL | vitest 7; test:db | `web/app/(app)/import-review.test.ts:178-179`; `web/infrastructure/supabase/import-review.test.ts:163-164`, `:169`, `:176` `mapType(JOB, ...)).toEqual({ ok: false, code: "not_found" })`, `:177`; `supabase/tests/import_review.sql:178-180`; code `web/infrastructure/supabase/import-review.ts:124` | PASS |
| C641 | one request client; no SERVICE_ROLE | vitest 1; grep `0` | `web/composition/composition.test.ts:186-190`; `web/composition/index.ts:67-68` | PASS |
| C642 | jobId only; pronargs 1; site from job | vitest 1; test:db | `web/app/(app)/import-review.test.ts:164-166`; `supabase/tests/import_review.sql:199` | PASS |
| C643 | door 1 constraints | test:db | `supabase/tests/import_review.sql:208-220` | PASS |
| C644 | door 2 checks | test:db | `supabase/tests/import_review.sql:230-234` | PASS |
| C645 | 40001 x3; P0002; invoker; no anon | test:db | `supabase/tests/import_review.sql:187-190`, `:196-198` | PASS |
| C646 | commit mapping, 7 cases | vitest 6 (+C628) | `web/infrastructure/supabase/import-review.test.ts:205-207` over `:196-201` | PASS |
| C647 | each action passes the store's answer | vitest 15 | `web/app/(app)/import-review.test.ts:198-200`, `:205-206`, `:213-216`, `:228-229`, `:235-236` | PASS |
| C648 | 6 alert copies | vitest 6 | `web/components/imports/review.test.ts:327` over `:314-319` | PASS |
| C649 | ports declare review ports | vitest 1 | `web/composition/composition.test.ts:196-201` | PASS |
| C650 | route flat by job id | shell `2` (carried from 9091a31) | `web/app/(app)/imports/[jobId]/page.tsx:54` | PASS |
| C651 | migration file; types | shell `1`, `17` (carried from 9091a31) | `supabase/migrations/20261027162030_import_review.sql:76` | PASS |
| C652 | container returns 5 functions | vitest 1 | `web/composition/composition.test.ts:180` | PASS |
| C653 | test:db all 14 | `npm run test:db` 14 passed (be16688) | `web/scripts/test-db/runner.mts:42`; `web/scripts/test-db/runner.test.ts:120` | PASS |
| C654 | whole suite and lint | `npm test` 1,037 passed; lint exit 0 (be16688) | `web/scripts/test-db/runner.test.ts:129` | PASS |
| C655 | next build exits 0 | carried from 9091a31; the fix touches no build input beyond one adapter function, and the type-checked suite and lint are green at be16688 | `web/app/(app)/imports/[jobId]/page.tsx:54` | PASS (carried from 9091a31) |
| C656 | advisors at the two accepted findings | not re-run (MCP-only); carried from Handoff | `.specs/features/import-review/checks.md:524` | not re-run - author evidence says PASS |
| C657 | AD rows, CONTEXT, ROADMAP | shell `6`, `2`, `1` (carried from 9091a31; docs untouched) | `.specs/STATE.md:51-56`; `CONTEXT.md:83`; `ROADMAP.md:110` | PASS |
| C658 | live end-to-end run | not re-run (live, shared signed-in session); carried from Handoff | `.specs/features/import-review/checks.md:525-532`; the run happened before be16688's `mapType` job read | not re-run - author evidence: run PASS, cleanup outstanding |

## Coverage

Verified at be16688 for the rows the fix touched: `mapImportTypeAction`, rendered flag copy, skipped-row presentation, frozen row writes and roles. Every other row is carried from 9091a31, because its authority is untouched by `9091a31..be16688`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| page `GET /imports/[jobId]` (3) | carried from 9091a31 | 200 C602/C603 · 404 C607 · /login C607 | - |
| `updateImportRowAction` (6) | carried from 9091a31 | saved C617 · invalid C618 · locked C636 · forbidden C639 · not_found C640 · unavailable C647 | - |
| `skipImportRowAction` (5) | carried from 9091a31 | saved C623 · locked C636 · forbidden C639 · not_found C640 · unavailable C647 | - |
| `mapImportTypeAction` (6) | plan Surface + AC 36, 40; `web/infrastructure/supabase/import-review.ts:119-153` (be16688) | mapped C621/C622 · invalid C621 · locked C636 (55000 `IT:157`; job not extracted `IT:182`) · forbidden C639 · unavailable C647 · not_found C640 (malformed `AT:178`; missing/other-org job `IT:176`; 23503 `IT:169`) | - |
| `commitImportAction` (7) | carried from 9091a31 | committed · incomplete · nothing_to_add · not_ready · forbidden · not_found · unavailable (C627-C631, C639, C640, C646, C647) | - |
| job statuses at the route (7) | carried from 9091a31 | 5 refused C607 · extracted, committed C608 | - |
| statuses at the "Review rows" link (7) | carried from 9091a31 | C601 over all 7 | - |
| flag kinds (7) | carried from 9091a31 | C609, C610 x3, C611, C612, C613 | - |
| rendered flag copy (7, AC 9-13) | AC 9-13; `web/components/imports/review-view.tsx:34-47` (be16688) | "Needs a type" C609 · "Too long: Unit #", "Too long: Type/model", "Too long: Location/access" C610 · "Check this row" C611 · "Same as row n" C612 · "Already on this site" C613, all `RT:189`; the viewer's "Needs a type" pill C638 `RT:255` | - |
| flag exceptions (3) | carried from 9091a31 | C614 · C615 `DT:127` · C612 `DT:99-100` | - |
| skipped row presentation (2, AC 15) | AC 15; `review-view.tsx:151`, `:154`, `:168` (be16688) | "Skipped" neutral pill C615 `RT:175` · dimmed row grid C615 `RT:172`, `:174` | - |
| length edges (6) | carried from 9091a31 | C610 over 6; SQL C629 | - |
| pager cases (9+1) | carried from 9091a31 | C604 over 10 | - |
| reader page sizes (4) | carried from 9091a31 | C608 over 4 | - |
| RPC outcomes (5) | carried from 9091a31 | C627 · C640/C645 · C639 · C631/C645 · C629/C630 | - |
| commit refusals in SQL (6) | carried from 9091a31 | C629 x4 · C630 x2 | - |
| `commit` adapter mapping (7) | carried from 9091a31 | C646 x6 + C628 | - |
| trigger cases (6) | carried from 9091a31 | C637 over 6; C633 | - |
| frozen row writes (4) | AC 36 (be16688) | update, skip `IT:157` · map `IT:157`, `IT:182` · discard `IT:227` C636 · SQL C637 | - |
| commit button states (5) | carried from 9091a31 | C624 x2 · C625 x3 | - |
| result line forms (3) | carried from 9091a31 | C632 over 3 | - |
| alert copy (7) | carried from 9091a31 | C628 · C648 x6 | - |
| roles (3) | RLS + `writer()` (be16688) | writer C617/C627 · viewer C638 (flags now pinned to the pill)/C639 · other org C640 store `IT:176` + SQL | - |
| Landing doors (6 + 2b) | carried from 9091a31 | C643, C644, C645/C646, C637, C650, C649/C608, C657 | - |
| startup config: container (1) | carried from 9091a31; `web/composition/index.ts` untouched | C641, C652 | - |

## Test policy

Re-judged at be16688: the two rows round 1 found unmet, and the rows classifying touched files. The other rows are carried from 9091a31.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | migration RPC and trigger; `web/infrastructure/supabase/import-review.ts`; `commit` in `web/infrastructure/supabase/imports.ts` | boundary SQL C627-C645 · own layer C607, C608, C619, C622, C636, C640, C646 | yes - `mapType`'s not_found and locked rows now each have a case (`IT:176`, `:182`); faults F2 and F3 killed (verified at be16688) |
| Decides, not reached across a boundary | `web/domain/imports/index.ts`; `web/components/imports/review-view.tsx` control rules | one asserted case per decision row | yes - skipped dimming C615, each flag label `RT:189`, viewer flags C638; faults F1, F4 and F5 killed (verified at be16688) |
| Entry point, validation only | `web/app/(app)/import-actions.ts` | accepted, each rejected input, each error path | yes - carried from 9091a31 (file untouched; proofs re-ran green at be16688) |
| Instrumentation | `web/composition/index.ts`, `CommitPrompt`, `DiscardPrompt` | covered by consumer | yes - carried from 9091a31 |

## Faults injected

Verified at be16688. Round 1's five faults are carried from 9091a31. Four were killed, and the fifth, the skipped-dimming survivor, is re-injected below as F1 and is now killed.

- **Scratch.** `git worktree add --detach <scratchpad>/wt HEAD`, with `web/node_modules` linked to the real install through a directory junction. The baseline in the scratch was 266 passed for `components/imports` and `infrastructure/supabase`.
- **Per fault.** Each fault was applied alone with `sed` or a one-line Python replace, and only the narrowest proof ran. The scratch was then reset with `git checkout -- web`. The scratch porcelain was `0` after each reset.
- **Real tree.** `git status --porcelain` was recorded before the faults and compared with `diff` after. The two were identical. The junction was removed with `rmdir`, and the real `node_modules` was intact. The worktree was then removed and pruned, and `git worktree list` shows only the main tree.
- A one-line variant of F2 (only the `if (!job) return not_found` line removed) was also killed: C640 at `IT:176` failed.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 (round-1 survivor): skipped row ink always `text-ink` | `web/components/imports/review-view.tsx:151` | yes - C615 failed |
| F2: `mapType`'s job lookup removed (back to round-1 behaviour) | `web/infrastructure/supabase/import-review.ts:121-125` | yes - C640 `IT:176` and C636 `IT:182` failed (`{ ok: true, rows: 0 }`) |
| F3: `mapType`'s not-extracted `locked` branch removed | `web/infrastructure/supabase/import-review.ts:125` | yes - C636 `IT:182` failed |
| F4: attention flag pills removed from the row | `web/components/imports/review-view.tsx:170` | yes - 8 failed: C609, C610 x3, C611, C612, C613 pill cases and C638 |
| F5: a viewer's rows get no flags (`writer ? flagsOf(row) : []`) | `web/components/imports/review-view.tsx:150` | yes - C638 failed |

## Swept re-read

Carried from 9091a31, with one row refreshed. Idempotency now holds as written: a re-applied mapping on an `extracted` job still answers `mapped` 0 when no untyped row matches, which is correct. A missing or other-org job now answers `not_found` (`web/infrastructure/supabase/import-review.ts:124`).

## Gate

Verified at be16688.

- Batched vitest proofs: 144 passed, 0 failed (391 skipped by the filter)
- `npm test`: 50 files, 1,037 passed, 0 failed
- `npm run lint`: exit 0
- `npm run test:db`: 14 passed, 0 failed
- `npx next build`: carried from 9091a31
- `get_advisors` (C656) and live run (C658): not re-run by this Verifier. Accounted for from the author's Handoff (`.specs/features/import-review/checks.md:524-532`).

## Notes

- Data hygiene, not a check: the Handoff records the live-data cleanup from C658 as not done (`.specs/features/import-review/checks.md:532`). The demo org still holds the 4 imported assets on Brookhaven Community Centre, the committed job `7320a90f-ad98-4176-92bd-1ad8c9934c61` with its rows, and its stored object.
- C658's live mapping step ran on pre-fix code. The fix only adds an up-front job read to `mapType`, and the stub proofs cover that read. It has not been exercised live.
