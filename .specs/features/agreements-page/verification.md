# Agreements page verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: 6cac032..884f5d8
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Batched proof run, from `web/`, at `884f5d8`:
`npx vitest run domain/agreement/list-filter.test.ts infrastructure/supabase/readers.test.ts components/agreements/agreements-list.test.ts components/kanban/pipeline-view.test.ts components/shell/nav-items.test.ts "app/(app)/agreements-list.test.ts" -t "C1347:|...|C1365:" --reporter=verbose`
exit 0 - 6 files, 46 passed, 75 skipped; every `C1347:`-`C1365:` test listed individually as passed (below, "run ok").

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1347 | parse keeps only the 7 status values, a uuid site, `expiring=1`; arrays keep nothing | run ok - 10 tests `C1347:` | `web/domain/agreement/list-filter.test.ts:10` - `expect(parseAgreementFilter({ status })).toEqual({ status })` (each of 7); `:14` - `expect(parseAgreementFilter({ status: "draft", site: "nope", expiring: "true" })).toEqual({})`; `:24` - array-valued -> `toEqual({})` | PASS |
| C1348 | `matchesStatusFilter` over the 8 fixture rows, per value | run ok - 7 tests `C1348:` | `web/domain/agreement/list-filter.test.ts:51` - `expect(names).toEqual(kept)` with the table `:42-48` (`refused` -> `["refused","expired"]`, `completed` -> `["accepted completed"]`, ...) | PASS |
| C1349 | `list({})` returns all 8 incl. withdrawn, newest first, with the 9 fields | run ok - 2 tests `C1349:` | `web/infrastructure/supabase/readers.test.ts:573` - `expect(rows.map((r) => r.id)).toEqual(["w", "e", "r", "k", "a", "s", "c", "d"])`; `:574-584` - `toEqual({ id: "w", number: "AG-w", status: "withdrawn", site, customer, versionNo: 1, annualCents: 400000, updatedAt, termEnd: null })` | PASS |
| C1350 | site filter returns only that site; `[]` when none | run ok - `C1350:` | `web/infrastructure/supabase/readers.test.ts:597` - `calls.some((c) => c.method === "eq" && c.args[0] === "site_id" && c.args[1] === SITE_ID)` `toBe(true)`; `:598` - `rows` `toEqual([])` | PASS |
| C1351 | expiring keeps today and today+90, drops today-1, +91, null, sent; uses latest version | run ok - `C1351:` | `web/infrastructure/supabase/readers.test.ts:615` - `expect(rows.map((r) => r.id).sort()).toEqual(["last", "today"])` over fixtures `:605-611` (past, late, none, sent, old-with-later-v2 all dropped) | PASS |
| C1352 | all given filters AND together | run ok - 2 tests `C1352:` | `web/infrastructure/supabase/readers.test.ts:629` - `expect(rows.map((r) => r.id)).toEqual(["hit"])` (wrong-status, wrong-site, wrong-date absent) | PASS |
| C1353 | row link, number, site, customer, status pill label, `v{n}`, `$4,000/yr`; term end date or no placeholder | run ok - 3 tests `C1353:` | `web/components/agreements/agreements-list.test.ts:37` - `toMatch(/<a[^>]*href="\/agreements\/a1"/)`; `:38-39` - contains `"AG-1048"`, `"Sent to customer"`, `"v3"`, `"$4,000/yr"`; `:44,46` - `toContain("2027-06-30")` / `not.toMatch(/\d{4}-\d{2}-\d{2}/)` | PASS |
| C1354 | "No agreements yet" vs "No agreements match" + Clear filters to `/agreements` | run ok - 2 tests `C1354:` | `web/components/agreements/agreements-list.test.ts:65` - `toMatch(/<a[^>]*href="\/agreements"[^>]*>Clear filters</)`; `:66` - `not.toContain("No agreements yet")`; `:58` - `toContain("No agreements yet")` | PASS |
| C1355 | labelled status and site Selects show current values; Expiring pressed only for `expiring=1` | run ok - 2 tests `C1355:` | `web/components/agreements/agreements-list.test.ts:71-74` - `<label for="status">Status`, `<label for="site">Site`, `<option value="sent" selected`, `<option value="${SITE}" selected`; `:75` / `:82` - expiring input `checked` / not checked | PASS |
| C1356 | page passes parsed filter + Vancouver day; invalid status = no status | run ok - 2 tests `C1356:` | `web/app/(app)/agreements-list.test.ts:38` - `toHaveBeenCalledWith({ status: "sent", siteId: SITE, expiring: true }, "2027-12-01")`; `:46-47` - both calls `toHaveBeenNthCalledWith(n, {}, "2027-12-01")` | PASS |
| C1357 | signed out on `/agreements` and `/agreements/new` -> `/login`, no lister called | run ok - `C1357:` | `web/app/(app)/agreements-list.test.ts:52-53` - both `rejects.toThrow("NEXT_REDIRECT /login")`; `:54-55` - `listAgreements` / `listActiveSites` `not.toHaveBeenCalled()` | PASS |
| C1358 | Agreements href `/agreements`; active on `/agreements`, `/agreements/ag-1`, not `/pipeline` | run ok - 3 tests `C1358:` (+ `C156: Agreements links to /agreements`) | `web/components/shell/nav-items.test.ts:19` - `expect(hrefOf(label)).toBe(href)` with `["Agreements", "/agreements"]` at `:15`; `:36` - `expect(link.includes('aria-current="page"')).toBe(current)` | PASS |
| C1359 | writer: Pipeline New agreement is `<a href="/agreements/new">`, not disabled, also on empty board | run ok - `C1359:` | `web/components/kanban/pipeline-view.test.ts:84` - `toMatch(/<a\b[^>]*href="\/agreements\/new"[^>]*>New agreement</)`; `:85` - `not.toMatch(/<[^>]*\sdisabled(?:=\|\s\|>)[^>]*>New agreement</)`, both over `[[], [card()]]` | PASS |
| C1360 | viewer: no New agreement on Pipeline or `/agreements` | run ok - `C1360:` in both files | `web/components/kanban/pipeline-view.test.ts:91` - `canCreate: false` -> `not.toContain("New agreement")`; `web/components/agreements/agreements-list.test.ts:86` - `list([row()], {}, "viewer")` `not.toContain("New agreement")` | PASS |
| C1361 | active sites with customer + live agreement; inactive absent; expired/refused not live | run ok - `C1361:` | `web/infrastructure/supabase/readers.test.ts:659` - `toEqual(["busy", "free", "past"])` (`off` absent); `:660-665` - busy `liveAgreement: { id: "x1", number: "AG-1001" }`; `:667` - past `liveAgreement` `toBeNull()` | PASS |
| C1362 | Select options = sites without live agreement, grouped by customer; busy site is an `AG-n` link | run ok - `C1362:` | `web/components/agreements/agreements-list.test.ts:100-101` - `<optgroup label="Harbourview">...Tower A`, `<optgroup label="Northside">...Plant 1`; `:102` - `not.toMatch(/<option[^>]*value="s2"/)`; `:103` - `<a href="/agreements/ag-9">AG-1009` | PASS |
| C1363 | submit calls create once with the siteId; viewer gets forbidden panel, no form | run ok - 3 tests `C1363:` | `web/components/agreements/agreements-list.test.ts:112-113` - `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(SITE)`; `web/app/(app)/agreements-list.test.ts:63-64` - contains "don't have permission to create agreements", `not.toContain("<form")` | PASS |
| C1364 | `open_exists` shows `AG-n` link; failure shows `messageFor` text | run ok - `C1364:` | `web/components/agreements/agreements-list.test.ts:118` - `toMatch(/<a[^>]*href="\/agreements\/ag-7"[^>]*>Open AG-1007</)`; `:121` - `unavailable` -> `toContain("We couldn&#x27;t save this. Try again.")` | PASS |
| C1365 | no eligible site -> empty panel with `/customers` link, no Select | run ok - `C1365:` | `web/components/agreements/agreements-list.test.ts:128-129` - `not.toContain("<select")`, `toMatch(/<a[^>]*href="\/customers"/)` for `[]` and an all-busy list | PASS |
| C1366 | 375 px no horizontal scroll, 44 px targets, filtered URL; 768/1440 no overlap | live, author-side, not re-run (verifier cannot sign in) | `.specs/features/agreements-page/checks.md:202` - Handoff "Live C1366": 375/768/1440, no horizontal scroll, `?status=accepted&expiring=1` -> 1 row AG-1035 with controls reflecting it, >= 44 px below 1024 px, console clean | PASS (author-side live, not re-run) |
| C1367 | estimator: Pipeline -> `/agreements/new` -> create draft -> lands on `/agreements/{id}` -> listed as Draft | live, author-side, create step NOT run | `.specs/features/agreements-page/checks.md:203` - only the navigation half recorded ("Pressing 'Create agreement' ... was not run"); create/land/list-as-Draft has no live record. Code-level pieces only: C1363 `agreements-list.test.ts:113`, page wiring `web/app/(app)/agreements/new/page.tsx:28` (`create={createAgreementAction}`), unchanged redirect `web/app/(app)/agreement-actions.ts:41` | PARTIAL - create half unproven live |

C1367: the half that was run (the enabled link and the grouped picker with three busy sites) is concrete. The other half - a
real `create_agreement` call through the form, the redirect to the builder, and the new row listed as Draft - is not proven
by any proof of this feature. C1362-C1365 prove the form markup and that `submitSite` hands the chosen id to an injected
`create`; nothing exercises the real action through the form. That is the claim C1367 exists to settle, so it is not PASS.
Closing it only needs the author-side create step run once in the demo org, which waits on the user's go-ahead (it writes
a row).

## Swept existing

- concurrency: confirmed. `supabase/migrations/20261027202354_agreement_builder.sql:10` -
  `create unique index agreements_one_live_per_site on public.agreements (site_id) where status in ('draft', 'sent', 'changes_requested')`;
  `supabase/migrations/20261103173437_deactivation_create_lock.sql:25` - `create_agreement` takes the site `for share`
  and raises `hint = 'site_inactive'`. The site lock guards deactivation; the race between two creates is decided by the
  unique index, and `web/infrastructure/supabase/agreements.ts:374` maps it to `open_exists`. The row's wording ("locks the
  site ... decide a race") is slightly loose but the cited constraints exist.
- authorization (RLS unchanged): confirmed. `supabase/migrations/20261019174738_init.sql:301-306` creates
  `for select to authenticated using ((select private.is_org_member(org_id)))` for `sites` and `agreements` (among
  others); the diff touches no migration.

## Findings

Non-failing observations, ranked:

1. **`show=inactive` in plan Surface is dead.** `GET /agreements` lists `show=inactive` as an input, but
   `web/domain/agreement/list-filter.ts:74-82` reads only `status`, `site`, `expiring`, and `rg -n "show"` over
   `agreements-list.tsx`, `agreements/page.tsx` and `list-filter.ts` finds nothing. The plan's own Assumptions row says
   "no Show inactive analogue", so Surface contradicts Assumptions; no check covers it. Remove it from Surface, or build it.
2. **Prior-feature spec checks not amended.** The plan's Impact row says design-system-base C17/C21 and staff-screens
   C118 "must be amended in the same commits". `.specs/features/design-system-base/checks.md:91,110` and
   `.specs/features/staff-screens/checks.md:135` still claim a disabled New agreement; the diff range does not touch
   them. Re-running those live checks would now fail.
3. **Amended C118 is vacuous.** `web/components/kanban/pipeline-view.test.ts:77` now reads
   `expect(html).not.toMatch(/<button[^>]*disabled[^>]*>New agreement</)` on `render([])`, which passes no `canCreate`,
   so no New agreement renders at all and the assertion cannot fail. The replacement is authorized by checks.md Terms and
   C1359 carries the real claim, but C118 now asserts nothing about the button. C156 (`nav-items.test.ts:22`) only
   removed "Agreements" from the no-page list and added it to the links table (`:15`) - matches Terms. No other
   pre-existing assertion in any `*.test.ts` was changed or deleted (`git diff 6cac032..HEAD -- "*.test.ts"`: only the
   three new files plus additions in `readers.test.ts`, `pipeline-view.test.ts`, `nav-items.test.ts`).
4. **Role -> `canCreate` on Pipeline is untested.** C1359/C1360 on Pipeline pass `canCreate` directly; the mapping
   `canCreate={role !== undefined && canWriteRecords(role)}` in `web/app/(app)/pipeline/page.tsx` has no test
   (`app/(app)/pipeline.test.ts:15` calls `PipelineForRequest({ view })` without a role). The checks.md coverage row
   "roles: owner/admin/estimator C1359" is therefore inaccurate for Pipeline; the three roles are proven only for the
   `/agreements` header (`agreements-list.test.ts:87-88`).
5. **Precision gap in C1352.** The check names `{ status: "sent", siteId, expiring: true }`, which cannot match anything
   (expiring is accepted-only). The test reasonably uses `status: "accepted"` (`readers.test.ts:627`). The check text
   should say `accepted`.
6. **C1350 asserts the query, not the narrowing.** `readers.test.ts:597-598` proves the `eq("site_id", ...)` call and an
   empty result for empty input; that the adapter drops another site's row is proven only inside C1352
   (`wrong-site` absent, `:624,629`).
7. **C1355 "none is a bare `<select>` without a label"** is asserted only positively (two labels present,
   `agreements-list.test.ts:71-72`), not as an absence of unlabelled selects. The site `Select` also lists only active
   sites (it reuses `listActiveSites`), so an inactive site's agreements are reachable by URL but not from the picker -
   "the org's sites" in C1355 is imprecise.
8. **C1364 messages are literals.** `agreements-list.test.ts:119-121` hard-codes the strings rather than comparing with
   `messageFor(...)`; fine as an assertion, but "the `messageFor` text" is not compared against `messageFor`.
9. **AC 9 (375 px, 44 px)** rests only on the author-side live C1366, as checks.md states; Handoff notes 34 px targets
   at 1440 px "by design", which AC 9 does not require.

## Gate

`npm test` (web/) - 2283 passed, 0 failed
`npm run lint` (web/) - exit 0, 0 errors
`npx tsc --noEmit` (web/) - exit 0, 0 errors
Batched named proofs - 46 passed, 0 failed (6 files)
