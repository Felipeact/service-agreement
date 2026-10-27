# Service included verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 05a934e..e9edb78
**Round**: 1 - full
**Verifier**: independent sub-agent "service-included verifier" (fresh context; author != verifier, built none of this feature)

All 32 checks (C801-C832) are accounted for. 31 have a located assertion and a proof that I ran or re-ran at
`e9edb78`; C829 is not fully proven. All 5 injected TypeScript faults were killed. The verdict is FAIL for four
reasons:

1. **C821's re-run assertion cannot fail under the obvious regression.** I removed the `snapshot = '{}'` guard from
   the `seed.sql` update, assessed by reading only. Both `SEED_BODY` runs share one transaction, so `now()` and the site
   scope are identical on the second run, and the rewritten snapshot is byte-equal to the first. The guard that
   AC 15 / AD-062 depend on is unprotected (M7 below).
2. **C801 does not prove that tasks are ordered by `position`.** I dropped `k.position` from the task `order by` in
   `site_service_scope`, assessed by reading only. The two RTU tasks have the same `created_at` (`now()` inside the
   recipe's transaction), and their ids are `md5('taskA')` = `093b…` < `md5('rtuTask2')` = `1a32…`. So `created_at, id`
   order gives the same list as position order, and C801/C808 still pass. Door 1 says that "tasks keep checklist
   `position` order", the parser keeps tasks as stored, and the SQL function is the only place this is decided
   (M6 below).
3. **An earlier assertion was dropped beyond what the change needed.** Removing `agreement_versions` from the
   `rls_roles.sql` C12 loop removed its **delete** assertion too (viewer delete affects 0 rows), not only the update
   one. C817 covers update only. A search finds no other assertion of a viewer delete on `agreement_versions`, and the
   edited supabase-init coverage row still credits C12 for it.
4. **C829 is not proven for `npx next build`.** I was told not to run it and to judge it from the record, but the
   Build record and the commits contain no `next build` result.

Also stated up front:
- **C822 rests on the builder's evidence.** As instructed, I did not open a browser. I judged it from the Build
  record (`checks.md:315`) and the code.
- **SQL faults were assessed, not run.** I was told not to change the live database, so the SQL faults were not run.

## Binding sources

The profile is `standard`, so step 1 (`ui`) does not run. The plan marks no design as binding. Its sources are
ROADMAP/PRODUCT text and STATE.md decisions. I read each one against the migration, the ports and the checks. None of
them contradicts a check.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 3 item 2 (`:114`), M6 (`:30`), M7 (`:31`) | yes | - | - |
| PRODUCT.md "Agreement anatomy" (`:35`) | yes | - | - |
| STATE.md AD-005, AD-015, AD-016, AD-017, AD-023, AD-030, AD-050, AD-055 | yes | - | - |
| STATE.md AD-058 to AD-062 (`:64-68`) | yes - match doors 1-5 and the code | - | - |

## Checks

**vitest.** All the vitest proofs ran in one invocation from `web/`:
`npx vitest run domain/agreement infrastructure/supabase components/agreements "app/(app)" scripts/test-db -t "C8[0-3][0-9]:" --reporter=verbose`.
It exited 0 with 23 passed, and each name appeared individually:
- C803: 9
- C804: 6
- C805, C806, C807, C815, C816, C818: 1 each
- C824: 1
- C830: 1

**test:db.**
- `npm run test:db service_included` printed `PASS service_included`.
- `npm run test:db demo_seed` printed `PASS demo_seed`.
- Every labelled SQL assertion goes through `tests.ok` / `tests.expect_error` / `tests.expect_rows`, which raise, so
  reaching `service_included: pass` means each one ran and held.

**Paths.** TS paths are relative to `web/`. "SQL" means `supabase/tests/service_included.sql`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C801 | scope doc shape: keys, schema 1, no takenAt, 2 types, tasks in position order, BOILER `[]`, nulls kept, 2+1 assets | test:db service_included PASS | `supabase/tests/service_included.sql:88` top keys `= array['schema','types']`; `:90` schema `1`; `:91` `not doc ? 'takenAt'`; `:92` 2 types; `:94` type keys; `:100` tasks `= '["Replace filters", "Check belts"]'`; `:102` BOILER `'[]'`; `:103` counts 2/1; `:106` asset keys; `:110` JSON `null`. Weakness: the task order also follows id order (M6) | PASS |
| C802 | no other-site type, no type without assets, other org gives empty doc | test:db PASS | `supabase/tests/service_included.sql:120-122` codes `= array['BOILER','RTU']` (CH802 on s802, UNUSED with a task at `:53`); `:124` siteB `= '{"schema": 1, "types": []}'` | PASS |
| C803 | parser render order + 7 rejections | vitest `C803:` 9 pass | `web/domain/agreement/service-scope.test.ts:17` `toEqual(["AHU","boiler","Unit heater (gas)"])`; `:18` `toEqual(["rtu-1","RTU-2","RTU-10",null])`; `:19` tasks as stored; `:37` `toBeNull()` over the 7 rows `:29-35` | PASS |
| C804 | reader source, 6 cases | vitest `C804:` 6 pass | `web/infrastructure/supabase/agreements.test.ts:293-294` rpc once with `("site_service_scope",{p_site_id:"s1"})`; `:295` `{source:"live",takenAt:null,types}`; `:309` rpc not called; `:311` `{source:"frozen",takenAt:new Date(TAKEN),...}` (draft v1 and sent); `:318-319` `{}` -> not_recorded, no console.error; `:330-331` malformed -> not_recorded, error once; `:337` `rejects.toThrow("XX000")` | PASS |
| C805 | live view: order, counts, tasks, closed `<details>` per type, `—` | vitest `C805:` pass | `web/components/agreements/agreements.test.ts:236` Rooftop after Boiler; `:237` tasks `<li>` in order; `:238` no details in Service included; `:241` 2 details; `:242` no `open`; `:243-244` summaries `Boiler · 1`, `Rooftop unit · 2`; `:247` `RTU-2 — —` | PASS |
| C806 | no-tasks copy | vitest `C806:` pass | `web/components/agreements/agreements.test.ts:252` `Boiler, 1 unit No checklist for this type yet.` | PASS |
| C807 | live empty both sections; writer link `/sites/s1`; viewer none | vitest `C807:` pass | `web/components/agreements/agreements.test.ts:257`, `:260` copy in both sections; `:258` `<a[^>]*href="\/sites\/s1"[^>]*>Add equipment<\/a>`; `:261` viewer `not.toContain("Add equipment")` | PASS |
| C808 | live scope follows asset insert / task update / asset delete | test:db PASS | `supabase/tests/service_included.sql:136` CHILLER with `'["Check oil"]'`; `:148` new task text; `:153` no CHILLER after delete | PASS |
| C809 | `site_service_scope` and `snapshot` only in the reader adapter | both greps printed `1` (`infrastructure/supabase/agreements.ts`) | `web/infrastructure/supabase/agreements.ts:57` `client.rpc("site_service_scope", ...)`; `:62` `.select("snapshot")` | PASS |
| C810 | send freezes v2 = scope, takenAt = now(), v1 `{}`, event | test:db PASS | `supabase/tests/service_included.sql:164` `v2 - 'takenAt' = public.site_service_scope(...)`; `:166` `::timestamptz = now()`; `:167` v1 `= '{}'`; `:168-169` event exists | PASS |
| C811 | withdraw from draft freezes | test:db PASS | `supabase/tests/service_included.sql:180` scope equal; `:182` takenAt `= now()` | PASS |
| C812 | 6 non-draft transitions write nothing new; revise copies | test:db PASS | `supabase/tests/service_included.sql:196` each of 5 `= frozen`; `:200` revised v1 `= frozen`; `:202` v2 `= frozen` (jsonb `=`, equivalent to byte equality for normalized jsonb) | PASS |
| C813 | 40001 / 42501 / P0002 write nothing | test:db PASS | `supabase/tests/service_included.sql:210-211` `'40001'` + `{}` kept; `:212-215` `'P0002'` + takenAt count unchanged; `:220` `'42501'`, `:225-226` `{}` and status `draft` kept | PASS |
| C814 | frozen snapshot unchanged after insert / task update / delete | test:db PASS | `supabase/tests/service_included.sql:236` `si_snapshot('a810:v2')::text = before::text` after `:233-235` | PASS |
| C815 | frozen view: `As recorded on <en-CA date>` in both, no Add equipment | vitest `C815:` pass | `web/components/agreements/agreements.test.ts:266` both sections contain `recorded` (formatter at `:224`); `:269` `not.toContain("Add equipment")` (default role estimator, `:51`) | PASS |
| C816 | not_recorded copy both; no As recorded / Add equipment | vitest `C816:` pass | `web/components/agreements/agreements.test.ts:274-276` | PASS |
| C817 | uE/uA/uV update 42501; no update grant; insert kept | test:db PASS | `supabase/tests/service_included.sql:245-246` `'42501'` per role on `verA`; `:249` `not has_table_privilege(... 'update')`; `:251` insert true | PASS |
| C818 | frozen empty copy both; no Add equipment | vitest `C818:` pass | `web/components/agreements/agreements.test.ts:282`, `:284` | PASS |
| C819 | freeze fn definer, search_path, anon/viewer 42501, nothing written; one caller | test:db PASS; grep printed `2` | `supabase/tests/service_included.sql:260` `prosecdef`; `:261` `search_path=""`; `:265` anon `'42501'`; `:270` viewer `'42501'`; `:275` `{}` kept; `supabase/migrations/20261027212052_service_included.sql:100` the only call | PASS |
| C820 | live backfill: 0 frozen `{}`, editable unchanged, schema 1 + takenAt | MCP `execute_sql` re-run by me (read-only): `frozen_still_empty` 0, `frozen_with_scope` (schema 1 and takenAt) 10, `editable_versions` 4, `editable_empty` 4, total 14 | `.specs/features/service-included/checks.md:302` (the 4 editable versions were `{}` before), `:304`; migration `supabase/migrations/20261027212052_service_included.sql:131-137` | PASS |
| C821 | seed: frozen schema 1, 2 drafts `{}`, re-run byte-equal | test:db demo_seed PASS | `supabase/tests/demo_seed.sql:145-149` no frozen version without schema 1; `:151-154` `= 2` drafts `{}`; `supabase/tests/demo_seed_rerun.sql:20-23` text-equal after the second run. Weakness: it cannot detect a dropped guard (M7) | PASS |
| C822 | live at 1440/768/375 | not re-run (instructed); judged from the record and the code | `.specs/features/service-included/checks.md:315` (builder's record: AG-1046 live + CHILLER after reload, AG-1039 `As recorded on Oct 27, 2026`, AG-1022 8 closed groups, summaries 44 px, scrollWidth <= innerWidth at each width); code agrees: `web/components/agreements/service-scope.tsx:78` `<summary className="flex min-h-11 ...">`, `:36` link `min-h-11`. Rests on the builder's evidence | PASS |
| C823 | anon 42501; authenticated execute; invoker, stable, search_path; transition grants | test:db PASS | `supabase/tests/service_included.sql:282` `not prosecdef`; `:283` `provolatile = 's'`; `:284` search_path; `:285` authenticated execute; `:287-288` transition authenticated; `:293-294` anon `'42501'` for both | PASS |
| C824 | port member; page passes the scope through | vitest `C824:` pass; tsc exit 0 | `web/application/ports/index.ts:416` `serviceScope: AgreementServiceScope;`; `web/app/(app)/agreements.test.ts:273` `toContain("As recorded on ${day}")`, `:274` `Rooftop unit, 1 unit` | PASS |
| C825 | file version = list_migrations | MCP `list_migrations` (run by me): `20261027212052 service_included` | `supabase/migrations/20261027212052_service_included.sql:1` | PASS |
| C826 | types equal the generator, contain `site_service_scope` | MCP `generate_typescript_types` (run by me): the `Functions` block matches the local block member for member | `web/infrastructure/supabase/database.types.ts:873` `site_service_scope: { Args: { p_site_id: string }; Returns: Json }` (the record at `checks.md:305` says "file unchanged", but this range adds the line; it was added in an earlier commit of the range) | PASS |
| C827 | advisors exactly the two accepted | MCP `get_advisors` security (run by me): `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection`, nothing else | `.specs/features/service-included/checks.md:306`; grants at `supabase/migrations/20261027212052_service_included.sql:30-31`, `:59-62` | PASS |
| C828 | all 16 recipes pass | `npm run test:db`: 16 PASS lines, `16 passed, 0 failed` | `web/scripts/test-db/runner.mts:44` `plain("service_included")`; `supabase/tests/rls_roles.sql:49` loop now drops `agreement_versions` (user-approved; see gap 3: its delete assertion went too) | PASS |
| C829 | tsc, lint, next build exit 0; npm test passes | `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm test` 55 files, 1250 passed; `npx next build` **not run** (instructed), and **no record exists** | `web/scripts/test-db/runner.test.ts:99` (the only earlier tests changed are runner count pins and the `serviceScope` fixtures, e.g. `web/composition/composition.test.ts:247`) | NOT PROVEN - next build |
| C830 | 16 recipes, 18 files, plain | vitest `C830:` pass | `web/scripts/test-db/runner.test.ts:99` `toHaveLength(16)`; `:100` parts `["fixture.sql","service_included.sql"]`; `:102` `REAL_FILES toHaveLength(18)` | PASS |
| C831 | docs | greps printed `2`, `1`, `5` | `CONTEXT.md:207` dated Build log line; `ROADMAP.md:114` `- [x] "Service included" ...`; `.specs/STATE.md:64-68` AD-058..AD-062 | PASS |
| C832 | frozen doc text-equals live doc | test:db PASS | `supabase/tests/service_included.sql:170` `(v2 - 'takenAt')::text = public.site_service_scope(...)::text` | PASS |

## Coverage

Each set below is recomputed from its authority: the plan's Surface/Landing, the migration, and the code.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| RPC `site_service_scope` statuses (2) | plan Surface | 200 C801/C802 (SQL as `uE`) · 401 anon C823 `:293` (`42501`, which PostgREST answers as 401 for anon) | - |
| scope doc keys (9 + takenAt) | Landing door 1, migration `:12-21`, `:54` | 9 keys C801 `:88-110` · `takenAt` absent live C801 `:91`, present frozen C810 `:166` | - |
| rows excluded (3) | migration `:23-25` + RLS (invoker) | other site, type without assets C802 `:120` · other org C802 `:124` | - |
| task order within a type (1 rule) | door 1 "checklist `position` order", migration `:17` | C801 `:100` asserts it, but the fixture's id order equals position order | position order not discriminated (M6) |
| parser rejections (door-1 shape, 12 branches in `web/domain/agreement/index.ts:142-176`) | parser code + door 1 | 7 by C803 (`{}`, schema, missing types, types not array, name, task type, asset not object) | malformed `takenAt` (`:164`), `code` not text, `tasks` not array, `assets` not array, asset field not text/null |
| render order (2 rules) | `parseServiceScope` `:160-176` | types by name, units natural + null last C803 `:17-18` | - |
| reader cases (6) | plan door 4 + `agreements.ts:54-73` | C804, all 6 | - |
| view states (7) | `service-scope.tsx:26-42` | live types C805 · no tasks C806 · live empty writer/viewer C807 · frozen C815 · not recorded C816 · frozen empty C818 | - |
| transitions from draft (2) | migration `:99-101` | sent C810 · withdrawn C811 | - |
| transitions not from draft (6) | transition table | C812, all 6 | - |
| refused transitions (3) | migration `:84-96` | 40001 / 42501 / P0002 C813 | - |
| changes after freeze (3) / while live (3) | AC 3, AC 9 | C814 x3 / C808 x3 | - |
| member writes on `agreement_versions` after the change | grants (`:62`) + init policies (`init.sql:301-313`) | update refused uE/uA/uV C817 · insert kept C817 + rls_roles C13 | viewer **delete** no longer asserted (it was `rls_roles.sql` C12; the loop at `:49` now skips the table) |
| backfill places (2) + guard | door 5, migration `:131-137`, `seed.sql:162-171` | migration C820 (MCP, re-run) · seed first run C821 `:145-154` | seed's `snapshot = '{}'` guard not discriminated by the re-run (M7) |
| widths (3) | AC 17 | 1440 / 768 / 375 C822 (builder record only) | - |
| Landing doors (5) | plan Landing | 1 C801/C803/C832 · 2 C801/C802/C808/C823 · 3 C810-C813/C817/C819 · 4 C804/C824 · 5 C820/C821 | - |
| container assembly (1) | `web/composition/index.ts:110`, read directly: `agreementReader: supabaseAgreementReader(supabase)` (unchanged) | C804 + C824 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `site_service_scope`, `freeze_agreement_version`, transition RPC (`supabase/migrations/20261027212052_service_included.sql`); reader (`web/infrastructure/supabase/agreements.ts`) | own layer: SQL C801/C802/C808/C810-C814/C817/C819/C823/C832, stub C804 · boundary: reader->page C824, RPCs exercised as each role in SQL | partially - one case per decision row exists, but the task-position row (M6) and the seed guard (M7) are asserted with fixtures that cannot tell right from wrong |
| Decides, not across a boundary | `parseServiceScope` (`web/domain/agreement/index.ts`), view state table (`web/components/agreements/service-scope.tsx`) | own layer | yes - C803 7 rejections + 2 ordering rules; C805-C807, C815, C816, C818 cover all 7 view states |
| Instrumentation | page pass-through (`app/(app)/agreements/[agreementId]/page.tsx:48`), container | none of its own; C824 | yes - C824 `:273` |

## Faults injected

F1-F5 ran in a scratch worktree at `HEAD`:
- Setup: `git worktree add --detach`, with `web/node_modules` linked as a junction.
- Each fault was applied with `sed`, run, and reverted with `git checkout -- .`.
- Teardown: the junction was removed with `rmdir`, then the worktree with `git worktree remove`.
- The real tree's `git status --porcelain` was empty before and after.

M6 and M7 are SQL faults. I was told not to change the live database, so I assessed them by reading the assertion
and the fixture, and did not run them.

| Mutation | Location | Proof run | Killed |
| --- | --- | --- | --- |
| F1 null unit sorts first (`? 1 : -1` -> `? -1 : 1`) | `web/domain/agreement/index.ts:172` | vitest `C803:`: 1 failed (`no unit last`) | yes |
| F2 reader picks live for any current version (`editable` -> `current`) | `web/infrastructure/supabase/agreements.ts:130` | vitest `C804:`: 2 failed (sent current, `{}` frozen) | yes |
| F3 frozen-empty branch removed (falls to live empty) | `web/components/agreements/service-scope.tsx:29` | vitest `C818:`: 1 failed | yes |
| F4 `Add equipment` offered to every role (`canAddEquipment={true}`) | `web/components/agreements/agreement-view.tsx:122` | vitest `C807:`: 1 failed | yes |
| F5 `plain("service_included")` dropped from RECIPES | `web/scripts/test-db/runner.mts:44` | vitest `C830:`: 1 failed | yes |
| M6 task `order by k.position, k.created_at, k.id` -> `order by k.created_at, k.id` | `supabase/migrations/20261027212052_service_included.sql:17` | assessed by reading, not run: both RTU tasks have `created_at = now()` (same transaction), and `md5('taskA')=093b…` < `md5('rtuTask2')=1a32…`, so C801 `:100` and C808 `:148` still see `["Replace filters", ...]` first | no - survives (assessed) |
| M7 seed update without `and v.snapshot = '{}'::jsonb` | `supabase/seed.sql:169` | assessed by reading, not run: both `SEED_BODY` runs are in one transaction, so the second run writes the same scope with the same `now()`, and `demo_seed_rerun.sql:20-23` still sees text-equal snapshots | no - survives (assessed) |

There are also SQL surfaces that I assessed as strong:
- Removing the freeze call fails C810 `:164`.
- Freezing on every transition fails C812 `:196`.
- Keeping the update grant fails C817 `:249`.
- Dropping the freeze role check fails C819 `:270`.
- Making the scope function a definer fails C802 `:124` and C823 `:282`.

## Swept

These are the Swept rows that rest on existing code. I read each one against the tree:
- `(app)` error boundary: present at `web/app/(app)/error.tsx`.
- Page `loading.tsx`: present at `web/app/(app)/agreements/[agreementId]/loading.tsx`.
- `transitions.sql` C5 (revise copy): unchanged in this range (`:93-113`).
- `rls_isolation.sql` C4: unchanged (`:115-121`).
- `rls_roles.sql` C13: unchanged (`:60-65`).

Every other row cites checks of this feature.

## Notes outside the checks

- **Writers can still delete a frozen version.** Door 3's threat is "any writer could rewrite what a customer was
  sent". Revoking update closes rewriting. Writers keep `delete` on `agreement_versions` through the init policy at
  `supabase/migrations/20261019174738_init.sql:312`, so they can still delete a sent version. A version with lines is
  probably refused by `service_lines_frozen` through the cascade, but one without lines is not. This is not in Out of
  scope (which names only extra inserts). I record it as an observation, not a check finding.
- **The view does not sort.** C805 passes types that are already ordered. Ordering is the parser's job (C803), and the
  reader always parses, so this is consistent with door 1 ("ordered at render" = parse time).

## Gate

- `npx vitest run ... -t "C8[0-3][0-9]:"`: 23 passed, 0 failed
- `npm test`: 55 files, 1250 passed, 0 failed
- `npm run test:db`: 16 passed, 0 failed
- `npm run test:db service_included` and `npm run test:db demo_seed`: PASS
- `npx tsc --noEmit`: exit 0
- `npm run lint`: exit 0
- `npx next build`: not run (instructed), no record
- greps: C809 `1`/`1`, C819 `2`, C831 `2`/`1`/`5`
- MCP: `list_migrations`, `get_advisors`, `generate_typescript_types` and read-only `execute_sql`, as above

## Ranked gaps

1. **M7, the seed guard (C821, AC 15, AD-062).** The `snapshot = '{}'` guard at `supabase/seed.sql:169` can be
   removed without any proof failing, because both seed runs share a transaction and `now()`. Fix in the test: on the
   second run, compare against snapshots whose `takenAt` was moved before the run, or set a distinct snapshot on one
   frozen version between the runs.
2. **M6, task position order (C801/C808, door 1).** The fixture's id and created_at order equal its position order.
   Fix: give the new RTU task position 0 (or insert a task whose md5 id sorts first at a higher position), so only
   `position` yields the expected list.
3. **Viewer delete on `agreement_versions` is no longer asserted.** The loop at `supabase/tests/rls_roles.sql:49`
   drops the table from both halves of C12. The user approved the loop change. Restore the delete half for
   `agreement_versions`, and correct the supabase-init coverage row
   (`.specs/features/supabase-init/checks.md:184`).
4. **C829 `npx next build` has no result.** Run it, for example in a separate worktree so the running dev server's
   `.next` is untouched, and record the result.
5. **Parser rejection members are unproven** (`web/domain/agreement/index.ts`): a malformed `takenAt` (which would
   otherwise reach `new Date()` and the formatter), a non-text `code`, a non-array `tasks` or `assets`, and an asset
   field that is not text or null.
6. **Non-blocking.**
   - C822 rests on the builder's record.
   - The Build record says `database.types.ts` is "unchanged" (`checks.md:305`), but this range adds its
     `site_service_scope` line.
