# Service included verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 05a934e..c1ddbde (fix range for this round: e9edb78..c1ddbde)
**Round**: 2 - scoped
**Verifier**: independent sub-agent, round 2 (fresh context; author != verifier, built none of this feature or its fixes)

Round 1 (FAIL at `e9edb78`) ranked five gaps. The fix (`8d52c31`, recorded in `c1ddbde`) closes four of them:

- **M6 is killed (assessed by reading).** `C801 position order` uses tasks whose creation order and id order are both
  the reverse of their positions.
- **M7 is killed (assessed by reading).** `C821 guard` pins a 2026-01-01 `takenAt` on demo version 4 (AG-1039, sent)
  between the two seed runs.
- **The viewer delete on `agreement_versions` is asserted again** (`C12 delete agreement_versions`).
- **C829 is proven.** I ran `npx next build` myself in a scratch worktree at `c1ddbde`, and it exited 0.

The verdict is still FAIL, for one reason on a surface the fix created. **Two of the 7 new C803 rejection rows do
not discriminate the branch they are named for.** Both mutants survived a real run:

- **F7.** Dropping the `isText` check on `takenAt` survives, because the fixture `1730000000` is also rejected by
  `Date.parse` (it gives `NaN`). A numeric `takenAt` such as `2026` (`Date.parse` gives `1767225600000`) would then be
  accepted and handed on as if it were a string.
- **F11.** Dropping the `typeModel` check survives, because both asset rows set `typeModel: null`. Only `unitNo`
  (non-text) and `location` (missing) are exercised.

Every proof was re-run in full at `c1ddbde`. Sections say whether they were `verified at c1ddbde` or are
`carried from e9edb78`.

## Binding sources

Carried from e9edb78. The profile is `standard`, so step 1 does not run. The fix touched no interface, plan or binding
source; its diff is test files and spec text only.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 3 item 2 (`:114`), M6 (`:30`), M7 (`:31`) | yes (round 1) | - | - |
| PRODUCT.md "Agreement anatomy" (`:35`) | yes (round 1) | - | - |
| STATE.md AD-005, AD-015, AD-016, AD-017, AD-023, AD-030, AD-050, AD-055 | yes (round 1) | - | - |
| STATE.md AD-058 to AD-062 (`:64-68`) | yes (round 1); C831 grep re-run at c1ddbde prints `5` | - | - |

## Checks

Results verified at c1ddbde. Citations were refreshed in the files the fix touched:
- `supabase/tests/service_included.sql`: every line from `:118` on moved by +16.
- `supabase/tests/demo_seed.sql`, `supabase/tests/demo_seed_rerun.sql`, `supabase/tests/rls_roles.sql`.
- `web/domain/agreement/service-scope.test.ts`.

Citations in untouched files are carried from e9edb78; those files did not change in the fix range.

**Proof runs at c1ddbde:**

- **vitest, one invocation** from `web/`:
  `npx vitest run domain/agreement infrastructure/supabase components/agreements "app/(app)" scripts/test-db -t "C8" --reporter=verbose`.
  It exited 0 with 33 passed. 30 of them are C8xx names, each listed individually:
  - C803: 16 (2 ordering, 14 rejections)
  - C804: 6
  - C805, C806, C807, C815, C816, C818: 1 each
  - C824: 1
  - C830: 1

  The other 3 are earlier features' `C8:` tests that the filter also matched (`agreement.test.ts` x2,
  `auth.test.ts` x1).
- **test:db.** `npm run test:db` passed all 16 recipes, including `rls_roles`, `service_included` and `demo_seed`
  (`16 passed, 0 failed`). Every labelled SQL assertion raises on failure, so a PASS line means each one ran and held.
- **MCP, read-only, re-run by me:**
  - `list_migrations`
  - `get_advisors` (security)
  - `execute_sql` (a select)

  `generate_typescript_types` was not re-run. C826 is carried, and `database.types.ts` is untouched in the fix range.

**Paths.** TS paths are relative to `web/`. "SQL" means `supabase/tests/service_included.sql`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C801 | scope doc shape: keys, schema 1, no takenAt, 2 types, tasks in position order, BOILER `[]`, nulls kept, 2+1 assets | test:db PASS at c1ddbde | `supabase/tests/service_included.sql:88` top keys `= array['schema','types']`; `:90` schema `1`; `:91` `not doc ? 'takenAt'`; `:92` 2 types; `:100` RTU tasks `= '["Replace filters", "Check belts"]'`; `:102` BOILER `'[]'`; `:103` counts; `:110` JSON `null`; **new** `:129-131` `C801 position order` `(... -> 'tasks') = '["First", "Second"]'::jsonb`, where `:122-123` give `Second` position 2, id `0000…`, created `now()-2d`, and `First` position 1, id `ffff…`, created `now()-1d` | PASS |
| C802 | no other-site type, no type without assets, other org gives empty doc | test:db PASS | `supabase/tests/service_included.sql:136` `C802 codes` `= array['BOILER','RTU']`; `:140` `C802 other org` `= '{"schema": 1, "types": []}'` | PASS |
| C803 | parser render order + rejections | vitest `C803:` 16 pass | `web/domain/agreement/service-scope.test.ts:17` `toEqual(["AHU","boiler","Unit heater (gas)"])`; `:18` units natural, null last; `:19` tasks as stored; `:44` `expect(parseServiceScope(document)).toBeNull()` over the 14 rows `:29-42`. Weakness: the rows at `:37` (takenAt not text) and `:41` (asset field not text) do not discriminate their own branches (F7, F11) | PASS |
| C804 | reader source, 6 cases | vitest `C804:` 6 pass | carried from e9edb78: `web/infrastructure/supabase/agreements.test.ts:293-295`, `:309`, `:311`, `:318-319`, `:330-331`, `:337` (file untouched) | PASS |
| C805 | live view: order, counts, tasks, closed `<details>`, `—` | vitest `C805:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:236-247` | PASS |
| C806 | no-tasks copy | vitest `C806:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:252` | PASS |
| C807 | live empty; writer link `/sites/s1`; viewer none | vitest `C807:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:257-261` | PASS |
| C808 | live scope follows asset insert / task update / asset delete | test:db PASS | `supabase/tests/service_included.sql:151` `C808 asset added`; `:162` `C808 task updated`; `:168` `C808 asset deleted` | PASS |
| C809 | `site_service_scope` and `snapshot` only in the reader adapter | both greps printed `1` at c1ddbde | carried from e9edb78: `web/infrastructure/supabase/agreements.ts:57`, `:62` | PASS |
| C810 | send freezes v2 = scope, takenAt = now(), v1 `{}`, event | test:db PASS | `supabase/tests/service_included.sql:180` `C810 scope`; `:182` `C810 takenAt`; `:183` v1 kept; `:184` event | PASS |
| C811 | withdraw from draft freezes | test:db PASS | `supabase/tests/service_included.sql:196` `C811 scope`; `:198` `C811 takenAt` | PASS |
| C812 | 6 non-draft transitions write nothing new; revise copies | test:db PASS | `supabase/tests/service_included.sql:212` `'C812 ' \|\| ...` per transition; `:216` revised v1; `:217` revised v2 | PASS |
| C813 | 40001 / 42501 / P0002 write nothing | test:db PASS | `supabase/tests/service_included.sql:226-227` stale + kept; `:228`, `:230` missing + kept; `:236`, `:241` viewer + kept | PASS |
| C814 | frozen snapshot unchanged after insert / task update / delete | test:db PASS | `supabase/tests/service_included.sql:252` `C814 kept` | PASS |
| C815 | frozen view: `As recorded on <date>`, no Add equipment | vitest `C815:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:266`, `:269` | PASS |
| C816 | not_recorded copy both | vitest `C816:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:274-276` | PASS |
| C817 | uE/uA/uV update 42501; no update grant; insert kept | test:db PASS | `supabase/tests/service_included.sql:261` `'C817 ' \|\| role` `42501`; `:265` `not has_table_privilege(... 'update')`; `:267` insert kept | PASS |
| C818 | frozen empty copy both | vitest `C818:` pass | carried from e9edb78: `web/components/agreements/agreements.test.ts:282`, `:284` | PASS |
| C819 | freeze fn definer, search_path, anon/viewer 42501, nothing written; one caller | test:db PASS; grep printed `2` at c1ddbde | `supabase/tests/service_included.sql:276` `prosecdef`; `:277` `search_path=""`; `:281` anon; `:286` viewer; `:291` nothing written; `supabase/migrations/20261027212052_service_included.sql:100` the only call (carried) | PASS |
| C820 | live backfill: 0 frozen `{}`, editable unchanged | MCP `execute_sql` select re-run at c1ddbde: `frozen_still_empty` 0, `frozen_with_scope` 10, `editable_versions` 4, `editable_empty` 4, total 14 | `supabase/migrations/20261027212052_service_included.sql:131-137` (carried); `.specs/features/service-included/checks.md:302` | PASS |
| C821 | seed: frozen schema 1, 2 drafts `{}`, re-run leaves snapshots alone, guard holds | test:db demo_seed PASS | `supabase/tests/demo_seed.sql:145` `C821 frozen`; `:151` `C821 drafts live`; `:160-161` version 4 set to a scope with `takenAt` `2026-01-01T00:00:00+00:00` before the snapshot copy at `:164`; `supabase/tests/demo_seed_rerun.sql:20-22` `C821 rerun` text-equal; **new** `:24-26` `C821 guard` `snapshot ->> 'takenAt' = '2026-01-01T00:00:00+00:00'` | PASS |
| C822 | live at 1440/768/375 | not re-run (instructed); judged from the record and the code | carried from e9edb78: `.specs/features/service-included/checks.md:315`; `web/components/agreements/service-scope.tsx:78`, `:36`. Rests on the builder's evidence | PASS |
| C823 | anon 42501; authenticated execute; invoker, stable, search_path | test:db PASS | `supabase/tests/service_included.sql:298` `not prosecdef`; `:299` stable; `:300` search_path; `:301` authenticated; `:303` transition authenticated; `:309-310` anon `42501` | PASS |
| C824 | port member; page passes the scope through | vitest `C824:` pass; tsc exit 0 | carried from e9edb78: `web/application/ports/index.ts:416`; `web/app/(app)/agreements.test.ts:273-274` | PASS |
| C825 | file version = list_migrations | MCP `list_migrations` re-run: last entry `20261027212052 service_included` | `supabase/migrations/20261027212052_service_included.sql:1` | PASS |
| C826 | types equal the generator | carried from e9edb78 (generator not re-run; file untouched in the fix range) | `web/infrastructure/supabase/database.types.ts:873`. The Build record's "unchanged" wording is corrected at `.specs/features/service-included/checks.md:305` | PASS |
| C827 | advisors exactly the two accepted | MCP `get_advisors` security re-run: `rls_enabled_no_policy` (`public.outbox`) and `auth_leaked_password_protection`, nothing else | `.specs/features/service-included/checks.md:306` | PASS |
| C828 | all 16 recipes pass | `npm run test:db`: `16 passed, 0 failed` | `web/scripts/test-db/runner.mts:44`; `supabase/tests/rls_roles.sql:49` loop skips `agreement_versions`, and **new** `:56-57` `C12 delete agreement_versions` `expect_rows(..., 0)` | PASS |
| C829 | tsc, lint, next build exit 0; npm test passes | `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm test` 55 files, 1257 passed; `npx next build` **run by me** in a scratch worktree at `c1ddbde`, after its own `npm ci` with `.env.local` copied in: `Compiled successfully`, exit 0 (Next.js 16.4.2, Turbopack) | `.specs/features/service-included/checks.md:325` (the Build record of the `8d52c31` build agrees); `web/scripts/test-db/runner.test.ts:99` | PASS |
| C830 | 16 recipes, 18 files, plain | vitest `C830:` pass | carried from e9edb78: `web/scripts/test-db/runner.test.ts:99-102` | PASS |
| C831 | docs | greps printed `2`, `1`, `5` at c1ddbde | carried from e9edb78: `CONTEXT.md:207`, `ROADMAP.md:114`, `.specs/STATE.md:64-68` | PASS |
| C832 | frozen doc text-equals live doc | test:db PASS | `supabase/tests/service_included.sql:186` `C832 same document` | PASS |

## Coverage

These rows were recomputed at c1ddbde because the fix touched their authority or their proof:
- task order
- parser rejections
- member writes on `agreement_versions`
- backfill guard

Every other row is carried from e9edb78.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| RPC `site_service_scope` statuses (2) | carried from e9edb78 | 200 C801/C802 · 401 anon C823 `:309` | - |
| scope doc keys (9 + takenAt) | carried from e9edb78 | C801 `:88-110`, takenAt absent `:91`, present frozen C810 `:182` | - |
| rows excluded (3) | carried from e9edb78 | C802 `:136`, `:140` | - |
| task order within a type (1 rule) - verified at c1ddbde | door 1 + migration `:17` `order by k.position, k.created_at, k.id` | C801 position order `:129-131`: positions disagree with both creation order and id order, so only `position` gives `["First","Second"]` (M6 killed, assessed by reading) | - |
| parser rejections - verified at c1ddbde (14 branches in `web/domain/agreement/index.ts:142-176`) | parser code: document not a record, schema, types not a list, takenAt not text, takenAt not a time, type not a record, code, name, tasks not a list, task not text, assets not a list, asset not a record, unitNo / typeModel / location not text-or-null | each discriminated by a row at `service-scope.test.ts:29-42` (killed in F6, F8, F9, F10, or by reading) except the two named in the next column | takenAt not text (`:37`'s fixture is also refused by `Date.parse`; F7 survives) · typeModel not text-or-null (no row varies `typeModel`; F11 survives) |
| render order (2 rules) | carried from e9edb78 | C803 `:17-18` | - |
| reader cases (6) | carried from e9edb78 | C804, all 6 | - |
| view states (7) | carried from e9edb78 | C805 · C806 · C807 · C815 · C816 · C818 | - |
| transitions from draft (2) / not from draft (6) / refused (3) | carried from e9edb78 | C810, C811 · C812 x6 · C813 x3 | - |
| changes after freeze (3) / while live (3) | carried from e9edb78 | C814 x3 / C808 x3 | - |
| member writes on `agreement_versions` - verified at c1ddbde | grants (migration `:62`) + init policies (`init.sql:301-313`) | update refused uE/uA/uV C817 `:261`, `:265` · viewer delete 0 rows `rls_roles.sql:56-57` · insert kept C817 `:267` + rls_roles C13 | - |
| backfill places (2) + guard - verified at c1ddbde | door 5, migration `:131-137`, `seed.sql:165-171` | migration C820 (MCP re-run) · seed first run C821 `demo_seed.sql:145-154` · guard `demo_seed_rerun.sql:24-26`: version 4 (AG-1039, `sent`, so the update's `where` holds it but for `snapshot = '{}'`) would get `takenAt = now()` without the guard (M7 killed, assessed by reading) | - |
| widths (3) | carried from e9edb78 | C822 (builder record only) | - |
| Landing doors (5) | carried from e9edb78 | 1 C801/C803/C832 · 2 C801/C802/C808/C823 · 3 C810-C813/C817/C819 · 4 C804/C824 · 5 C820/C821 | - |
| container assembly (1) | carried from e9edb78 (`web/composition/index.ts:110`) | C804 + C824 | - |

## Test policy rows

Re-judged at c1ddbde: the two rows that classify touched files, or that were unmet in round 1. The Instrumentation
row is carried from e9edb78.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `site_service_scope`, `freeze_agreement_version`, transition RPC; reader; seed backfill | own layer SQL + stub C804 · boundary C824 and RPCs run as each role | yes - the task-position row and the seed-guard row now have discriminating fixtures (M6 and M7 killed, assessed by reading) |
| Decides, not across a boundary | `parseServiceScope` (`web/domain/agreement/index.ts`), view state table | own layer, one asserted case per row of the decision table | no - two parser rows (takenAt not text, typeModel not text-or-null) carry a case that passes under the wrong implementation (F7, F11) |
| Instrumentation | page pass-through, container | none of its own; C824 | yes (carried from e9edb78) |

## Faults injected

Verified at c1ddbde. The TypeScript faults F6-F11 were applied by editing the real tree with `sed`. After each one I
ran the proof `npx vitest run domain/agreement/service-scope.test.ts -t "C803"` and restored the file with
`git checkout -- web/domain/agreement/index.ts`. `git status --porcelain` was empty before the faults and after each
restore. F11 goes one past the cap of five. I added it because F7 showed that the new rows can share a fixture
weakness.

M6 and M7 (round 1's SQL mutants) cannot be run against the live database. I re-assessed them by reading the new
assertions. F1-F5 from round 1 touch files the fix did not change, so they are carried from e9edb78 (all killed).

| Mutation | Location | Proof run | Killed |
| --- | --- | --- | --- |
| F6 takenAt `Date.parse` check removed (text kept) | `web/domain/agreement/index.ts:164` | 1 failed: `a takenAt that is not a time` | yes |
| F7 takenAt `isText` check removed (`Date.parse` kept) | `web/domain/agreement/index.ts:164` | 16 passed: fixture `1730000000` gives `Date.parse` `NaN`, so it is refused anyway | survived |
| F8 `isText(value.code)` removed | `web/domain/agreement/index.ts:148` | 1 failed: `a code that is not text` | yes |
| F9 tasks accepted when not an array | `web/domain/agreement/index.ts:149` | 1 failed: `tasks that are not a list` | yes |
| F10 `isOptionalText` accepts `undefined` (`== null`) | `web/domain/agreement/index.ts:140` | 1 failed: `an asset with a field missing` | yes |
| F11 `!isOptionalText(value.typeModel)` removed | `web/domain/agreement/index.ts:143` | 16 passed: both asset rows have `typeModel: null` | survived |
| M6 task `order by k.created_at, k.id` (or `k.id`) instead of `k.position` first | `supabase/migrations/20261027212052_service_included.sql:17` | assessed by reading: `Second` is older (`now()-2d`) and has the lower id (`0000…`), so both orders give `["Second","First"]` and `C801 position order` (`service_included.sql:129-131`) raises | yes (assessed by reading) |
| M7 seed update without `and v.snapshot = '{}'::jsonb` | `supabase/seed.sql:169` | assessed by reading: version 4 is AG-1039 (`sent`), so the update would rewrite it with `takenAt = now()`. `C821 guard` (`demo_seed_rerun.sql:24-26`) and `C821 rerun` (`:20-22`) both raise | yes (assessed by reading) |
| viewer delete allowed on `agreement_versions` | init policy `supabase/migrations/20261019174738_init.sql:312` | assessed by reading: `rls_roles.sql:56-57` expects 0 rows as `uV` | yes (assessed by reading) |
| F1-F5 (round 1) | parser sort, reader, view, runner | carried from e9edb78 | yes (carried) |

I also checked by reading two parser rows that I did not mutate:
- **Assets not a list.** If that check were removed, `.map` on an object would throw, and `:40` would fail.
- **`unitNo` not text.** If that check were removed, `unitNo: 1` would be accepted, and `:41` would fail.

## Swept

Carried from e9edb78. The fix range touches `rls_roles.sql`, but only by adding the C12 delete assertion. C13
(`rls_roles.sql`) is unchanged, so that row still holds.

## Notes outside the checks

- **Stale counts in `checks.md`.** C803's claim (`checks.md:59`) and its coverage row (`:243`, "parser rejections
  (7)") still say 7 inputs, while the test now has 14 rows. This is a precision gap in the checks, not in the code.
- **Stale comment.** The comment at `supabase/tests/service_included.sql:118` names a task `'zLate'` that does not
  exist. The fixture's tasks are `First` and `Second`. This is cosmetic.
- **Carried from round 1.** Writers keep `delete` on `agreement_versions` through the init policy. The Build record
  now names this as left for a hardening pass (`checks.md:330`).

## Gate

All verified at c1ddbde:

- `npx vitest run ... -t "C8"`: 33 passed (30 C8xx), 0 failed
- `npm test`: 55 files, 1257 passed, 0 failed
- `npm run test:db`: 16 passed, 0 failed
- `npx tsc --noEmit`: exit 0
- `npm run lint`: exit 0
- `npx next build` (scratch worktree, own `npm ci`): exit 0. The worktree was then removed with
  `git worktree remove --force` and `git worktree prune`.
- Greps: C809 `1`/`1`, C819 `2`, C831 `2`/`1`/`5`
- MCP (read-only): `list_migrations`, `get_advisors` security, `execute_sql` select

## Ranked gaps

1. **F7: `takenAt` not text is not discriminated** (C803, `web/domain/agreement/service-scope.test.ts:37`). Use a
   non-text value that `Date.parse` accepts, for example `takenAt: 2026` or `["2026-10-27"]`, so that only the `isText`
   check refuses it.
2. **F11: `typeModel` not text-or-null is not discriminated** (C803, `web/domain/agreement/service-scope.test.ts:41`).
   Add a row where only `typeModel` is non-text (for example `{ unitNo: "RTU-1", typeModel: 1, location: null }`), or
   one row per field.
3. **Non-blocking.**
   - Update C803's "7 inputs" and the "parser rejections (7)" coverage row in `checks.md` to the real count.
   - Fix the `'zLate'` comment at `service_included.sql:118`.
   - C822 still rests on the builder's record.
