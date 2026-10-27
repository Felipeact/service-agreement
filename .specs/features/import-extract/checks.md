# Asset import, step 3: extract equipment rows with Claude and match each to an equipment type - checks

Profile: standard
Plan: `.specs/features/import-extract/plan.md`

63 checks in 5 slices plus doors and delivery · 7 one-way doors · 2 open, of which 0 block (question 1 blocks go-live only)

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C501:`).
  This feature numbers from C501, because earlier features own `C1:`-`C348:`, `C401:`-`C444:` and
  `C451:`-`C499:`. Proofs name the folder their test file sits in, as import-parse did; the file
  inside it is the builder's call.
  - Pure domain code (the normalizer, the chunker, the synonym table) is tested in
    `domain/imports` with literal inputs.
  - The use case is tested in `application/use-cases` with fakes of `ImportJobStore`,
    `ImportParser`, `AssetExtractor` and `AssetTypeCatalog` that record their calls. The parser
    fake returns tables built in the test, so a 340-row table is a loop, not a fixture.
  - The Claude adapter is tested in `infrastructure/claude` against a **fake Anthropic client**
    passed to the adapter. It answers `messages.create`, `messages.stream(...).finalMessage()`,
    `beta.messages.create` and `beta.messages.stream(...).finalMessage()` with the same scripted
    message and records the request, so which entry point the adapter uses is the builder's call.
    Nothing in the suite touches the network or needs `ANTHROPIC_API_KEY`.
  - The Supabase adapter is tested in `infrastructure/supabase` with the recording `stubClient`
    (it already has `rpc` and `storage`).
  - Components are asserted with `renderToStaticMarkup`; a client control's pending state is proven
    through the presentational component with the state passed as props, as import-upload did.
    Actions are called directly with `@/composition` and `next/cache` mocked, as
    `app/(app)/imports.test.ts` does.
- **test:db** - `npm run test:db import_extract` in `web/` (AD-026) runs `fixture.sql` and then the
  new `supabase/tests/import_extract.sql`, rolled back. The file joins `RECIPES` as
  `plain("import_extract")` and passes only when its last row is `import_extract: pass`. Each
  assertion is labelled with its check id. Fixture as import-parse: org A owner `uA`, estimator
  `uE`, viewer `uV`; org B owner `uB`; `siteA`, `siteB`; asset types of org A and org B are
  inserted by the test file as the table owner.
- **shell** - a command run from `web/` (or the repo root where the path says `../`) that passes
  when it exits 0, or prints the stated count.
- **mcp** - a Supabase MCP call on project `gnxebrtcpbujhvcamtoe`, result recorded in the Handoff.
- **live** - a real browser on `npm run dev` through the Playwright MCP, in one signed-in context
  as the demo owner, on one demo site. Not committed (AGENTS..md). Fictitious files are made in the
  scratchpad and discarded through the UI afterwards.

"Writer" means role owner, admin or estimator. "Writer view" is the view rendered with role
`estimator`, "viewer view" with role `viewer`. "Chunk", "normalized" and the other defined terms
are as in the plan's Criteria preamble. "The use case" is the extract-import use case in
`application/use-cases`; "the chunker" and "the normalizer" are the pure functions in
`domain/imports` that cut a `ParsedImport` into chunks and match `asset_type_raw` to an asset type;
"the extractor" is the `AssetExtractor` adapter in `infrastructure/claude`; "the RPC" is
`public.record_extraction_chunk`. A cursor is the number of chunks recorded; the first call passes
`expectedCursor` `null` and a recorded chunk moves the cursor to `expectedCursor + 1` (1 for the
first).

## Checks

### S1 - A read list becomes candidate rows · ~15 files · ~40k

**C501** - `runExtraction(jobId, { extract, onProgress })` calls `extract(jobId)` once per answer
and stops at the first answer that is not `extracting`, returning it, table-driven over 4 scripts:
`[extracting 1/4, extracting 2/4, extracting 3/4, extracted]` -> 4 calls, returns `extracted`;
`[extracted]` -> 1 call; `[extracting 1/4, unavailable]` -> 2 calls, returns `unavailable`;
`[extracting 1/4, too_large]` -> 2 calls, returns `too_large`; `onProgress` is called with
`{ done, total }` for each `extracting` answer and for none else (AC 1)
Proof: `npx vitest run components/imports -t "C501:"`

**C502** - the extractor, given a rows chunk with `table` `"Units"`, `header` `["Unit","Type"]`
and rows `{ ref: "Units!4", cells: ["RTU-1","Carrier 48"] }` and `{ ref: "Units!5", cells:
["MAU-2","Greenheck"] }`, sends one request whose user message contains `Unit`, `Type`,
`Units!4`, `RTU-1`, `Carrier 48`, `Units!5`, `MAU-2` and `Greenheck`; given a text chunk it sends
the chunk's text; given a pdf chunk it sends one `document` content block with `media_type`
`application/pdf` whose base64 `data` decodes to the chunk's bytes (AC 2, 5, 6)
Proof: `npx vitest run infrastructure/claude -t "C502:"`

**C503** - the chunker cuts a table-format `ParsedImport` into chunks of at most 100 data rows that
never span two tables, table-driven over 5: one table of 340 rows -> 4 chunks of 100, 100, 100, 40;
one table of 100 -> 1 chunk of 100; one table of 101 -> chunks of 100 and 1; tables of 150 and 30 ->
chunks of 100, 50, 30; a table of 1 -> 1 chunk of 1; chunk `n` (0-based) of the 340-row table starts
at the row numbered `100 * n + 1` and rows keep their `ref` (AC 3)
Proof: `npx vitest run domain/imports -t "C503:"`

**C504** - the use case, given a `parsed` job (`sourceOf` returns `progress: null` and bytes) whose
parser fake returns one table of 340 rows and an extractor fake that returns one row per input row,
calls the extractor once with a rows chunk of the first 100 rows, then calls
`recordExtraction(jobId, null, 4, rows)` with 100 rows, and returns `{ ok: true, state:
"extracting", done: 1, total: 4 }` (AC 3)
Proof: `npx vitest run application/use-cases -t "C504:"`

**C505** - in SQL, as estimator `uE`, the RPC on an org A `parsed` job with `p_expected_cursor`
null, `p_total` 4 and 2 rows returns 1 and leaves the job `status` `extracting`, `extract_cursor`
1, `extract_total` 4, `extracted_at` null, and 2 `import_rows` (AC 3)
Proof: `npm run test:db import_extract`

**C506** - the use case, given a 3-row chunk and an extractor fake that returns 2 rows, passes
exactly 2 rows to `recordExtraction`; given an extractor fake that returns 0 rows for a chunk, it
calls `recordExtraction` with `[]` and the cursor still advances (AC 4)
Proof: `npx vitest run application/use-cases -t "C506:"`

**C507** - in SQL, as `uE`, two successive RPC calls with 2 rows each (the second with
`p_expected_cursor` 1) leave `import_rows` positions 1, 2, 3, 4 for the job; a third call with 0
rows leaves them unchanged and moves the cursor to 3 (AC 4)
Proof: `npm run test:db import_extract`

**C508** - for a table-format `ParsedImport` with `tables: []` and `text` `"Unit 1: RTU on roof"`,
the chunker returns exactly 1 chunk `{ kind: "text", text: "Unit 1: RTU on roof" }`, and the use
case calls `recordExtraction(jobId, null, 1, rows)` after sending that chunk (AC 5)
Proof: `npx vitest run domain/imports -t "C508:"`
Proof: `npx vitest run application/use-cases -t "C508:"`

**C509** - for `{ format: "pdf", bytes }` the chunker returns exactly 1 chunk `{ kind: "pdf",
bytes }` with the same bytes, and the use case calls `recordExtraction(jobId, null, 1, rows)` after
sending it; the text of a Word file that also has tables is not sent: for `{ format: "table",
tables: [one table of 3 rows], text: "notes" }` no chunk contains `"notes"` (AC 6, Assumptions)
Proof: `npx vitest run domain/imports -t "C509:"`
Proof: `npx vitest run application/use-cases -t "C509:"`

**C510** - the extractor's request asks for a structured output: `output_config.format.type` is
`"json_schema"` and its schema is an object with required property `rows`, an array of objects
whose properties are exactly `asset_type_raw`, `unit_no`, `type_model`, `location`, `confidence`
and `source_ref`, all required, `additionalProperties` false, text properties typed `string` or
`null`, and `confidence` an enum of exactly `low`, `medium`, `high` (AC 7)
Proof: `npx vitest run infrastructure/claude -t "C510:"`

**C511** - the extractor maps a valid answer to `ExtractedRow` values in order, table-driven over 3
answers: three rows covering `confidence` `low`, `medium` and `high` with every text field set ->
the same values as `assetTypeRaw`, `unitNo`, `typeModel`, `location`, `confidence`, `sourceRef`; a
row with all five text fields `null` -> `null`s; `{"rows": []}` -> `{ ok: true, rows: [] }` (AC 7)
Proof: `npx vitest run infrastructure/claude -t "C511:"`

**C512** - the use case's `source_ref` rule, table-driven over 5 rows returned for a rows chunk
whose refs are `Units!4` and `Units!5`: `sourceRef` `"Units!4"`, confidence `high` -> stored
`"Units!4"`, `high`; `"Units!5"`, `medium` -> `"Units!5"`, `medium`; `"Units!99"`, `high` ->
`null`, `low`; `"page 2"`, `high` -> `null`, `low`; `null`, `high` -> `null`, `low`; and for a
pdf chunk and a text chunk a returned `"page 2"` with `medium` is stored as `"page 2"`, `medium`
(AC 8)
Proof: `npx vitest run application/use-cases -t "C512:"`

**C513** - when the recorded chunk is the last, the job ends `extracted`; in SQL, as `uE`: an RPC
call with `p_expected_cursor` null, `p_total` 1 and 0 rows on a `parsed` job returns 1 and leaves
`status` `extracted`, `extract_cursor` 1, `extract_total` 1, `extracted_at` not null and 0 rows; a
2-chunk job's second call (`p_expected_cursor` 1, `p_total` 2) leaves `extracted` with
`extract_cursor` 2; the use case, when `recordExtraction` answers `done: true` with `result` `{
rows: 0, unmatched: 0 }` from `sourceOf`, returns `{ ok: true, state: "extracted", rows: 0,
unmatched: 0 }` (AC 9)
Proof: `npm run test:db import_extract`
Proof: `npx vitest run application/use-cases -t "C513:"`

**C514** - the use case cleans each text field it stores (`assetTypeRaw`, `unitNo`, `typeModel`,
`location`, `sourceRef`), table-driven over 5 values each: `"  RTU-1 "` -> `"RTU-1"`; `""` ->
`null`; `"   "` -> `null`; `null` -> `null`; `"a  b"` -> `"a  b"` (inner spaces kept) (AC 10)
Proof: `npx vitest run application/use-cases -t "C514:"`

### S2 - Each row is matched to an equipment type · ~6 files · ~14k

**C515** - the normalizer with an org of types `{ RTU "Rooftop Unit" }`, `{ HWT_HIGH_EFFICIENCY
"High Efficiency Water Heater" }`, `{ MUA "Make-Up Air Unit" }` matches by code or name,
table-driven over 6: `"RTU"` -> RTU; `"  rtu "` -> RTU; `"Rooftop-Unit"` -> RTU (name);
`"HWT-High-Efficiency"` -> HWT_HIGH_EFFICIENCY (code); `"make up air unit"` -> MUA (name);
`"Rooftop Unit #2"` -> no match (`null`) (AC 11)
Proof: `npx vitest run domain/imports -t "C515:"`

**C516** - synonyms apply only after code and name fail, table-driven over 4 with an org of types
RTU named "Packaged Equipment" and MUA named "Fresh Air": `"Rooftop unit"` -> RTU; `"MAU"` -> MUA;
`"mau"` -> MUA; and with an extra type `{ MAU2 "MAU" }` present, `"MAU"` -> MAU2 (the name match
wins over the synonym) (AC 12)
Proof: `npx vitest run domain/imports -t "C516:"`

**C517** - the normalizer returns no type (`null`), table-driven over 6: `null`; `""`; `"   "`;
`"Widget"` (no code, name or synonym); two org types with equal normalized names (`EF1` "Exhaust
Fan" and `EF2` "exhaust-fan") and the raw `"Exhaust fan"`; a raw equal to one type's code and
another type's name (`PUMP` and `CP` named "Pump") -> `"pump"` (AC 13)
Proof: `npx vitest run domain/imports -t "C517:"`

**C518** - the normalizer matches only the types it is given: with an org of `{ RTU }` alone,
`"MAU"` -> `null` and `"Rooftop unit"` -> RTU; with an org of `{ MUA }` alone, `"Rooftop unit"` ->
`null`; the use case obtains the types from `AssetTypeCatalog.list()` once per call and uses no
other source (AC 14)
Proof: `npx vitest run domain/imports -t "C518:"`
Proof: `npx vitest run application/use-cases -t "C518:"`

**C519** - the use case stores `assetTypeRaw` as returned, trimmed, whatever type was matched: a row
returned with `"Rooftop unit "` and the org having RTU is passed to `recordExtraction` with
`assetTypeRaw` `"Rooftop unit"` and `assetTypeId` the RTU id (AC 15)
Proof: `npx vitest run application/use-cases -t "C519:"`

**C520** - every code in the synonym table exists as a catalog code: each key of the synonym table
appears as a code in `supabase/migrations/20261019191509_catalog_template.sql`, and the table
contains the roadmap's two examples (`RTU` with `rooftop unit`, `MUA` with `mau`) (Assumptions)
Proof: `npx vitest run domain/imports -t "C520:"`

**C521** - `ImportJobStore.sourceOf` on an `extracted` job returns `result` `{ rows, unmatched }`
read from `import_row_counts` filtered on the job (door 7) and `bytes: null`; on any other status
`result` is `null` (door 7, AC 33)
Proof: `npx vitest run infrastructure/supabase -t "C521:"`

### S3 - Extraction survives interruption, repeats and failures · ~12 files · ~30k

**C522** - the writer view of the job list renders an `extracting` job with extraction `{ cursor: 2,
total: 4 }` with the pill "Extracting", the text `2 of 4` and a button "Continue extraction"; the
viewer view renders the pill and `2 of 4` and no button (AC 16)
Proof: `npx vitest run components/imports -t "C522:"`

**C523** - the use case, given an `extracting` job with `progress` `{ cursor: 2, total: 4 }` and a
340-row table, calls the extractor exactly once, with the rows whose refs are `Units!202` to
`Units!301` (the fixture's data rows start at sheet row 2), then `recordExtraction(jobId, 2, 4,
rows)`; no chunk from rows `Units!2` to `Units!201` is sent, and it returns `extracting` with
`done: 3` (AC 17)
Proof: `npx vitest run application/use-cases -t "C523:"`

**C524** - `ImportJobStore.recordExtraction` maps the RPC's answers, table-driven over 6: the RPC
returns `3` for `(jobId, 2, 4)` -> `{ ok: true, progress: { cursor: 3, total: 4 }, done: false }`;
returns `4` for `(jobId, 3, 4)` -> `done: true`; error `40001` with the re-read job `extracting` 3/4
-> `{ ok: true, progress: { cursor: 3, total: 4 }, done: false }` and the stored rows are not
re-sent; `40001` with the re-read job `extracted` 4/4 -> `done: true`; `P0002` -> `{ ok: false,
code: "not_found" }`; `42501` -> `forbidden`; any other error -> `unavailable` with `console.error`
called once. The RPC is called with `p_job_id`, `p_expected_cursor`, `p_total` and `p_rows` (AC 18)
Proof: `npx vitest run infrastructure/supabase -t "C524:"`

**C525** - in SQL, as `uE`, two RPC calls with identical arguments (`p_expected_cursor` null,
`p_total` 2, 2 rows): the first returns 1; the second raises SQLSTATE `40001`; the job then has
exactly 2 `import_rows` and `extract_cursor` 1; a third call with `p_expected_cursor` 1 returns 2
(AC 18)
Proof: `npm run test:db import_extract`

**C526** - the use case, when `sourceOf` returns `status: "extracted"` with `result` `{ rows: 338,
unmatched: 14 }`, returns `{ ok: true, state: "extracted", rows: 338, unmatched: 14 }` and calls
neither the parser, the catalog, the extractor nor `recordExtraction`; `sourceOf` returned
`bytes: null` (AC 19)
Proof: `npx vitest run application/use-cases -t "C526:"`

**C527** - `ImportJobStore.sourceOf` calls `storage.from("imports").download("<orgId>/<jobId>")`
exactly once for a `parsed` job and for an `extracting` job (returning those bytes, `progress` null
for `parsed` and the stored `{ cursor, total }` for `extracting`), and never for `uploading`,
`uploaded`, `unreadable` or `extracted`, table-driven over all 6 statuses; `fileOf` on a `parsed`
job still returns `bytes: null` without calling `download` (door 6, AC 19)
Proof: `npx vitest run infrastructure/supabase -t "C527:"`

**C528** - the use case, when `sourceOf` returns `uploading`, `uploaded` or `unreadable`, returns
`{ ok: false, code: "not_ready" }` and calls neither the parser, the catalog, the extractor nor
`recordExtraction`, table-driven over all 3 (AC 20)
Proof: `npx vitest run application/use-cases -t "C528:"`

**C529** - the use case's own failures, table-driven over 5: `sourceOf` returns `{ ok: false, code:
"unavailable" }`; the parser throws; the catalog throws; the extractor returns `{ ok: false, code:
"unavailable" }`; `recordExtraction` returns `{ ok: false, code: "unavailable" }`. Each returns
`{ ok: false, code: "unavailable" }`; in the first four `recordExtraction` is never called; when the
parser throws or the catalog throws, `console.error` is called once with the job id in the message
(AC 21)
Proof: `npx vitest run application/use-cases -t "C529:"`

**C530** - the extractor's failures, table-driven over 10, each returning `{ ok: false, code:
"unavailable" }` and calling `console.error` once: the adapter built with no API key (and the fake
client never called); the client throwing an error with status 429; the client throwing status 500;
an answer with `stop_reason` `refusal`; and six invalid answers on a rows chunk - non-JSON text, JSON
with no `rows`, `rows` not an array, a row missing `confidence`, a row with `confidence` `"certain"`,
a row whose `unit_no` is the number 4 (AC 21)
Proof: `npx vitest run infrastructure/claude -t "C530:"`

**C531** - the extractor and the use case when an answer stops at the output limit, table-driven
over 3 chunks with `stop_reason` `max_tokens`: a text chunk -> `{ ok: false, code: "too_large" }`; a
pdf chunk -> `too_large`; a rows chunk -> `unavailable`; and the use case, when the extractor returns
`too_large`, returns `{ ok: false, code: "too_large" }` without calling `recordExtraction` (AC 22)
Proof: `npx vitest run infrastructure/claude -t "C531:"`
Proof: `npx vitest run application/use-cases -t "C531:"`

**C532** - in SQL, as `uE`, the RPC is atomic, table-driven over 2: a call with 2 rows where the
second has `confidence` `'certain'` raises `23514`; a call with 2 rows where the second names an
asset type of org B raises `23503`; after each (caught in a sub-block) the org A job still has
`status` `parsed`, `extract_cursor` null and 0 `import_rows` (AC 23)
Proof: `npm run test:db import_extract`

**C533** - in SQL, as `uE`, deleting an org A job that has 3 `import_rows` deletes the job and
leaves 0 `import_rows` for it, and leaves the rows of another job untouched (AC 24, Relations)
Proof: `npm run test:db import_extract`

### S4 - Only writers extract, and only their org's data leaves the app · ~8 files · ~16k

**C534** - as a viewer, `extractImportAction(<uuid>)` returns `{ status: "forbidden" }` and the
container's `extractImport` is not called (AC 25)
Proof: `npx vitest run "app/(app)" -t "C534:"`

**C535** - `extractImportAction("not-a-uuid")` returns `{ status: "not_found" }` without calling
`extractImport`; `sourceOf` for an id the select returns no row for (missing, or another org's
under RLS) returns `{ ok: false, code: "not_found" }` and never calls `download` (AC 26)
Proof: `npx vitest run "app/(app)" -t "C535:"`
Proof: `npx vitest run infrastructure/supabase -t "C535:"`

**C536** - in SQL: as viewer `uV`, the RPC on an org A `parsed` job raises `42501` and the job is
unchanged; as owner `uB` of org B, the RPC on that job raises `P0002`; as `uV` a direct `insert`
into `import_rows` raises `42501` (row-level security) while a `select count(*)` on the org's rows
succeeds; as `uB`, `select count(*) from import_rows` of org A's job returns 0 (AC 25, 26, 27)
Proof: `npm run test:db import_extract`

**C537** - `getContainer()` builds the extract-import use case, the store and the catalog on the same
request-scoped Supabase client as `ImportJobStore`, and no file under `web/` outside `scripts/` and
`node_modules` contains `SERVICE_ROLE` (AC 27)
Proof: `npx vitest run composition -t "C537:"`
Proof: `grep -rl "SERVICE_ROLE" --include=*.ts --include=*.tsx --include=*.mts --exclude-dir=node_modules --exclude-dir=scripts . | wc -l` prints `0`

**C538** - the extractor's request carries only the chunk: for two different chunks of each of the 3
kinds, the two recorded requests are equal except in `messages`; every request has exactly one
message, with role `user`; none has a `metadata` key; `system` equals the one exported prompt
constant, and `AssetExtractor.extract` takes one argument (the chunk) (AC 28)
Proof: `npx vitest run infrastructure/claude -t "C538:"`

**C539** - importing `@anthropic-ai/sdk` from `application/x.ts`, `components/x.tsx`, `app/x.tsx`,
`domain/x.ts`, `infrastructure/supabase/x.ts` and `infrastructure/import-parsers/x.ts` is a
`no-restricted-imports` lint error naming the module (6 cases); importing it from
`infrastructure/claude/x.ts` is not (AC 29)
Proof: `npx vitest run boundaries -t "C539:"`

**C540** - no source file names the key as a public variable, and the key is read only in the
adapter and the container: `grep -rn "NEXT_PUBLIC_ANTHROPIC"` over `web/` sources prints nothing,
and every non-test `.ts`/`.tsx`/`.mts` file containing `ANTHROPIC_API_KEY` sits under
`infrastructure/claude/` or `composition/` (AC 30)
Proof: `grep -rl "NEXT_PUBLIC_ANTHROPIC" --include=*.ts --include=*.tsx --include=*.mts --include=*.mjs --exclude-dir=node_modules . | wc -l` prints `0`
Proof: `grep -rl "ANTHROPIC_API_KEY" --include=*.ts --include=*.tsx --include=*.mts --exclude-dir=node_modules --exclude=*.test.ts . | grep -v -E "^\./(infrastructure/claude|composition)/" | wc -l` prints `0`

### S5 - The job list shows where extraction stands · ~8 files · ~16k

**C541** - the writer view of the job list renders a `parsed` job with the pill "Read" and a button
"Extract equipment"; the viewer view renders the same job with the pill and no button (AC 31)
Proof: `npx vitest run components/imports -t "C541:"`

**C542** - the extract control's prompt, rendered with state passed as props: idle -> an enabled
button "Extract equipment"; pending with no progress -> a `disabled` button "Extracting…"; pending
with `{ done: 2, total: 4 }` -> a `disabled` button "Extracting… 2 of 4" (AC 32)
Proof: `npx vitest run components/imports -t "C542:"`

**C543** - the job list renders an `extracted` job with a neutral pill "Extracted" and the count
line, table-driven over 5: (338 rows, 14 unmatched) -> "338 rows, 14 need an equipment type"; (338,
0) -> "338 rows"; (1, 0) -> "1 row"; (5, 1) -> "5 rows, 1 needs an equipment type"; (0, 0) -> "No
equipment found" (AC 33)
Proof: `npx vitest run components/imports -t "C543:"`

**C544** - the extract control's prompt shows the message in an element with `role="alert"` and an
enabled button, table-driven over the 5 non-success answers: `unavailable` -> "We couldn't read this
list. Try again."; `too_large` -> "This document lists more equipment than can be read at once. Split
it and upload each part."; `not_ready` -> "The upload didn't finish. Try again."; `forbidden` -> "You
don't have permission to import equipment lists."; `not_found` -> "This import no longer exists."
(AC 21, 22, 34)
Proof: `npx vitest run components/imports -t "C544:"`

**C545** - `ImportJobReader.forSite` selects `extract_cursor` and `extract_total` from `import_jobs`
and reads `rows` and `unmatched` from `import_row_counts` for the site's jobs, and maps `extracting`
with its `{ cursor, total }`, `extracted` with `{ rows, unmatched }`, and `parsed` and the earlier
statuses with neither (AC 16, 33)
Proof: `npx vitest run infrastructure/supabase -t "C545:"`

**C546** - `extractImportAction` passes the use case's answer through, table-driven over 7: `{ ok:
true, state: "extracting", done: 2, total: 4 }` -> `{ status: "extracting", done: 2, total: 4 }` and
calls `refresh()` once; `extracted` -> `{ status: "extracted", rows, unmatched }` and calls
`refresh()` once; `not_ready` -> `{ status: "not_ready" }`; `too_large` -> `{ status: "too_large"
}`; `not_found` -> `{ status: "not_found" }`; `unavailable` -> `{ status: "unavailable" }`; each of
the last four without `refresh()`; `forbidden` for a viewer is C534 (Surface)
Proof: `npx vitest run "app/(app)" -t "C546:"`

### Doors and delivery · ~14 files · ~26k

**C547** - in SQL, the `import_rows` rules (door 1), each labelled: `position` 0 refused `23514`;
a duplicate `(job_id, position)` refused `23505`; `confidence` `'certain'` refused `23514`;
`confidence` null refused `23502`; an `asset_type_id` of org B on an org A job refused `23503`; a job
id of org B with org A's `org_id` refused `23503`; `asset_type_id` null accepted; `confidence` `low`,
`medium` and `high` each accepted; an estimator `uE` insert accepted, an owner `uA` update accepted,
a viewer `uV` update updates 0 rows
Proof: `npm run test:db import_extract`

**C548** - in SQL, the `import_jobs` extraction rules (door 2), each labelled: `extracted` with
`extracted_at` null refused `23514`; `extracting` with `extract_total` null refused; `extract_cursor`
2 with `extract_total` 1 refused; `extracted` with `extract_cursor` 1 and `extract_total` 2 refused;
`extract_total` 0 refused; `extract_cursor` set with `extract_total` null refused; `parsed` with
`extracted_at` set refused; and the replaced import-parse rules: an `extracting` job keeps
`table_count` 1, `row_count` 48 and `read_at` set (accepted); `uploaded` with `row_count` 3 still
refused; `parsed` with `read_at` null still refused; `unreadable` with `row_count` 3 still refused;
status `'queued'` refused
Proof: `npm run test:db import_extract`

**C549** - in SQL, the RPC (door 4): on `uploaded`, `uploading`, `unreadable` and `extracted` org A
jobs it raises `40001`; with `p_expected_cursor` 2 on a job at cursor 1 it raises `40001`; with an
unknown job id it raises `P0002`; `pg_proc` shows `public.record_extraction_chunk` as `security
invoker` (`prosecdef` false) with `search_path=""` in `proconfig`, and `anon` has no `execute` on it
Proof: `npm run test:db import_extract`

**C550** - in SQL, `public.import_row_counts` (door 7): for a job with 5 rows of which 2 have
`asset_type_id` null, as `uE` it returns one row with `rows` 5 and `unmatched` 2; a job with 0 rows
has no row; as `uB` it returns 0 rows for org A's job (the view is `security_invoker`); `anon` has no
`select` on it
Proof: `npm run test:db import_extract`

**C551** - `application/ports/index.ts` declares `AssetExtractor` with `extract(chunk: ExtractChunk)`,
`ExtractChunk` with the members `kind: "rows"`, `kind: "text"` and `kind: "pdf"`, `ExtractedRow` with
`assetTypeRaw`, `unitNo`, `typeModel`, `location`, `confidence` and `sourceRef`, and `ImportJobStore`
with `sourceOf(jobId: string)` and `recordExtraction(jobId: string, expectedCursor: number | null,
total: number, rows: ImportRowInput[])`; the `ImportJobStatus` type includes `extracting` and
`extracted` (doors 3 and 6)
Proof: `npx vitest run composition -t "C551:"`

**C552** - `web/package.json` dependencies contain `"@anthropic-ai/sdk"` pinned to an exact
`major.minor.patch` (no `^`, no `~`), `npm ls @anthropic-ai/sdk` exits 0, and `web/.env.example`
lists `ANTHROPIC_API_KEY=` with a comment saying it is server-side only (door 5)
Proof: `grep -c -E '"@anthropic-ai/sdk": "[0-9]+\.[0-9]+\.[0-9]+"' package.json` prints `1`
Proof: `npm ls @anthropic-ai/sdk`
Proof: `grep -c "^ANTHROPIC_API_KEY=" .env.example` prints `1`

**C553** - the extractor's request settings (Assumptions), asserted on the recorded request for a
rows chunk: `model` `claude-opus-5-5`; `output_config.effort` `low`; no `temperature`, `top_p` or
`top_k`; no `thinking` of `type` `disabled` or `enabled`; no `tool_choice`; the server-side refusal
fallback `fallbacks` `"default"` with the beta `server-side-fallback-2026-07-01`; `max_tokens` at
least 16000
Proof: `npx vitest run infrastructure/claude -t "C553:"`

**C554** - a migration file `supabase/migrations/<version>_import_extract.sql` exists (AD-006), and
`database.types.ts` contains `import_rows`, `import_row_counts`, `extract_cursor`, `extract_total`,
`extracted_at` and `record_extraction_chunk`
Proof: `ls ../supabase/migrations | grep -c -E "^[0-9]{14}_import_extract\.sql$"` prints `1`
Proof: `grep -c -E "import_rows|import_row_counts|extract_cursor|extract_total|extracted_at|record_extraction_chunk" infrastructure/supabase/database.types.ts` prints at least `6`

**C555** - `getContainer()` returns an `extractImport` function (startup config)
Proof: `npx vitest run composition -t "C555:"`

**C556** - `npm run test:db` with no argument exits 0, and `import_extract` is among the recipes it
runs (13 recipes)
Proof: `npm run test:db`

**C557** - the whole Vitest suite passes, including earlier features' tests, and lint passes
Proof: `npm test`
Proof: `npm run lint`

**C558** - `npx next build` exits 0
Proof: `npx next build`

**C559** - Supabase security advisors report exactly the two accepted findings
(`rls_enabled_no_policy` on `public.outbox`, `auth_leaked_password_protection`)
Proof: mcp - `get_advisors` type `security`

**C560** - `.specs/STATE.md` has seven new `active` AD rows (one per door), `CONTEXT.md` names
`import-extract`, `web/.env.example` is updated (C552), and ROADMAP Phase 2 item 3 is ticked
Proof: `grep -c -E "^\| AD-0(3[8-9]|4[0-4]) \|.*\| active \|" ../.specs/STATE.md` prints `7`
Proof: `grep -c "import-extract" ../CONTEXT.md` prints at least `1`
Proof: `grep -c -E "^- \[x\] Claude structured extraction and type normalization" ../ROADMAP.md` prints `1`

**C561** - live without a key, as the demo owner, at 1440x900, 768x1024 and 375x812, on one demo site
with `ANTHROPIC_API_KEY` unset: fictitious `units.xlsx` (title row, 5 data rows) uploaded and read
shows "Read" with a button "Extract equipment" (writer); pressing it ends with the alert "We couldn't
read this list. Try again." and the button enabled again; the job stays "Read"; no horizontal scroll;
touch targets at least 44 px at 375 and 768; no browser console error or warning; no 4xx/5xx or
network-error request other than Server Action POSTs answered 200; SQL then shows 0 `import_rows`
and `status` `parsed` for the job; afterwards every job is discarded through the UI and SQL counts 0
`import_jobs` for the demo org and 0 objects in `imports`
Proof: live - Playwright MCP `browser_navigate`, `browser_resize`, `browser_file_upload`, `browser_click`, `browser_snapshot`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_requests`
Proof: mcp - `execute_sql` counting the job's `import_rows`, its status, the demo org's `import_jobs` and `storage.objects` in `imports`

**C562** - live with a key (open question 1; runs only when the user supplies `ANTHROPIC_API_KEY`),
as C561: a fictitious `units.xlsx` of 120 rows ends "Extracted" after 2 steps with a count line
whose row count equals the rows Claude kept and whose unmatched count equals the SQL count of rows
with null `asset_type_id`; a fictitious `units.docx` with a table and `units.pdf` each end
"Extracted"; reloading mid-way shows "Continue extraction" and finishing it adds no duplicate row
(SQL: `count(*)` equals `count(distinct position)`); afterwards every job is discarded and SQL
counts 0 `import_rows`, 0 `import_jobs` for the demo org and 0 objects in `imports`
Proof: live - Playwright MCP, as C561
Proof: mcp - `execute_sql` counting `import_rows`, distinct positions and null `asset_type_id` per job

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `extractImportAction` answers (7) | `extracting` C546 · C561 · `extracted` C546 · C562 · `not_ready` C528 · C546 · `too_large` C531 · C546 · `forbidden` C534 · `not_found` C535 · `unavailable` C529 · C546 | - |
| job statuses (6) | `uploading` C528 · C527 · `uploaded` C528 · C527 · `parsed` C504 · C541 · `unreadable` C528 · C527 · `extracting` C523 · C522 · `extracted` C526 · C543 | - |
| chunk kinds (3) | `rows` C503 · C504 · `text` C508 · `pdf` C509 | - |
| chunk sizes (5 cases) | C503, table-driven over all 5 | - |
| `confidence` values (3) | `low` C511 · C547 · `medium` C511 · C547 · `high` C511 · C547 | - |
| `source_ref` rule (6 cases) | C512, table-driven over all 6 | - |
| text cleaning (5 values) | C514, table-driven over all 5 | - |
| text fields cleaned (5) | `asset_type_raw` C514 · `unit_no` C514 · `type_model` C514 · `location` C514 · `source_ref` C514 | - |
| normalizer outcomes (7) | code C515 · name C515 · synonym C516 · name over synonym C516 · none C517 · ambiguous C517 · other org's types C518 | - |
| normalizer no-match inputs (6) | C517, table-driven over all 6 | - |
| synonym table (2 roadmap examples) | `Rooftop unit` -> RTU C516 · `MAU` -> MUA C516 · every code real C520 | - |
| extractor failures (10) | C530, table-driven over all 10 | - |
| use-case failures (5) | C529, table-driven over all 5 | - |
| output-limit cases (3) | text C531 · pdf C531 · rows C531 | - |
| failure and limit messages (5) | `unavailable` C544 · `too_large` C544 · `not_ready` C544 · `forbidden` C544 · `not_found` C544 | - |
| RPC outcomes (4) | ok C505 · C507 · C525 · `40001` C525 · C549 · `P0002` C536 · C549 · `42501` C536 | - |
| adapter RPC mapping (6) | C524, table-driven over all 6 | - |
| transitions written (3) | `parsed` -> `extracting` C505 · `extracting` -> `extracting` C507 · C525 · to `extracted` C513 | - |
| transitions refused (5) | from `uploading` C549 · `uploaded` C549 · `unreadable` C549 · `extracted` C549 · wrong cursor C525 · C549 | - |
| `import_rows` constraints (11) | `position` 0 C547 · duplicate position C547 · `confidence` `certain` C547 · `confidence` null C547 · type of org B C547 · job of org B C547 · null `asset_type_id` accepted C547 · three confidences accepted C547 · estimator insert C547 · owner update C547 · viewer update C547 | - |
| `import_jobs` extraction constraints (12) | `extracted` without time C548 · `extracting` without total C548 · cursor above total C548 · `extracted` cursor not total C548 · total 0 C548 · cursor without total C548 · `parsed` with time C548 · `extracting` keeps counts C548 · `uploaded` with count C548 · `parsed` without read time C548 · `unreadable` with count C548 · status `queued` C548 | - |
| roles (3 kinds) | writer C505 · C522 · C541 · C547 · viewer C534 · C536 · C522 · C541 · other org C536 · C550 | - |
| list-state forms (6) | `extracting` C522 · `338 rows, 14 need` C543 · `338 rows` C543 · `1 row` C543 · `5 rows, 1 needs` C543 · `No equipment found` C543 | - |
| button states (3) | idle C542 · pending C542 · pending with progress C542 | - |
| restricted SDK imports (7 places) | C539, table-driven over all 7 | - |
| request settings (7) | model C553 · effort C553 · sampling C553 · thinking C553 · tool_choice C553 · fallbacks C553 · max_tokens C553 | - |
| Landing doors (7) | door 1 C547 · C533 · C554 · C560 · door 2 C548 · C505 · C513 · C554 · C560 · door 3 C551 · C502 · C510 · C560 · door 4 C549 · C524 · C525 · C532 · C560 · door 5 C552 · C539 · C560 · door 6 C551 · C527 · C524 · C560 · door 7 C550 · C521 · C545 · C560 | - |
| entities and relations (3) | `import_rows` C547 · `import_jobs` -> `import_rows` C533 · `asset_types` -> `import_rows` C547 · C532 | - |
| `Surface` route statuses (1) | every state in the answers row above, proven by calling the Server Action C534 · C535 · C546 | - |
| startup config: container assembly (1 place) | `getContainer()` C537 · C555 | - |
| startup config: secret and key places (2 places) | server env read C540 · `.env.example` C552 | - |

- Claims naming a route's response shape (C534, C535, C546) are proven by calling the Server Action
  itself; C561 and C562 cross the real browser, Storage and (C562) the real Claude API.
- Claims about RLS, the checks and the RPC (C505, C507, C513, C525, C532, C533, C536, C547-C550) are
  proven in SQL as the role in question. The stub proofs (C521, C524, C527, C535, C545) prove only
  the adapter's calls and mapping.
- The fake Anthropic client proves the request the extractor builds and how it reads an answer
  (C502, C510, C511, C530, C531, C538, C553); only C562 proves a real model returns rows the schema
  accepts.
- C513, C518, C531 and C508/C509 cross two levels on purpose: the pure function or the SQL proves the
  rule and the use case proves it is applied.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (the extractor, the `ImportJobStore` methods, the RPC) | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary (the normalizer, the chunker, the use case) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (`extractImportAction`) | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs (the container wiring, the presentational prompt) | none of its own | covered by its consumer's proof |

Evidence:

- the normalizer: 7 outcomes (code, name, synonym, name over synonym, none, ambiguous, other org's) -> decides
- the chunker: 5 size cases and 3 chunk kinds, 8 branch points -> decides
- the use case: 3 refused statuses, 1 stored result, 5 failure paths, 6 `source_ref` cases, 5 cleaning values -> decides
- the extractor: 10 failure paths, 3 output-limit cases, 3 chunk kinds in the request -> decides
- the RPC: 4 SQLSTATE outcomes, 5 refused states, 2 atomicity cases -> decides
- `extractImportAction`: maps 7 answers one-to-one, no conditional beyond the role and uuid guards -> entry point
- closest analogues in the repo: `infrastructure/import-parsers` (7 header-rule clauses, 5 `corrupt` triggers, proven at its own layer in C453-C471), `application/use-cases/read-import.ts` (4 outcome mappings, C463), `supabase/tests/import_parse.sql` (C466-C488)

Cost: about 40 proofs at their own layer across about 14 files. Without these rows, the seven
outcome tables above are proven only by a path that happens to traverse them, and the real Claude
call is the only thing that would ever exercise the extractor's failure table.

## Swept

- validation: C503 (chunk bounds), C510 (the answer schema), C514 (cleaning), C515-C518 (matching), C530 (invalid answers), C535 (non-uuid id), C547, C548 (stored rules)
- failure modes: C529, C530 (every failure leaves the job as it was and says "Try again"), C531 (too large), C532 (a failed chunk leaves no rows and no cursor change), C544
- idempotency: C525 (the same chunk twice stores once), C526 (a repeat on an extracted job calls nothing), C524 (a stale cursor returns the stored progress)
- authorization: C534 (app refuses viewers), C536 (RLS and the RPC refuse viewers and other orgs), C537 (member client only, no service role), C538 (no identity in the request)
- concurrency: C525, C524 (compare-and-set on the expected cursor; the loser returns the stored progress), C507 (positions continue under the cursor lock)
- data lifecycle: C533 (discarding a job deletes its rows), C560 (decisions recorded); n/a for retention - the rows live until the commit item or a discard, and no TTL is required by the plan
- dependency failure: C530 (key missing, 429, 500, refusal, bad answer -> `unavailable`, nothing written), C529 (Storage, parser, catalog and database failures), C562 (the real API)
- state transitions: C505, C507, C513 (the three written), C525, C549 (the refused ones), C548 (any other combination refused by the checks)
- observability: C529, C530 (`console.error` on each unexpected failure); the stored cursor, total and `extracted_at` record progress; no metric or tracing requirement

## Out of scope

- Review grid, editing, merging and mapping unmatched types by hand; writing `assets` - ROADMAP Phase 2 item 4
- Per-org synonyms, re-extracting an extracted job, spend caps - see the plan's Out of scope

## Handoff

- Read set measured with `wc -c` before building (ports, use cases, imports adapter and its test,
  stub client, readers, composition and its test, `import-actions.ts` and `imports.test.ts`, the
  import components and their test, `boundaries.test.ts`, `eslint.config.mjs`, the test-db runner,
  the imports domain and its test, the import page, `import_parse.sql`, `fixture.sql`, the
  import-parse migration, `CONTEXT.md`, `STATE.md`, `ROADMAP.md`, `package.json`, `.env.example`):
  226,901 bytes, about 57k tokens.
- Written:
  - Domain normalizer, chunker, synonym table and tests: ~20 KB.
  - Claude adapter and tests (fake client): ~25 KB.
  - Use case and tests: ~18 KB.
  - Store methods, reader, stub changes and tests: ~14 KB.
  - Migration and `import_extract.sql`: ~14 KB.
  - Action, extract control, job list changes and tests: ~16 KB.
  - ESLint rule, boundaries test, runner entry, docs: ~8 KB.
  - Total ~115 KB, about 29k tokens. Regenerating `database.types.ts` (875 lines) about 9k.
- Live validation (C561, and C562 when a key exists): about 36k tokens of snapshots.
- S1-S5 plus doors: about 131k tokens in total, under the 150k budget, so one builder.
- Production-data note: the migration (two statuses, three columns, the `import_rows` table, the RPC
  and the view, on an empty `import_jobs`) goes to the live project through MCP `apply_migration`
  as every earlier migration did; that needs the user's go-ahead. C562 needs the user's Anthropic
  API key and consent to send a fictitious file to the Anthropic API.
- Earlier exact pins that change because this feature adds a recipe and two statuses: the runner
  tests (13 recipes, 15 SQL files); any test that lists `ImportJobStatus` values or the status check;
  import-parse's `ImportJobView` expectations gain the extraction field as `null`. Each still
  asserts an exact value.

- Mechanism: one builder (estimate under budget, no ask).
- **Boundary (part 1):** every vitest, lint and grep proof is green at `aab2270` (889 tests, `npm run lint` clean, `tsc` clean apart from the typed-route errors that need a `next build` to generate): C501-C504, C506, C508-C512, C514-C524 (adapter and unit parts), C526-C531, C534-C535, C537-C546, C551-C553, C555. Not run, waiting on the user's go-ahead to apply the migration to the live project: the SQL proofs (C505, C507, C513, C525, C532, C533, C536, C547-C550), C554, C556, C559, C560 (docs, after the live run), C561, C562 (also needs an API key).
- **Settled mid-build:**
  - Deriving the checks showed the plan's Flow and Impact had `fileOf` returning bytes for `parsed` jobs, which would make every re-read of a read job download the file (import-parse AC 19). `Flow` hop 3 and the `Impact` AD-037 row were corrected in the plan, and Landing rows 6 (`sourceOf` / `recordExtraction`) and 7 (`import_row_counts`) were added before the code. `fileOf` is unchanged.
  - `database.types.ts` was edited by hand for the new columns, table, view and function; it is compared with `generate_typescript_types` after the migration is applied.
  - The migration file is named `20261027000000_import_extract.sql` provisionally; AD-006 renames it to the version `apply_migration` records.
  - `npm install` of the SDK needed `--allow-remote=all` once, because npm 12 refuses the project's pinned SheetJS CDN tarball by default; the lockfile pins its integrity hash.
  - The domain cannot import the ports, so `Chunk` / `ChunkSource` in `domain/imports` repeat the shape of `ExtractChunk` / `ParsedImport`; the use case's call keeps them in step at compile time.
  - C543's singular wording for one unmatched row ("1 needs an equipment type") is not in a numbered AC; the check pins "needs".
- **Abandoned:** none.
