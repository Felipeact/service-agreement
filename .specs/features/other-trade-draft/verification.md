# "Other" trade draft verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: a67d21e..7e71eca (fix diff since round 2: c541ee9..7e71eca, commits a63f508 and 7e71eca)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

31 of 31 checks proven at 7e71eca. Both round 2 gaps in the component tests are closed: with the pending guard removed, C4126 now fails (`draft-panel.test.ts:54`). C4127 now fails on both a `form.reset()` before sending and a switch to `<form action>` (`:71`). The new SQL accept-at-every-limit case kills all four lowered-cap mutants on the function (types 39, tasks 11, task length 199, month 11) and a trade cap of 59.

C4128 passes on **author-run evidence that I did not observe myself** (see its row). Its limits are listed in Ranked gaps 1.

## Hosted database state - carried from c541ee9

- No query was run this round, because nothing in the fix diff touches the hosted project.
- Round 2's read-only read stands:
  - `add_catalog_draft` exists with `prosecdef=false`, `search_path=""` and no `anon` execute.
  - 0 migration rows name `draft`.
  - `20261112100000` is recorded as `add_catalog_types`.
- The owner confirmed applying the migration on 2026-11-12. The version collision is the owner's call and does not fail a check.

## Checks - verified at 7e71eca

All proofs re-ran in full at 7e71eca:

- **Web:** one vitest invocation over the 10 feature test files, with `-t "C41[0-3][0-9]:|C2817:"` and `--reporter=verbose`. Result: 10 files passed, 52 passed, 21 skipped. Each named test is listed with a check mark, including both `draft-panel.test.ts` tests.
- **SQL:** `cd web && npm run test:db other_trade_draft` gave `PASS other_trade_draft` / `1 passed, 0 failed`. The recipe ends in `rollback` (`supabase/tests/other_trade_draft.sql`, last lines; runner `web/scripts/test-db/runner.mts:2`), so nothing was written on the hosted project.

Rows whose cited files the fix did not change keep their earlier citations. They are marked `carried from <sha>`, and their proofs were re-run green at 7e71eca.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C4100 | draft form on an empty catalog, absent with a type | vitest `C4100:` passed | carried from c788e59: `web/components/setup/setup.test.ts:123`, `:130` | PASS |
| C4101 | valid trade, owner and admin, drafter called once, `ok` | vitest `C4101:` (2) passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:25-26` | PASS |
| C4102 | 23 bound edges | vitest `C4102:` (3) passed | carried from c788e59: `web/domain/catalog-draft/index.test.ts:34` over `:10-32` | PASS |
| C4103 | trade name cases; invalid calls nothing | vitest `C4103:` passed | carried from c788e59: `web/domain/catalog-draft/index.test.ts:51-57`; `web/application/use-cases/draft-catalog.test.ts:34-36` | PASS |
| C4104 | bad Claude answers are `unavailable` | vitest `C4104:` passed | carried from c788e59: `web/infrastructure/claude/catalog-drafter.test.ts:45` | PASS |
| C4105 | throw, refusal, no key and 120 s give `unavailable`; log holds no input | vitest `C4105:` (2) passed | carried from c541ee9: `web/infrastructure/claude/catalog-drafter.test.ts:122-130` (F1 and F1b killed in round 2) | PASS |
| C4106 | estimator, viewer, no membership `forbidden` | vitest `C4106:` passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:43-44` | PASS |
| C4107 | a type present gives `not_empty` | vitest `C4107:` passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:50-51` | PASS |
| C4108 | request carries trade, notes, file only; prompt calls it data | vitest `C4108:` passed | carried from c788e59: `web/infrastructure/claude/catalog-drafter.test.ts:81-88` | PASS |
| C4109 | door 1 schema | vitest `C4109:` passed | carried from c788e59: `web/infrastructure/claude/catalog-drafter.test.ts:93-98` | PASS |
| C4110 | four file types at 4,194,304 bytes parsed; text or pdf bytes reach Claude | vitest `C4110:` (3) passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:66`; `web/infrastructure/claude/catalog-drafter.test.ts:104-105` | PASS |
| C4111 | other type, 4,194,305 bytes or unreadable; no drafter call | vitest `C4111:` (2) passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:79-80` | PASS |
| C4112 | Claude `too_large` on a document gives `too_large` | vitest `C4112:` (2) passed | carried from c788e59: `web/infrastructure/claude/catalog-drafter.test.ts:114` | PASS |
| C4113 | file not stored | vitest `C4113:` passed | verified at 7e71eca (only the title changed): `web/application/use-cases/draft-catalog.test.ts:89`. The title now says "parses once" and matches the assertion. `:93` `makeDraftCatalog.length` is 3; `:95` `not.toContain("9,9,9")` | PASS |
| C4114 | edit controls present, no add controls | vitest `C4114:` passed | carried from c788e59: `web/components/setup/setup.test.ts:140`, `:142` | PASS |
| C4115 | accept calls writer once with the edited draft, returns count | vitest `C4115:` (2) passed | carried from c788e59: `web/application/use-cases/draft-catalog.test.ts:113-115` | PASS |
| C4116 | rows with pack null, code, tasks in order, months; trade appended once; a draft at every upper limit is accepted | SQL PASS | verified at 7e71eca: `supabase/tests/other_trade_draft.sql:117-125` and `:141` as in round 2 (lines unchanged). New `:144-158`: one accept of 40 types, the first named with 60 characters, each with 12 tasks of 200 characters and 12 months, and a 60-character trade. `:156` `count(*) ... = 40`; `:157` `count(*) ... = 480`. S4 to S7 and S8 killed here | PASS |
| C4117 | bad drafts give `23514`, nothing written | SQL PASS | carried from c541ee9: `supabase/tests/other_trade_draft.sql:55-63`, `:70-71`, `:76-78` (lines unchanged) | PASS |
| C4118 | `55000` writes nothing; screen says "no longer empty" | SQL PASS; vitest `C4118:` passed | carried from c541ee9: `supabase/tests/other_trade_draft.sql:99-101`; `web/components/setup/setup.test.ts:148` | PASS |
| C4119 | estimator, viewer, other org's owner get `42501` | SQL PASS | carried from c541ee9: `supabase/tests/other_trade_draft.sql:88`, `:90` | PASS |
| C4120 | drafting writes nothing | vitest `C4120:` passed | carried from c541ee9: `web/app/setup/draft-actions.test.ts:43` | PASS |
| C4121 | collision gets numeric suffix; plain name keeps its code | SQL PASS | carried from c541ee9: `supabase/tests/other_trade_draft.sql:126-127` | PASS |
| C4122 | drafted types under "Added by you" with count | vitest `C4122:` passed | carried from c788e59: `web/domain/org-settings/setup.test.ts:122-123` | PASS |
| C4123 | door 2 shape | SQL PASS | verified at 7e71eca (lines moved by +16): `supabase/tests/other_trade_draft.sql:168` invoker; `:169` `search_path=""`; `:170` `integer`; `:171` no `anon` execute; `:172` `authenticated` can execute | PASS |
| C4124 | writer sends p_org_id, p_trade, p_types and maps 4 errors | vitest `C4124:` (6) passed | carried from c788e59: `web/infrastructure/supabase/catalog-writer.test.ts:15`, `:27` | PASS |
| C4125 | no stored draft | vitest `C4125:` passed | carried from c788e59: `web/app/setup/setup-wiring.test.ts:49`, `:51` | PASS |
| C4126 | status text, disabled submit, a second click sends no second request | vitest `C4126:` (setup, draft-panel) passed | verified at 7e71eca: `web/components/setup/draft-panel.test.ts:47` - `toHaveBeenCalledTimes(1)`; `:48` - `.disabled).toBe(true)`; `:49` - `toContain("Claude is drafting")`; `:51` after the second submit; `:52` releases the first request; `:54` - `expect(draftAction).toHaveBeenCalledTimes(1)` after the release. F2 (guard at `web/components/setup/draft-panel.tsx:117` removed) is now killed: "expected to be called 1 times, but got 2 times" at `draft-panel.test.ts:54:25`, with the C4126 test run alone | PASS |
| C4127 | message, Try again, trade, notes and file choice kept | vitest `C4127:` (setup, draft-panel) passed | verified at 7e71eca: `web/components/setup/draft-panel.test.ts:65` spies `HTMLFormElement.prototype.reset`; `:70` - `submitted.defaultPrevented).toBe(true)`; `:71` - `expect(reset).not.toHaveBeenCalled()`; `:72` - `getAttribute("action")).toBeNull()`; `:73` message; `:74` same file input; `:75` `files?.[0]).toBe(file)`; `:76-77` trade kept; `:79` trade sent. Carried from c788e59: `web/components/setup/setup.test.ts:160-163`. Killed, each with the C4127 test run alone: F3 (`event.currentTarget.reset()` before sending) at `:71`; F3c (`<form action={formAction}>`) at `:71`, because React resets the form after an action; F3b (form remounted) at `:74` | PASS |
| C4128 | live pass at 375/768/1440, no horizontal scroll, 44 px targets on mobile and tablet, no console error | author-run Playwright pass, 2026-11-12 (harness deleted; **not re-observed by the Verifier**) | Author-run evidence, recorded at `.specs/features/other-trade-draft/checks.md:120`. The page was a temporary preview at `/concepts/draft-preview`. It rendered the real `SetupView` and `DraftPanel` with fake Server Actions. Recorded: scroll widths 360/753/1425 (no horizontal scroll); every control at least 44 by 44 px at 375 and 768, except the logo field's pre-existing 1 px visually hidden file input; the failed, drafting and review states, with remove and month toggle exercised; 12 month columns at 1440; 0 console errors. Adequate for the claim, because `/setup` wraps `SetupView` in only `<main>` (`web/app/setup/page.tsx:29`), so the preview renders the same layout tree. Not covered (Ranked gaps 1): real touch emulation (clicks only), the real Claude call, the real database and Server Action path, the console on the real path, and drafts at maximum content length. No screenshot or log was kept | PASS (author-run evidence, not re-observed) |
| C4129 | container drafter and writer; `bodySizeLimit` `5mb` | vitest `C4129:` passed | carried from c788e59: `web/composition/draft-wiring.test.ts:20-25` | PASS |
| C4130 | read-only review unchanged | vitest `C4130:` and `C2817:` passed | carried from c788e59: `web/components/setup/setup.test.ts:169-170` | PASS |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `draftCatalogAction` codes (7) | carried from c788e59: `web/application/use-cases/draft-catalog.ts:35-57`, `web/app/setup/draft-actions.ts:28-35` | ok C4101 · invalid C4103 · forbidden C4106 · not_empty C4107 · unreadable C4111 · too_large C4111 C4112 · unavailable C4104 C4105 | - |
| `acceptDraftAction` codes (5) | carried from c788e59: `web/app/setup/draft-actions.ts:42-61` | ok C4115 · invalid C4117 C4124 · forbidden C4119 C4124 · not_empty C4118 C4124 · unavailable C4124 | - |
| `add_catalog_draft` outcomes (4) | verified at 7e71eca: `supabase/migrations/20261112100000_add_catalog_draft.sql:39-42`, `:61`, `:73-78` | count C4116 (now also at every upper limit, `other_trade_draft.sql:156-157`) · 42501 C4119 · 55000 C4118 · 23514 C4117 | - |
| function-side bounds (Swept "again in the function") | verified at 7e71eca: `supabase/migrations/20261112100000_add_catalog_draft.sql:39`, `:42`, `:61`, `:73`, `:76`; recipe `supabase/tests/other_trade_draft.sql:55-63`, `:144-158` | trade 60 accepted C4116 (S8 killed) · types 40 accepted C4116 (S4 killed), 41 refused C4117 (S3 killed) · tasks 12 accepted C4116 (S5 killed), 13 refused C4117 (S1 killed) · task 200 accepted C4116 (S6 killed), 201 refused C4117 · month 12 accepted C4116 (S7 killed), 13 refused C4117 · month 0 refused C4117. That outcome is proven, but the function's own lower guard is shadowed by `asset_types_default_visit_months_check` (`supabase/migrations/20261030120000_cadence.sql:77`), so S2 is an equivalent mutant (see Faults) · name 60 accepted C4116 (`:151`). The name cap lives in `private.clean_type_name` (`supabase/migrations/20261109120000_type_editor.sql:100`), which is outside this feature and was not mutated · 0 types, 0 months, duplicate C4117 | - |
| draft bounds in validateDraft (23 edges) | carried from c788e59: `web/domain/catalog-draft/index.ts:20-49` | C4102 table, all 23 | - |
| trade name cases (7) | carried from c788e59 | C4103 · C4101 | - |
| Claude failure cases (9) | carried from c541ee9: `web/infrastructure/claude/catalog-drafter.ts:82-106` | not JSON, no types, empty, wrong type, bound C4104 · thrown, refusal, no key C4105 · 120 s default C4105 | - |
| roles and membership (5) | carried from c788e59 | owner, admin C4101 · estimator, viewer, null C4106 | - |
| file types (5) and size edges (2) | carried from c788e59 | xlsx csv docx pdf C4110 · other C4111 · 4,194,304 C4110 · 4,194,305 C4111 | - |
| draft edit controls (6) | carried from c788e59 | C4114 (presence only) | - |
| S4 states | verified at 7e71eca: `web/components/setup/draft-panel.tsx:116-121`, `:155-187` | loading (status, disabled) C4126 · one request per click C4126 (F2 killed) · not_empty C4118 · unavailable message and Try again C4127 · file kept across a remount C4127 (F3b killed) · not reset by a hand reset C4127 (F3 killed) · not reset by React's form action C4127 (F3c killed) | - |
| layout at 375/768/1440 (AC 25) | plan AC 25; `checks.md:120` | 375, 768, 1440 C4128, as author-run evidence on a preview that renders the real components with fake actions. The Verifier did not observe it | - |
| doors (3) | carried from c541ee9 | door 1 C4109 · door 2 C4123 C4124 · door 3 C4125 | - |
| entity relations (2) | carried from c541ee9 | `asset_types` rows, `asset_type_tasks` in order C4116 | - |
| startup config (2 places) | carried from c788e59 | C4129 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `domain/catalog-draft/index.ts`, `application/use-cases/draft-catalog.ts` | own layer | yes - carried from c788e59 (the fix only renamed the C4113 test title) |
| Entry point that decides nothing | `app/setup/draft-actions.ts`, `app/setup/page.tsx` | boundary: `draft-actions.test.ts` | yes - carried from c541ee9 |
| Adapter | `infrastructure/claude/catalog-drafter.ts`, `infrastructure/supabase/catalog-writer.ts` | client double | yes - carried from c541ee9 |
| SQL function that decides | `add_catalog_draft` | one rolled-back recipe | yes - verified at 7e71eca: the recipe passes and now drives the accept side of every upper cap (S4 to S8 killed) |
| Component state (S4) | `components/setup/draft-panel.tsx` | `draft-panel.test.ts` (jsdom) | yes - verified at 7e71eca: the pending guard and the "keep the form" property each turn a test red when broken (F2, F3, F3c, F3b killed) |
| Instrumentation, pass-throughs | `components/setup/draft-state.ts`, `composition/index.ts` | via consumers | yes - carried from c788e59 |

## Swept rows read against the code - verified at 7e71eca

- Concurrency, same advisory lock: carried from c788e59 (`supabase/migrations/20261112100000_add_catalog_draft.sql:32`). The migration is unchanged since round 2.
- Validation, "again in the function": both sides of every cap are now driven in SQL (Coverage, function-side bounds). The month lower guard is equivalent to the table constraint.
- Failure modes, "a bad draft writes nothing": carried from c541ee9 (`supabase/tests/other_trade_draft.sql:71`, `:76`).
- Idempotency / 55000: carried from c541ee9 (`supabase/tests/other_trade_draft.sql:99-101`).

## Plan and checks consistency - verified at 7e71eca

- Fixed since round 2:
  - The C4113 test title now matches its assertion (`web/application/use-cases/draft-catalog.test.ts:89`).
  - `checks.md:120` records the C4128 run.
  - `.specs/STATE.md` no longer says "Verifier not yet run".
- Still loose (format only, no check depends on them):
  - `.specs/STATE.md:191` still says, in the same paragraph, that C4128 "is not run: it needs the migration applied and an org with an empty catalog". That sentence is stale.
  - `checks.md:11` does not record that the owner applied the migration.

## Faults injected - verified at 7e71eca

Scratch:

- Setup: `git worktree add --detach <scratchpad>/wt3 HEAD`, with `web/node_modules` as a junction to the main tree and `web/.env.local` copied in.
- Isolation: each mutant was applied on its own, run, then restored with `git -C <wt> checkout -- .`. A clean worktree `status --porcelain` was confirmed after every restore.
- Selection: component mutants ran with the one check's test alone (`-t "C4126:"` or `-t "C4127:"`). SQL mutants ran with the full rolled-back recipe on the worktree's copy of the migration.
- Real tree: `git status --porcelain` was `?? node_modules/` before and after. The junction was removed first, then the worktree was removed with `worktree remove` and pruned. The main tree's `web/node_modules` is intact.

| Mutation | Location | Killed |
| --- | --- | --- |
| F2: pending guard `if (pending) return;` removed | `web/components/setup/draft-panel.tsx:117` | yes - C4126 failed alone: "expected to be called 1 times, but got 2 times" at `draft-panel.test.ts:54:25` (it stayed green in round 2, before `:54` existed) |
| F3: `event.currentTarget.reset();` added after `new FormData(...)`, before `formAction(data)` | `web/components/setup/draft-panel.tsx:118` | yes - C4127 failed alone: "expected reset to not be called" at `draft-panel.test.ts:71:23` (it stayed green in round 2, before the `reset` spy existed) |
| F3c: `<form onSubmit={submit}>` -> `<form action={formAction}>` | `web/components/setup/draft-panel.tsx:155` | yes - C4127 failed alone at `draft-panel.test.ts:71:23` (React's action path calls `reset`) |
| F3b: `<form key={state.status} ...>` (form remounts on failure), re-run on the touched test | `web/components/setup/draft-panel.tsx:155` | yes - C4127 failed alone at `draft-panel.test.ts:74:33` (Object.is on the file input) |
| S4: types `not between 1 and 40` -> `1 and 39` | `supabase/migrations/20261112100000_add_catalog_draft.sql:42` | yes - `FAIL other_trade_draft: a draft holds 1 to 40 types`, 0 passed 1 failed |
| S5: tasks `> 12` -> `> 11` | `supabase/migrations/20261112100000_add_catalog_draft.sql:73` | yes - `FAIL other_trade_draft: a type has 0 to 12 tasks of 1 to 200 characters` |
| S6: task length `1 and 200` -> `1 and 199` | `supabase/migrations/20261112100000_add_catalog_draft.sql:76` | yes - `FAIL other_trade_draft: a type has 0 to 12 tasks of 1 to 200 characters` |
| S7: month value `1 and 12` -> `1 and 11` | `supabase/migrations/20261112100000_add_catalog_draft.sql:61` | yes - `FAIL other_trade_draft: months are whole numbers from 1 to 12` |
| S8: trade `{1,60}` -> `{1,59}` | `supabase/migrations/20261112100000_add_catalog_draft.sql:39` | yes - `FAIL other_trade_draft: the trade is 1 to 60 letters, ...` |
| S2: month value `1 and 12` -> `0 and 12` (carried from c541ee9, not re-run: the migration and the table constraint are unchanged) | `supabase/migrations/20261112100000_add_catalog_draft.sql:61` | n/a - equivalent mutant: in round 2 the recipe stayed green with it, because `asset_types_default_visit_months_check` (`supabase/migrations/20261030120000_cadence.sql:77`) raises the same 23514 and nothing is written. Only the error message differs, and the plan does not specify messages |
| F1, F1b, S1, S3 (round 2, surfaces untouched by this fix) | `catalog-drafter.ts:9`, `:82`; migration `:73`, `:42` | yes - carried from c541ee9 |

This round: 9 injected, 9 killed. Cumulative: 13 distinct mutants killed, 1 equivalent (S2), 0 non-equivalent survivors.

## Gate - verified at 7e71eca

- `cd web && npx vitest run`: 251 files, 4376 passed, 0 failed.
- Feature proofs, one invocation over 10 files: 52 passed, 0 failed, 21 skipped by the filter.
- `cd web && npm run test:db other_trade_draft`: 1 passed, 0 failed. Rolled back; nothing was written on the hosted project.

## Ranked gaps

1. **C4128 rests on author-run evidence that the Verifier did not observe.** The harness was deleted, and no screenshot or log was kept. The pass did not cover:
   - real touch emulation (clicks only, per the single-context rule);
   - the real Claude call;
   - the real database and Server Action path, including the console on that path;
   - the `/setup` route itself;
   - a draft at maximum content (60-character names, 200-character tasks), which is the layout case most likely to scroll at 375.

   The live Claude call with a real key has also never run, so the months `enum` assumption in door 1 stays unproven live.
2. **The hosted migration history is still inconsistent.** There is no `schema_migrations` row for `add_catalog_draft`, and `20261112100000` is recorded as `add_catalog_types`. This is the owner's call and does not fail a check (carried from c541ee9).
3. **S2 is an equivalent mutant.** The function's month lower guard is redundant with `asset_types_default_visit_months_check`. No check can tell them apart under the plan's contract.
4. **Smaller issues:**
   - `.specs/STATE.md:191` still has the stale "C4128 ... is not run" sentence.
   - `draft-panel.test.ts:65` spies `HTMLFormElement.prototype.reset` without restoring it. Harmless today, because it is the file's last test and files are isolated.
   - No test drives an edit in `DraftReview` and checks the posted `types` payload (carried from c788e59).
