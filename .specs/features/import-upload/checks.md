# Asset import, step 1: upload and import jobs - checks

Profile: light
Plan: `.specs/features/import-upload/plan.md`

44 checks in 4 slices plus doors and delivery · 4 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C401:`).
  This feature numbers from C401, because earlier features own `C1:`-`C348:`. React output is
  asserted with `renderToStaticMarkup`. Supabase is the recording `stubClient`
  (`infrastructure/supabase/stub-client.ts`, which gains `storage.from(bucket)` with
  `createSignedUploadUrl`, `info` and `remove`). `@/composition` and `next/navigation` are mocked
  where a page or action is called directly, as `app/(app)/record-forms.test.ts` does. A client
  component's interactive state is proven through the presentational component it renders, with
  that state passed as props. The browser upload sequence (PUT, then confirm) is a function taking
  `fetch` and the confirm action as parameters, so it is proven without a browser.
- **test:db** - `npm run test:db import_upload` in `web/` (AD-026) runs `fixture.sql` and then
  `supabase/tests/import_upload.sql` against the live project, rolled back. The new file joins
  `RECIPES` as `plain("import_upload")`. The recipe passes only when its last row is
  `import_upload: pass`. Each assertion is labelled with its check id (`C405:`), so a failure names
  the claim. Fixture: org A has owner `uA`, estimator `uE` and viewer `uV`; org B has
  owner `uB`; `siteA` and `siteB` exist. `import_jobs` joins `tests.tenant_tables()` and the
  fixture's valid-insert case, so the existing `rls_isolation`, `rls_roles` and
  `domain_constraints` loops cover it too. Storage rows are inserted straight into
  `storage.objects` (`bucket_id`, `name`) as the acting role. A delete needs
  `set_config('storage.allow_delete_query', 'true', true)` first, because the live
  `storage.protect_delete` trigger raises otherwise (checked 2026-10-26). RLS still decides the
  row count.
- **shell** - a command run from `web/` (or the repo root where the path says `../`) that passes
  when it exits 0, or prints the stated count.
- **mcp** - a Supabase MCP call on project `gnxebrtcpbujhvcamtoe`, result recorded in the
  Handoff.
- **live** - a real browser on `npm run dev` through the Playwright MCP, signed in as the demo
  owner, on one demo site. Not committed (AGENTS..md). It uploads fictitious files made in the
  scratchpad and discards them through the UI, so it leaves no rows and no objects (plan
  Assumptions).

"Writer" means role owner, admin or estimator. "Writer view" means the view rendered with role
`estimator`, and "viewer view" means it rendered with role `viewer`. "Accepted file" is as in the
plan's Criteria preamble.

## Checks

### S1 - Upload a file to a site · ~14 files · ~30k

**C401** - the writer view of `/sites/<id>` renders `<a href="/sites/<id>/import">` with text
"Import equipment list" in the page header (AC 1)
Proof: `npx vitest run components/sites -t "C401:"`

**C402** - the writer view of the import page renders the site name in the `<h1>`, an
`<a href="/sites/<id>">` back link, an `<input type="file">` whose `accept` is exactly
`.xlsx,.csv,.docx,.pdf`, the text "Excel, CSV, Word or PDF, up to 20 MB", and a submit button
"Upload" (AC 2)
Proof: `npx vitest run components/imports -t "C402:"`

**C403** - as a writer, `startImport` for site `<siteId>` with `fileName = "Units.xlsx"`,
`size = 2048` calls `ImportJobStore.start` exactly once with
`(member.orgId, "<siteId>", { name: "Units.xlsx", size: 2048, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })`
and returns the store's `{ ok: true, jobId, signedUrl, contentType }` unchanged (AC 3)
Proof: `npx vitest run "app/(app)" -t "C403:"`

**C404** - the Supabase `ImportJobStore.start` adapter inserts into `import_jobs` exactly
`{ org_id, site_id, original_name, size_bytes, content_type, status: "uploading" }` with
`.select("id")`, then calls `storage.from("imports").createSignedUploadUrl("<orgId>/<jobId>")`
with no `upsert` option, and returns `{ ok: true, jobId, signedUrl, contentType }` (AC 3, doors 3
and 4)
Proof: `npx vitest run infrastructure/supabase -t "C404:"`

**C405** - in SQL, as estimator `uE` of org A, inserting an `import_jobs` row for `siteA` succeeds
with `status = 'uploading'` and `created_by = uE`; then inserting a `storage.objects` row
`('imports', '<orgA>/<that job id>')` as `uE` succeeds (AC 3, doors 1 and 3)
Proof: `npm run test:db import_upload`

**C406** - `ImportJobStore.confirmUploaded(jobId)`, when `storage.from("imports").info("<orgId>/<jobId>")`
reports a size equal to the job's `size_bytes`, updates `import_jobs` with `{ status: "uploaded" }`
filtered on `id = jobId` **and** `status = "uploading"`, and returns `{ ok: true }` (AC 4)
Proof: `npx vitest run infrastructure/supabase -t "C406:"`

**C407** - `contentTypeFor(extension)` returns the four types of AC 5 for `pdf`, `csv`, `xlsx` and
`docx`, the same for `PDF`, `Csv`, `XLSX` and `DocX`, and `null` for `xls`, `doc`, `txt` and `""`
(table-driven over all 12)
Proof: `npx vitest run domain/imports -t "C407:"`

**C408** - the upload sequence sends `fetch(signedUrl, { method: "PUT", body: file })` with header
`content-type` equal to the server's `contentType` and `x-upsert: false`, also when `file.type` is
`application/vnd.ms-excel` for a `.csv` (AC 5)
Proof: `npx vitest run components/imports -t "C408:"`

**C409** - the import form rendered with state `uploading` and file name `Units.xlsx` has its
"Upload" button `disabled` with label "Uploading…", and shows `Units.xlsx` (AC 6)
Proof: `npx vitest run components/imports -t "C409:"`

**C410** - the import job read adapter selects `import_jobs` for one site, orders by `created_at`
descending, and calls `.limit(500)`. The page renders jobs in the order the port returns them, so a
job created later is listed first (AC 4, 14, AD-023)
Proof: `npx vitest run infrastructure/supabase -t "C410:"`
Proof: `npx vitest run components/imports -t "C410:"`

### S2 - Refuse what cannot be imported · ~6 files · ~12k

**C411** - `validateImportFile({ name, size })`, table-driven:
- `report.txt` -> `"Choose an Excel (.xlsx), CSV, Word (.docx) or PDF file"`;
- `noext` -> the same message;
- size `0` -> `"This file is empty"`;
- size `20971521` -> `"Files can be up to 20 MB"`;
- a 256-character name ending `.csv` -> `"File name must be 255 characters or fewer"`.

Each of these is `{ ok: false }`. Size `1`, size `20971520`, a 255-character `.pdf` name and
`LIST.XLSX` are `{ ok: true }` (AC 7-10)
Proof: `npx vitest run domain/imports -t "C411:"`

**C412** - `startImport` with an invalid file returns `{ status: "invalid", message: <the C411 message> }`
and calls no store method (AC 7-10)
Proof: `npx vitest run "app/(app)" -t "C412:"`

**C413** - in SQL, `storage.buckets` has exactly one row with `id = 'imports'`. It has
`public = false`, `file_size_limit = 20971520`, and `allowed_mime_types` equal as a set to the
four types of AC 5 (AC 11, door 2)
Proof: `npm run test:db import_upload`

**C414** - live: with a Playwright `page.route` rewriting the Storage `PUT`'s `content-type` to
`text/plain`, uploading a `.csv` gets a non-2xx answer from Storage. The page shows "The upload
didn't finish. Try again.", and the job is listed as "Upload not finished" (AC 11, 12)
Proof: live - Playwright MCP `browser_run_code_unsafe` (route), `browser_file_upload`, `browser_snapshot`, `browser_network_requests`

**C415** - `confirmUploaded` returns `{ ok: false, code: "upload_missing" }` and issues no update
when `info` reports the object missing, and also when its size differs from `size_bytes` by 1
(AC 12)
Proof: `npx vitest run infrastructure/supabase -t "C415:"`

**C416** - the upload sequence, when the `PUT` answers `403` or rejects, never calls
`confirmImport` and returns state `upload_failed`. When `confirmImport` returns `upload_missing`,
it returns `upload_failed` too. The form rendered with `upload_failed` shows "The upload didn't
finish. Try again." and keeps the chosen file name (AC 12)
Proof: `npx vitest run components/imports -t "C416:"`

**C417** - `confirmUploaded` on a job already `uploaded` returns `{ ok: true }` when the
compare-and-set update matches no row and the job's status reads `uploaded`, and writes nothing
else (AC 13)
Proof: `npx vitest run infrastructure/supabase -t "C417:"`

### S3 - See and discard a site's import jobs · ~6 files · ~14k

**C418** - the job list rendered with two jobs shows, per job:
- the original file name;
- the size: `512` -> "1 KB", `15360` -> "15 KB", `1048576` -> "1.0 MB", `20971520` -> "20.0 MB";
- the uploader's email, or "Former member" when it is `null`;
- the upload date;
- the label "Uploaded" for `uploaded` and "Upload not finished" for `uploading`.

(AC 14)
Proof: `npx vitest run components/imports -t "C418:"`

**C419** - the job list with zero jobs shows "No equipment lists imported yet" (AC 15)
Proof: `npx vitest run components/imports -t "C419:"`

**C420** - the discard control rendered unconfirmed shows a "Discard" button and no prompt. Rendered
confirming, it shows "Discard Units.xlsx? The file will be deleted." with "Discard" and "Cancel"
buttons. Only the confirm button submits the `discardImport` form (AC 16)
Proof: `npx vitest run components/imports -t "C420:"`

**C421** - `ImportJobStore.discard(jobId)` deletes from `import_jobs` by `id` with `.select("id, org_id")`
**before** calling `storage.from("imports").remove(["<orgId>/<jobId>"])`, and returns `{ ok: true }`
(AC 17)
Proof: `npx vitest run infrastructure/supabase -t "C421:"`

**C422** - when `remove` returns an error after the row delete, `discard` still returns
`{ ok: true }` and calls `console.error` with a message containing `<orgId>/<jobId>` (AC 18)
Proof: `npx vitest run infrastructure/supabase -t "C422:"`

**C423** - in SQL, as `uE` of org A: deleting an org A `import_jobs` row deletes 1 row. With
`storage.allow_delete_query` on, deleting the `storage.objects` row `imports/<orgA>/<job>` deletes
1 row (AC 17, door 3)
Proof: `npm run test:db import_upload`

### S4 - Who may upload, read and fetch files · ~6 files · ~14k

**C424** - the viewer view of the import page renders the job list, and no `<input type="file">`,
no "Upload" button and no "Discard" button. The viewer view of `/sites/<id>` has no link to
`/sites/<id>/import` (AC 19)
Proof: `npx vitest run components/imports components/sites -t "C424:"`

**C425** - as a viewer, each of `startImport`, `confirmImport` and `discardImport` returns
`{ status: "forbidden" }` and calls no store method (table-driven over all 3). The form rendered
with `forbidden` shows "You don't have permission to import equipment lists." (AC 20)
Proof: `npx vitest run "app/(app)" components/imports -t "C425:"`

**C426** - the import page calls `notFound()` for a site id that is not a uuid, and for one the
`SiteRegister` port returns `null` for (missing, or another org's under RLS) (table-driven over
both; AC 21)
Proof: `npx vitest run "app/(app)" -t "C426:"`

**C427** - `confirmImport` and `discardImport` with a non-uuid job id return `{ status: "not_found" }`
without calling the store. The adapter returns `not_found` when the update or delete matches no
row and the job is not readable (AC 22)
Proof: `npx vitest run "app/(app)" -t "C427:"`
Proof: `npx vitest run infrastructure/supabase -t "C427:"`

**C428** - in SQL, as owner `uB` of org B: selecting `storage.objects` under `imports/<orgA>/`
returns 0 rows; inserting `imports/<orgA>/<an uploading job of A>` raises `42501`; deleting it (with
`allow_delete_query` on) deletes 0 rows. As `anon`: selecting returns 0 rows and inserting under
any `imports` key raises `42501` (AC 23, door 3)
Proof: `npm run test:db import_upload`

**C429** - in SQL, as estimator `uE` of org A, inserting a `storage.objects` row in `imports`
raises `42501` for each of these keys (table-driven over all 4):
- `<orgA>/<random uuid>` (no such job);
- `<orgA>/<a job of org B>`;
- `<orgA>/<a job of A in status uploaded>`;
- `<orgA>` (no job folder).

As viewer `uV`, inserting `<orgA>/<an uploading job of A>` raises `42501`. There is no `update`
policy, so `uE` updating an `imports` object's `name` changes 0 rows (AC 24, door 3)
Proof: `npm run test:db import_upload`

**C430** - `startImport` with form fields `orgId`, `siteId`, `status = "uploaded"` and
`contentType = "text/plain"` added still calls `start` with `member.orgId`, the route's site id and
the extension's content type. The store input has no `status` key (AC 25)
Proof: `npx vitest run "app/(app)" -t "C430:"`

**C431** - the adapter maps errors, table-driven over all 4:
- insert error `42501` -> `forbidden`;
- insert error `23503` (foreign or missing site) -> `not_found`;
- any other database error -> `unavailable`;
- a `createSignedUploadUrl` or `info` error -> `unavailable`.

`unavailable` calls `console.error` with the code or message. The form rendered with `unavailable`
shows "We couldn't upload the file. Try again." (AC 26)
Proof: `npx vitest run infrastructure/supabase components/imports -t "C431:"`

**C432** - in SQL, `import_jobs` rules:
- a viewer `uV` insert raises `42501`;
- `uV` updates and deletes change 0 rows;
- `uB` reads 0 org A jobs;
- an org A insert naming `siteB` raises `23503` (composite FK);
- an insert with `status = 'parsing'` raises `23514`.

(AC 19, 23, door 1)
Proof: `npm run test:db import_upload`

### Doors and delivery · ~10 files · ~18k

**C433** - `getContainer()` returns `startImport`, `confirmImportUpload`, `discardImport` and
`listImportJobs` (names per the store and read ports). `web/application/ports/index.ts` exports
`ImportJobStore`. No file under `web/app` or `web/components` imports `@supabase/*` or
`@/infrastructure` (door 4, AD-014)
Proof: `npx vitest run composition -t "C433:"`
Proof: `npm run lint`

**C434** - `/sites/[siteId]/import/loading.tsx` renders an `<h1>` and an element with
`role="status"` containing "Loading…" (Observable loading state)
Proof: `npx vitest run "app/(app)" -t "C434:"`

**C435** - `npx next build` exits 0 and its route list contains `/sites/[siteId]/import`
(Surface `GET`)
Proof: `npx next build`

**C436** - signed out, `updateSession` answers `307` with `Location` path `/login` for
`/sites/<uuid>/import` (Surface `307`)
Proof: `npx vitest run infrastructure/supabase -t "C436:"`

**C437** - a migration file `supabase/migrations/<version>_import_upload.sql` (AD-006) creates
`public.import_jobs`, enables RLS on it, and inserts the `imports` bucket. `database.types.ts`
contains `import_jobs` (doors 1-3)
Proof: `ls ../supabase/migrations | grep -c -E "^[0-9]{14}_import_upload\.sql$"`
Proof: `grep -c "import_jobs" infrastructure/supabase/database.types.ts`

**C438** - `npm run test:db` with no argument exits 0, `import_upload` is among the recipes it runs,
and `tests.tenant_tables()` lists `import_jobs` (AD-026; the existing isolation, role and
constraint loops cover the new table)
Proof: `npm run test:db`
Proof: `grep -c "'import_jobs'" ../supabase/tests/fixture.sql`

**C439** - the whole Vitest suite passes, including the earlier features' tests
Proof: `npm test`

**C440** - Supabase security advisors report exactly the two accepted findings
(`rls_enabled_no_policy` on `public.outbox`, `auth_leaked_password_protection`) and nothing on
`import_jobs` or `storage.objects`
Proof: mcp - `get_advisors` type `security`

**C441** - `.specs/STATE.md` has four new `active` AD rows: the import job table and status (door
1), the `imports` bucket (door 2), the object key and storage policies (door 3), and the
signed-URL upload protocol and port (door 4). `CONTEXT.md` mentions `import-upload` under Asset
import. `ROADMAP.md` shows `- [x] Upload to Storage and import jobs` (AGENTS..md)
Proof: `grep -c "import-upload" ../CONTEXT.md`
Proof: `grep -c -E "^- \[x\] Upload to Storage and import jobs" ../ROADMAP.md`
Proof: `grep -c -E "^\| AD-03[1-4] \|.*\| active \|" ../.specs/STATE.md`

**C442** - live as the demo owner, at 375x812, 768x1024 and 1440x900:
- open a demo site, then "Import equipment list";
- upload a fictitious `units.csv` and `units.pdf`; each is listed as "Uploaded", newest first;
- pick `notes.txt` and see the extension message; pick a 21 MB `.pdf` and see "Files can be up to 20 MB"; no job is added;
- discard both jobs after the prompt; the list shows "No equipment lists imported yet".

At each size: no horizontal scroll; every touched control is at least 44x44 px below 1024 px
(touch taps on mobile and tablet); `browser_console_messages` has no error or warning; and
`browser_network_requests` has no failed request apart from C414's deliberate one. After the run,
SQL shows 0 `import_jobs` rows and 0 `imports` objects for the demo org (AC 1-10, 14-17;
Surface `200`)
Proof: live - Playwright MCP `browser_navigate`, `browser_resize`, `browser_file_upload`, `browser_click`, `browser_snapshot`, `browser_console_messages`, `browser_network_requests`
Proof: mcp - `execute_sql` counting the demo org's `import_jobs` and `storage.objects` in `imports`

**C443** - live, as the demo owner: after the C442 upload of `units.csv`, the object
`imports/<demo org>/<job id>` exists in Storage with `size` equal to the file's byte count and
`mimetype` `text/csv`, before it is discarded (AC 3, 5; Storage `PUT` `200`)
Proof: mcp - `execute_sql` on `storage.objects` (`name`, `metadata->>'size'`, `metadata->>'mimetype'`)

**C444** - the site register view for a writer still shows the same asset rows and the "Add asset"
link that the record-forms proofs assert. The new link adds a control and removes nothing
(regression)
Proof: `npx vitest run components/sites -t "C444:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /sites/[siteId]/import` statuses (3) | `200` C402 · C442 · `404` C426 · `307` C436 | - |
| `startImport` outcomes (5) | ok C403 · `invalid` C412 · `forbidden` C425 · `not_found` C431 · `unavailable` C431 | - |
| Storage `PUT <signedUrl>` statuses (5) | `200` C443 · `400` C416 · `409` C416 · `413` C416 · `415` C414 · C416 | - |
| `confirmImport` outcomes (5) | `uploaded` C406 · C417 · `upload_missing` C415 · `forbidden` C425 · `not_found` C427 · `unavailable` C431 | - |
| `discardImport` outcomes (4) | `discarded` C421 · C422 · `forbidden` C425 · `not_found` C427 · `unavailable` C431 | - |
| extensions -> content type (12) | C407, table-driven over all 12 | - |
| file bounds (8 edges) | empty C411 · 1 byte C411 · 20971520 C411 · 20971521 C411 · 255 name C411 · 256 name C411 · wrong ext C411 · no ext C411 | - |
| job statuses (2) | `uploading` C404 · C405 · C418 · `uploaded` C406 · C418 | - |
| status refused by the check (1) | `parsing` C432 | - |
| size formatting (4 edges) | 512 C418 · 15360 C418 · 1048576 C418 · 20971520 C418 | - |
| actions refusing a viewer (3) | C425, table-driven over all 3 | - |
| roles (4) | `owner` C442 · C428 (`uB`) · `admin` existing - `canWriteRecords`, proven for all four roles by record-forms · `estimator` C405 · C423 · C429 · `viewer` C424 · C425 · C429 · C432 | - |
| storage policies (4 verbs) | `select` C428 · `insert` C405 · C428 · C429 · `delete` C423 · C428 · `update` (none) C429 | - |
| storage insert refusals (6) | no job C429 · other org's job C429 · `uploaded` job C429 · no job folder C429 · viewer C429 · anon C428 | - |
| adapter error mapping (4) | C431, table-driven over all 4 | - |
| Landing doors (4) | door 1 table C405 · C432 · C437 · C441 · door 2 bucket C413 · C414 · C441 · door 3 key and policies C404 · C428 · C429 · C441 · door 4 protocol and port C404 · C408 · C433 · C441 | - |
| entities written (2) | `import_jobs` C405 · C423 · C432 · `storage.objects` in `imports` C405 · C423 · C443 | - |
| startup config: container assembly (1) | `getContainer()` C433 | - |

- Claims naming a status code, route or response shape (C414, C426, C435, C436, C442, C443) each
  have a proof that crosses that boundary: the rendered page, the proxy, the build, a real browser
  or the stored object.
- Claims about RLS and storage policies (C405, C423, C428, C429, C432) are proven in SQL as the role
  in question, not through a stub. The stub proofs (C404, C406, C415, C417, C421, C422, C431) prove
  only the adapter's calls and mapping.
- The Storage `400`, `409` and `413` statuses are not produced on purpose: `x-upsert: false` plus
  a fresh job id makes `409` unreachable from the page, and the 20 MB pre-check stops `413`. The
  claim proven for all three is the page's handling of any non-2xx answer (C416). C413 proves the
  bucket configuration that makes Storage enforce size, and C414 shows one enforced refusal live.

## Swept

- validation: C407, C411, C412 (extension, size and name bounds), C413 (bucket-side size and type), C426, C427 (non-uuid ids), C430 (form fields cannot override org, site, status or type)
- failure modes: C415, C416 (upload not finished, nothing marked uploaded), C422 (object delete fails after the row is gone), C431 (every error mapped)
- idempotency: C417 (a repeated confirm changes nothing); C404 (no `upsert`, so a replayed `PUT` cannot overwrite); a replayed `startImport` creates a second job, which the plan's Assumptions accept
- authorization: C424, C425 (app refuses viewers), C428, C429, C432 (RLS and storage policies refuse viewers, other orgs and anon), C436 (signed out)
- concurrency: C406, C417 (confirm is a compare-and-set on `status = 'uploading'`, so two confirms write once); C429 (an object cannot be inserted once its job left `uploading`)
- data lifecycle: C421, C423 (discard removes the row, then the object); C422 (the orphan object is logged); stuck `uploading` jobs stay until discarded (plan Assumptions); no automatic cleanup (plan Out of scope)
- dependency failure: C416 (Storage `PUT` fails or the network drops), C431 (Storage or database unavailable -> `unavailable`)
- state transitions: C406 (`uploading` -> `uploaded` only), C417 (`uploaded` stays put), C432 (any other status refused by the check)
- observability: C422, C431 (`console.error` with the object key, SQLSTATE or message); no metric or tracing requirement

## Handoff

- Read set measured with `wc -c` before building (ports, records and readers adapters with tests,
  stub client, composition and its test, the site register view and its test,
  `record-actions.ts`, `record-forms.test.ts`, the record form components, `fixture.sql`,
  `record_forms.sql`, the test-db runner, `CONTEXT.md`, `STATE.md`, `ROADMAP.md`): about 160 KB,
  about 40k tokens. This is an estimate taken from the record-forms read set, which overlaps it;
  the builder re-measures it.
- Written:
  - Migration: ~6 KB.
  - `domain/imports` and its test: ~6 KB.
  - Adapter, reader and their tests, stub-client additions: ~22 KB.
  - Ports and composition: ~3 KB.
  - Page, loading, actions and their tests: ~18 KB.
  - Import form, upload sequence, job list, discard control and their tests: ~26 KB.
  - `import_upload.sql` and the fixture additions: ~9 KB.
  - Docs: ~5 KB.
  - Total ~95 KB, about 24k tokens.
- Live validation (C414, C442, C443: three sizes, one journey plus the route rewrite) at about
  30k tokens of snapshots.
- S1-S4 plus doors: about 94k tokens in total, under the 150k budget, so one builder.
- Production-data note: the migration (new table, bucket and storage policies) is applied to the
  live project through MCP `apply_migration`, as every earlier migration was. The live journey's
  uploads are discarded through the UI, so it leaves nothing behind.

- Mechanism: one builder (estimate under budget, no ask).
- **Boundary:** C401-C413, C415-C441, C444 closed at `9a56de5` plus the docs commit after it (one builder). Not run yet: C414, C442 and C443 (live), because the Playwright MCP Chrome profile is held by another Playwright MCP server; ROADMAP Phase 2 item 1 is ticked only after them (C441 ROADMAP proof open).
- **Settled mid-build:**
  - Door 5 appended to the plan: `storage.foldername('<org>/<job>')` returns only the org, so the job id is read with `storage.filename(name)` through `private.uuid_or_null`.
  - The uploader's email comes from `created_by_email` (JWT default at insert), because no public table holds member emails; the plan's Assumptions row is corrected.
  - The migration was applied to the live project with the user's go-ahead (2026-10-26).
  - Earlier exact-inventory pins changed because this feature adds a table and a recipe: `rls_isolation` C35 now lists 16 public tables, `demo_seed_rerun` C19 expects 16 snapshot rows, and the runner tests C203-C212 and C210 count 11 recipes and 13 SQL files. Each still asserts an exact value.
  - The discard failure copy ("This import no longer exists.", "We couldn't discard the file. Try again.") is additive; the plan named only the upload failures.
- **Abandoned:** calling the start and confirm Server Actions from the submit handler outside a transition; the Next guide requires `startTransition` for event-handler calls, and outside it the refresh request was aborted.
- **Boundary (live):** C414, C442 and C443 closed in the commit after `555f05c`, signed in as the demo owner on "Brookhaven Community Centre", after the user approved stopping the other session's Chrome.
  - 1440x900: `.txt` -> extension message, 21 MB `.pdf` -> "Files can be up to 20 MB", 0 jobs added; `units.csv` and `units.pdf` uploaded (PUT 200 with `text/csv` / `application/pdf`), listed newest first as "Uploaded"; no horizontal scroll.
  - C443: object `imports/<demo org>/<job>` 113 bytes, `text/csv`, equal to the job's `size_bytes`.
  - C414: with `page.route` rewriting the PUT to `text/plain`, Storage answered 400 `{"statusCode":"415","error":"invalid_mime_type"}`; the page showed "The upload didn't finish. Try again." and the job "Upload not finished".
  - 768x1024 with touch: back link, picker, Upload, Discard and Cancel all 44 px tall; Cancel kept the job, the confirmed Discard removed it.
  - 375x812 with touch: "Import equipment list" link 164x44, back link 343x44, picker 309x44, Upload 73x44; touch uploads listed as "Uploaded"; four discards reached "No equipment lists imported yet"; no horizontal scroll.
  - Console: no error or warning on any size, apart from C414's deliberate 400 and Next's dev notice "rendering with server caches disabled", which appeared only while `page.route` was intercepting (interception disables the browser cache).
  - Network: no 4xx or 5xx apart from C414's. The start and confirm Server Action POSTs answer `200 text/x-component`, but the browser logs them as `net::ERR_ABORTED`, because Next's client stops reading an action stream once it has the return value when the action does not refresh. The discard action, which calls `refresh()`, completes normally.
  - Cleanup: SQL after the run shows 0 `import_jobs` rows for the demo org and 0 objects in `imports`.
