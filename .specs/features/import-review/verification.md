# Import review verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: caa104f..9091a31
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier). A fresh sub-agent that wrote none of this feature. It worked read-only over the real tree, injected faults only in a scratch `git worktree`, and fixed nothing.

58 checks. 53 are proven with located evidence at 9091a31. 3 fail: C640, C615 and C638. 2 (C656, C658) are MCP or live proofs that this Verifier could not re-run; they are accounted for from the author's Handoff and are not counted as proven here. 5 faults were injected and 4 were killed. The survivor is on the review view's skipped-row dimming (C615).

Ranked gaps:

1. **C640 / AC 40: `mapType` never answers `not_found`.** `web/infrastructure/supabase/import-review.ts:131-143` returns `{ ok: true, rows: 0 }` when its update returns no row. It returns the same answer when the job is missing or belongs to another org, because the RLS-filtered read is empty and no update is sent. So `mapImportTypeAction` on a well-formed missing or other-org job id answers `{ status: "mapped", rows: 0 }` ("Applied to 0 rows"), where AC 40 requires `not_found`. The C640 test (`web/infrastructure/supabase/import-review.test.ts:167-169`) asserts `not_found` only for a `23503` error, which is a different trigger from the one the check names. A probe test in the scratch worktree, deleted afterwards, confirmed both cases: received `{"ok":true,"rows":0}`, expected `{ ok: false, code: "not_found" }`.
2. **C615 / AC 15: dimming is unasserted, and the mutant survived.** `web/components/imports/review.test.ts:170` matches `class="[^"]*text-ink-2[^"]*"` anywhere after `data-row="1"`. Every `Cell` label span (`web/components/imports/review-view.tsx:55`) already carries `text-ink-2`, so the regex matches whether or not the row is dimmed. Fault 2 (`ink` always `text-ink`) left C615 and the whole suite (1,028 tests) green.
3. **C638 / AC 38: the viewer's flags are unasserted.** `web/components/imports/review.test.ts:236` asserts `>Needs a type<`. The equipment-type cell renders that same text for an untyped row (`web/components/imports/review-view.tsx:157`), independent of the flag pill at `:170`. A view that dropped every flag for a viewer would still pass.
4. **AC 10-13 flag copy has no automated proof.** No test asserts the rendered labels `Too long: <field>`, `Check this row`, `Same as row <n>` or `Already on this site` (`review-view.tsx:34-47`). A grep over all `*.test.ts` finds only the negative assertions at `review.test.ts:171` and `:230`. C609-C614 prove the flag *kinds* in the domain. The author's live run (C658) saw three of the labels; `Too long: …` and `Check this row` have no proof at all. This is a precision gap in the checks, not in a check's own claim.

## Binding sources

Step 1 runs only under `ui`; this feature is `standard`. The binding sources were still opened, as inputs for the C657 greps and the Coverage authority: ROADMAP.md lines 59-69 ("Asset import pipeline" steps 5-6) and lines 105-110 (Phase 2 item 4), and STATE.md AD-003, AD-004, AD-015, AD-023, AD-028 to AD-030 and AD-038 to AD-050. No check contradicts any of them.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 2 item 4, pipeline steps 5-6 | yes - `ROADMAP.md:68-69`, `:110` | none | - |
| STATE.md AD-003/004/015/023/028-030/038-050 | yes - `.specs/STATE.md:9-56` | none | - |
| `.specs/features/import-extract/plan.md` | yes (status set, `matchAssetType`, `normalized`) | none | - |

## Checks

Verified at 9091a31.

**Vitest proofs** ran in one invocation from `web/`:
`npx vitest run components/imports domain/imports infrastructure/supabase "app/(app)" composition -t "C601:|C602:|…|C658:" --reporter=verbose`. The filter is an alternation of every id from C601 to C658. It exited 0 with **135 passed**, 391 skipped and 0 failed. Every passing test was listed individually. Per id: C601 7, C602 1, C603 1, C604 11 (10 pager + 1 view), C605 1, C606 1, C607 9, C608 6, C609 1, C610 6, C611 3, C612 4, C613 1, C614 1, C615 2, C616 1, C617 1, C618 5, C619 1, C620 2, C621 3, C622 1, C623 2, C624 1, C625 4, C626 1, C628 2, C629 1, C630 1, C631 1, C632 1, C634 2, C635 2, C636 6, C638 1, C639 4, C640 6, C641 1, C642 1, C646 6, C647 15, C648 6, C649 1, C652 1. Every vitest-proved check has at least one hit, and every test file is new in `caa104f..HEAD`.

**Other proofs**, all run at 9091a31:

- `npm run test:db` (no argument): `14 passed, 0 failed`, including `PASS import_review`. Each recipe rolls back. `supabase/tests/import_review.sql` raises on any failing `tests.ok`, `expect_error` or `expect_rows`, so a PASS means every labelled assertion held.
- `npm test`: 50 files, 1,028 passed. `npm run lint`: exit 0.
- `npx next build`: exit 0. It ran in the scratch worktree at 9091a31.
- Shell greps: SERVICE_ROLE `0`; review route files `2`; migration file `1`; types grep `17`; AD rows `6`; CONTEXT `2`; ROADMAP `1`.

Paths below are repo-relative. `RT` = `web/components/imports/review.test.ts`, `DT` = `web/domain/imports/review.test.ts`, `AT` = `web/app/(app)/import-review.test.ts`, `IT` = `web/infrastructure/supabase/import-review.test.ts`, `SQ` = `supabase/tests/import_review.sql`. The evidence column also gives the full path for each citation.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C601 | "Review rows" link for extracted/committed only, both roles, 7 statuses | vitest, 7 passed | `web/components/imports/review.test.ts:92` `expect(html.includes(\`href="/imports/${JOB}"\`) && html.includes("Review rows")).toBe(shown)` over writer and viewer | PASS |
| C602 | rows in position order with every column | vitest, 1 | `web/components/imports/review.test.ts:112` `toEqual([1, 2, 3])`; `:114` `"Rooftop Unit (RTU)"`; `:116` `"Needs a type"`; `:117` Low/Medium/High/source; `:118` `toMatch(/In file\s+-/)` | PASS |
| C603 | counts line, filter links, attention rows | vitest, 1 | `web/components/imports/review.test.ts:130` `"5 rows · 4 included · 2 need attention"`; `:131-132` hrefs; `:133` `toEqual([2, 3])` | PASS |
| C604 | pager over 9 cases; links keep `show=attention` | vitest, 11 | `web/domain/imports/review.test.ts:42` `expect(pageOf(total, raw)).toEqual(expected)` over `:31-40`; `web/components/imports/review.test.ts:140` `"Rows 1-100 of 120"`, `:144-145` rows 101-120, `:147` no Next/Previous, `:149` `?show=attention&amp;page=2` | PASS |
| C605 | attention empty -> "Every row is ready to add." | vitest, 1 | `web/components/imports/review.test.ts:154-155` | PASS |
| C606 | 0 rows -> message, no commit button | vitest, 1 | `web/components/imports/review.test.ts:160` message; `:161` `not.toMatch(/Add \d+ asset/)` | PASS |
| C607 | 404 for malformed/null; /login; reader null for 5 statuses without reading rows | vitest, 9 | `web/app/(app)/import-review.test.ts:82-83` `rejects.toThrow("NEXT_NOT_FOUND")`, `reviewImport not.toHaveBeenCalled()`; `:88`; `:93` `"NEXT_REDIRECT /login"`; `web/infrastructure/supabase/import-review.test.ts:51-52`, `:57-58` `toBeNull()`, no `import_rows` call | PASS |
| C608 | `.range()` pages of 1,000 for 4 sizes; view "2,000 rows" | vitest, 6 | `web/infrastructure/supabase/import-review.test.ts:73` `toHaveLength(total)`, `:75` ranges `toEqual(...)`, `:76` order by position; `web/components/imports/review.test.ts:165` `"2,000 rows"` | PASS |
| C609 | untyped -> needs type; clean -> none | vitest, 1 | `web/domain/imports/review.test.ts:51-52` | PASS |
| C610 | 6 length edges | vitest, 6 | `web/domain/imports/review.test.ts:64` `toEqual(field ? [{ kind: "too_long", field }] : [])` over `:56-61` | PASS |
| C611 | low -> check; medium, high none | vitest, 3 | `web/domain/imports/review.test.ts:73` over `:68-70` | PASS |
| C612 | duplicates within the job, 4 cases | vitest, 4 | `web/domain/imports/review.test.ts:81-83`, `:90-91`, `:99-100`, `:106` | PASS |
| C613 | on site by type + normalized unit | vitest, 1 | `web/domain/imports/review.test.ts:113-114` | PASS |
| C614 | null unit never a duplicate | vitest, 1 | `web/domain/imports/review.test.ts:121-122` | PASS |
| C615 | skipped row: no flag; "Skipped" label and dimmed fields | vitest, 2 passed | flagger half settled: `web/domain/imports/review.test.ts:127`. Dimmed half NOT settled: `web/components/imports/review.test.ts:170` matches `text-ink-2`, which every cell label span carries (`web/components/imports/review-view.tsx:55`); fault 2 survived | FAIL |
| C616 | row editor fields, selected type, Save/Cancel | vitest, 1 | `web/components/imports/review.test.ts:247-253` | PASS |
| C617 | trimmed update, saved, refresh once | vitest, 1 | `web/app/(app)/import-review.test.ts:101-104` `toHaveBeenCalledWith(ROW, { assetTypeId: RTU, unitNo: "RTU-1", typeModel: "Carrier", location: null })` | PASS |
| C618 | 4 invalid edits refused before store; errors under fields | vitest, 5 | `web/app/(app)/import-review.test.ts:114-117`; `web/components/imports/review.test.ts:258-259` | PASS |
| C619 | each write sends only its own columns | vitest, 1 | `web/infrastructure/supabase/import-review.test.ts:118-123`; mapType's `{ asset_type_id }` at `:142` | PASS |
| C620 | spelling list, 2 entries; view renders count and select | vitest, 2 | `web/domain/imports/review.test.ts:143`; `web/components/imports/review.test.ts:177-179` | PASS |
| C621 | map by normalized text; invalid type; "Applied to 14 rows" | vitest, 3 | `web/app/(app)/import-review.test.ts:135-137`, `:141-142`; `web/components/imports/review.test.ts:265` | PASS |
| C622 | mapType ids, `asset_type_id is null` on read and update | vitest, 1 | `web/infrastructure/supabase/import-review.test.ts:138` `{ ok: true, rows: 3 }`, `:140`, `:143` `["id", ["w1", "w2", "w3"]]`, `:144` | PASS |
| C623 | skip/include; Skip and Include buttons | vitest, 2 | `web/app/(app)/import-review.test.ts:124-130`; `web/components/imports/review.test.ts:184-185` | PASS |
| C624 | enabled "Add 3 assets to Brookhaven" / "Add 1 asset" | vitest, 1 | `web/components/imports/review.test.ts:190-192` | PASS |
| C625 | disabled + fix line, 4 cases | vitest, 4 | `web/components/imports/review.test.ts:202-203` over `:196-199` | PASS |
| C626 | prompt idle vs confirming; only "Add assets" submits | vitest, 1 | `web/components/imports/review.test.ts:275-281` | PASS |
| C627 | RPC adds 2, links rows, commits job by uE | test:db PASS | `supabase/tests/import_review.sql:82-92` (`returns 2`, `site gains 2`, row assets, skipped row, job) | PASS |
| C628 | atomic commit; adapter unavailable + log; alert copy | test:db PASS; vitest, 2 | `supabase/tests/import_review.sql:110-113`; `web/infrastructure/supabase/import-review.test.ts:199-200`; `web/components/imports/review.test.ts:285` | PASS |
| C629 | 23514 over 4 jobs; action incomplete 3 w/o commit | test:db PASS; vitest, 1 | `supabase/tests/import_review.sql:124-125`, `:131`; `web/app/(app)/import-review.test.ts:151-152` | PASS |
| C630 | all skipped / 0 rows refused; action nothing_to_add | test:db PASS; vitest, 1 | `supabase/tests/import_review.sql:128-129`; `web/app/(app)/import-review.test.ts:158-160` | PASS |
| C631 | second RPC 40001, no new asset; adapter stored result | test:db PASS; vitest, 1 | `supabase/tests/import_review.sql:99-100`; `web/infrastructure/supabase/import-review.test.ts:205` | PASS |
| C632 | result line 3 forms + "View Brookhaven" | vitest, 1 | `web/components/imports/review.test.ts:213-214` over `:208-210` | PASS |
| C633 | deleting an imported asset nulls the link, keeps the row and count | test:db PASS | `supabase/tests/import_review.sql:138-142` | PASS |
| C634 | committed: Added/Skipped, no controls | vitest, 2 | `web/components/imports/review.test.ts:220-222`, `:229-230` | PASS |
| C635 | neutral "Added to site" pill, line, no Discard; forSite mapping | vitest, 2 | `web/components/imports/review.test.ts:98-100`; `web/infrastructure/supabase/import-review.test.ts:225` | PASS |
| C636 | 55000 -> locked; discard of committed locked; actions; copy | vitest, 6 | `web/infrastructure/supabase/import-review.test.ts:157`, `:213-215`; `web/app/(app)/import-review.test.ts:187-190`; `web/components/imports/review.test.ts:289-291` | PASS |
| C637 | trigger 6 cases, definer, search_path | test:db PASS | `supabase/tests/import_review.sql:147-156`, `:162-163` | PASS |
| C638 | viewer: rows and flags, no control | vitest, 1 passed | `web/components/imports/review.test.ts:235` rows, `:237` no control. Flags NOT settled: `:236` `>Needs a type<` is also rendered by the type cell (`web/components/imports/review-view.tsx:157`) | FAIL |
| C639 | viewer forbidden x4, nothing called; SQL 42501, 0 rows | vitest, 4; test:db PASS | `web/app/(app)/import-review.test.ts:173-174`; `supabase/tests/import_review.sql:169-171` | PASS |
| C640 | not_found for malformed ids; store not_found when the update returns no row; P0002; other org | vitest, 6; test:db PASS | Actions `web/app/(app)/import-review.test.ts:178-179`; update/setSkipped `web/infrastructure/supabase/import-review.test.ts:163-164`; SQL `supabase/tests/import_review.sql:178-180`. **mapType claim false**: `web/infrastructure/supabase/import-review.ts:131-143` returns `{ ok: true, rows: 0 }` on an empty update; the test at `:169` uses `23503` instead. The `commit` `P0002` mapping (C646 case) passes | FAIL |
| C641 | one request client; no SERVICE_ROLE | vitest, 1; grep `0` | `web/composition/composition.test.ts:186-190`; read directly at `web/composition/index.ts:67-68`, `:103-107` | PASS |
| C642 | action takes jobId only; RPC pronargs 1; site from job | vitest, 1; test:db PASS | `web/app/(app)/import-review.test.ts:164-166`; `supabase/tests/import_review.sql:199`, `:85`; migration `supabase/migrations/20261027162030_import_review.sql:97`, `:120` (`v_site` from the job) | PASS |
| C643 | door 1 constraints, each labelled | test:db PASS | `supabase/tests/import_review.sql:208-220` | PASS |
| C644 | door 2 checks, each labelled | test:db PASS | `supabase/tests/import_review.sql:230-234` | PASS |
| C645 | 40001 on parsed/extracting/uploaded; P0002; invoker; no anon | test:db PASS | `supabase/tests/import_review.sql:187-190`, `:196-198` | PASS |
| C646 | commit mapping, 7 cases; only `p_job_id` | vitest, 6 (+C628 for the 7th) | `web/infrastructure/supabase/import-review.test.ts:191-193` over `:182-187`; other code `:199-200` | PASS |
| C647 | each action passes the store's answer; refresh only on success | vitest, 15 | `web/app/(app)/import-review.test.ts:198-200`, `:205-206`, `:213-216`, `:228-229`, `:235-236` | PASS |
| C648 | 6 alert copies in role=alert | vitest, 6 | `web/components/imports/review.test.ts:308` over `:295-300` | PASS |
| C649 | ports declare the review ports and `committed` | vitest, 1 | `web/composition/composition.test.ts:196-201` | PASS |
| C650 | route flat by job id | shell `2` | `web/app/(app)/imports/[jobId]/page.tsx:54`, `web/app/(app)/imports/[jobId]/loading.tsx:3` | PASS |
| C651 | migration file; types contain the new names | shell `1`, `17` | `supabase/migrations/20261027162030_import_review.sql:76`; `web/infrastructure/supabase/database.types.ts` grep 17 | PASS |
| C652 | container returns the 5 functions | vitest, 1 | `web/composition/composition.test.ts:180` | PASS |
| C653 | test:db all 14 incl. import_review | `npm run test:db` `14 passed, 0 failed` | `web/scripts/test-db/runner.mts:42` `plain("import_review")`; `web/scripts/test-db/runner.test.ts:120` `toBe(14)` | PASS |
| C654 | whole suite and lint | `npm test` 1,028 passed; lint exit 0 | `web/scripts/test-db/runner.test.ts:129` (one of 1,028) | PASS |
| C655 | next build exits 0 | `npx next build` exit 0 (scratch worktree) | route compiled from `web/app/(app)/imports/[jobId]/page.tsx:54` | PASS |
| C656 | advisors at the two accepted findings | not re-run (MCP-only) | author's Handoff `.specs/features/import-review/checks.md:524` records exactly the two | not re-run - author evidence says PASS |
| C657 | AD-045..050 active; CONTEXT; ROADMAP ticked | shell `6`, `2`, `1` | `.specs/STATE.md:51-56`; `CONTEXT.md:83`; `ROADMAP.md:110` | PASS |
| C658 | live end-to-end run and cleanup | not re-run (live, shared signed-in session) | author's Handoff `.specs/features/import-review/checks.md:525-532`; the cleanup was **not done** (`:532`) | not re-run - author evidence: run PASS, cleanup outstanding |

## Coverage

Recomputed at 9091a31 from the authority over each set. Plan `Surface` gives the action states, the migration the statuses and checks, the ACs the copy, and `web/domain/imports/index.ts:218-237` the flag branches.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| page `GET /imports/[jobId]` (3) | plan Surface; `page.tsx:19-24` | 200 C602/C603 · 404 C607 (`AT:82`, `:88`) · /login C607 (`AT:93`) | - |
| `updateImportRowAction` (6) | plan Surface; `import-actions.ts` | saved C617 · invalid C618 · locked C636/C647 · forbidden C639/C647 · not_found C640 (malformed `AT:178`; store `IT:163`) · unavailable C647 | - |
| `skipImportRowAction` (5) | plan Surface | saved C623 · locked C636 · forbidden C639 · not_found C640 (`IT:164`) · unavailable C647 | - |
| `mapImportTypeAction` (6) | plan Surface + AC 40 | mapped C621 · invalid C621 · locked C636 · forbidden C639 · unavailable C647 · not_found for a malformed id C640 (`AT:178`) | not_found for a well-formed missing or other-org job id: the code answers `mapped` 0 (`web/infrastructure/supabase/import-review.ts:131-143`) |
| `commitImportAction` (7) | plan Surface; `import-actions.ts` commit branches | committed C647 · incomplete C629/C647 · nothing_to_add C630 · not_ready C646/C647 · forbidden C639 · not_found C640 + C646 P0002 · unavailable C628/C647 | - |
| job statuses at the route (7) | migration status check `:28`; reader `REVIEWABLE` | 5 refused C607 (`IT:55-58`) · extracted C608 · committed C608 (`IT:85-92`) | - |
| statuses at the "Review rows" link (7) | migration `:28` | C601 over all 7 | - |
| flag kinds (7) | `flagRows` branches `index.ts:226-235` | needs type C609 · too long x3 C610 · check C611 · same as C612 · on site C613 | - |
| rendered flag copy (5, AC 9-13) | AC 9-13; `review-view.tsx:34-47` | "Needs a type" only via the type cell (`RT:116`, `:236`); "Same as row n", "Already on this site" only via author live C658 | `Too long: <field>` and `Check this row` have no positive assertion anywhere; no automated proof of any flag pill label |
| flag exceptions (3) | AC 14, 15, 12 | null unit C614 · skipped not flagged C615 (`DT:127`) · skipped not first C612 (`DT:99-100`) | - |
| skipped row presentation (2, AC 15) | AC 15; `review-view.tsx:151`, `:168` | "Skipped" label C615 (`RT:170`) | dimmed fields: the assertion matches label spans, fault 2 survived |
| length edges (6) | `LIMITS` `index.ts:205-209`; RPC `:104` | C610 over 6; SQL C629 over 3 | - |
| pager cases (9+1) | `pageOf` `index.ts:246-252` | C604 over 10 (`DT:31-40`) | - |
| reader page sizes (4) | `allPages` `import-review.ts:35-43` | C608 over 4 | - |
| RPC outcomes (5) | migration raises `:91`, `:94`, `:99`, `:106`, `:109` + success | ok C627 · P0002 C640/C645 · 42501 C639 · 40001 C631/C645 · 23514 C629/C630 | - |
| commit refusals in SQL (6) | migration `:101-110` | null type, unit, model, location C629 · all skipped, no rows C630 | - |
| `commit` adapter mapping (7) | `imports.ts` `commit` branches | C646 x6 + C628 | - |
| trigger cases (6) | migration `:45-66` | C637 over 6; the asset_id-only update path via C633 | - |
| frozen row writes (4) | AC 36 | update, skip, map (`IT:147-157`), discard (`IT:210-215`) C636 · SQL C637 | - |
| commit button states (5) | `review-view.tsx:112-118` | enabled plural/singular C624 · disabled x3 C625 | - |
| result line forms (3) | `committedSummary` | C632 over 3 | - |
| alert copy (7) | `REVIEW_MESSAGES` `state.ts` | commit unavailable C628 · 6 others C648 | - |
| roles (3) | RLS + `writer()` | writer C617/C627 · viewer C638/C639 · other org C640 SQL | - |
| Landing doors (6 + 2b) | plan Landing | 1 C643 · 2 C644 (2b `SQ:232`) · 3 C645/C646 · 4 C637 · 5 C650 · 6 C649/C608 · all C657 | - |
| startup config: container (1) | `web/composition/index.ts:67-68`, `:103-107`, read directly | C641, C652 | - |

## Test policy

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | migration RPC and trigger; `web/infrastructure/supabase/import-review.ts`; `commit` in `web/infrastructure/supabase/imports.ts` | boundary SQL C627-C645 · own layer stubs C607, C608, C619, C622, C636, C640, C646 | no - `mapType`'s `not_found` row of its decision table (AC 40) has no case, and the code contradicts it (C640) |
| Decides, not reached across a boundary | `web/domain/imports/index.ts` (flagger, pager, spellings); `web/components/imports/review-view.tsx` control rules | one asserted case per decision row | no - flagger, pager and spellings are met (fault 1 killed), but the view's skipped-dim rule (fault 2 survived), its flag labels and the viewer's flags (C638) have no asserting case |
| Entry point, validation only | `web/app/(app)/import-actions.ts` (four actions) | accepted, each rejected input, each error path | yes - C617, C618, C621, C623, C629, C630, C636, C639, C640, C647; fault 4 killed |
| Instrumentation | `web/composition/index.ts`, `CommitPrompt`, `DiscardPrompt` | covered by consumer | yes - C641, C652, C626, C636 |

## Faults injected

Verified at 9091a31.

- **Scratch.** `git worktree add --detach <scratchpad>/wt HEAD`, with its own `npm ci`. `npx next build` also ran there.
- **Per fault.** Each fault was applied alone with `sed` or a one-line Python replace, and the narrowest proof ran. The worktree was then reset with `git checkout -- .`. The tracked porcelain count was `0` after each reset.
- **SQL surface.** Not mutated. The SQL tests run against the live project's applied schema, and changing it is a write outside the rolled-back runner. The RPC, trigger and constraints are therefore not made to fail by this Verifier.
- **Probe (not a fault).** A temporary `zz-probe.test.ts` in the worktree showed `mapType` returning `{ ok: true, rows: 0 }`. It was deleted afterwards.
- **Real tree.** `git status --porcelain` was recorded before and compared with `diff` after. They were identical: ` M web/.env.example`, `?? .agents/skills/`, `?? .claude/skills/use-railway/`, `?? skills-lock.json`. The worktree was removed and pruned; `git worktree list` shows only the main tree.

| Mutation | Location | Killed |
| --- | --- | --- |
| length limit `>` -> `>=` | `web/domain/imports/index.ts:227` | yes - C610 3 failed |
| skipped row ink always `text-ink` (no dimming) | `web/components/imports/review-view.tsx:151` | no - survived: C615 passed, and the whole suite passed (1,028) |
| mapType update drops the re-applied `.is("asset_type_id", null)` | `web/infrastructure/supabase/import-review.ts:138` | yes - C622 failed |
| commit action's `incomplete` preflight removed | `web/app/(app)/import-actions.ts:137` | yes - C629 failed |
| committed result `skipped` forced to 0 | `web/infrastructure/supabase/imports.ts:59` | yes - C646 x2 and C631 failed |

## Swept re-read

Each `Swept` row that cites existing code was read against the code:

- validation: the limits 40/120/300 sit in `LIMITS` (`web/domain/imports/index.ts:205-209`) and in the RPC (`supabase/migrations/20261027162030_import_review.sql:104`); org-type checks are in `import-actions.ts` (`validateAsset` with the org's ids; `types.some`). Present.
- failure modes and dependency failure: `failure()` and `unavailable()` log with `console.error` (`web/infrastructure/supabase/import-review.ts:21-32`). Present.
- idempotency: `commit` re-reads on `40001` (`web/infrastructure/supabase/imports.ts:231-234`). Present. C622's claim that "a mapping re-applied finds no untyped row" holds, but it answers `mapped` 0, which is the C640 gap.
- authorization: `writer()` comes before every action; the RPC role check is at migration `:93`. Present.
- concurrency: `for update` at migration `:97`; the trigger reads `for share` at `:61`. Present.
- data lifecycle: `on delete set null (asset_id)` at migration `:11`; discard `neq("status", "committed")` at `web/infrastructure/supabase/imports.ts:128`. Present.

## Gate

Verified at 9091a31.

- Batched vitest proofs: 135 passed, 0 failed (391 skipped by the filter)
- `npm test`: 50 files, 1,028 passed, 0 failed
- `npm run lint`: exit 0
- `npm run test:db`: 14 passed, 0 failed
- `npx next build`: exit 0 (scratch worktree)
- `get_advisors` (C656) and live run (C658): not re-run by this Verifier. Accounted for from the author's Handoff (`checks.md:524-532`). The live data cleanup is recorded there as not done.

## Ranked gaps

1. C640 - `mapType` answers `{ ok: true, rows: 0 }` instead of `not_found` for an empty update or a missing or other-org job (AC 40) - `web/infrastructure/supabase/import-review.ts:131-143`; the test proves a `23503` path instead (`web/infrastructure/supabase/import-review.test.ts:167-169`).
2. C615 - the dimmed-row assertion matches the label spans; a surviving mutant - `web/components/imports/review.test.ts:170`.
3. C638 - the viewer-flags assertion is satisfied by the type cell - `web/components/imports/review.test.ts:236`.
4. AC 10-13 flag-label copy has no automated proof (precision gap in the checks) - `web/components/imports/review-view.tsx:34-47`.
5. Not a check failure: C658's production cleanup is still outstanding per the Handoff (`.specs/features/import-review/checks.md:532`).
