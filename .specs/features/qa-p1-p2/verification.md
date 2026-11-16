# qa-p1-p2 verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: 54837d1..HEAD (HEAD 62c762c; matcher fix in 4b79d13)
**Round**: 2 - scoped (proofs re-run in full at 62c762c; sections marked `verified at 62c762c` or `carried from round 1`)
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none marked (bounded batch, no plan.md; the Intent section of checks.md is the only brief; bare `-` row) | n/a - nothing marked binding | none | - |

Carried from round 1: the touched screen is one link on the signing page (C7012, `components/signing/signing.test.ts:39`, `:46`); the rest are two machine files. The fix commit 4b79d13 touched no interface, so step 1 is not re-run. Verified at 62c762c.

## Checks

Proofs run at 62c762c in one batched invocation of 11 files (264 passed, 0 failed, every C70xx test visible by name in verbose output) plus the full `npx vitest run` and `npm run test:db import_duplicates`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C7001 | six report spellings typed; alias alone types | `npx vitest run domain/imports/matching.test.ts ...` (6 C7001 row tests plus 2 more C7001 tests ran) | `matching.test.ts:21-22` `expect(matchAssetType(raw, TYPES)).toBe(id)` over `:15-20`; `:56-58` `matchAssetType("DCVA 2in", TYPES)` toBe "backflow", `matchAssetType("RPZ", TYPES)` toBe "backflow", and null without the backflow type; `:62-64` bracket, period, qualifier. Alias mutant M4 now killed (below) | PASS |
| C7002 | unrelated stays null, exact wins, extra words must be explained | same file (C7002 tests ran) | `matching.test.ts:25-26` `toBeNull()` over Water heater / Sump pump / Grease interceptor / "" / "  "; `:30-32` exact name, code, synonym; `:37-39` exact beats token; `:43-47` "Boiler feed pump", "Boiler room exhaust fan", "Boiler water treatment tank" `toBeNull()`; `:50-52` "Sump pump", "Condensate pump", "Backflow pump", "Fan coil unit" `toBeNull()` with types Pump and Fan | PASS (see F1-F3: the extra-word rule is only partly bounded) |
| C7003 | tie gives null | same file | `matching.test.ts:74` `expect(matchAssetType("Boiler feed", types)).toBeNull()` (byHead tie); `:69` `matchAssetType("Exh.", types)` `toBeNull()` with types "Exhaust" and "Exhibit" (whole-fit tie). Both tie paths now have a located assertion; M1 and M2 killed | PASS |
| C7004 | splitQuantity forms and limits | same file (13 C7004 tests) | `matching.test.ts:87` `toEqual(expected)` over qty / qty: / x6 / x 6 / 24 x / (x 12); `:91` `toBeNull()` over "VAV boxes", "Boiler 2", "(qty 1)", "(qty 51)", "(qty 500)", "", "qty 4" | PASS |
| C7005 | extraction expands qty rows | `application/use-cases/extract-import.test.ts` (4 C7005 tests ran) | carried from round 1: `extract-import.test.ts:105` `toHaveLength(24)`; `:106` units "1".."24"; `:107` `Set(["VAV box"])`; `:108` confidence medium; `:118` stays one row for unit present / above 50 / one | PASS |
| C7006 | repeats start skipped | `npm run test:db import_duplicates` - "PASS import_duplicates, 1 passed, 0 failed" (rolled-back, hosted; nothing applied) | `supabase/tests/import_duplicates.sql:25` skipped positions `array[2]`; `:30` after chunk 2 `array[2, 7]`; `:32` first of key kept; `:33` same unit under another type kept | PASS |
| C7007 | mapping remembers the spelling once, never fails | `infrastructure/supabase/import-review.test.ts` (3 C7007 tests ran) | carried from round 1: `import-review.test.ts:153` `toEqual({ ok: true, rows: 1 })`; `:155` no update when held; `:160` args `{ synonyms: ["roof top", "boiler cond"] }`; `:165` ok:true under refusal | PASS |
| C7008 | PDF and "Ours never appears" gone | `components/site/site-pages.test.ts` (C7008 ran) | carried: `site-pages.test.ts:52-55` four `not.toContain(...)` over `content.ts` and `app/product/page.tsx`; negative-substring proof (precision note P2, not blocking on its own) | PASS |
| C7009 | robots and sitemap content | `app/robots.test.ts` (2 C7009 tests ran); live `GET /robots.txt` 200 lists all 20 disallows and the sitemap line | `app/robots.test.ts:13` allow "/"; `:14` disallow contains /review/ /sign/ /api/ /pipeline /agreements /settings; `:15` sitemap URL; `:21` length against `SITEMAP_PATHS.length` (self-referential); `:22-23` 5 named pages; `:25` no URL under any disallowed prefix | PASS as run, but precision gap P1 stays and is an unproven member (below) |
| C7010 | robots and sitemap reachable signed out | `infrastructure/supabase/session.test.ts` (2 C7010 tests ran) | `session.test.ts:57` `expect(response.headers.has("location")).toBe(false)` for both paths | PASS |
| C7011 | four security headers | `next.config.test.ts` (C7011 ran) | `next.config.test.ts:39-45` exact `toEqual` of four headers on `/:path*`; `:46-49` review and sign keep `no-referrer` | PASS |
| C7012 | visible Open signing page link | `components/signing` (3 C7012 tests ran) | `signing.test.ts:39` `toMatch(<a href="${EMBED}" ... >Open signing page</a>)`; `:46` absent when signed or closed | PASS |
| C7013 | browser run at 375/768/1440: body, no horizontal scroll, no console errors | Verifier ran Playwright (one context) against the running dev server: `/robots.txt` and `/sitemap.xml` at 375, 768, 1440 | all six loads 200, console errors none; `document.documentElement.scrollWidth` equals the width in five loads, but `/sitemap.xml` at 375 gave scrollWidth 392 (horizontal scroll) - the browser's XML viewer rendering of a long `<loc>` line, not site markup. Signing fallback page not observed: it needs a live signing token the Verifier does not hold | FAIL (sitemap at 375 scrolls horizontally; signing fallback unobserved; either reword the check to exempt the raw XML view or have the author show the fallback run) |
| C7014 | no new failures | `npx vitest run` at 62c762c - Test Files 6 failed / 328 passed (334); Tests 33 failed / 5465 passed (5498) | failures: `components/kanban/pipeline-view.test.ts` (28), `components/kanban/expiring-view.test.ts` (1), `components/shell/app-shell.test.ts` (1), `app/pricing/pricing-catalog.test.ts` (1), `components/vocabulary.test.ts` C2019 (1), `domain/purity.test.ts` C2021 (1; lists only `components/agreements/agreements-list.tsx` and `components/kanban/pipeline-view.tsx`). All on the known list; no other file fails. rls_isolation C35 and customer_portal are DB suites, not part of this run | PASS |

## Coverage

Verified at 62c762c for the matcher rows; other rows carried from round 1.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| report spellings matched (6) | checks.md C7001 | each -> C7001 `matching.test.ts:15-20`; also reproduced in a scratch copy over the real 40 hvac types: all six type correctly | - |
| must stay unmatched (3+blank) | checks.md C7002 | Water heater, Sump pump, Grease interceptor, "" -> C7002 `:25`; scratch probe over the HVAC-only catalog: all null (they do type in an org that has the plumbing pack, as expected) | - |
| round 1 over-reach examples (7) | round 1 F4 | Boiler feed pump, Boiler room exhaust fan, Boiler water treatment tank, Sump pump, Condensate pump, Backflow pump, Fan coil unit -> C7002 `:43-52`; "Rooftop Unit Curb Adapter Kit Ultra" -> `domain/imports/extract.test.ts` null (C515); "thermal expansion tank" -> null `starter-packs.test.ts:68` | - |
| extra-word rule, the explaining paths (4: bracket, period, alias, qualifier) | `matchAssetType` in `domain/imports/index.ts` | each has a positive test (`:62-64`, `:56`); none has a negative test that the explaining path cannot waive a word naming other equipment | trailing or any period waives the word before it ("Boiler pump." -> Boiler); an alias waives the word for any type ("RPZ pump" -> Pump); a bracket is ignored whole ("Boiler (feed pump)" -> Boiler) - F1-F3 |
| quantity forms (6) | `splitQuantity` | C7004; extraction C7005 | - |
| security headers (4) and two no-referrer rules | `next.config.ts` | C7011 | - |
| discovery files (2) | `app/robots.ts`, `app/sitemap.ts` | C7009 | - |
| public sitemap pages (12) | `SITEMAP_PATHS` in `components/site/content.ts` | length against the same constant; 5 named (`robots.test.ts:22-23`) | 7 of 12 never named (P1) |
| disallowed prefixes (20) | `DISALLOWED` in `app/robots.ts` | 6 named (`robots.test.ts:14`) | 14 of 20 never named (/auth/ /login /contracts /customers /sites /assets /contacts /imports /members /reports /search /templates /setup /billing) (P1) |
| startup config: public paths (1 place) | `session.ts` PUBLIC_PATHS read directly | C7010 over the real module | - |
| startup config: headers (1 place) | `next.config.ts` read directly | C7011 imports the real config | - |
| quantity x duplicate interaction | C7005 x C7006 | no proof; documented in `## Known limits` (first bullet) | accepted limit, see Decisions |

## Test policy rows

No `Test policy` section in checks.md. Nothing to judge; the repo's own convention decided the level.

## Faults injected

Verified at 62c762c. Mutants applied in place and restored from the saved original text; `git status --porcelain` before and after: `?? node_modules/` only. Run against `matching.test.ts`, `extract.test.ts` and `starter-packs.test.ts`.

| Mutation | Location | Killed |
| --- | --- | --- |
| byHead tie returns first (`return byHead[0]?.id ?? null`) | `domain/imports/index.ts` end of `matchAssetType` | yes - C7003 "two equally good types give no guess" fails |
| whole-fit tie returns first (`return top[0].id`) | `domain/imports/index.ts` `top.length === 1 ? ... : null` | yes - C7003 "a short form that fits two whole types gives no guess" fails (round 1's surviving mutant) |
| drop the `unexplained(t.words)` condition from the whole-fit filter | `domain/imports/index.ts` `whole` | yes - 7 matching tests, C2222 and C515 fail |
| drop alias expansion from `heard` | `domain/imports/index.ts` `heard` | yes - C7001 "an alias alone types the row" fails (round 1 F2 resolved) |
| keep bracket text in the words (bracket strip made a no-op) | `domain/imports/index.ts` `outside` | yes - C7002 "exact name beats..." and C7001 "qualifier in brackets" fail |

Round 1's other mutants (C7005 confidence, C7007 guard, C7011 HSTS, C7010 public paths) carried from round 1, not re-run: the fix touched none of those files.

## Findings

Round 1 items re-judged against 62c762c:

1. C7003 surviving mutant: resolved. Both tie paths are asserted and both mutants die.
2. C7001 alias not depended on: resolved (`matching.test.ts:55-59`; mutant M4 killed).
3. Quantity x duplicate interaction: accepted as a documented limit. It is stated in `checks.md` `## Known limits`, loses no data (rows stay visible, one click unskips), and has a bounded effect (the "Add N assets" count undercounts until unskipped). It remains unproven by any test, which the limit states.
4. Matcher over-reach: the seven named cases and the two other reversed tests are fixed, but the same class survives through the three waiver paths below (F1-F3). This still blocks.
5. Precision gaps: C7009 still blocks as a recomputed Coverage member with no proof (7 of 12 sitemap pages and 14 of 20 disallowed prefixes never named, and the sitemap length is checked against its own constant). It is a test-only fix: assert the full lists as literals. C7008 does not block: it is a negative-substring proof over source files, a note (P2) with no unproven member.

Remaining wrong typings, probed on a scratch copy of `matchAssetType` over the real 40 hvac type names (nothing in the repo edited):

- **F1 (any period waives the word before it)**: "Boiler pump." -> Boiler, "Chiller pump." -> Chiller, "Boiler tank." -> Boiler, "Boiler feed." -> Boiler, "Exhaust fan motor." -> Exhaust fan, "Pump motor." -> Pump, "Exh. pump" -> Pump. The `dotted` set takes every word followed by a period, so a sentence-final period turns "pump" into an explained abbreviation. A label with the same words and no period ("Boiler pump") gives null, so the result depends on punctuation alone. No test bounds it.
- **F2 (an alias waives its word against every type, not only backflow)**: "RPZ pump", "Pump RPZ", "Pump BF" -> Pump; "Boiler RPZ", "Boiler DCVA 2in", "Boiler PVB" -> Boiler; "Chiller RPZ" -> Chiller. The `!ALIASES[token]` clause in `unexplained` applies to whatever type is being scored.
- **F3 (a bracket is ignored whole)**: "Boiler (feed pump)", "Boiler (sump pump)", "Boiler (water heater)", "Chiller (pump)" -> Boiler / Chiller. Words that are qualifiers ("condensing", "water cooled") and words that name other equipment are treated alike. Lower severity: bracket text is usually a qualifier.
- Not a regression and not blocking: one-word first-word typing ("Exhaust" -> Exhaust fan, "Unitary" -> Unitary split system, "Supply" -> Supply fan) is the documented limit. Under-matching exists ("Boiler B-1", "Fan coils" give null), which is the safe direction.
- Regression check: the six report items type correctly and the three that must stay untyped stay null in the check's own org (`matching.test.ts` ran green) and in an HVAC-only catalog. No regression found against those nine.

Other notes:

- **F4 (C7013)**: described in the check table. `/sitemap.xml` at 375 gave scrollWidth 392. Either exempt the raw XML view in the check or accept it explicitly; the signing fallback run is unobserved by the Verifier.
- **P1**: C7009 precision, above.
- **P2**: C7008 is a source-substring proof; passes under another false claim.
- **N1**: the C2222 test title in `starter-packs.test.ts` ("left untyped, not given to another type") is now partly untrue because the "rpz" assertion expects BACKFLOW_PREVENTER; the comment at `:65` explains the change. The "thermal expansion tank" -> null assertion is restored. Minor.

Suggested fix direction (not applied): make the period waiver apply only when the dotted token is a prefix or skeleton of a word that the text otherwise leaves unexplained, or at least not to the last token; scope an alias waiver to a type that contains the alias target word; and add negative tests ("Boiler pump.", "RPZ pump", "Boiler (feed pump)") plus full literals for C7009.

## Gate

`npx vitest run` - Tests 33 failed (all on the known pre-existing list), 5465 passed; Test Files 6 failed, 328 passed.
Batched target run (11 files, verbose) - 264 passed, 0 failed.
`npm run test:db import_duplicates` - PASS import_duplicates, 1 passed, 0 failed.
