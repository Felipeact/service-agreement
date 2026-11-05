# Agreements page (ROADMAP Phase 3.5, item 9)


## Problem

Staff can only reach an agreement from the pipeline board or from a site page. The board drops withdrawn and voided agreements and hides an accepted agreement that has a live renewal, so there is no place to see every agreement, filter it by status or site, or find the ones whose term is ending. The sidebar "Agreements" item is greyed out, and the Pipeline "New agreement" button is disabled because creation needs a site and the board has none to offer. The roadmap gives no figures; none are invented.

After this ships: "Agreements" in the sidebar opens a filterable list, and "New agreement" on Pipeline and on that list starts an agreement for a chosen site.

## Flow

Reuses `createAgreementAction` / `AgreementStore.create` / RPC `create_agreement` untouched (inactive-site and one-live-per-site rules stay server-side), the `ShowInactiveToggle`/`EmptyPanel`/`Select`/`SearchInput` primitives, `STAGE_META`, and `EXPIRING_WINDOW_DAYS` for the "expiring" definition.

1. Sidebar "Agreements" -> `web/app/(app)/agreements/page.tsx` (new, placement) reads `searchParams` (`status`, `site`, `expiring`) -> `AgreementLister.list(filter)` (door 1).
2. `supabaseAgreementLister` (new, placement; sits in `readers.ts`) reads `agreements` + `sites(customers)` + latest version, applies the filters, caps at `ROW_CAP`.
3. `AgreementsView` (new, placement) renders rows linking to `/agreements/[agreementId]`.
4. "New agreement" (Pipeline header, enabled; also on this page) -> `/agreements/new` (new, placement): a site `Select` fed by `SiteLister` (door 2) -> `createAgreementAction(siteId)` (exists) -> redirect `/agreements/[id]`, or the existing `open_exists` link.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: *agreement list row* (`AgreementListRow`) - one row per agreement in any status, incl. withdrawn/refused/expired. Distinct from `PipelineCard`, which omits terminal and renewed rows. |
| domain | existing term: "expiring" stays = accepted, latest version `term_end` within 90 days. Pipeline `?view=expiring` branches on it today and is unchanged. |
| UI | Pipeline "New agreement" goes from disabled to a link. Sidebar "Agreements" gains `href`. |
| specs/tests that assert disabled | `nav-items.test.ts` C156, `pipeline-view.test.ts` C118, design-system-base C17/C21, staff-screens C118 must be amended in the same commits (their old claim is replaced, not weakened silently - recorded in the commit). |
| stored data | nothing to migrate; no schema change. |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /agreements` | `status` (stage key or status), `site` (uuid), `expiring=1`, `show=inactive` | list of rows: number, site, customer, status pill, version, annual total, updated, term end | 200, 307 to `/login` |
| `GET /agreements/new` | none | site picker; sites with a live agreement shown as links | 200, 307 to `/login`, forbidden panel for `viewer` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Filter contract in the URL | `/agreements?status=<key>&site=<uuid>&expiring=1` (status keys = AD-001 stage keys plus `refused`/`expired`/`withdrawn`) | Client-side filtering only: cannot be linked from the dashboard/pipeline and breaks at the 500-row cap. |
| 2. New read ports | `AgreementLister.list(filter)` and `SiteLister.listActive()` in `application/ports` | Extending `PipelineReader`: its contract deliberately drops terminal rows; widening it would change the board. |

- Nothing else is hard to reverse (no migration, no new dependency).

## Criteria

### S1: Browse and filter agreements (P1)

Staff open Agreements and see every agreement, narrowed by status, site or expiring.

**Acceptance Criteria**

1. WHEN a member opens `/agreements` THEN the system SHALL list every agreement of their org in any status, newest `updated_at` first, each row linking to `/agreements/{id}` and showing number, site, customer, status pill, version no. and annual total.
2. WHEN `status=<key>` is given THEN the system SHALL list only agreements with that status/stage.
3. WHEN `site=<uuid>` is given THEN the system SHALL list only that site's agreements.
4. WHEN `expiring=1` is given THEN the system SHALL list only accepted agreements whose latest version `term_end` is within 90 days of the Vancouver business day, showing the term end.
5. WHEN several filters are given THEN the system SHALL apply all of them (AND).
6. IF `status` is not a known key or `site` is not a uuid THEN the system SHALL ignore that filter and show the unfiltered rows.
7. IF the org has no agreements THEN the system SHALL show the "No agreements yet" empty panel; IF filters match nothing THEN it SHALL show "No agreements match" with a Clear filters link.
8. WHEN the sidebar renders THEN "Agreements" SHALL link to `/agreements` and be active on `/agreements` and `/agreements/*`.
9. WHILE the viewport is 375 px the system SHALL show the list without horizontal scroll and with 44 px touch targets.
10. IF the member is signed out THEN the system SHALL redirect to `/login`.

**Independent test:** open `/agreements?status=sent&expiring=1` in the demo org and see only matching rows; clear filters.

### S2: Start an agreement from the list/board (P1)

A writer picks a site and starts an agreement.

**Acceptance Criteria**

11. WHEN a writer (owner, admin, estimator) opens Pipeline THEN the "New agreement" button SHALL be enabled and link to `/agreements/new`.
12. WHEN `/agreements/new` renders THEN the system SHALL offer only active sites without a live agreement in a labelled `Select`, grouped by customer; sites with a live agreement SHALL appear as `AG-n` links instead.
13. WHEN a writer submits a site THEN the system SHALL call `createAgreementAction` and redirect to `/agreements/{id}`.
14. IF the site went inactive or gained a live agreement meanwhile THEN the system SHALL show the existing `messageFor` message / `open_exists` link (server rules unchanged).
15. WHILE the member's role is `viewer` the system SHALL hide "New agreement" and show a forbidden panel at `/agreements/new`.
16. IF there are no eligible sites THEN `/agreements/new` SHALL show an empty panel linking to Customers.

**Independent test:** estimator picks a fictitious demo site and lands on a draft `AG-n` builder.

## Out of scope

| Excluded | Why |
| --- | --- |
| Pagination / server-side search text | `ROW_CAP = 500` is the existing convention; text search is the Global search roadmap item. |
| Bulk actions, export | not on the roadmap |
| Sites & equipment, Imports, Task library pages | separate roadmap items |
| Changing the Pipeline board's rules or `?view=expiring` | unchanged by design |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Filters live in the URL, applied server-side | yes | linkable, survives the cap; mirrors `?view=` and `?show=` | n |
| Withdrawn/refused/expired shown by default | shown, narrowed via status filter | this is the only page where they are visible; no "Show inactive" analogue | n |
| Site picker is a page (`/agreements/new`), not a modal | page | server action + redirect fits; no dialog pattern exists in DESIGN.md | n |
| "Expiring" means the existing 90-day accepted-term definition | yes | one definition across Pipeline and list | n |
| No new migration; reads use the existing RLS | yes | no schema need found | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/agreements` | empty / no-match state | AC 7 |
| screen `/agreements` | loading | existing - per-route `loading.tsx` (add one) |
| screen `/agreements` | error | existing - route error boundary pattern of customers page |
| screen `/agreements` | unauthorised | AC 10 |
| screen `/agreements` | density, ordering | AC 1 |
| screen `/agreements/new` | empty / unauthorised | AC 15, 16 |
| screen `/agreements/new` | destructive action confirms | n/a - creating a draft is reversible (withdraw) |
| all new routes | API versioning, rate limits | n/a - server-rendered pages, no external consumer |

## Sources

- ROADMAP.md Phase 3.5 item 9 - scope of the page and the button.
- DESIGN.md:202, 247 - page-header layout; disabled-with-title rule (replaced here by an enabled button).
- `.specs/STATE.md` AD-001 (stage keys bound to URL params), AD-052/053 (live-agreement rule).
