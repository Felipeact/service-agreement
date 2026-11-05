# Import extract verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 7791dc0..6b61a9c
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier). A fresh sub-agent that wrote neither this code nor the fix. It worked read-only over the real tree and injected faults only in a scratch `git worktree`.

All 62 checks are proven with located evidence at 6b61a9c. The fix (`7dba9bb..6b61a9c`) is test-only: `web/application/use-cases/extract-import.test.ts` (+17), `web/components/imports/extract.test.ts` (1 line), `web/boundaries.test.ts` (+1) and the checks.md header count. No production file changed (`git diff --stat 7dba9bb..6b61a9c`). Round 1's two surviving mutants are now killed. The three defensive `unavailable` branches each have a case, and each of their mutants is killed. The unmet `Test policy` row is now met. One gap carries over without failing a check: the `ExtractControl` progress wiring (7dba9bb) has no automated proof, because the repo has no DOM test environment.

This round's scope follows verify.md "Re-verifying after a fix". Every proof re-ran in full at 6b61a9c. Citations were refreshed in the three touched test files. The use-case failure, defensive-branch and pill-tone coverage rows were recomputed. The unmet use-case `Test policy` row and the rows that classify touched files were re-judged. Faults were re-injected on the touched surfaces. Each section says whether it was verified at 6b61a9c or carried from 7dba9bb.

Round-1 gaps, status at 6b61a9c:

| Round-1 gap | Status |
| --- | --- |
| 1. C543 neutral tone unasserted, fault survived | fixed: `web/components/imports/extract.test.ts:97`; fault 1 killed |
| 2. C529 / AC 21 parser `{ ok: false }` untested, fault survived | fixed: `web/application/use-cases/extract-import.test.ts:235`; fault 2 killed |
| 3. defensive `unavailable` branches have no case | fixed: `web/application/use-cases/extract-import.test.ts:250-262`; faults 3, 4, 5 killed |
| 4. `ExtractControl` progress fix has no automated proof | still open (no DOM test environment). Not a check failure; see Ranked gaps |
| 5. C539 asserted the folder, not the module | fixed: `web/boundaries.test.ts:57` |
| 6. checks.md header said 63 checks | fixed: `.specs/features/import-extract/checks.md:6` says 62 |

## Binding sources

Carried from 7dba9bb. The fix touched no interface, so step 1 is not owed again. The profile is `standard` in any case.

plan.md marks no source as binding. Its `Sources` are ROADMAP.md, import-parse's plan and the STATE.md AD rows. They are background, not decisions a check could contradict.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none marked binding in plan.md | n/a | - | - |

## Checks

Verified at 6b61a9c. Every proof re-ran in full, and citations were refreshed in the touched files. Rows whose test files the fix did not change keep their round-1 citations.

**Vitest proofs** ran in one invocation from `web/`:
`npx vitest run components/imports infrastructure/claude domain/imports application/use-cases infrastructure/supabase "app/(app)" composition boundaries -t "C501:|C502:|...|C555:|use case: when" --reporter=verbose`. The filter covers all 42 vitest check ids plus the 3 uncoded defensive cases. It exited 0 with **139 passed**, 377 skipped and 0 failed. Round 1 had 135; the fix added 1 C529 case and 3 defensive cases. Passing test names per id, from the verbose log:
C501 4, C502 1, C503 6, C504 1, C506 1, C508 2, C509 3, C510 1, C511 3, C512 7, C513 1, C514 5, C515 6, C516 4, C517 6, C518 2, C519 1, C520 1, C521 2, C522 1, C523 1, C524 8, C526 1, C527 8, C528 3, **C529 7** (6 use case + 1 store), C530 10, C531 4, C534 1, C535 2, C537 1, C538 3, C539 7, C541 1, C542 1, C543 5, C544 5, C545 1, C546 6, C551 1, C553 1, C555 1, and `use case: when` 3.

These other proofs were also re-run at 6b61a9c:

- `npm run test:db` (no argument): `13 passed, 0 failed`, with `PASS import_extract`. The runner rolls each recipe back.
- `npm test`: 46 files, 893 passed.
- `npm run lint`: exit 0.
- `npm ls @anthropic-ai/sdk`: `@anthropic-ai/sdk@1.3.0`.
- Every shell grep printed its stated count: SERVICE_ROLE `0`, NEXT_PUBLIC_ANTHROPIC `0`, key outside adapter/composition `0`, SDK pin `1`, migration `1`, types `17`, AD rows `7`, CONTEXT `2`, ROADMAP `1`. The `.env.example` key line printed `1` in both the working tree and `git show HEAD:web/.env.example`.
- `npx next build`: exit 0, run in the scratch worktree at 6b61a9c because a dev server holds the real tree's `.next`.
- `get_advisors` security: re-run.

C561 and C562 (live) were not re-run. Playwright is off-limits because the session is shared and signed in, and the fix changed no production code.

Paths are repo-relative.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C501 | runExtraction loops until a non-extracting answer; onProgress per extracting answer | vitest, 4 passed | `web/components/imports/extract.test.ts:54` `expect(extract).toHaveBeenCalledTimes(calls)`, `:56` `expect(result.status).toBe(last)`, `:58` `expect(onProgress).toHaveBeenCalledTimes(progressed.length)` | PASS |
| C502 | rows chunk sends header/refs/cells; text its text; pdf one document block | vitest, 1 passed | `web/infrastructure/claude/extractor.test.ts:45` `expect(sent).toContain(part)` over the 8 parts; `:49` `toContain("Unit 1: RTU on roof")`; `:55-57` `toHaveLength(1)`, `media_type` `toBe("application/pdf")`, decoded bytes `toEqual([...pdfChunk.bytes])` | PASS |
| C503 | chunks of ≤100 never spanning tables, 5 cases; chunk n starts at 100n+1 | vitest, 6 passed | `web/domain/imports/extract.test.ts:24` `expect(chunksOf(tables(...sizes)).map(rowsOf)).toEqual(expected)` over `:17-21`; `:33` `expect(chunk.rows[0].ref).toBe(\`T1!${100 * n + 2}\`)` | PASS |
| C504 | first chunk of 340 rows: 100 rows, record(null, 4), extracting 1/4 | vitest, 1 passed | `web/application/use-cases/extract-import.test.ts:93` `toEqual({ ok: true, state: "extracting", done: 1, total: 4 })`, `:95` `toHaveLength(100)`, `:97` `toEqual([JOB, null, 4])` | PASS |
| C505 | SQL: first RPC returns 1, job extracting 1/4, 2 rows | test:db, PASS import_extract | `supabase/tests/import_extract.sql:35` `tests.ok('C505 returns 1', v = 1, ...)`, `:36-37` `status = 'extracting' and extract_cursor = 1 and extract_total = 4 and extracted_at is null`, `:38` rows `= 2` | PASS |
| C506 | records rows as returned; 0 rows still advances | vitest, 1 passed | `web/application/use-cases/extract-import.test.ts:104` `toHaveLength(2)`; `:108` `expect(recorded(none.store)).toEqual([JOB, null, 1, []])` | PASS |
| C507 | SQL: positions 1..4 continue; empty chunk moves cursor to 3 | test:db | `supabase/tests/import_extract.sql:43` `array_agg(position order by position) ... = array[1, 2, 3, 4]`; `:46-47` `v = 3 and count = 4 and extract_cursor = 3` | PASS |
| C508 | no-table file is one text chunk; use case records total 1 | vitest, 2 passed | `web/domain/imports/extract.test.ts:40` `toEqual([{ kind: "text", text: "Unit 1: RTU on roof" }])`; `web/application/use-cases/extract-import.test.ts:115-116` `toHaveBeenCalledWith({ kind: "text", ... })`, `toEqual([JOB, null, 1])` | PASS |
| C509 | pdf is one pdf chunk; use case records total 1; Word text not sent with tables | vitest, 3 passed | `web/domain/imports/extract.test.ts:47` `toEqual({ kind: "pdf", bytes })`, `:52` `expect(JSON.stringify(chunks)).not.toContain("notes")`; `web/application/use-cases/extract-import.test.ts:123-124` | PASS |
| C510 | json_schema output of exactly the six required properties | vitest, 1 passed | `web/infrastructure/claude/extractor.test.ts:65` `toBe("json_schema")`, `:71-73` keys and required `toEqual(keys)`, `additionalProperties` `toBe(false)`, `:78` `enum` `toEqual(["low", "medium", "high"])` | PASS |
| C511 | valid answers mapped in order, 3 cases | vitest, 3 passed | `web/infrastructure/claude/extractor.test.ts:95` `expect(await extractor.extract(rowsChunk)).toEqual({ ok: true, rows })` over `:82-92` | PASS |
| C512 | source_ref rule, 5 rows-chunk cases + pdf + text | vitest, 7 passed | `web/application/use-cases/extract-import.test.ts:148` `toMatchObject({ sourceRef: storedRef, confidence: storedConfidence })` over `:139-143`; `:158` `toMatchObject({ sourceRef: "page 2", confidence: "medium" })` (the fixture's refs are `Units!2`/`Units!3`, not the check's `Units!4`/`Units!5`; same rule) | PASS |
| C513 | last chunk ends extracted (SQL, incl. 0 rows); use case returns stored counts | test:db + vitest 1 passed | `supabase/tests/import_extract.sql:56-57` `status = 'extracted' and extract_cursor = 1 ... and extracted_at is not null` and 0 rows; `:62` `extract_cursor = 2`; `web/application/use-cases/extract-import.test.ts:135` `toEqual({ ok: true, state: "extracted", rows: 0, unmatched: 0 })` | PASS |
| C514 | five text fields cleaned, 5 values | vitest, 5 passed | `web/application/use-cases/extract-import.test.ts:174` `toMatchObject({ assetTypeRaw: stored, unitNo: stored, typeModel: stored, location: stored, sourceRef: stored })` over `:162-166` | PASS |
| C515 | code/name match, 6 cases | vitest, 6 passed | `web/domain/imports/extract.test.ts:71` `expect(matchAssetType(raw, [RTU, HWT, MUA])).toBe(expected)` over `:64-69` | PASS |
| C516 | synonyms after code/name, 4 cases incl. name over synonym | vitest, 4 passed | `web/domain/imports/extract.test.ts:80` `toBe(expected)` over `:75-78` | PASS |
| C517 | no type, 6 cases incl. ambiguity | vitest, 6 passed | `web/domain/imports/extract.test.ts:91` `expect(matchAssetType(raw, types)).toBeNull()` over `:84-89` | PASS |
| C518 | only given types; catalog read once, sole source | vitest, 2 passed | `web/domain/imports/extract.test.ts:95-97`; `web/application/use-cases/extract-import.test.ts:184` `toHaveBeenCalledTimes(1)`, `:185` `toEqual(["t-mua", null])` | PASS |
| C519 | raw kept trimmed whatever matched | vitest, 1 passed | `web/application/use-cases/extract-import.test.ts:195` `toMatchObject({ assetTypeRaw: "Rooftop unit", assetTypeId: "t-rtu" })` | PASS |
| C520 | every synonym key is a catalog code; roadmap examples present | vitest, 1 passed | `web/domain/imports/extract.test.ts:104` `expect(sql, code).toContain(\`('${code}',\`)`, `:105-106` | PASS |
| C521 | sourceOf on extracted reads import_row_counts by job, no bytes; else result null | vitest, 2 passed | `web/infrastructure/supabase/extract-store.test.ts:82` `toMatchObject({ ok: true, status: "extracted", result: { rows: 338, unmatched: 14 }, bytes: null })`, `:83` eq args `toEqual([["job_id", JOB]])`, `:89` `result: null` | PASS |
| C522 | extracting job: pill, "2 of 4", Continue for writer only | vitest, 1 passed | `web/components/imports/extract.test.ts:68-70` `toContain("Extracting")`, `toContain("2 of 4")`, `buttons(writer)` `toContain("Continue extraction")`; `:75` viewer `not.toContain("Continue extraction")` | PASS |
| C523 | extracting at cursor 2 sends only Units!202..301, records (2, 4) | vitest, 1 passed | `web/application/use-cases/extract-import.test.ts:201` `toEqual({ ok: true, state: "extracting", done: 3, total: 4 })`, `:202` `toHaveBeenCalledTimes(1)`, `:205-207` `"Units!202"`, `"Units!301"`, `toEqual([JOB, 2, 4])` | PASS |
| C524 | recordExtraction maps RPC answers, 6 cases + args | vitest, 8 passed | `web/infrastructure/supabase/extract-store.test.ts:119` `toEqual(expected)`; `:129` `toHaveBeenCalledWith("record_extraction_chunk", { p_job_id, p_expected_cursor, p_total, p_rows })`; `:144-145` stale `toEqual(expected)`, rpc `toHaveBeenCalledTimes(1)`; `:158-159` codes and `console.error` count | PASS |
| C525 | SQL: same chunk twice stores once, loser 40001 | test:db | `supabase/tests/import_extract.sql:72` first `v = 1`; `:73` `expect_error('C525 second', ..., '40001')`; `:74-75` 2 rows and cursor 1; `:77` third `v = 2` | PASS |
| C526 | extracted job answers stored result, calls nothing | vitest, 1 passed | `web/application/use-cases/extract-import.test.ts:215` `toEqual({ ok: true, state: "extracted", rows: 338, unmatched: 14 })`, `:216-219` parser/catalog/extractor/record `not.toHaveBeenCalled()` | PASS |
| C527 | download only for parsed/extracting, over 6 statuses; fileOf unchanged | vitest, 8 passed | `web/infrastructure/supabase/extract-store.test.ts:55` `expect(downloads(calls)).toHaveLength(downloaded ? 1 : 0)`, `:57` args `toEqual([KEY])`; `:69` progress `{ cursor: 2, total: 4 }`; `:75-76` fileOf `bytes: null`, 0 downloads | PASS |
| C528 | uploading/uploaded/unreadable -> not_ready, nothing runs | vitest, 3 passed | `web/application/use-cases/extract-import.test.ts:225` `toEqual({ ok: false, code: "not_ready" })`, `:226-229` four `not.toHaveBeenCalled()` | PASS |
| C529 | use-case failures -> unavailable; logs with job id (AC 21) | vitest, 7 passed (6 use case + 1 store) | `web/application/use-cases/extract-import.test.ts:243` `toEqual({ ok: false, code: "unavailable" })`, `:244` record `not.toHaveBeenCalled()`, `:245` `expect(log).toHaveBeenCalledTimes(logs ? 1 : 0)`, `:246` `toContain(JOB)`, now over 6 cases including `:235` parser resolves `{ ok: false, reason: "corrupt" }` with `logs = true`; store download `web/infrastructure/supabase/extract-store.test.ts:103-104`. Fault 2 now killed. Note: the check text still says "table-driven over 5" and names only "the parser throws"; the test proves more than the check states | PASS |
| C530 | extractor failures, 10 cases -> unavailable, logged once | vitest, 10 passed | `web/infrastructure/claude/extractor.test.ts:113` `toEqual({ ok: false, code: "unavailable" })`, `:114` `toHaveBeenCalledTimes(1)`, `:115` no-key `requests` `toHaveLength(0)` | PASS |
| C531 | max_tokens: text/pdf too_large, rows unavailable; use case records nothing | vitest, 4 passed | `web/infrastructure/claude/extractor.test.ts:126` `toEqual(expected)` over `:119-121`; `web/application/use-cases/extract-import.test.ts:268-269` `toEqual({ ok: false, code: "too_large" })`, record `not.toHaveBeenCalled()` (lines moved +17 by the fix) | PASS |
| C532 | SQL: RPC atomic on 23514 and 23503 | test:db | `supabase/tests/import_extract.sql:84-86` `expect_error(..., '23514')`, `:87-88` job `parsed`, cursor null, 0 rows; `:89-93` same for `'23503'` | PASS |
| C533 | SQL: deleting a job cascades its rows only | test:db | `supabase/tests/import_extract.sql:102` `expect_rows('C533 delete job', ..., 1)`, `:103` rows `= 0`, `:104` other job's row `= 1` | PASS |
| C534 | viewer -> forbidden, extractImport not called | vitest, 1 passed | `web/app/(app)/imports.test.ts:196` `toEqual({ status: "forbidden" })`, `:197` `not.toHaveBeenCalled()` | PASS |
| C535 | non-uuid -> not_found; sourceOf no row -> not_found, no download | vitest, 2 passed | `web/app/(app)/imports.test.ts:201-202`; `web/infrastructure/supabase/extract-store.test.ts:95` `toEqual({ ok: false, code: "not_found" })`, `:96` downloads `toHaveLength(0)` | PASS |
| C536 | SQL: viewer 42501, other org P0002, RLS reads | test:db | `supabase/tests/import_extract.sql:111-112` `'42501'`, `:113-114` insert `'42501'`, `:115` viewer reads 1, `:120-121` `'P0002'`, `:122` uB reads 0, `:126` job unchanged | PASS |
| C537 | one request-scoped client; no SERVICE_ROLE under web/ | vitest 1 passed + grep printed `0` | `web/composition/composition.test.ts:133-135` `toMatch(/const importJobs = supabaseImportJobStore\(supabase, /)`, `toMatch(/extractImport: makeExtractImport\(importJobs, importParser, .*supabaseAssetTypeCatalog\(supabase\)\)/)`, `createServerClient<` `toHaveLength(1)`; read directly at `web/composition/index.ts:100` | PASS |
| C538 | request carries only the chunk, 3 kinds | vitest, 3 passed | `web/infrastructure/claude/extractor.test.ts:141` `expect(rest1).toEqual(rest2)`, `:143-147` one `user` message, no `metadata`, `system` `toBe(SYSTEM_PROMPT)`, `extract` `toHaveLength(1)` | PASS |
| C539 | SDK import is a lint error naming the module in 6 places, allowed in infrastructure/claude | vitest, 7 passed | `web/boundaries.test.ts:56` `toHaveLength(1)`, `:57` `expect(messages[0].message).toContain("@anthropic-ai/sdk")`, `:58` `toContain("infrastructure/claude")`; `:62` `toHaveLength(0)`. The configured message (`web/eslint.config.mjs:14`) does not contain the module name, so `:57` is satisfied by ESLint's own `'@anthropic-ai/sdk' import is restricted...` prefix, which is exactly the "names the module" the check claims. Round-1 precision note closed | PASS |
| C540 | no NEXT_PUBLIC_ANTHROPIC; key read only in adapter/composition | both greps printed `0` | the only non-test hits are `web/composition/index.ts:100` `process.env.ANTHROPIC_API_KEY` and `web/infrastructure/claude/index.ts:133` `if (!apiKey) return unavailable(...)` | PASS |
| C541 | parsed: Read pill, Extract equipment for writer only | vitest, 1 passed | `web/components/imports/extract.test.ts:80-81` `toContain("Read")`, `buttons(writer)` `toContain("Extract equipment")`; `:85` viewer `not.toContain` | PASS |
| C542 | prompt idle/pending/pending with progress labels, disabled | vitest, 1 passed | `web/components/imports/extract.test.ts:105` idle `Extract equipment`, `:109` `disabled=""...>Extracting…<`, `:112` `disabled=""...>Extracting… 2 of 4<`. Proven through props only, as the check defines it. The `ExtractControl` wiring fixed in 7dba9bb still has no automated proof (gap 1, not a check failure) | PASS |
| C543 | **neutral** pill "Extracted" and count line, 5 cases | vitest, 5 passed | `web/components/imports/extract.test.ts:97` `expect(out).toMatch(/<span data-tone="neutral"[^>]*>Extracted<\/span>/)`, `:98` `toContain(\`>${line}<\`)`. Fault 1 (`extracted` added to `ATTENTION`, `web/components/imports/job-list.tsx:18`) now **killed**, all 5 cases failed | PASS |
| C544 | five messages in role=alert, button enabled | vitest, 5 passed | `web/components/imports/extract.test.ts:124` `toMatch(/<p[^>]*role="alert"[^>]*>/)`, `:125` `toContain(message)`, `:126` `not.toContain('disabled=""')` over `:116-120` | PASS |
| C545 | forSite selects cursor/total, counts from the view, maps statuses | vitest, 1 passed | `web/infrastructure/supabase/extract-store.test.ts:176-181` extraction views `toEqual([...extracted, extracting, null, null])`, `:183-185` select columns, `import_row_counts` `in` args | PASS |
| C546 | action passes 6 answers through; refresh only on progress | vitest, 6 passed | `web/app/(app)/imports.test.ts:216` `toEqual(state)`, `:217` `toHaveBeenCalledWith(JOB)`, `:218` `refresh` `toHaveBeenCalledTimes(refreshes)` over `:206-211` | PASS |
| C547 | SQL: import_rows rules, labelled | test:db | `supabase/tests/import_extract.sql:133-149` (`'23514'`, `'23505'`, `'23514'`, `'23502'`, `'23503'` x2, accepted rows), `:153-154` estimator 1, `:159-160` owner update 1, `:165-166` viewer update 0 | PASS |
| C548 | SQL: import_jobs extraction rules + replaced import-parse rules | test:db | `supabase/tests/import_extract.sql:174-197`, each `expect_error(..., '23514')` or `expect_rows('C548 extracting keeps counts', ..., 1)` | PASS |
| C549 | SQL: RPC refuses other states (40001), unknown P0002, invoker, search_path, no anon | test:db | `supabase/tests/import_extract.sql:203-209`; `:215` `not prosecdef`; `:216` `proconfig @> array['search_path=""']`; `:217` `not has_function_privilege('anon', ...)` | PASS |
| C550 | SQL: import_row_counts 5/2, empty job none, other org 0, no anon | test:db | `supabase/tests/import_extract.sql:225` `rows = 5 and unmatched = 2`, `:226` `= 0`, `:231` `= 0`, `:235` `not has_table_privilege('anon', ...)` | PASS |
| C551 | ports declare the extractor, chunk, row, store methods, statuses | vitest, 1 passed | `web/composition/composition.test.ts:141` `toContain("extract(chunk: ExtractChunk)")`, `:146-147` `sourceOf(jobId: string)` and the full `recordExtraction(...)` signature, `:149-150` `'"extracting"'`, `'"extracted"'` | PASS |
| C552 | SDK pinned exact; npm ls ok; .env.example lists key server-side | grep `1`; `npm ls` exit 0 (`@anthropic-ai/sdk@1.3.0`); grep `1` | `web/package.json:14` `"@anthropic-ai/sdk": "1.3.0"`; `web/.env.example:7-8` at HEAD (`git show HEAD:web/.env.example`), with comment "Server-side only ... Never a NEXT_PUBLIC_ name." | PASS |
| C553 | model, effort, no sampling/thinking/tool_choice, fallbacks + beta, max_tokens ≥ 16000 | vitest, 1 passed | `web/infrastructure/claude/extractor.test.ts:155` `toBe("claude-opus-5-5")`, `:156` `toBe("low")`, `:157` `not.toHaveProperty(removed)`, `:158-160` fallbacks, betas, `toBeGreaterThanOrEqual(16000)` | PASS |
| C554 | migration file exists; types contain the six names | `ls` grep `1`; types grep `17` | `supabase/migrations/20261027045548_import_extract.sql` (matches live `list_migrations` version `20261027045548`); `web/infrastructure/supabase/database.types.ts:471` `import_rows: {`, `:830` `record_extraction_chunk: {` | PASS |
| C555 | getContainer() returns extractImport | vitest, 1 passed | `web/composition/composition.test.ts:128` `expect(typeof container.extractImport).toBe("function")` | PASS |
| C556 | test:db with no argument exits 0, 13 recipes incl. import_extract | `npm run test:db` 13 passed, 0 failed | `web/scripts/test-db/runner.mts:41` `plain("import_extract")`; `web/scripts/test-db/runner.test.ts:119-120` `toBe(13)`, `toHaveLength(13)` | PASS |
| C557 | whole suite and lint pass | `npm test` 46 files, 893 passed; `npm run lint` exit 0 | gate output (see Gate); 893 = round-1 889 + the 4 cases the fix added | PASS |
| C558 | next build exits 0 | `npx next build` exit 0 in scratch worktree at 6b61a9c (fresh `npm ci --allow-remote=all`, temporary copy of `web/.env.local` deleted before the worktree was removed) | `✓ Compiled successfully`; route `/sites/[siteId]/import` built; page `web/app/(app)/sites/[siteId]/import/page.tsx` | PASS |
| C559 | advisors = exactly the two accepted findings | mcp `get_advisors` security, re-run 2026-10-27 at 6b61a9c | returned exactly `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection`; the decision is recorded at `.specs/features/import-extract/checks.md:585` | PASS |
| C560 | 7 active AD rows, CONTEXT names feature, ROADMAP ticked | greps `7`, `2`, `1` | `.specs/STATE.md:44` AD-038 … `:50` AD-044; `CONTEXT.md:76`; `ROADMAP.md:109` `- [x] Claude structured extraction and type normalization` | PASS |
| C561 | live without a key: alert, job stays Read, layout/console/network clean, cleanup | **author-run 2026-10-27, NOT re-run by the Verifier (round 1 or 2)** (Playwright not used: shared signed-in session). Post-run state confirmed by read-only `execute_sql`: 0 `import_jobs` for org `…de30`, 0 `import_jobs` overall, 0 `import_rows`, 0 `storage.objects` in `imports` | recorded at `.specs/features/import-extract/checks.md:588` (Boundary part 3): alert text, button re-enabled, SQL `parsed` and 0 rows, three viewports, 0 console errors, every request 200 | PASS (on recorded evidence) |
| C562 | live with a key: xlsx 120 rows in 2 steps, docx, pdf, resume without duplicates, cleanup | **author-run 2026-10-27, NOT re-run by the Verifier**. Same post-run SQL confirmation as C561 | `.specs/features/import-extract/checks.md:588`: "120 rows, 48 need an equipment type" = SQL 120/48; docx/pdf "8 rows, 2 need…"; resume left 120 rows over 120 distinct positions; `:589` records the progress-label fix seen live | PASS (on recorded evidence) |

## Coverage

Verified at 6b61a9c for the three rows the fix touched: use-case failures, use-case defensive branches, and list-state forms and pill tones. Every other row is carried from 7dba9bb. A test-only diff does not change their authority (migration, adapters, domain, components), and their proofs re-ran green above.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `extractImportAction` answers (7) | plan Surface; `web/app/(app)/import-actions.ts` (FORBIDDEN, isUuid, `status: extracted.code`, two success branches) | forbidden C534 · not_found C535, C546 · not_ready, too_large, unavailable C546 · extracting, extracted C546 (refresh counted) | - |
| job statuses (6) | migration line 11 status check | all 6 C527 (table-driven) · refused 3 C528 · extracted C526 · extracting C523 · parsed C504 | - |
| chunk kinds (3) | `chunksOf` (`web/domain/imports/index.ts`) | rows C503 · text C508 · pdf C509 | - |
| chunk sizes (5) | plan Criteria preamble | C503 over all 5 | - |
| confidence (3) | migration line 37, adapter `CONFIDENCE` | C511 adapter · C547 SQL | - |
| source_ref rule | `rowFor` `invented` (rows chunk: null or not in refs; other kinds: kept) | C512, 5 rows cases + pdf + text | - |
| text cleaning (5 values × 5 fields) | `cleaned` in `extract-import.ts` | C514 over all 5 values on all 5 fields | - |
| normalizer outcomes | `matchAssetType` branches: empty, direct single, direct ambiguous, synonym single, synonym ambiguous, none | empty C517 · direct C515 · direct ambiguous C517 · synonym C516 · name over synonym C516 · none C517 · org-scoped C518. Synonym-ambiguous needs two org types with distinct codes sharing a synonym; the table has no shared synonym, so it cannot be reached today | - |
| synonym table | `SYNONYMS` keys vs catalog migration | C520 over every key; roadmap examples C516, C520 | - |
| extractor failures (AC 21, adapter side) | `claudeAssetExtractor` and `readRows` branches | no key, 429, 500, refusal, non-JSON, no rows, rows not array, missing confidence, bad confidence, non-text field C530 · max_tokens C531. The branch in `readRows` that refuses a null or non-object row has no case, but removing it still yields `unavailable` through the outer catch (equivalent) | - |
| use-case failures (AC 21: download, parser, catalog, Claude, recording) | AC 21 + `makeExtractImport` branches (`web/application/use-cases/extract-import.ts:46`, `:56`, `:59-61`, `:73`, `:82`, `:86`) | sourceOf unavailable, parser throws, **parser returns `{ ok: false }`** (`extract-import.test.ts:235`, fault 2 killed), catalog throws, extractor unavailable, record unavailable C529 · download C529 (store) · re-read `sourceOf` unavailable at `:86` is the same `if (!x.ok) return x` shape as `:46` (not separately cased; equivalent) | - |
| use-case defensive branches (3) | `web/application/use-cases/extract-import.ts:48`, `:67`, `:87` | extracted with no result `extract-import.test.ts:250` · no chunk at the cursor `:251` · re-read after the last chunk not extracted `:253`, each asserting `:261` `toEqual({ ok: false, code: "unavailable" })` and `:262` log count; faults 3, 4, 5 killed. These tests carry no check id (named `use case: when ...`); they answer the Test policy row, not a check | - |
| output-limit cases (3) | adapter line 138-140 | C531 | - |
| failure messages (5) | `EXTRACT_MESSAGES` (`web/components/imports/state.ts`) | C544 over all 5 | - |
| RPC outcomes | migration raises at lines 84, 87, 102 + success | ok C505/C507/C525 · 40001 C525, C549 · P0002 C536, C549 · 42501 C536 | - |
| adapter RPC mapping | `recordExtraction` branches | ok, done, stale extracting, stale extracted, P0002, 42501, other C524 | - |
| transitions written / refused | migration RPC + checks | parsed->extracting C505 · extracting->extracting C507 · ->extracted C513 · refused uploading/uploaded/unreadable/extracted/wrong cursor/wrong total C549, C525 | - |
| `import_rows` constraints (11) | migration lines 30-61 | C547, each labelled | - |
| `import_jobs` extraction constraints (12) | migration lines 10-25 | C548, each labelled | - |
| roles (writer / viewer / other org) | policies lines 54-61, RPC role check | C505, C547 · C534, C536, C547, C522, C541 · C536, C550 | - |
| list-state forms and pill tones | `STATUS_LABELS` + `ATTENTION` (`web/components/imports/job-list.tsx:9-18`), AC 16 and AC 33 | extracting pill and progress C522 · 5 count lines C543 · **`extracted` pill neutral C543** (`extract.test.ts:97`, fault 1 killed) · Read pill C541 | - |
| button states (3) | `ExtractPrompt` label | C542 | - |
| restricted SDK places (7) | `web/eslint.config.mjs:13` rule | C539 over 6 + allowed 1 | - |
| request settings (7) | `requestFor` (`web/infrastructure/claude/index.ts:73-83`) | C553 | - |
| Landing doors (7) | plan Landing | 1 C547 · 2 C548 · 3 C551, C510 · 4 C549, C524 · 5 C552, C539 · 6 C551, C527, C524 · 7 C550, C521, C545 · all C560 | - |
| startup config: container (1) | `web/composition/index.ts:100`, read directly | C537, C555 | - |
| secret places (2) | greps over `web/` | C540 · C552 | - |

## Test policy rows

Verified at 6b61a9c for the use-case row (unmet in round 1) and for the rows that classify touched surfaces. The boundary and entry-point rows are carried from 7dba9bb, because no file they classify changed.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `web/infrastructure/claude/index.ts`, `ImportJobStore.sourceOf`/`recordExtraction` in `web/infrastructure/supabase/imports.ts`, the RPC in the migration | boundary: SQL C505-C550 for store/RPC; the real Claude boundary only through C562 (author-run live). Own layer: C502, C510, C511, C530, C531, C538, C553 (fake client); C521, C524, C527, C535, C545 (stub) | yes (carried from 7dba9bb; round-1 faults 4 and 5 killed) |
| Decides, not reached across a boundary | `web/domain/imports/index.ts` (normalizer, chunker), `web/application/use-cases/extract-import.ts` | own layer, one asserted case per decision-table row | yes. Use case: 3 refused statuses C528, stored result C526, failure paths C529 incl. parser `{ ok: false }` (`extract-import.test.ts:235`), defensive branches `:48`/`:67`/`:87` (`extract-import.test.ts:250-262`), `source_ref` C512, cleaning C514; faults 2-5 killed at 6b61a9c. Normalizer and chunker carried (round-1 fault 3 killed) |
| Entry point that decides nothing | `web/app/(app)/import-actions.ts` `extractImportAction` | at the boundary: accepted input, each rejected input, each error path | yes: C534, C535, C546 (carried from 7dba9bb) |
| Instrumentation, pass-throughs | `web/composition/index.ts`, `ExtractPrompt`, the `web/components/imports/job-list.tsx` pill mapping | none of its own; covered by consumer | yes. The pill tone is now asserted through C543 (fault 1 killed). The stateful `ExtractControl` (`web/components/imports/extract-control.tsx:111-127`) is not a pure pass-through. Its progress wiring is covered only by the author's live run (`.specs/features/import-extract/checks.md:589`), unchanged since round 1 |

## Faults injected

Verified at 6b61a9c.

- **Scratch.** `git worktree add --detach <scratchpad>/wt2 HEAD` at 6b61a9c, with its own `npm ci --allow-remote=all`.
- **Per fault.** Each fault was applied alone with `sed`, and the narrowest proof ran. The worktree was then reset with `git checkout -- .`; the porcelain count was `0` after each reset.
- **SQL surface.** Not mutated. The SQL tests run against the live schema.
- **Real tree.** `git status --porcelain` was recorded before and compared after with `diff`. They were identical: ` M web/.env.example`, `?? .agents/skills/`, `?? .claude/skills/use-railway/`, `?? .specs/features/import-extract/verification.md`, `?? skills-lock.json`.
- **Cleanup.** The worktree was removed and pruned; `git worktree list` shows only the main tree. A leftover directory with over-long paths was deleted separately.

| Mutation | Location | Killed |
| --- | --- | --- |
| `extracted` added to the `ATTENTION` set (pill turns attention) | `web/components/imports/job-list.tsx:18` | yes - C543 5 failed |
| parser `{ ok: false }` returns `not_ready` instead of logging and returning `unavailable` | `web/application/use-cases/extract-import.ts:56` | yes - `C529: when the parser no longer reads the file` failed (1 failed, 5 passed) |
| extracted job with no stored result answers `extracted` 0/0 instead of `unavailable` | `web/application/use-cases/extract-import.ts:48` | yes - `use case: when an extracted job has no stored result` failed |
| missing chunk at the cursor falls back to the first chunk instead of `unavailable` | `web/application/use-cases/extract-import.ts:66` | yes - `use case: when no chunk sits at the stored cursor` failed |
| re-read after the last chunk not extracted answers `extracting` instead of `unavailable` | `web/application/use-cases/extract-import.ts:87` | yes - `use case: when the re-read after the last chunk is not extracted` failed |

Carried from 7dba9bb (untouched surfaces, killed in round 1): ambiguous direct match (`web/domain/imports/index.ts:79`, C517), rows-chunk `max_tokens` (`web/infrastructure/claude/index.ts:140`, C531), stale-cursor re-read (`web/infrastructure/supabase/imports.ts`, C524).

## Gate

Verified at 6b61a9c.

- Batched vitest proofs: 139 passed, 0 failed (377 skipped by the filter)
- `npm test`: 46 files, 893 passed, 0 failed
- `npm run lint`: exit 0
- `npm run test:db`: 13 passed, 0 failed
- `npx next build`: exit 0 (scratch worktree at 6b61a9c)
- `get_advisors` security: exactly the two accepted findings
- Live state: carried from 7dba9bb (no live run this round; no production code changed)

## Ranked gaps

None fail the feature.

1. **AC 32 wiring (the 7dba9bb fix) still has no automated proof.** This is not a check failure: C542 is defined on props and passes. No test imports `web/components/imports/extract-control.tsx:121` (`onProgress: setProgress`, outside `startTransition`), so reverting it would leave the suite green. Its only proof is the author's live run at `.specs/features/import-extract/checks.md:589`. The repo has no DOM test environment.
2. **C529's wording lags its test** (a note, not a failure). `.specs/features/import-extract/checks.md:241` still says "table-driven over 5" and names only "the parser throws". The test now covers 6 cases, including the parser's `{ ok: false }` shape. The three defensive-branch tests carry no check id, so no check names them; they answer only the `Test policy` row.
