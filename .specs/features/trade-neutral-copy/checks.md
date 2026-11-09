# Trade-neutral copy checks

Profile: standard
Plan: `.specs/features/trade-neutral-copy/plan.md`

16 checks in 4 slices · 0 one-way doors · 0 open

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C2301:`). This feature numbers from C2301 (the highest id in use is C2228). `npx vitest run app/product-copy.test.ts -t "C2301:"` selects one. The whole file runs with `npx vitest run app/product-copy.test.ts`; the Pipeline checks run with `npx vitest run components/kanban/pipeline-view.test.ts -t "C2308:"`.
- **Source and document checks** (C2301 to C2306, C2310 to C2315) are tests in `web/app/product-copy.test.ts`. They read source and documents as text, the house pattern of the C2022 test they replace. Expected strings are copied from the plan's criteria, never read back from the source.
- **Live proof** (C2307) is the Playwright MCP validation `AGENTS..md` requires for any change under `web/`; it is run in a real browser and nothing from it is committed.
- The words "HVAC", "PM agreement" and the rest are never written as old-copy assertions in a test file: the scan excludes test files, and C2316 proves the old pin is gone with `git grep`.

## Checks

### S1 - The sign-in page and browser description name no trade · 3 files · 4 KB · ~1k

**C2301** - The root layout's `metadata.description` is exactly "Recurring service agreements for trade contractors, from the customer's list to signature." (plan AC 1)
Proof: `npx vitest run app/product-copy.test.ts -t "C2301:"`

**C2302** - The sign-in page's mobile line (the `<p>` with `lg:hidden`) is exactly the sentence of C2301 (plan AC 2)
Proof: `npx vitest run app/product-copy.test.ts -t "C2302:"`

**C2303** - The sign-in page's headline is exactly "From service list to signed agreement." and is 40 characters or fewer (plan AC 3)
Proof: `npx vitest run app/product-copy.test.ts -t "C2303:"`

**C2304** - The sign-in page's desktop footer line (the `<p>` with `lg:block`) is exactly "Recurring service agreements for trade contractors." (plan AC 4)
Proof: `npx vitest run app/product-copy.test.ts -t "C2304:"`

**C2305** - None of "HVAC", "mechanical contractors", "PM agreement" and "Preventive-maintenance" (case-sensitive) appears in any non-test source file (`.ts`, `.tsx`, excluding `*.test.ts`, `*.test.tsx` and `*.testing.ts`) under `web/app`, `web/components`, `web/application`, `web/domain`, `web/infrastructure` and `web/lib`; each directory exists and yields at least one scanned file (plan AC 5, and the Assumptions row for the `ports/index.ts` comment)
Proof: `npx vitest run app/product-copy.test.ts -t "C2305:"`

**C2306** - The scan used by C2305 reports a hit for each of the four forbidden words when run on a sample string containing that word, and reports none for a string with none of them (the scan can fail) (plan AC 5)
Proof: `npx vitest run app/product-copy.test.ts -t "C2306:"`

**C2307** - At 375, 768 and 1440 px wide the signed-out `/login` page has `document.documentElement.scrollWidth <= window.innerWidth` and the headline is fully visible (its bounding box inside the viewport) (plan AC 6)
Proof: live Playwright MCP run per `AGENTS..md` (navigate to `/login`, `browser_resize` to each width, `browser_evaluate` the scroll-width comparison and the headline's `getBoundingClientRect()`, `browser_snapshot` to read the page, `browser_console_messages` clean). Reported in the verification, not committed

### S2 - The Pipeline subtitle uses the org's word and no trade shorthand · 2 files · 25 KB · ~6k

**C2308** - With the default item words (`DEFAULT_ITEM_WORDS`), the rendered Pipeline subtitle is exactly "Keep every service agreement moving from equipment list to signature." (plan AC 7)
Proof: `npx vitest run components/kanban/pipeline-view.test.ts -t "C2308:"`

**C2309** - With item words "station" and "stations" (through `ItemWordsProvider`), the rendered Pipeline subtitle is exactly "Keep every service agreement moving from station list to signature." (plan AC 8)
Proof: `npx vitest run components/kanban/pipeline-view.test.ts -t "C2309:"`

### S3 - The product documents describe the product, not one trade · 3 files · 176 KB read in part · ~12k

**C2310** - `PRODUCT.md` contains no `\bPM\b` and no "preventive-maintenance" (case-insensitive) (plan AC 9)
Proof: `npx vitest run app/product-copy.test.ts -t "C2310:"`

**C2311** - Every line of `PRODUCT.md` that contains "HVAC" also contains "first trade" or "starter catalog", and the Product Purpose and Positioning sections (from `## Product Purpose` to `## Operating Context`) contain no "HVAC" (plan AC 10)
Proof: `npx vitest run app/product-copy.test.ts -t "C2311:"`

**C2312** - The `DESIGN.md` frontmatter `description:` line names no "HVAC" (plan AC 11)
Proof: `npx vitest run app/product-copy.test.ts -t "C2312:"`

**C2313** - The `DESIGN.md` Page header paragraph (the line starting `**Page header.**`) contains "Keep every service agreement moving from equipment list to signature." and does not contain "PM agreement" (plan AC 11)
Proof: `npx vitest run app/product-copy.test.ts -t "C2313:"`

**C2314** - The `CONTEXT.md` Tenant entry (from `### Tenant (Org) and roles` to the next `###`) does not contain "(HVAC or mechanical)", and the heading line starting `### Service agreement` does not contain "PM agreement" (plan AC 12)
Proof: `npx vitest run app/product-copy.test.ts -t "C2314:"`

**C2315** - `CONTEXT.md`'s Build log has a line dated 2026-11-09 that names `trade-neutral-copy` (plan Observable row for the three documents; `AGENTS..md` Context rule)
Proof: `npx vitest run app/product-copy.test.ts -t "C2315:"`

### S4 - The old pin gives way to the new copy · 1 file · 1 KB · ~1k

**C2316** - No test in `web/` asserts the old strings and the C2022 test is gone: `git grep` over `web/` for "From equipment list to signed agreement" and for "for HVAC and mechanical contractors" finds nothing, and `app/product-copy.test.ts` has no test named `C2022:` (plan AC 13)
Proof: `cd web && ! git grep -n -e "From equipment list to signed agreement" -e "for HVAC and mechanical contractors" -- . ':!node_modules' && ! git grep -n "C2022:" -- app/product-copy.test.ts` (exit 0 when both find nothing)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| new strings of criteria 1 to 4 (4) | layout description C2301 · mobile line C2302 · headline C2303 · desktop footer C2304 | - |
| forbidden words (4) | `HVAC` C2305, C2306 · `mechanical contractors` C2305, C2306 · `PM agreement` C2305, C2306 · `Preventive-maintenance` C2305, C2306 | - |
| scanned source directories (6) | `web/app` C2305 · `web/components` C2305 · `web/application` C2305 · `web/domain` C2305 · `web/infrastructure` C2305 · `web/lib` C2305 (one test, table-driven over the 6) | - |
| login viewport widths (3) | 375 C2307 · 768 C2307 · 1440 C2307 | - |
| Pipeline item words (2) | default `equipment` C2308 · `station`/`stations` C2309 | - |
| documents changed (3) | `PRODUCT.md` C2310, C2311 · `DESIGN.md` C2312, C2313 · `CONTEXT.md` C2314, C2315 | - |
| old strings removed (2) | "From equipment list to signed agreement" C2316 · "for HVAC and mechanical contractors" C2316 | - |

- Claims naming an exact string: C2301 to C2304, C2308, C2309, C2313; each asserts the whole string, not a fragment
- C2307 is the only proof that is not a committed test; it is the `AGENTS..md` live validation
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Instrumentation (string literals in `layout.tsx`, `login/page.tsx`, a literal passed to `itemText` in `pipeline-view.tsx`) | one at its own layer, as text | the exact string, because there is no conditional to enumerate |
| Decides (the C2305 scan and the document-section checks, which are new logic in a test) | one at its own layer proving it can fail (C2306) | one asserted case per forbidden word |
| Existing decision (`itemText`, proven by item-vocabulary) | the existing proofs, plus C2308 and C2309 at the Pipeline view | the default and one non-default word |

Evidence:

- `layout.tsx`, `login/page.tsx`: static strings, no conditional -> instrumentation (C2301 to C2304)
- `pipeline-view.tsx:81`: one literal through `itemText`, no new branch -> instrumentation; `itemText` itself has a regex with 3 branch points (article, case, tail) already proven by item-vocabulary
- closest analogue in the repo: `app/product-copy.test.ts` C2022 and `domain/purity.test.ts` (a source-reading scan over directories), same shape

Cost: 2 decision-level proofs (C2305 with C2306) and 14 text proofs in 2 test files. Without C2306 the scan could pass by scanning nothing.

## Swept

- validation: C2305, C2306 (the forbidden words cannot return; the strings are exact)
- failure modes: n/a - static strings and documents, no I/O and no partial state
- idempotency: n/a - nothing is written or retried
- authorization: existing - `/login` is a public path (`PUBLIC_PATHS` in `proxy.ts`), the Pipeline sits behind `MemberGate`; neither changes
- concurrency: n/a - no shared mutable state
- data lifecycle: n/a - no stored data; plan Impact "stored data" row says nothing to migrate
- dependency failure: n/a - no external call
- state transitions: n/a - no status or state machine is touched
- observability: n/a - no logging or metric requirement; C2307 reads the browser console as part of the live run

## Handoff

- S1 = 1k (layout 0.9 KB, login 2.4 KB, the new test file 0.8 KB), S2 = 6k (pipeline-view 8.8 KB, its test 15.9 KB), S3 = 12k (PRODUCT.md 8.7 KB, DESIGN.md 36.6 KB, CONTEXT.md 131 KB read by section only, ROADMAP.md edit), S4 = 1k; `ports/index.ts` (52 KB) is one comment edit. Whole-file total 301 KB / 4 = ~75k in the worst case, ~20k as read. Under the 150k budget - one builder
- Mechanism: one builder
