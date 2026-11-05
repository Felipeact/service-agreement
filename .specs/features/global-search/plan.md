# Global search (ROADMAP Phase 3.5, item 16)

## Problem

Staff can find a customer, a site or a piece of equipment only by knowing where it lives. The Customers list and the Sites list each have a search box, but each one searches only its own page and only after the right page is open. Nothing finds a unit number at all: the equipment register on a site page filters one site's units, so "which site has RTU-3?" means opening sites one at a time. The Sites list also filters after reading at most 500 rows (`ROW_CAP`), so on a large tenant a match past the cap is invisible. The roadmap gives no figures; none are invented. The cost is the minutes an estimator or admin spends on a phone call or a site visit looking for the right record.

When this ships, a member types a name, an address fragment or a unit number into the search field that is on every page and lands on one results page listing the customers, sites and equipment that match, each a link to its page.

## Flow

Reuses the URL-filter pattern of AD-120, AD-122 and AD-123 (the page is its filter), `AppShell` for the entry point, `SearchInput`, `EmptyPanel`, `PageHeader`, `PageLoading` and the `(app)` error boundary, the active rule of AD-116 (a record is active only while its parents are), and `/customers/[customerId]` and `/sites/[siteId]` as link targets (AD-024).

1. `AppShell` (exists) - the desktop sidebar gains a search field and the mobile top bar a search link; both open `GET /search?q=<text>` (door 2).
2. `app/(app)/search/page.tsx` (new, placement) reads `searchParams` -> `parseSearchQuery` (new, pure, `web/domain/records`) -> `RecordSearch.search(query)` (new port, door 1).
3. `supabaseRecordSearch` (new, placement, in `infrastructure/supabase/readers.ts`) calls `public.search_records(p_query, p_limit)` (door 1) with a limit of 26, groups the rows by `kind`, keeps 25 per group and records whether a 26th existed.
4. `SearchResultsView` (new, placement, `web/components/search/`) renders three groups (Customers, Sites, Equipment) as links to `/customers/[id]` and `/sites/[id]`; `app/(app)/search/loading.tsx` (new, placement) is the loading state.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: *search hit* (`SearchHit`) - one matching customer, site or unit, with the names needed to print the row; distinct from `SiteListRow` (a whole site with counts) and `SiteOption` (the agreement picker) |
| domain | existing term "search": the Pipeline board, Customers list, Sites list and equipment register each keep their own in-page search, unchanged; this is a fourth, global one and replaces none of them |
| domain | existing term "active": a unit is searchable only while it, its site and its customer are not deactivated (AD-116). Callers branching on it today: customers, sites and assets lists, `SiteLister`; unchanged |
| UI | `AppShell` gains a field in the sidebar and a link in the top bar; `layout.test.ts`, `nav-items.test.ts` and any test rendering the shell are re-run and extended in the same change; DESIGN.md's Shell paragraph is updated |
| stored data | no table or column changes and nothing to backfill; one new function; `database.types.ts` gains its `Functions` entry |
| dashboard config | none |
| docs | ROADMAP tick, CONTEXT.md (screen entry, build log), STATE.md decision |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /search` | `q` (text, trimmed, 100 characters) | three groups of hits: Customers, Sites, Equipment, each at most 25 rows | `200`, redirect `/login` (signed out, by the proxy) |
| `rpc search_records` | `p_query` text, `p_limit` integer | rows `kind` (`customer`, `site`, `asset`), `id`, `title`, `customer_name`, `site_id`, `site_name`, `address`, `type_name` | `200` with rows, `200` with none for a blank query or no match, `42501` for a caller with no execute right (`anon`) |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. The search function | `public.search_records(p_query text, p_limit integer) returns table (kind text, id uuid, title text, customer_name text, site_id uuid, site_name text, address text, type_name text)`; `language sql stable security invoker set search_path = ''`; `revoke all ... from public, anon`, `grant execute ... to authenticated`. It trims `p_query`, returns no row for a blank one, clamps `p_limit` to 1 through 100, and matches with `position(lower(trim_q) in lower(col)) > 0` on `customers.name`, `sites.name`, `sites.address` and `assets.unit_no`, per kind `limit p_limit`, ordered names that start with the text first, then by `title`, then `id`; inactive rows and rows under an inactive parent are left out | Three PostgREST requests with `.or('name.ilike.%x%,...')` from the adapter: the filter string needs its commas, parentheses and `%`/`_` escaped by hand, the embed joins fail only against the real schema (AD-125's lesson), and the three reads are not one snapshot. A `security definer` function: it would stop RLS deciding the tenant (AD-015). `ilike`: `%` and `_` in the text become wildcards, so an escape rule would be a second contract. A search table or view kept in step: drifts from the records (AD-017's reason for deriving) |
| 2. The search route | `GET /search?q=<text>`; flat (AD-024); `q` is the only parameter and anything else is ignored; `parseSearchQuery` trims it and keeps the first 100 characters | A command-palette overlay with no URL: a result set cannot be bookmarked or linked from an email, and the page-is-the-filter pattern of AD-122 would not hold. A `?q=` on each list page: a unit number lives on no list page |

- A trigram or full-text index is not a door: the function reads one org through `org_id` indexes and can gain an index later without changing its contract (Assumptions).
- Nothing else in this change is hard to reverse

## Criteria

### S1: Search from any page (P1)

A member reaches the search from every page of the app, on a phone or a desktop.

**Acceptance Criteria**

1. WHEN a member submits the search field in the desktop sidebar THEN the system SHALL open `/search?q=<the text>` with a GET request.
2. WHILE the viewport is narrower than 1024 px the system SHALL show, in the top bar, a "Search" link of 44 px by 44 px to `/search`.
3. The system SHALL show on `/search` its own search field, prefilled with the trimmed `q`, and a "Search" button, so a search can be refined without leaving the page.
4. The system SHALL make every search control 44 px tall below 1024 px and 34 px from 1024 px up.

**Independent test:** from `/pipeline`, type a customer name in the sidebar field and press Enter; the results page opens with the text in its field.

### S2: Results (P1)

The page lists what matches, grouped by what kind of record it is.

**Acceptance Criteria**

5. WHEN `q` has non-blank text THEN the system SHALL list, case-insensitively, the customers whose name contains it, the sites whose name or address contains it and the equipment whose unit number contains it.
6. The system SHALL show the groups in the order Customers, Sites, Equipment, each headed by its name and its count, and SHALL leave out a group with no match.
7. The system SHALL print a customer row as the customer's name, linked to `/customers/<id>`.
8. The system SHALL print a site row as the site's name, with its customer's name and its address when it has one, linked to `/sites/<id>`.
9. The system SHALL print an equipment row as the unit number, with its equipment type name, its site's name and its customer's name, linked to `/sites/<site id>`.
10. The system SHALL treat the text as a plain substring: `%`, `_` and `\` match themselves and nothing else.
11. The system SHALL order each group with the rows whose matched name starts with the text first, then by name, then by id.
12. The system SHALL show at most 25 rows per group, and WHEN more than 25 rows of a group match THEN it SHALL show "Showing the first 25. Refine your search." under that group.
13. The system SHALL leave out a deactivated customer, a deactivated site or a site of a deactivated customer, and a deactivated unit or a unit at a deactivated site or customer.
14. The system SHALL return only the signed-in member's org, for an owner, an admin, an estimator and a viewer alike.

**Independent test:** search for a unit number that exists on one site of two customers; both rows show, each with its own site and customer.

### S3: States and limits (P1)

**Acceptance Criteria**

15. WHEN `q` is absent or blank THEN the system SHALL show "Search customers, sites and equipment by name, address or unit number." and SHALL not call the database.
16. WHEN no record matches THEN the system SHALL show `No customers, sites or equipment match “<text>”.` and "Deactivated records are not searched."
17. IF `q` is longer than 100 characters THEN the system SHALL search, and show in its field, the first 100 characters after trimming.
18. IF the read fails THEN the system SHALL reject the page so the `(app)` error boundary shows.
19. WHILE the results are being read the system SHALL show the page title and a loading placeholder (`aria-busy`), not a blank page.
20. The system SHALL have no horizontal scroll at 375 px when a result row carries a 250-character name.
21. The system SHALL show the text a member typed in the results, the field and the empty message exactly as typed (HTML-escaped by React), never as markup.

**Independent test:** search for `zzzz`; the empty message names `zzzz`. Search for `%`; only records whose name or address contain a literal percent sign show.

## Out of scope

| Excluded | Why |
| --- | --- |
| Agreements by number, contacts by name or email, equipment model and location | the roadmap item names customers, sites and unit numbers; the Agreements page already filters by status and site |
| Searching deactivated records, or a "Show inactive" toggle on the results | lists keep that toggle (AD-116); a search that mixes live and removed records needs its own answer |
| A live dropdown, a keyboard shortcut, highlighting the match, typo tolerance, accent folding | each is a larger interaction than the roadmap asks for; the GET page works without them |
| More than 25 rows per group, or paging | "Refine your search" is the answer at this size; a "see all" view can follow |
| A link that opens the matched unit inside the site page | the equipment register has its own filter; the row names the unit and the site page lists it |
| A trigram or full-text index | not needed until a tenant's row count shows a slow search |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Results page versus an overlay | a page at `/search` with a field in the sidebar, and a top-bar link on a phone | the app already puts every filter in the URL (AD-120, AD-122, AD-123), works without script, and a phone gets one tap and a full-width field | n |
| Minimum length | one character after trimming | unit numbers are short ("3", "A2"); the 25-row cap and the "Refine" line bound the noise | n |
| Order of unit numbers | text order (`RTU-10` before `RTU-2`) | a natural-number sort in SQL needs an ICU collation the project does not use; the cap is applied in SQL, so sorting afterwards in the app would change which rows are kept | n |
| Case and accents | case-insensitive through `lower()`, accents significant | matches the in-page searches (`toLowerCase().includes`) | n |
| Where a unit row links | the site's page `/sites/<site id>` | the register is the only page that shows a unit | n |
| Index | none | `org_id` indexes bound the scan to one tenant; a trigram index is added when a tenant's counts need it, with no change to the function's contract | n |
| Customer names on site and equipment rows | plain text, not a second link | a link cannot contain a link (sites-page plan); the row has one target | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | The migration creates one function. The previous one (`20261105120000_members_page`) was applied in the SQL editor and is not in the project's migration history. Apply this one the same way, or run `supabase migration repair --status applied 20261105120000` and then `supabase db push`? | `/search` fails with `PGRST202` against the live project until the function exists; every proof against the repo passes meanwhile |

## Observable

Worksheet, not the review.

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/search` | empty state (no query) | AC 15 |
| screen `/search` | empty state (no match) | AC 16 |
| screen `/search` | loading state | AC 19 |
| screen `/search` | error state | AC 18 |
| screen `/search` | unauthorised (signed out, no membership) | existing - the proxy redirects to `/login`; `MemberGate` shows `NoWorkspace` for a user with no org |
| screen `/search` | density and ordering | AC 6, 11, 12 |
| screen `/search` | destructive action confirms | n/a - the page only reads and links |
| screen `/search` | long values and a phone | AC 20 |
| screen `/search` | entered text shown back | AC 21 |
| shell search field and link | focus, size, label | AC 1, 2, 4 |
| API `rpc search_records` | response shape, error shape and codes | Surface table; AC 18 (any error rejects the page) |
| API `rpc search_records` | who may call it | AC 14; the grant in door 1 |
| API `rpc search_records` | versioning, rate limits | n/a - an internal function called by one adapter; Supabase's own limits apply |

## Sources

- ROADMAP.md Phase 3.5 - "Global search across customers, sites and unit numbers" (the scope).
- STATE.md AD-015, AD-116, AD-122 - RLS decides the tenant, active means parents active, a page is its URL filter.
