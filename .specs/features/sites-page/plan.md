# Sites & equipment page (ROADMAP Phase 3.5, item 10)

## Problem

Staff can reach a site only through its customer's page or a link from an agreement or an import. The sidebar "Sites & equipment" item is greyed out, and there is no `/sites` index. To find a site, or to see which sites have no equipment or no live agreement, staff must open customers one at a time. The roadmap gives no figures; none are invented.

After this ships: "Sites & equipment" opens one list of every site across customers, with its equipment summary and live agreement, filterable by customer and by text.

## Flow

Reuses `ROW_CAP`, `isActive`, `byName`, `unexpected`, `LIVE_STATUSES` and the embedded-select style in `readers.ts`; `showInactive()` + `ShowInactiveToggle`; the `AgreementsListView` GET-form + grid pattern; `EmptyPanel`, `PageHeader`, `StatusPill`, `PageLoading`; `/sites/[siteId]` and `/customers/[customerId]` as link targets (AD-024).

1. Sidebar "Sites & equipment" -> `web/app/(app)/sites/page.tsx` (new, placement) reads `searchParams` (`q`, `customer`, `show`) -> `parseSiteFilter` (new, pure, `web/domain/records`) -> `SiteDirectory.list(filter)` (door 1).
2. `supabaseSiteDirectory` (new, placement, in `readers.ts`) selects `sites` with `customers(id, name, deactivated_at)`, `assets(deactivated_at, asset_types(code))`, `agreements(id, number, status)`; filters in memory; caps at `ROW_CAP`.
3. `SitesListView` (new, placement, `web/components/sites/`) renders rows linking to `/sites/[siteId]`, customer links to `/customers/[customerId]`.
4. Nav: `MAIN_NAV` "Sites & equipment" gains `href: "/sites"` (exists); active on `/sites` and `/sites/*`.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: *site list row* (`SiteListRow`): one site with customer, active asset count, equipment-type summary, live agreement, active flag. Distinct from `SiteOption` (active sites for the agreement picker) and `SiteView` (one site's register). |
| domain | existing term "active": a site is shown active only when it and its customer are not deactivated (AD-116); counts include active assets only. Callers branching on it today: customers list/detail, `SiteLister`. Unchanged. |
| UI | sidebar item gains an href; `nav-items.test.ts` C156 ("has no page yet") must drop this item and add it to the link list in the same commit. DESIGN.md's disabled-item note is updated. |
| stored data | nothing to migrate; no schema change, no migration, no type regeneration. |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /sites` | `q` (text), `customer` (uuid), `show=inactive` | rows: site, address, customer, active asset count, top equipment types, live agreement `AG-n` + status pill, "Inactive" pill | 200, 307 to `/login` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Filter contract in the URL and a new read port | `/sites?q=<text>&customer=<uuid>&show=inactive`; `SiteDirectory.list(filter): Promise<SiteListRow[]>` in `application/ports` | Extending `SiteLister`: its contract is "active sites for the picker" and widening it changes the agreement form. Client-side-only filtering: cannot be linked from a customer page and breaks at the 500-row cap. |

- Nothing else is hard to reverse (no migration, no dependency).

## Criteria

### S1: Browse every site (P1)

Staff open Sites & equipment and see all sites across customers.

**Acceptance Criteria**

1. WHEN a member opens `/sites` THEN the system SHALL list every active site of their org whose customer is active, ordered by customer name then site name, each row linking to `/sites/{id}` and showing site name, address, customer, active asset count and live agreement.
2. The system SHALL show each row's equipment as up to 3 type codes with counts (e.g. `RTU ×3`) plus `+n more` for the rest, counting active assets only.
3. WHERE a site has a live agreement (draft, sent, changes_requested) the row SHALL show its `AG-n` linking to `/agreements/{id}` with its status pill; otherwise it SHALL show "No live agreement".
4. WHEN the sidebar renders THEN "Sites & equipment" SHALL link to `/sites` and be active on `/sites` and `/sites/*`.
5. IF the member is signed out THEN the system SHALL redirect to `/login`.

**Independent test:** open `/sites` in the demo org and see sites from several customers.

### S2: Narrow and include inactive (P1)

**Acceptance Criteria**

6. WHEN `customer=<uuid>` is given THEN the system SHALL list only that customer's sites.
7. WHEN `q=<text>` is given THEN the system SHALL list only sites whose name, address or customer name contains the text, case-insensitive.
8. WHEN several filters are given THEN the system SHALL apply all of them (AND).
9. IF `customer` is not a uuid THEN the system SHALL ignore it; `q` is trimmed and cut at 100 characters.
10. WHEN `show=inactive` is given exactly THEN the system SHALL also list inactive sites (and sites of inactive customers) with an "Inactive" pill; the page SHALL offer "Show inactive" / "Hide inactive" (AD-116).
11. IF the org has no sites THEN the system SHALL show a "No sites yet" empty panel linking to Customers; IF filters match nothing THEN "No sites match these filters" with a Clear filters link.

**Independent test:** `/sites?customer=<id>&show=inactive`, then Clear filters.

### S3: Fit on a phone (P2)

12. WHILE the viewport is 375 px the system SHALL show the list without horizontal scroll and with 44 px touch targets.

## Out of scope

| Excluded | Why |
| --- | --- |
| Searching unit numbers, global search | separate roadmap item (Global search) |
| Adding a site from this page | needs a customer; stays on `/customers/[id]/sites/new` |
| Pagination, sorting controls, export | `ROW_CAP = 500` convention; not on the roadmap |
| Listing individual assets / cross-site equipment table | the page is per site; assets stay on the site register |
| Schema or RLS changes | none needed |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| "Equipment" on the page = per-site type summary, not an asset table | summary on each row | roadmap line is "every site across customers"; assets live on the register | n |
| Text filter `q` on site/customer/address only | yes | unit-number search is the Global search item | n |
| Filters applied server-side via a GET form, like Agreements | yes | linkable, matches AD-120's pattern | n |
| Inactive hidden by default via `?show=inactive` | yes | AD-116 says Sites list copies it | n |
| Viewers see the page (read-only, no write controls exist on it) | yes | select policy is org-member | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/sites` | empty / no-match | AC 11 |
| screen `/sites` | loading | existing - add `loading.tsx` with `PageLoading` |
| screen `/sites` | error | existing - reader throws via `unexpected`, as the customers page |
| screen `/sites` | unauthorised | AC 5 |
| screen `/sites` | density, ordering | AC 1, 2 |
| screen `/sites` | destructive action | n/a - read-only page |
| `GET /sites` | versioning, rate limits | n/a - server-rendered, no external consumer |

## Sources

- ROADMAP.md Phase 3.5 item 10 - scope.
- `.specs/STATE.md` AD-023 (narrow ports, 500 cap), AD-024 (flat site URLs), AD-116 (inactive toggle, "Sites list copies this"), AD-120/121 (URL filter and lister pattern).

## Build and verify (after approval)

- Profile `light` (no project declaration found beyond prior features), one builder; estimate fits the budget.
- Critical files: `web/application/ports/index.ts`, `web/infrastructure/supabase/readers.ts` (+ `readers.test.ts` with `stub-client.ts`), `web/composition/index.ts` (+ `composition.test.ts`), `web/domain/records/` (`parseSiteFilter` + test), `web/components/sites/sites-list.tsx` (+ render test), `web/app/(app)/sites/page.tsx` + `loading.tsx`, `web/components/shell/nav-items.ts` (+ `nav-items.test.ts` C156), `DESIGN.md`.
- Proofs: `npm test` in `web/`; no SQL test needed. Live Playwright run in one signed-in context at 375x812, 768x1024, 1440x900 (no horizontal scroll, 44 px targets, console/network clean).
- Close: tick ROADMAP item, update CONTEXT.md (Site entry + Build log line), STATE.md decision for door 1, then dispatch the fresh Verifier.
