# "Other" trade draft verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: a67d21e..c541ee9 (fix diff since round 1: c788e59..c541ee9, commits b49c1f6 and c541ee9)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

28 of 31 checks proven at c541ee9. Round 1's SQL blocker is fixed: the recipe runs and passes, so C4116 to C4119, C4121 and C4123 now pass. The default 120 s timeout is now asserted, and both mutants on it were killed (C4105). Three checks still block the verdict:

1. **C4126 is PARTIAL.** The new "second submit" assertion cannot fail. `useActionState` queues the second dispatch, and the test never checks the call count after the first request settles. Removing the pending guard survived the C4126 proof.
2. **C4127 is PARTIAL.** The file choice is proven against a remount of the form, but not against a form reset. The test stubs `files` on the instance, so `form.reset()` cannot clear it, and that mutant survived.
3. **C4128 is NOT RUN.** The live pass is still not run by the author.

## Hosted database state (read-only query, nothing written) - verified at c541ee9

- One `select` against `pg_proc` and `supabase_migrations.schema_migrations` returned the same values as in round 1:
  - `add_catalog_draft` exists with `prosrc` md5 `acf0c8451c377be610cab99464beec39`, `prosecdef=false` and `search_path=""`, and `anon` cannot execute it.
  - 0 migration rows name `draft`.
  - Version `20261112100000` is still recorded as `add_catalog_types`.
- The owner confirmed applying the migration on 2026-11-12. The file now says `create or replace` (`supabase/migrations/20261112100000_add_catalog_draft.sql:9`), so the recipe replays it harmlessly inside the rolled-back transaction.
- Still open, and the owner's call (not a check failure): the version collision and the missing migration row. A future `db push` of this file meets `20261112100000` already recorded under another name. `.specs/STATE.md` records this as open.

## Checks - verified at c541ee9

Web proofs ran as one vitest invocation over 10 files (the 9 from round 1 plus the new `components/setup/draft-panel.test.ts`), with `-t "C41[0-3][0-9]:|C2817:"` and `--reporter=verbose`. Result: 10 files passed, 52 passed, 21 skipped. Each named test appeared individually with a check mark. SQL ran as `cd web && npm run test:db other_trade_draft`: `PASS other_trade_draft` / `1 passed, 0 failed`, in one rolled-back transaction. Each SQL assertion is a `tests.ok`, which raises on failure (`supabase/tests/fixture.sql:37`).

Rows the fix did not touch keep their round 1 evidence. They were re-run at HEAD (green) and their citations are in files the fix did not change. They are marked `carried from c788e59`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C4100 | draft form on an empty catalog, absent with a type | vitest `C4100:` passed | carried from c788e59: `web/components/setup/setup.test.ts:123` - `expect(empty).toContain("Draft your catalog")`; `:130` - `expect(full).not.toContain("Draft your catalog")` | PASS |
| C4101 | valid trade, owner and admin, drafter called once, `ok` | vitest `C4101:` (2) passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:25` - `toEqual({ ok: true, trade: "pest control", types: [goodType] })`; `:26` - `toHaveBeenCalledTimes(1)` | PASS |
| C4102 | 23 bound edges | vitest `C4102:` (3) passed | carried from c788e59: `web/domain/catalog-draft/index.test.ts:34` - `expect(validateDraft(input) !== null, label).toBe(ok)` over `:10-32` | PASS |
| C4103 | trade name cases; invalid calls nothing | vitest `C4103:` (domain, use case, action) passed | carried from c788e59: `web/domain/catalog-draft/index.test.ts:51-57`; `web/application/use-cases/draft-catalog.test.ts:34-36` - `toEqual({ ok: false, code: "invalid" })`, `not.toHaveBeenCalled()` | PASS |
| C4104 | bad Claude answers are `unavailable` | vitest `C4104:` passed | carried from c788e59: `web/infrastructure/claude/catalog-drafter.test.ts:45` - `toEqual({ ok: false, code: "unavailable" })` over 6 bad answers | PASS |
| C4105 | throw, refusal, no key and **120 s** give `unavailable`; log holds no input | vitest `C4105:` (2) passed | verified at c541ee9: `web/infrastructure/claude/catalog-drafter.test.ts:122` - `expect(DRAFT_TIMEOUT_MS).toBe(120_000)`; `:124` builds the drafter with **no** `timeoutMs`, so the default param (`web/infrastructure/claude/catalog-drafter.ts:82`) is exercised; `:128` - `expect(result).toBeUndefined()` at 119,999 ms; `:130` - `toEqual({ ok: false, code: "unavailable" })` at 120,000 ms. Throw, refusal, no key and log hygiene: `:62-75` as in round 1. F1 and F1b killed | PASS |
| C4106 | estimator, viewer, no membership `forbidden` | vitest `C4106:` passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:43-44` | PASS |
| C4107 | a type present gives `not_empty` | vitest `C4107:` passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:50-51` | PASS |
| C4108 | request carries trade, notes, file only; prompt calls it data | vitest `C4108:` passed | carried from c788e59: `web/infrastructure/claude/catalog-drafter.test.ts:81-88` | PASS |
| C4109 | door 1 schema | vitest `C4109:` passed | carried from c788e59: `web/infrastructure/claude/catalog-drafter.test.ts:93-98` - `additionalProperties).toBe(false)`, `months.items.enum).toEqual([1..12])` | PASS |
| C4110 | xlsx, csv, docx, pdf at 4,194,304 bytes parsed; text or pdf bytes reach Claude | vitest `C4110:` (3) passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:66` - `expect(parse, name).toHaveBeenCalledTimes(1)`; `web/infrastructure/claude/catalog-drafter.test.ts:104-105` | PASS |
| C4111 | other type, 4,194,305 bytes or unreadable; no drafter call | vitest `C4111:` (2) passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:79-80` | PASS |
| C4112 | Claude `too_large` on a document gives `too_large` | vitest `C4112:` (2) passed | carried from c788e59: `web/infrastructure/claude/catalog-drafter.test.ts:114` - `toEqual({ ok: false, code: "too_large" })` | PASS |
| C4113 | file not stored | vitest `C4113:` passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:93` - `expect(makeDraftCatalog.length).toBe(3)`; `:95` - `not.toContain("9,9,9")` | PASS |
| C4114 | edit controls present, no add controls | vitest `C4114:` passed | carried from c788e59: `web/components/setup/setup.test.ts:140` - `toHaveLength(12)`; `:142` - `not.toMatch(/>\s*(Add (a )?(type\|task)\|New (type\|task))/i)` | PASS |
| C4115 | accept calls writer once with the edited draft, returns count | vitest `C4115:` (2) passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:113-115` - `toEqual({ ok: true, added: 2 })`, `toHaveBeenCalledTimes(1)` | PASS |
| C4116 | rows with pack null, code, tasks in order, months; trade appended once | `npm run test:db other_trade_draft` PASS | verified at c541ee9: `supabase/tests/other_trade_draft.sql:117` - `added = 3`; `:120` - `t.pack is null`; `:121` - `t.code = 'RODENT_STATIONS'`; `:122` - `default_visit_months = '{3,9}'`; `:123` - `array_agg(description order by position) = array['Check bait', 'Replace bait', 'Log activity']`; `:125` - `trade_context = 'HVAC and mechanical, pest control'`; `:141` - `= 'pest control'` after a second accept | PASS |
| C4117 | month 13, name 61, task 201, case duplicate (and the bound cases) give `23514`, nothing written | same SQL run PASS | verified at c541ee9: `supabase/tests/other_trade_draft.sql:70` - `tests.otd_state('uOw', 'orgE', 'pest control', b) = '23514'` over 9 bad drafts `:55-63` (month 13, name 61, task 201, case duplicate, 0 types, 0 months, month 0, 41 types, 13 tasks); `:71` - `tests.otd_untouched()` after each; `:76` all-or-nothing; `:77-78` bad trade | PASS |
| C4118 | `55000` writes nothing; screen says "no longer empty" | SQL PASS; vitest `C4118:` passed | verified at c541ee9: `supabase/tests/other_trade_draft.sql:99-100` - `= '55000'`; `:101` - count `= before_count`; carried from c788e59: `web/components/setup/setup.test.ts:148` - `toContain("Your catalog is no longer empty")` | PASS |
| C4119 | estimator, viewer, other org's owner get `42501` | SQL PASS | verified at c541ee9: `supabase/tests/other_trade_draft.sql:88` - `tests.otd_state(u, 'orgE', ...) = '42501'` for `uEs`, `uVw`, `uOf`; `:90` - `tests.otd_untouched()` | PASS |
| C4120 | drafting writes nothing | vitest `C4120:` passed | verified at c541ee9 (file touched): `web/app/setup/draft-actions.test.ts:43` - `expect(acceptCatalogDraft).not.toHaveBeenCalled()`. The vacuous `writerAdd` assertion from round 1 is removed | PASS |
| C4121 | collision gets numeric suffix; plain name keeps its code | SQL PASS | verified at c541ee9: `supabase/tests/other_trade_draft.sql:126` - `code = 'RODENT_STATIONS_2'`; `:127` - `code = 'GUTTERS'` | PASS |
| C4122 | drafted types under "Added by you" with count | vitest `C4122:` passed | carried from c788e59: `web/domain/org-settings/setup.test.ts:122-123` - `countText).toBe("2 equipment types")` | PASS |
| C4123 | door 2 shape: invoker, search_path `''`, anon and public denied, authenticated allowed, integer | SQL PASS | verified at c541ee9: `supabase/tests/other_trade_draft.sql:152` - `f.prosecdef is false`; `:153` - `proconfig @> array['search_path=""']`; `:154` - `ret = 'integer'`; `:155` - `not has_function_privilege('anon', ...)`; `:156` - `has_function_privilege('authenticated', ...)`. `public` is implied by `anon` (a member of PUBLIC), as in round 1 | PASS |
| C4124 | writer sends p_org_id, p_trade, p_types and maps 4 errors | vitest `C4124:` (6) passed | carried from c788e59: `web/infrastructure/supabase/catalog-writer.test.ts:15`, `:27` | PASS |
| C4125 | no stored draft | vitest `C4125:` passed | carried from c788e59: `web/app/setup/setup-wiring.test.ts:49` - `not.toMatch(/create\s+table/i)`; `:51` | PASS |
| C4126 | status text, disabled submit, **a second click sends no second request** | vitest `C4126:` (setup, draft-panel) passed | verified at c541ee9: `web/components/setup/draft-panel.test.ts:47` - `toHaveBeenCalledTimes(1)`; `:48` - `.disabled).toBe(true)`; `:49` - `toContain("Claude is drafting")`; `:51` - `expect(draftAction).toHaveBeenCalledTimes(1)` after a second submit. `:51` cannot fail: `useActionState` queues the second dispatch and only calls `draftAction` once the first settles, and the test releases at `:52` with no assertion after it. F2 (guard at `web/components/setup/draft-panel.tsx:117` removed) survived the C4126 proof. A probe adding `toHaveBeenCalledTimes(1)` after `:52` got "called 2 times" without the guard and passed with it | PARTIAL - second-click clause not proven (F2 survived) |
| C4127 | message, Try again, trade, notes **and file choice** kept | vitest `C4127:` (setup, draft-panel) passed | verified at c541ee9: `web/components/setup/draft-panel.test.ts:64` - `toContain("We couldn't draft your catalog. Try again.")`; `:65` - `field("draft-file")).toBe(fileBefore)`; `:66` - `.files?.[0]).toBe(file)`; `:67-68` trade element and value; `:70` - `sent.get("trade")`. carried from c788e59: `web/components/setup/setup.test.ts:160-163` (message, Try again, trade, notes). `:66` reads a `files` property stubbed on the instance (`:61`), which `form.reset()` cannot clear. F3 (`event.currentTarget.reset()` in `submit`) survived, though a real browser reset empties the file choice. F3b (form remounted on failure) was killed by `:65` | PARTIAL - file kept proven against a remount, not against a reset (F3 survived) |
| C4128 | live Playwright at 375/768/1440, no horizontal scroll, 44 px targets, no console error | not run: author-run by definition, and the author has not run it | no evidence - no file:line exists for a live pass | NOT RUN - unproven |
| C4129 | container drafter and writer; `bodySizeLimit` `5mb` | vitest `C4129:` passed | carried from c788e59: `web/composition/draft-wiring.test.ts:20-25`; request client read directly at `web/composition/index.ts:207` | PASS |
| C4130 | read-only review unchanged | vitest `C4130:` and `C2817:` passed | carried from c788e59: `web/components/setup/setup.test.ts:169-170` - `toContain("No types yet")`, `not.toMatch(/<button\|<a \|<input\|draft\|generate/i)`. checks.md now names `-t "C4130:"` | PASS |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `draftCatalogAction` codes (7) | carried from c788e59: `web/application/use-cases/draft-catalog.ts:35-57`, `web/app/setup/draft-actions.ts:28-35` | ok C4101 · invalid C4103 · forbidden C4106 · not_empty C4107 · unreadable C4111 · too_large C4111 C4112 · unavailable C4104 C4105 | - |
| `acceptDraftAction` codes (5) | carried from c788e59: `web/app/setup/draft-actions.ts:42-61` | ok C4115 · invalid C4117 C4124 · forbidden C4119 C4124 · not_empty C4118 C4124 · unavailable C4124 | - |
| `add_catalog_draft` outcomes (4) | verified at c541ee9: `supabase/migrations/20261112100000_add_catalog_draft.sql:34-42`, `:61`, `:73` | count C4116 · 42501 C4119 · 55000 C4118 · 23514 C4117, all from the committed recipe passing at HEAD | - |
| function-side bounds (Swept "again in the function") | verified at c541ee9: `supabase/migrations/20261112100000_add_catalog_draft.sql:42`, `:61`, `:73`; recipe `supabase/tests/other_trade_draft.sql:55-63` | types 41 C4117 case 8 (S3 killed) · tasks 13 C4117 case 9 (S1 killed) · month value 0 C4117 case 7: 23514 and nothing written are proven, but the function's own guard is shadowed by the table constraint `asset_types_default_visit_months_check` (`supabase/migrations/20261030120000_cadence.sql:77`), which also raises 23514, so S2 survived as an observably equivalent mutant · month 13, name 61, task 201, duplicate, 0 types, 0 months C4117 | name 60 accepted, 40 types accepted and 12 tasks accepted (no SQL case drives an accept at the upper edge; the success drafts use short names and at most 3 types and 3 tasks) |
| draft bounds in validateDraft (23 edges) | carried from c788e59: `web/domain/catalog-draft/index.ts:20-49` | C4102 table, all 23 | - |
| trade name cases (7) | carried from c788e59 | C4103 · C4101 | - |
| Claude failure cases (9) | verified at c541ee9: `web/infrastructure/claude/catalog-drafter.ts:82-106` | not JSON, no types, empty, wrong type, bound C4104 · thrown, refusal, no key C4105 · 120 s default C4105 (`catalog-drafter.test.ts:122-130`, F1 and F1b killed) | - |
| roles and membership (5) | carried from c788e59 | owner, admin C4101 · estimator, viewer, null C4106 | - |
| file types (5) and size edges (2) | carried from c788e59 | xlsx csv docx pdf C4110 · other C4111 · 4,194,304 C4110 · 4,194,305 C4111 | - |
| draft edit controls (6) | carried from c788e59 | C4114 (presence only) | - |
| S4 states | verified at c541ee9: `web/components/setup/draft-panel.tsx:111-187` | loading (status, disabled) C4126 · not_empty C4118 · unavailable message C4127 · file kept across a remount C4127 (F3b killed) · one request per click: no failing proof (F2 survived) · file kept across a reset: no failing proof (F3 survived) | one request per click (AC 23); file choice kept across a form reset (AC 24) |
| layout at 375/768/1440 (AC 25) | plan AC 25 | C4128 not run | 375, 768, 1440 |
| doors (3) | verified at c541ee9 | door 1 C4109 · door 2 C4123 C4124 · door 3 C4125 | - |
| entity relations (2) | verified at c541ee9 | `asset_types` rows, `asset_type_tasks` in order C4116 | - |
| startup config (2 places) | carried from c788e59 | C4129 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `domain/catalog-draft/index.ts`, `application/use-cases/draft-catalog.ts` | own layer | yes - carried from c788e59 |
| Entry point that decides nothing | `app/setup/draft-actions.ts`, `app/setup/page.tsx` | boundary: `draft-actions.test.ts` | yes - verified at c541ee9 (the test file was touched; only the vacuous assertion was removed) |
| Adapter | `infrastructure/claude/catalog-drafter.ts`, `infrastructure/supabase/catalog-writer.ts` | client double | yes - verified at c541ee9: the shipped 120 s default is now asserted (F1 and F1b killed) |
| SQL function that decides | `add_catalog_draft` | one rolled-back recipe | yes - verified at c541ee9: the recipe passes at HEAD and drives each raised code and the success path |
| Component state (S4) | `components/setup/draft-panel.tsx` | `draft-panel.test.ts` (jsdom) | partly met - verified at c541ee9: the pending guard and the "no reset" property have tests that do not fail when either is broken (F2, F3 survived) |
| Instrumentation, pass-throughs | `components/setup/draft-state.ts`, `composition/index.ts` | via consumers | yes - carried from c788e59 |

## Swept rows read against the code - verified at c541ee9

- concurrency, same advisory lock: carried from c788e59 (`supabase/migrations/20261112100000_add_catalog_draft.sql:32`); the fix only changed line 9 and the header.
- validation, "again in the function": now driven at the reject side for 41 types, 13 tasks and month 0 (`supabase/tests/other_trade_draft.sql:61-63`). Month 0 is refused by the table constraint whether or not the function checks it. The upper accept edges (40, 12, name 60) are not driven in SQL.
- failure modes, "a bad draft writes nothing": `supabase/tests/other_trade_draft.sql:71`, `:76`, now run as committed.
- idempotency / 55000: `supabase/tests/other_trade_draft.sql:99-101`.

## Plan and checks consistency - verified at c541ee9

- Fixed since round 1:
  - `checks.md:13` now names C4128.
  - `plan.md:127` no longer says the task library owns later changes.
  - C4130's proof now names `-t "C4130:"`.
  - `checks.md:11`, the migration header (`supabase/migrations/20261112100000_add_catalog_draft.sql:2-3`) and the recipe header (`supabase/tests/other_trade_draft.sql:3-4`) no longer claim "not applied".
  - The vacuous `writerAdd` is gone.
- Still loose (format only, no check depends on it):
  - `.specs/STATE.md` still says "Verifier not yet run".
  - `checks.md:11` does not record that the owner applied the migration on 2026-11-12, which `CONTEXT.md` now states.
- The test titled "C4113 ... one drafter call" still asserts `parse` once (carried from c788e59).

## Faults injected - verified at c541ee9

Scratch: `git worktree add --detach <scratchpad>/wt2 HEAD`, with `web/node_modules` as a junction to the main tree and `web/.env.local` copied in. Each mutant was applied on its own and restored with `git -C <wt> checkout -- .` before the next. A first SQL pass restored only `web/`, so its mutants piled up. That pass is discarded, and the SQL rows below come from the rerun with each mutant isolated, confirmed by a clean worktree status between runs. Real-tree `git status --porcelain` was `?? node_modules/` before and `?? node_modules/` after the worktree was removed. The worktree is removed and pruned.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: `DRAFT_TIMEOUT_MS` 120_000 -> 60_000 | `web/infrastructure/claude/catalog-drafter.ts:9` | yes - C4105 failed (`catalog-drafter.test.ts:122`) |
| F1b: default param `timeoutMs = 60_000`, constant kept at 120_000 | `web/infrastructure/claude/catalog-drafter.ts:82` | yes - C4105 failed (behavioural half, `:128`) |
| F2: pending guard `if (pending) return;` removed | `web/components/setup/draft-panel.tsx:117` | no - survived: C4126 passed in both files (alone and in the batch). Run with C4127 in one file, C4127 went red only because the queued second action leaked into the next test; C4127 alone passed. Not counted as a kill |
| F3: `event.currentTarget.reset()` before dispatch | `web/components/setup/draft-panel.tsx:118` | no - survived: C4126 and C4127 passed in both files (the stubbed `files` survives a reset; the trade comes back through `defaultValue`) |
| F3b: `<form key={state.status}>` (form remounts on failure) | `web/components/setup/draft-panel.tsx:155` | yes - C4127 failed (`draft-panel.test.ts:65`) |
| S1: tasks bound `> 12` -> `> 13` | `supabase/migrations/20261112100000_add_catalog_draft.sql:73` | yes - `FAIL other_trade_draft: C4117 bad draft 9: did not raise 23514` |
| S2: month value `not between 1 and 12` -> `0 and 12` | `supabase/migrations/20261112100000_add_catalog_draft.sql:61` | no - survived (observably equivalent): the table constraint at `supabase/migrations/20261030120000_cadence.sql:77` still raises 23514 and nothing is written |
| S3: types bound `1 and 40` -> `1 and 41` | `supabase/migrations/20261112100000_add_catalog_draft.sql:42` | yes - `FAIL other_trade_draft: C4117 bad draft 8: did not raise 23514` |

## Gate - verified at c541ee9

- `cd web && npx vitest run` - 251 files, 4376 passed, 0 failed
- feature proofs (one invocation, 10 files) - 52 passed, 0 failed, 21 skipped by filter
- `cd web && npm run test:db other_trade_draft` as committed - 1 passed, 0 failed (rolled back, nothing written on the hosted project)

## Ranked gaps

1. AC 23 "a second click sends no second request" has no failing proof. `web/components/setup/draft-panel.test.ts:51` holds even with the guard removed, because the queued action runs after `:52`. Asserting `toHaveBeenCalledTimes(1)` after the release kills F2 (probe confirmed). C4126.
2. AC 24 "file choice kept" is proven against a remount only. `web/components/setup/draft-panel.test.ts:61` stubs `files`, so a `form.reset()` (or switching to React's auto-resetting `<form action>`) passes. C4127.
3. The live layout and touch pass is not run. C4128, no evidence.
4. The hosted migration history is still inconsistent: there is no `schema_migrations` row for `add_catalog_draft`, and `20261112100000` is recorded as `add_catalog_types`. This is the owner's call and does not fail a check. `supabase/migrations/20261112100000_add_catalog_draft.sql:3`.
5. Function-side accept edges (name 60, 40 types, 12 tasks) are not driven in SQL. The function's month-value guard is redundant with `asset_types_default_visit_months_check` (S2 equivalent). `supabase/tests/other_trade_draft.sql:54`.
6. Smaller issues:
   - `.specs/STATE.md` still says "Verifier not yet run".
   - the C4113 test title says "one drafter call" but asserts `parse` (`web/application/use-cases/draft-catalog.test.ts:89`).
   - no test drives an edit in `DraftReview` and checks the posted `types` payload (carried from c788e59).
