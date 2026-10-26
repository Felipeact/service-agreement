# Asset import, step 2: read each uploaded file - checks

Profile: light
Plan: `.specs/features/import-parse/plan.md`

46 checks in 4 slices plus doors and delivery · 4 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C451:`).
  This feature numbers from C451, because earlier features own `C1:`-`C348:` and `C401:`-`C444:`.
  Parser tests live beside the adapter in `infrastructure/import-parsers` and build their input
  bytes in the test: spreadsheets with SheetJS's own writer (`XLSX.utils.aoa_to_sheet`,
  `XLSX.write`), CSVs as byte arrays, PDFs as byte arrays. Word inputs are small `.docx` fixtures
  committed under `infrastructure/import-parsers/fixtures/`, each built from literal
  WordprocessingML by a script committed beside them, so the table counts the checks name are
  visible in the source. Supabase is the recording `stubClient`, which gains
  `storage.from(bucket).download`. Components are asserted with `renderToStaticMarkup`; a client
  control's pending state is proven through the presentational component with the state passed
  as props, as import-upload did. Actions are called directly with `@/composition` and
  `next/cache` mocked, as `app/(app)/imports.test.ts` does.
- **test:db** - `npm run test:db import_parse` in `web/` (AD-026) runs `fixture.sql` and then the
  new `supabase/tests/import_parse.sql`, rolled back. The file joins `RECIPES` as
  `plain("import_parse")`, and passes only when its last row is `import_parse: pass`. Each
  assertion is labelled with its check id. Fixture as import-upload: org A owner `uA`, estimator
  `uE`, viewer `uV`; org B owner `uB`; `siteA`, `siteB`.
- **shell** - a command run from `web/` (or the repo root where the path says `../`) that passes
  when it exits 0, or prints the stated count.
- **mcp** - a Supabase MCP call on project `gnxebrtcpbujhvcamtoe`, result recorded in the Handoff.
- **live** - a real browser on `npm run dev` through the Playwright MCP, in one signed-in context
  as the demo owner, on one demo site. Not committed (AGENTS..md). Fictitious files are made in
  the scratchpad and discarded through the UI afterwards.

"Writer" means role owner, admin or estimator. "Writer view" is the view rendered with role
`estimator`, "viewer view" with role `viewer`. "Data row", "header row" and "table" are as in the
plan's Criteria preamble. "The parser" is the `ImportParser` adapter in
`infrastructure/import-parsers`; "the use case" is the read-import use case in
`application/use-cases`.

## Checks

### S1 - A good file is read right after upload · ~12 files · ~30k

**C451** - `uploadFile` with deps `{ start, confirm, read, fetch }`: when `confirm` returns
`{ status: "uploaded" }`, `read` is called exactly once with the started `jobId`, after `confirm`,
and `uploadFile` returns the state `read` returned; when `confirm` returns `upload_missing`, `read`
is never called (AC 1)
Proof: `npx vitest run components/imports -t "C451:"`

**C452** - `ImportUploadFields` with state `{ status: "reading" }` and file name `units.xlsx`
renders the submit button `disabled` with text "Reading…", the file input `disabled`, and the text
`units.xlsx` (AC 2)
Proof: `npx vitest run components/imports -t "C452:"`

**C453** - the parser, given an `.xlsx` whose only sheet `Units` has a title in row 1, an empty
row 2, the header `Unit | Type | Model | Location` in row 3 and 48 data rows in rows 4-51, returns
`{ ok: true, parsed: { format: "table" } }` with exactly 1 table, `source` `"Units"`, `header`
`["Unit","Type","Model","Location"]` and 48 rows (AC 3)
Proof: `npx vitest run infrastructure/import-parsers -t "C453:"`

**C454** - the parser, given an `.xlsx` with visible sheets `North` (3 data rows) then `South`
(4 data rows), returns 2 tables with `source` `"North"` then `"South"` and 3 + 4 rows (AC 4)
Proof: `npx vitest run infrastructure/import-parsers -t "C454:"`

**C455** - header detection, table-driven over 7 cases, each a one-sheet `.xlsx`: a hidden sheet
holding a valid table -> skipped; a header in row 20 -> found; a header in row 21 (rows 1-20
empty) -> no table; a row with 1 non-empty text cell -> not a header; a row whose non-empty cells
include the number `12` -> not a header; a row containing a date cell -> not a header; a valid
header row with no data row below -> not a header. "Skipped" and "no table" are asserted as the
sheet contributing no table (AC 5)
Proof: `npx vitest run infrastructure/import-parsers -t "C455:"`

**C456** - the parser, given the same 2-column, 3-data-row table as `.csv` bytes with `,`, `;`
and tab delimiters, returns identical `header` and `cells` for all three, and `source` `"CSV"`
(AC 6)
Proof: `npx vitest run infrastructure/import-parsers -t "C456:"`

**C457** - `.csv` decoding: the bytes `55 6E 69 74 2C 43 69 74 79 0A 31 2C 4D 6F 6E 74 72 E9 61 6C`
(Windows-1252) read the cell `"Montréal"`; the same text as UTF-8 reads `"Montréal"`; UTF-8 with
the BOM `EF BB BF` reads the first header cell as exactly `"Unit"` (AC 7)
Proof: `npx vitest run infrastructure/import-parsers -t "C457:"`

**C458** - the parser, given fixture `two-tables.docx` (a 3-column table with 10 data rows, a
paragraph, a 4-column table with 5 data rows, and a 1-column table with 3 rows), returns
`format: "table"`, exactly 2 tables with `source` `"Table 1"` and `"Table 2"`, 10 + 5 rows, and
`text` containing the paragraph's words (AC 8)
Proof: `npx vitest run infrastructure/import-parsers -t "C458:"`

**C459** - the parser, given fixture `text-only.docx` (two paragraphs, no table), returns
`{ ok: true, parsed: { format: "table", tables: [] } }` with `text` containing both paragraphs
(AC 9)
Proof: `npx vitest run infrastructure/import-parsers -t "C459:"`

**C460** - the parser, given PDF bytes with `%PDF-1.7` at offset 0, and bytes with 1,000 junk
bytes then `%PDF-1.4`, returns `{ ok: true, parsed: { format: "pdf" } }` whose `bytes` equal the
input byte for byte (AC 10)
Proof: `npx vitest run infrastructure/import-parsers -t "C460:"`

**C461** - spreadsheet cells read as displayed text, table-driven over 4 cells: a date cell
`2019-05-01` with number format `yyyy-mm-dd` -> `"2019-05-01"`; a text cell `"0042"` -> `"0042"`;
the number `12` -> `"12"`; the text `"  RTU-1 "` -> `"RTU-1"` (AC 11)
Proof: `npx vitest run infrastructure/import-parsers -t "C461:"`

**C462** - row refs: in C453's workbook the first data row's `ref` is `"Units!4"` and the last is
`"Units!51"`; a data row after an empty sheet row keeps its own sheet row number; in C458's
fixture the first row of the second table is `"Table 2, row 1"` and its last `"Table 2, row 5"`
(AC 12)
Proof: `npx vitest run infrastructure/import-parsers -t "C462:"`

**C463** - the use case maps the parser's answer to the outcome it records, table-driven over 4:
tables `[3 rows, 4 rows]` -> `{ status: "parsed", tables: 2, rows: 7 }`; `tables: []` ->
`{ status: "parsed", tables: 0, rows: 0 }`; `format: "pdf"` -> `{ status: "parsed", tables: null,
rows: null }`; `{ ok: false, reason: "no_table" }` -> `{ status: "unreadable", reason: "no_table" }`;
each passed once to `recordRead(jobId, outcome)` (AC 3, 8, 9, 10; doors 3 and 4)
Proof: `npx vitest run application/use-cases -t "C463:"`

**C464** - `ImportJobStore.recordRead` updates `import_jobs` with `{ status: "parsed",
table_count, row_count, read_error: null, read_at, updated_at }` (or `{ status: "unreadable",
read_error: <reason>, table_count: null, row_count: null, read_at, updated_at }`), `read_at` and
`updated_at` from the clock, filtered `.eq("id", jobId).eq("status", "uploaded")` with
`.select(...)`, and returns `{ ok: true, outcome }` (door 4)
Proof: `npx vitest run infrastructure/supabase -t "C464:"`

**C465** - `ImportJobStore.fileOf` on an `uploaded` job calls
`storage.from("imports").download("<orgId>/<jobId>")` once and returns `{ ok: true, status:
"uploaded", contentType, outcome: null, bytes }` with the downloaded bytes; on a `parsed` job it
returns the stored outcome and `bytes: null` and never calls `download` (door 4, AC 19)
Proof: `npx vitest run infrastructure/supabase -t "C465:"`

**C466** - in SQL, as estimator `uE` of org A, on an org A job: `uploaded` -> `parsed` with
`table_count` 1, `row_count` 48, `read_at` now updates 1 row; `uploaded` -> `unreadable` with
`read_error` `no_table`, `read_at` now updates 1 row (door 1)
Proof: `npm run test:db import_parse`

### S2 - A file that cannot be read says why · ~6 files · ~14k

**C467** - the parser returns `{ ok: false, reason: "password_protected" }` for `.xlsx` bytes and
for `.docx` bytes that start `D0 CF 11 E0 A1 B1 1A E1` (AC 13)
Proof: `npx vitest run infrastructure/import-parsers -t "C467:"`

**C468** - the parser returns `reason: "corrupt"`, table-driven over 5: `.xlsx` bytes
`50 4B 03 04` followed by junk; `.docx` bytes `50 4B 03 04` followed by junk; `.xlsx` bytes that
are plain text; `.pdf` bytes whose `%PDF-` starts at offset 1,024; `.csv` bytes containing `00`
(AC 14)
Proof: `npx vitest run infrastructure/import-parsers -t "C468:"`

**C469** - the parser returns `reason: "no_table"`, table-driven over 3: an `.xlsx` whose only
sheet holds numbers only; a `.csv` with one column; a `.csv` with a header row and no data row
(AC 15)
Proof: `npx vitest run infrastructure/import-parsers -t "C469:"`

**C470** - the parser returns `reason: "no_text"` for fixture `blank.docx` (paragraphs of spaces
only, no table) (AC 16)
Proof: `npx vitest run infrastructure/import-parsers -t "C470:"`

**C471** - the row cap, table-driven over 4: a `.csv` with 2,000 data rows -> parsed, 2,000 rows;
2,001 -> `too_many_rows`; an `.xlsx` with sheets of 1,000 and 1,001 data rows -> `too_many_rows`;
an `.xlsx` sheet of 100,000 data rows -> `too_many_rows` (AC 17)
Proof: `npx vitest run infrastructure/import-parsers -t "C471:"`

**C472** - the job list renders an `unreadable` job with an attention `StatusPill` "Can't read"
and its message, table-driven over all 5 reasons with the exact texts of AC 18 (AC 18)
Proof: `npx vitest run components/imports -t "C472:"`

### S3 - The read is safe to repeat and to interrupt · ~6 files · ~14k

**C473** - the use case, when `fileOf` returns `status: "parsed"` (and again `"unreadable"`) with
a stored outcome, returns that outcome and calls neither the parser nor `recordRead` (AC 19)
Proof: `npx vitest run application/use-cases -t "C473:"`

**C474** - `recordRead` when the compare-and-set updates 0 rows re-reads the job and returns
`{ ok: true, outcome }` with the stored outcome (not the one it tried to write); when the re-read
job is still `uploading` it returns `{ ok: false, code: "not_ready" }` (AC 20)
Proof: `npx vitest run infrastructure/supabase -t "C474:"`

**C475** - in SQL, as `uE`: a second `update ... set status = 'unreadable' ... where id = <job>
and status = 'uploaded'` on a job already `parsed` updates 0 rows and leaves `row_count` 48
(AC 20)
Proof: `npm run test:db import_parse`

**C476** - the use case, when `fileOf` returns `status: "uploading"`, returns `{ ok: false, code:
"not_ready" }` and calls neither the parser nor `recordRead` (AC 21)
Proof: `npx vitest run application/use-cases -t "C476:"`

**C477** - unexpected failures, table-driven over 3: `download` returns an error; the parser
throws; the `import_jobs` update returns an error with code `XX000`. Each returns `unavailable`,
writes no outcome (no `recordRead` call, or no successful update), and calls `console.error`
once; `readImportAction` maps `unavailable` to the message "We couldn't read the file. Try
again." (AC 22)
Proof: `npx vitest run application/use-cases infrastructure/supabase -t "C477:"`
Proof: `npx vitest run components/imports -t "C477:"`

**C478** - the writer view of the job list renders an `uploaded` job with the pill "Uploaded" and
a button "Read file"; the read-file control rendered with `pending: true` shows a `disabled`
button "Reading…" (AC 23)
Proof: `npx vitest run components/imports -t "C478:"`

**C479** - `confirmUploaded` on a job whose status is `parsed` (and again `unreadable`) returns
`{ ok: true }` without calling `storage.info` or updating `import_jobs` (AC 24)
Proof: `npx vitest run infrastructure/supabase -t "C479:"`

### S4 - Only writers read, and only their org's files · ~6 files · ~12k

**C480** - as a viewer, `readImportAction(<uuid>)` returns `{ status: "forbidden" }` and the
container's `readImport` is not called (AC 25)
Proof: `npx vitest run "app/(app)" -t "C480:"`

**C481** - `readImportAction("not-a-uuid")` returns `{ status: "not_found" }` without calling
`readImport`; `fileOf` for an id the select returns no row for (missing, or another org's under
RLS) returns `{ ok: false, code: "not_found" }` and never calls `download` (AC 26)
Proof: `npx vitest run "app/(app)" -t "C481:"`
Proof: `npx vitest run infrastructure/supabase -t "C481:"`

**C482** - in SQL: as viewer `uV`, updating an org A `uploaded` job to `parsed` updates 0 rows;
as owner `uB` of org B, the same update updates 0 rows and selecting the org A job returns 0 rows
(AC 25, 26)
Proof: `npm run test:db import_parse`

**C483** - `getContainer()` builds the read-import use case on the same request-scoped Supabase
client as `ImportJobStore`, and no file under `web/` outside `scripts/` and `node_modules`
contains `SERVICE_ROLE` (AC 27)
Proof: `npx vitest run composition -t "C483:"`
Proof: `grep -rl "SERVICE_ROLE" --include=*.ts --include=*.tsx --include=*.mts --exclude-dir=node_modules --exclude-dir=scripts . | wc -l` prints `0`

**C484** - the viewer view of the job list renders `parsed` and `unreadable` jobs with their pill
and line, and no "Read file" button (AC 28)
Proof: `npx vitest run components/imports -t "C484:"`

**C485** - the job list renders a `parsed` job with a neutral pill "Read" and a count line,
table-driven over 5: (48 rows, 1 table) -> "48 rows in 1 table"; (1, 1) -> "1 row in 1 table";
(15, 2) -> "15 rows in 2 tables"; (0, 0) -> "Text only, no table"; (null, null) -> "PDF, read at
extraction" (AC 29)
Proof: `npx vitest run components/imports -t "C485:"`

**C486** - `ImportJobReader.forSite` selects `read_error`, `table_count` and `row_count` and maps
each job's status and those columns into its view: `parsed` with counts, `unreadable` with its
reason, `uploaded` with none (AC 18, 29)
Proof: `npx vitest run infrastructure/supabase -t "C486:"`

**C487** - importing `xlsx` and `mammoth` from `application/x.ts`, `components/x.tsx`,
`app/x.tsx`, `domain/x.ts` and `infrastructure/supabase/x.ts` is a `no-restricted-imports` lint
error naming the module (10 cases); importing both from `infrastructure/import-parsers/x.ts` is
not (AC 30)
Proof: `npx vitest run boundaries -t "C487:"`

### Doors and delivery · ~10 files · ~16k

**C488** - in SQL, the `import_jobs` read rules (door 1), each labelled: status `parsing` refused
`23514`; `unreadable` with `read_error` null refused; `parsed` with `read_error` `corrupt`
refused; `parsed` with `read_at` null refused; `uploaded` with `read_at` set refused; `uploading`
with `table_count` 1 refused; `read_error` `other` refused; `row_count` -1 refused; `unreadable`
with `row_count` 3 refused
Proof: `npm run test:db import_parse`

**C489** - `web/package.json` dependencies contain exactly
`"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` and `"mammoth": "1.13.0"`, and
`npm ls xlsx mammoth` reports `xlsx@0.20.3` and `mammoth@1.13.0` (door 2)
Proof: `grep -c -E '"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"|"mammoth": "1.13.0"' package.json` prints `2`
Proof: `npm ls xlsx mammoth`

**C490** - `application/ports/index.ts` declares `ImportParser` with
`parse(contentType: ImportContentType, bytes: Uint8Array)`, `ParsedImport` with the members
`format: "table"` and `format: "pdf"`, `ParsedTable` with `source`, `header` and `rows`, and
`ImportJobStore` with `fileOf(jobId: string)` and `recordRead(jobId: string, outcome: ReadOutcome)`
(doors 3 and 4)
Proof: `npx vitest run composition -t "C490:"`

**C491** - `getContainer()` returns a `readImport` function (startup config)
Proof: `npx vitest run composition -t "C491:"`

**C492** - a migration file `supabase/migrations/<version>_import_parse.sql` exists (AD-006), and
`database.types.ts` contains `read_error`, `table_count`, `row_count` and `read_at`
Proof: `ls ../supabase/migrations | grep -c -E "^[0-9]{14}_import_parse\.sql$"` prints `1`
Proof: `grep -c -E "read_error|table_count|row_count|read_at" infrastructure/supabase/database.types.ts` prints at least `4`

**C493** - `npm run test:db` with no argument exits 0, and `import_parse` is among the recipes it
runs (12 recipes)
Proof: `npm run test:db`

**C494** - the whole Vitest suite passes, including earlier features' tests, and lint passes
Proof: `npm test`
Proof: `npm run lint`

**C495** - `npx next build` exits 0
Proof: `npx next build`

**C496** - Supabase security advisors report exactly the two accepted findings
(`rls_enabled_no_policy` on `public.outbox`, `auth_leaked_password_protection`)
Proof: mcp - `get_advisors` type `security`

**C497** - `.specs/STATE.md` has three new `active` AD rows (the read outcome on `import_jobs`,
the parser port and `ParsedImport`, the store's `fileOf`/`recordRead`), `CONTEXT.md` names
`import-parse`, and ROADMAP Phase 2 item 2 is ticked
Proof: `grep -c -E "^\| AD-03[5-7] \|.*\| active \|" ../.specs/STATE.md` prints `3`
Proof: `grep -c "import-parse" ../CONTEXT.md` prints at least `1`
Proof: `grep -c -E "^- \[x\] xlsx/csv, docx and pdf parsers" ../ROADMAP.md` prints `1`

**C498** - `readImportAction` passes the use case's answer through, table-driven over 3: parsed
-> `{ status: "parsed", tables, rows }` and calls `refresh()` once; unreadable -> `{ status:
"unreadable", reason }` and calls `refresh()` once; `not_ready` -> `{ status: "not_ready" }`
(Surface)
Proof: `npx vitest run "app/(app)" -t "C498:"`

**C499** - live as the demo owner, at 1440x900, 768x1024 and 375x812, on one demo site:
fictitious `units.xlsx` (title row, 5 data rows), `units.csv` (`;`-delimited, 3 data rows),
`units.docx` (one table, 4 data rows) and `units.pdf` each end "Read" with "5 rows in 1 table",
"3 rows in 1 table", "4 rows in 1 table" and "PDF, read at extraction"; a `.pdf` that is renamed
text ends "Can't read" with the `corrupt` message; the button shows "Reading…" while a read runs;
no horizontal scroll; touch targets at least 44 px at 375 and 768; no console error or warning;
no 4xx/5xx or network-error request other than Server Action POSTs answered 200; afterwards SQL
counts 0 `import_jobs` for the demo org and 0 objects in `imports`
Proof: live - Playwright MCP `browser_navigate`, `browser_resize`, `browser_file_upload`, `browser_click`, `browser_snapshot`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_requests`
Proof: mcp - `execute_sql` counting the demo org's `import_jobs` and `storage.objects` in `imports`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `readImportAction` outcomes (6) | `parsed` C498 · C499 · `unreadable` C498 · C499 · `not_ready` C476 · C498 · `forbidden` C480 · `not_found` C481 · `unavailable` C477 | - |
| job statuses (4) | `uploading` C476 · C474 · `uploaded` C465 · C478 · `parsed` C464 · C466 · C485 · `unreadable` C464 · C466 · C472 | - |
| transitions written (2) | `uploaded` -> `parsed` C464 · C466 · `uploaded` -> `unreadable` C464 · C466 | - |
| transitions refused (3) | from `parsed` C475 · C473 · from `unreadable` C473 · from `uploading` C476 · C474 | - |
| read reasons (5) | `corrupt` C468 · `password_protected` C467 · `no_table` C469 · `no_text` C470 · `too_many_rows` C471; messages C472, table-driven over all 5 | - |
| formats read (5) | `xlsx` C453 · C454 · `csv` C456 · C457 · `docx` C458 · C459 · `pdf` C460 · C499 (all four live) | - |
| `csv` delimiters (3) | `,` C456 · `;` C456 · C499 · tab C456 | - |
| `csv` encodings (3) | Windows-1252 C457 · UTF-8 C457 · UTF-8 with BOM C457 | - |
| header rule clauses (6) | 2+ non-empty cells C455 · all text, no number C455 · no date C455 · data row below C455 · within 20 rows C455 · visible sheet C455 | - |
| row cap (4 edges) | 2,000 C471 · 2,001 C471 · split across sheets C471 · 100,000 C471 | - |
| `corrupt` triggers (5) | C468, table-driven over all 5 | - |
| count line (5) | C485, table-driven over all 5 | - |
| outcome mapping (4) | C463, table-driven over all 4 | - |
| row `ref` forms (2) | sheet C462 · Word table C462 | - |
| unexpected failures (3) | C477, table-driven over all 3 | - |
| roles (2 kinds) | writer C451 · C466 · C478 · viewer C480 · C482 · C484 | - |
| restricted parser imports (5 places) | C487, table-driven over all 5 | - |
| Landing doors (4) | door 1 C466 · C475 · C482 · C488 · C492 · C497 · door 2 C489 · C487 · door 3 C453 · C460 · C463 · C490 · C497 · door 4 C464 · C465 · C474 · C490 · C497 | - |
| entities written (1) | `import_jobs` C464 · C466 · C475 · C482 · C488 | - |
| startup config: container assembly (1) | `getContainer()` C483 · C491 | - |

- Claims naming a route's response shape (C480, C481, C498) are proven by calling the Server
  Action itself; C499 crosses the real browser and Storage.
- Claims about RLS and the status checks (C466, C475, C482, C488) are proven in SQL as the role in
  question. The stub proofs (C464, C465, C474, C479, C481, C486) prove only the adapter's calls and
  mapping.
- C477 crosses two levels on purpose: the use case and adapter prove nothing is written and the
  error is logged; the component proof proves the message.

## Swept

- validation: C455 (header rule), C457 (encoding), C467-C471 (every reason), C471 (row cap), C481 (non-uuid id), C488 (stored outcome rules)
- failure modes: C477 (download, parser and update failures leave the job `uploaded`), C478 ("Read file" retries it)
- idempotency: C473 (a repeat on a read job returns the stored outcome, no download), C479 (confirm after a read changes nothing)
- authorization: C480, C484 (app refuses viewers), C482 (RLS refuses viewers and other orgs), C483 (member client only, no service role)
- concurrency: C474, C475 (compare-and-set on `uploaded`; the loser returns the stored outcome)
- data lifecycle: n/a - the read writes four columns on an existing row and stores no parsed content; discard (proven by the import-upload feature) still removes the row and file
- dependency failure: C477 (Storage download or database fails -> `unavailable`, nothing written)
- state transitions: C464, C466 (the two written), C473, C475, C476 (the refused ones), C488 (any other combination refused by the checks)
- observability: C477 (`console.error` on each unexpected failure); the stored `read_error` and `read_at` record each outcome; no metric or tracing requirement

## Handoff

- Read set measured with `wc -c` before building (ports, use cases, imports adapter and its test,
  stub client, composition and its test, `import-actions.ts` and `imports.test.ts`, the five
  import components and their test, `boundaries.test.ts`, `eslint.config.mjs`, the test-db runner
  and its test, `import_upload.sql`, `fixture.sql`, the import page, `CONTEXT.md`, `STATE.md`,
  `ROADMAP.md`): 173,946 bytes, about 43k tokens.
- Written:
  - Parser adapter and its tests, docx fixtures and their build script: ~30 KB.
  - Migration and `import_parse.sql`: ~8 KB.
  - Ports, use case and its test: ~8 KB.
  - Adapter, reader and stub changes with tests: ~12 KB.
  - Action, upload sequence, job list, read-file control and their tests: ~16 KB.
  - ESLint rule and boundaries test: ~2 KB. Docs: ~5 KB.
  - Total ~81 KB, about 20k tokens.
- Live validation (C499: three sizes, one journey) at about 30k tokens of snapshots.
- S1-S4 plus doors: about 93k tokens in total, under the 150k budget, so one builder.
- Production-data note: the migration (two statuses, four columns and checks on an empty
  `import_jobs`) goes to the live project through MCP `apply_migration`, as every earlier
  migration did; that needs the user's go-ahead. The live journey discards its uploads through
  the UI.
- Earlier exact pins that change because this feature adds a recipe: the runner tests C203 and
  C204 (11 recipes) and the SQL-file counts become 12 and 14. Each still asserts an exact value.

- Mechanism: one builder (estimate under budget, no ask).
