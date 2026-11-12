# "Other" trade catalog draft verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: a67d21e..c499ad3
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

None. The profile is `standard` (step 1 runs under `ui`) and the plan marks no design source binding; its Sources are ROADMAP decisions 5 and 7 and AD-154/155/156/176 prose, which decide no screen composition. Step 1 is therefore a line, not an investigation. The plan's Surface, Relations and Landing were opened and are the basis of the Coverage recompute below.

## Checks

Proofs run at HEAD c499ad3 from `web/`: one vitest invocation over the 10 new test files plus `app/setup/page.test.ts` and `scripts/test-db/runner.test.ts` (12 files, 83 tests, every named test printed individually as passed), and one `npm run test:db other_trade_draft` (`PASS other_trade_draft`, 1 passed, 0 failed, rolled-back transaction with the migration replayed). Every named test was shown to exist (`grep -n "C34.."` over the test files) and to have run in the verbose output. All new test files are in the diff range, so no proof resolves to an untouched test.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C3400 | normalizeDraft keeps only valid pieces, drops empty types | vitest batch, "C3400:" x2 passed | `domain/task-library/draft.test.ts:28` `expect(kept.map((t) => t.name)).toEqual(["Pool pump", "Months", "Spellings", "Tasks"])`; `:31` spellings cut to 10; `:32` tasks `["b".repeat(200), "trimmed"]`; `:36` non-lists give `[]` | PASS |
| C3401 | duplicate name (case) keeps first, 30 of 31 types, 15 of 17 tasks | vitest batch, "C3401:" x2 | `draft.test.ts:41` `expect(dup).toHaveLength(1)`; `:45` `toHaveLength(30)`; `:50` `toHaveLength(15)` | PASS |
| C3402 | all-invalid answer gives empty list | vitest batch | `draft.test.ts:60` `expect(normalizeDraft({ types: [...] })).toEqual([])` | PASS |
| C3403 | drafter sends description as data, system prompt says ignore, `DRAFT_MODEL`, closed schema | vitest batch, "C3403:" x2 | `infrastructure/claude/drafter.test.ts:37` `expect(request.model).toBe(DRAFT_MODEL)`; `:38` system contains "ignore"; `:42` user content contains the description; `:56` `expect(object.additionalProperties).toBe(false)` for every schema object | PASS |
| C3404 | unavailable on no key/throw/refusal/bad JSON/schema; too_large on max_tokens with a document; logs no content | vitest batch, "C3404:" x3 | `drafter.test.ts:77-78` no key gives `{ok:false,code:"unavailable"}` and `requests` length 0; `:90` 8 failure answers all unavailable; `:95` `{ ok: false, code: "too_large" }`; `:107-109` logged text lacks the secret strings | PASS |
| C3405 | no file: 400 invalid_input for missing/empty/blank/1001, no Claude call; 1 and 1000 accepted | vitest batch | `app/api/setup/draft/route.test.ts:66` `.toBe(400)`; `:67` `.error).toBe("invalid_input")`; `:69` `drafterCalls` length 0; `:70` `[1, 1000]` -> `.status).toBe(200)` | PASS |
| C3406 | owner and admin get 200 with cleaned `{ types }` | vitest batch | `route.test.ts:78` `.status).toBe(200)`; `:79` `toEqual({ types: [GOOD.types[0]] })` (duplicate dropped) | PASS |
| C3407 | drafter unavailable -> 503; no valid type -> 422 empty_draft | vitest batch | `route.test.ts:87` `.toBe(503)`; `:92` `.toBe(422)`; `:93` `.error).toBe("empty_draft")` | PASS |
| C3408 | PDF of exactly 5,242,880 bytes -> pdf document and 200 | vitest batch | `route.test.ts:101` `.status).toBe(200)`; `:103` `drafterCalls[0].document?.kind).toBe("pdf")` | PASS |
| C3409 | DOCX read by the real `importParser` reaches the drafter as text | vitest batch (proof path moved, see Deviations) | `infrastructure/import-parsers/draft-catalog.test.ts:21-22` `expect(document?.kind).toBe("text")` and text `toContain("Boiler room has two Lochinvar boilers")` | PASS |
| C3410 | file + description both pass; each alone passes alone | vitest batch | `application/use-cases/draft-catalog.test.ts:29` description `"pools"` (trimmed); `:30` document `{kind:"text",text:WORD_TEXT}`; `:34` description undefined; `:39` `toEqual({ description: "pools" })` | PASS |
| C3411 | 5,242,881 bytes -> 413 before parser or Claude | vitest batch | `route.test.ts:108` `.toBe(413)`; `:109` `file_too_large`; `:110` `parserCalls` 0; `:111` `drafterCalls` length 0 | PASS |
| C3412 | xlsx, csv, png, text/plain -> 415, no parser, no Claude | vitest batch | `route.test.ts:121` `.toBe(415)`; `:122` `unsupported_type`; `:124-125` parserCalls 0, drafterCalls 0 | PASS |
| C3413 | parser refusals (corrupt, password, no text) -> 422 unreadable, Claude not called | vitest batch, 4 tests | `draft-catalog.test.ts:46` `toEqual({ ok:false, error:"unreadable", reason:"unreadable" })` over 3 reasons x 2 types; `:48` inputs length 0; `:54` whitespace Word text; real parser `import-parsers/draft-catalog.test.ts:29` same shape for blank/corrupt/OLE bytes; route `route.test.ts:141-143` 422 | PASS |
| C3414 | drafter `too_large` -> 422 unreadable with "fewer pages"/"describe the trade" message | vitest batch | `route.test.ts:131` `.toBe(422)`; `:133` `body.error).toBe("unreadable")`; `:134-135` message matches `/fewer pages/i` and `/describe the trade/i` | PASS |
| C3415 | file request stores nothing, logs no content; success logs one line with count and tokens | vitest batch, 2 tests | `draft-catalog.test.ts:64` `expect(lines).toHaveLength(1)`; `:65-67` contains "1 type", "1200", "340"; `:68` lacks secret/"Lochinvar"/"Pool pump"/"Check seals"; `:78-79` source has no `/storage|bucket|upload/i`; container passes `{ parser, drafter }` only (`composition/index.ts:207`) | PASS |
| C3416 | cards with name, 12-month grid marked, spellings, tasks in order, "Nothing is added..." text | vitest batch | `components/setup/draft.test.ts:52` contains "Nothing is added until you press Add to my catalog"; `:54-56` task order by `indexOf`; `:57` 24 checkboxes; `:58` 3 `checked=""` | PASS |
| C3417 | reducer: rename, edit task, edit spelling, toggle month, remove task, remove type change only the draft | vitest batch | `draft.test.ts:67` rename; `:68` editTask; `:69` setSynonyms; `:70-71` toggleMonth; `:72` removeTask; `:74` removeType; `:76` `expect(TYPES).toEqual(before)`; `:77` `fetch` not called | PASS |
| C3418 | invalid name/no task/no month shows field error and disables Add; valid enables | vitest batch | `components/setup/draft.test.ts:90` markup contains each message; `:91` `addButton(markup)).toMatch(/ disabled=""/)`; `:96` valid `not.toMatch(/ disabled=""/)` | PASS |
| C3419 | action calls `addTypes` once with org id and normalized types, returns result; catalog shows pack-less types under "Added from your draft" | vitest batch | `app/setup/add-types.test.ts:35` `toEqual({ ok: true, added: [...] })`; `:36-38` calls length 1, orgId `ORG`, types normalized; `components/setup/draft.test.ts:169-170` "Added from your draft" and "2 equipment types". Claim text says the action "returns the new catalog"; it returns the added names (declared, plan "Found while building") | PASS |
| C3420 | duplicate name (any case, or inside the list) raises 23505, count unchanged | `npm run test:db other_trade_draft` PASS | `supabase/tests/other_trade_draft.sql:65-67` `expect_error(... '23505')` for `POOL PUMP`, `rooftop UNIT`, `Twin`/`twin`; `:69` count unchanged. Does not assert the hint (offending name) the screen needs; see Faults injected (survivor) | PASS (with surviving mutant, see Faults) |
| C3421 | estimator, viewer, other org's owner, anon -> 42501, nothing written | test:db | `other_trade_draft.sql:122` `expect_error('C3421 '||v_user, ..., '42501')` for uE, uV, uB; `:126` anon; `:128` count unchanged | PASS |
| C3422 | invalid piece -> 23514, nothing written (months, 201-char task, no task, bad spelling, empty name, 31 types, 41 tasks) | test:db | `other_trade_draft.sql:105` loop `expect_error(..., '23514')` over 8 cases; `:107` 31 types; `:110` nothing written. Fault: bound 40->41 made it FAIL | PASS |
| C3423 | owner and admin create types: pack null, code rule, months, spellings, task positions, codes in input order, setup flag untouched | test:db | `other_trade_draft.sql:41` codes `array['POOL_PUMP','T_9_HOLE_GREEN_TEE_BOX']`; `:43` pack null, months `array[4,10]`; `:45-47` tasks in order; `:51` `setup_completed_at` null; `:56` admin `COOLING_TOWER` | PASS |
| C3424 | same list twice: second raises 23505, one row per name | test:db | `other_trade_draft.sql:81` `expect_error('C3424 second', ..., '23505')`; `:83` `od_count = v_before + 2` | PASS |
| C3425 | action returns forbidden/duplicate/invalid/unavailable and keeps the draft; non-owner/admin never reaches the store | vitest batch, 3 tests | `add-types.test.ts:48` `toEqual({ ok:false, code:"forbidden" })` over 4 members; `:50` calls length 0; `:61` `toEqual(answer)` for 4 store answers incl. `duplicate` with name; `:66-68` invalid. "Keeps the draft" is client state: `draft-panel.tsx:93` sets `addError` without clearing types, but no test drives `add()` (see Coverage) | PASS |
| C3426 | adapter calls `add_catalog_types` with `p_org_id` and camel-cased shape; maps 42501/23505(+hint)/23514/other | vitest batch, 2 tests | `infrastructure/supabase/setup-types.test.ts:20` `toHaveBeenCalledWith("add_catalog_types", { p_org_id: ORG, p_types: [...] })`; `:36` forbidden; `:37` duplicate name "Pool pump"; `:39` invalid; `:40` unavailable | PASS |
| C3427 | `draftAllowed` true only when pending and `other_trade`; false otherwise; throws on DB error | vitest batch, 3 tests | `setup-types.test.ts:59` `toBe(true)`; `:63-66` four `toBe(false)` cases; `:71` `rejects.toThrow(/XX000/)`. Proven only when called as a method: `composition/index.ts:203` wires it detached (see C3428/C3438) | PASS (adapter in isolation) |
| C3428 | `/setup` for a pending other_trade org renders the panel above "What we set up" with description, PDF/Word input, "Draft my catalog" | vitest batch | `components/setup/draft.test.ts:112` contains "Draft my catalog"; `:114` `draft-title` index < `catalog-title` index; `:115` textarea `draft-description`; `:117-119` file input accepts `.pdf`, `.docx`; `draft-page.test.ts:32` `typeof element.props.draft?.addTypes).toBe("function")`. The page test mocks the container; the real container's `catalogDraftAllowed` throws a TypeError (reproduced), so on the shipped wiring the page cannot render at all | FAIL |
| C3429 | org without other_trade: no "Draft my catalog", "What we set up" identical to `CatalogReview` | vitest batch | `draft.test.ts:125` `not.toContain("Draft my catalog")`; `:127` contains `html(CatalogReview ...)`; `draft-page.test.ts:38` `draft` undefined | PASS |
| C3430 | other_trade with seeded types: panel and seeded types both shown | vitest batch | `draft.test.ts:133-136` contains "Draft my catalog", "Backflow preventer", "Water heater", "Plumbing" | PASS |
| C3431 | while pending: button disabled with the "Drafting..." text; Save and Skip stay enabled | vitest batch | `draft.test.ts:141` button text "Drafting, this can take up to a minute"; `:142` `toMatch(/ disabled=""/)`; `:145-146` "Continue" and "Skip for now" not disabled (the existing label is "Continue", not "Save") | PASS |
| C3432 | each of 9 codes shows its own message and keeps description and file name | vitest batch | `draft.test.ts:152` `toHaveLength(9)`; `:156-158` message, description, file name; `:162` `seen.size).toBe(9)`. Table is over the 9-entry `DRAFT_ERROR_MESSAGES`, matching the route's 9 codes | PASS |
| C3433 | AI notice: written by AI, contractor owns checklists, check against procedures and any code or regulation | vitest batch | `draft.test.ts:101-104` `/written by AI/`, `/you own your checklists/i`, `/your own procedures/`, `/any code or regulation that applies/`; `:105` absent with no draft | PASS |
| C3434 | 401 no session; 403 estimator/viewer/no membership; 409 done or non-Other; Claude never called | vitest batch | `route.test.ts:149` `.toBe(401)`; `:155` `.toBe(403)` x3; `:162` `.toBe(409)`; `:164-165` drafterCalls 0 and parserCalls 0. Fault: role gate stubbed to `false` made it FAIL | PASS |
| C3435 | live Playwright at 375/768/1440: no horizontal scroll, 44x44 controls, no console errors (AC 31) | none | NOT RUN - the author-run live check was not performed (Handoff "Abandoned": Tailwind build produced no utilities in the worktree). No evidence exists; the verifier cannot observe it. AC 31 is unproven | FAIL |
| C3436 | live real-Claude draft, then Add, appears under "Added from your draft" (AC 1, 18) | none | NOT RUN - needs the migration applied and a key; not performed. No evidence exists | FAIL |
| C3437 | `maxDuration` >= 60 and `/api/setup/draft` not public | vitest batch | `route.test.ts:169` `expect(maxDuration).toBeGreaterThanOrEqual(60)`; `:172` `expect(lists).not.toMatch(/api\/setup\|...)` over `PUBLIC_PATHS`/`PUBLIC_PREFIXES` (both exist at `infrastructure/supabase/session.ts:10,17`, so not vacuous); `route.ts:7` `maxDuration = 60` | PASS |
| C3438 | container exposes `draftCatalog` over `claudeCatalogDrafter({apiKey})` and the importer's parser; no key -> unavailable (503) | vitest batch | `composition/draft.test.ts:17` regex over `composition/index.ts` source; `:26` `toEqual({ ok:false, error:"unavailable" })`. The same test proves `catalogDraftAllowed` only by `typeof ... "function"` (`:24`) and source text (`:18`); `composition/index.ts:203` `catalogDraftAllowed: setup.draftAllowed` detaches a method that uses `this.isPending` (`infrastructure/supabase/setup.ts:74`): reproduced `TypeError: Cannot read properties of undefined (reading 'isPending')` in a scratch worktree. `/setup` and the draft route both call it, so both break in the real container | FAIL |
| C3439 | `CatalogDrafter` result admits exactly ok+types, or unavailable/too_large/empty | vitest batch | `drafter.test.ts:121` `toEqual(["ok","unavailable","too_large","empty"])`; `:123` `Record<..., true>` over exactly the three codes. The port adds an optional `usage` to the ok branch (`application/ports/index.ts`), beyond the door's literal shape; additive and used by C3415 | PASS |
| C3440 | existing type functions unchanged: `reset_task_library_type` refuses a drafted type | test:db | `other_trade_draft.sql:135` `expect_error('C3440 reset', 'select public.reset_task_library_type(''POOL_PUMP'')', '55000')`; diff range touches no earlier migration | PASS |

## Coverage

Recomputed from the code (route handler, `DraftErrorCode`, migration) and the plan's Surface/Landing, not read from checks.md.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| route statuses (9 codes, 8 distinct numbers) | `route.ts:12-22` `STATUS` and plan Surface | 200 C3406/C3408 · 400 C3405 · 401/403/409 C3434 · 413 C3411 · 415 C3412 · 422 unreadable C3413/C3414, empty_draft C3407 · 503 C3407 | the `400 invalid_input` branches at `route.ts:44` (unparsable multipart) and `:48` (non-string description or string `file`) have no proof; the plan's Surface names `400` without limiting it to the length case. Minor, listed |
| route 413 triggers (2) | `route.ts:38` declared body > 6 MB, use case `file.bytes.byteLength > MAX_FILE_BYTES` | both C3411 (`route.test.ts:108,114`) | - |
| error codes with a message (9) | `draft.ts:83` type, `DRAFT_ERROR_MESSAGES` | all 9 C3432 `draft.test.ts:152-162` | - |
| `addCatalogTypesAction` outcomes (5) | `add-types.ts:14-23` | success C3419 · forbidden C3425 (`:48`) · invalid C3425 (`:66-68`) · duplicate and unavailable C3425 (`:61`) | - |
| description edges (4) | AC 1/3 | 0, blank, 1001 C3405 `:64-67` · 1 and 1000 `:70` | - |
| file size / type edges (2 + 2 + 4 + 3) | AC 7, 8, 10, 11, 12 | 5242880 C3408 · 5242881 C3411 · pdf C3408 · docx C3409 · xlsx/csv/png/text C3412 · corrupt/password/no-text C3413 (fake parser) and blank/corrupt/OLE through the real parser | - |
| drafter outcomes and failure modes (4 + 5) | `drafter.ts:115-129` | ok C3406 · unavailable C3404/C3407 · too_large C3404/C3414 · empty C3404 (`:98`)/C3407 · no key/throw/refusal/bad JSON/schema/max_tokens C3404 | - |
| `normalizeDraft` rules (8) | `draft.ts:56-71` | all in C3400/C3401 | - |
| `add_catalog_types` callers (4 refused, 2 allowed) | migration `:33` and RLS (`20261019174738_init.sql:301-313`, owner/admin) | refused C3421 · allowed C3423 | - |
| `add_catalog_types` invalid inputs (8) + duplicate | migration `:36,45,53,61,65,88` | C3422 (8 cases) · duplicate C3420 | the SQLSTATE `23505` is also raised by the unique index `asset_types_org_name_key` (`20261109120000_type_editor.sql:27`), so C3420 would pass without the migration's own `lower(name)` check. That check's only distinguishing output is the `hint` carrying the offending name, which AC 19 ("the screen SHALL name the type") depends on, and no SQL assertion reads it |
| adapter error mappings (4) + draftAllowed cases (4) | `setup.ts:74-92` | C3426 · C3427 | - |
| roles for the route (5) | `route.ts:33-35` | owner/admin C3406 · estimator/viewer/no membership C3434 | - |
| panel states (6) + AC 16-18 interactions | `draft-panel.tsx` | static markup states C3416, C3428-C3433; reducer C3417 | the panel's `draft()` fetch path and `add()` path (`draft-panel.tsx:58-100`: response parsing, network failure -> unavailable, keep description/file on error, keep draft on add error, `onAdded`) are not executed by any test; only initial-prop renders. checks.md says C3435/C3436 prove it live, and those were not run. AC 27, 28, 31 are unproven behaviourally |
| doors (4) | plan Landing | 1: migration signature/`security invoker`/`search_path = ''`/revoke match the literal (`:14-17,101-102`), C3420-C3424, C3426 · 2: C3438, C3439 · 3: C3437 · 4: C3415 | door 2 `usage` addition noted under C3439 (additive) |
| container wiring of new members (3: `draftCatalog`, `catalogDraftAllowed`, `addCatalogTypes`) | `composition/index.ts:203-206` | `draftCatalog` C3438 (works) | `catalogDraftAllowed` and `addCatalogTypes` are wired as detached methods; `draftAllowed` uses `this` and throws when detached (reproduced). No check calls the real wiring; C3438 asserts the source text and `typeof` only |

Swept rows resolving to existing, read against code: "authorization: ... the `asset_types` and `asset_type_tasks` owner/admin write policies still decide" is true (`20261019174738_init.sql:301-313` creates insert/update/delete policies for both tables with `array['owner','admin']`); "(org_id, lower(name))" unique index is real (`20261109120000_type_editor.sql:27`). The `concurrency: n/a` and `data lifecycle: n/a` rows are policy; nothing contradicts them.

## Deviations judged

- C3409 proof path moved to `infrastructure/import-parsers/draft-catalog.test.ts`: honest. The claim is unchanged and proven there with the real parser and fixture; the reason (application layer may not import the adapter) is a real lint rule. Not a gap.
- C3419 "Added from your draft" for just-added types only, action returns names: honest and documented in the plan's "Found while building". AC 18 ("the screen SHALL show them ... under a group named 'Added from your draft'") is met for this visit. Not a gap. (After a reload the same types show under "Added by you", which is consistent with the prior pinned test.)
- Existing test doubles extended (`app/setup/page.test.ts` adds a `catalogDraftAllowed` stub, `runner.test.ts` counts 32->33, 34->35): honest, no assertion weakened. But the page-test stub is exactly why the detached-method defect is invisible: no test builds the real container's `catalogDraftAllowed` and calls it.
- C3435 and C3436 not run: declared honestly, and recorded as FAIL, not as pass-by-self-report. Both are outside what the verifier can observe, so AC 27/28/31 (loading, error retention, 44 px, no horizontal scroll) and the first real Claude draft remain unevidenced.

## Test policy rows

Omitted - checks.md `Test policy` section says "Omitted"; the repo's conventions apply. No rows to judge.

## Faults injected

Scratch worktree of HEAD under `C:\Users\stock\.claude\jobs\e819ebdb\tmp\scratch` (node_modules junction, `.env.local` copied). `git status --porcelain` of the real tree was empty before and empty after; the scratch worktree and its junction were removed (the real `web/node_modules` was verified intact). Mutations 1 to 4 were applied together in four different files and the four files' tests were run once; each failing test is attributable to exactly one mutation.

| Mutation | Location | Killed |
| --- | --- | --- |
| remove the duplicate-name rule (`names.has(...)`) | `web/domain/task-library/draft.ts:63` | yes - C3401 failed (and C3406, which relies on the dedupe) |
| role gate replaced by `false` (estimators pass) | `web/app/api/setup/draft/route.ts:34` | yes - C3434 failed |
| 5 MiB edge `>` -> `>=` | `web/application/use-cases/draft-catalog.ts:35` | yes - C3408 failed (exact-limit PDF refused) |
| `max_tokens` with a document -> `unavailable` instead of `too_large` | `web/infrastructure/claude/drafter.ts:120` | yes - C3404 and C3439 failed |
| 40-task bound -> 41 | `supabase/migrations/20261112100000_add_catalog_types.sql:65` | yes - recipe FAIL `C3422 41 tasks: expected SQLSTATE 23514, statement succeeded` |
| drop the migration's case-insensitive name check (`lower(name) = lower(v_name)` -> `name = v_name`) | `supabase/migrations/20261112100000_add_catalog_types.sql:45` | no - recipe still `PASS`: the unique index `(org_id, lower(name))` raises the same `23505`, so no SQL assertion can tell the two apart. The `hint` the adapter and screen use to name the offending type is not asserted anywhere at the SQL level |

(6 mutations on 5 assertion surfaces; the SQL surface got two because they exercise different assertions. The cap of 5 surfaces is respected.)

A further defect was found by reading, not injected: `composition/index.ts:203` `catalogDraftAllowed: setup.draftAllowed` detaches a method that calls `this.isPending`. A throwaway test in the scratch worktree reproduced `TypeError: Cannot read properties of undefined (reading 'isPending')` for the detached call. The same would happen through the container object (`this` is the container, which has `setupPending`, not `isPending`). `SetupForRequest` awaits it inside `Promise.all` for every org, so `/setup` throws for all orgs, not only "Other" ones, and the draft route would throw before its role gate completes. No proof in the suite catches it.

## Gate

`cd web && npx vitest run domain/task-library/draft.test.ts infrastructure/claude/drafter.test.ts application/use-cases/draft-catalog.test.ts infrastructure/import-parsers/draft-catalog.test.ts app/api/setup/draft/route.test.ts app/setup/add-types.test.ts app/setup/draft-page.test.ts infrastructure/supabase/setup-types.test.ts composition/draft.test.ts components/setup/draft.test.ts app/setup/page.test.ts scripts/test-db/runner.test.ts` - 83 passed, 0 failed (12 files)

`cd web && npm run test:db other_trade_draft` - 1 passed, 0 failed (`PASS other_trade_draft`)

Not run: a full `npx vitest run` (known unrelated failures in `components/billing/billing-view.test.ts` and `app/(app)/settings/billing/page.test.ts`, missing jsdom and @stripe packages, are not counted).

Ranked gaps:

1. The container wiring throws: `catalogDraftAllowed: setup.draftAllowed` loses `this`, so `/setup` fails for every org and the draft route fails - C3428, C3438 (also C3427 at the wiring level) - `web/composition/index.ts:203`, `web/infrastructure/supabase/setup.ts:74`
2. Live checks not run: no evidence for AC 27/28/31 or a real draft - C3435, C3436 - no evidence (Handoff "Abandoned")
3. Surviving mutant: the migration's own `lower(name)` check (offending-name hint for AC 19) is not asserted - C3420 - `supabase/migrations/20261112100000_add_catalog_types.sql:45`, `supabase/tests/other_trade_draft.sql:65`
4. The panel's `draft()` and `add()` behaviour (fetch parse, network failure, retention of description/file/draft on error, `onAdded`) is executed by no test - C3425 "keeps the draft", C3432 - `web/components/setup/draft-panel.tsx:58-100`
5. Route `400` branches for unparsable multipart and wrongly-typed fields are unproven - plan Surface 400 - `web/app/api/setup/draft/route.ts:44,48`
