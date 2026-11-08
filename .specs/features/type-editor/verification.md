# type-editor verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 2369db2..HEAD (HEAD 02794b7)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

checks.md has no Test policy section, so there are no Test policy rows to judge; the repo convention decides the level.
There are no binding external sources (the plan's Sources are ROADMAP.md Phase 4.5 items 1 and 2 and `.specs/features/task-library-page/plan.md`), so the Binding sources step is not run.

Round 2: all proofs re-run in full at 02794b7 (verified at 02794b7): vitest 7 files, 67 passed; `npm run test:db` 24 passed, 0 failed. The fix (02794b7) changed only `supabase/tests/type_editor.sql` (C1942, C1943 added) and `checks.md` (42 checks, doors row 7, Handoff line); no source changed. Sections below say `verified at 02794b7` or `carried from ad51012` (round 1, full). Round 1 proof notes follow. vitest: one invocation over the 7 files, `-t` alternation of C1906, C1914, C1919, C1929, C1930, C1412, C1408, C1428, C1431, C1432, C1434, C1411, C1414, C1931, C1932, C1933, C1937, C1938 - 7 files passed, 67 tests passed, each named test listed individually as passed. SQL: `npm run test:db type_editor` - `PASS type_editor`, 1 passed, 0 failed. Every SQL id C1901-C1913, C1915-C1918, C1920-C1928, C1934-C1936, C1939, C1940 has labelled assertions in `supabase/tests/type_editor.sql` (grep over the file; none absent).

## Checks

Rows C1901-C1941 except C1934: carried from ad51012 (round 1); their proofs were re-run at 02794b7 and still pass, and the round 2 diff touched no test or code they cite. C1934, C1942, C1943: verified at 02794b7.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1901 | owner adds "Sump pump": code SUMP_PUMP, pack null, months {3,6,9,12}, 0 tasks | `test:db type_editor` PASS | `supabase/tests/type_editor.sql:63` `tests.ok('C1901 code', c = 'SUMP_PUMP', ...)`; `:64` `te_state(a,'SUMP_PUMP') like 'Sump pump¦{3,6,9,12}¦-¦0¦%'` | PASS |
| C1902 | codes SUMP_PUMP_2 then _3 | `test:db type_editor` PASS | `type_editor.sql:67` `create_task_library_type(a, 'Sump-pump!') = 'SUMP_PUMP_2'`; `:68` `'Sump_pump') = 'SUMP_PUMP_3'` | PASS |
| C1903 | "2-pipe fan coil" -> T_2_PIPE_FAN_COIL | `test:db type_editor` PASS | `type_editor.sql:70` `... '2-pipe fan coil') = 'T_2_PIPE_FAN_COIL'` | PASS |
| C1904 | 60 x `a` gets a 40-char code | `test:db type_editor` PASS | `type_editor.sql:73` `char_length(c) = 40` | PASS |
| C1905 | empty, spaces, 61 chars, `--- !!!` raise 23514, no row | `test:db type_editor` PASS | `type_editor.sql:76-79` `expect_error(... '23514')` x4; `:80` `te_types(a) = n` | PASS |
| C1906 | validateTypeName message and trim | `vitest ... -t C1906:` 5 passed | `domain/task-library/index.test.ts:106` `toEqual({ ok: false, message: "Name the type in 1 to 60 characters, with at least one letter or number" })`; `:112` `validateTypeName("  Sump pump  ")` `{ ok: true, name: "Sump pump" }` | PASS |
| C1907 | "SUMP PUMP" after "Sump pump" raises 23505, one row | `test:db type_editor` PASS | `type_editor.sql:82` `expect_error('C1907 duplicate', ... 'SUMP PUMP', '23505')`; `:83` `te_types(a) = n` | PASS |
| C1908 | direct insert of "sump PUMP" refused 23505 by `(org_id, lower(name))`; org B accepted | `test:db type_editor` PASS | `type_editor.sql:392` `expect_error('C1908 duplicate name', ... '23505')`; `:394` `expect_rows('C1908 other org', ..., 1)`; `:397` `indexdef like '%(org_id, lower(name))%'`. No parallel session run (see Swept concurrency note below) | PASS |
| C1909 | 4 functions x (estimator, viewer, other-org owner, anon) each with its SQLSTATE | `test:db type_editor` PASS | `type_editor.sql:266-269` uE and uV, all four `'42501'` (loop over `['uE','uV']`, `:264`); `:274-277` uB create `'42501'`, rename/remove/reset `'P0002'`; `:281-284` anon all four `'42501'` | PASS |
| C1940 | admin creates, renames, resets, removes | `test:db type_editor` PASS | `type_editor.sql:295` `create_task_library_type(a,'Admin made') = 'ADMIN_MADE'`; `:297` rename; `:300` remove `is null`. Reset at `:298` is a bare `perform` with no value assertion; it passes by not raising | PASS |
| C1910 | rename changes name only | `test:db type_editor` PASS | `type_editor.sql:101-103` state equals before-state with only the name replaced, and `te_tasks` equal | PASS |
| C1911 | other-case collision 23505; own-case rename succeeds | `test:db type_editor` PASS | `type_editor.sql:106` `rename_task_library_type('RENAME_ME','sump PUMP')` `'23505'`; `:109` `te_state(a,'SUMP_PUMP') like 'sump PUMP¦%'` | PASS |
| C1912 | empty and 61 chars raise 23514, name kept | `test:db type_editor` PASS | `type_editor.sql:111-112` `'23514'` x2; `:113` name still `Renamed type` | PASS |
| C1913 | sent version digest unchanged after a rename | `test:db type_editor` PASS | `type_editor.sql:120` `md5(snapshot::text) = (select digest from tests.te_before)` | PASS |
| C1939 | unknown code on rename, remove, reset raises P0002 | `test:db type_editor` PASS | `type_editor.sql:127-129` `expect_error(..., 'P0002')` x3. "Change nothing" is not asserted separately (a raise rolls the statement back) | PASS |
| C1914 | Remove renders a confirmation naming the type; no store call before confirm | `vitest ... -t C1914:` 2 passed | `components/task-library/type-controls.test.ts:27` `buttons(out)` `["Remove type"]`, `:28` `not.toContain("<form")`; `:35` `toContain("Remove Sump pump and its checklist?")`. The "no store call" half is inferred from there being no form, not asserted on a store spy | PASS |
| C1915 | removing an unused type with 3 tasks deletes type and tasks, others untouched | `test:db type_editor` PASS | `type_editor.sql:146` `te_state(a,'TEMP_TYPE') is null`; `:147` task count `= total`; `:148` `te_tasks(a,'RTU') = others` | PASS |
| C1916 | asset, service line, import row each raise 23503 | `test:db type_editor` PASS | `type_editor.sql:175` `expect_error('C1916 ' ¦¦ u, ... '23503')` over `['asset','line','import']` (`:160`) | PASS |
| C1917 | sent digest and contract wording unchanged after removal | `test:db type_editor` PASS | `type_editor.sql:191` snapshot md5 `= (select digest from tests.te_before)`; `:194` contract md5 `= (select contract from tests.te_before)` | PASS |
| C1918 | refused removal leaves row and task count as before | `test:db type_editor` PASS | `type_editor.sql:176` `te_state(a,'USED_'¦¦upper(u)) = v_state` per use kind | PASS |
| C1919 | `removeTypeAction` returns the in_use message; estimator never reaches the store | `vitest ... -t C1919:` 4 passed | `app/(app)/task-library-types.test.ts:67` `toEqual({ status: "in_use", name: "" })`; `:68` `TYPE_STATUS_MESSAGES.in_use` `toBe("This type is still used by assets, service lines or import rows")`; `:74` `expect(removeLibraryType).not.toHaveBeenCalled()` | PASS |
| C1920 | seed `tl_plumb` returns 2, 2 types stamped, 3 tasks, no hvac | `test:db type_editor` PASS | `type_editor.sql:313` `n = 2`; `:314` pack count `= 2 and te_types(x) = 2`; `:316` task count `= 3` | PASS |
| C1921 | one-argument seed returns 40, 174 tasks, all hvac | `test:db type_editor` PASS | `type_editor.sql:319` `n = 40`; `:320` `= 174`; `:321` `pack = 'hvac'` count `= 40` | PASS |
| C1922 | unknown pack raises 22023, no type gained | `test:db type_editor` PASS | `type_editor.sql:326` `seed_org_catalog(z,'nope')` `'22023'`; `:327` `te_types(z) = 0` | PASS |
| C1923 | seeding hvac twice returns 40 then 0, 40 types, 174 tasks | `test:db type_editor` PASS | `type_editor.sql:323` `seed_org_catalog(y,'hvac') = 0`; `:324` `te_types(y) = 40 and ... = 174` | PASS |
| C1924 | backfill over ERV/RTU (pack null) and SUMP_PUMP leaves ERV/RTU hvac, SUMP_PUMP null; live demo org read once | `test:db type_editor` PASS; plus a read-only SELECT by the Verifier on org `...de30` | `type_editor.sql:350` `code in ('ERV','RTU') and pack = 'hvac'` `= 2`; `:352` SUMP_PUMP `pack ... is null`. The statement run at `:347-348` is identical to the migration's backfill (`20261109120000_type_editor.sql:23-24`). Live read: `[{"pack":"hvac","n":40}]`, and 0 template-coded rows not at hvac. The live result is not recorded in checks.md Handoff; recorded here | PASS |
| C1925 | anon and authenticated refused 42501 on both signatures | `test:db type_editor` PASS | `type_editor.sql:332-333` authenticated one/two args `'42501'`; `:338-339` anon one/two args `'42501'` | PASS |
| C1926 | reset RTU restores name, months, 10 tasks in order, 2 seasonal, keeps id and code | `test:db type_editor` PASS | `type_editor.sql:234` state `like 'RTU¦' ¦¦ v_months ¦¦ '¦hvac¦' ¦¦ v_count ¦¦ '¦' ¦¦ v_id`; `:235` `te_tasks = v_tasks`; `:236` `v_count = 10`; `:237` seasonal count `= 2` | PASS |
| C1927 | reset of a no-pack type and a no-template type raise 55000, change nothing | `test:db type_editor` PASS | `type_editor.sql:251-252` `'55000'` x2; `:253` states equal `v_hand` and `v_gone` | PASS |
| C1928 | reset with name taken raises 23505, months and tasks unchanged | `test:db type_editor` PASS | `type_editor.sql:209` `'23505'`; `:210` `te_tasks(a,'RTU') = '1:Only task:null'` | PASS |
| C1929 | Reset shown for a type with a pack, none for pack null | `vitest ... -t C1929:` 1 passed | `type-controls.test.ts:42` `toContain("Reset to hvac pack")`; `:43` `join("¦")` `not.toContain("Reset")` | PASS |
| C1930 | `/task-library` reads once, `?type=` picks, view lists types, editor has a row per task | `vitest` C1412, C1408, C1428 - 3 passed | `app/(app)/task-library.test.ts:52` `listTaskLibrary` `toHaveBeenCalledTimes(1)`; `components/task-library/task-library.test.ts:39` `links` `toEqual(["BOILER","RTU"])`; `:89` `descriptions` `toHaveLength(2)`. Restored tests differ from `b765d12^` only by `pack: "hvac"` in fixtures | PASS |
| C1941 | save action rejects invalid, saves valid once, ignores orgId, signed-out to /login | `vitest` C1431, C1432, C1434, C1411 - 5 passed | `app/(app)/task-library.test.ts:76` `not.toHaveBeenCalled()`; `:87` `toHaveBeenCalledTimes(1)`; `:114` `JSON.stringify(...)` `not.toContain("other-org")`; `:67` `NEXT_REDIRECT /login`. Restored unchanged apart from `pack: "hvac"` | PASS |
| C1931 | no five controls for estimator/viewer; all five for owner/admin | `vitest ... -t C1931:` 4 passed | `type-controls.test.ts:52` `expect(labels, label).toContain(label)` for owner/admin; `:58` `not.toContain(label)` and `:59` `not.toContain("<form")` for estimator/viewer | PASS |
| C1932 | empty library shows message; Add form for owner, none for estimator | `vitest` C1414, C1932 - 3 passed | `task-library.test.ts:72` `toContain("No equipment types yet")`, `:73` `not.toContain("<form")` (owner view in C1414 shows no editor); `type-controls.test.ts:67` `buttons(out)` `toEqual(["Add type"])`; `:73` estimator `not.toContain("<form")` | PASS |
| C1933 | Company settings renders a link to /task-library | `vitest ... -t C1933:` 2 passed | `components/settings/settings.test.ts:213` `toMatch(/<a[^>]*href="\/task-library"[^>]*>[^<]*Task library/)` for owner and estimator | PASS |
| C1934 | an owner's direct update of `code` or `org_id` is refused with 23514; `name` update succeeds | `test:db type_editor` PASS (02794b7) | `type_editor.sql:381` as uA `set code = 'ZZ'` `'23514'`; `:382` `set name = 'Rooftop'` rows `1`; `:387` `org_id` with no signed-in user `'23514'`. The signed-in `org_id` cases are bound by C1942. Precision note: the claim text is unedited and still says an owner gets 23514, which holds for an owner of both orgs and for no user, not for an owner of one org (42501, door 7); C1942 states the true split, so C1934 plus C1942 together prove AC 30 | PASS |
| C1935 | pack `Hvac`, `1abc`, `a-b` refused 23514; `hvac`, `a_1` accepted | `test:db type_editor` PASS | `type_editor.sql:361` `expect_error('C1935 ' ¦¦ p, ..., '23514')` over the three; `:364` `expect_rows(..., 1)` over `hvac`, `a_1` | PASS |
| C1936 | `(tl_plumb,PUMP)` beside `(hvac,PUMP)` accepted; duplicate 23505; orphan task 23503 | `test:db type_editor` PASS | `type_editor.sql:370` `expect_rows(..., 1)`; `:372` duplicate `'23505'`; `:374` orphan `'23503'` | PASS |
| C1937 | `createTypeAction` invalid message without store call; conflict message | `vitest ... -t C1937:` 8 passed | `task-library-types.test.ts:40` `toEqual({ status: "invalid", name })`; `:41` `createLibraryType` `not.toHaveBeenCalled()`; `:45-46` `TYPE_STATUS_MESSAGES.invalid` and `.conflict` `toBe(...)` the two strings. The page renders those via `type-controls.tsx:15,26` | PASS |
| C1938 | store maps 42501, P0002, 23505, 23514, 23503, 55000, other for create, rename, remove, reset | `vitest ... -t C1938:` 29 passed | `infrastructure/supabase/task-library.test.ts:117` `toEqual({ ok: false, code: expected })`, table at `:101-108` (7 pairs) x 4 functions (`:96-101`), plus rpc names/args at `:122-137` | PASS |
| C1942 | door 7: signed-in owner of org A alone moving a type to org B refused 42501 by the row policy; owner of both orgs refused 23514 by the trigger | `test:db type_editor` PASS (02794b7) | `supabase/tests/type_editor.sql:394` `expect_error('C1942 owner of both orgs', ... update public.asset_types set org_id = <orgB> ..., '23514')` (second membership inserted at `:391`); `:401` `expect_error('C1942 owner of one org', ..., '42501')` (membership deleted at `:399`) | PASS |
| C1943 | door 6: reset is `security definer` with empty `search_path`; create, rename, remove are invoker; anon executes none of the four; authenticated all four | `test:db type_editor` PASS (02794b7) | `type_editor.sql:410` `p.prosecdef and p.proconfig @> array['search_path=""']` for `reset_task_library_type`; `:414` `not p.prosecdef` for the other three; `:418` `not exists (... has_function_privilege('anon', p.oid, 'execute'))`; `:422` `has_function_privilege('authenticated', ...)) = 4` | PASS |

## Coverage

Round 2: the `doors` and `acceptance criteria` rows verified at 02794b7; every other row carried from ad51012 (Surface, Relations and the code are unchanged by the fix). Recomputed from plan.md (Surface, Relations, Landing, Criteria), the migrations and the code, not read back from checks.md. Round 1 had 16 sets (15 rows plus the unrowed doors 6 and 7); checks.md's doors row now lists 7, so 15 rows.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `create_task_library_type` statuses (3) | plan Surface; migration `create_task_library_type` | 42501 `type_editor.sql:266,274,281` · 23514 `:76-79` · 23505 `:82` | - |
| `rename_task_library_type` statuses (4) | plan Surface; `library_type_for_write` | 42501 `:267,282` · P0002 `:127` · 23514 `:111-112` · 23505 `:106` | - |
| `remove_task_library_type` statuses (3) | plan Surface | 42501 `:268,283` · P0002 `:128` · 23503 `:175` | - |
| `reset_task_library_type` statuses (4) | plan Surface; migration lines 188-200 | 42501 `:269,284` · P0002 `:129` · 55000 `:251-252` · 23505 `:209` | - |
| store failure mapping (7) | `TYPE_FAILURES` in `infrastructure/supabase/task-library.ts` + `TypeFailure` port | all 7 x 4 functions, `task-library.test.ts:101-117` | - |
| callers of each function (6) | plan Surface "any signed-in user" + roles | estimator, viewer, other-org owner, anon `:264-284` (all 16 combinations); owner via C1901/C1910/C1915/C1926; admin `:295-300` | - |
| uses that block a removal (3) | FK set on `asset_types` (assets, service_line_asset_types, import_rows) | `type_editor.sql:160-175` asset, line, import | - |
| name-to-code cases (5) | plan door 5 | plain `:63` · suffix `:67-68` · digit `:70` · cap `:73` · punctuation `:67` | - |
| invalid names (4) | AC 4 | empty, spaces, 61, no letter `:76-79`; web `index.test.ts:104-106` | - |
| `seed_org_catalog` outcomes (4) | AC 16-19, 21 | `:313-316` · `:319-321` · `:326` · `:323` (+ privilege `:332-339`) | - |
| `pack` format check (5) | door 2 check regex | `:361,364` all five | - |
| reset refusals (3) | migration `reset_task_library_type` | no pack and no template `:251-252` · name taken `:209` | - |
| doors (7) | plan Landing doors 1 to 7 (checks.md row now lists 7) | 1 `:370-375` · 2 `:361,364`, `:234` · 3 `:319,326,332-339` · 4 `:392-397` · 5 `:63-73`, `:381-382` · 6 `:410-422` (C1943) plus role gate `:269,284` · 7 `:394` owner of both orgs 23514, `:401` owner of one org 42501, `:387` no user 23514 (C1942) | - |
| relations entities (5) | plan Relations diagram | catalog pack/type/task `:370-375` · org type `:63` · org task `:147` | - |
| acceptance criteria (30) | plan Criteria | 1 `:63-65` · 2 `:67-68` · 3 `:70` · 4 `:76-79`, `index.test.ts:106` · 5 `:82` · 6 `:266-284` · 7 `:101` · 8 `:106,109` · 9 `:111-112` · 10 `:120` · 11 `type-controls.test.ts:28,35` · 12 `:146-148` · 13 `:175`, `types.test.ts:68` · 14 `:191,194` · 15 `:176` · 16 `:313-316` · 17 `:319-321` · 18 `:326` · 19 `:323` · 20 `:350,352` + live read · 21 `:332-339` · 22 `:234-237` · 23 `:251-253` · 24 `:209-210` · 25 `type-controls.test.ts:42-43` · 26 C1412/C1408/C1428/C1432 · 27 `type-controls.test.ts:52-59` · 28 `:67,73` · 29 `settings.test.ts:213` · 30 code `:381`, org no user `:387`, org signed-in `:394`, `:401` | - |

## Faults injected

Round 1 (carried from ad51012), 5 faults, all killed: store map `"23503": "in_use"` -> `"conflict"` in `web/infrastructure/supabase/task-library.ts` (killed by `C1938`); `validateTypeName` bound `> MAX_TYPE_NAME` -> `+ 1` at `web/domain/task-library/index.ts:72` (killed by `C1906`); `canEditTaskLibrary` -> `role !== "viewer"` at `web/components/task-library/state.ts:13` (killed by `C1931`, `C1919`); Reset shown always at `web/components/task-library/type-controls.tsx:117` (killed by `C1929`); SQL `T_` prefix dropped in `create_task_library_type` (recipe failed at the C1903 create call).

Round 2 (verified at 02794b7). Each SQL mutant ran as `fixture.sql` + one mutation + `type_editor.sql` against the live database inside a transaction that always ended in rollback (explicit `rollback` in `finally`); nothing was committed, no source file was modified, and `git status --porcelain` equals the baseline. Seven runs, two over the cap of 5, declared here: the extra two separate C1943 from earlier assertions.

| Mutation | Location | Killed |
| --- | --- | --- |
| trigger: signed-in owner of both orgs not refused (`or (select private.has_org_role(new.org_id, ...))` -> `or false`) | `private.asset_types_code_frozen`, `20261109130000_type_editor_org_move.sql:12-13` | yes - `C1942 owner of both orgs: expected SQLSTATE 23514, got 23505` (`type_editor.sql:394`) |
| `remove_task_library_type` swallows the in-use foreign-key error | `20261109120000_type_editor.sql` `remove_task_library_type` | yes - `C1916 asset: expected SQLSTATE 23503, statement succeeded` (`type_editor.sql:175`) |
| trigger: a `code` change is allowed (`if new.code is distinct from old.code` -> `if false`) | `20261109130000_type_editor_org_move.sql:7` | yes - `C1934 code: expected SQLSTATE 23514, statement succeeded` (`type_editor.sql:381`) |
| `alter function public.rename_task_library_type security definer` | live function, inside the rolled-back transaction | yes - `C1943 rename_task_library_type invoker: rename_task_library_type is a definer function` (`type_editor.sql:414`) |
| `reset_task_library_type` `security definer` -> `security invoker` | `20261109120000_type_editor.sql` `reset_task_library_type` | yes, but by `C1928 taken` (got 42501, permission denied on the template) at `type_editor.sql:209`, which runs before C1943 and shadows it |
| `grant execute on reset_task_library_type to anon` | live function, inside the rolled-back transaction | yes, but by `C1909 anon reset` (got P0002) at `type_editor.sql:284`, which runs before C1943 and shadows it |
| `_n` suffix step `v_n + 1` -> `v_n + 2` | `20261109120000_type_editor.sql` `create_task_library_type` | yes - `C1902 second` (`type_editor.sql:67`) |

C1943 was made to fail on its own only through the rename mutant (the `invoker` assertion). Its definer, anon and authenticated assertions (`:410`, `:418`, `:422`) were never the first failure of any run, because C1928 and C1909 fail earlier in the file. They are located and green but not shown by injection to kill a mutant; recorded as a note, since the same behaviours are caught by those earlier checks.

## Gate

verified at 02794b7: `cd web && npm run test:db` - 24 passed, 0 failed (all recipes PASS, including `type_editor` with C1942 and C1943). `cd web && npx vitest run` over the 7 feature files with the check-id filter - 7 files passed, 67 tests passed. The round 1 diff review of `runner.test.ts`, `task-library.test.ts` and `catalog_seed.sql` (no assertion loosened) is carried from ad51012; the round 2 diff touched none of them.

## Ranked gaps

Round 1 gaps 1 and 2 are closed at 02794b7: C1942 binds the signed-in `org_id` cases for door 7 (`type_editor.sql:394,401`), C1943 binds door 6 (`:410-422`), and the doors row lists 7. Remaining, all notes, none fails the verdict:
1. C1934's claim wording still says "owner ... 23514" without the owner-of-one-org split (42501); C1942 holds the precise statement. Precision note on the checks.
2. C1943's definer, anon and authenticated assertions are never the first failure under injection (shadowed by C1928 and C1909). Note.
3. C1914 claims "no store call before confirm"; the test only shows no form before confirming (`type-controls.test.ts:28`). Note.
4. C1940 reset step (`type_editor.sql:298`) asserts nothing beyond not raising. Note.
5. Concurrency (Swept row): no parallel session run, as the Swept row says. Honest as written.
