# Imports page (ROADMAP Phase 3.5, item 11)

## Problem

Import jobs can be reached only from one site's import page (`/sites/[siteId]/import`) or by a direct link to a job. The sidebar "Imports" item is greyed out and there is no `/imports` index. To find an upload that failed to read, an extraction left half done, or a list that was never added to its site, staff must open sites one at a time. The roadmap gives no figures; none are invented.

After this ships: "Imports" opens one history of every import job across sites, newest first, with its site, customer, status and outcome, filterable by status and site, with a link to review the rows or to continue on the site's import page.

## Flow

Reuses `ImportJobView` and the row mapping in `supabaseImportJobReader` (`infrastructure/supabase/imports.ts`: `outcomeFrom`, `extractionFrom`, `commitFrom`, the `import_row_counts` view), `STATUS_LABELS`, `outcomeLine` and the `REVIEWABLE` set from `job-list.tsx`, the `ROW_CAP` / `unexpected` conventions, the `SitesListView` GET-form + grid pattern, `EmptyPanel`, `PageHeader`, `StatusPill`, `PageLoading`, and `/imports/[jobId]`, `/sites/[siteId]/import`, `/sites/[siteId]`, `/customers/[customerId]` as link targets (AD-024, AD-049).

1. Sidebar "Imports" -> `web/app/(app)/imports/page.tsx` (new, placement) reads `searchParams` (`status`, `site`) -> `parseImportFilter` (new, pure, `web/domain/imports`) -> `ImportHistory.list(filter)` (door 1), and the site list (exists, `SiteLister`) for the site filter options.
2. `supabaseImportHistory` (new, placement, in `imports.ts`) selects `import_jobs` with `sites(id, name, customers(id, name))`, filters by status and site in the query, orders `created_at desc`, caps at `ROW_CAP`, reads `import_row_counts` for extracted and committed jobs, and maps each row through the existing mapping.
3. `ImportHistoryView` (new, placement, `web/components/imports/`) renders one row per job: file name, status pill, size, uploader, date, outcome line, site and customer links, "Review rows" for extracted and committed jobs, and "Open on site" to `/sites/[siteId]/import` otherwise. No read, extract or discard controls.
4. Nav: `MAIN_NAV` "Imports" gains `href: "/imports"` (exists); active on `/imports` and `/imports/*`.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: *import history row* (`ImportHistoryRow`): an `ImportJobView` plus its site (id, name) and customer (id, name). The per-site job list keeps `ImportJobView` alone. |
| domain | existing term "status": the seven `ImportJobStatus` values and their labels are unchanged; the filter adds one group, "Needs attention" = `uploading` + `unreadable` (the set `job-list.tsx` already marks `ATTENTION`). |
| UI | sidebar item gains an href; the `nav-items.test.ts` list of items with no page yet drops "Imports" and the link list gains it in the same commit. The shell's active rule must make `/imports/*` (the review grid) light the item. DESIGN.md's disabled-item note is updated. |
| stored data | nothing to migrate; no schema change, no migration, no type regeneration. |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /imports` | `status` (one status or `attention`), `site` (uuid) | rows: file name, status pill, size, uploader, date, outcome line, site, customer, review or site-import link | 200, 307 to `/login` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Filter contract in the URL and a new read port | `/imports?status=<uploaded\|parsed\|unreadable\|extracting\|extracted\|committed\|attention>&site=<uuid>`; `ImportHistory.list(filter): Promise<ImportHistoryRow[]>` in `application/ports` | Widening `ImportJobReader.forSite` to an optional site: its contract is "this site's jobs" and the site page and its tests bind to it. Client-side filtering: cannot be linked from a site page and breaks at the 500-row cap. |

- Nothing else in this change is hard to reverse (no migration, no dependency). The `uploading` status is not its own filter value; it is reachable through `attention`.

## Criteria

### S1: Browse every import job (P1)

Staff open Imports and see the history of uploads across all sites.

**Acceptance Criteria**

1. WHEN a member opens `/imports` THEN the system SHALL list the org's import jobs newest first, at most 500, each row showing file name, status label, size, uploader (or "Former member"), date, site and customer.
2. The system SHALL show each row's outcome line exactly as the site import page does (read counts, "n of m" while extracting, extracted counts, added and skipped counts, or the unreadable reason).
3. WHERE a job is `extracted` or `committed` the row SHALL link "Review rows" to `/imports/{id}`; otherwise it SHALL link "Open on site" to `/sites/{siteId}/import`.
4. The system SHALL link each row's site to `/sites/{siteId}` and its customer to `/customers/{customerId}`.
5. WHEN the sidebar renders THEN "Imports" SHALL link to `/imports` and be active on `/imports` and `/imports/*`.
6. IF the member is signed out THEN the system SHALL redirect to `/login`.
7. The system SHALL show no read, extract or discard control on this page, for any role.

**Independent test:** open `/imports` in the demo org and see jobs from several sites.

### S2: Narrow the history (P1)

**Acceptance Criteria**

8. WHEN `status=<one status>` is given THEN the system SHALL list only jobs in that status.
9. WHEN `status=attention` is given THEN the system SHALL list only `uploading` and `unreadable` jobs.
10. WHEN `site=<uuid>` is given THEN the system SHALL list only that site's jobs; WHEN both filters are given it SHALL apply both (AND).
11. IF `status` is not one of the listed values, or `site` is not a uuid, THEN the system SHALL ignore it.
12. IF the org has no import jobs THEN the system SHALL show a "No imports yet" empty panel linking to Sites & equipment; IF filters match nothing THEN the system SHALL show "No imports match these filters" with a Clear filters link.

**Independent test:** `/imports?status=attention&site=<id>`, then Clear filters.

### S3: Fit on a phone (P2)

**Acceptance Criteria**

13. WHILE the viewport is 375 px the system SHALL show the list without horizontal scroll and with 44 px touch targets.

**Independent test:** open `/imports` at 375 px.

## Out of scope

| Excluded | Why |
| --- | --- |
| Uploading from this page | an upload needs a site; stays on `/sites/[siteId]/import` |
| Read, extract and discard on this page | history is read-only; the writer controls stay on the site import page |
| Text search, date range, uploader filter, sorting, pagination, export | not on the roadmap; `ROW_CAP = 500` convention. Global search is its own item |
| Retrying or re-running a failed job | not on the roadmap |
| Schema or RLS changes | none needed |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Jobs of deactivated sites and customers stay listed, with no Inactive pill and no toggle | listed | history must stay readable (Deactivation rule) | n |
| "Needs attention" is `uploading` + `unreadable` | yes | the same set `job-list.tsx` already marks | n |
| Filters applied server-side via a GET form, like Agreements and Sites | yes | linkable from a site page, matches AD-120 and AD-122 | n |
| Viewers see the page (read-only, no write control exists on it) | yes | select policy is org-member | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/imports` | empty / no-match | AC 12 |
| screen `/imports` | loading | existing - add `loading.tsx` with `PageLoading` |
| screen `/imports` | error | existing - the reader throws via `unexpected`, as the sites page |
| screen `/imports` | unauthorised | AC 6 |
| screen `/imports` | density, ordering | AC 1, 2 |
| screen `/imports` | destructive action | AC 7 |
| `GET /imports` | versioning, rate limits | n/a - server-rendered, no external consumer |

## Sources

- ROADMAP.md Phase 3.5 item 11 - scope.
- `.specs/STATE.md` AD-023 (narrow ports, 500 cap), AD-024 (flat URLs), AD-044 (counts from `import_row_counts`), AD-049 (a later Imports list links to a job knowing only its id), AD-120 to AD-122 (URL filter and lister pattern).
