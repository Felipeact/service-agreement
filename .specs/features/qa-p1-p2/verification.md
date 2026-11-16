# qa-p1-p2 verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: 54837d1..HEAD (code in 1c11d96, e70a84b; 45de842 is docs only)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none marked (bounded batch, no plan.md; the Intent section of checks.md is the only brief) | n/a - nothing marked binding | none | - |

No design or contract is binding for this batch. The screens touched are one link on the signing page (C7012) and two machine files, so the step 1 arrangement enumeration is: signing page, open state, one `<a>` (text "Open signing page", same href as the embedded form, `target=_blank`, `rel=noopener noreferrer`) beside the form; signed and closed states none. Each has a check (signing.test.ts:39, :46).

## Checks

All 14 checks C7001-C7014 are in the set. Proofs were run by the Verifier at HEAD (322 passed in the batched run of the 13 target files, each C70xx test visible by name in verbose output).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C7001 | six report spellings typed | `vitest run domain/imports/matching.test.ts` (6 named C7001 tests ran) | `domain/imports/matching.test.ts:21-22` - `expect(matchAssetType(raw, TYPES)).toBe(id)` over the six rows (:14-19) | PASS (see F2: the alias path is not exercised by these rows) |
| C7002 | unrelated stays null, exact still wins | same file, C7002 tests ran | `matching.test.ts:26` `toBeNull()` over Water heater / Sump pump / Grease interceptor / "" / "  "; `:30-32` exact name, code, synonym; `:37-39` exact beats token | PASS |
| C7003 | tie gives null | same file | `matching.test.ts:44` - `expect(matchAssetType("Boiler feed", types)).toBeNull()` | PASS as written, but a mutant survives (F1) |
| C7004 | splitQuantity forms and limits | same file, 13 named tests | `matching.test.ts:57` `toEqual(expected)` over qty / qty: / x6 / x 6 / 24 x / (x 12); `:61` `toBeNull()` over "VAV boxes", "Boiler 2", "(qty 1)", "(qty 51)", "(qty 500)", "", "qty 4" | PASS |
| C7005 | extraction expands qty rows | `vitest run application/use-cases/extract-import.test.ts` (4 C7005 tests ran) | `extract-import.test.ts:105` `toHaveLength(24)`; `:106` unit numbers "1".."24"; `:107` type text `Set(["VAV box"])`; `:108` `confidence === "medium"`; `:118` stays one row for unit present / above 50 / one | PASS (mutant killed) |
| C7006 | repeats start skipped | `npm run test:db import_duplicates` - "PASS import_duplicates, 1 passed, 0 failed" (recipe replays migration 20261116140000 inside the rolled-back transaction; nothing applied) | `supabase/tests/import_duplicates.sql:25` skipped positions = `array[2]`; `:30` after chunk 2 = `array[2, 7]`; `:32` first of key kept; `:33` same unit under another type kept. Untyped repeat (row 4) and no-unit rows (5, 6) stay unskipped because only position 2 is skipped. Migration `20261116140000_import_duplicates_skipped.sql` is the only `record_extraction_chunk` definition after 20261113140000; it reproduces that function's guards plus the new `skipped` column expression | PASS (SQL mutants reasoned, see Faults); see F3 for an unchecked interaction |
| C7007 | mapping remembers the spelling once, never fails the mapping | `vitest run infrastructure/supabase/import-review.test.ts` (3 C7007 tests ran) | `import-review.test.ts:153` `toEqual({ ok: true, rows: 1 })`; `:155` `updates` length 0 when held; `:160` update args `{ synonyms: ["roof top", "boiler cond"] }`; `:165` ok:true under `fail("42501")`; `:171` no `asset_types` call when no row typed | PASS (mutant killed) |
| C7008 | PDF and "Ours never appears" claims gone | `vitest run components/site/site-pages.test.ts -t "C7008:"` ran | `components/site/site-pages.test.ts:52-55` - four `not.toContain(...)` over `content.ts` and `app/product/page.tsx` | PASS (source-substring proof, see F6) |
| C7009 | robots and sitemap content | `vitest run app/robots.test.ts` (2 C7009 tests ran); live GET `http://localhost:3000/robots.txt` 200 with the same Allow/Disallow set | `app/robots.test.ts:13` `allow` toBe "/"; `:14` disallow contains /review/ /sign/ /api/ /pipeline /agreements /settings; `:15` sitemap URL; `:21-23` sitemap length and 5 named pages; `:25` no URL under any DISALLOWED prefix | PASS (see F5: only 6 of 20 disallowed prefixes named) |
| C7010 | robots and sitemap reachable signed out | `vitest run infrastructure/supabase/session.test.ts` (2 C7010 tests ran) | `infrastructure/supabase/session.test.ts:57` `expect(response.headers.has("location")).toBe(false)` for both paths | PASS (mutant killed) |
| C7011 | four security headers | `vitest run next.config.test.ts` (C7011 ran); live: `/robots.txt`, `/sitemap.xml` carry nosniff, strict-origin-when-cross-origin, DENY, HSTS; `/sign/x` and `/review/x` show Referrer-Policy no-referrer | `next.config.test.ts:39-45` exact `toEqual` of the four headers on rule `/:path*`; `:46-49` review and sign keep `no-referrer` and sit after rule 0 | PASS (mutant killed) |
| C7012 | visible Open signing page link | `vitest run components/signing` (C7012 tests ran) | `components/signing/signing.test.ts:39` `toMatch(<a href="${EMBED}" ... target="_blank" ... rel="noopener noreferrer" ...>Open signing page</a>)`; `:46` absent when signed or closed | PASS |
| C7013 | live browser run at 375/768/1440 | Verifier ran only a small HTTP check against the running dev server: robots.txt 200 body as above, sitemap.xml 200, headers as in C7011 | no browser run by the Verifier; the 375/768/1440 widths, no horizontal scroll, console errors and the signing fallback link were not observed | PASS (partial; the author's Playwright run is NOT observed by the Verifier) |
| C7014 | no new failures | `npx vitest run` - Test Files 6 failed / 323 passed (329); Tests 33 failed / 5418 passed (5451) | failing files: `components/kanban/pipeline-view.test.ts` (28), `components/kanban/expiring-view.test.ts` (1), `components/shell/app-shell.test.ts` (1), `app/pricing/pricing-catalog.test.ts` (1), `components/vocabulary.test.ts` C2019 (1), `domain/purity.test.ts` C2021 (1, lists only `agreements-list.tsx` and `pipeline-view.tsx`, `domain/purity.test.ts:109`). All are on the known pre-existing list; no other file fails | PASS |

## Coverage

Members recomputed from the code (matcher inputs, `next.config.ts`, `app/robots.ts`, `components/site/content.ts` SITEMAP_PATHS) and the claim text, not from the author's table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| report spellings matched (6) | checks.md C7001 | Boiler (condensing), Boiler cond., Chlr, Exh. fan, Backflow DCVA, Backflow RPZ -> C7001 each (`matching.test.ts:15-20`) | - (alias mapping in `ALIASES` is not what makes C7001's backflow rows pass, F2) |
| must stay unmatched (4+1) | checks.md C7002 | Water heater, Sump pump, Grease interceptor, "" -> C7002 (plus "  ") | - |
| quantity forms (6) | `splitQuantity` patterns, `domain/imports/index.ts` (4 regexes + range) | qty N, x N suffix, x N prefix, N x, none, out of range -> C7004; extraction side -> C7005 | - |
| security headers (4) | `next.config.ts` rule 0 | nosniff, referrer, frame, HSTS -> C7011 exact `toEqual` | - |
| secret rules keep no-referrer (2) | `next.config.ts` | /review/, /sign/ -> C7011 :46-49, live headers | - |
| discovery files (2) | `app/robots.ts`, `app/sitemap.ts` | robots, sitemap -> C7009 | - |
| public sitemap pages (12) | `SITEMAP_PATHS` in `components/site/content.ts` | length asserted against the same constant (`robots.test.ts:21`, self-referential); 5 named (:22-23) | 7 of 12 never named: /product /demo /trades /about /faq /contact and / only via `toContain(origin)`; precision gap (F5), not a behaviour gap |
| disallowed prefixes (20) | `DISALLOWED` in `app/robots.ts` | 6 named at `robots.test.ts:14` | 14 of 20 not named (/auth/ /login /contracts /customers /sites /assets /contacts /imports /members /reports /search /templates /setup /billing); F5 |
| startup config: public paths (1 place) | `infrastructure/supabase/session.ts` PUBLIC_PATHS (read directly) | `/robots.txt`, `/sitemap.xml` present in the array; C7010 runs `updateSession` over the real module | - |
| startup config: headers (1 place) | `web/next.config.ts` (read directly) | rule `/:path*` first, then /review/, /sign/; the test imports the real config | - |
| quantity-row interactions (not in the checks) | C7005 x C7006 | no proof | expansion numbers units 1..N from 1 for every row; a second quantity row of the same type collides with the first under C7006 (F3) |

## Test policy rows

No `Test policy` section in checks.md. Nothing to judge; the repo's own convention decided the level (unit test per rule, a database recipe for the SQL, a header/route test over the real config).

## Faults injected

Mutants were applied in place to the real tree with a restore by `git checkout -- <file>` after each run (no worktree, no stash); `git status --porcelain` before: `?? node_modules/`; after every run and at the end: `?? node_modules/` (identical, tree clean of my changes).

| Mutation | Location | Killed |
| --- | --- | --- |
| tie among whole-word fits returns the first type instead of null (`return top[0].id`) | `domain/imports/index.ts` (whole-name tie, `top.length === 1 ? ... : null`) | no - `matching.test.ts` 27 passed; the C7003 test reaches only the later `byHead` tie, so the whole-fit tie path has no proof |
| remove the `ALIASES` table (`= {}`) | `domain/imports/index.ts` ALIASES | partly - `matching.test.ts` (C7001) 27 passed, still green; killed only by `starter-packs.test.ts` C2222 (the "rpz" assertion changed in this batch) |
| expansion keeps `high` confidence instead of capping at `medium` | `application/use-cases/extract-import.ts` rowsFor | yes - C7005 fails |
| drop the "already held" guard before appending a synonym | `infrastructure/supabase/import-review.ts` rememberSpellingOf | yes - C7007 "appends it once" fails |
| remove HSTS from the site-wide rule | `next.config.ts` rule 0 | yes - C7011 fails |
| remove `/robots.txt` and `/sitemap.xml` from PUBLIC_PATHS | `infrastructure/supabase/session.ts` | yes - both C7010 tests fail |
| SQL, reasoned not run: drop the `o.ord < i.ord` or the same-chunk branch; drop the cross-chunk branch; drop `i.type_id is not null`; drop `i.unit_key is not null`; compare raw instead of normalized unit | `20261116140000_import_duplicates_skipped.sql` | yes by reasoning - `import_duplicates.sql:25` (same-chunk row 2 and untyped row 4, no-unit rows 5-6), `:30` (row 7 cross-chunk), `:32-33` (first kept, other type kept) each fail under the corresponding mutant |

Six TypeScript mutants run (cap of five exceeded by one; the sixth and the SQL reasoning added no cost). Two survive or are only killed by a test outside the checks.

## Findings

Ranked.

- **F1 (FAIL, surviving mutant, C7003)**: when two types both fit every word and have the same word count, the matcher must return `null`; replacing that with the first type passes every check. C7003's own example ("Boiler feed" vs "Boiler feed pump" / "Boiler feed tank") fits neither type whole, so it only exercises the first-word fallback tie. A tie of whole fits (for example two types named "Exhaust fan" and "Exhaust fan unit" for the text "exhaust fan unit", or two org types with the same name) has no check. `domain/imports/index.ts` whole-fit tie line.
- **F2 (FAIL, precision gap and weak proof, C7001)**: no C7001 row depends on `ALIASES`. "Backflow DCVA 2in" and "Backflow RPZ 4\"" already contain "backflow", so removing every alias leaves C7001 green. The alias is proven only by the edited C2222 "rpz" assertion in starter-packs.test.ts, outside the check set. A check for the alias itself ("RPZ" or "DCVA 2in" alone typing to Backflow preventer) is missing.
- **F3 (FAIL, unchecked interaction, C7005 x C7006)**: expansion always numbers units 1..N, and the database then skips any typed row whose type and unit # repeat an earlier row of the same job. Two quantity rows of one type ("VAV boxes (qty 24)" on one floor, "VAV boxes (qty 12)" on another, or the same label in two chunks) make the second group's rows all start skipped as "Same as row N", so "Add N assets" undercounts. They stay visible and unskippable in one click, so this is not data loss, but no check states or covers it, and the C7005 test uses only one quantity row.
- **F4 (FAIL, matcher over-reach not caught by any check)**: the checks only prove that wording with no related type stays null. Probed on a copy of `domain/imports/index.ts` (scratchpad, not committed): with only a "Boiler" type, "Boiler feed pump", "Boiler room exhaust fan" and "Boiler water treatment tank" all type to Boiler; with only "Fan", "Fan coil unit" types to Fan; with only "Pump", "Sump pump" and "Condensate pump" type to Pump; with "Backflow preventer" and "Pump" types, "Backflow pump" types to Pump; "Exhaust" alone types to "Exhaust fan"; "Thermal expansion tank" types to "Expansion tank" (that one is correct). The rule "every word of a type's name found in the text" lets extra words in the text qualify the type into a different piece of equipment. The author's example "Boiler feed pump typed as Boiler when only Boiler exists" is confirmed. No check bounds this, and it is only visible to the user through the review screen, where a typed row is not shown as less certain than before. Under the stated intent ("a guess would hide a row the review must see") this is the direction of risk C7002/C7003 do not cover. Also "Hot water heater" with "Hot water tank" and "Expansion tank" gives null, which is fine.
- **F5 (precision gap, C7009)**: the robots test names 6 of 20 disallowed prefixes and the sitemap test uses `SITEMAP_PATHS.length` as its own oracle (`robots.test.ts:21`) and names 5 of 12 pages. A prefix dropped from `DISALLOWED` (for example /imports) or a public page dropped from `SITEMAP_PATHS` would pass unless it is one of the named ones. Live robots.txt matches the code, so no behaviour defect was observed.
- **F6 (note, C7008)**: proof is negative substring matching on two source files; it passes if the wording is changed to another false claim. Accepted for a copy check, noted for completeness.
- **F7 (C7013, not observed)**: the live browser run at 375/768/1440, horizontal scroll, console errors and the signing fallback link were not observed by the Verifier. The dev server was up; only HTTP bodies and headers were checked (robots 200, sitemap 200, headers per C7011; `/sign/x` and `/review/x` 404 with `no-referrer`). C7013 rests on the author's report.

### The two deliberately changed existing tests

1. `domain/imports/extract.test.ts` C515, "Rooftop Unit #2": `null` became `id-RTU`, plus two new rows ("Rooftop Unit Curb Adapter Kit Ultra" -> RTU, "Heat Pump Unit" -> null). This reverses what the old test asserted, which was the old rule that wording merely close to a type is not a match. That rule was the cause of the QA report, so the change is legitimate, and the old protection that mattered ("close but different equipment stays untyped") is kept only by "Heat Pump Unit" -> null, a single case. It does not protect against the class in F4 (extra words naming other equipment). The "Curb Adapter Kit Ultra" row asserts the permissive behaviour that F4 shows can be wrong. Weakened in the sense that the permissive direction is pinned and the restrictive direction is thin.
2. `domain/imports/starter-packs.test.ts` C2222: "rpz" now asserts `BACKFLOW_PREVENTER`, and `matchAssetType("thermal expansion tank", org)` is deleted (the "prv" -> null assertion remains). The test title still reads "left untyped, not given to another type" but one of three assertions now asserts the opposite and one is gone. The deleted spelling is the plumbing pack's own spelling of `EXPANSION_TANK` (`20261109163948_starter_packs.sql:26`), so it typing to the hvac "Expansion tank" is the correct type; deleting the assertion removes a proof rather than replacing it with "types to EXPANSION_TANK". Another assertion (every spelling types to its own type, C2222 loop at :46-57, still green) covers the same-type case. Net: minor weakening, no live proof lost that mattered, but the test title is now partly false and the alias is only proven here (F2).

## Gate

`npx vitest run` - Tests 33 failed (all on the known pre-existing list), 5418 passed; Test Files 6 failed, 323 passed.
Targeted run of the 13 target files - 322 passed, 0 failed.
`npm run test:db import_duplicates` - PASS import_duplicates, 1 passed, 0 failed.
