# Asset import, step 4: review the extracted rows and add them to the site as assets - checks

Profile: standard
Plan: `.specs/features/import-review/plan.md`

58 checks in 5 slices plus doors and delivery · 6 one-way doors · 0 open

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C601:`).
  This feature numbers from C601, because earlier features own up to `C562:`. Proofs name the
  folder their test file sits in; the file inside it is the builder's call.
  - Pure domain code (the flagger, the pager, the spelling list) is tested in `domain/imports`
    with literal rows.
  - The Supabase adapters are tested in `infrastructure/supabase` with the recording `stubClient`,
    which gains whatever chain methods the adapters use (`range`, `is`, `neq`, ...), each recorded.
  - Components are asserted with `renderToStaticMarkup`; a client control's state is passed as
    props to its presentational component, as import-upload and import-extract did.
  - Server Actions and the page are called directly with `@/composition`, `next/cache` and
    `next/navigation` mocked, as `app/(app)/imports.test.ts` does.
- **test:db** - `npm run test:db import_review` in `web/` (AD-026) runs `fixture.sql` and then the
  new `supabase/tests/import_review.sql`, rolled back. The file joins `RECIPES` as
  `plain("import_review")` and passes only when its last row is `import_review: pass`. Each
  assertion is labelled with its check id. Fixture as before: org A owner `uA`, estimator `uE`,
  viewer `uV`; org B owner `uB`; `siteA`, `siteB`. Jobs, rows and asset types are inserted by the
  test file as the table owner, with the job statuses each check needs.
- **shell** - a command run from `web/` that passes when it exits 0 or prints the stated count.
- **mcp** - a Supabase MCP call on project `gnxebrtcpbujhvcamtoe`, result recorded in the Handoff.
- **live** - a real browser on `npm run dev` through the Playwright MCP, in one signed-in context
  as the demo owner (memory: one context only), on one demo site, with the user's
  `ANTHROPIC_API_KEY` in `web/.env.local`. Not committed (AGENTS..md). Fictitious files only.

Terms: "writer view" is a view rendered with role `estimator`, "viewer view" with role `viewer`.
"The flagger" is the pure function in `domain/imports` that gives each row its flags; "the
reader" is `ImportReviewReader`'s adapter; "the row store" is `ImportRowStore`'s adapter; "the
review view" is the presentational component the page renders; "the RPC" is
`public.commit_import`; "the trigger" is `import_rows_frozen`. A row's flags are among: `needs
type`, `too long` (naming `Unit #`, `Type/model` or `Location/access`), `check` (low confidence),
`same as <n>`, `on site`. A **blocking** flag is `needs type` or `too long`.

## Checks

### S1 - A writer sees every extracted row beside what it will become · ~10 files · ~22k

**C601** - the job list renders a link "Review rows" with `href` `/imports/<jobId>` for an
`extracted` job and for a `committed` job, in both the writer view and the viewer view, and no
such link for `parsed`, `extracting`, `unreadable`, `uploaded` or `uploading`, table-driven over
all 7 statuses (AC 1)
Proof: `npx vitest run components/imports -t "C601:"`

**C602** - the review view, given 3 rows passed in positions 3, 1, 2, renders them in order 1, 2,
3, each with: the type as `Rooftop Unit (RTU)` when typed and `Needs a type` when not; "In file"
as the raw text, or `-` when `asset_type_raw` is null; unit #, type/model, location/access,
confidence (`Low`, `Medium`, `High`) and the source reference (AC 2)
Proof: `npx vitest run components/imports -t "C602:"`

**C603** - the review view's counts line and filter: for 5 rows of which 1 is skipped and 2
included rows carry a flag, it renders `5 rows · 4 included · 2 need attention`, a link "All rows"
to `/imports/<id>` and "Needs attention" to `/imports/<id>?show=attention`; with `show` attention
it renders exactly the 2 flagged included rows (AC 3)
Proof: `npx vitest run components/imports -t "C603:"`

**C604** - the pager, table-driven over 9: 120 rows, page 1 -> rows 1-100, `Rows 1-100 of 120`,
Next only; page 2 -> rows 101-120, `Rows 101-120 of 120`, Previous only; 100 rows, page 1 -> no
Previous, no Next; 101 rows, page 2 -> row 101 only; and `?page` values `"0"`, `"3"` (on 120
rows), `"abc"`, `"1.5"`, `"-1"` and absent -> page 1. The view's Previous/Next links keep
`show=attention` when it is set (AC 4)
Proof: `npx vitest run domain/imports -t "C604:"`
Proof: `npx vitest run components/imports -t "C604:"`

**C605** - with `show` attention and no flagged included row, the review view renders `Every row
is ready to add.` and no row (AC 5)
Proof: `npx vitest run components/imports -t "C605:"`

**C606** - with 0 rows, the review view renders `No equipment was found in this file.` and no
commit button, in the writer view (AC 6)
Proof: `npx vitest run components/imports -t "C606:"`

**C607** - the page calls `notFound()` without calling the reader for a malformed id, and calls it
when the reader returns `null`; a signed-out member is redirected to `/login`; the reader returns
`null` for a job id the select finds no row for (missing or another org's under RLS) and for each
status other than `extracted` and `committed`, table-driven over the 5 others, without reading
any row (AC 7)
Proof: `npx vitest run "app/(app)" -t "C607:"`
Proof: `npx vitest run infrastructure/supabase -t "C607:"`

**C608** - the reader reads every row of the job in `position` order through `.range()` pages of
1,000, stopping at the first page shorter than 1,000, table-driven over 4 job sizes: 0 rows -> 1
page read; 999 -> 1; 1,000 -> 2 (the second empty); 2,000 -> 3, returning 2,000 rows; and the
review view with 2,000 rows renders `2,000 rows` (AC 8)
Proof: `npx vitest run infrastructure/supabase -t "C608:"`
Proof: `npx vitest run components/imports -t "C608:"`

### S2 - Each row is flagged for what stops it becoming a good asset · ~3 files · ~8k

**C609** - the flagger flags an included row with `asset_type_id` null `needs type`, and a typed
row with no other issue gets no flag (AC 9)
Proof: `npx vitest run domain/imports -t "C609:"`

**C610** - the flagger's length limits, table-driven over 6: `unit_no` of 40 characters -> no flag;
41 -> `too long` naming `Unit #`; `type_model` of 120 -> none; 121 -> naming `Type/model`;
`location` of 300 -> none; 301 -> naming `Location/access` (AC 10)
Proof: `npx vitest run domain/imports -t "C610:"`

**C611** - the flagger flags `confidence` `low` `check`, and `medium` and `high` not, table-driven
over all 3 (AC 11)
Proof: `npx vitest run domain/imports -t "C611:"`

**C612** - the flagger's duplicates within the job, table-driven over 4: rows 1, 3 and 5 of type
RTU with units `RTU-1`, `rtu 1` and `Rtu_1` -> rows 3 and 5 `same as 1`, row 1 no flag; RTU `1`
and MUA `1` -> neither flagged; rows 1 (skipped), 3 and 5 sharing a key -> row 3 none, row 5
`same as 3`; rows 2 and 7 sharing a key -> row 7 `same as 2` (AC 12)
Proof: `npx vitest run domain/imports -t "C612:"`

**C613** - the flagger, given the site's assets `{ RTU, "rtu-2" }`, flags an included row of type
RTU with unit `RTU 2` `on site`, and a row of type MUA with unit `RTU 2` not (AC 13)
Proof: `npx vitest run domain/imports -t "C613:"`

**C614** - the flagger never flags a row with `unit_no` null as a duplicate: two RTU rows with null
units -> neither `same as`; an RTU row with a null unit and a site asset RTU with a null unit -> not
`on site` (AC 14)
Proof: `npx vitest run domain/imports -t "C614:"`

**C615** - the flagger gives a skipped row no flag even when it has no type, a low confidence and a
41-character unit; the review view renders a skipped row with the label `Skipped` and a dimmed
style (its fields in the secondary ink class) (AC 15)
Proof: `npx vitest run domain/imports -t "C615:"`
Proof: `npx vitest run components/imports -t "C615:"`

### S3 - A writer fixes rows · ~10 files · ~24k

**C616** - the row editor, rendered for a row of an `extracted` job in the writer view, shows a
select of the org's types as `Name (CODE)` with the row's type selected, inputs for unit #,
type/model and location/access holding the row's values, and buttons "Save" and "Cancel" (AC 16)
Proof: `npx vitest run components/imports -t "C616:"`

**C617** - `updateImportRowAction(rowId, formData)` with a type id of the org and fields
`"  RTU-1 "`, `"Carrier"` and `""` calls the row store's `update(rowId, { assetTypeId, unitNo:
"RTU-1", typeModel: "Carrier", location: null })` once, returns `{ status: "saved" }` and calls
`refresh()` once (AC 17)
Proof: `npx vitest run "app/(app)" -t "C617:"`

**C618** - `updateImportRowAction` refuses an invalid edit without calling the store, returning `{
status: "invalid", errors }`, table-driven over 4: a type id not among the org's -> `assetTypeId`
"Choose an equipment type"; a 41-character unit -> an error on `unitNo`; a 121-character
type/model -> `typeModel`; a 301-character location -> `location`; and the row editor renders each
error under its field (AC 18, 23)
Proof: `npx vitest run "app/(app)" -t "C618:"`
Proof: `npx vitest run components/imports -t "C618:"`

**C619** - the row store writes only the fields it owns: `update` sends an `update` whose keys are
exactly `asset_type_id`, `unit_no`, `type_model` and `location`; `setSkipped` sends exactly `{
skipped }`; `mapType` sends exactly `{ asset_type_id }`; none sends `asset_type_raw`,
`confidence`, `source_ref`, `position`, `asset_id` or `job_id` (AC 19)
Proof: `npx vitest run infrastructure/supabase -t "C619:"`

**C620** - the spelling list, given included unmatched rows with raw `"Widget"`, `"widget "`,
`"WIDGET"`, `"Roof top HVAC"`, `"roof-top hvac"` and `null`, a skipped unmatched `"Gizmo"` and a
typed `"Widget"`, returns exactly 2 entries: `widget` with count 3 and `roof top hvac` with count
2, each with the raw text of its first row by position, ordered by count descending; the review
view renders each with its count and a type select in the writer view (AC 20)
Proof: `npx vitest run domain/imports -t "C620:"`
Proof: `npx vitest run components/imports -t "C620:"`

**C621** - `mapImportTypeAction(jobId, formData)` with `rawText` `"Widget"` and an org type id calls
the row store's `mapType(jobId, "widget", typeId)` and, when it answers `{ ok: true, rows: 14 }`,
returns `{ status: "mapped", rows: 14 }` and calls `refresh()`; with a type id not of the org it
returns `invalid` without calling the store; the review view renders `Applied to 14 rows` for that
state (AC 20, 23)
Proof: `npx vitest run "app/(app)" -t "C621:"`
Proof: `npx vitest run components/imports -t "C621:"`

**C622** - the row store's `mapType(jobId, "widget", typeId)` reads the job's rows with
`asset_type_id` null, keeps those whose `normalized` `asset_type_raw` is `widget`, and updates only
those ids with the filter `asset_type_id is null` still applied; given 3 such rows and a typed
`"Widget"` row, the update names exactly the 3 ids and returns `{ ok: true, rows: <rows the update
returned> }` (AC 20, 21)
Proof: `npx vitest run infrastructure/supabase -t "C622:"`

**C623** - `skipImportRowAction(rowId, true)` calls `setSkipped(rowId, true)`, `(rowId, false)`
calls `setSkipped(rowId, false)`, each returns `saved` and calls `refresh()`; the review view
renders "Skip" on an included row and "Include" on a skipped row in the writer view (AC 22)
Proof: `npx vitest run "app/(app)" -t "C623:"`
Proof: `npx vitest run components/imports -t "C623:"`

### S4 - Included rows become assets once · ~10 files · ~26k

**C624** - the review view of an `extracted` job in the writer view, with every included row typed
and none too long, renders an enabled button `Add 3 assets to Brookhaven` for 3 included rows and
`Add 1 asset to Brookhaven` for 1; rows flagged only `check`, `same as` or `on site` do not disable
it (AC 24)
Proof: `npx vitest run components/imports -t "C624:"`

**C625** - the commit button is `disabled` and the line `<k> rows need a fix before they can be
added` shows, table-driven over 3: 2 untyped included rows -> `2 rows need a fix`; 1 too-long row ->
`1 row needs a fix before it can be added`; 1 untyped and 1 too-long -> `2 rows`; and with 0
included rows the button is `disabled` with `Include at least one row to add.` (AC 25, 30)
Proof: `npx vitest run components/imports -t "C625:"`

**C626** - the commit prompt, rendered from props: idle -> the button only, no text asking to
confirm; confirming -> `Add 3 assets to Brookhaven? Skipped rows stay on the import.` with buttons
"Add assets" and "Cancel"; only "Add assets" submits the commit action (AC 26)
Proof: `npx vitest run components/imports -t "C626:"`

**C627** - in SQL, as estimator `uE`, the RPC on an org A `extracted` job on `siteA` with rows 1
(RTU, `RTU-1`, `Carrier`, `Roof`), 2 (MUA, null unit) and 3 (skipped) returns 2; `siteA` gains
exactly 2 assets with those types, units, models, locations and `source` `import`; rows 1 and 2
have `asset_id` set to those assets and row 3 `asset_id` null; the job is `committed` with
`committed_at` not null, `committed_by` `uE` and `committed_count` 2 (AC 27, 42)
Proof: `npm run test:db import_review`

**C628** - in SQL, the RPC is atomic: with a test trigger on `assets` (created and dropped inside
the rolled-back test) that raises on the second insert, the call raises; afterwards `siteA` has its
earlier asset count, no row of the job has `asset_id`, and the job is `extracted` with
`committed_at` null; the adapter maps any unexpected error to `{ ok: false, code: "unavailable" }`
and calls `console.error` once; the review view renders `We couldn't add these assets. Try again.`
in `role="alert"` for the `unavailable` commit state (AC 28)
Proof: `npm run test:db import_review`
Proof: `npx vitest run infrastructure/supabase -t "C628:"`
Proof: `npx vitest run components/imports -t "C628:"`

**C629** - in SQL, as `uE`, the RPC raises `23514` and writes nothing (no new asset, job still
`extracted`), table-driven over 4 jobs: an included row with null type; an included row with a
41-character `unit_no`; one with a 121-character `type_model`; one with a 301-character
`location`; and the action, when the flagger finds blocking flags on 3 included rows, returns `{
status: "incomplete", count: 3 }` without calling `commit` (AC 29)
Proof: `npm run test:db import_review`
Proof: `npx vitest run "app/(app)" -t "C629:"`

**C630** - in SQL, as `uE`, the RPC on an `extracted` job whose rows are all skipped, and on one
with 0 rows, raises `23514` and writes nothing; the action, for a job with 0 included rows, returns
`{ status: "nothing_to_add" }` without calling `commit` (AC 30)
Proof: `npm run test:db import_review`
Proof: `npx vitest run "app/(app)" -t "C630:"`

**C631** - in SQL, as `uE`, a second RPC call on the job C627 committed raises `40001` and `siteA`
has the same asset count as after the first; the adapter's `commit`, when the RPC raises `40001`
and the re-read job is `committed` with `committed_count` 2 and 1 skipped row, returns `{ ok: true,
added: 2, skipped: 1 }`, the same as the first call's answer (AC 31)
Proof: `npm run test:db import_review`
Proof: `npx vitest run infrastructure/supabase -t "C631:"`

**C632** - the review view of a `committed` job renders the result line, table-driven over 3:
(336 added, 2 skipped) -> `Added to site: 336 assets, 2 skipped`; (3, 0) -> `Added to site: 3
assets`; (1, 0) -> `Added to site: 1 asset`; and a link `View Brookhaven` to `/sites/<siteId>`
(AC 32)
Proof: `npx vitest run components/imports -t "C632:"`

**C633** - in SQL, as `uE`, deleting an asset that the C627 commit added succeeds; its row then
has `asset_id` null with `org_id` unchanged and still exists; the job stays `committed` with
`committed_count` 2 (AC 33)
Proof: `npm run test:db import_review`

### S5 - A committed import is a record, and only writers change anything · ~8 files · ~18k

**C634** - the review view of a `committed` job in the writer view renders `Added` on rows with an
asset and `Skipped` on skipped rows, and no "Edit", "Skip", "Include", mapping select or commit
button (AC 34)
Proof: `npx vitest run components/imports -t "C634:"`

**C635** - the job list renders a `committed` job in the writer view with a neutral pill `Added to
site`, the line `Added to site: 336 assets, 2 skipped` and no Discard control; `ImportJobReader.forSite`
maps a `committed` row with `committed_count` 336 and 2 skipped rows to that state (AC 35)
Proof: `npx vitest run components/imports -t "C635:"`
Proof: `npx vitest run infrastructure/supabase -t "C635:"`

**C636** - `locked` reaches the screen, table-driven over 4: the row store's `update`, `setSkipped`
and `mapType` map SQLSTATE `55000` to `{ ok: false, code: "locked" }`; `discard` on a job the
re-read shows `committed` deletes nothing (its delete filters out `committed`) and returns
`locked`; each of the three row actions and `discardImportAction` returns `{ status: "locked" }`
for it; the review view and the discard prompt render `This import was already added to the
site.` (AC 36)
Proof: `npx vitest run infrastructure/supabase -t "C636:"`
Proof: `npx vitest run "app/(app)" -t "C636:"`
Proof: `npx vitest run components/imports -t "C636:"`

**C637** - in SQL, the trigger, table-driven over 6: as `uE`, updating a row of a `committed` job
raises `55000`; deleting one raises `55000`; updating a row of an `extracting` job raises `55000`;
updating a row of an `extracted` job succeeds; discarding an `extracted` job with 3 rows deletes
the job and its rows; `pg_proc` shows the trigger function `security definer` with
`search_path=""` (AC 37, door 4)
Proof: `npm run test:db import_review`

**C638** - the review view of an `extracted` job in the viewer view renders the rows and their
flags and no "Edit", "Skip", "Include", mapping select or commit button (AC 38)
Proof: `npx vitest run components/imports -t "C638:"`

**C639** - as a viewer, each of the four actions returns `{ status: "forbidden" }` and calls no
container function, table-driven over all 4; in SQL, as viewer `uV`, the RPC raises `42501` and an
`update` of an org A row updates 0 rows (AC 39)
Proof: `npx vitest run "app/(app)" -t "C639:"`
Proof: `npm run test:db import_review`

**C640** - each of the four actions given `"not-a-uuid"` returns `{ status: "not_found" }` without
calling the container, table-driven over 4; the row store's `update`, `setSkipped` and `mapType`
return `not_found` when the update returns no row; `commit` maps `P0002` to `not_found`; in SQL,
as org B owner `uB`, the RPC on an org A job raises `P0002` and an update of an org A row updates
0 rows (AC 40)
Proof: `npx vitest run "app/(app)" -t "C640:"`
Proof: `npx vitest run infrastructure/supabase -t "C640:"`
Proof: `npm run test:db import_review`

**C641** - `getContainer()` builds the reader, the row store and `ImportJobStore` on the same
request-scoped Supabase client, and no file under `web/` outside `scripts/` and `node_modules`
contains `SERVICE_ROLE` (AC 41)
Proof: `npx vitest run composition -t "C641:"`
Proof: `grep -rl "SERVICE_ROLE" --include=*.ts --include=*.tsx --include=*.mts --exclude-dir=node_modules --exclude-dir=scripts . | wc -l` prints `0`

**C642** - the site never comes from the request: `commitImportAction` takes exactly one argument
(`jobId`) and `public.commit_import` has exactly one argument (`pg_proc.pronargs` 1); C627 shows
the assets land on the job's site (AC 42)
Proof: `npx vitest run "app/(app)" -t "C642:"`
Proof: `npm run test:db import_review`

### Doors and delivery · ~12 files · ~22k

**C643** - in SQL, door 1, each labelled: `assets` has a unique constraint on `(id, org_id)`; a row
with `skipped` true and an `asset_id` refused `23514`; two rows with the same `asset_id` refused
`23505`; an `asset_id` of an org B asset on an org A row refused `23503`; `skipped` defaults to
false
Proof: `npm run test:db import_review`

**C644** - in SQL, door 2, each labelled: `committed` with `committed_at` null refused `23514`;
`committed` with `committed_count` 0 refused; `extracted` with `committed_at` set refused;
`committed` with time, member and count 2, read counts, `read_at` and `extract_cursor` =
`extract_total` accepted; status `'queued'` refused
Proof: `npm run test:db import_review`

**C645** - in SQL, door 3: the RPC on `parsed`, `extracting` and `uploaded` org A jobs raises
`40001`; an unknown job id raises `P0002`; `pg_proc` shows `public.commit_import` `security invoker`
(`prosecdef` false) with `search_path=""`, and `anon` has no `execute` on it
Proof: `npm run test:db import_review`

**C646** - the adapter's `commit` maps the RPC, table-driven over 7: returns 2 with 1 skipped row
-> `{ ok: true, added: 2, skipped: 1 }`; `40001` and the re-read job `committed` -> the stored
result (C631); `40001` and the re-read job `extracting` -> `not_ready`; `23514` -> `incomplete`;
`P0002` -> `not_found`; `42501` -> `forbidden`; any other code -> `unavailable` with
`console.error` once; the RPC is called as `commit_import` with only `p_job_id` (door 3)
Proof: `npx vitest run infrastructure/supabase -t "C646:"`

**C647** - each of the four actions passes the store's answer through, table-driven: update and
skip over `saved`, `locked`, `not_found`, `forbidden`, `unavailable`; map over `mapped`, `locked`,
`not_found`, `forbidden`, `unavailable`; commit over `committed` (with `added`, `skipped`),
`incomplete` (with the re-read count), `not_ready`, `not_found`, `forbidden`, `unavailable`;
`refresh()` is called only on `saved`, `mapped` and `committed` (Surface)
Proof: `npx vitest run "app/(app)" -t "C647:"`

**C648** - the review view's alert copy for the non-success states, table-driven over 6, each in
`role="alert"`: `unavailable` (row) -> `We couldn't save this row. Try again.`; `locked` -> `This
import was already added to the site.`; `forbidden` -> `You don't have permission to import
equipment lists.`; `not_found` -> `This import no longer exists.`; `not_ready` -> `This import
isn't ready to add yet.`; `nothing_to_add` -> `Include at least one row to add.` (Surface)
Proof: `npx vitest run components/imports -t "C648:"`

**C649** - `application/ports/index.ts` declares `ImportReviewReader` with `forJob(jobId: string)`,
`ImportRowStore` with `update`, `setSkipped` and `mapType`, `ImportJobStore` with `commit(jobId:
string)`, `ImportRowView` with `skipped` and `assetId`, and `ImportJobStatus` including
`committed` (door 6)
Proof: `npx vitest run composition -t "C649:"`

**C650** - the review route exists flat by job id (door 5)
Proof: `ls "app/(app)/imports/[jobId]" | grep -c -E "^(page|loading)\.tsx$"` prints `2`

**C651** - a migration `supabase/migrations/<version>_import_review.sql` exists (AD-006), and
`database.types.ts` contains `commit_import`, `committed_at`, `committed_count`, `committed_by`,
`skipped` and `asset_id`
Proof: `ls ../supabase/migrations | grep -c -E "^[0-9]{14}_import_review\.sql$"` prints `1`
Proof: `grep -c -E "commit_import|committed_at|committed_count|committed_by|skipped|asset_id" infrastructure/supabase/database.types.ts` prints at least `6`

**C652** - `getContainer()` returns `reviewImport`, the row store functions and `commitImport`
(startup config)
Proof: `npx vitest run composition -t "C652:"`

**C653** - `npm run test:db` with no argument exits 0 and runs `import_review` among its 14 recipes
Proof: `npm run test:db`

**C654** - the whole Vitest suite and lint pass, including earlier features' tests
Proof: `npm test`
Proof: `npm run lint`

**C655** - `npx next build` exits 0
Proof: `npx next build`

**C656** - Supabase security advisors report exactly the two accepted findings
(`rls_enabled_no_policy` on `public.outbox`, `auth_leaked_password_protection`)
Proof: mcp - `get_advisors` type `security`

**C657** - `.specs/STATE.md` has six new `active` AD rows (AD-045 to AD-050, one per door),
`CONTEXT.md` names `import-review`, and ROADMAP Phase 2 item 4 is ticked
Proof: `grep -c -E "^\| AD-0(4[5-9]|50) \|.*\| active \|" ../.specs/STATE.md` prints `6`
Proof: `grep -c "import-review" ../CONTEXT.md` prints at least `1`
Proof: `grep -c -E "^- \[x\] Review grid and commit" ../ROADMAP.md` prints `1`

**C658** - live, as the demo owner, at 1440x900, 768x1024 and 375x812, on one demo site that
already has an asset: a fictitious `units.xlsx` of 6 rows (two saying "Widget", one unit twice, one
unit equal to the site's existing asset) is uploaded, read and extracted; "Review rows" opens the
grid with the flags "Needs a type", "Same as row <n>" and "Already on this site"; mapping "Widget"
reports `Applied to 2 rows`; skipping the duplicate and the on-site row and pressing "Add 4 assets
to <site>" then "Add assets" ends with `Added to site: 4 assets, 2 skipped`; the site register lists
4 more assets; the job list shows "Added to site" with no Discard; at 375 the rows are stacked
cards; no horizontal page scroll; touch targets at least 44 px at 375 and 768; no console error or
warning; no failed request; SQL then shows 4 `assets` with `source` `import` linked from the job's
rows. Cleanup (with the user's go-ahead, a production data change): the 4 assets, the job, its rows
and its file are deleted by SQL, and the demo org returns to its earlier asset count, 0
`import_jobs` and 0 objects in `imports`
Proof: live - Playwright MCP `browser_navigate`, `browser_resize`, `browser_file_upload`, `browser_click`, `browser_select_option`, `browser_snapshot`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_requests`
Proof: mcp - `execute_sql` counting the site's `import` assets, the rows' `asset_id`, and after cleanup the demo org's assets, `import_jobs` and `imports` objects

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| page `GET /imports/[jobId]` statuses (3) | `200` C602 · C603 · `404` C607 · login redirect C607 | - |
| `updateImportRowAction` states (6) | `saved` C617 · C647 · `invalid` C618 · `locked` C636 · C647 · `forbidden` C639 · C647 · `not_found` C640 · C647 · `unavailable` C647 · C648 | - |
| `skipImportRowAction` states (5) | `saved` C623 · C647 · `locked` C636 · C647 · `forbidden` C639 · C647 · `not_found` C640 · C647 · `unavailable` C647 · C648 | - |
| `mapImportTypeAction` states (6) | `mapped` C621 · C647 · `invalid` C621 · `locked` C636 · C647 · `forbidden` C639 · C647 · `not_found` C640 · C647 · `unavailable` C647 · C648 | - |
| `commitImportAction` states (7) | `committed` C647 · C658 · `incomplete` C629 · C647 · `nothing_to_add` C630 · C648 · `not_ready` C646 · C647 · C648 · `forbidden` C639 · C647 · `not_found` C640 · C647 · `unavailable` C628 · C647 | - |
| job statuses at the review route (7) | `uploading` C607 · `uploaded` C607 · `parsed` C607 · `unreadable` C607 · `extracting` C607 · `extracted` C602 · `committed` C632 · C634 | - |
| job statuses at the "Review rows" link (7) | C601, table-driven over all 7 | - |
| flags (7) | `needs type` C609 · `too long` `Unit #` C610 · `too long` `Type/model` C610 · `too long` `Location/access` C610 · `check` C611 · `same as` C612 · `on site` C613 | - |
| flag exceptions (3) | null unit never duplicate C614 · skipped never flagged C615 · skipped not the first of a key C612 | - |
| length edges (6) | C610, table-driven over all 6 | - |
| pager cases (9) | C604, table-driven over all 9 | - |
| reader page sizes (4) | C608, table-driven over all 4 | - |
| commit refusals in SQL (6) | null type C629 · long unit C629 · long model C629 · long location C629 · all skipped C630 · no rows C630 | - |
| commit button states (5) | enabled plural C624 · enabled singular C624 · disabled untyped C625 · disabled too long C625 · disabled none included C625 | - |
| result line forms (3) | C632, table-driven over all 3 | - |
| alert copy (7) | commit `unavailable` C628 · row `unavailable` C648 · `locked` C648 · C636 · `forbidden` C648 · `not_found` C648 · `not_ready` C648 · `nothing_to_add` C648 | - |
| `commit` adapter mapping (7) | C646, table-driven over all 7 | - |
| trigger cases (6) | C637, table-driven over all 6 | - |
| row writes that must be refused once frozen (4) | update C636 · C637 · skip C636 · map C636 · discard C636 | - |
| transitions written (1) | `extracted` -> `committed` C627 | - |
| transitions refused (4) | from `parsed` C645 · `extracting` C645 · `uploaded` C645 · `committed` (again) C631 | - |
| roles (3 kinds) | writer C617 · C627 · viewer C638 · C639 · other org C640 | - |
| Landing doors (6) | door 1 C643 · C627 · C633 · C657 · door 2 C644 · C627 · C657 · door 3 C645 · C646 · C628 · C657 · door 4 C637 · C636 · C657 · door 5 C650 · C601 · C657 · door 6 C649 · C608 · C619 · C622 · C657 | - |
| entities and relations (4) | `import_rows` -> `assets` C627 · C643 · C633 · `assets` unique `(id, org_id)` C643 · `sites` -> `assets` C627 · C642 · `import_jobs` -> `import_rows` C637 | - |
| startup config: container assembly (1 place) | `getContainer()` C641 · C652 | - |

- Claims naming an action's answer (C617, C618, C621, C623, C629, C630, C636, C639, C640, C642,
  C647) are proven by calling the Server Action itself; C658 crosses the real browser, Storage,
  Claude and the database.
- Claims about RLS, the checks, the trigger and the RPC (C627-C633, C637, C639, C640, C642-C645)
  are proven in SQL as the role in question. The stub proofs prove only each adapter's calls and
  mapping.
- C631 proves the repeat after a commit; two calls at the same instant are serialised by the RPC's
  `for update` on the job, which the SQL suite (one session) cannot race. The compare-and-set it
  falls back to is the same one C631 proves.
- C625, C629 and C630 cross two levels on purpose: the flagger decides, the action refuses before
  any write, and the RPC refuses again.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (the RPC, the trigger, the reader, the row store, `commit`) | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary (the flagger, the pager, the spelling list, the review view's control rules) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing beyond validation (the four actions) | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation (the container wiring, presentational prompts) | none of its own | covered by its consumer's proof |

Evidence:

- the flagger: 7 flags, 3 exceptions, 6 length edges -> decides
- the pager: 9 cases (page bounds, parse failures) -> decides
- the RPC: 4 SQLSTATE outcomes, 6 refusals, 1 transition -> decides
- the trigger: 3 job states, 2 operations, the cascade -> decides
- `commit` adapter: 7 mappings -> decides
- the review view: control visibility over 2 roles × 2 job statuses, 5 button states -> decides
- closest analogues: `domain/imports` `matchAssetType` (C515-C518), `record_extraction_chunk` (C505, C525, C549), `ImportJobStore.recordExtraction` (C524), each proven at its own layer

Cost: about 45 proofs at their own layer across about 12 files. Without these rows, the flag
table and the commit refusals are proven only by the live run that happens to cross three of them.

## Swept

- validation: C610 (asset form limits), C618 (row edits through `validateAsset`), C621 (type of the org), C629 (the RPC refuses what the form would), C604 (page parameter), C640 (non-uuid ids)
- failure modes: C628 (a failed commit leaves no asset and the job `extracted`), C647 (each action passes `unavailable` through), C648 (copy names the next step)
- idempotency: C631 (a second commit adds nothing and answers with the stored result), C646 (`40001` re-reads), C622 (a mapping re-applied finds no untyped row)
- authorization: C639 (viewers refused in the app and in SQL), C640 (other org), C641 (member client only), C642 (site from the job)
- concurrency: C637 (the trigger freezes rows against an edit landing with a commit), C631 (compare-and-set on the job), C622 (`asset_type_id is null` re-checked in the update)
- data lifecycle: C633 (deleting an imported asset keeps the row), C636 (a committed job cannot be discarded), C637 (discarding an extracted job still cascades)
- dependency failure: C628 (database failure mid-commit), C647 (store `unavailable`); n/a for external services - review and commit call no service but Supabase
- state transitions: C627 (the one written), C631, C645 (the refused ones), C644 (any other combination refused by checks)
- observability: C628, C646 (`console.error` on each unexpected failure); `committed_at`, `committed_by` and `committed_count` record who added what and when; no metric or tracing requirement

## Handoff

- Read set measured with `wc -c` before building (ports, imports adapter and its tests, stub client,
  readers, composition and its test, `import-actions.ts` and `imports.test.ts`, the import components
  and tests, the imports domain, the import page, the asset and record forms, `Select`, the test-db
  runner, `fixture.sql`, `import_extract.sql`, the import-extract migration, `CONTEXT.md`,
  `STATE.md`, `ROADMAP.md`): 265,082 bytes, about 66k tokens.
- Written:
  - Domain flagger, pager, spelling list and tests: ~18 KB.
  - Reader, row store, `commit`, stub changes and tests: ~22 KB.
  - Migration and `import_review.sql`: ~16 KB.
  - Actions and tests: ~14 KB.
  - Review page, review view, row editor, mapping list, commit prompt, job list changes and tests: ~45 KB.
  - Runner entry, docs: ~6 KB.
  - Total ~121 KB, about 30k tokens. Regenerating `database.types.ts` about 9k.
- Live validation (C658): about 40k tokens of snapshots.
- S1-S5 plus doors: about 145k tokens, under the 150k budget, so one builder. The margin is thin;
  if the live run pushes past it, the run continues under compaction rather than cutting a slice.
- Production-data note: the migration goes to the live project through MCP `apply_migration`, as
  every earlier migration did, and C658's SQL cleanup deletes demo rows; both need the user's
  go-ahead at that step.
- Earlier exact pins that change: the runner tests (14 recipes, 16 SQL files); tests listing
  `ImportJobStatus` values or the status check; `ImportJobView` expectations gaining the commit
  state; C548's status list in `import_extract.sql` if it enumerates statuses.
- Derived copy not in a numbered AC, flagged for review in the diff: C625 `Include at least one
  row to add.` and `1 row needs a fix before it can be added`; C648 `We couldn't save this row. Try
  again.` and `This import isn't ready to add yet.`

- Mechanism: one builder (estimate under budget, no ask).
- **Boundary (part 1):** every vitest, lint, shell and build proof is green locally (1,027 tests, `npm run lint` clean, `npx next build` exits 0): C601-C626, C628 (adapter and view parts), C629-C632 (vitest parts), C634-C636, C638-C642 (vitest and shell parts), C646-C650, C652, C654, C655. The SQL file passes in a dry run: fixture, then the unapplied migration, then each of the 14 recipes in one transaction ending in `rollback`, against the live project (nothing persisted). Waiting on the user's go-ahead to apply the migration: `npm run test:db` itself (C627-C633, C637, C639, C640, C642-C645 SQL parts, C653), C651 (file renamed to the applied version), C656, C657, C658.
- **Settled mid-build:**
  - Door 4's trigger refuses changes to rows of a `parsed` job, so import-extract's C547 owner and viewer updates (which used the `parsed` job `jK`) now target a row of the `extracted` job `jEX`; the claim ("an owner update is accepted, a viewer's updates 0 rows") is unchanged.
  - Door 2 listed four import-extract checks to rewrite; `import_jobs_extracted_at_iff_extracted` is a fifth, since a committed job keeps its `extracted_at`. Rewritten the same way.
  - The trigger lets through an update that only clears `asset_id`: that is the `on delete set null (asset_id)` of a deleted asset, which AC 33 (C633) requires on a committed job.
  - The dry run showed door 2's check accepts an `extracted` job carrying only `committed_at`; Landing row 2b (`import_jobs_committed_together`) was appended before the fix.
  - `ImportJobView.committed` is optional and set only on committed jobs, so earlier exact `forSite` expectations hold; skipped = the view's `rows` minus `committed_count`, exact because rows are frozen once committed.
  - `mapType` updates in batches of 100 ids (each still filtered on `asset_type_id is null`) to keep the PATCH URL short; a failure part way leaves the rest untyped, and applying again types them.
  - The page reads `?show` / `?page` in a child inside `<Suspense>` (AD-022), so C607's page proof calls that child, `ReviewForRequest`.
  - `database.types.ts` was edited by hand; it is compared with `generate_typescript_types` after the migration is applied.
- **Boundary (part 2):** the migration was applied to the live project with the user's go-ahead (2026-10-27) as version `20261027162030`, after `mcp__claude_ai_Supabase__apply_migration` was added to `.claude/settings.json` (the auto-mode classifier refused the first call); the file was renamed to match. `npm run test:db`: 14 passed (C627-C633, C637, C639, C640, C642-C645, C653). `get_advisors` security: exactly `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection` (C656). `generate_typescript_types` matches `database.types.ts` once the `committed_*` fields were moved before `content_type` (C651).
- **Boundary (part 3, live, 2026-10-27):** C658 passed on Brookhaven Community Centre (5 assets, AHU-1 among them) with a fictitious 6-row `units.xlsx`: extracted by Claude to "6 rows, 2 need an equipment type"; the grid showed "Needs a type" on both Widget rows, "Same as row 1" on the second RTU-10 and "Already on this site" on AHU-1, with the commit button disabled ("2 rows need a fix before they can be added"); mapping Widget to Exhaust fan reported "Applied to 2 rows"; skipping rows 5 and 6 gave "Add 4 assets to Brookhaven Community Centre", the prompt "… Skipped rows stay on the import.", then "Added to site: 4 assets, 2 skipped" with a read-only grid and "View Brookhaven Community Centre"; the job list showed "Added to site" with no Discard; the site register listed RTU-10, MUA-10, W-1 and W-2. SQL: 9 assets on the site, 4 `source = 'import'`, each linked from its row (rows 1-4 linked, 5-6 skipped), job `committed 4`. No horizontal page scroll at 1440, 768 or 375; no touch target under 44 px at 768 or 375; 0 console errors on a clean load; no failed request.
- **Fixed during the live run** (1,028 tests, lint and build green after):
  - "Applied to n rows" vanished: mapping the last unrecognised spelling removed the section that held the message. A `MappingSection` now stays mounted for writers and keeps the last result ("Applied to 2 rows. Every equipment type is recognised." - copy not in a numbered AC). Re-run live after resetting the two test rows' types by SQL.
  - At 375 px the commit button did not wrap and ran past its card; it now wraps below desktop.
  - At 768 px the page scrolled sideways: the `md:sr-only` column labels are absolutely positioned and escaped the grid's scroll container; the container is now `relative`.
  - A committed job flagged every added row "Already on this site" (its own assets are now on the site); site duplicates are compared only while the job is `extracted` (new C634 test).
  - A console error ("Element type is invalid … Lazy") appeared once during Fast Refresh right after an edit and not on any clean load.
- **Not done:** cleanup of the live data. The user chose to delete it by SQL, and the `execute_sql` delete was declined twice by the permission prompt. The demo org still holds the 4 imported assets on Brookhaven Community Centre, the committed job `7320a90f-ad98-4176-92bd-1ad8c9934c61` with its 6 rows, and its object in `imports`.
