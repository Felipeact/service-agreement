# Sites & equipment page - checks

Profile: light
Plan: `.specs/features/sites-page/plan.md`

19 checks in 2 slices plus delivery · 1 one-way door · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1368:`). This feature numbers
  from C1368, because agreements-page owns up to `C1367:`.
  - Domain tests sit beside the code (`domain/records/records.test.ts`, existing file).
  - The reader is tested in `infrastructure/supabase/readers.test.ts` with the recording `stubClient`.
  - The view is asserted with `renderToStaticMarkup` in `components/sites/sites-list.test.ts` (new file).
  - The page and the container fake are tested in `app/(app)/sites-list.test.ts` (new file), in the style of
    `app/(app)/agreements-list.test.ts`.
  - The sidebar is asserted in `components/shell/nav-items.test.ts`.
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context) at 375, 768
  and 1440 px, recorded in the Handoff.
- No migration and no SQL test: the plan changes no stored shape, and RLS is untouched.

Terms:
- "the fixture sites" are sites of one org in these states: an active site of an active customer with assets, an
  active site with no assets, an inactive site of an active customer, and an active site of an inactive customer
  (4 sites). Assets in the fixtures are active unless said otherwise.
- "live agreement" is an agreement whose status is `draft`, `sent` or `changes_requested` (`LIVE_STATUSES`).
- "writer" and "viewer" are not used: the page is read-only and shows the same to every role.
- Replaced assertion: the plan's `Impact` row authorizes replacing the claim "Sites & equipment has no href"
  (C156 in `nav-items.test.ts`). It is edited in the commit that changes the behaviour, and the commit message names
  it. No other test is edited.

## Checks

### S1 - browse every site · 9 files · ~100 KB · ~25k

**C1368** - `SiteDirectory.list({})` over the fixture sites returns the two active sites of active customers only,
ordered by customer name and then site name, each row carrying `id`, `name`, `address` (string or null), `customerId`,
`customer`, `active` (true), `assetCount`, `equipment` and `liveAgreement` (AC 1, door 1)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1368:"` in `web/`

**C1369** - A site with 3 active RTU assets, 1 active boiler (`BLR`) and 1 inactive RTU asset has `assetCount` 4 and
`equipment` `[{ code: "RTU", count: 3 }, { code: "BLR", count: 1 }]`; two types with the same count order by code; a
site with no assets has `assetCount` 0 and `equipment` `[]` (AC 2)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1369:"` in `web/`

**C1370** - `liveAgreement` is `{ id, number, status }` for a site whose agreement is `draft`, `sent` or
`changes_requested`, and `null` for a site whose only agreements are `accepted`, `refused`, `expired` or `withdrawn`
(7 statuses, table-driven) (AC 3)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1370:"` in `web/`

**C1371** - The sites query is capped at 500 rows, and a Supabase error makes `list` reject with
`Supabase error <code>` rather than return an empty list (AC 1, Observable error)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1371:"` in `web/`

**C1372** - The list view renders each row with the site name as a link to `/sites/{id}`, the address (nothing when
null), the customer name as a link to `/customers/{customerId}`, `3 assets` / `1 asset` / `0 assets`, and for a live
agreement the number as a link to `/agreements/{id}` with a status pill carrying the status label, otherwise the text
"No live agreement"; the header badge reads `n sites` / `1 site` (AC 1, 3)
Proof: `npx vitest run components/sites/sites-list.test.ts -t "C1372:"` in `web/`

**C1373** - The equipment cell shows up to 3 types as `RTU ×3`; a row with 4 types shows the first 3 and `+1 more`; a
row with 3 types shows no `more`; a row with none shows `No equipment` (AC 2)
Proof: `npx vitest run components/sites/sites-list.test.ts -t "C1373:"` in `web/`

**C1374** - The `/sites` page reads `searchParams`, passes the parsed filter to `listSites`, loads the customers for the
filter, and renders the view; an invalid `customer` yields the same call as no `customer` (AC 1, 9)
Proof: `npx vitest run "app/(app)/sites-list.test.ts" -t "C1374:"` in `web/`

**C1375** - A signed-out member opening `/sites` is redirected to `/login` and neither `listSites` nor `listCustomers`
is called (AC 5)
Proof: `npx vitest run "app/(app)/sites-list.test.ts" -t "C1375:"` in `web/`

**C1376** - `MAIN_NAV` "Sites & equipment" has `href` `/sites`, and the sidebar marks it current for `/sites` and
`/sites/s-1` and not for `/pipeline` or `/customers` (AC 4)
Proof: `npx vitest run components/shell/nav-items.test.ts -t "C1376:"` in `web/`

### S2 - narrow and include inactive · 7 files · ~75 KB · ~20k

**C1377** - `parseSiteFilter` keeps `q` trimmed and cut at 100 characters (and drops it when empty after trimming),
keeps `customer` only when it is a uuid, keeps `showInactive` only when `show` is exactly `inactive`, and drops
everything else to "no filter" without throwing; an array-valued parameter keeps nothing (AC 7, 9, 10, door 1)
Proof: `npx vitest run domain/records/records.test.ts -t "C1377:"` in `web/`

**C1378** - `list({ customerId })` returns only sites of that customer, asks the database with
`eq("customer_id", id)`, and drops a row of another customer the database returned; for a customer with no sites it
returns `[]` (AC 6)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1378:"` in `web/`

**C1379** - `list({ q })` keeps a site whose name, address or customer name contains the text, ignoring case, and
drops one where none does; a site with a null address does not throw and still matches on its name (AC 7)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1379:"` in `web/`

**C1380** - `list` with `{ customerId, q }` returns only sites that satisfy both, and a row that fails either one is
absent (AC 8)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1380:"` in `web/`

**C1381** - `list({ showInactive: true })` over the fixture sites returns all 4, the inactive site and the site of the
inactive customer with `active` false and the others true, still ordered by customer name and then site name; their
`assetCount` still counts active assets only (AC 10)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1381:"` in `web/`

**C1382** - The filter bar is a `GET` form to `/sites` with a labelled text input `q` holding the current text, a
labelled customer `Select` listing the customers with the current `customer` selected and an "All customers" option,
and an "Apply filters" submit button; none of the controls is rendered without a visible label (AC 6, 7)
Proof: `npx vitest run components/sites/sites-list.test.ts -t "C1382:"` in `web/`

**C1383** - By default the view links "Show inactive" to `/sites?show=inactive`, and when `q` and `customer` are
set the link keeps both (`/sites?q=...&customer=...&show=inactive`); when showing inactive it links "Hide inactive" to
the same URL without `show` and with `q` and `customer` kept; an inactive row renders an `Inactive` pill and an
active row none (AC 10)
Proof: `npx vitest run components/sites/sites-list.test.ts -t "C1383:"` in `web/`

**C1384** - With no rows and no filter the view renders "No sites yet" with a link to `/customers`; with no rows and a
filter it renders `No sites match` and a "Clear filters" link whose `href` is `/sites`, and "No sites yet" is absent;
the "Clear filters" link is absent when no filter is set (AC 11)
Proof: `npx vitest run components/sites/sites-list.test.ts -t "C1384:"` in `web/`

### Delivery · ~6k

**C1385** - The `/sites` page at 375 px has no horizontal scroll, every control and row link is at least 44 px high,
and at 768 and 1440 px the same page renders without overlap (AC 12)
Proof: live (Playwright at 375, 768 and 1440 px, one signed-in context), result in the Handoff

**C1386** - In the demo org, the sidebar "Sites & equipment" item is a link that opens `/sites` and is current there;
the list shows sites of more than one customer with their equipment and live agreement; `?customer=<id>` narrows to
that customer, a text search narrows by name, and `?show=inactive` shows the toggle state with the filters kept
(AC 1, 4, 6, 7, 10)
Proof: live (Playwright at 1440 px, one signed-in context), result in the Handoff

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| door 1: filter parameters (3) | q C1377 · customer C1377 · show C1377 | - |
| door 1: `SiteListRow` fields (9) | id C1368 · name C1368 · address C1368 · customerId C1368 · customer C1368 · active C1368 · assetCount C1368, C1369 · equipment C1368, C1369 · liveAgreement C1368, C1370 | - |
| door 1: `SiteFilter` members (3) | q C1379 · customerId C1378 · showInactive C1381 | - |
| fixture sites (4) | active with assets C1368 · active no assets C1368, C1369 · inactive site C1381 · site of inactive customer C1381 | - |
| agreement statuses for `liveAgreement` (7) | draft C1370 · sent C1370 · changes_requested C1370 · accepted C1370 · refused C1370 · expired C1370 · withdrawn C1370 | - |
| equipment cell cases (4) | 4 types C1373 · 3 types C1373 · 1 type C1372 · none C1373 | - |
| `GET /sites` statuses (2) | 200 C1374 · 307 to `/login` C1375 | - |
| plan `Observable` states (6) | empty C1384 · no match C1384 · unauthorised C1375 · error C1371 · density C1372 · ordering C1368 | - |
| acceptance criteria (12) | AC 1 C1368, C1372, C1374 · AC 2 C1369, C1373 · AC 3 C1370, C1372 · AC 4 C1376, C1386 · AC 5 C1375 · AC 6 C1378, C1382 · AC 7 C1379, C1382 · AC 8 C1380 · AC 9 C1374, C1377 · AC 10 C1381, C1383 · AC 11 C1384 · AC 12 C1385 | - |

- Observable rows with no check of their own: loading (a new `loading.tsx`, rendered by the framework; C1385 sees it
  while the page loads), destructive action (n/a in the plan), API versioning and rate limits (n/a in the plan)
- Claims naming a status code, route or response shape: C1374, C1375, C1376 - each has a proof that crosses the page
  or the link, not only a helper
- Criterion AC 12 is proven only by the live run C1385 (a viewport claim a static render cannot settle)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1377 (every filter parameter, malformed values dropped, `q` bounded at 100 characters)
- failure modes: C1371 (a reader error rejects to the existing `app/(app)/error.tsx` boundary instead of showing an
  empty list)
- idempotency: n/a - the page only reads; nothing is written or retried
- authorization: C1375 (signed out); RLS on `sites`, `customers`, `assets` and `agreements` is unchanged and still
  scopes the reader to the member's org, and the page has no role-dependent control
- concurrency: n/a - a read of current rows; a site changing between two requests shows the new state on the next
  load
- data lifecycle: C1381 (deactivated sites and customers are hidden by default and readable with `show=inactive`);
  no deletion or backfill
- dependency failure: C1371 (Supabase error)
- state transitions: n/a - the page changes no status
- observability: n/a - no read path in this codebase logs, and the plan adds no logging requirement

## Out of scope

Carried by the plan: unit-number and global search, adding a site from this page, pagination, sorting controls and
export, a cross-site asset table, schema or RLS changes.

## Handoff

- Read set, measured with `wc -c`: `ports/index.ts` 33.0 KB, `readers.ts` 20.5 KB, `readers.test.ts` 31.2 KB,
  `composition/index.ts` 9.7 KB, `agreements-list.tsx` 5.6 KB (pattern), `agreements/page.tsx` 1.2 KB,
  `agreements-list.test.ts` 3.6 KB, `nav-items.ts` and its test 2.0 KB, `domain/records/index.ts` 4.3 KB and its test,
  `show-inactive.tsx` 0.5 KB: about 112 KB, about 28k tokens, plus the new files.
- Slice estimates are in the slice headers: S1 ~25k, S2 ~20k, delivery ~6k. About 51k against the 150k budget, all in
  one surface (the web app, no migration) - one builder, no ask.
- Mechanism: one builder.
- Before the last commit the builder also runs `npm test`, `npm run lint` and `npx tsc --noEmit` in `web/` and reviews
  `git diff <feature base>..HEAD -- "*.test.ts"` against the Terms (only the listed assertion replaced). This is a
  hygiene gate, not a check, because a green suite settles no single claim.
- Plan `Flow` is kept true in the build: the inactive link is built in the view (not `ShowInactiveToggle`, which
  drops other query parameters), the customer filter options come from the existing `listCustomers`, and rows link
  with separate site, customer and agreement links because a link cannot contain a link.
