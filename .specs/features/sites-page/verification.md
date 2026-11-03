# Sites & equipment page verification

**Verdict**: PASS
**Profile**: light
**Diff range**: deb8619..c8697d7
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scope of round 2: the fix diff `29ecfc6..c8697d7` (`git diff --stat`: `web/components/sites/sites-list.test.ts` +15 lines, plus `.specs/features/sites-page/checks.md` and `verification.md`; no source file changed) and every round-1 non-PASS verdict (C1385). Everything else is carried and marked.

C1385 and C1386 are live Playwright checks the author ran. I cannot re-run them (sign-in is by emailed link); I judged only whether the Handoff record covers each claim and matches what the code renders.

Working tree: `git status --porcelain` was empty before I started (verified at c8697d7). It shows only this report after.

## Binding sources

n/a under light (Step 1 does not run).

## Checks

Proof run (verified at c8697d7; one invocation, `--reporter=verbose`, from `web/`):
`npx vitest run infrastructure/supabase/readers.test.ts components/sites/sites-list.test.ts "app/(app)/sites-list.test.ts" components/shell/nav-items.test.ts domain/records/records.test.ts -t "C1368:|C1369:|...|C1384:"`
Result: 5 files passed, 44 tests passed, 76 skipped, exit 0. Every C1368-C1384 test name showed individually as passed, including the three added ones.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1368 | 2 active sites of active customers, ordered, 9 fields | vitest batch above, exit 0 | `web/infrastructure/supabase/readers.test.ts:712` - `expect(rows.map((r) => r.id)).toEqual(["plain", "tower"])` and a `toEqual({id, name, address, customerId, customer, active: true, assetCount, equipment, liveAgreement: null})` on the second row; `:729` - `.toEqual(["alpha", "Bravo"])` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1369 | assetCount counts active assets only; equipment by count then code; empty site | same | `readers.test.ts:734` - `expect(by("s").assetCount).toBe(4)`, `expect(by("s").equipment).toEqual([{ code: "RTU", count: 3 }, { code: "BLR", count: 1 }])`, tie `toEqual([{AHU},{MUA}])`, `expect(by("e")).toMatchObject({ assetCount: 0, equipment: [] })` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1370 | live for draft/sent/changes_requested, null for the other 4 | same | `readers.test.ts:755` - table of 7; `expect(rows[0].liveAgreement).toEqual(live ? { id: "x1", number: "AG-1001", status } : null)` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1371 | capped at 500; Supabase error rejects | same | `readers.test.ts:760` - `c.method === "limit" && c.args[0] === 500`; `:765` - `.rejects.toThrow("Supabase error 42501")` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1372 | row links, address (nothing when null), count wording, live agreement link and pill label, header badge | vitest batch above, exit 0 (verified at c8697d7) | `web/components/sites/sites-list.test.ts:37` - `toMatch(/<a[^>]*href="\/sites\/s1"[^>]*>Harbourview Towers<\/a>/)`; `:46` - `toContain("1 asset<")`; `:55` - `href="\/agreements\/ag1"...AG-1001`; `:62` - `toContain("1 site<")`. New: `:133` - `expect(secondary(html([row()]))).toBe(2)` and `expect(secondary(html([row({ address: null })]))).toBe(1)` (counts `text-[12px] text-ink-2` spans); `:139` - `toMatch(/<span[^>]*title="In progress"[^>]*>(<span[^>]*><\/span>)?In progress<\/span>/)` | PASS (findings 3 resolved) |
| C1373 | up to 3 types, `+1 more`, none, `No equipment` | same | `sites-list.test.ts:69` - `toContain("T3 ×2")`, `not.toContain("T4")`, `toContain("+1 more")`; `:78` - `not.toContain("more")`, `toContain("No equipment")` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1374 | page parses `searchParams`, calls `listSites` with the filter, loads customers; invalid customer equals none | same | `web/app/(app)/sites-list.test.ts:33` - `expect(listSites).toHaveBeenCalledWith({ q: "tower", customerId: CUSTOMER, showInactive: true })`, `listCustomers` called once; `:41` - `toHaveBeenNthCalledWith(1, {})` and `(2, {})` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1375 | signed out goes to `/login`, nothing read | same | `sites-list.test.ts` (app):48 - `.rejects.toThrow("NEXT_REDIRECT /login")`, `expect(listSites).not.toHaveBeenCalled()`, `expect(listCustomers).not.toHaveBeenCalled()` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1376 | `MAIN_NAV` href `/sites`; current for `/sites` and `/sites/s-1`, not `/pipeline`, `/customers` | same | `web/components/shell/nav-items.test.ts:17` - `["Sites & equipment", "/sites"]` checked by `hrefOf(label)).toBe(href)` (:21); `:45` - `expect(link.includes('aria-current="page"')).toBe(current)` (:50) over the 4 paths | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1377 | `parseSiteFilter` bounds q at 100 and trims; uuid only; `show` exactly `inactive`; arrays keep nothing | same | `web/domain/records/records.test.ts:117` - `toEqual({ q: "x".repeat(100) })`, `toEqual({})` for blanks; `:124` - `parseSiteFilter({ customer: "nope" })).toEqual({})`; `:130` - `["Inactive","all","1",""]` give `{}`; `:135` - `parseSiteFilter({ q: ["a","b"], customer: [CUSTOMER], show: ["inactive"] })).toEqual({})` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1378 | only that customer's sites, `eq("customer_id", id)`, foreign row dropped, `[]` for none | same | `readers.test.ts:770` - `c.method === "eq" && c.args[0] === "customer_id" && c.args[1] === "cust-A"`; `result.rows.map((r) => r.id)).toEqual(["a"])`; unknown customer `.rows).toEqual([])` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1379 | q matches name, address or customer, ignores case, null address safe | same | `readers.test.ts:778` - `{ q: "HARBOUR" }` gives `["n"]` (null address); `{ q: "maple" }` gives `["a","c"]` (address and customer name); `{ q: "nothing" }` gives `[]` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1380 | both filters AND | same | `readers.test.ts:790` - `list(rows, { customerId: "cust-A", q: "maple" })).rows.map(id)).toEqual(["hit"])` with a wrong-customer and a wrong-text row present | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1381 | `showInactive` lists all 4 with flags, ordered, active assets only | same | `readers.test.ts:799` - `.toEqual(["plain", "gone", "orphan", "tower"])`, `active` `.toEqual([true, false, false, true])`, `gone` `assetCount).toBe(1)` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1382 | GET form to `/sites`, labelled q, labelled customer select, All customers, Apply filters | same | `sites-list.test.ts:85` - `form).toContain('method="get"')`, `'action="/sites"'`, `<label ... for="q"`, `<label ... for="customer"...>Customer</label>`, `<option value="${CUSTOMER}" selected="">`, `<button ... type="submit"...>Apply filters</button>` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1383 | Show/Hide inactive links keep q and customer; Inactive pill only on inactive row | same | `sites-list.test.ts:99` - `href="/sites?q=tower&amp;customer=${CUSTOMER}&amp;show=inactive"...>Show inactive`; `:105` - `href="/sites?q=tower&amp;customer=..."...>Hide inactive`, `expect(out.match(/>Inactive</g)?.length).toBe(1)`, `expect(html([row()])).not.toContain(">Inactive<")` | PASS (carried from 29ecfc6; proof re-run at c8697d7) |
| C1384 | empty vs no-match; Clear filters to `/sites`; absent with no filter | vitest batch above, exit 0 (verified at c8697d7) | `sites-list.test.ts:118` - `toContain("No sites yet")`, `href="\/customers"`, `not.toContain("Clear filters")`; `:126` - `toContain("No sites match")`, `href="\/sites"...>Clear filters`, `not.toContain("No sites yet")`. New: `:144` - `expect(html([], { q: "zzz", showInactive: true })).toMatch(/<a[^>]*href="\/sites\?show=inactive"[^>]*>Clear filters<\/a>/)` | PASS (finding 2 resolved) |
| C1385 | at 375 px no horizontal scroll and 44 px targets; at 768 and 1440 px no overlap | not re-run by me (live, sign-in by emailed link); Handoff read against `web/components/sites/sites-list.tsx` (verified at c8697d7) | `checks.md` Handoff "Live C1385": scroll width equals client width at 375, 768 and 1440 px; 44 px high controls and row links at 375 and 768 px (consistent with `sites-list.tsx:16` `min-h-11 lg:min-h-0`); 1440 px no overlap from screenshot; "Round 1 findings, resolved": 768x1024 run measured with `getBoundingClientRect`, no overlapping boxes in the filter bar (Search, Customer, Apply filters, Show inactive) or the four cells of a row, no horizontal scroll, no clipped element | PASS (see finding 1) |
| C1386 | sidebar link opens `/sites` and is current; several customers with equipment and live agreement; `customer` narrows; text search narrows by name; `show=inactive` toggle with filters kept | not re-run by me; Handoff read against `sites-list.tsx` | `checks.md` Handoff "Live C1386": `aria-current="page"` on the link; 17 sites of 13 customers with `RTU ×16`, `BOILER ×1 +5 more`, `No equipment`, AG-1044/1051/1057/1058; `customer=Brookhaven` gave 2 rows; adding `q=exhibition` gave 1; "Show inactive" kept both; "Hide inactive" linked back without `show` | PASS (carried from 29ecfc6; Handoff unchanged for C1386) |

Carried rows keep their round-1 `file:line` citations. The files they cite (`readers.test.ts`, `records.test.ts`, `nav-items.test.ts`, `app/(app)/sites-list.test.ts`, and the pre-existing tests in `sites-list.test.ts`, whose lines did not move because the three tests were appended at the end) are unchanged in `29ecfc6..c8697d7`, confirmed by `git diff --stat`. Their proofs were re-run in full above.

## Coverage

Not required under light. Carried from 29ecfc6: the round-1 rows stand because no source or authority file changed in the fix. The fix adds no set member.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `SiteListRow` fields (9) | `application/ports/index.ts` (carried from 29ecfc6) | all nine inside the `toEqual` at `readers.test.ts:712` | - |
| `SiteFilter` members (3) | `domain/records/index.ts` (carried from 29ecfc6) | q C1379; customerId C1378; showInactive C1381 | - |
| agreement statuses (7) | `LIVE_STATUSES` (carried from 29ecfc6) | 7 table rows at `readers.test.ts:755` | - |
| `GET /sites` statuses (2) | plan Surface (carried from 29ecfc6) | 200 C1374; 307 C1375 (level note, finding 4) | - |
| filter parameters (3) | `parseSiteFilter` (carried from 29ecfc6) | q, customer, show in C1377 | - |
| equipment cell cases (4) | `EquipmentCell` (carried from 29ecfc6) | C1373, C1372 | - |
| fixture sites (4) | checks Terms (carried from 29ecfc6) | C1368, C1381 | - |

## Test policy rows

n/a under light.

## Faults injected

n/a under light. I did not run mutants. I judged the three added tests by reasoning from their assertions against `web/components/sites/sites-list.tsx`:
- `C1372: a null address leaves out the address line` (`sites-list.test.ts:133`): the view renders the address only under `row.address && <span className="text-[12px] text-ink-2">` (`sites-list.tsx:113`), and the asset count is the other such span (`:120`). A mutant that always renders the address span (empty or with a dash) gives 2, not 1, and fails `toBe(1)`. A mutant that drops the address when present gives 1, not 2, and fails `toBe(2)`. Would fail under a wrong implementation: yes.
- `C1372: the status label is the text of its own pill` (`:139`): the regex needs a `<span title="In progress">` whose own text, after an optional dot span, is `In progress`. A mutant that drops the pill and prints the label as plain text, or puts the label outside the pill, fails. Would fail: yes. Limit: it does not assert tone, which the claim does not name.
- `C1384: Clear filters keeps show=inactive` (`:144`): the regex needs `href="/sites?show=inactive"`. A mutant calling `sitesHref({}, false)` (drops `show`, the round-1 survivor) yields `href="/sites"` and fails. A mutant passing the full filter yields `?q=zzz&show=inactive` and fails. Would fail: yes. The `:126` test still pins the no-`show` case, so the two together fix both branches.

## Replaced-assertion review

`git diff 29ecfc6..c8697d7 -- "*.test.ts"` shows one file, `web/components/sites/sites-list.test.ts`, with 15 added lines (three new `test(...)` blocks) and 0 removed lines. No pre-existing assertion was touched in the fix. The range-wide result from round 1 stands (carried from 29ecfc6): only the authorised C156 claim in `nav-items.test.ts` was replaced, plus two import-line edits.

## Swept (existing rows)

Carried from 29ecfc6: no source file changed in the fix, so the confirmations stand (error rejection in `supabaseSiteDirectory`, `showInactive` filter on `active`, the `member.status` redirect, `SITE_SEARCH_MAX = 100`).

## Findings

1. C1385, round-1 gap closed: the missing 768 px overlap record is now in the Handoff, and it is a measurement (`getBoundingClientRect` boxes of the filter bar controls and the four row cells, no overlap, no horizontal scroll, no clipped element), taken at 768x1024 where `md:` first applies. Each part of the claim now has a record: no horizontal scroll at 375 px, every control and row link at least 44 px high at 375 px, no overlap at 768 px (measured) and at 1440 px (screenshot observation). Residual: it is author-recorded and I could not re-run it; the 1440 px overlap evidence is a visual screenshot, not a measurement; I did not inspect whether `Button`, `TextInput` and `Select` reach 44 px and relied on the record. Under light I accept this as PASS.
2. C1384 precision, resolved by `sites-list.test.ts:144`. The check text in `checks.md` still says the link's `href` is `/sites`; the Handoff records that the view keeps `show=inactive` while inactive sites are shown and the test pins it. The claim wording was not changed; minor.
3. C1372 null address and pill, resolved by `:133` and `:139` (see Faults injected).
4. Level, C1374 and C1375 (carried from 29ecfc6, unchanged): both call `SitesForRequest` directly with `next/navigation` mocked; the Next page wrapper is seen only live for a signed-in user. Accepted under light and recorded in the Handoff.
5. C1386 text search (carried from 29ecfc6, unchanged): recorded combined with `customer`; each filter alone is proven by C1378 and C1379.

## Gate

- `npm test` in `web/`: 116 files, 2332 passed, 0 failed, exit 0 (round 1 was 2329; the 3 extra are the added tests).
- `npm run lint` in `web/`: exit 0, no output.
- `npx tsc --noEmit` in `web/`: exit 0, no output.
- Named-check batch: 44 passed, 0 failed, 76 skipped (other tests in the five files).
