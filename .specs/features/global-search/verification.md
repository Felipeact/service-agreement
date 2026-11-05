# Global search verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: 55c7464..HEAD
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

HEAD is `2cdd6ba`. Two things hold the verdict at FAIL under the gate's rules, which accept no "PASS with limits" field:
(1) C1593 and C1595 are live-only and cannot be re-run by a Verifier, so their Result is not PASS-by-verifier;
(2) one extra (not required at light) fault survived: swapping trim-then-cut for cut-then-trim in `parseSearchQuery` leaves C1570 green (see Faults injected).
The code itself matched every other claim. Every vitest and SQL proof is green at HEAD.

## Checks

Proofs run at HEAD (one invocation per runner, see Gate). Each named vitest test showed up individually as passed in `--reporter=verbose` output; the `rg -n` hit for each is the `file:line` quoted as the test location. SQL assertions are in `supabase/tests/search.sql`; `npm run test:db search` printed `PASS search` and `tests.ok` raises on any false condition (`supabase/tests/fixture.sql:34-40`), so every labelled assertion below executed and held.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1552 | function exists: invoker, stable, `search_path=''`, 8 columns, `authenticated` can execute | `npm run test:db search` exit 0 (`PASS search`) | `supabase/tests/search.sql:75` `not prosecdef`; `:77` `proconfig = array['search_path=""']`; `:79-81` `pg_get_function_result(f) = 'TABLE(kind text, id uuid, ... type_name text)'`; `:82` `has_function_privilege('authenticated', f, 'execute')`; stable `:76` | PASS |
| C1553 | customer name, any case | same | `search.sql:90` `sr_titles('harb','customer') = 'Harbourview Strata'`; `:91` `sr_titles('HARB', ...)` same | PASS |
| C1554 | site name | same | `search.sql:97` `sr_titles('tower','site') = 'North Tower'` | PASS |
| C1555 | site address; null address not an error | same | `search.sql:103` `sr_titles('main st','site') = 'North Tower'` (exact, so the null-address site is absent); `:104` `sr_titles('plain','site') = 'Plain Site'` | PASS |
| C1556 | unit number; null unit never returned | same | `search.sql:110` `sr_titles('rtu-3','asset') = 'RTU-3'`; `:113` `min(r.kind) = 'asset'`; `:111-112` no null title for `rtu` | PASS (weak, see G6) |
| C1557 | customer hit shape | same | `search.sql:121` `r.title = 'Harbourview Strata' and r.customer_name = 'Harbourview Strata'`; `:122` `site_id/site_name/address/type_name is null` | PASS |
| C1558 | site hit shape | same | `search.sql:130` title, site_name, customer_name; `:131` `r.site_id = tests.id('sr:tower') and r.id = ... and r.address = '12 Main St'`; `:132` `type_name is null` | PASS |
| C1559 | asset hit shape | same | `search.sql:140` `r.title = 'RTU-3' and r.type_name = 'Rooftop unit'`; `:141` site_id, site_name, customer_name; `:142` `address is null` | PASS |
| C1560 | `%`, `_`, `\` literal, decoy `Lit AxB` present | same | `search.sql:148` `sr_titles('%','customer') = 'Lit A%B'`; `:149` `'_'` -> `'Lit A_B'`; `:150` `'\'` -> `'Lit A\B'`; decoy inserted `:45` | PASS |
| C1561 | prefix first, then title, then id | same | `search.sql:160` `sr_titles('xylo','customer') = 'Xylophone\|Ab Xylo'` (title order alone would give the reverse, so this discriminates the prefix rule); `:162-165` ids of `dup twin` equal `least\|greatest` (md5 ids: dup2 `52aea...` < dup1 `fb839...`, opposite to insertion order, so a missing id tie-break fails); `:158` the `an` example is alphabetical anyway | PASS |
| C1562 | `p_limit` caps each kind | same | `search.sql:171-173` three `sr_count('trio', kind, 2) = 2`; `:174` total `= 6` | PASS |
| C1563 | clamp 1..100 | same | `search.sql:180` limit 0 -> 1; `:181` -5 -> 1; `:182` 1000 -> `= 100` (101 match) | PASS |
| C1564 | blank query: no row, no error | same | `search.sql:188` null `count = 0`; `:189` empty; `:190` spaces; `:191` tab/newline | PASS |
| C1565 | trims | same | `search.sql:197` `sr_titles('  harb  ') = sr_titles('harb') and = 'Harbourview Strata'` | PASS |
| C1566 | six inactive cases, each with an active sibling | same | `search.sql:208` customers `= 'Ghost Cust On'` (exact); `:210` sites `= 'Ghost Site On'`; `:212` assets `= 'GHOST-ON'`; `:213-215` OFF / OFFSITE / OFFCUST not in the list; child site excluded by `:210` equality | PASS |
| C1567 | other org and no-membership get nothing | same | `search.sql:235` org B `harb` count 0; `:236` `rtu-3` 0; `:237` org B own `customer` > 0; `:242` uX `customer` count 0 (org A names are `Customer A`, `fixture.sql:136`, so the text would match if tenancy leaked) | PASS |
| C1568 | four roles, same non-empty result | same | `search.sql:224-226` loop over `uA, uAdm, uE, uV`: `sr_titles('harb','customer') = 'Harbourview Strata'` | PASS |
| C1569 | `anon` raises 42501; `public` holds no execute | same | `search.sql:249` `expect_error('C1569 anon', 'select * from public.search_records(...)', '42501')`; `:254-255` no `aclexplode` row with `grantee = 0`; revoke/grant `migrations/20261105210000_global_search.sql:64-65` | PASS |
| C1570 | `parseSearchQuery` trims, cuts to 100, trims again; missing/array/blank give `""`; other params ignored | `npx vitest run ... -t` pattern, passed | `domain/records/records.test.ts:190` `toBe("tower")`; `:191` 120 a's `toBe("a".repeat(100))`; `:192` `98a + 3 spaces + 20b` -> 98 a's; `:193-195` `{}`, array, blank -> `""`; `:196` other params ignored. No input has leading whitespace together with more than 100 characters, so trim-before-cut is not pinned (G1) | PASS as written, mutant survives |
| C1571 | one RPC call `{p_query, p_limit: 26}` | same | `infrastructure/supabase/readers.test.ts:886-887` `rpc` called once; `:888` `toHaveBeenCalledWith("search_records", { p_query: "harb", p_limit: 26 })` | PASS |
| C1572 | sorted by kind, order kept, camel-case mapping | same | `readers.test.ts:893-904` `customers.hits` / `sites.hits` / `equipment.hits` `toEqual` with distinct customer and site values (`customerName: "Customer 1"` vs `name: "site 1"`); input interleaved `asset, customer, site, customer, site`; `:907-908` null address | PASS |
| C1573 | 26 -> 25 + `more`; exactly 25 -> `more` false; kinds independent | same | `readers.test.ts:914` customers `toHaveLength(25)`; `:915` `hits[24].id = "customer-25"`; `:916` `more` true; `:917-918` sites 25 -> `more` false; `:919-920` equipment 3 | PASS (not coupled to `p_limit`, see G3) |
| C1574 | RPC error throws `Error` carrying the code | same | `readers.test.ts:926` `rejects.toThrow("XX000")` | PASS |
| C1575 | `getContainer().searchRecords` from the session client, never the service-role/invitation client | same | `composition/composition.test.ts:87` `typeof container.searchRecords === "function"`; `:96` session client `rpc` `toHaveBeenCalledWith("search_records", ...)`; `:98` `plainRpc` `not.toHaveBeenCalled()`; assembly read: `composition/index.ts:132` `searchRecords: supabaseRecordSearch(supabase).search` | PASS |
| C1576 | `/search?q= tower ` reads `tower`, renders three groups | `-t` pattern, passed | `app/(app)/search.test.ts:38` `toHaveBeenCalledTimes(1)`; `:39` `toHaveBeenCalledWith("tower")`; `:40-45` `Customers`, `Sites`, `Equipment`, both hrefs, `RTU-3` | PASS |
| C1577 | blank `q`: prompt, no DB call | same | `search.test.ts:52` prompt text; `:53` `searchRecords not.toHaveBeenCalled()`; `test.each` over `{}`, `""`, `"   "`, array | PASS |
| C1578 | signed out -> `/login`, no read | same | `search.test.ts:59` `rejects.toThrow("NEXT_REDIRECT /login")`; `:60` `redirect` called with `/login`; `:61` `searchRecords` not called | PASS (page-level, see G5) |
| C1579 | read rejects -> page rejects | same | `search.test.ts:66` `rejects.toThrow("XX000")` (a rejected promise renders no partial result) | PASS |
| C1580 | `loading.tsx`: "Search" title + `aria-busy` | `-t` on `screens.test.ts`, passed | `app/(app)/screens.test.ts:59` `/<h1[^>]*>Search<\/h1>/`; `:60` `role="status"…Loading…`; `:61` `/^<div[^>]*aria-busy="true"/` | PASS |
| C1581 | order Customers, Sites, Equipment; counts; empty group omitted | `-t` on `search.test.ts`, passed | `components/search/search.test.ts:24` `headings(full)` `toEqual(["Customers 2","Sites 1","Equipment 1"])`; `:27` `["Sites 1"]` | PASS |
| C1582 | customer row link + name | same | `search.test.ts:32` `text(anchor(html,"/customers/c1")).trim()` `toBe("Harbourview Strata")` | PASS |
| C1583 | site row: name, customer, address; none when null | same | `search.test.ts:37` anchor text `toBe("North Tower Harbourview Strata 12 Main St")`; `:40` `toBe("North Tower Harbourview Strata")` | PASS |
| C1584 | equipment row links to the site page | same | `search.test.ts:45` `anchor(html,"/sites/s9")` text `toBe("RTU-3 Rooftop unit South Annex Pacific Mall")` (`siteId` `s9` differs from the hit `id` `a1`) | PASS |
| C1585 | Refine note under a `more` group only | same | `search.test.ts:50` exactly one match of the note; `:52-54` `sections[0]` contains it, `[1]` and `[2]` do not | PASS |
| C1586 | no-match message + deactivated line | same | `search.test.ts:59` `No customers, sites or equipment match “zzzz”.`; `:60` `Deactivated records are not searched.`; `:61` no `<h2` | PASS |
| C1587 | typed markup escaped in field, empty message, row title | same | `search.test.ts:67` `not.toContain("<img")`; `:68` `&lt;img src=x onerror=alert(1)&gt;`; `:69` `value="&lt;img…&gt;"`; `:72-73` row title | PASS (row title: customers only, see G7) |
| C1588 | GET form to `/search`, input `q` prefilled, labelled, Search button | same | `search.test.ts:79-80` `method="get"`, `action="/search"`; `:83-85` `name="q"`, `value="tower"`, `aria-label="Search"`; `:86` `<button…type="submit">Search</button>` | PASS |
| C1589 | sidebar GET form, input `q`, name "Search" | `-t` on `app-shell.test.ts`, passed | `components/shell/app-shell.test.ts:19-20` `method="get"`, `action="/search"`; `:23-24` `name="q"`, `aria-label="Search"` | PASS |
| C1590 | top-bar link `size-11`; sidebar `hidden lg:flex` | same | `app-shell.test.ts:29` `aria-label="Search"`; `:30` `size-11` anchored; `:31` link after `</aside>`; `:32` aside class `hidden … lg:flex` | PASS (placement loose, see G4) |
| C1591 | sidebar field, page field, page button carry anchored `h-11` and `lg:h-[34px]` | `-t` on both files, passed | `app-shell.test.ts:37-38` input `h-11` / `lg:h-\[34px\]`; `search.test.ts:94-95` same regexes for input and button; both anchor on whitespace or quote so `sm:h-11` cannot match | PASS |
| C1592 | `npm test`, lint, tsc, build, `test:db` exit 0; `/search` in the route table | `npm run test:db`: 23 passed, 0 failed (re-run by me); the rest were not re-run (see Gate) | `npm run test:db` printed `PASS search` and `23 passed, 0 failed`; `npm test`, lint, tsc and build are the author's Handoff record (`checks.md:289`) | PASS for `test:db` only; the other four are author-run (not independently re-run) |
| C1593 | live: sidebar Enter at 1440; top-bar link at 375, 44 px controls, no horizontal scroll with a 250-character name, 0 console errors | not rerunnable (browser) | author record `checks.md:294` (1440: `scrollWidth 1440 = clientWidth 1440`; 375: `scrollWidth 360 = clientWidth 360`, 44x44 link, console 0/0). Static halves are proven by C1589-C1591 | author-run, not independently re-run |
| C1594 | advisors show no new finding for `search_records` | `get_advisors` security on `gnxebrtcpbujhvcamtoe`, re-run at HEAD | after-state: `anon` 5 findings, `authenticated` 17, none names `search_records`; same counts as the author's record (`checks.md:293`). The before-snapshot cannot be taken now (migration already applied), so the before/after difference is author-recorded. `security invoker` at `migrations/20261105210000_global_search.sql:20`, revoke/grant `:64-65` | PASS (after-state re-run; before-state author-recorded) |
| C1595 | live: unit-number search returns an Equipment row whose link opens the site page; `zzzz` shows the no-match message | not rerunnable (browser) | author record `checks.md:294` (`?q=ahu-1` two Equipment rows, Tidewater link opened its site page; `zzzz` message shown). Static halves: C1584, C1586 | author-run, not independently re-run |
| C1596 | `nav-items.test.ts` and `layout.test.ts` pass unchanged; DESIGN.md Shell names the field and the link | `npx vitest run components/shell/nav-items.test.ts "app/(app)/layout.test.ts"`: 2 files, 32 passed; `grep -n "/search" ../DESIGN.md` exit 0 | both test files absent from `git diff 55c7464..HEAD --stat` (unchanged); `DESIGN.md:200` "a search field (a GET form to `/search?q=`, 34px tall)" and "The top bar also carries a 44px Search link to `/search`" | PASS |

Proven by the Verifier at HEAD with located evidence: 42 of 45 (C1552-C1592 and C1594, C1596; C1592 counts for its `test:db` part with the other four commands author-run). Author-run, not independently re-run: C1593, C1595.

## Coverage

Recomputed by hand from the code and the plan (`Surface`, `Landing`), not read from the author's table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| search fields (4) | migration `where` clauses (`cu.name`, `si.name`, `si.address`, `a.unit_no`) | C1553 `search.sql:90`, C1554 `:97`, C1555 `:103`, C1556 `:110`; the address and unit paths are also mutation-visible because no other field matches those texts | - |
| hit kinds (3) | migration `kind` literals | C1557, C1558, C1559; adapter mapping C1572 | - |
| `GET /search` statuses (2 in Surface) | plan Surface; `page.tsx:15` | 200 C1576; redirect `/login` C1578 (page level; proxy matcher `web/proxy.ts:11` covers `/search`; unsigned 307 seen live by the author) | - |
| `rpc search_records` statuses (3 in Surface) | plan Surface | rows C1553; none for blank / no match C1564; `42501` C1569 | - |
| Landing doors (2) | plan Landing | door 1 C1552, C1553-C1569, C1571; door 2 C1570, C1576, C1588 (`?q=` only parameter: C1570 `records.test.ts:196`) | - |
| inactive cases (6) | AD-116 / migration `deactivated_at` predicates | all six in `search.sql:208-215`, each with an active sibling | - |
| roles (4) | `memberships.role` | `search.sql:224` `uA, uAdm, uE, uV` | - |
| `p_limit` bounds (4) | migration `greatest(1, least(100, ...))` | `search.sql:171` per kind, `:180` 0, `:181` -5, `:182` 1000, adapter 26 `readers.test.ts:888` | - |
| group cap edges (2) | `readers.ts` `hits.length === SEARCH_GROUP_LIMIT` | 25 -> `more` false `readers.test.ts:917-918`; 26 -> true `:914-916` | - |
| page states (4) | plan AC 15, 16, 18, 19 | prompt C1577, no match C1586, loading C1580, error C1579 | - |
| shell entries (2) and controls with two heights (3) | `app-shell.tsx:50-52, 70-80`, `search-view.tsx:39-44` | C1589, C1590; C1591 in both test files | - |
| startup configuration: container (1 assembly) | `composition/index.ts:132` read directly | C1575 observes the session client is the one called | - |
| Swept `existing` row (authorization) | RLS on `customers`, `sites`, `assets` decides the tenant | code agrees: migration `security invoker` `:20`; C1567 would fail if the function bypassed RLS (`search.sql:235-242`) | - |

No set was found that the artifacts name but give no row. A level check on the claims that name a status or shape: C1569 (`42501`) is proven at the database; C1576 and C1578 are proven at the page component and the plan puts the redirect on the proxy (level observation G5, not a gap in proof of the page's own `redirect`).

## Faults injected

Extra at `light`, run in an isolated `git worktree` of HEAD (not `git stash`); the real tree's `git status --porcelain` was empty before and after (identical). The worktree and its `node_modules` junction were removed.

| Mutation | Location | Killed |
| --- | --- | --- |
| `p_limit: SEARCH_GROUP_LIMIT + 1` -> `SEARCH_GROUP_LIMIT` | `web/infrastructure/supabase/readers.ts:577` | yes - C1571 fails (`expected vi.fn() to be called with arguments`). C1573 does NOT fail: the stub returns whatever rows the test hands it, so the adapter's 25 cap is not tied to the value sent as `p_limit` (G3) |
| remove `name="q"` from the sidebar `SearchInput` | `web/components/shell/app-shell.tsx:51` | yes - C1589 fails (`expected '<input type="search" aria-label="Sear…' to contain 'name="q"'`); C1590 and C1591 stay green |
| cut before trimming: `q.trim().slice(0,100).trim()` -> `q.slice(0,100).trim()` | `web/domain/records/index.ts:99` | no - C1570 stays green (the mutant survives) |

The third row is a real surviving mutant: `parseSearchQuery` is allowed to return fewer than 100 characters for input with leading spaces and 100+ characters, against AC 17 ("the first 100 characters after trimming") and the C1570 wording.

## Gate

- `npx vitest run domain/records/records.test.ts infrastructure/supabase/readers.test.ts composition/composition.test.ts "app/(app)/search.test.ts" "app/(app)/screens.test.ts" components/search/search.test.ts components/shell/app-shell.test.ts components/shell/nav-items.test.ts "app/(app)/layout.test.ts" -t "C15(7[0-9]|8[0-9]|9[0-1]|96):"` from `web/` - 7 files passed, 27 passed, 0 failed (the 172 skipped are other checks' tests, filtered by `-t`; the two shell files with no C1596-named test were run unfiltered below).
- `npx vitest run components/shell/nav-items.test.ts "app/(app)/layout.test.ts"` - 2 files, 32 passed, 0 failed (C1596).
- `npm run test:db search` from `web/` - `PASS search`, 1 passed, 0 failed.
- `npm run test:db` from `web/` - 23 passed, 0 failed (includes `search`).
- `grep -n "/search" ../DESIGN.md` - exit 0 (`DESIGN.md:200`).
- Supabase `get_advisors` (security) on `gnxebrtcpbujhvcamtoe` - anon 5, authenticated 17, no finding names `search_records`.
- Not re-run by me: `npm test` (full), `npm run lint`, `npx tsc --noEmit`, `npm run build` (C1592 remainder, author record 2680 passed), and the Playwright runs (C1593, C1595).
- `python3 .claude/skills/tlc-spec-lean/scripts/validate_verification.py global-search` - see the chat report for its exit code (the report is not edited to fit it).

## Findings (ranked)

- G1 (fails the feature: surviving mutant) - C1570 - `web/domain/records/records.test.ts:190-196` vs `web/domain/records/index.ts:99`. No case has leading whitespace and more than 100 characters, so `slice(0,100).trim()` passes. Add `parseSearchQuery({ q: "   " + "a".repeat(120) })` expecting `"a".repeat(100)`.
- G2 (not a verifier PASS) - C1593, C1595 - live checks, author-run only (`checks.md:294`); and C1592's `npm test`, lint, tsc and build were not re-run by me.
- G3 (precision gap) - C1573/C1571 - `web/infrastructure/supabase/readers.test.ts:888,913-920`. The 26-vs-25 contract between the value sent as `p_limit` (`readers.ts:577`) and the adapter's cap (`readers.ts:582`) is proven only by the literal `26` in C1571; C1573 feeds rows directly and cannot notice if `p_limit` is wrong. The check's wording is met, but a single test cannot fail when the two drift apart other than C1571.
- G4 (precision gap) - C1590 - `components/shell/app-shell.test.ts:31`. It proves the link follows `</aside>`, not that it is inside the top-bar `div` (`app-shell.tsx:57`, `lg:hidden`); AC 2 "below 1024 px the top bar shows it" is therefore proven by position, not by containment.
- G5 (level note) - C1578 - `app/(app)/search.test.ts:57-62`. Plan Surface puts the signed-out redirect on the proxy; the test proves the page's own fallback with a mocked `redirect`. The proxy matcher (`web/proxy.ts:11`) covers `/search` and the author saw a 307 live, but there is no `/search` assertion in the proxy tests.
- G6 (weak assertion) - C1556 - `search.sql:111-112`. "No null title" cannot fail: `position(q in lower(coalesce(unit_no,'')))` never matches a null unit for a non-blank query. The null-unit fixture row (`:41`) is present, so only a rewrite that returned blank-query matches would trip it.
- G7 (sampling) - C1587 - `components/search/search.test.ts:71-73`. Row-title escaping is shown for customer rows only, and the field value only for the empty state; site and equipment titles and the prefilled field in the non-empty state are not shown. React escapes them all the same way, so risk is low.
- G8 (sampling) - C1568 - `search.sql:226`. The four roles are compared on the customer kind only, not on all three groups, against "the same non-empty result".

Swept `existing` rows: authorization (RLS decides the tenant, AD-015) is present in the code: `security invoker` at `migrations/20261105210000_global_search.sql:20` with no `security definer`. The `n/a` rows are user-approved policy.
