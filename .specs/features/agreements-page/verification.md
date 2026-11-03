# Agreements page verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 6cac032..5f0a4cd (fix diff 884f5d8..5f0a4cd: `1c05115` tests, `5f0a4cd` docs)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scope of this round: proofs re-run in full at `5f0a4cd`; rows touched by the fix diff (C1350, C1359, the C118 amendment)
and the round 1 non-PASS row (C1367) re-judged from scratch; every other row `carried from 884f5d8` with its citation
re-located at `5f0a4cd` (line numbers in `readers.test.ts` and `pipeline-view.test.ts` moved).

Batched proof run, from `web/`, at `5f0a4cd` (verified at 5f0a4cd):
`npx vitest run domain/agreement/list-filter.test.ts infrastructure/supabase/readers.test.ts components/agreements/agreements-list.test.ts components/kanban/pipeline-view.test.ts components/shell/nav-items.test.ts "app/(app)/agreements-list.test.ts" "app/(app)/pipeline.test.ts" -t "C13(4[7-9]|5[0-9]|6[0-7]):|C118:|C156:" --reporter=verbose`
exit 0 - 7 files, 59 passed, 70 skipped; every `C1347:`-`C1365:` test, `C118:` and `C156:` listed individually as passed
("run ok" below). The 5 new `C1359:` role tests in `app/(app)/pipeline.test.ts` appear individually (owner, admin,
estimator `true`; viewer, undefined `false`).

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1347 | parse keeps only the 7 status values, a uuid site, `expiring=1`; arrays keep nothing | run ok - 10 tests `C1347:` | carried from 884f5d8, lines unchanged: `web/domain/agreement/list-filter.test.ts:10` - `expect(parseAgreementFilter({ status })).toEqual({ status })` (each of 7); `:14` - `toEqual({})` for draft/nope/true; `:20` - `toEqual({ siteId: SITE, expiring: true })`; `:24` - array-valued -> `toEqual({})` | PASS |
| C1348 | `matchesStatusFilter` over the 8 fixture rows, per value | run ok - 7 tests `C1348:` | carried from 884f5d8: `web/domain/agreement/list-filter.test.ts:51` - `expect(names).toEqual(kept)` (test names show each kept set, e.g. `refused keeps ["refused","expired"]`) | PASS |
| C1349 | `list({})` returns all 8 incl. withdrawn, newest first, with the 9 fields | run ok - 2 tests `C1349:` | carried from 884f5d8, re-located: `web/infrastructure/supabase/readers.test.ts:573` - `expect(rows.map((r) => r.id)).toEqual(["w", "e", "r", "k", "a", "s", "c", "d"])`; `:574` - `rows.find((r) => r.id === "w")` `toEqual({...9 fields})`; `:592` - `toMatchObject({ versionNo: 2, annualCents: null, termEnd: "2027-06-30" })` | PASS |
| C1350 | site filter returns only that site; `[]` when none | run ok - `C1350:` | re-judged at 5f0a4cd: `web/infrastructure/supabase/readers.test.ts:597` - `eq("site_id", SITE_ID)` call `toBe(true)`; `:598` - `rows` `toEqual([])`; new `:600` - `expect(mixed.rows.map((r) => r.id)).toEqual(["mine"])` over `row("mine", ..., { site_id: SITE_ID })` and `row("other", "sent")` (default `site_id` is `ID`, `:13`, a different uuid). The stub ignores `eq`, so this assertion exercises the adapter's own drop at `web/infrastructure/supabase/readers.ts:442` (`if (filter.siteId && row.site_id !== filter.siteId) continue`) and would fail if it were removed | PASS |
| C1351 | expiring keeps today and today+90, drops today-1, +91, null, sent; latest version | run ok - `C1351:` | carried from 884f5d8, re-located: `web/infrastructure/supabase/readers.test.ts:617` - `expect(rows.map((r) => r.id).sort()).toEqual(["last", "today"])`; `:618` - `termEnd` `toBe("2026-11-03")` | PASS |
| C1352 | all given filters AND together | run ok - 2 tests `C1352:` | carried from 884f5d8, re-located: `web/infrastructure/supabase/readers.test.ts:631` - `expect(rows.map((r) => r.id)).toEqual(["hit"])`; `:636` - `toEqual(["k"])` (status filter incl. contract) | PASS |
| C1353 | row link, number, site, customer, pill label, `v{n}`, `$4,000/yr`; term end or no placeholder | run ok - 3 tests `C1353:` | carried from 884f5d8, lines unchanged: `web/components/agreements/agreements-list.test.ts:37` - `toMatch(/<a[^>]*href="\/agreements\/a1"/)`; `:39` - `toContain(text)` over number/site/customer/"Sent to customer"/"v3"/"$4,000/yr"; `:44` - `toContain("2027-06-30")`; `:46` - `not.toMatch(/\d{4}-\d{2}-\d{2}/)` | PASS |
| C1354 | "No agreements yet" vs "No agreements match" + Clear filters to `/agreements` | run ok - 2 tests `C1354:` | carried from 884f5d8: `web/components/agreements/agreements-list.test.ts:58` - `toContain("No agreements yet")`; `:65` - `toMatch(/<a[^>]*href="\/agreements"[^>]*>Clear filters</)`; `:66` - `not.toContain("No agreements yet")` | PASS |
| C1355 | labelled status/site Selects with current values; Expiring pressed only for `expiring=1` | run ok - 2 tests `C1355:` | carried from 884f5d8: `web/components/agreements/agreements-list.test.ts:71-74` - `<label for="status">Status`, `<label for="site">Site`, `<option value="sent" selected`, site option selected; `:75` - expiring input `checked`; `:82` - not checked | PASS |
| C1356 | page passes parsed filter + Vancouver day; invalid status = no status | run ok - 2 tests `C1356:` | carried from 884f5d8: `web/app/(app)/agreements-list.test.ts:38` - `toHaveBeenCalledWith({ status: "sent", siteId: SITE, expiring: true }, "2027-12-01")`; `:46-47` - `toHaveBeenNthCalledWith(n, {}, "2027-12-01")` | PASS |
| C1357 | signed out on `/agreements` and `/agreements/new` -> `/login`, no lister called | run ok - `C1357:` | carried from 884f5d8: `web/app/(app)/agreements-list.test.ts:52-53` - both `rejects.toThrow("NEXT_REDIRECT /login")`; `:54-55` - both listers `not.toHaveBeenCalled()` | PASS |
| C1358 | Agreements href `/agreements`; active on `/agreements`, `/agreements/ag-1`, not `/pipeline` | run ok - 3 tests `C1358:` (+ `C156: Agreements links to /agreements`) | carried from 884f5d8: `web/components/shell/nav-items.test.ts:19` - `expect(hrefOf(label)).toBe(href)`; `:36` - `expect(link.includes('aria-current="page"')).toBe(current)` | PASS |
| C1359 | writer: Pipeline New agreement is `<a href="/agreements/new">`, not disabled, also on empty board | run ok - `C1359:` in `pipeline-view.test.ts` + 5 `C1359:` in `pipeline.test.ts` | re-judged at 5f0a4cd: `web/components/kanban/pipeline-view.test.ts:86` - `toMatch(/<a\b[^>]*href="\/agreements\/new"[^>]*>New agreement</)`; `:87` - `not.toMatch(...)` of any tag carrying a `disabled` attribute before `>New agreement<`, over `[[], [card()]]`. Role mapping: `web/app/(app)/pipeline.test.ts:47` - `expect(/<a\b[^>]*href="\/agreements\/new"[^>]*>New agreement</.test(out)).toBe(shown)` for owner/admin/estimator `true`, viewer/undefined `false`, calling the real `PipelineForRequest({ view: undefined, role })` whose `canCreate={role !== undefined && canWriteRecords(role)}` (`web/app/(app)/pipeline/page.tsx:20`) is the mapping under test; flipping the condition or `canWriteRecords` fails the table | PASS |
| C1360 | viewer: no New agreement on Pipeline or `/agreements` | run ok - `C1360:` in both files | carried from 884f5d8, re-located: `web/components/kanban/pipeline-view.test.ts:92-93` - default and `canCreate: false` `not.toContain("New agreement")`; `web/components/agreements/agreements-list.test.ts:86` - `list([row()], {}, "viewer")` `not.toContain("New agreement")`; also `web/app/(app)/pipeline.test.ts:47` viewer row `false` | PASS |
| C1361 | active sites with customer + live agreement; inactive absent; expired/refused not live | run ok - `C1361:` | carried from 884f5d8, re-located: `web/infrastructure/supabase/readers.test.ts:661` - `toEqual(["busy", "free", "past"])`; `:662` - busy `liveAgreement: { id: "x1", number: "AG-1001" }`; `:669` - past `liveAgreement` `toBeNull()` | PASS |
| C1362 | Select options = sites without live agreement, grouped by customer; busy site is `AG-n` link | run ok - `C1362:` | carried from 884f5d8: `web/components/agreements/agreements-list.test.ts:100-101` - `<optgroup label="Harbourview">...Tower A`, `<optgroup label="Northside">...Plant 1`; `:102` - `not.toMatch(/<option[^>]*value="s2"/)`; `:103` - `<a href="/agreements/ag-9">AG-1009` | PASS |
| C1363 | submit calls create once with the siteId; viewer gets forbidden panel, no form | run ok - 3 tests `C1363:` | carried from 884f5d8: `web/components/agreements/agreements-list.test.ts:112-113` - `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(SITE)`; `web/app/(app)/agreements-list.test.ts:63-64` - forbidden text, `not.toContain("<form")` | PASS |
| C1364 | `open_exists` shows `AG-n` link; failure shows `messageFor` text | run ok - `C1364:` | carried from 884f5d8: `web/components/agreements/agreements-list.test.ts:118` - `toMatch(/<a[^>]*href="\/agreements\/ag-7"[^>]*>Open AG-1007</)`; `:121` - `unavailable` -> `toContain("We couldn&#x27;t save this. Try again.")` | PASS |
| C1365 | no eligible site -> empty panel with `/customers` link, no Select | run ok - `C1365:` | carried from 884f5d8: `web/components/agreements/agreements-list.test.ts:128-129` - `not.toContain("<select")`, `toMatch(/<a[^>]*href="\/customers"/)` | PASS |
| C1366 | 375 px no horizontal scroll, 44 px targets, filtered URL; 768/1440 no overlap | live, author-side, not re-run (verifier cannot sign in) | carried from 884f5d8: `.specs/features/agreements-page/checks.md:202` - Handoff "Live C1366" (375/768/1440, no horizontal scroll, `?status=accepted&expiring=1` -> AG-1035 with controls reflecting it, >= 44 px below 1024 px, console clean) | PASS (author-side live, not re-run) |
| C1367 | estimator: Pipeline -> `/agreements/new` -> create draft -> `/agreements/{id}` -> listed as Draft | live, author-side, not re-run (verifier cannot sign in) | re-judged at 5f0a4cd: `.specs/features/agreements-page/checks.md:203` - "Live C1367": Pipeline link to `/agreements/new`; site Saltmarsh Bakery -> "Create agreement" created AG-1058 (user go-ahead 2026-11-03), redirected to `/agreements/{id}`, `/agreements` then listed AG-1058 first as In progress, v1; console clean, session intact. Corroborated in code: `web/app/(app)/agreements/new/page.tsx:28` - `create={createAgreementAction}`; `web/app/(app)/agreement-actions.ts:41` - `if (created.ok) redirect(\`/agreements/${created.id}\`)`; C1363 `agreements-list.test.ts:113` (form hands the chosen site to `create`); "In progress" is the draft label (`statusLabel` -> stage label, `web/domain/agreement/index.ts:134-135`) | PASS (author-side live, not re-run) |

C1367 judgement: the record names a concrete created number (AG-1058), the site, the redirect target shape, the list
position and pill text, and the console state, and it records the user go-ahead the round 1 report said was missing. Every
step it describes is the code path the static proofs and wiring show: the page injects the real `createAgreementAction`,
whose success branch redirects to `/agreements/{id}`, and a new draft is the newest `updated_at`, so first in the list
(C1349 ordering). The one wording difference - the claim says "status Draft", the record says "In progress" - is the
app's label for a `draft` (there is no "Draft" pill label anywhere in the list view); see Findings 1. Not re-run by the
verifier, as for C1366.

## Fix diff review (verified at 5f0a4cd)

`git diff 884f5d8..5f0a4cd -- '*.test.ts'` touches three files, additions only apart from one moved line:

- `web/components/kanban/pipeline-view.test.ts` C118 (`:73-81`): the old `expect(html).not.toMatch(/<button[^>]*disabled[^>]*>New agreement</)`
  on `render([])` (no `canCreate`, so vacuous) is removed and re-asserted on a `canCreate: true` render at `:79`, with a
  new `:80` - `expect(writer).toContain(">New agreement<")`. It can now fail: if the writer header rendered
  `<button disabled>New agreement</button>` `:79` fails, and if it rendered no button at all `:80` fails. Not weakened -
  strictly stronger than round 1. Round 1 finding 3 resolved.
- `web/infrastructure/supabase/readers.test.ts` C1350: two added lines (`:599-600`), nothing removed. Round 1 finding 6 resolved.
- `web/app/(app)/pipeline.test.ts`: one added `test.each` (`:39-48`), nothing removed. Round 1 finding 4 resolved.

No assertion was weakened or deleted.

Prior-feature specs (`git diff 884f5d8..5f0a4cd -- .specs/features/design-system-base .specs/features/staff-screens`):
each file gains only a trailing `> Superseded 2026-11-03 by agreements-page ...` note
(`.specs/features/design-system-base/checks.md:204` naming C17 and C21; `.specs/features/staff-screens/checks.md:434`
naming C118); no other line changed. Round 1 finding 2 resolved.

## Swept existing

carried from 884f5d8 (the fix diff touches no source, migration or adapter):

- concurrency: confirmed. `supabase/migrations/20261027202354_agreement_builder.sql:10` - partial unique index
  `agreements_one_live_per_site`; `supabase/migrations/20261103173437_deactivation_create_lock.sql:25` - `create_agreement`
  takes the site `for share` and raises `site_inactive`; `web/infrastructure/supabase/agreements.ts:374` maps the unique
  violation to `open_exists`.
- authorization (RLS unchanged): confirmed. `supabase/migrations/20261019174738_init.sql:301-306` - org-member select
  policies on `sites` and `agreements`; no migration in the diff.

## Findings

Non-failing observations, ranked:

1. **Precision gap in C1367.** The claim says the new row is listed "with status Draft"; the list view renders a draft as
   "In progress" (`statusLabel` delegates to the stage label, `web/domain/agreement/index.ts:134-135`), which is what the
   live record saw. The check text should say "In progress".
2. **Precision gap in C1352** (carried, now acknowledged in checks.md Handoff "Clarifications"): the claim names
   `status: "sent"` with `expiring`, which cannot match; the test uses `accepted` (`readers.test.ts:631`).
3. **`show=inactive` in plan Surface** is still not implemented; checks.md Handoff now records it as a clarification
   (agreements are never deactivated). The plan Surface row itself is unchanged.
4. **C1355 / C1364** (carried): "no bare `<select>` without a label" is asserted only positively; C1364 messages are
   literals rather than compared against `messageFor(...)`.
5. **AC 9** rests only on the author-side live C1366, as checks.md states.

## Gate

verified at 5f0a4cd, from `web/`:

`npm test` - 2288 passed, 0 failed (round 1: 2283; +5 new `C1359:` role tests)
`npm run lint` - exit 0, 0 errors
`npx tsc --noEmit` - exit 0, 0 errors
Batched named proofs - 59 passed, 0 failed (7 files)
