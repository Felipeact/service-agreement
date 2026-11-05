# Imports page - checks

Profile: light
Plan: `.specs/features/imports-page/plan.md`

20 checks in 3 slices · 1 one-way door · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1387:`). This feature numbers
  from C1387, because sites-page owns up to `C1386:`.
  - The pure filter is tested in `domain/imports/index.test.ts` (existing file).
  - The reader is tested in `infrastructure/supabase/imports.test.ts` with the recording `stubClient`.
  - The view is asserted with `renderToStaticMarkup` in `components/imports/import-history.test.ts` (new file).
  - The page is tested in `app/(app)/imports-history.test.ts` (new file), in the style of `app/(app)/sites-list.test.ts`.
  - The sidebar is asserted in `components/shell/nav-items.test.ts`.
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context) at 375, 768
  and 1440 px, recorded in the Handoff.
- No migration and no SQL test: the plan changes no stored shape, and RLS is untouched.

Terms:
- "the fixture jobs" are import jobs of one org, one per `ImportJobStatus` (7: `uploading`, `uploaded`, `parsed`,
  `unreadable`, `extracting`, `extracted`, `committed`), on two sites of two customers.
- "the seven statuses" is that list, in that order.
- "writer" and "viewer" are not used: the page is read-only and shows the same to every role.
- Replaced assertion: the plan's `Impact` row authorizes replacing the claim "Imports has no href" (the
  `C156: %s has no page yet` list in `nav-items.test.ts`, which loses "Imports") and adding "Imports" to the link list.
  It is edited in the commit that changes the behaviour, and the commit message names it. No other test is edited.

## Checks

### S1 - browse every import job · 9 files · ~110 KB · ~28k

**C1387** - `ImportHistory.list({})` returns one row per job, newest first, each carrying the job's `id`,
`originalName`, `sizeBytes`, `status`, `uploadedBy`, `createdAt`, `outcome`, `extraction`, plus
`site: { id, name }` and `customer: { id, name }`; the query orders `created_at` descending and limits to 500 (AC 1, door 1)
Proof: `npx vitest run infrastructure/supabase/imports.test.ts -t "C1387:"` in `web/`

**C1388** - For the fixture jobs the reader fills the outcome as `forSite` does: `parsed` has `outcome` with tables and
rows, `unreadable` has `outcome` with its reason, `extracting` has `extraction` with cursor and total, `extracted` has
`extraction` with the rows and unmatched counts from `import_row_counts`, `committed` has `committed` with added and
skipped (AC 2)
Proof: `npx vitest run infrastructure/supabase/imports.test.ts -t "C1388:"` in `web/`

**C1389** - The outcome line of a row is, per status: `uploading` and `uploaded` none; `parsed` "n tables, m rows" as
the site page prints it; `unreadable` the message of its reason; `extracting` "n of m"; `extracted` the extracted
summary; `committed` the added-and-skipped summary (7 statuses, table-driven) (AC 2)
Proof: `npx vitest run components/imports/import-history.test.ts -t "C1389:"` in `web/`

**C1390** - A row's status pill reads `Upload not finished`, `Uploaded`, `Read`, `Can't read`, `Extracting`,
`Extracted`, `Added to site` for the seven statuses; "Review rows" links to `/imports/{id}` for `extracted` and
`committed` only, and the other five show "Open on site" linking to `/sites/{siteId}/import` (7 statuses,
table-driven) (AC 1, 3)
Proof: `npx vitest run components/imports/import-history.test.ts -t "C1390:"` in `web/`

**C1391** - A row's site name links to `/sites/{siteId}` and its customer name to `/customers/{customerId}`; an
`uploadedBy` of null prints "Former member" (AC 1, 4)
Proof: `npx vitest run components/imports/import-history.test.ts -t "C1391:"` in `web/`

**C1392** - The page markup carries no "Read file", "Extract equipment" or "Discard" control and no `<button>` other
than the filter form's submit, for a list of the seven statuses (AC 7)
Proof: `npx vitest run components/imports/import-history.test.ts -t "C1392:"` in `web/`

**C1393** - `MAIN_NAV` "Imports" has `href` `/imports`; "Task library" still has none (AC 5)
Proof: `npx vitest run components/shell/nav-items.test.ts -t "C1393:"` in `web/`

**C1394** - On `/imports` and `/imports/j-1` the Imports item is current (`aria-current="page"`); on `/pipeline` and
`/sites` it is not (4 paths) (AC 5)
Proof: `npx vitest run components/shell/nav-items.test.ts -t "C1394:"` in `web/`

**C1395** - A signed-out request to `/imports` redirects to `/login` and nothing is read (AC 6)
Proof: `npx vitest run "app/(app)/imports-history.test.ts" -t "C1395:"` in `web/`

**C1396** - The page passes the parsed filter to the history reader, fills the site filter from the site list, and
renders the view; the container exposes `listImportHistory` (AC 1, 10)
Proof: `npx vitest run "app/(app)/imports-history.test.ts" -t "C1396:"` in `web/`
Proof: `npx vitest run composition/composition.test.ts -t "C1396:"` in `web/`

### S2 - narrow the history · 5 files · ~45 KB · ~12k

**C1397** - `parseImportFilter` keeps `status` for each of `uploaded`, `parsed`, `unreadable`, `extracting`,
`extracted`, `committed`, `attention` (7 values, table-driven) (AC 8, 9, 11)
Proof: `npx vitest run domain/imports/index.test.ts -t "C1397:"` in `web/`

**C1398** - `parseImportFilter` drops a `status` of `uploading`, `bogus`, an empty string, a repeated parameter and
`undefined`, and drops a `site` that is not a uuid; a valid uuid is kept; both valid values give
`{ status, siteId }` (AC 10, 11)
Proof: `npx vitest run domain/imports/index.test.ts -t "C1398:"` in `web/`

**C1399** - A filter `status` of each of the six statuses adds `eq("status", <status>)` to the query (6 statuses,
table-driven); no `status` adds no status clause (AC 8)
Proof: `npx vitest run infrastructure/supabase/imports.test.ts -t "C1399:"` in `web/`

**C1400** - A filter `status` of `attention` adds `in("status", ["uploading", "unreadable"])` and no `eq` on status (AC 9)
Proof: `npx vitest run infrastructure/supabase/imports.test.ts -t "C1400:"` in `web/`

**C1401** - A filter `siteId` adds `eq("site_id", <id>)`; with a `status` as well, both clauses are on the same query (AC 10)
Proof: `npx vitest run infrastructure/supabase/imports.test.ts -t "C1401:"` in `web/`

**C1402** - With no rows and no filter the view shows "No imports yet" and a link to `/sites` (AC 12)
Proof: `npx vitest run components/imports/import-history.test.ts -t "C1402:"` in `web/`

**C1403** - With no rows and a filter the view shows "No imports match these filters" and a "Clear filters" link whose
`href` is `/imports`; with rows and no filter there is no "Clear filters" (AC 12)
Proof: `npx vitest run components/imports/import-history.test.ts -t "C1403:"` in `web/`

**C1404** - The filter form is a GET to `/imports` with a status select of 8 options (All statuses and the seven
filter values, labelled) and a site select of "All sites" plus the sites given; the selected options follow the
filter (AC 8, 9, 10)
Proof: `npx vitest run components/imports/import-history.test.ts -t "C1404:"` in `web/`

### S3 - fit on a phone, live · live

**C1405** - `/imports` at 375, 768 and 1440 px has no horizontal scroll and no overlapping boxes, and at 375 and
768 px every control and row link is at least 44 px high (AC 13)
Proof: live, recorded in the Handoff (author-side Playwright, one signed-in context)

**C1406** - Signed in, `/imports` lists the org's jobs with the sidebar item current, the status and site filters
narrow it through the form, "Clear filters" returns to all, and the console has no errors (AC 1, 5, 8, 10, 12)
Proof: live, recorded in the Handoff (author-side Playwright, one signed-in context)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `ImportJobStatus` -> outcome line (7) | C1389, table-driven over all 7 | - |
| `ImportJobStatus` -> label and link (7) | C1390, table-driven over all 7 | - |
| `ImportJobStatus` -> reader outcome fields (5 with one) | `parsed` C1388 · `unreadable` C1388 · `extracting` C1388 · `extracted` C1388 · `committed` C1388 | - |
| `status` filter values (7) | C1397, table-driven over all 7 | - |
| invalid `status`/`site` inputs (6) | `uploading` C1398 · `bogus` C1398 · empty C1398 · repeated C1398 · `undefined` C1398 · non-uuid site C1398 | - |
| status filter -> query clause (7) | `uploaded` C1399 · `parsed` C1399 · `unreadable` C1399 · `extracting` C1399 · `extracted` C1399 · `committed` C1399 · `attention` C1400 | - |
| `GET /imports` statuses (2) | 200 C1396 · 307 to `/login` C1395 | - |
| `ImportHistory` port (door 1) (2) | shape and query C1387 · URL contract C1397 | - |
| empty states (2) | none at all C1402 · none match C1403 | - |
| sidebar item (2 behaviours) | href C1393 · current on `/imports*` C1394 | - |
| widths (3) | 375 C1405 · 768 C1405 · 1440 C1405 | - |

- Claims naming a status code, route or response shape: C1395 and C1396 - each calls the page function with
  `next/navigation` mocked; the 200 and the redirect are seen live (C1406), accepted under `light`
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1397, C1398
- failure modes: existing - the reader throws through `unexpected` and the segment's `error.tsx` renders, as the sites page
- idempotency: n/a - a read-only page changes nothing
- authorization: C1395, existing - `import_jobs` select policy is org-member (AD-031), so another org's jobs never come back
- concurrency: n/a - one read per request, nothing is written
- data lifecycle: n/a - the page lists the 500 newest jobs; deletion and retention are unchanged
- dependency failure: existing - one database dependency, handled by the same error boundary
- state transitions: C1390 - the page only reads statuses; none is written
- observability: n/a - no logging requirement in this slice

## Out of scope

- Uploading from this page - needs a site; stays on the site import page
- Read, extract and discard controls - history is read-only (C1392)
- Search, date range, uploader filter, sorting, pagination, export
- Retrying a failed job

## Handoff

- Read set, measured with `wc -c`: `ports/index.ts` 34.6 KB, `imports.ts` 16.6 KB, `imports.test.ts` 15.6 KB,
  `composition/index.ts` 9.9 KB, `job-list.tsx` 4.3 KB, `sites-list.tsx` 6.5 KB (pattern), `domain/imports/index.ts`
  13.9 KB, plus the nav files, page tests and `sites/page.tsx`: about 115 KB, about 29k tokens, plus the new files.
- S1 ~28k, S2 ~12k, live ~6k. About 46k against the 150k budget, all in one surface (the web app, no migration) -
  one builder, no ask.
- Mechanism: one builder.
- Before the last commit the builder also runs `npm test`, `npm run lint` and `npx tsc --noEmit` in `web/` and reviews
  `git diff <feature base>..HEAD -- "*.test.ts"` against the Terms. This is a hygiene gate, not a check.
- Plan `Flow` is kept true in the build: the site filter options come from the site directory read with inactive sites
  included (a job can belong to an inactive site), and `STATUS_LABELS` and `outcomeLine` are exported from
  `job-list.tsx` instead of copied.

- **Boundary:** C1387-C1404 closed at `967f584` (`3ad4fe5` reader, filter and port; `967f584` view, page, nav); C1405 and C1406 run live (below)
- **Settled mid-build:**
  - The site filter options come from `SiteDirectory.list({ showInactive: true })`, labelled `Customer · Site`; `STATUS_LABELS`, `outcomeLine`, `REVIEWABLE`, `ATTENTION` and `date` are exported from `job-list.tsx`. Plan `Flow` updated in `3ad4fe5`.
  - C1389's claim text says `parsed` prints "n tables, m rows"; the site page, which the claim defers to ("as the site page prints it"), prints "15 rows in 2 tables", and the test asserts that.
  - The form sends an empty `site=` when no site is picked; `parseImportFilter` drops it (C1398 covers a non-uuid).
  - The refactor shared `jobViews` between `forSite` and the history; the uuid guard of `forSite` was restored after the first cut dropped it.
- **Live C1406 (1440 px, one signed-in context):** `/imports` lists 3 jobs (all "Added to site") across two sites, the sidebar Imports item is current. Status `Added to site` through the form gave `/imports?status=committed&site=`, still 3 rows; `Needs attention` gave the no-match state; "Clear filters" returned to `/imports` with 3 rows. Console: no errors. The demo org has no job in another status, so the other pills and the Open on site link were proven by test only.
- **Live C1405:** 375, 768 and 1440 px: no horizontal scroll (scrollWidth equals clientWidth at each); at 375 and 768 px no control or link under 44 px high and zero overlapping boxes among links, selects and buttons; at 1440 px controls are 34 px and links 19 px, the same desktop sizing as Sites and Agreements.
- **Abandoned:** nothing.
