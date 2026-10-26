# Import upload verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 0aec48f..f461e37 (round 1 covered 0aec48f..7c95641; round 2 added the fix range 7c95641..f461e37; round 3 has no new commits)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier) - a fresh sub-agent that did not write this code; read-only over the source tree. Live UI uploads and discards on one demo site were approved by the user on 2026-10-26 for round 3

All 44 checks now PASS with evidence from the Verifier's own runs. Round 3 re-scoped to the three non-PASS rows of round 2: C414, C442 and C443. After user approval, I ran those live proofs myself at f461e37 in the one existing signed-in browser context, against the dev server at `http://localhost:3000`. The demo site was "Brookhaven Community Centre" (`/sites/7a6378e8-6dc0-72c5-4272-7a84fdf010d4/import`, demo org `00000000-0000-4000-8000-00000000de30`). I used only fictitious files, and wrote only through the app's own upload and discard controls. Every SQL statement was a read-only `select`.

## Round 3 - live run by the Verifier (verified at f461e37)

- **Setup.** The browser context had one page, signed in as the demo owner. I resized only with `page.setViewportSize` and never opened a new context. Network and console were recorded with `page.on('response' | 'requestfailed' | 'console' | 'pageerror')` from before the first upload to the end. The script waited for `networkidle` before each resize, navigation and reload.
- **Start state** (SQL): `import_jobs` for the demo org 0, all `import_jobs` 0, `storage.objects` in `imports` 0.
- **Journey at each of 1440x900, 768x1024 and 375x812** (all three passed):
  - **Entry.** I opened the site, then clicked "Import equipment list". The import page's visible `h1` is "Brookhaven Community Centre", and it shows the empty state.
  - **Refusals, no job added.** `notes.txt` showed "Choose an Excel (.xlsx), CSV, Word (.docx) or PDF file". `big.pdf` (22,020,096 bytes) showed "Files can be up to 20 MB". Afterwards there were 0 visible jobs, and "No equipment lists imported yet" was still shown.
  - **Uploads.** I uploaded `units.csv` (113 bytes) and then `units.pdf` (193 bytes). Storage PUTs answered `200` with `content-type` `text/csv` / `application/pdf` and `x-upsert: false`. The list read `units.pdf | Uploaded` above `units.csv | Uploaded`, so newest first.
  - **Discards.**
    - On `units.pdf`, Discard showed "Discard units.pdf? The file will be deleted.". Cancel kept the job listed. Discard again, then confirm, removed it.
    - On `units.csv`, the prompt appeared and confirming removed it.
    - "No equipment lists imported yet" then showed.
  - **No horizontal scroll** (`scrollWidth <= clientWidth`) on the site page, after the uploads, with the prompt open, and in the empty state.
- **Target sizes below 1024 px** (measured, W x H in CSS px):

  | Size | Import link | Back link | Picker | Upload | Discard | Cancel | Confirm Discard |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | 768x1024 | 164x44 | 728x44 | 542x44 | 73x44 | 78x44 | 74x44 | 76x44 |
  | 375x812 | 164x44 | 343x44 | 309x44 | 73x44 | 78x44 | 74x44 | 76x44 |

  At 1440x900 the same controls are 34 px tall; the check sets no minimum at that width. Touch emulation is unavailable in this context (no `hasTouch`), so I used mouse clicks, not touch taps. The 44 px heights appear without touch emulation, so the sizing depends on viewport width, not on the pointer type.
- **C443 check**, run while both files were stored (after the 1440x900 uploads), joining `import_jobs` to `storage.objects` on `name = org_id || '/' || id`:
  - `units.csv`: status `uploaded`, `size_bytes` 113, object `metadata->>'size'` 113, `metadata->>'mimetype'` `text/csv`. 113 is the byte size of `units.csv` on disk.
  - `units.pdf`: 193 / 193 / `application/pdf`.
  - Both keys matched `<org>/<job>`, and both rows had `created_by_email` set.
- **C414** (at 1440x900). I set `page.route('**/storage/v1/object/upload/sign/**')` to rewrite the PUT's `content-type` to `text/plain`, then uploaded `units.csv`.
  - Storage answered **400** to the PUT sent with `text/plain`.
  - The page showed "The upload didn't finish. Try again." and kept `units.csv` chosen.
  - I then ran `unroute` and reloaded. The job was listed as `units.csv` / "Upload not finished".
  - SQL showed that job in status `uploading` with 0 objects.
  - I discarded it through the UI (prompt, then confirm), and the empty state showed.
  - Note: I read the "Upload not finished" label after a reload. The check does not say whether the label must appear without one.
- **Console**, `level` error and warning across the whole run: exactly one entry, `[ERROR] Failed to load resource: the server responded with a status of 400 ()` for C414's PUT (`.playwright-mcp/console-2026-10-26T21-05-28-910Z.log:17`). There were no warnings. All other entries are INFO/LOG (React DevTools and HMR).
- **Network**, per the amended C442 definition (a 4xx/5xx answer or a network error):
  - **4xx/5xx**: exactly one, C414's deliberate `PUT 400`.
  - **`requestfailed`**: 11 entries, all `net::ERR_ABORTED` after a `200` response had arrived.
    - 2 were Server Action POSTs (`next-action` header), which the amended wording excludes by name.
    - 9 were RSC GETs (`/import?_rsc=...`) the Next client dropped during navigation and refresh. Each had already answered `200`, so none was a 4xx/5xx or a network error. They are the same class as the excluded case, though the exclusion names only Server Action POSTs (see Findings).
- **End state** (SQL, read-only): `import_jobs` for the demo org **0**, all `import_jobs` **0**, `storage.objects` in `imports` **0**.

## Scope of round 2

- **Fix diff (7c95641..f461e37).** The commits are 5ab2486, 13b1cd2, 5bf40f4 and f461e37. They touch tests and docs only:
  - `web/components/imports/imports.test.ts`
  - `web/components/sites/sites.test.ts`
  - `web/infrastructure/supabase/imports.test.ts`
  - `.specs/features/import-upload/checks.md`
  - `.specs/features/import-upload/plan.md`

  `git diff --quiet 7c95641..HEAD -- web/app web/infrastructure/supabase/imports.ts web/components/imports/*.tsx web/components/imports/state.ts supabase` returned no changes. Application source, migrations and SQL tests are untouched.
- **checks.md wording diff over the range.** Only C403 and C442 changed, and the Handoff gained three bullets. No other check's wording changed.
- **plan.md diff.** The Surface row for `startImport` now follows C403, and Landing gained a row 6.
- **Re-judged:** every non-PASS verdict from round 1 (C403, C414, C442, C443), C401, C418, C420 and C427 whose tests changed, and round-1 findings 4 and 5.
- **Proofs re-run in full at f461e37.** Citations were refreshed in the three touched test files.
- **Everything else is `carried from 7c95641`.** Its claim, test and source are unchanged, and its proof re-ran green at f461e37.

## Binding sources

Profile is `light`, so step 1 (comparing the checks against the binding sources) does not run. The binding sources are ROADMAP.md Phase 2 item 1, "Asset import pipeline" step 1, and the 2026-10-26 user decisions.

## Checks

Proof runs at f461e37 (from `web/`):

- **V** = `npx vitest run components/sites components/imports "app/(app)" infrastructure/supabase domain/imports composition scripts/test-db -t "C401:|C402:|C403:|C404:|C406:|C407:|C408:|C409:|C410:|C411:|C412:|C415:|C416:|C417:|C418:|C419:|C420:|C421:|C422:|C424:|C425:|C426:|C427:|C430:|C431:|C433:|C434:|C436:|C444:|C203:|C204:|C205:|C210:|C211:|C212:" --reporter=verbose`: 98 passed, 0 failed. Every id appeared individually, including the new tests "C420: each job's Discard is bound to that job's id" and "C427: the compare-and-set matches no row and the job is gone -> not_found".
- **D** = `npm run test:db`: 11 passed, 0 failed, including `PASS import_upload`.
- **L** = `npm run lint`: exit 0.
- **B** = `npx next build`: exit 0, and the route list contains `/sites/[siteId]/import`.
- **T** = `npm test`: 39 files, 656 passed, 0 failed.

Path shorthands, as in round 1: **app-imports.test.ts** = `web/app/(app)/imports.test.ts`, and **comp-imports.test.ts** = `web/components/imports/imports.test.ts`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C401 | writer sees the Import equipment list link in the page header | V (verified at f461e37) | `web/components/sites/sites.test.ts:157-158` - `match(/<header[\s\S]*?<\/header>/)`, then `expect(header).toMatch(/<a[^>]*href="\/sites\/s1\/import"[^>]*>Import equipment list<\/a>/)`. Header placement is now asserted | PASS |
| C402 | import page h1, back link, accept, hint, Upload | V (carried from 7c95641) | comp-imports.test.ts:43-48 - `<h1>` site name, `href="/sites/s1"`, `accept=".xlsx,.csv,.docx,.pdf"`, hint, submit `Upload` | PASS |
| C403 | (amended) start called once with org/site/file; returns `{ status: "started", jobId, signedUrl, contentType }` with the store's values | V (verified at f461e37) | app-imports.test.ts:67-68 `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(ORG, SITE, { name: "Units.xlsx", size: 2048, contentType: XLSX })`; :69 `toEqual({ status: "started", jobId: JOB, signedUrl: started.signedUrl, contentType: XLSX })`. Matches the amended wording and the amended Surface row (`plan.md:76`) | PASS |
| C404 | adapter insert, `.select("id")`, sign `<org>/<job>` with no upsert, returns ok | V (carried from 7c95641) | `web/infrastructure/supabase/imports.test.ts:36`, :38-39, :41, :43 (`args: [KEY]`) | PASS |
| C405 | SQL estimator insert is uploading by uE; object insert succeeds | D (carried from 7c95641) | `supabase/tests/import_upload.sql:39-42` | PASS |
| C406 | compare-and-set to uploaded on id and status uploading | V (carried from 7c95641) | `web/infrastructure/supabase/imports.test.ts:76`, :80, :82-83 | PASS |
| C407 | contentTypeFor over 12 | V (carried from 7c95641) | `web/domain/imports/index.test.ts:22` `toBe(expected)` over the 12 rows at :8-20 | PASS |
| C408 | PUT headers come from the server's type and x-upsert false | V (carried from 7c95641) | comp-imports.test.ts:101-105 | PASS |
| C409 | uploading state of the button | V (carried from 7c95641) | comp-imports.test.ts:68-69 | PASS |
| C410 | reader order, limit; page keeps port order | V (carried from 7c95641; adapter lines shifted) | `web/infrastructure/supabase/imports.test.ts:170-172` `["eq", ["site_id", SITE]]`, `["order", ["created_at", { ascending: false }]]`, `["limit", [500]]`; comp-imports.test.ts:53 | PASS |
| C411 | validateImportFile edges and copy | V (carried from 7c95641) | `web/domain/imports/index.test.ts:35`, :39-44, :53, :57-58 | PASS |
| C412 | invalid returns status invalid with the message; no store call | V (carried from 7c95641) | app-imports.test.ts:78-79 | PASS |
| C413 | bucket: one row, private, 20971520, four types | D (carried from 7c95641) | `supabase/tests/import_upload.sql:16-24` | PASS |
| C414 | live: Storage refuses the rewritten content-type; page shows the failure | live, run by the Verifier in round 3 (verified at f461e37): `page.route` rewrite, upload `units.csv` at 1440x900 | Storage `PUT` answered `400` with `content-type: text/plain` (console `.playwright-mcp/console-2026-10-26T21-05-28-910Z.log:17`); the page showed "The upload didn't finish. Try again."; the job was listed "Upload not finished" (read after `unroute` and a reload); SQL showed `uploading` with 0 objects; it was discarded through the UI | PASS |
| C415 | upload_missing when the object is missing or its size is off by 1 | V (carried from 7c95641) | `web/infrastructure/supabase/imports.test.ts:92-93` | PASS |
| C416 | PUT failure or upload_missing gives upload_failed; copy and name kept | V (carried from 7c95641) | comp-imports.test.ts:115-116, :125, :74-75 | PASS |
| C417 | repeated confirm is ok and writes nothing else | V (carried from 7c95641) | `web/infrastructure/supabase/imports.test.ts:99-102` | PASS |
| C418 | per job: name, size, uploader or Former member, date, label | V (verified at f461e37) | comp-imports.test.ts:163 `rows).toHaveLength(4)`; :171 `expect(rows[index], ...).toContain(text)` per row for name, size, uploader, label and "Oct 26, 2026"; :173 `rows[0]).not.toContain("Upload not finished")`; `web/domain/imports/index.test.ts:69` the exact formatFileSize edges. Values are now tied to their row | PASS |
| C419 | empty list copy | V (carried from 7c95641; line shifted) | comp-imports.test.ts:183 `toContain("No equipment lists imported yet")` | PASS |
| C420 | prompt states; only the confirm submits the discardImport form | V (verified at f461e37) | comp-imports.test.ts:190-192 unconfirmed: type=button Discard, no prompt, no `<form`; :197-200 prompt copy, one submit Discard, Cancel, `match(/type="submit"/g)).toHaveLength(1)`; :179 `discard.mock.calls.map(([id]) => id)).toEqual(["a", "b"])`, so each job's Discard is bound to its own job id | PASS |
| C421 | delete row then remove key; ok | V (carried from 7c95641; lines shifted) | `web/infrastructure/supabase/imports.test.ts:131-136` - `toEqual({ ok: true })`, `["id", JOB]`, `["id, org_id"]`, `remove` with `[[KEY]]`, delete before remove | PASS |
| C422 | remove error still ok; key logged | V (carried from 7c95641; lines shifted) | `web/infrastructure/supabase/imports.test.ts:143-145` | PASS |
| C423 | SQL deletes 1 row and 1 object | D (carried from 7c95641) | `supabase/tests/import_upload.sql:129-131` | PASS |
| C424 | viewer: no controls; no link | V (carried from 7c95641; sites lines shifted) | comp-imports.test.ts:58-61; `web/components/sites/sites.test.ts:163-164` | PASS |
| C425 | viewer forbidden on all 3; copy | V (carried from 7c95641) | app-imports.test.ts:110-111; comp-imports.test.ts:79 | PASS |
| C426 | notFound for non-uuid and for a null site | V (carried from 7c95641) | app-imports.test.ts:145 | PASS |
| C427 | non-uuid id gives not_found with no store call; adapter not_found when update/delete hits no row and the job is not readable | V (verified at f461e37) | app-imports.test.ts:120-121; `web/infrastructure/supabase/imports.test.ts:116` (new: compare-and-set hits no row, then the re-read is null, gives `toEqual({ ok: false, code: "not_found" })`, which exercises `web/infrastructure/supabase/imports.ts:82-83`); :122 initial read null; :151 delete with no row | PASS |
| C428 | SQL other org and anon refused | D (carried from 7c95641) | `supabase/tests/import_upload.sql:106`, :110, :112, :119, :120 | PASS |
| C429 | SQL insert refusals, viewer, no update | D (carried from 7c95641) | `supabase/tests/import_upload.sql:87`, :97, :90 | PASS |
| C430 | form overrides ignored | V (carried from 7c95641) | app-imports.test.ts:91-94 | PASS |
| C431 | error mapping, logging, copy | V (carried from 7c95641) | `web/infrastructure/supabase/imports.test.ts:57-59`, :66-68; comp-imports.test.ts:83 | PASS |
| C432 | SQL import_jobs rules | D (carried from 7c95641) | `supabase/tests/import_upload.sql:50`, :53-54, :61, :67, :70 | PASS |
| C433 | container, ports, no adapter import in UI | V + L (carried from 7c95641) | `web/composition/composition.test.ts:87`, :94-96; `web/eslint.config.mjs:74-85`; lint exit 0 | PASS |
| C434 | loading h1 and status | V (carried from 7c95641) | app-imports.test.ts:159-160 | PASS |
| C435 | build exit 0 with the route | B (re-run at f461e37) | exit 0; route listed; `web/app/(app)/sites/[siteId]/import/page.tsx:1` | PASS |
| C436 | signed out gives 307 to /login | V (carried from 7c95641) | `web/infrastructure/supabase/session.test.ts:139-140` | PASS |
| C437 | migration and types | shell (carried from 7c95641) | count `1`; types count `3`; `supabase/migrations/20261026200326_import_upload.sql:8`, :34, :51 | PASS |
| C438 | test:db with no argument runs import_upload; tenant_tables | D + shell (re-run at f461e37) | D exit 0 with `PASS import_upload`; `web/scripts/test-db/runner.mts:39`; `supabase/tests/fixture.sql:16` | PASS |
| C439 | whole Vitest suite | T (re-run at f461e37) | 656 passed, 0 failed; e.g. `web/scripts/test-db/runner.test.ts:117` `connects).toBe(11)` | PASS |
| C440 | advisors are exactly the two accepted findings | MCP `get_advisors` security, re-executed by the Verifier at round 1 (read-only); the result is now also recorded in the Handoff | exactly `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection`. The claim is at `.specs/features/import-upload/checks.md:279`. The fix range changed no SQL, so carried from 7c95641 | PASS |
| C441 | STATE AD rows, CONTEXT, ROADMAP | shell (carried from 7c95641) | `.specs/STATE.md:37-40`; `CONTEXT.md:65`; `ROADMAP.md:107` | PASS |
| C442 | (amended) full journey at each size, refusals at each size, 44 px below 1024, clean console, no failed request (4xx/5xx or network error) except C414's, 0 rows and 0 objects after | live, run by the Verifier in round 3 (verified at f461e37) at 1440x900, 768x1024 and 375x812; SQL counts read-only | at each size: both refusals with 0 jobs added; `units.csv` and `units.pdf` both "Uploaded", newest first; both discarded after the prompt (Cancel kept the job); empty state; no horizontal scroll. Every touched control is 44 px tall at 768 and 375 (measured with clicks; touch emulation unavailable). Console: only C414's 400 (`.playwright-mcp/console-2026-10-26T21-05-28-910Z.log:17`), no warnings. Network: the only 4xx/5xx is C414's PUT; 11 `ERR_ABORTED` after a 200 response (2 Server Action POSTs, 9 RSC GETs), none a 4xx/5xx or a network error. SQL end state: 0 demo-org `import_jobs`, 0 `imports` objects | PASS |
| C443 | live: object size and text/csv | live journey plus read-only SQL by the Verifier in round 3 (verified at f461e37), while the files were stored | `storage.objects` at `imports/<demo org>/<job>`: `metadata->>'size'` 113 = `units.csv` on disk (113 bytes) = `size_bytes`; `metadata->>'mimetype'` `text/csv`; the Storage PUT answered 200 | PASS |
| C444 | asset rows and Add asset still present | V (carried from 7c95641; lines shifted) | `web/components/sites/sites.test.ts:169-170` | PASS |

## Earlier-feature tests changed in range

Carried from 7c95641; the fix range does not touch these files. None was weakened, and each still pins an exact value:

- `supabase/tests/rls_isolation.sql:13-17` (C35): exact array equality, 16 tables.
- `supabase/tests/demo_seed_rerun.sql:7` (C19): exactly `= 16`. The per-table loop now covers `import_jobs`.
- `web/scripts/test-db/runner.test.ts:117-237`: exact counts of 11 recipes and 13 files, with the recipe order still asserted.

## Plan consistency

Verified at f461e37.

- **Door 5** (`.specs/features/import-upload/plan.md:89`) still matches the migration: `supabase/migrations/20261026200326_import_upload.sql:63-66` (`uuid_or_null`), :78 (the `array_length` check) and :82 (`storage.filename`).
- **Assumptions row** (`plan.md:184`) matches migration line 21.
- **Round-1 finding 5 is closed.** The new Landing row 6 (`plan.md:90`) records `created_by_email` and the `original_name`, `content_type` and `size_bytes` checks. They match migration lines 12-21.
- **Surface row** for `startImport` (`plan.md:76`) now matches `web/app/(app)/import-actions.ts:32`.

## Swept existing re-read

Carried from 7c95641. `canWriteRecords` is present at `web/components/records/state.ts:14-15` and asserted for all four roles at `web/components/records/records.test.ts:91-94`.

## Findings

1. **Closed in round 3:**
   - C414, C442 and C443 are now proven by the Verifier's own live run, not by the author's record.
   - Round-2 finding 1(b) is resolved: `units.pdf` was uploaded and listed newest first at every size.
   - Round-2 finding 1(a) no longer applies: the script waited for `networkidle`, so it cut off none of its own requests.
2. **Precision gap in C442's amended wording (non-failing).** `.specs/features/import-upload/checks.md:300` defines a failed request as "a 4xx or 5xx answer or a network error", and excludes by name only the `ERR_ABORTED` "on a Server Action POST".
   - The live run also shows 9 RSC GETs (`/import?_rsc=...`) that Next's client dropped after a `200` response had arrived.
   - They meet neither branch of the definition: no 4xx/5xx, and the response arrived, so this is not a network error. I judge them outside "failed".
   - The wording should still name this case explicitly, so a later run does not have to argue it.
3. **Limitations of the live run (non-failing):**
   - **No touch.** Touch emulation is unavailable in this context, so "touch taps on mobile and tablet" were mouse clicks. The 44 px sizes were measured without touch emulation, so they do not depend on the pointer type.
   - **Label read after a reload.** C414's "Upload not finished" label was read after a reload; the check does not say whether the list must update without one.
4. **Closed in round 2:**
   - C403: the check was amended, and the assertion at app-imports.test.ts:69 matches it.
   - Round-1 finding 4: the C440 result is now recorded in the Handoff.
   - Round-1 finding 5: the plan's Landing row 6 was added.
   - Round-1 gaps for C401 (`web/components/sites/sites.test.ts:157-158`), C418 (comp-imports.test.ts:163-173), C420 (comp-imports.test.ts:179) and C427 (`web/infrastructure/supabase/imports.test.ts:113-117`).

## Gate

All at f461e37:

- **Round 3 live run.** The journey passed at 3 sizes, and C414 and C443 passed. Final SQL: 0 demo-org `import_jobs`, 0 `import_jobs` overall, 0 objects in `imports`.
- **Round 2 runs** (no commits since, so they still hold):

- `npx vitest run ... -t "<35 ids>"`: 98 passed, 0 failed.
- `npm test`: 656 passed, 0 failed.
- `npm run test:db`: 11 passed, 0 failed.
- `npm run lint`: exit 0.
- `npx next build`: exit 0.
- `git status --porcelain`: only this report, untracked.
