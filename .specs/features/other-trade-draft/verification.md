# "Other" trade draft verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: a67d21e..c788e59
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

21 of 31 checks proven. Three things block the verdict. (1) The committed SQL proof does not run at HEAD. `npm run test:db other_trade_draft` fails with `function "add_catalog_draft" already exists with same argument types`, because the hosted project already has the function. The plan and checks say it was never applied there. (2) One fault survived: the production 120 s timeout is not asserted. (3) C4128 (live Playwright) was not run.

## Hosted database state (read-only queries, nothing written)

- `public.add_catalog_draft(p_org_id uuid, p_trade text, p_types jsonb)` exists on the hosted project (`gnxebrtcpbujhvcamtoe`). It is `prosecdef=false` with `search_path=""`, `anon` cannot execute it and `authenticated` can. Its `prosrc` md5 is `acf0c8451c377be610cab99464beec39`, which equals the md5 of the function body in `supabase/migrations/20261112100000_add_catalog_draft.sql` with CRLF line endings. So this exact migration was applied from a Windows checkout.
- `supabase_migrations.schema_migrations` has **no** row for it (0 rows with `draft` in the name). Hosted version `20261112100000` is already taken by a different migration, `add_catalog_types`. That migration comes from an earlier attempt at this feature on another branch (commit `252229b`, only on `origin/worktree-plan-next-roadmap`), and its function `public.add_catalog_types(uuid, jsonb)` is also still live.
- Consequences:
  - `checks.md:11`, `plan.md` (migration header comment at `supabase/migrations/20261112100000_add_catalog_draft.sql:2`) and `supabase/tests/other_trade_draft.sql:3` all say "not applied to the hosted project". That is false.
  - The recipe's `create function` collides, so every SQL-proven check fails as committed.
  - A future `db push` of this file meets a version that is already recorded under another name.
  - Rule 8 (owner go-ahead before applying) looks breached. Who applied it is not visible from here.
- Supplementary evidence: in a scratch worktree I changed only `create function` to `create or replace function`. The body was unchanged, so on hosted this replaces the function with itself, inside the rolled-back transaction. With that change the recipe printed `PASS other_trade_draft` / `1 passed, 0 failed`. That is evidence of behaviour, but it is not the committed proof. The SQL rows below are FAIL for that reason, with the substitute result cited.

## Checks

Web proofs ran as one vitest invocation over 9 files with `-t "C41[0-3][0-9]:|C2817:"` and `--reporter=verbose`. Result: 9 files passed, 49 tests passed, 21 skipped. Each named test appeared individually as passed. SQL ran as `npm run test:db other_trade_draft` (`FAIL ... already exists`), then as the substitute described above (`PASS`). Each SQL assertion is a `tests.ok`, which raises on failure (`supabase/tests/fixture.sql:37`).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C4100 | draft form on an empty catalog, absent with a type | vitest `C4100:` passed | `web/components/setup/setup.test.ts:123` - `expect(empty).toContain("Draft your catalog")`; `:127` - `toContain("No types yet")`; `:130` - `expect(full).not.toContain("Draft your catalog")` | PASS |
| C4101 | valid trade, owner and admin, drafter called once, `ok` | vitest `C4101:` (2 tests) passed | `web/application/use-cases/draft-catalog.test.ts:25` - `toEqual({ ok: true, trade: "pest control", types: [goodType] })`; `:26` - `expect(draft).toHaveBeenCalledTimes(1)` | PASS |
| C4102 | 23 bound edges | vitest `C4102:` (3 tests) passed | `web/domain/catalog-draft/index.test.ts:34` - `expect(validateDraft(input) !== null, label).toBe(ok)` over the 23 cases at `:10-32`; `:38` - case-insensitive duplicate `toBeNull()` | PASS |
| C4103 | empty, 61 chars or `;` is invalid with no call; 1, 60 and `, & / ' -` pass | vitest `C4103:` (domain, use case, action) passed | `web/domain/catalog-draft/index.test.ts:51-57` - `validateTrade("a".repeat(61))).toBeNull()`, `validateTrade("Pest control, A&B / it's-ok")).toBe(...)`; `web/application/use-cases/draft-catalog.test.ts:34-36` - `toEqual({ ok: false, code: "invalid" })`, `expect(draft).not.toHaveBeenCalled()` | PASS |
| C4104 | bad Claude answers are `unavailable` | vitest `C4104:` passed | `web/infrastructure/claude/catalog-drafter.test.ts:45` - `toEqual({ ok: false, code: "unavailable" })` over 6 bad answers; `:48` good answer `toEqual({ ok: true, types: [goodType] })` | PASS |
| C4105 | throw, refusal, no key and **120 s** give `unavailable`; log holds no input | vitest `C4105:` passed | `web/infrastructure/claude/catalog-drafter.test.ts:62` builds the drafter with an explicit `timeoutMs` of `120_000`; `:68` `expect(settled).toBe(false)` at 119,999 ms; `:70` `unavailable`; `:72` `toHaveBeenCalledTimes(4)`; `:74-75` `not.toContain`. The default `DRAFT_TIMEOUT_MS` (`web/infrastructure/claude/catalog-drafter.ts:9`), which the container uses (`web/composition/index.ts:206` passes no `timeoutMs`), is never exercised: fault F4 survived | PARTIAL - 120 s production default unproven |
| C4106 | estimator, viewer and no membership are `forbidden`; no drafter call | vitest `C4106:` (use case, action) passed | `web/application/use-cases/draft-catalog.test.ts:43` - `toEqual({ ok: false, code: "forbidden" })`; `:44` - `expect(draft).not.toHaveBeenCalled()` | PASS |
| C4107 | a type present gives `not_empty`; no drafter call | vitest `C4107:` passed | `web/application/use-cases/draft-catalog.test.ts:50` - `toEqual({ ok: false, code: "not_empty" })`; `:51` - `not.toHaveBeenCalled()` | PASS |
| C4108 | request carries trade, notes and file only; prompt calls it data | vitest `C4108:` passed | `web/infrastructure/claude/catalog-drafter.test.ts:81-83` `toContain`; `:86` `toMatch(/data from the contractor, not instructions/)`; `:88` `not.toMatch(/org_id\|@\|company/i)` | PASS |
| C4109 | door 1 schema: additionalProperties false twice, months enum 1-12, limits in prompt, DraftType has exactly 3 keys | vitest `C4109:` passed | `web/infrastructure/claude/catalog-drafter.test.ts:93-98` - `additionalProperties).toBe(false)` (both levels), `months.items.enum).toEqual([1..12])`, `toContain("between 1 and 40 types")`, `toContain("up to 12 short tasks")`; `:95` keys `["months","name","tasks"]`. DraftType is a TS type; the runtime shape is shown by `:48` `toEqual` | PASS |
| C4110 | xlsx, csv, docx and pdf at 4,194,304 bytes are parsed; text or pdf bytes reach Claude | vitest `C4110:` (use case, adapter, action) passed | `web/application/use-cases/draft-catalog.test.ts:57` text `toHaveBeenCalledWith`; `:61` pdf; `:66` `expect(parse, name).toHaveBeenCalledTimes(1)` for 4 types at `MAX_DRAFT_FILE_BYTES`; `web/infrastructure/claude/catalog-drafter.test.ts:104-105` document block `toEqual({ type: "base64", media_type: "application/pdf", ... })` | PASS |
| C4111 | other type, 4,194,305 bytes or unreadable gives `unreadable`/`too_large`; no drafter call | vitest `C4111:` (use case, action) passed | `web/application/use-cases/draft-catalog.test.ts:79` - `toEqual({ ok: false, code })`; `:80` - `not.toHaveBeenCalled()` | PASS |
| C4112 | Claude `too_large` on a document gives `too_large` | vitest `C4112:` (use case, adapter) passed | `web/infrastructure/claude/catalog-drafter.test.ts:114` - `toEqual({ ok: false, code: "too_large" })`; `web/application/use-cases/draft-catalog.test.ts:86` | PASS |
| C4113 | file not stored | vitest `C4113:` passed | `web/application/use-cases/draft-catalog.test.ts:93` - `expect(makeDraftCatalog.length).toBe(3)`; `:95` - `not.toContain("9,9,9")`. The test title says "one drafter call" but `:94` asserts `parse` was called once | PASS |
| C4114 | rename, remove type, months and remove task present; no add controls | vitest `C4114:` passed | `web/components/setup/setup.test.ts:140` - `match(/aria-pressed/g)).toHaveLength(12)`; `:142` - `not.toMatch(/>\s*(Add (a )?(type\|task)\|New (type\|task))/i)`; nearby `toContain('value="Rodent stations"')`, `"Remove Rodent stations"`, `"Remove task Check bait"` | PASS |
| C4115 | accept calls the writer once with the edited draft and returns the count | vitest `C4115:` (use case, action) passed | `web/application/use-cases/draft-catalog.test.ts:113-115` - `toEqual({ ok: true, added: 2 })`, `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith("org-1", "pest control", [...])`; `web/app/setup/draft-actions.test.ts:86` - `revalidatePath).toHaveBeenCalledWith("/setup")`. No test drives an edit in `DraftReview` and checks the posted `types` payload (`web/components/setup/draft-panel.tsx:27`) | PASS |
| C4116 | function writes rows with pack null, code, tasks in order, months; trade appended once | `npm run test:db other_trade_draft` **FAILED as committed** (function already exists); substitute run passed | `supabase/tests/other_trade_draft.sql:114-122` - `added = 3`, `t.pack is null`, `t.code = 'RODENT_STATIONS'`, `default_visit_months = '{3,9}'`, task order `= array['Check bait', ...]`, `trade_context = 'HVAC and mechanical, pest control'`; `:138` `'pest control'` (once) | FAIL - committed proof errors at HEAD |
| C4117 | month 13, name 61, task 201, case-duplicate give `23514` and nothing is written | same SQL run, FAILED as committed; substitute passed | `supabase/tests/other_trade_draft.sql:67` - `otd_state(...) = '23514'`; `:68` - `tests.otd_untouched()`; `:73` all-or-nothing | FAIL - committed proof errors at HEAD |
| C4118 | `55000` writes nothing; screen says "no longer empty" | SQL FAILED as committed (substitute passed); vitest `C4118:` passed | `supabase/tests/other_trade_draft.sql:96` - `= '55000'`; `:98` count unchanged; `web/components/setup/setup.test.ts:148` - `toContain("Your catalog is no longer empty")` | FAIL - SQL half errors at HEAD |
| C4119 | estimator, viewer and another org's owner get `42501` | SQL FAILED as committed; substitute passed | `supabase/tests/other_trade_draft.sql:85` - `= '42501'`; `:87` - `otd_untouched()` | FAIL - committed proof errors at HEAD |
| C4120 | drafting writes nothing | vitest `C4120:` passed | `web/app/setup/draft-actions.test.ts:44` - `expect(acceptCatalogDraft).not.toHaveBeenCalled()`. The "double writer" `writerAdd` (`:7`) is never injected anywhere, so `:45` `expect(writerAdd).not.toHaveBeenCalled()` can never fail. That assertion proves nothing on its own; `:44` carries the claim | PASS |
| C4121 | code collision gets a numeric suffix; a plain name keeps its code | SQL FAILED as committed; substitute passed | `supabase/tests/other_trade_draft.sql:123` - `code = 'RODENT_STATIONS_2'`; `:124` - `code = 'GUTTERS'` | FAIL - committed proof errors at HEAD |
| C4122 | drafted types sit under "Added by you" with a count in the org's words | vitest `C4122:` passed | `web/domain/org-settings/setup.test.ts:122` - `toMatchObject({ pack: null, label: "Added by you", count: 2, ... })`; `:123` - `countText).toBe("2 equipment types")` | PASS |
| C4123 | door 2 shape: invoker, search_path `''`, anon and public denied, authenticated allowed, returns integer | SQL FAILED as committed; substitute passed | `supabase/tests/other_trade_draft.sql:149-153` - `prosecdef is false`, `proconfig @> array['search_path=""']`, `ret = 'integer'`, `not has_function_privilege('anon', ...)`, `has_function_privilege('authenticated', ...)`. `public` is not asserted directly; it is implied, since anon is a member of PUBLIC | FAIL - committed proof errors at HEAD |
| C4124 | writer sends p_org_id, p_trade, p_types and maps the 4 errors | vitest `C4124:` (6 tests) passed | `web/infrastructure/supabase/catalog-writer.test.ts:15` - `toHaveBeenCalledWith("add_catalog_draft", { p_org_id, p_trade, p_types })`; `:27` - `toEqual({ ok: false, code: outcome })` over 42501, 55000, 23514, XX000 | PASS |
| C4125 | no stored draft | vitest `C4125:` passed | `web/app/setup/setup-wiring.test.ts:49` - `migration).not.toMatch(/create\s+table/i)`; `:51` - `actions).not.toMatch(/\.from\(\|\.insert\(\|\.rpc\(\|storage/i)`; `:53` use case regex | PASS |
| C4126 | status text, disabled submit, **a second click sends no second request** | vitest `C4126:` passed | `web/components/setup/setup.test.ts:153` - `toContain('role="status"')`; `:155` - `toMatch(/<button[^>]*disabled[^>]*>Drafting/)`. Pending is forced through the test-only `initialPending` prop. No assertion exercises the second-click guard (`web/components/setup/draft-panel.tsx:117`) or that the real action sets pending | PARTIAL - second-click clause unasserted |
| C4127 | "We couldn't draft your catalog. Try again.", Try again, trade, notes **and file choice** kept | vitest `C4127:` passed | `web/components/setup/setup.test.ts:160-163` - message `toContain`, `toMatch(/<button[^>]*>Try again/)`, `toContain('value="pest control"')`, `toContain(">Commercial kitchens</textarea>")`. Nothing asserts that the file choice is kept | PARTIAL - file-choice clause unasserted |
| C4128 | live Playwright at 375/768/1440, no horizontal scroll, 44 px targets, no console error | not run: author-run by definition and the author did not run it (demo org has a full catalog, and the author believed the migration was not applied) | no evidence - no file:line exists for a live pass | NOT RUN - unproven |
| C4129 | container exposes drafter and writer from `ANTHROPIC_API_KEY` and the request client; `bodySizeLimit` `5mb` | vitest `C4129:` passed | `web/composition/draft-wiring.test.ts:20-21` - `typeof container.draftCatalog).toBe("function")`; `:23` - `toMatch(/serverActions:\s*\{\s*bodySizeLimit:\s*"5mb"/)`; `:25` - `toMatch(/claudeCatalogDrafter\(\{ apiKey: process\.env\.ANTHROPIC_API_KEY \}\)/)`. The request-client clause is not asserted; I read it directly at `web/composition/index.ts:207` (`supabaseCatalogWriter(supabase)`, where `supabase` is the cookie-bound `createServerClient` at `:109`) | PASS |
| C4130 | read-only review unchanged | vitest `C2817:` (the named proof, 2 tests) and `C4130:` passed | `web/components/setup/setup.test.ts:95` - `toContain("No types yet")` (C2817, untouched by the diff); `:169-170` - `toContain("No types yet")`, `not.toMatch(/<button\|<a \|<input\|draft\|generate/i)`. checks.md names `-t "C2817:"`, not the C4130 test that exists | PASS |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `draftCatalogAction` codes (7) | `web/application/use-cases/draft-catalog.ts:35-57`, `web/app/setup/draft-actions.ts:28-35` | ok C4101 · invalid C4103 · forbidden C4106 · not_empty C4107 · unreadable C4111 · too_large C4111 C4112 · unavailable C4104 C4105 (plus catalog-read failure, `draft-catalog.test.ts:101`); action pass-through of every failure code `draft-actions.test.ts:75` | - |
| `acceptDraftAction` codes (5) | `web/app/setup/draft-actions.ts:42-61`, `catalog-writer.ts:17-22` | ok C4115 · invalid C4117 (use case, non-JSON body) C4124 · forbidden C4119 C4124 · not_empty C4118 C4124 · unavailable C4124 | - |
| `add_catalog_draft` outcomes (4) | migration `:27`, `:34`, `:38-77`, `:114` | count C4116 · 42501 C4119 · 55000 C4118 · 23514 C4117. All four rest on the SQL recipe, which errors as committed | count, 42501, 55000, 23514 (committed recipe fails at HEAD; only the substitute run passes) |
| draft bounds in validateDraft (23 edges) | `web/domain/catalog-draft/index.ts:20-49` | C4102 table, all 23 at `index.test.ts:10-32` | - |
| function-side bounds (claimed by Swept "every bound ... again in the function") | migration `:38-77` | types 0, months count 0, month 13, name 61, task 201, case duplicates, bad trade at `other_trade_draft.sql:55-74` | types 41, tasks 13, month value 0, name 60 accepted (no SQL case for any of them) |
| trade name cases (7) | `index.ts:11-18` | empty, 1, 60, 61, `;`, alphabet C4103 · valid C4101 | - |
| Claude failure cases (9) | `catalog-drafter.ts:85-106` | not JSON, no types, empty, wrong type, bound C4104 · thrown, refusal, no key C4105 · 120 s C4105 only with an injected `timeoutMs` | 120 s production default (`DRAFT_TIMEOUT_MS`, F4 survived) |
| roles and membership (5) | `draft-catalog.ts:26-27` | owner, admin C4101 · estimator, viewer, null C4106 | - |
| file types (5) and size edges (2) | `draft-catalog.ts:47-50`, `draft-actions.ts:28` | xlsx csv docx pdf C4110 · other C4111 · 4,194,304 C4110 · 4,194,305 C4111 | - |
| draft edit controls (6) | `web/components/setup/draft-panel.tsx:44-84` | rename, remove type, months, remove task, add type absent, add task absent C4114 (presence only) | - |
| S4 states (loading, error, unavailable) | plan Observable, `draft-panel.tsx:111-187` | loading C4126 · not_empty C4118 · unavailable C4127 · one request per click: no proof · file choice kept: no proof | second-click guard (AC 23); file choice kept (AC 24) |
| layout at 375/768/1440 (AC 25) | plan AC 25 | C4128 not run | 375, 768, 1440 |
| doors (3) | plan Landing | door 1 C4109 · door 2 C4123 C4124 · door 3 C4125 | door 2 shape (C4123 recipe fails as committed) |
| entity relations (2) | plan Relations | `asset_types` rows, `asset_type_tasks` in order C4116 | both (C4116 recipe fails as committed) |
| startup config (2 places) | read directly: `web/composition/index.ts:206-207`, `web/next.config.ts:6` | container C4129 · next.config C4129 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `domain/catalog-draft/index.ts`, `application/use-cases/draft-catalog.ts` | own layer: `index.test.ts`, `draft-catalog.test.ts` | yes - every bound edge, trade case, role, empty, file and drafter branch asserted |
| Entry point that decides nothing | `app/setup/draft-actions.ts`, `app/setup/page.tsx` | boundary: `draft-actions.test.ts` | yes - accepted input, each refusal code, non-JSON body, signed-out redirect asserted |
| Adapter | `infrastructure/claude/catalog-drafter.ts`, `infrastructure/supabase/catalog-writer.ts` | client double | partly - request payload and every error reply asserted, but the shipped 120 s default timeout is not (F4 survived) |
| SQL function that decides | `add_catalog_draft` | one rolled-back recipe | not met - the recipe exists and covers each code, but it fails at HEAD as committed |
| Instrumentation, pass-throughs | `components/setup/draft-state.ts`, `composition/index.ts` | via consumers | yes |

## Swept rows read against the code

- concurrency, "same advisory lock `create_task_library_type` takes": present. `supabase/migrations/20261112100000_add_catalog_draft.sql:32` and `supabase/migrations/20261109120000_type_editor.sql:134` both run `pg_advisory_xact_lock(hashtextextended('task_library_types:' \|\| p_org_id::text, 0))`.
- validation, "every bound at the edge ... and again in the function": overstated. The function enforces 40 types and 12 tasks (`migration:41`, `:72`), but no SQL case drives 41 types, 13 tasks or month 0 (see Coverage).
- failure modes, "a bad draft writes nothing: one transaction": holds in the code. Every check raises before or inside the per-type loop, and plpgsql aborts the whole call. Asserted at `other_trade_draft.sql:73` (substitute run only).
- idempotency / state transitions, "55000": present at `migration:34-36`.

## Plan and checks consistency after the mid-build edits

- 60 not 80: consistent. Plan AC 2, 3 and 4, C4102, C4103, `MAX_TYPE_NAME`/`MAX_TRADE_LENGTH` = 60 (`index.ts:7,9`) and the SQL `{1,60}` (`migration:38`) all agree.
- No "task library" copy: consistent (`setup.test.ts:164` `not.toMatch(/task library/i)`). But `plan.md:127` (Out of scope) still says "the task library owns later changes", which contradicts `plan.md:7` and `:30` (that screen was removed).
- `revalidatePath` instead of a redirect: consistent (`draft-actions.ts:60`, `draft-actions.test.ts:86-87`).
- Months as an enum, limits in prompt and validator: consistent with Landing note `plan.md:58` and C4109.
- `checks.md:13` says "Live check C4127"; the live check is C4128.
- `checks.md:11`, the migration header (`migration:2`) and the recipe header (`other_trade_draft.sql:3`) claim the migration is not applied to hosted. That is false (see Hosted database state).
- C4130's proof names `-t "C2817:"` while a dedicated `C4130:` test exists and is not referenced. Both pass.
- `web/scripts/test-db/runner.test.ts`: only counts changed (32 -> 33 recipes, 34 -> 35 files, 31 -> 32 passed), plus `"other_trade_draft"` appended to the `ALL` order list. That matches the new `RECIPES` entry in `runner.mts:62`. Count update only, confirmed (`runner.test.ts` 26 passed).

## Faults injected

Scratch: `git worktree add --detach <scratchpad>/wt HEAD`, with `web/node_modules` as a junction to the main tree. Real-tree `git status --porcelain` was empty before and empty after the worktree was removed.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: `MANAGERS` gains `"estimator"` | `web/application/use-cases/draft-catalog.ts:26` | yes - C4106 failed |
| F2: not_empty `> 0` -> `> 1` | `web/application/use-cases/draft-catalog.ts:40` | yes - C4107 failed |
| F3: `MAX_TYPE_NAME` 60 -> 61 | `web/domain/catalog-draft/index.ts:7` | yes - C4102 failed |
| F4: `DRAFT_TIMEOUT_MS` 120_000 -> 60_000 | `web/infrastructure/claude/catalog-drafter.ts:9` | no - survived; C4105 and all 127 tests in `infrastructure/claude` and `composition` still passed |
| F5: 55000 check disabled (`if false and exists ...`), on top of the create-or-replace substitute | `supabase/migrations/20261112100000_add_catalog_draft.sql:34` | yes - `FAIL other_trade_draft: C4118 not empty: did not raise 55000` |

## Gate

- `cd web && npx vitest run` - 250 files, 4373 passed, 0 failed
- feature proofs (one invocation, 9 files) - 49 passed, 0 failed, 21 skipped by filter
- `cd web && npm run test:db other_trade_draft` as committed - 0 passed, 1 failed (`function "add_catalog_draft" already exists with same argument types`)
- same recipe with `create or replace` in the scratch worktree - 1 passed, 0 failed (supplementary, not the committed proof)

## Ranked gaps

1. The SQL proof fails at HEAD because `add_catalog_draft` is already on the hosted project with no migration record, and version `20261112100000` there belongs to `add_catalog_types`. C4116, C4117, C4118, C4119, C4121 and C4123 are not proven as committed. The "not applied" claims in checks.md, the migration and the recipe are false, and a rule 8 breach is likely - `supabase/tests/other_trade_draft.sql:1`, `supabase/migrations/20261112100000_add_catalog_draft.sql:8`.
2. The production 120 s timeout is unasserted and F4 survived - C4105 - `web/infrastructure/claude/catalog-drafter.test.ts:62`.
3. The live layout and touch pass was not run - C4128 - no evidence.
4. AC 23 "one request per click" is unasserted - C4126 - `web/components/setup/draft-panel.tsx:117`.
5. AC 24 "file choice kept" is unasserted - C4127 - `web/components/setup/setup.test.ts:158`.
6. The function-side bounds claimed in Swept (41 types, 13 tasks, month 0) have no SQL case - `supabase/tests/other_trade_draft.sql:54`.
7. Smaller issues:
   - the vacuous `writerAdd` assertion (`web/app/setup/draft-actions.test.ts:45`)
   - `checks.md:13` names C4127 where it means C4128
   - stale "task library owns later changes" at `plan.md:127`
   - C4130's proof id mismatch
   - no test drives the edited `types` payload (`draft-panel.tsx:27`)
