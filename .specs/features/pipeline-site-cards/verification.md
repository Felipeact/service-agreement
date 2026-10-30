# Pipeline cards by site verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 9848da6..2228bc2 (HEAD)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Under `light`, step 1 (binding sources), the Coverage recompute, Test policy verdicts and fault injection do not run, so those sections are omitted.

Proof invocation (one call, from `web/`, at HEAD 2228bc2):
`npx vitest run components/kanban infrastructure/supabase/readers -t "C105[3-9]:" --reporter=verbose` - exit 0, 2 files, 9 passed, 44 skipped. Each named test appeared individually as passed (C1056 is a `test.each` of three rows, all three passed). Every test was added by this diff (`git diff 9848da6..HEAD` adds them to `readers.test.ts` and `pipeline-view.test.ts`).

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1053 | reader selects `sites(name, customers(name))`, returns `site` and `customer` | `C1053: each card carries its site's name and that site's customer` - passed | `web/infrastructure/supabase/readers.test.ts:127` - `expect(String(select?.args[0])).toContain("sites(name, customers(name))")`; `:128` - `expect(card.site).toBe("Harbourview Tower A")`; `:129` - `expect(card.customer).toBe("Harbourview Towers Strata")` | PASS |
| C1054 | `h3` is exactly the site, next element is the customer, then `AG-1048 · v3`; customer not in `h3` | `C1054: the card heading is the site, with the customer on the next line before number and version` - passed | `web/components/kanban/pipeline-view.test.ts:88` - `expect(heading?.[1]).toBe("Harbourview Tower A")` (regex `[^<]*` forbids nested markup, so the customer cannot be inside the `h3`); `:90` - `expect(afterHeading).toMatch(/^<[^>]+>Harbourview Towers Strata</)`; `:91` - `expect(afterHeading.indexOf("Harbourview Towers Strata")).toBeLessThan(afterHeading.indexOf("AG-1048 · v3"))` | PASS |
| C1055 | site `h3` has no truncating class; 120-char site appears in full | `C1055: a long site name is never truncated` - passed | `web/components/kanban/pipeline-view.test.ts:97` - `expect(site).toHaveLength(120)`; `:100` - `expect(heading?.[2]).toBe(site)`; `:102` - `expect(classes.filter(...)).toEqual([])` where the filter regex matches `truncate`, `line-clamp-.*`, `whitespace-nowrap` and `overflow-hidden` as alternatives | PASS |
| C1056 | `  CLINIC ` -> B, `kestrel` -> C, `harbourview` -> A | `C1056: the query "  CLINIC " ... ["b"]`, `... "kestrel" ... ["c"]`, `... "harbourview" ... ["a"]` - all 3 passed | `web/components/kanban/pipeline-view.test.ts:119` - `expect(shownIds(renderQuery(searchBoard(), query))).toEqual(ids)` over the rows at `:115-117` | PASS |
| C1057 | `zzz` shows `No agreements match "zzz"`, a Clear search button, no card | `C1057: a query matching no site or customer shows the no-match state and no card` - passed | `web/components/kanban/pipeline-view.test.ts:124` - `expect(html).toContain("No agreements match &quot;zzz&quot;")`; `:125` - `expect(html).toMatch(/<button[^>]*>Clear search</)`; `:126` - `expect(shownIds(html)).toEqual([])` | PASS |
| C1058 | under `fernwood`, `in_progress` header 1 and `$4,000/yr`; `sent` 1 and `$2,500/yr` | `C1058: under a query each column header counts and totals only its matching cards` - passed | `web/components/kanban/pipeline-view.test.ts:139-140` - `expect(inProgress).toMatch(/data-column-count[^>]*>1</)`, `expect(inProgress).toMatch(/data-column-total[^>]*>\$4,000\/yr</)`; `:142-143` - same for `sent` with `>1<` and `\$2,500\/yr` | PASS |
| C1059 | placeholder `Search sites or customers…`, label `Search agreements`, old text gone | `C1059: the search input invites sites or customers and keeps its label` - passed | `web/components/kanban/pipeline-view.test.ts:148` - `expect(html).toMatch(/<input[^>]*placeholder="Search sites or customers…"/)`; `:149` - `expect(html).toContain("Search agreements")`; `:150` - `expect(html).not.toContain("Search customers…")` | PASS |

### Level, sampling and precision notes (non-failing)

1. C1059 - the label assertion is `toContain("Search agreements")` on the whole page, not bound to the `<input>`'s `aria-label`. The mechanism exists (`web/components/ui/search-input.tsx:24` - `aria-label={label}`, with `label="Search agreements"` at `pipeline-view.tsx`), but the test would also pass if the string appeared elsewhere. Precision gap in the test, not in the code.
2. C1055 - asserts the `h3`'s own classes only, not ancestors (the card `<a>` carries `block rounded-control ...`, no clipping class). Actual wrapping is a layout property `renderToStaticMarkup` cannot observe; the check defines the class-absence proxy, which the test meets.
3. C1053 - proven against the recording stub client, so the PostgREST embed string and row shape are asserted, not a live join. Matches the check's stated proof level.
4. C1056-C1058 - the query is seeded through the new `initialQuery` prop rather than typed; it feeds the same `query` state and the same filter path (`pipeline-view.tsx`, `needle = query.trim().toLowerCase()`), as `checks.md` declares.

### Swept rows resolving to "existing"

- failure modes / dependency failure -> `(app)/error.tsx`: present at `web/app/(app)/error.tsx:7` (`export default function AppError`, renders "Something went wrong" with Try again). `/pipeline` page (`web/app/(app)/pipeline/page.tsx`) awaits `pipelineBoard()` with no local catch, so a reader throw (`readers.ts` `if (error) throw unexpected(error)`) reaches it.
- authorization -> `MemberGate`: present at `web/app/(app)/member-gate.tsx:9`, wrapped around all `(app)` children at `web/app/(app)/layout.tsx:8`; redirects `signed_out` to `/login`.
- state transitions -> `pipelineStage`: present at `web/domain/pipeline/index.ts:22`, used by the reader at `web/infrastructure/supabase/readers.ts:68`; `domain/` is untouched by the diff.

## Gate

`npm test` (from `web/`, `vitest run`) - 84 files, 1827 passed, 0 failed
