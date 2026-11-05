# Import parse verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 3895d37..5d574d3 (round 1 covered 3895d37..907205c; round 2 adds 907205c..5d574d3)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier). A fresh sub-agent, different from the round 1 Verifier, that did not write this code and worked read-only over the source tree.

49 of 49 checks are proven. The round 1 FAIL, C484, is closed: the viewer-view test now asserts the neutral "Read" pill and the attention "Can't read" pill (`web/components/imports/imports.test.ts:287-288`). The fix `907205c..5d574d3` touches only three test files, one fixture and its build script (9 added lines, no source file). Per verify.md "Re-verifying after a fix", I re-ran every vitest proof, `npm test` and `npm run lint` in full at `5d574d3`, refreshed the citations in the touched files, and re-judged C484 plus the round 1 gaps the fix addressed. The proofs the fix cannot reach (`npx next build`, `npm run test:db`, the MCP advisors, the shell greps, the live journey) are carried from `907205c` and each says so.

Under `light`, the Coverage recompute, the Test policy verdicts and fault injection are not owed, so this report has no sections for them.

## Checks

Vitest proofs, **verified at 5d574d3**, in one invocation from `web/`:
`npx vitest run components/imports infrastructure/import-parsers application/use-cases infrastructure/supabase "app/(app)" composition boundaries -t "C451:|C452:|...|C498:" --reporter=verbose`.
It exited 0 with 98 passed and 292 skipped (round 1: 96; the 2 new ones are the Word C471 case and the `unavailable` C498 case). I counted passing test names per id in the verbose log, with 0 failures for every id: C451 2, C452 1, C453 1, C454 1, C455 7, C456 3, C457 2, C458 1, C459 1, C460 2, C461 4, C462 2, C463 4, C464 2, C465 2, C467 2, C468 5, C469 3, C470 1, C471 5, C472 5, C473 2, C474 2, C476 1, C477 5, C478 1, C479 2, C480 1, C481 2, C483 1, C484 1, C485 5, C486 1, C487 12, C490 1, C491 1, C498 4. The ids with no vitest proof (SQL C466, C475, C482, C488; shell or command C489, C492-C495, C497; MCP C496; live C499) are carried from `907205c`, except C494, which I re-ran.

In the Proof run column, "re-run at 5d574d3" means the vitest proof passed in the batch above. Citations in the files the fix touched (`web/components/imports/imports.test.ts`, `web/infrastructure/import-parsers/parsers.test.ts`, `web/infrastructure/import-parsers/fixtures/build.py`, `web/app/(app)/imports.test.ts`) are re-read at `5d574d3`. The other citations are unchanged from round 1, because the fix did not touch those files.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C451 | read called once with jobId after confirm, its state returned; never on upload_missing | re-run at 5d574d3, 2 passed | `web/components/imports/imports.test.ts:166-169` - `expect(result).toEqual({ status: "unreadable", reason: "no_table" })`, `expect(read).toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith("job-1")`, `expect(order).toEqual(["confirm", "read"])`. `:180` - `expect(read).not.toHaveBeenCalled()` (above the fix's insertion, unchanged) | PASS |
| C452 | reading state: disabled "Reading…" button, disabled picker, file name shown | re-run at 5d574d3, 1 passed | `web/components/imports/imports.test.ts:245-247` - `toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Reading…<\/button>/)`, `toMatch(/<input[^>]*type="file"[^>]*disabled=""/)`, `toContain("units.xlsx")` | PASS |
| C453 | title row, header in row 3, 48 rows: 1 table `Units`, header, 48 rows | re-run at 5d574d3, 1 passed | `web/infrastructure/import-parsers/parsers.test.ts:46-50` - `toHaveLength(1)`, `expect(table.source).toBe("Units")`, `expect(table.header).toEqual(HEADER)`, `expect(table.rows).toHaveLength(48)` | PASS |
| C454 | sheets North (3 rows) and South (4 rows): 2 tables in order | re-run at 5d574d3, 1 passed | `web/infrastructure/import-parsers/parsers.test.ts:55-56` - `toEqual(["North", "South"])`, `toEqual([3, 4])` | PASS |
| C455 | header rule over 7 cases | re-run at 5d574d3, 7 passed | `web/infrastructure/import-parsers/parsers.test.ts:77` - `expect(sources(result)).toEqual(found ? ["Case", "Control"] : ["Control"])`, over `:63-74` | PASS |
| C456 | `,` `;` tab give the same header and cells, source `CSV` | re-run at 5d574d3, 3 passed | `web/infrastructure/import-parsers/parsers.test.ts:104-110` - `toBe("CSV")`, `toEqual(["Unit", "Location"])`, rows `toEqual([["RTU-1","Roof"],["EF-2","Level 2"],["B-3","Basement"]])` | PASS |
| C457 | Windows-1252 bytes, UTF-8 and the BOM case | re-run at 5d574d3, 2 passed | `web/infrastructure/import-parsers/parsers.test.ts:114-115` - `toEqual(["1", "Montréal"])`; `:119` UTF-8 `toEqual(["1", "Montréal"])`; `:121` `header[0]` `toBe("Unit")` | PASS |
| C458 | two-tables.docx: `Table 1` and `Table 2`, 10 + 5 rows, paragraph in text | re-run at 5d574d3, 1 passed | `web/infrastructure/import-parsers/parsers.test.ts:128-131` - `toEqual(["Table 1", "Table 2"])`, `toEqual([10, 5])`, `toContain("Mechanical room access via the north stairwell")`; fixture at `fixtures/build.py:52-55` | PASS |
| C459 | text-only.docx: `tables: []`, text holds both paragraphs | re-run at 5d574d3, 1 passed | `web/infrastructure/import-parsers/parsers.test.ts:136-138` - `expect(result.tables).toEqual([])` and two `toContain` | PASS |
| C460 | `%PDF-` at 0 and after 1,000 junk bytes pass through byte for byte | re-run at 5d574d3, 2 passed | `web/infrastructure/import-parsers/parsers.test.ts:158-159` - `toEqual({ ok: true, parsed: { format: "pdf", bytes: data } })`, `Array.from(bytes)` `toEqual(Array.from(data))` | PASS |
| C461 | cells read as displayed text, 4 cases | re-run at 5d574d3, 4 passed | `web/infrastructure/import-parsers/parsers.test.ts:87` - `expect(result.tables[0].rows[0].cells[1]).toBe(text)`, over `:81-84` | PASS |
| C462 | refs `Units!4`..`Units!51`, gap keeps sheet row, `Table 2, row 1`..`row 5` | re-run at 5d574d3, 2 passed | `web/infrastructure/import-parsers/parsers.test.ts:92-96` - `toBe("Units!4")`, `toBe("Units!51")`, `toEqual(["Gap!2", "Gap!4"])`; `:143-144` - `toBe("Table 2, row 1")`, `toBe("Table 2, row 5")` | PASS |
| C463 | use case maps 4 parse answers, recordRead once each | re-run at 5d574d3, 4 passed | `web/application/use-cases/read-import.test.ts:38-41` - `toEqual({ ok: true, outcome })`, `recordRead` `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(JOB, outcome)` | PASS |
| C464 | recordRead update values, clock times, filters `id` and `status = uploaded`, `.select` | re-run at 5d574d3, 2 passed | `web/infrastructure/supabase/imports.test.ts:230-238` - update args `toEqual([{ status: "parsed", table_count: 1, row_count: 48, read_error: null, read_at: ..., updated_at: ... }])`, eq `toEqual([["id", JOB], ["status", "uploaded"]])`; `:246-248` unreadable payload | PASS |
| C465 | fileOf: uploaded downloads once; parsed returns stored outcome, no download | re-run at 5d574d3, 2 passed | `web/infrastructure/supabase/imports.test.ts:195-196` - `toEqual({ ok: true, status: "uploaded", ..., bytes: new Uint8Array([7, 8, 9]) })`, one `download`; `:202-203` - `bytes: null`, storage calls `toEqual([])` | PASS |
| C466 | SQL as uE: uploaded -> parsed and -> unreadable each update 1 row | carried from 907205c (`npm run test:db import_parse`, PASS) | `supabase/tests/import_parse.sql:30-33` - `tests.expect_rows('C466 parsed', ..., 1)`, `expect_rows('C466 unreadable', ..., 1)` | PASS |
| C467 | OLE signature on .xlsx and .docx gives password_protected | re-run at 5d574d3, 2 passed | `web/infrastructure/import-parsers/parsers.test.ts:166` - `toEqual({ ok: false, reason: "password_protected" })` | PASS |
| C468 | corrupt, 5 cases | re-run at 5d574d3, 5 passed | `web/infrastructure/import-parsers/parsers.test.ts:177` - `toEqual({ ok: false, reason: "corrupt" })`, over `:171-175` | PASS |
| C469 | no_table, 3 cases | re-run at 5d574d3, 3 passed | `web/infrastructure/import-parsers/parsers.test.ts:185` - `toEqual({ ok: false, reason: "no_table" })`, over `:181-183` | PASS |
| C470 | blank.docx gives no_text | re-run at 5d574d3, 1 passed | `web/infrastructure/import-parsers/parsers.test.ts:148` - `toEqual({ ok: false, reason: "no_text" })`; fixture `fixtures/build.py:61` | PASS |
| C471 | row cap: 2,000 read; 2,001, 1,000+1,001 and 100,000 are too_many_rows | re-run at 5d574d3, 5 passed (round 1: 4) | **refreshed**: `web/infrastructure/import-parsers/parsers.test.ts:190` - `toHaveLength(2000)`; `:193`, `:197`, `:203` - `toEqual({ ok: false, reason: "too_many_rows" })`. New Word case `:200` - `expect(await readDocx(fixture("big-table.docx"))).toEqual({ ok: false, reason: "too_many_rows" })`. Fixture built at `fixtures/build.py:64` (header plus `range(1, 2002)`); I opened `big-table.docx` read-only and its `word/document.xml` holds 1 table with 2,002 `<w:tr>` (header + 2,001). The cap it reaches is `web/infrastructure/import-parsers/docx.ts:74`, the only `too_many_rows` return in that file | PASS |
| C472 | unreadable: attention pill "Can't read" plus each of the 5 messages | re-run at 5d574d3, 5 passed | `web/components/imports/imports.test.ts:258-260` - `toContain("Can't read")`, `toMatch(/data-tone="attention"/)`, `toContain(message)`, over `:251-255` | PASS |
| C473 | parsed or unreadable job returns stored outcome; no parse, no recordRead | re-run at 5d574d3, 2 passed | `web/application/use-cases/read-import.test.ts:49-51` - `toEqual({ ok: true, outcome })`, both `.not.toHaveBeenCalled()` | PASS |
| C474 | lost compare-and-set returns stored outcome; uploading gives not_ready | re-run at 5d574d3, 2 passed | `web/infrastructure/supabase/imports.test.ts:254` - `toEqual({ ok: true, outcome: { status: "unreadable", reason: "corrupt" } })`; `:260` - `toEqual({ ok: false, code: "not_ready" })` | PASS |
| C475 | SQL: second write on a parsed job updates 0 rows, row_count stays 48 | carried from 907205c (`npm run test:db import_parse`, PASS) | `supabase/tests/import_parse.sql:38-40` - `expect_rows('C475 second write', ..., 0)`, `tests.ok('C475 kept', ... = 48, ...)` | PASS |
| C476 | uploading gives not_ready, no parse, no write | re-run at 5d574d3, 1 passed | `web/application/use-cases/read-import.test.ts:58-60` - `toEqual({ ok: false, code: "not_ready" })`, both `.not.toHaveBeenCalled()` | PASS |
| C477 | download, parser and update failures give unavailable, write nothing, log once; message shown | re-run at 5d574d3, 5 passed | `web/infrastructure/supabase/imports.test.ts:217-218` - `toEqual({ ok: false, code: "unavailable" })`, `error` `toHaveBeenCalledTimes(1)`; `web/application/use-cases/read-import.test.ts:69-71`, `:77-79` - unavailable, no `recordRead`; `web/infrastructure/supabase/imports.test.ts:267-268` - XX000 unavailable, logged once; `web/components/imports/imports.test.ts:264-265` - `toBe("We couldn't read the file. Try again.")` and `ReadFilePrompt` `state: { status: "unavailable" }` `toContain(...)`. The action now passes `unavailable` through, proven by C498 at `web/app/(app)/imports.test.ts:181`, `:186` | PASS |
| C478 | uploaded: "Uploaded" and "Read file" for a writer; pending disabled "Reading…" | re-run at 5d574d3, 1 passed | `web/components/imports/imports.test.ts:270-274` - `toContain("Uploaded")`, `toMatch(/<button[^>]*>Read file<\/button>/)`, `toMatch(/<button[^>]*disabled=""[^>]*>Reading…<\/button>/)` | PASS |
| C479 | confirmUploaded on parsed or unreadable job: ok, no storage call, no update | re-run at 5d574d3, 2 passed | `web/infrastructure/supabase/imports.test.ts:276-278` - `toEqual({ ok: true })`, storage and update calls `toEqual([])` | PASS |
| C480 | viewer gets forbidden, readImport not called | re-run at 5d574d3, 1 passed | `web/app/(app)/imports.test.ts:168-169` - `toEqual({ status: "forbidden" })`, `.not.toHaveBeenCalled()` (re-read, unchanged) | PASS |
| C481 | non-uuid id gives not_found; fileOf with no row gives not_found, no download | re-run at 5d574d3, 2 passed | `web/app/(app)/imports.test.ts:173-174` - `toEqual({ status: "not_found" })` (re-read, unchanged); `web/infrastructure/supabase/imports.test.ts:209-210` - `toEqual({ ok: false, code: "not_found" })`, storage `toEqual([])` | PASS |
| C482 | SQL: viewer and org B updates change 0 rows; org B sees 0 rows | carried from 907205c (`npm run test:db import_parse`, PASS) | `supabase/tests/import_parse.sql:14-15`, `:21-23` - `expect_rows(..., 0)` twice, `tests.ok('C482 other org reads nothing', ... = 0, ...)` | PASS |
| C483 | readImport on the request's one Supabase client; no `SERVICE_ROLE` under web/ | re-run at 5d574d3, 1 passed; grep carried from 907205c (`0`) | `web/composition/composition.test.ts:119-121` - `toMatch(/const importJobs = supabaseImportJobStore\(supabase, /)`, `toContain("readImport: makeReadImport(importJobs, importParser)")`, `createServerClient<` `toHaveLength(1)` | PASS |
| C484 | viewer view: parsed and unreadable jobs with their pill and line, no "Read file" | re-run at 5d574d3, 1 passed | **re-judged**: `web/components/imports/imports.test.ts:276-290`, rendered with `list([...], false)`, which passes `{ jobs }` only, the viewer props (`:239-240`). `:285` - `toContain("48 rows in 1 table")`; `:286` - `toContain("This document has no text.")`; `:287` - `toMatch(/<span data-tone="neutral"[^>]*>Read<\/span>/)`; `:288` - `toMatch(/<span data-tone="attention"[^>]*>Can't read<\/span>/)`; `:289` - `not.toContain("Read file")`. The pill markup the regexes target is `web/components/ui/status-pill.tsx:27-31` (`<span data-tone={tone} ...>{label}</span>`), rendered for every role at `web/components/imports/job-list.tsx:47`. `>Read<\/span>` cannot match the third job's "Uploaded" pill, so each pill clause is pinned to its job. All three clauses of the claim (pill, line, no button) are now asserted | PASS |
| C485 | parsed: neutral "Read" pill plus the count line, 5 cases | re-run at 5d574d3, 5 passed | **refreshed**: `web/components/imports/imports.test.ts:301-304` - `toContain(">Read<")`, `pill(out)?.[1]` `toBe("neutral")`, `toContain(line)`, `not.toContain("Read file")`, over the 5 lines at `:294-298` | PASS |
| C486 | forSite selects read columns, maps parsed, unreadable, uploaded | re-run at 5d574d3, 1 passed | `web/infrastructure/supabase/imports.test.ts:296-301` - select `toContain` `read_error`, `table_count`, `row_count`; mapping `toEqual([...])` | PASS |
| C487 | xlsx and mammoth lint error in 5 places, allowed in import-parsers | re-run at 5d574d3, 12 passed | `web/boundaries.test.ts:49-50` - `expect(messages).toHaveLength(1)`, `toContain(specifier)`; `:55` - `toHaveLength(0)`; rule at `web/eslint.config.mjs:6-9`. See Gaps 1 on the cold-start timeout | PASS |
| C488 | SQL: 9 read-rule refusals, each 23514 | carried from 907205c (`npm run test:db import_parse`, PASS) | `supabase/tests/import_parse.sql:47-64` - 9 `tests.expect_error('C488 ...', ..., '23514')`; constraints at `supabase/migrations/20261026220638_import_parse.sql:7-18` | PASS |
| C489 | package.json pins and installed versions | carried from 907205c (grep `2`; `npm ls` `mammoth@1.13.0`, `xlsx@0.20.3`) | `web/package.json:16` - `"mammoth": "1.13.0"`; `web/package.json:21` - `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` | PASS |
| C490 | ports declare ImportParser, ParsedImport, ParsedTable, fileOf, recordRead | re-run at 5d574d3, 1 passed | `web/composition/composition.test.ts:127-134` - `toContain("parse(contentType: ImportContentType, bytes: Uint8Array)")`, `"fileOf(jobId: string)"`, `"recordRead(jobId: string, outcome: ReadOutcome)"` | PASS |
| C491 | getContainer() returns readImport | re-run at 5d574d3, 1 passed | `web/composition/composition.test.ts:114` - `expect(typeof container.readImport).toBe("function")` | PASS |
| C492 | migration file exists; database.types has the 4 columns | carried from 907205c (`1`, `12`) | `supabase/migrations/20261026220638_import_parse.sql:8-12`; `web/infrastructure/supabase/database.types.ts:402-403` - `read_at` and `read_error` typed as nullable strings | PASS |
| C493 | `npm run test:db` exits 0 with import_parse among 12 recipes | carried from 907205c (`12 passed, 0 failed`, exit 0) | `web/scripts/test-db/runner.mts:40` - `plain("import_parse")`; `web/scripts/test-db/runner.test.ts:118` - `expect(f.connects).toBe(12)` | PASS |
| C494 | full Vitest suite and lint pass | re-run at 5d574d3: `npm test` 3 runs - run 1 exit 1 (2 timeouts, 752 passed), runs 2 and 3 exit 0 (41 files, 754 passed); `npm run lint` exit 0 | the suite runs are the evidence; this feature's new tests are in it, e.g. `web/infrastructure/import-parsers/parsers.test.ts:200`. Run 1's two failures were `Test timed out in 5000ms` on the first lint-instantiating case of `web/boundaries.test.ts` (C487) and of `web/domain/purity.test.ts` (C32), files the fix did not touch, with no assertion failing. Run alone, those cases take 1.2 s, and 3.8 s in the batch. See Gaps 1 | PASS |
| C495 | `npx next build` exits 0 | carried from 907205c (exit 0) | `web/app/(app)/sites/[siteId]/import/page.tsx:1`. The fix touches no file the build compiles (`*.test.ts`, a `.docx` and a `.py`) | PASS |
| C496 | security advisors report exactly the 2 accepted findings | carried from 907205c (MCP `get_advisors`) | `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection` only; migration `supabase/migrations/20261026220638_import_parse.sql:5` | PASS |
| C497 | 3 AD rows; CONTEXT names import-parse; ROADMAP item ticked | carried from 907205c (`3`, `3`, `1`) | `.specs/STATE.md:41-43`; `CONTEXT.md:70`; `ROADMAP.md:108` - `- [x] xlsx/csv, docx and pdf parsers behind ImportParser...` | PASS |
| C498 | readImportAction passes answers through; refresh once on a read | re-run at 5d574d3, 4 passed (round 1: 3) | **refreshed**: `web/app/(app)/imports.test.ts:186-188` - `toEqual(state)`, `toHaveBeenCalledWith(JOB)`, `expect(refresh).toHaveBeenCalledTimes(refreshes)`, over `:178-181` (parsed 1, unreadable 1, not_ready 0, and new `unavailable` -> `{ status: "unavailable" }`, 0); `vi.clearAllMocks()` at `:57`. Code under test: `web/app/(app)/import-actions.ts:59` | PASS |
| C499 | live journey at 3 sizes, cleanup | carried from 907205c (Playwright MCP, round 1 Verifier) | round 1 Live run: every file ended as claimed at 1440x900, 768x1024 and 375x812, labels `Uploading…>Reading…>Upload`, final SQL 0 jobs and 0 objects. The renamed `.pdf` showed the `corrupt` text from `web/components/imports/imports.test.ts:251`. The fix changes no runtime code | PASS |

## Live run (C499, carried from 907205c)

Not re-run: the fix touches no runtime file. The round 1 record stands, and I summarize it here. One signed-in context. Fictitious files `units.xlsx`, `units.csv`, `units.docx`, `units.pdf` and `notes.pdf` were uploaded at 1440x900, 768x1024 and 375x812 with identical results: `Read | 5 rows in 1 table`, `Read | 3 rows in 1 table`, `Read | 4 rows in 1 table`, `Read | PDF, read at extraction`, and `Can't read | This file is damaged or isn't the format its name says.` There was no horizontal scroll, and targets were 44 px tall at 768 and 375. The console was clean. There was no 4xx or 5xx, and every Server Action POST was answered 200, though some were then reported `net::ERR_ABORTED`. Cleanup by discard ended at 0 jobs and 0 `imports` objects.

## Swept rows (carried from 907205c)

Data lifecycle (`n/a`, leans on existing discard): `web/infrastructure/supabase/imports.ts:107` deletes the row, and `:113` removes the object. The live cleanup confirmed this.

## Gaps

Closed by the fix:

- **C484 pill clause (round 1 Findings 1, the FAIL).** Closed. `web/components/imports/imports.test.ts:287-288` asserts each pill, with its tone, in the viewer view.
- **C477 / C498: the action's `unavailable` path (round 1 Findings 2, second half).** Closed. `web/app/(app)/imports.test.ts:181`, `:186-188` call `readImportAction` with `{ ok: false, code: "unavailable" }`, assert `{ status: "unavailable" }`, and assert no refresh. The Surface row's `unavailable` member is now proven at the Server Action boundary.
- **AC 17 Word-path cap (round 1 Findings 5).** Closed for the refusal side. `web/infrastructure/import-parsers/parsers.test.ts:200` drives `readDocx` over a real 2,001-row table (fixture `fixtures/build.py:64`, 2,002 `<w:tr>` confirmed) and reaches `web/infrastructure/import-parsers/docx.ts:74`.

Still open (none fails a check):

1. **Suite timing flake (C494, C487).** The first `npm test` run at `5d574d3` exited 1. The first ESLint-instantiating case in `web/boundaries.test.ts:45-52` (C487) and in `web/domain/purity.test.ts` (C32) hit vitest's default 5000 ms timeout under 41 parallel workers. Two re-runs were green (754/754). No assertion failed. The fix did not touch these files, but C487's cases were added by this feature in `8d1ca2d`. A per-test timeout or a shared, warmed ESLint instance would make the gate deterministic.
2. **C477 upload-path mapping, untested.** `web/components/imports/import-upload.tsx:102` turns a post-storage `unavailable` into `read_failed`, and no test asserts that line. Only `uploadMessage({ status: "read_failed" })` is asserted (`web/components/imports/imports.test.ts:264`). The claim's wording ("`readImportAction` maps `unavailable` to the message") also names the wrong layer: the action passes it through (`web/app/(app)/import-actions.ts:59`).
3. **C499 wording: aborted Server Action streams** (carried from 907205c). Some 200-answered action POSTs logged `net::ERR_ABORTED`. The claim's exemption covers this as written, but it does not pin the case down.
4. **C488 asserts SQLSTATE `23514` only**, not the constraint name (`supabase/tests/import_parse.sql:47-64`). Minor; carried.
5. **AC 17 Word-path 2,000-row acceptance edge.** Only the 2,001 refusal is proven for Word (`web/infrastructure/import-parsers/parsers.test.ts:200`). The exactly-2,000 acceptance is proven for CSV only (`:190`). Minor.
6. **C474 re-read not counted.** The second select is shown by the stub's sequenced reply being consumed (`web/infrastructure/supabase/imports.test.ts:254`). No call count names it. Acceptable at stub level; carried.

## Gate

Verified at 5d574d3:

- `npx vitest run <7 dirs> -t "<C451:..C498:>" --reporter=verbose`: 98 passed, 292 skipped, 0 failed, exit 0. Every vitest-proven id has at least 1 passing test.
- `npm test`:
  - run 1: 752 passed, 2 failed (5000 ms timeouts, C487 and C32), exit 1;
  - runs 2 and 3: 41 files, 754 passed, 0 failed, exit 0.
- `npm run lint`: exit 0.
- `big-table.docx` was opened read-only: 1 table, 2,002 rows.

Carried from 907205c (the fix touches only `*.test.ts`, a `.docx` fixture and `build.py`):

- `npx next build` exit 0.
- `npm run test:db import_parse` PASS, and `npm run test:db` 12 passed.
- Shell proofs C483 `0`, C489 `2`, C492 `1`/`12`, C497 `3`/`3`/`1`.
- MCP `get_advisors`: the 2 accepted findings.
- Live C499 at 3 sizes, cleanup at 0.

Checks proven: 49/49.

`git status --porcelain`: the only change is this report. The untracked `.agents/skills/`, `.claude/skills/use-railway/` and `skills-lock.json` were there before this run.
