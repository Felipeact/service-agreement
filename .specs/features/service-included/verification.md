# Service included verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 05a934e..056701c (fix range for this round: c1ddbde..056701c)
**Round**: 3 - scoped
**Verifier**: independent sub-agent, round 3 (fresh context; author != verifier, built none of this feature or its fixes)

Round 2 (FAIL at `c1ddbde`) ranked two blocking gaps. The fix `056701c` closes both, and I re-ran each mutant at
`056701c`:

- **F7 is killed.** The C803 "takenAt not text" case now uses `2026`, which `Date.parse` accepts, and a second case
  uses `["2026-10-27"]`. With the `isText` check removed, both cases fail.
- **F11 is killed.** The asset-field case is now one case per field. With the `typeModel` check removed, the
  `type/model` case fails. I also removed the `unitNo` check (F12) and the `location` check (F13), and each was
  caught by its own case.
- **The stale comment is fixed.** `supabase/tests/service_included.sql:118` now names `First`.

The fix's code diff is two files: `web/domain/agreement/service-scope.test.ts` (+5 cases) and one comment line in
`supabase/tests/service_included.sql`. It also adds 5 lines to the end of the Build record in `checks.md` and commits
the round 2 report. No source file, migration, interface or check claim changed.

Every proof was re-run in full at `056701c`. Each section says whether it was `verified at 056701c`, or whether it is
`carried from c1ddbde` (round 2) or `carried from e9edb78` (round 1).

## Binding sources

Carried from e9edb78. The profile is `standard`, so step 1 does not run. The fix touched no interface, plan or binding
source.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 3 item 2 (`:114`), M6 (`:30`), M7 (`:31`) | yes (round 1) | - | - |
| PRODUCT.md "Agreement anatomy" (`:35`) | yes (round 1) | - | - |
| STATE.md AD-005, AD-015, AD-016, AD-017, AD-023, AD-030, AD-050, AD-055 | yes (round 1) | - | - |
| STATE.md AD-058 to AD-062 (`:64-68`) | yes (round 1); C831 grep re-run at 056701c prints `5` | - | - |

## Checks

Results verified at 056701c.

**Citations.** I refreshed the citations in the two files the fix touched:
- `web/domain/agreement/service-scope.test.ts`: the rejection rows are now `:29-45` (17 rows), and the assertion moved
  to `:47`. The render-order lines `:17-19` did not move.
- `supabase/tests/service_included.sql`: the fix replaced one comment line with one line, so no line number moved.

`checks.md` gained lines only after `:330`, so its earlier citations hold. Citations in every other file are carried
from c1ddbde or e9edb78, as marked in the rows. None of those files changed in the fix range.

**Proof runs at 056701c:**

- **vitest, one invocation** from `web/`:
  `npx vitest run domain/agreement infrastructure/supabase components/agreements "app/(app)" scripts/test-db -t "C8" --reporter=verbose`.
  It exited 0 with 36 passed. 33 of them are C8xx names, each listed individually in the output:
  - C803: 19 (2 ordering, 17 rejections)
  - C804: 6
  - C805, C806, C807, C815, C816, C818: 1 each
  - C824: 1
  - C830: 1

  The other 3 are earlier features' `C8:` tests that the filter also matched (`agreement.test.ts` x2,
  `auth.test.ts` x1).
- **test:db.** `npm run test:db` passed all 16 recipes, including `rls_roles`, `service_included` and `demo_seed`
  (`16 passed, 0 failed`). Every labelled SQL assertion raises on failure, so a PASS line means each one ran and held.
- **MCP.** No MCP call this round. The MCP-backed rows (C820, C825, C826, C827) are carried from c1ddbde. The fix
  touched no migration, type file or database object, and I was told to write nothing to the database.

**Paths.** TS paths are relative to `web/`. "SQL" means `supabase/tests/service_included.sql`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C801 | scope doc shape: keys, schema 1, no takenAt, 2 types, tasks in position order, BOILER `[]`, nulls kept, 2+1 assets | test:db PASS at 056701c | `supabase/tests/service_included.sql:88` top keys `= array['schema','types']`; `:90` schema `1`; `:91` `not doc ? 'takenAt'`; `:92` 2 types; `:100` RTU tasks; `:102` BOILER `'[]'`; `:103` counts; `:110` JSON `null`; `:129-131` `C801 position order` `= '["First", "Second"]'::jsonb` (fixture `:122-124`; the comment at `:118` now names `First`) | PASS |
| C802 | no other-site type, no type without assets, other org gives empty doc | test:db PASS | `supabase/tests/service_included.sql:136` `C802 codes`; `:140` `C802 other org` `= '{"schema": 1, "types": []}'` | PASS |
| C803 | parser render order + rejections | vitest `C803:` 19 pass | `web/domain/agreement/service-scope.test.ts:17` `toEqual(["AHU", "boiler", "Unit heater (gas)"])`; `:18` `toEqual(["rtu-1", "RTU-2", "RTU-10", null])`; `:19` tasks as stored; `:47` `expect(parseServiceScope(document)).toBeNull()` over the 17 rows `:29-45`, covering the 7 named inputs (`:29-35`) and 10 more | PASS |
| C804 | reader source, 6 cases | vitest `C804:` 6 pass | carried from e9edb78: `web/infrastructure/supabase/agreements.test.ts:293-295`, `:309`, `:311`, `:318-319`, `:330-331`, `:337` | PASS |
| C805 | live view: order, counts, tasks, closed `<details>`, `—` | vitest `C805:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:236-247` | PASS |
| C806 | no-tasks copy | vitest `C806:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:252` | PASS |
| C807 | live empty; writer link `/sites/s1`; viewer none | vitest `C807:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:257-261` | PASS |
| C808 | live scope follows asset insert / task update / asset delete | test:db PASS | `supabase/tests/service_included.sql:151`, `:162`, `:168` | PASS |
| C809 | `site_service_scope` and `snapshot` only in the reader adapter | both greps printed `1` at 056701c | carried from e9edb78: `web/infrastructure/supabase/agreements.ts:57`, `:62` | PASS |
| C810 | send freezes v2 = scope, takenAt = now(), v1 `{}`, event | test:db PASS | `supabase/tests/service_included.sql:180`, `:182`, `:183`, `:184` | PASS |
| C811 | withdraw from draft freezes | test:db PASS | `supabase/tests/service_included.sql:196`, `:198` | PASS |
| C812 | 6 non-draft transitions write nothing new; revise copies | test:db PASS | `supabase/tests/service_included.sql:212`, `:216`, `:217` | PASS |
| C813 | 40001 / 42501 / P0002 write nothing | test:db PASS | `supabase/tests/service_included.sql:226-228`, `:230`, `:236`, `:241` | PASS |
| C814 | frozen snapshot unchanged after insert / task update / delete | test:db PASS | `supabase/tests/service_included.sql:252` `C814 kept` | PASS |
| C815 | frozen view: `As recorded on <date>`, no Add equipment | vitest `C815:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:266`, `:269` | PASS |
| C816 | not_recorded copy both | vitest `C816:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:274-276` | PASS |
| C817 | uE/uA/uV update 42501; no update grant; insert kept | test:db PASS | `supabase/tests/service_included.sql:261`, `:265`, `:267` | PASS |
| C818 | frozen empty copy both | vitest `C818:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:282`, `:284` | PASS |
| C819 | freeze fn definer, search_path, anon/viewer 42501, nothing written; one caller | test:db PASS; grep printed `2` at 056701c | `supabase/tests/service_included.sql:276`, `:277`, `:281`, `:286`, `:291`; `supabase/migrations/20261027212052_service_included.sql:100` (carried) | PASS |
| C820 | live backfill: 0 frozen `{}`, editable unchanged | carried from c1ddbde (MCP `execute_sql` select: `frozen_still_empty` 0, `frozen_with_scope` 10, `editable_empty` 4) | `supabase/migrations/20261027212052_service_included.sql:131-137`; `.specs/features/service-included/checks.md:302` | PASS |
| C821 | seed: frozen schema 1, 2 drafts `{}`, re-run leaves snapshots alone, guard holds | test:db demo_seed PASS at 056701c | carried from c1ddbde: `supabase/tests/demo_seed.sql:145`, `:151`, `:160-161`; `supabase/tests/demo_seed_rerun.sql:20-22`, `:24-26` | PASS |
| C822 | live at 1440/768/375 | not re-run (round 1 instruction); judged from the record and the code | carried from e9edb78: `.specs/features/service-included/checks.md:315`; `web/components/agreements/service-scope.tsx:78`, `:36`. Rests on the builder's evidence | PASS |
| C823 | anon 42501; authenticated execute; invoker, stable, search_path | test:db PASS | `supabase/tests/service_included.sql:298-301`, `:303`, `:309-310` | PASS |
| C824 | port member; page passes the scope through | vitest `C824:` pass; tsc exit 0 at 056701c | carried from e9edb78: `web/application/ports/index.ts:416`; `web/app/(app)/agreements.test.ts:273-274` | PASS |
| C825 | file version = list_migrations | carried from c1ddbde (MCP `list_migrations`: last entry `20261027212052 service_included`); the fix adds no migration | `supabase/migrations/20261027212052_service_included.sql:1` | PASS |
| C826 | types equal the generator | carried from e9edb78 (`database.types.ts` untouched in every fix range) | `web/infrastructure/supabase/database.types.ts:873`; `.specs/features/service-included/checks.md:305` | PASS |
| C827 | advisors exactly the two accepted | carried from c1ddbde (MCP `get_advisors` security: `rls_enabled_no_policy` on `public.outbox`, `auth_leaked_password_protection`); the fix changes no database object | `.specs/features/service-included/checks.md:306` | PASS |
| C828 | all 16 recipes pass | `npm run test:db` at 056701c: `16 passed, 0 failed` | `web/scripts/test-db/runner.mts:44`; carried from c1ddbde: `supabase/tests/rls_roles.sql:49`, `:56-57` | PASS |
| C829 | tsc, lint, next build exit 0; npm test passes | at 056701c: `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm test` 55 files, 1260 passed. `next build` carried from c1ddbde: round 2's verifier ran it in a scratch worktree, and it exited 0. The fix changes only a test file and a SQL comment, neither of which is in the build graph. I did not run it this round, so the dev server on :3000 was not touched | `.specs/features/service-included/checks.md:325`; `web/scripts/test-db/runner.test.ts:99` | PASS |
| C830 | 16 recipes, 18 files, plain | vitest `C830:` pass | carried from e9edb78: `web/scripts/test-db/runner.test.ts:99-102` | PASS |
| C831 | docs | greps printed `2`, `1`, `5` at 056701c | carried from e9edb78: `CONTEXT.md:207`, `ROADMAP.md:114`, `.specs/STATE.md:64-68` | PASS |
| C832 | frozen doc text-equals live doc | test:db PASS | `supabase/tests/service_included.sql:186` `C832 same document` | PASS |

## Coverage

The parser rejections row is verified at 056701c, because the fix changed its proof. Every other row is carried from
c1ddbde, and the fix touched neither its authority nor its proof.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| RPC `site_service_scope` statuses (2) | carried from e9edb78 | 200 C801/C802 · 401 anon C823 `:309` | - |
| scope doc keys (9 + takenAt) | carried from e9edb78 | C801 `:88-110`, takenAt absent `:91`, present frozen C810 `:182` | - |
| rows excluded (3) | carried from e9edb78 | C802 `:136`, `:140` | - |
| task order within a type (1 rule) | carried from c1ddbde | C801 position order `:129-131` (M6 killed by reading) | - |
| parser rejections (verified at 056701c; 15 branches in `web/domain/agreement/index.ts:143-166`) | parser code, 15 branches. Document level: not a record, schema not 1, types not a list. takenAt: not text, not a time. Type: not a record, code, name, tasks not a list, a task not text, assets not a list. Asset: not a record, `unitNo`, `typeModel`, `location` each not text-or-null | **Killed by a C803 run at 056701c:** takenAt not text (F7, `:37-38`), `typeModel` (F11, `:43`), `unitNo` (F12, `:42`), `location` (F13, `:44`). **Killed by a C803 run at c1ddbde:** takenAt not a time (F6), code (F8), tasks not a list (F9), field missing (F10). **Settled by reading:** schema `:30`, types `:31-32`, name `:33`, task `:34`, assets not a list `:41`. **The three `isRecord` guards (document, type, asset):** each is held by the type checker, see F14. Without the guard, a non-record input is refused anyway by the next field check, so `:35` and `:29` pass either way | - |
| render order (2 rules) | carried from e9edb78 | C803 `:17-18` | - |
| reader cases (6) | carried from e9edb78 | C804, all 6 | - |
| view states (7) | carried from e9edb78 | C805 · C806 · C807 · C815 · C816 · C818 | - |
| transitions from draft (2) / not from draft (6) / refused (3) | carried from e9edb78 | C810, C811 · C812 x6 · C813 x3 | - |
| changes after freeze (3) / while live (3) | carried from e9edb78 | C814 x3 / C808 x3 | - |
| member writes on `agreement_versions` | carried from c1ddbde | update refused C817 `:261`, `:265` · viewer delete 0 rows `rls_roles.sql:56-57` · insert kept C817 `:267` | - |
| backfill places (2) + guard | carried from c1ddbde | C820 (MCP) · C821 `demo_seed.sql:145-154` · guard `demo_seed_rerun.sql:24-26` (M7 killed by reading) | - |
| widths (3) | carried from e9edb78 | C822 (builder record only) | - |
| Landing doors (5) | carried from e9edb78 | 1 C801/C803/C832 · 2 C801/C802/C808/C823 · 3 C810-C813/C817/C819 · 4 C804/C824 · 5 C820/C821 | - |
| container assembly (1) | carried from e9edb78 (`web/composition/index.ts:110`) | C804 + C824 | - |

## Test policy rows

Verified at 056701c: the row that was unmet in round 2, which also classifies the touched test file. The other two
rows are carried from c1ddbde, and the fix touched no file they classify.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `site_service_scope`, `freeze_agreement_version`, transition RPC; reader; seed backfill | own layer SQL + stub C804 · boundary C824 and RPCs run as each role | yes (carried from c1ddbde) |
| Decides, not across a boundary | `parseServiceScope` (`web/domain/agreement/index.ts`), view state table | own layer, one asserted case per row of the decision table | yes - every parser branch now has a case that discriminates it. The two branches that lacked one in round 2 (takenAt not text, `typeModel`) are killed at 056701c by F7 and F11. The view state rows are carried from e9edb78 |
| Instrumentation | page pass-through, container | none of its own; C824 | yes (carried from e9edb78) |

## Faults injected

Faults F7 and F11 to F14 are verified at 056701c.

**Method.** I edited `web/domain/agreement/index.ts` in the real tree with `sed`, one fault at a time, as the brief
directed. After each fault I ran `npx vitest run domain/agreement -t "C803"` from `web/`, then restored the file with
`git checkout -- web/domain/agreement/index.ts`. `git status --porcelain` was empty before the first fault and after
every restore. There was no `git stash` and no worktree.

The four requested faults are F7 and F11 to F13. I added F14 because the recomputed parser-rejections row has one
branch that no C803 row exercises.

**Carried.** F1-F5 (e9edb78), F6 and F8-F10, and M6, M7 and the viewer-delete mutant (c1ddbde) are all on surfaces
the fix did not touch.

| Mutation | Location | Proof run | Killed |
| --- | --- | --- | --- |
| F7 takenAt `isText` check removed (`Date.parse` kept) | `web/domain/agreement/index.ts:164` | 2 failed: `a takenAt that is not text, though Date.parse would read it`, `a takenAt that is a list` | yes |
| F11 `!isOptionalText(value.typeModel)` removed | `web/domain/agreement/index.ts:143` | 1 failed: `a type/model that is neither text nor null` | yes |
| F12 `!isOptionalText(value.unitNo)` removed | `web/domain/agreement/index.ts:143` | 1 failed: `a unit # that is neither text nor null` | yes |
| F13 `!isOptionalText(value.location)` removed | `web/domain/agreement/index.ts:143` | 2 failed: `a location that is neither text nor null`, `an asset with a field missing` | yes |
| F14 `!isRecord(document)` removed from the document check | `web/domain/agreement/index.ts:161` | `-t "C803\|C804"`: 25 passed. `npx tsc --noEmit` exits 2 with `TS18046: 'document' is of type 'unknown'` at `:161` and `:163-164`. On any input the code can type-check with, the mutant is equivalent: a non-record has no `schema` of `1`. It differs only in throwing on `null`, and the reader never passes `null`: `isPlaceholder` filters it at `agreements.ts:64`, and the RPC returns a document | yes (by `tsc --noEmit`, a C829 proof) |
| F6, F8, F9, F10 (round 2) | `web/domain/agreement/index.ts:164`, `:148`, `:149`, `:140` | carried from c1ddbde | yes (carried) |
| M6, M7, viewer delete (round 2) | migration `:17`, `seed.sql:169`, init `:312` | carried from c1ddbde (assessed by reading) | yes (carried) |
| F1-F5 (round 1) | parser sort, reader, view, runner | carried from e9edb78 | yes (carried) |

## Swept

Carried from c1ddbde. The fix range does not touch any constraint a `Swept existing` row cites.

## Notes outside the checks

- **C803's count is still 7 in `checks.md`.** The C803 claim (`checks.md:59`) and the coverage row "parser
  rejections (7)" (`:243`) still say 7 inputs, while the test has 17. The author recorded this as a deliberate
  choice at `checks.md:335`: the claim names 7 inputs, and the test is a superset of them. The 7 named inputs are each
  a row at `service-scope.test.ts:29-35`, so the claim is proven as written. This is a precision note on the checks
  and does not block.
- **C822 rests on the builder's record.** This is carried from round 1, and no browser was opened in any round.
- **Writers keep `delete` on `agreement_versions`.** This is carried from round 1. It is pre-existing, and the Build
  record leaves it for a hardening pass (`checks.md:330`).
- **The fix commit also committed the round 2 report.** `056701c` contains the round 2 `verification.md`, which this
  file replaces. Its content matched round 2's findings, so this is noted only for provenance.

## Gate

At 056701c, unless marked as carried:

- `npx vitest run ... -t "C8" --reporter=verbose`: 36 passed (33 C8xx), 0 failed
- `npm test`: 55 files, 1260 passed, 0 failed
- `npm run test:db`: 16 passed, 0 failed
- `npx tsc --noEmit`: exit 0
- `npm run lint`: exit 0
- Greps: C809 `1`/`1`, C819 `2`, C831 `2`/`1`/`5`
- `npx next build`: carried from c1ddbde (exit 0)
- MCP: carried from c1ddbde
- Faults: 5 injected this round, 5 killed (4 by C803, 1 by tsc). The real tree's porcelain was empty after each
  restore

## Ranked gaps

None blocking. Non-blocking:

1. Update C803's "7 inputs" and the "parser rejections (7)" coverage row in `checks.md`, or leave them as the author
   chose.
2. C822 is proven only by the builder's record of the three widths.
