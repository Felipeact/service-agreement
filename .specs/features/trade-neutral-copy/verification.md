# Trade-neutral copy verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 08f2374..HEAD (3e333f5)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

No binding source: the profile is `standard`, not `ui`, so this step does not run.

## Checks

Proofs run at HEAD in one invocation from `web/`: `npx vitest run app/product-copy.test.ts components/kanban/pipeline-view.test.ts --reporter=verbose` - 2 files, 60 tests passed (every C23xx test below shown individually as a passing line). Test names confirmed present by `Grep` over both files (not by a filter that could match nothing).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2301 | layout description is the exact sentence | `vitest ... -t "C2301:"` shown passed in batch run | `web/app/product-copy.test.ts:48` - `expect(source("layout.tsx")).toContain(\`description: "${ONE_LINER}"\`)`; `ONE_LINER` literal at `:22` equals plan AC 1; source `web/app/layout.tsx:21` | PASS |
| C2302 | mobile `lg:hidden` line is the same sentence | batch run, C2302 passed | `product-copy.test.ts:52` - `expect(paragraph("login/page.tsx", "lg:hidden")).toBe(ONE_LINER)`; source `web/app/login/page.tsx:31` | PASS |
| C2303 | headline exact and 40 chars or fewer | batch run, C2303 passed | `product-copy.test.ts:57-58` - `expect(headline).toBe("From service list to signed agreement.")` and `expect(headline.length).toBeLessThanOrEqual(40)`; headline picked by the `max-w-[13ch]` `<p>` (`:56`); source `login/page.tsx:35-37` | PASS |
| C2304 | desktop `lg:block` footer exact | batch run, C2304 passed | `product-copy.test.ts:62` - `expect(paragraph("login/page.tsx", "lg:block")).toBe("Recurring service agreements for trade contractors.")`; source `login/page.tsx:40` | PASS |
| C2305 | none of the 4 words in non-test source under 6 dirs; each dir has files | batch run, 6 table rows (app, components, application, domain, infrastructure, lib) + "every scanned directory exists" passed | `product-copy.test.ts:67` - `expect(files.length).toBeGreaterThan(0)`, `:69` - `expect(hits).toEqual([])`, `:73` - `expect(existsSync(...)).toBe(true)`; `FORBIDDEN` `:23`, `SCANNED` `:24`, excludes `*.test.ts(x)` and `*.testing.ts` `:33`. Independent `git grep` for the four words over the six dirs (non-test) exit 1, no hits; also none in `web/composition`, `web/scripts`, `web/proxy.ts` | PASS |
| C2306 | scan reports each forbidden word and nothing for a clean string | batch run, 4 table rows + clean-string test passed | `product-copy.test.ts:77` - `expect(forbiddenIn(\`before ${word} after\`)).toEqual([word])`; `:81` - `expect(forbiddenIn("Recurring service agreements for trade contractors. A preventive-maintenance drawing.")).toEqual([])` | PASS |
| C2307 | `/login` signed out at 375/768/1440: no horizontal scroll, headline visible | live Playwright (single signed-in page; `fetch('/login',{credentials:'omit'})` -> HTTP 200, scripts stripped, `setContent`, `setViewportSize`; no new context, no Sign out) | 375: scrollWidth 360 <= innerWidth 375; visible mobile line box [20,60,320,50] inside. 768: scrollWidth 753 <= 768; mobile line [32,60,689,31] inside. 1440: scrollWidth 1425 <= 1440; headline "From service list to signed agreement." display block, box [56,200,412,147] inside viewport (3 lines in the 13ch column); footer [56,833,618,19] inside. Headline is `hidden` below 1024 by design (box 0,0,0,0 at 375 and 768, mobile line visible instead). Console errors: 0 (log has only React DevTools info, HMR, a preload warning). Page navigated back to `/pipeline` | PASS |
| C2308 | default words: exact Pipeline subtitle | `vitest components/kanban/pipeline-view.test.ts` batch run, C2308 passed | `web/components/kanban/pipeline-view.test.ts:316` - `expect(renderWith(DEFAULT_ITEM_WORDS)).toContain("Keep every service agreement moving from equipment list to signature.")`; source `pipeline-view.tsx:81` | PASS |
| C2309 | station/stations: exact Pipeline subtitle | batch run, C2309 passed | `pipeline-view.test.ts:320` - `expect(renderWith(itemWords("station", "stations"))).toContain("Keep every service agreement moving from station list to signature.")` | PASS |
| C2310 | PRODUCT.md has no `\bPM\b`, no preventive-maintenance | batch run, C2310 passed | `product-copy.test.ts:86` - `expect(product).not.toMatch(/\bPM\b/)`, `:87` - `expect(product).not.toMatch(/preventive-maintenance/i)` | PASS |
| C2311 | HVAC lines say first trade/starter catalog; none in Purpose to Operating Context | batch run, C2311 passed | `product-copy.test.ts:93` - `expect(hvacLines.length).toBeGreaterThan(0)`, `:94` - `expect(line).toMatch(/first trade or starter catalog/)` per line (the regex alternates the two phrases), `:95` - `expect(section(product, "## Product Purpose", "## Operating Context")).not.toContain("HVAC")`; `grep -n HVAC PRODUCT.md` shows only lines 11 (first trade) and 36 (starter catalog) | PASS |
| C2312 | DESIGN.md `description:` names no HVAC | batch run, C2312 passed | `product-copy.test.ts:100-101` - `expect(description).toBeDefined()`, `expect(description).not.toContain("HVAC")`; `DESIGN.md:3` reads "trade-contractor estimators" | PASS |
| C2313 | Page header paragraph has the new subtitle, no "PM agreement" | batch run, C2313 passed | `product-copy.test.ts:107-108` - `expect(header).toContain("Keep every service agreement moving from equipment list to signature.")`, `expect(header).not.toContain("PM agreement")`; `DESIGN.md:236` | PASS |
| C2314 | Tenant entry has no "(HVAC or mechanical)"; Service agreement heading has no "PM agreement" | batch run, C2314 passed | `product-copy.test.ts:113` - `expect(section(context, "### Tenant (Org) and roles", "\n### ")).not.toContain("(HVAC or mechanical)")`, `:116` - `expect(heading).not.toContain("PM agreement")`; diff shows heading now `### Service agreement (M7, M8)` | PASS |
| C2315 | CONTEXT.md build log line dated 2026-11-09 naming the feature | batch run, C2315 passed | `product-copy.test.ts:121` - `expect(log.split("\n").some((line) => line.includes("2026-11-09") && line.includes("trade-neutral-copy"))).toBe(true)`; diff adds the log line under `## Build log` | PASS |
| C2316 | old strings and the C2022 test are gone | `cd web && ! git grep -n -e "From equipment list to signed agreement" -e "for HVAC and mechanical contractors" -- . ':!node_modules' && ! git grep -n "C2022:" -- app/product-copy.test.ts` - exit 0 | both `git grep` calls print nothing; located at HEAD (`product-copy.test.ts` has no `C2022:`, test names start at `:48`) | PASS |

## Coverage

All recomputed from the authority, not copied from the table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| new strings of criteria 1 to 4 (4) | plan AC 1-4 vs `layout.tsx:21`, `login/page.tsx:31,36,40` | layout C2301 (`:48`) · mobile C2302 (`:52`) · headline C2303 (`:57`) · footer C2304 (`:62`); each source string equals the plan string character for character (apostrophe `&apos;` decoded by `shown`, `:13`) | - |
| forbidden words (4) | test `FORBIDDEN` `:23` = plan AC 5's four; independent `git grep` over the six dirs, non-test: zero hits | `HVAC`, `mechanical contractors`, `PM agreement`, `Preventive-maintenance` each C2305 (`:69`) and C2306 (`:77`, table over `FORBIDDEN`); fault F2 and F3 below confirm both can fail | - |
| scanned source directories (6) | plan AC 5 vs test `SCANNED` `:24`; `web/` top level lists app, application, boundaries.test.ts, components, composition, domain, infrastructure, lib, scripts, config and proxy files | each of the six is a `test.each` row of C2305 (`:65-70`) plus the existence test (`:73`). Outside the six: `web/composition` (wiring), `web/scripts` (tooling), `web/proxy.ts`; I grepped all three for the four words: zero hits, and they hold no user-visible copy. Not an AC 5 gap (the plan names six) | - |
| login viewport widths (3) | plan AC 6 | 375, 768, 1440 each measured live in C2307 | - |
| Pipeline item words (2) | plan AC 7, 8 | default C2308 (`pipeline-view.test.ts:316`) · station/stations C2309 (`:320`) | - |
| documents changed (3) | plan AC 9-12 vs `git diff 08f2374..HEAD` for the three docs | PRODUCT.md C2310, C2311 (diff changes lines 11, 19, 27 only, none Direction; the only HVAC lines remaining are 11 and 36) · DESIGN.md C2312, C2313 (diff lines 3 and 236 only) · CONTEXT.md C2314, C2315 (diff: Tenant entry, Service agreement heading, one build-log line). grep for "PM agreement", "(PM)" and "HVAC or mechanical" across the three docs and ROADMAP.md: no residue | - |
| old strings removed (2) | plan AC 13 | both `git grep` hits empty, C2316 | - |
| plan Impact "not changed" rows (4) | `git diff --stat 08f2374..HEAD` | `RooftopScene`/`login/illustrations.tsx` not in the diff; demo seed and `supabase/` not in the diff; `web/domain` not in the diff; PRODUCT.md Direction section and its first-trade sentences (lines 11, 36) not changed beyond the cited lines | - |

Sweep of sets with no row: `Landing`/`Relations`/`Surface` are all `None`. The Assumptions row for `ports/index.ts` is covered: the diff changes the example to `("plumbing, electrical")` (`web/application/ports/index.ts:292`), and C2305 `web/application` is green. The `illustrations.tsx` "preventive-maintenance" lowercase comment stays, and the case-sensitive scan correctly lets it through (C2306 clean-string test, `:81`).

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Instrumentation (string literals) | `layout.tsx`, `login/page.tsx`, the literal passed to `itemText` in `pipeline-view.tsx` | one at its own layer, as text, exact string: C2301-C2304 read source text and assert the whole string; C2308, C2309 render the view and assert the whole sentence | yes |
| Decides (the C2305 scan and the document-section checks) | the scan in `product-copy.test.ts`, `section()` helpers C2311-C2314 | one at its own layer proving it can fail (C2306), one asserted case per forbidden word: C2306 is table-driven over all four words plus a clean case; fault F3 proved it can fail | yes |
| Existing decision (`itemText`) | `pipeline-view.tsx` calling `itemText` | existing item-vocabulary proofs plus C2308 and C2309 at the Pipeline view: default and one non-default word | yes |

## Faults injected

Isolated worktree at HEAD (`git worktree add`, junction for `node_modules`), reset with `git checkout -- .` between faults, removed with `git worktree remove --force` afterwards (`git worktree list` confirms it is gone; the `node_modules` junction was removed with `rmdir` first, the real `web/node_modules` still intact). No `git stash`.

| Mutation | Location | Killed |
| --- | --- | --- |
| layout description "trade contractors" -> "trade businesses" | `web/app/layout.tsx:21` | yes (C2301 failed) |
| `// HVAC` appended to a non-test source file in `web/domain` | `web/domain/transition.ts` | yes (C2305 `web/domain` row failed, other 6 rows still passed) |
| `forbiddenIn` made to return `[]` (scan cannot fail) | `web/app/product-copy.test.ts:27` | yes (the 4 C2306 positive tests failed) |
| `itemText(...)` call removed from the Pipeline subtitle (literal passed bare) | `web/components/kanban/pipeline-view.tsx:81` | yes (C2309 failed; C2308 correctly passed, since default words equal the literal) |
| "(PM)" put back in PRODUCT.md ("build a preventive-maintenance (PM) service agreement") | `PRODUCT.md:11` | yes (C2310 failed) |

Five faults, five killed. Proofs not individually mutated within the cap of five: C2302, C2303, C2304, C2308, C2311-C2315. Their assertions are whole-string or negative-match expressions read at the cited lines and I judge them able to fail; I did not run mutants for them, so that is read evidence, not a kill.

## Precision notes (findings about the checks, none fails a check)

- C2302 and C2304 locate the paragraph by a class regex (`<p className="[^"]*lg:hidden[^"]*">`, `lg:block`) that takes the first match in the file. In `login/page.tsx` the mobile line is the only `lg:hidden` `<p>` and the footer the only `lg:block` `<p>`; the headline `<p>` carries neither, and "hidden text-night-ink lg:block" does not contain "lg:hidden". They do distinguish the two. A future third `<p>` with either class placed earlier would silently be tested instead; low risk.
- C2310 `\bPM\b` is case-sensitive and word-bounded: it would miss "PMs" and "pm" (and would flag a clock time like "2:14 PM"). PRODUCT.md holds neither today. Low risk, no false positive now.
- C2308/C2309 use `toContain` on the rendered markup, so the whole sentence is asserted but not that it is the only text in the subtitle element. Acceptable for the exact-string claim.
- C2305 scans `.ts`/`.tsx` only and six dirs (as the plan says). `web/composition`, `web/scripts`, `web/proxy.ts` sit outside the six; verified clean by hand today, not guarded by a test. Suggest adding them to `SCANNED` at the next touch.
- C2307 reads the signed-out page via `fetch` + `setContent` (the page was signed in and had to stay signed in); the stylesheet applied (display toggles per width match the `lg:` classes), so the measurements are of the real CSS, but it is not a navigation to `/login`.

## Swept existing rows

Authorization: `/login` public - `web/infrastructure/supabase/session.ts:6` `const PUBLIC_PATHS = ["/login", "/auth/confirm"]`, used at `:24`; Pipeline behind `MemberGate` - `web/app/(app)/layout.tsx:8` wraps children in `<MemberGate>`, and `web/app/(app)/member-gate.tsx:16` redirects `signed_out` to `/login`. Cited constraint exists. Neither file is in the diff.

## Gate

- `cd web && npx tsc --noEmit` - exit 0, no output
- `cd web && npx eslint app components application domain infrastructure lib` - exit 0, no output
- `cd web && npm test` - 185 files passed, 3,548 tests passed, 0 failed (exit 0)
- Real-tree `git status --porcelain` before and after my run: identical except that one untracked file under `supabase/migrations/` was renamed by something else while I ran (`20261109190000_release_starter_packs.sql` became `20261109171002_release_starter_packs.sql`). I did not touch `supabase/`; that file belongs to the separate pack-release work already dirty at the start (staged deletions under `supabase/packs/pending/`, modified `supabase/tests/starter_packs.sql`). Nothing under `web/`, the three docs or `.specs/` changed from my side.
