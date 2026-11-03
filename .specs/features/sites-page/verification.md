# Sites & equipment page verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: deb8619..29ecfc6
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

C1385 and C1386 are live Playwright checks that the author ran. I did not re-run them (sign-in is by emailed link); I judged only whether the Handoff record covers each claim and matches what the code renders.

Working tree: `git status --porcelain` was empty before I started. It shows only this report after.

## Binding sources

n/a under light (Step 1 does not run).

## Checks

Proof run (one invocation, `--reporter=verbose`, from `web/`):
`npx vitest run infrastructure/supabase/readers.test.ts components/sites/sites-list.test.ts "app/(app)/sites-list.test.ts" components/shell/nav-items.test.ts domain/records/records.test.ts -t "C1368:|...|C1384:"`
Result: 5 files passed, 41 tests passed, 76 skipped. Every test named below showed individually as passed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1368 | 2 active sites of active customers, ordered, 9 fields | vitest batch above, exit 0 | `web/infrastructure/supabase/readers.test.ts:712` - `expect(rows.map((r) => r.id)).toEqual(["plain", "tower"])` and a `toEqual({id, name, address, customerId, customer, active: true, assetCount, equipment, liveAgreement: null})` on the second row; `:729` - `.toEqual(["alpha", "Bravo"])` | PASS |
| C1369 | assetCount counts active assets only; equipment by count then code; empty site | same | `readers.test.ts:734` - `expect(by("s").assetCount).toBe(4)`, `expect(by("s").equipment).toEqual([{ code: "RTU", count: 3 }, { code: "BLR", count: 1 }])`, tie `toEqual([{AHU},{MUA}])`, `expect(by("e")).toMatchObject({ assetCount: 0, equipment: [] })` | PASS |
| C1370 | live for draft/sent/changes_requested, null for the other 4 | same | `readers.test.ts:755` - table of 7; `expect(rows[0].liveAgreement).toEqual(live ? { id: "x1", number: "AG-1001", status } : null)` | PASS |
| C1371 | capped at 500; Supabase error rejects | same | `readers.test.ts:760` - `c.method === "limit" && c.args[0] === 500`; `:765` - `.rejects.toThrow("Supabase error 42501")` | PASS |
| C1372 | row links, address, count wording, live agreement link and pill, header badge | same | `web/components/sites/sites-list.test.ts:37` - `toMatch(/<a[^>]*href="\/sites\/s1"[^>]*>Harbourview Towers<\/a>/)`, `href="\/customers\/c1"`; `:46` - `toContain("1 asset<")`, `"0 assets"`; `:55` - `href="\/agreements\/ag1"...AG-1001`, `toContain("Sent to customer")`; `:62` - `toContain("1 site<")`, `"2 sites<"` | PASS (see finding 3) |
| C1373 | up to 3 types, `+1 more`, none, `No equipment` | same | `sites-list.test.ts:69` - `toContain("T3 ×2")`, `not.toContain("T4")`, `toContain("+1 more")`; `:78` - `not.toContain("more")`, `toContain("No equipment")` | PASS |
| C1374 | page parses `searchParams`, calls `listSites` with the filter, loads customers; invalid customer equals none | same | `web/app/(app)/sites-list.test.ts:33` - `expect(listSites).toHaveBeenCalledWith({ q: "tower", customerId: CUSTOMER, showInactive: true })`, `listCustomers` called once; `:41` - `toHaveBeenNthCalledWith(1, {})` and `(2, {})` | PASS |
| C1375 | signed out goes to `/login`, nothing read | same | `sites-list.test.ts` (app):48 - `.rejects.toThrow("NEXT_REDIRECT /login")`, `expect(listSites).not.toHaveBeenCalled()`, `expect(listCustomers).not.toHaveBeenCalled()` | PASS (see finding 4) |
| C1376 | `MAIN_NAV` href `/sites`; current for `/sites` and `/sites/s-1`, not `/pipeline`, `/customers` | same | `web/components/shell/nav-items.test.ts:17` - `["Sites & equipment", "/sites"]` checked by `hrefOf(label)).toBe(href)` (:21); `:45` - `expect(link.includes('aria-current="page"')).toBe(current)` (:50) over the 4 paths | PASS |
| C1377 | `parseSiteFilter` bounds q at 100 and trims; uuid only; `show` exactly `inactive`; arrays keep nothing | same | `web/domain/records/records.test.ts:117` - `toEqual({ q: "x".repeat(100) })`, `toEqual({})` for blanks; `:124` - `parseSiteFilter({ customer: "nope" })).toEqual({})`; `:130` - `["Inactive","all","1",""]` give `{}`; `:135` - `parseSiteFilter({ q: ["a","b"], customer: [CUSTOMER], show: ["inactive"] })).toEqual({})` | PASS |
| C1378 | only that customer's sites, `eq("customer_id", id)`, foreign row dropped, `[]` for none | same | `readers.test.ts:770` - `c.method === "eq" && c.args[0] === "customer_id" && c.args[1] === "cust-A"`; `result.rows.map((r) => r.id)).toEqual(["a"])`; unknown customer `.rows).toEqual([])` | PASS |
| C1379 | q matches name, address or customer, ignores case, null address safe | same | `readers.test.ts:778` - `{ q: "HARBOUR" }` gives `["n"]` (null address); `{ q: "maple" }` gives `["a","c"]` (address and customer name); `{ q: "nothing" }` gives `[]` | PASS |
| C1380 | both filters AND | same | `readers.test.ts:790` - `list(rows, { customerId: "cust-A", q: "maple" })).rows.map(id)).toEqual(["hit"])` with a wrong-customer and a wrong-text row present | PASS |
| C1381 | `showInactive` lists all 4 with flags, ordered, active assets only | same | `readers.test.ts:799` - `.toEqual(["plain", "gone", "orphan", "tower"])`, `active` `.toEqual([true, false, false, true])`, `gone` `assetCount).toBe(1)` | PASS |
| C1382 | GET form to `/sites`, labelled q, labelled customer select, All customers, Apply filters | same | `sites-list.test.ts:85` - `form).toContain('method="get"')`, `'action="/sites"'`, `<label ... for="q"`, `<label ... for="customer"...>Customer</label>`, `<option value="${CUSTOMER}" selected="">`, `<button ... type="submit"...>Apply filters</button>` | PASS |
| C1383 | Show/Hide inactive links keep q and customer; Inactive pill only on inactive row | same | `sites-list.test.ts:99` - `href="/sites?q=tower&amp;customer=${CUSTOMER}&amp;show=inactive"...>Show inactive`; `:105` - `href="/sites?q=tower&amp;customer=..."...>Hide inactive`, `expect(out.match(/>Inactive</g)?.length).toBe(1)`, `expect(html([row()])).not.toContain(">Inactive<")` | PASS |
| C1384 | empty vs no-match; Clear filters to `/sites`; absent with no filter | same | `sites-list.test.ts:118` - `toContain("No sites yet")`, `href="\/customers"`, `not.toContain("Clear filters")`; `:126` - `toContain("No sites match")`, `href="\/sites"...>Clear filters`, `not.toContain("No sites yet")` | PASS |
| C1385 | at 375 px no horizontal scroll and 44 px targets; at 768 and 1440 px no overlap | not re-run by me; Handoff read against `web/components/sites/sites-list.tsx` | `checks.md` Handoff "Live C1385": scroll and 44 px recorded at all three widths; overlap recorded only as "Screenshots at 375 and 1440 px show no overlap" | **FAIL** - no overlap observation at 768 px (finding 1) |
| C1386 | sidebar link opens `/sites` and is current; several customers with equipment and live agreement; `customer` narrows; text search narrows by name; `show=inactive` toggle with filters kept | not re-run by me; Handoff read against `sites-list.tsx` | `checks.md` Handoff "Live C1386": `aria-current="page"` on the link; 17 sites of 13 customers with `RTU ×16`, `BOILER ×1 +5 more`, `No equipment`, AG-1044/1051/1057/1058; `customer=Brookhaven` gave 2 rows; adding `q=exhibition` gave 1; "Show inactive" kept both; "Hide inactive" linked back without `show` | PASS (see finding 5) |

C1386 matches the code. `sites-list.tsx:77-79` builds the Show/Hide link through `sitesHref(filter, !showing)`, which keeps `q` and `customer`. `:111` renders the Inactive pill, and the record says the pill was not seen live because the demo org has no inactive site. The claim does not name the pill. `:45` renders `+n more` and `:37` renders `No equipment`, both as recorded.

## Coverage

Light does not require a recomputed Coverage section. I read the rows against the code anyway.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `SiteListRow` fields (9) | `application/ports/index.ts` `SiteListRow` (diff) | id, name, address, customerId, customer, active, assetCount, equipment, liveAgreement all inside the one `toEqual` at `readers.test.ts:712`; address null at the same test; `active:false` at C1381 | - |
| `SiteFilter` members (3) | `domain/records/index.ts` `SiteFilter` | q C1379; customerId C1378; showInactive C1381 | - |
| agreement statuses (7) | `LIVE_STATUSES` plus statuses in `C1370` table | 7 table rows at `readers.test.ts:755` | - |
| `GET /sites` statuses (2) | plan Surface | 200 C1374 (page renders; not an HTTP response); 307 C1375 (mocked `redirect`) | - (level note, finding 4) |
| filter parameters (3) | `parseSiteFilter` | q, customer, show all in C1377 | - |
| equipment cell cases (4) | `EquipmentCell` | 4 types, 3 types, none in C1373; 1 type used as the default row throughout C1372 | - |
| fixture sites (4) | checks Terms | C1368 (active, active-empty via C1369), C1381 (inactive, inactive customer) | - |

## Test policy rows

n/a under light.

## Faults injected

n/a under light.

## Replaced-assertion review

`git diff deb8619..29ecfc6 -- "*.test.ts"` touches these existing test files.
- `web/components/shell/nav-items.test.ts`: the C156 claim "has no page yet" now lists only `Imports` and `Task library`, and `["Sites & equipment", "/sites"]` moves into the C156 link list. This is the authorised replacement. Commit `f82502e`'s message names it ("Replaces the C156 claim that the item has no href").
- `web/domain/records/records.test.ts`: only the import line changed (`showInactive` to `parseSiteFilter, showInactive`).
- `web/infrastructure/supabase/readers.test.ts`: only the import list gained `supabaseSiteDirectory`.
- The other test files in the range are new (`sites-list.test.ts` twice).

No pre-existing test was edited beyond the authorised C156 claim. The two import-line edits are mechanical and do not change any assertion.

## Swept (existing rows)

- failure modes, dependency failure: `readers.ts` `if (error) throw unexpected(error)` is present in `supabaseSiteDirectory`, and C1371 asserts it. Confirmed.
- data lifecycle: `.filter((row) => filter.showInactive || row.active)` with `active: isActive(row) && isActive(row.customers)`. Confirmed.
- authorization: `page.tsx` `if (member.status !== "member") redirect("/login")` is present. The RLS-unchanged claim is true by diff: no migration or SQL file is in the range.
- validation: `parseSiteFilter` has the bound `SITE_SEARCH_MAX = 100` and the uuid and exact-`show` guards. Confirmed.

## Findings

1. Gap, ranked first: C1385 has no overlap observation at 768 px. The claim says "at 768 and 1440 px the same page renders without overlap". The Handoff records scroll width and 44 px targets at 768 px, but its only overlap statement is "Screenshots at 375 and 1440 px show no overlap". 768 px is where the `md:grid-cols-[...]` four-column row and the `md:flex-row` filter bar first apply (`sites-list.tsx:13,60,105`), so that is the width where overlap is most plausible. The 44 px part is consistent with the code (`LINK` has `min-h-11 lg:min-h-0`, so 768 px is under `lg`). I did not inspect whether `Button`, `TextInput` and `Select` reach 44 px; I relied on the record.
2. Precision, C1384 and `sitesHref`: the code's "Clear filters" link keeps `show=inactive` (`sites-list.tsx:73`, `sitesHref({}, showing)`). The live record confirms it ("Clear filters went to `/sites?show=inactive`"). The check text says the link's `href` is `/sites` and tests only the no-`show` case (`sites-list.test.ts:126`). The shipped behaviour with `show=inactive` and a filter is untested and does not match the check text literally. A mutant that drops `show` from that link would survive.
3. Precision, C1372 null address: `sites-list.test.ts:51` asserts `not.toContain("null")`. A wrong implementation rendering an em dash or an empty `<span>` would pass. The claim says "nothing when null". The status pill is likewise settled only by the label text `Sent to customer`, not by the pill element or tone.
4. Level, C1374 and C1375: both call `SitesForRequest` directly with `next/navigation` mocked. The `200` and the `307` are the framework's response to the page and `redirect()`. The Next page wrapper (`searchParams` awaited, `PageProps<"/sites">`) is not exercised, and C1385/C1386 only cover it live for signed-in users. Acceptable under light, but it is a level gap against the Coverage row "GET /sites statuses (2)".
5. C1386, text search: "a text search narrows by name" is recorded only combined with `customer=Brookhaven` (2 rows to 1), not as `q` alone. The narrowing is visible there, so I count it as covered.
6. Observation, C1368 ordering: the sort is `byName` on the customer then the site, and C1368 proves it on two customers plus one customer with two sites. No finding.

## Gate

- `npm test` in `web/`: 116 files, 2329 passed, 0 failed, exit 0.
- `npm run lint` in `web/`: exit 0, no output.
- `npx tsc --noEmit` in `web/`: exit 0, no output.
- Named-check batch: 41 passed, 0 failed.
