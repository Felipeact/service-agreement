# Global search checks

Profile: light
Plan: `.specs/features/global-search/plan.md`

45 checks in 4 slices plus delivery · 2 one-way doors · 1 open, 1 blocks go-live (the migration reaching the project, plan Open question 1)

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1552:`). This feature numbers from
  C1552, because members-page owns up to `C1551`.
  - The parser is `domain/records/records.test.ts`.
  - The adapter is `infrastructure/supabase/readers.test.ts`, with the recording `stubClient` (`client.rpc` is its mock).
  - The page and its loading file are `app/(app)/search.test.ts` and `app/(app)/screens.test.ts`, mocking `@/composition`
    as `sites-list.test.ts` does.
  - Components are asserted with `renderToStaticMarkup` in `components/search/search.test.ts` and
    `components/shell/app-shell.test.ts` (it mocks `next/navigation`'s `usePathname`, as `layout.test.ts` does).
  - The container is `composition/composition.test.ts`.
- **sql** means `npm run test:db search` in `web/`. The recipe `search` (fixture.sql then `supabase/tests/search.sql`) is
  added to `RECIPES`; each assertion is labelled with its check id (`tests.ok('C1553 ...')`). Where a check names an
  error, the test reads the SQLSTATE (`tests.expect_error`).
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context) at 1440 and
  375 px, recorded in the Handoff.
- The migration is applied to project `gnxebrtcpbujhvcamtoe` before the `sql` proofs can run (AD-006, AD-026: the suite
  runs against that project inside rolled-back transactions). That is a change to a remote database, so it is owed an
  explicit go-ahead at the moment the build reaches it (Handoff, plan Open question 1).

Terms:
- "the function" is `public.search_records(p_query text, p_limit integer)` (plan Landing 1).
- "a hit" is one returned row; its `kind` is `customer`, `site` or `asset`.
- "inactive" follows AD-116: a record with `deactivated_at` set, or any record under an inactive parent.
- "the search fields" are `customers.name`, `sites.name`, `sites.address` and `assets.unit_no`.

## Checks

### S1 - The function and its rules · 3 files · 40 KB · ~12k

**C1552** - `public.search_records(text, integer)` exists with `security invoker`, `stable`, `search_path = ''`, returns the
eight columns `kind, id, title, customer_name, site_id, site_name, address, type_name`, and `authenticated` holds execute
(Landing 1)
Proof: `npm run test:db search` in `web/` (assertion `C1552`, reading `pg_proc` and `has_function_privilege`)

**C1553** - A customer whose name contains the text is returned, whatever the case of either: `harb` and `HARB` both return
"Harbourview Strata" with `kind = 'customer'` (AC 5)
Proof: `npm run test:db search` in `web/` (assertion `C1553`)

**C1554** - A site whose name contains the text is returned: `tower` returns the site "North Tower" (AC 5)
Proof: `npm run test:db search` in `web/` (assertion `C1554`)

**C1555** - A site whose address contains the text is returned, and a site with a null address is not an error: `main st`
returns the site at "12 Main St" and no row for a site with no address (AC 5)
Proof: `npm run test:db search` in `web/` (assertion `C1555`)

**C1556** - A unit whose unit number contains the text is returned, and a unit with a null unit number is never returned:
`rtu-3` returns the unit "RTU-3" with `kind = 'asset'` (AC 5)
Proof: `npm run test:db search` in `web/` (assertion `C1556`)

**C1557** - A `customer` hit has `title` and `customer_name` equal to the customer's name and null `site_id`, `site_name`,
`address` and `type_name` (AC 7)
Proof: `npm run test:db search` in `web/` (assertion `C1557`)

**C1558** - A `site` hit has `title` and `site_name` equal to the site's name, `site_id` equal to its id, its customer's
name and its address, and null `type_name` (AC 8)
Proof: `npm run test:db search` in `web/` (assertion `C1558`)

**C1559** - An `asset` hit has `title` equal to the unit number, its equipment type's name in `type_name`, and its site's
id, its site's name and its customer's name, and null `address` (AC 9)
Proof: `npm run test:db search` in `web/` (assertion `C1559`)

**C1560** - The text is a plain substring: with records named `A%B`, `A_B`, `A\B` and `AxB`, searching `%` returns only
`A%B`, `_` only `A_B` and `\` only `A\B` (AC 10)
Proof: `npm run test:db search` in `web/` (assertion `C1560`, table-driven over the three characters)

**C1561** - Within a kind, hits whose matched name starts with the text come first, then the rest by title, then by id:
searching `an` over "Anchor Co", "Banner Co" and "Canal Co" returns Anchor Co, Banner Co, Canal Co, and over "Banner Co",
"Anchor Co" returns Anchor Co first (AC 11)
Proof: `npm run test:db search` in `web/` (assertion `C1561`)

**C1562** - `p_limit` caps each kind separately: with three matching customers, three sites and three units, `p_limit = 2`
returns two of each, six rows (AC 12)
Proof: `npm run test:db search` in `web/` (assertion `C1562`)

**C1563** - `p_limit` is clamped to 1 through 100: `0` returns one row for a kind with many matches, `1000` returns 100 for
a kind with 101 matches (AC 12)
Proof: `npm run test:db search` in `web/` (assertion `C1563`)

**C1564** - A null, empty or whitespace-only `p_query` returns no row, and no error (AC 15)
Proof: `npm run test:db search` in `web/` (assertion `C1564`, table-driven over the three)

**C1565** - The function trims the text: `  harb  ` returns what `harb` returns (AC 17)
Proof: `npm run test:db search` in `web/` (assertion `C1565`)

**C1566** - Inactive records are not returned: a deactivated customer, a deactivated site, a site of a deactivated customer,
a deactivated unit, a unit at a deactivated site and a unit of a deactivated customer each fail to appear for a text that
matches them, while their active siblings do (AC 13)
Proof: `npm run test:db search` in `web/` (assertion `C1566`, table-driven over the six)

**C1567** - A member of org B searching for text that matches only org A's records gets no row, and a signed-in user with no
membership gets no row (AC 14)
Proof: `npm run test:db search` in `web/` (assertion `C1567`)

**C1568** - An owner, an admin, an estimator and a viewer of the same org each get the same non-empty result (AC 14)
Proof: `npm run test:db search` in `web/` (assertion `C1568`, table-driven over the four roles)

**C1569** - Calling the function as `anon` raises `42501`, and `public` holds no execute right (Surface status)
Proof: `npm run test:db search` in `web/` (assertion `C1569`)

### S2 - Parsing and the adapter · 4 files · 38 KB · ~10k

**C1570** - `parseSearchQuery` returns the trimmed text cut to its first 100 characters and trimmed again; a missing value,
an array value and a blank value give `""`; every other parameter is ignored (AC 17, Landing 2)
Proof: `npx vitest run domain/records/records.test.ts -t "C1570:"` in `web/`

**C1571** - `supabaseRecordSearch(client).search(text)` calls the RPC `search_records` once with `{ p_query: text, p_limit: 26 }`
(Landing 1, AC 12)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1571:"` in `web/`

**C1572** - The adapter sorts the rows into `customers`, `sites` and `equipment` by `kind`, keeps the database's order, and maps
the columns to camel-case fields: a customer's `id` and `name`; a site's `id`, `name`, `customerName`, `address`; a unit's
`siteId`, `unitNo`, `typeName`, `siteName`, `customerName` (AC 6, 7, 8, 9)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1572:"` in `web/`

**C1573** - With 26 rows of a kind the adapter returns 25 and sets that group's `more` to true; with exactly 25 it returns 25
and `more` false; the other groups are judged on their own rows (AC 12)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1573:"` in `web/`

**C1574** - When the RPC returns an error the adapter throws an `Error` whose message carries the Supabase code (AC 18)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1574:"` in `web/`

**C1575** - `getContainer()` exposes `searchRecords`, built from the request-scoped (session) client and never the
service-role client (Flow hop 3)
Proof: `npx vitest run composition/composition.test.ts -t "C1575:"` in `web/`

### S3 - The page and its states · 5 files · 32 KB · ~10k

**C1576** - `/search?q= tower ` reads through `searchRecords` with the parsed text `tower` and renders the three groups it
returns (AC 5, 6)
Proof: `npx vitest run "app/(app)/search.test.ts" -t "C1576:"` in `web/`

**C1577** - With `q` missing or blank the page shows "Search customers, sites and equipment by name, address or unit number."
and `searchRecords` is not called (AC 15)
Proof: `npx vitest run "app/(app)/search.test.ts" -t "C1577:"` in `web/`

**C1578** - Signed out, the page redirects to `/login` and `searchRecords` is not called (Surface status)
Proof: `npx vitest run "app/(app)/search.test.ts" -t "C1578:"` in `web/`

**C1579** - When `searchRecords` rejects, the page component rejects, so the `(app)` error boundary shows, and no partial
result is rendered (AC 18)
Proof: `npx vitest run "app/(app)/search.test.ts" -t "C1579:"` in `web/`

**C1580** - `/search` has a `loading.tsx` that renders its title "Search" and an `aria-busy` placeholder, like the other app
pages (AC 19)
Proof: `npx vitest run "app/(app)/screens.test.ts" -t "C1580:"` in `web/`

**C1581** - The results render the groups in the order Customers, Sites, Equipment, each headed by its name and its count,
and leave out a group with no hit (AC 6)
Proof: `npx vitest run components/search/search.test.ts -t "C1581:"` in `web/`

**C1582** - A customer row is a link to `/customers/<id>` showing the customer's name (AC 7)
Proof: `npx vitest run components/search/search.test.ts -t "C1582:"` in `web/`

**C1583** - A site row is a link to `/sites/<id>` showing the site's name and its customer's name, and its address when it has
one and no address text when it has none (AC 8)
Proof: `npx vitest run components/search/search.test.ts -t "C1583:"` in `web/`

**C1584** - An equipment row is a link to `/sites/<site id>` showing the unit number, the equipment type name, the site's name
and the customer's name (AC 9)
Proof: `npx vitest run components/search/search.test.ts -t "C1584:"` in `web/`

**C1585** - "Showing the first 25. Refine your search." appears under a group whose `more` is true and under no other (AC 12)
Proof: `npx vitest run components/search/search.test.ts -t "C1585:"` in `web/`

**C1586** - With three empty groups for the text `zzzz` the view shows `No customers, sites or equipment match “zzzz”.` and
"Deactivated records are not searched." (AC 16)
Proof: `npx vitest run components/search/search.test.ts -t "C1586:"` in `web/`

**C1587** - Text such as `<img src=x onerror=alert(1)>` appears escaped in the field's value, the empty message and a row
title, and no `<img` element is rendered (AC 21)
Proof: `npx vitest run components/search/search.test.ts -t "C1587:"` in `web/`

**C1588** - The page's form is `method="get"` with `action="/search"`, holds a search input named `q` prefilled with the
trimmed text and labelled "Search", and a submit button "Search" (AC 3)
Proof: `npx vitest run components/search/search.test.ts -t "C1588:"` in `web/`

### S4 - The shell entries · 2 files · 8 KB · ~3k

**C1589** - The sidebar renders a `<form method="get" action="/search">` with a search input named `q` and an accessible name
"Search" (AC 1)
Proof: `npx vitest run components/shell/app-shell.test.ts -t "C1589:"` in `web/`

**C1590** - The top bar renders a link to `/search` named "Search" with a 44 px square hit area (`size-11`) and the sidebar
form is not shown below 1024 px (`hidden lg:flex` on the aside) (AC 2)
Proof: `npx vitest run components/shell/app-shell.test.ts -t "C1590:"` in `web/`

**C1591** - Every search control (the sidebar field, the page field and the page button) carries `h-11` and `lg:h-[34px]`,
anchored so `sm:h-11` cannot satisfy it (AC 4)
Proof: `npx vitest run components/shell/app-shell.test.ts -t "C1591:"` and `npx vitest run components/search/search.test.ts -t "C1591:"` in `web/`

### Delivery - regressions and the live run

**C1592** - `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` and `npm run test:db` all exit 0 on `HEAD`, and the
`next build` route table lists `/search` (every AC)
Proof: those commands in `web/`, results in the Handoff

**C1593** - Live, as the demo owner, after the migration reaches the project: at 1440 px typing a customer name in the sidebar
and pressing Enter opens `/search?q=<name>` with that customer in the Customers group and its link opening the customer page;
at 375 px the top-bar Search link opens `/search`, the page field, button and link rows measure at least 44 px high, and
`scrollWidth <= clientWidth` with a 250-character site name written into the DOM of a result row; the console shows 0 errors
and 0 warnings and no request fails (AC 1, 2, 3, 4, 20)
Proof: live (Playwright, one signed-in context, 1440 then 375 px), result in the Handoff

**C1594** - After the migration, the Supabase security advisors show no new finding for `search_records`: it is not listed as
executable by `anon`, and it is not a `security definer` finding (Landing 1)
Proof: `get_advisors` (security) on `gnxebrtcpbujhvcamtoe` before and after, difference in the Handoff

**C1595** - Live, on the same context, a search for a unit number that exists on the demo tenant returns an Equipment row whose
link opens that unit's site page, and a search for `zzzz` shows the no-match message (AC 9, 16)
Proof: live (Playwright, one signed-in context), result in the Handoff

**C1596** - `nav-items.test.ts` and `layout.test.ts` still pass unchanged, and DESIGN.md's Shell paragraph names the sidebar
field and the top-bar link (Impact: UI)
Proof: `npx vitest run components/shell/nav-items.test.ts "app/(app)/layout.test.ts"` in `web/`, and `grep -n "/search" ../DESIGN.md` exits 0

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| search fields (4) | `customers.name` C1553 · `sites.name` C1554 · `sites.address` C1555 · `assets.unit_no` C1556 | - |
| hit kinds (3) | customer C1557 · site C1558 · asset C1559 | - |
| kinds mapped by the adapter (3) | customers C1572 · sites C1572 · equipment C1572 | - |
| literal characters (3) | `%` C1560 · `_` C1560 · `\` C1560 | - |
| blank queries (3) | null C1564 · empty C1564 · whitespace C1564 | - |
| inactive cases (6) | customer C1566 · site C1566 · site of inactive customer C1566 · unit C1566 · unit at inactive site C1566 · unit of inactive customer C1566 | - |
| roles (4) | owner C1568 · admin C1568 · estimator C1568 · viewer C1568 | - |
| callers of the function (4) | member of the org C1568 · member of another org C1567 · signed in with no membership C1567 · `anon` C1569 | - |
| `p_limit` bounds (4) | per kind C1562 · lower clamp 0 C1563 · upper clamp 1000 C1563 · adapter value 26 C1571 | - |
| group cap (2 edges) | 25 rows, `more` false C1573 · 26 rows, `more` true C1573 | - |
| `parseSearchQuery` inputs (6) | trimmed C1570 · 100-character cut C1570 · cut then trimmed C1570 · missing C1570 · array C1570 · other parameters ignored C1570 | - |
| `GET /search` statuses (2) | 200 C1576 · redirect to /login C1578 | - |
| `rpc search_records` statuses (3) | rows C1553 · none C1564 · `42501` C1569 | - |
| page states (4) | prompt C1577 · no match C1586 · loading C1580 · error C1579 | - |
| shell entries (2) | sidebar form C1589 · top-bar link C1590 | - |
| search controls with the two heights (3) | sidebar field C1591 · page field C1591 · page button C1591 | - |
| landing doors (2) | 1 function C1552, C1553-C1569, C1571 · 2 route C1570, C1576, C1588 | - |
| entities in Relations (0) | none, Relations is `None - no stored-data shape change` | - |
| plan `Observable` rows with a check (9) | empty prompt C1577 · empty no match C1586 · loading C1580 · error C1579 · unauthorised C1578 · ordering C1561, C1581 · long values C1593 · entered text C1587 · shell entries C1589, C1590 · function callers C1567-C1569 | - |
| startup configuration: container (1 assembly) | `getContainer` C1575 | - |

- Observable rows with no check of their own: destructive confirm (n/a in the plan: the page only reads); versioning and rate
  limits of the function (n/a in the plan: an internal function called by one adapter)
- Claims naming a status code, route or response shape: C1569, C1576, C1578, C1552 - each has a proof that crosses the
  boundary it names (the function, the page)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1570 (the text is trimmed and cut), C1565 (the database trims too), C1560 (wildcards are literal), C1564 and
  C1563 (blank text and the limit bounds), C1587 (typed markup is inert)
- failure modes: C1574 (the RPC fails), C1579 (the page rejects, no partial list)
- idempotency: n/a - a read; the same text on the same data returns the same rows (C1561 fixes the order, so equal rows tie-break by id)
- authorization: C1567-C1569 and C1578; existing - RLS on `customers`, `sites` and `assets` decides the tenant (AD-015) because the function is `security invoker` (C1552)
- concurrency: n/a - one SQL statement reads one snapshot and nothing is written
- data lifecycle: C1566 (deactivated records and their children are not searched; nothing is deleted or stored)
- dependency failure: C1574, C1579 (the database call is the only dependency)
- state transitions: n/a - the feature holds no state; the URL is the whole input
- observability: n/a - no logging or metrics requirement; a failed read reaches the `(app)` error boundary (C1579)

## Out of scope

Carried by the plan: agreements by number, contacts, equipment model and location, searching deactivated records, a live
dropdown or shortcut, highlighting, typo and accent tolerance, more than 25 rows per group, a deep link into a unit, and a
trigram or full-text index.

## Handoff

- Read set, measured with `wc -c`: `readers.ts` (~24 KB), `application/ports/index.ts` (~38 KB), `composition/index.ts` (~11 KB),
  `app-shell.tsx` and `sidebar-nav.tsx` (~6 KB), the sites page, loading and list test (~4 KB), `sites-list.tsx` and its test
  (~13 KB), `domain/records/index.ts` (~6 KB), `stub-client.ts` (~3 KB), `runner.mts` (~5 KB), `fixture.sql`,
  `contact_roles.sql` and `task_library.sql` as SQL patterns (~30 KB). About 140 KB, ~35k tokens.
- Writes: one migration (~3 KB), `search.sql` (~16 KB), about 8 KB of source and 30 KB of tests, docs (~8 KB). About 65 KB,
  ~16k tokens.
- Slice estimates in the headers: S1 ~12k, S2 ~10k, S3 ~10k, S4 ~3k, delivery ~5k; the reads are shared. About 50k against the
  150k budget, so one builder; the cut, had one been needed, falls after S1 (the surface changes from the database to the app).
- Mechanism: one builder (under the budget, no ask)
- Owed an ask when reached: (1) applying the migration to `gnxebrtcpbujhvcamtoe` (a remote schema change; the `sql` proofs, the
  advisors check C1594 and the live checks C1593 and C1595 need it; plan Open question 1); (2) nothing else is outward-facing:
  the live run sends no email and writes no row.

- **Boundary:** C1570-C1591 and C1596 closed by green vitest proofs, C1592 (except `test:db`) run on the working tree: `npm test` 2680 passed, `npm run lint`, `npx tsc --noEmit` and `npm run build` clean, `/search` in the route table. **Open:** C1552-C1569 (SQL recipe `search`, written, not run), C1592's `npm run test:db`, C1593, C1594 and C1595: all need migration `20261105210000_global_search` applied to the project (plan Open question 1).
- **Settled mid-build:** (1) `runner.test.ts` counts moved 22 -> 23 recipes and 24 -> 25 files, and the recipe list gained `search`, as members-page did. (2) `loading.tsx` wraps `PageLoading` in a `div aria-busy="true"` so AC 19 and C1580 hold with the existing `role="status"` line. (3) `database.types.ts` was hand-edited for `search_records` (the CLI generator needs the applied function) and should match the generated file in content. (4) `next typegen` was run to refresh route types for `/search`.
- **Abandoned:** nothing.

- **Applied and run (2026-11-05, after the owner applied migration `20261105210000_global_search` in the SQL editor):** `npm run test:db search` 1 passed; `npm run test:db` 23 passed, 0 failed (C1552-C1569, C1592). Security advisors after: `anon` 5, `authenticated` 17 (the same counts as after the members migration), and no finding names `search_records` (C1594).
- **C1593 and C1595 (live, one signed-in context as the demo owner, `next start` on port 3210 from the build of `c1ddb31`):** an unsigned `GET /search?q=x` answered 307 to `/login` (Surface status). 1440 px: typing `ridgeline` in the sidebar field and pressing Enter opened `/search?q=ridgeline` with Customers 1 and Sites 1, the page field holding `ridgeline`, the sidebar field, page field and button each 34 px, `scrollWidth 1440 = clientWidth 1440`; the customer link opened `/customers/6d8efe7d-...`. `?q=a` listed Customers 15, Sites 16, Equipment 7 in that order (under the 25 cap, so no Refine line). `?q=ahu-1` listed two Equipment rows (Brookhaven Community Centre and Tidewater Hotel) and the Tidewater link opened its site page. `?q=zzzz` showed `No customers, sites or equipment match “zzzz”.` and `Deactivated records are not searched.` 375 px: from `/pipeline` the top-bar Search link (44 x 44) opened `/search`, the page field and button 44 px, every result row at least 44 px, the sidebar `display: none`, and with a 250-character string written into a result row's title and detail `scrollWidth 360 = clientWidth 360`; console 0 errors and 0 warnings, every request 200. **Not seen live:** the Refine line (no group has more than 25 matches in the demo data; covered by C1573 and C1585) and touch emulation proper (the context was not re-created with `hasTouch`; sizes were measured).
- **Boundary (final):** C1552-C1596 all run and green at `4197c8d`; Verifier not yet dispatched.

- **Verifier round 1 (FAIL, `verification.md`):** 42 of 45 proven; C1593 and C1595 are live-only, and C1592's non-database commands were not re-run by it. Test-strength gaps closed after it, all additive: C1570 (a leading-space input over 100 characters killed the surviving trim-before-cut mutant), C1573 (the kept count equals the limit asked minus one), C1590 (the link is inside the `lg:hidden` top bar), C1578 (the proxy matcher covers `/search`, in `proxy.test.ts`), C1556 (`rtu` returns exactly `RTU-1|RTU-3`), C1568 (sites and units for all four roles), C1587 (escaping in site and equipment rows). After them: `npm test` 2681 passed, lint, `tsc` and `build` clean, `test:db search` passed.
- **Settled mid-build (round 1 aftermath):** the Verifier's worktree cleanup removed `web/node_modules/.bin`; the owner told the session to stop the dev and start servers on ports 3000, 3100, 3200 and 3201, and `npm ci` restored the folder from the lockfile (493 packages, lockfile unchanged).
