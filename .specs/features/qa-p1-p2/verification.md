# qa-p1-p2 verification

**Verdict**: PASS
**Profile**: ui
**Diff range**: 54837d1..HEAD (HEAD 4cbf777; matcher fix in 83ac07e)
**Round**: 3 - full (proofs re-run in full at 4cbf777)
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none marked (bounded batch, no plan.md; the Intent section of checks.md is the only brief; bare `-` row) | n/a - nothing marked binding | none | - |

The only screen touched is one link on the signing page (C7012); the rest are two machine files and a matcher. Commit 83ac07e touched no interface. The signing fallback has no design source to compare against.

## Checks

Proofs run at 4cbf777: one batched invocation of 9 files in verbose mode (233 passed, 0 failed, every C70xx test visible by name), the full `npx vitest run`, and `npm run test:db import_duplicates` (run twice; after the owner applied the migration the recipe runs against the hosted objects, still PASS).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C7001 | six report spellings typed; alias alone types; qualifier, bracket and period forms type | `npx vitest run domain/imports/matching.test.ts ...` (6 row tests plus 2) | `matching.test.ts:22` `expect(matchAssetType(raw, TYPES)).toBe(id)` over `:15-20`; `:56-58` `matchAssetType("DCVA 2in", TYPES)` toBe "backflow", `"RPZ"` toBe "backflow", null without the type; `:62-64` "Chiller (water cooled)", "Boiler cond.", "Boiler gas" typed | PASS |
| C7002 | unrelated stays null, exact wins, extra words must be explained, waivers scoped | same file | `:26` `toBeNull()` over Water heater / Sump pump / Grease interceptor / "" / "  "; `:30-32` exact name, code, synonym; `:37-39` exact beats token; `:47` null for Boiler feed pump etc.; `:52` null for Sump pump etc.; `:69` null for "Boiler pump.", "Chiller pump.", "Boiler tank.", "Exhaust fan motor.", "Pump motor."; `:74` null for "RPZ pump", "Pump RPZ", "Pump BF", "Boiler RPZ", "Boiler DCVA 2in", "Boiler PVB", "Chiller RPZ"; `:78` null for "Boiler (feed pump)", "Boiler (sump pump)", "Boiler (water heater)", "Chiller (pump)" | PASS |
| C7003 | tie gives null | same file | `:88` `expect(matchAssetType("Boiler feed", types)).toBeNull()`; `:83` `matchAssetType("Exh.", types)` `toBeNull()` | PASS |
| C7004 | splitQuantity forms and limits | same file (13 C7004 tests) | `:101` `toEqual(expected)` over six forms; `:105` `toBeNull()` over "VAV boxes", "Boiler 2", "(qty 1)", "(qty 51)", "(qty 500)", "", "qty 4" | PASS |
| C7005 | extraction expands qty rows | `application/use-cases/extract-import.test.ts` (4 C7005 tests ran) | `extract-import.test.ts:105` `toHaveLength(24)`; `:106` units "1".."24"; `:108` confidence medium; `:118` stays one row (unit present / above 50 / one); carried from round 1, file untouched since | PASS |
| C7006 | repeats start skipped | `npm run test:db import_duplicates` - PASS, 1 passed, 0 failed (rolled-back; against hosted objects after the owner applied the migration) | `supabase/tests/import_duplicates.sql:25` skipped positions `array[2]`; `:30` `array[2, 7]`; `:32` first of key kept; `:33` same unit under another type kept (line numbers from round 2; the file's header comment changed only) | PASS |
| C7007 | mapping remembers the spelling once, never fails | `infrastructure/supabase/import-review.test.ts` (3 C7007 tests ran) | `import-review.test.ts:153` `toEqual({ ok: true, rows: 1 })`; `:155` no update when held; `:160` args `{ synonyms: ["roof top", "boiler cond"] }`; `:165` ok:true under refusal (carried, file untouched) | PASS |
| C7008 | PDF and "Ours never appears" gone | `components/site/site-pages.test.ts` (C7008 ran) | `site-pages.test.ts:52-55` four `not.toContain(...)` over `content.ts` and `app/product/page.tsx`; negative-substring proof, precision note P2 only | PASS |
| C7009 | robots lists the full allow/disallow set and sitemap; sitemap lists exactly the 12 public pages | `app/robots.test.ts` (2 C7009 tests ran); live `GET /robots.txt` 200 shows the 20 disallows and the sitemap line, `GET /sitemap.xml` has 12 `<loc>` | `robots.test.ts:15` `expect(rules.allow).toBe("/")`; `:16` `expect(rules.disallow).toEqual(BLOCKED)` (20 literals, `:8`); `:17` `expect(DISALLOWED).toEqual(BLOCKED)`; `:18` sitemap URL; `:24` `expect(urls).toEqual(PUBLIC_PAGES.map(...))` (12 literals, `:7`); `:26` no URL under a blocked prefix | PASS |
| C7010 | robots and sitemap reachable signed out | `infrastructure/supabase/session.test.ts` (2 C7010 tests ran) | `session.test.ts:57` `expect(response.headers.has("location")).toBe(false)` for both paths | PASS |
| C7011 | four security headers, review and sign keep no-referrer | `next.config.test.ts` (C7011 ran) | `next.config.test.ts:39-45` exact `toEqual` of the four headers on `/:path*`; `:46-49` review and sign keep `no-referrer` | PASS |
| C7012 | visible Open signing page link | `components/signing` (3 C7012 tests ran) | `signing.test.ts:39` `toMatch(<a href="${EMBED}" ... >Open signing page</a>)`; `:46` absent when signed or closed | PASS |
| C7013 | live: robots and sitemap 200 with expected body, no console errors; public page carries four headers; /sign and /review keep no-referrer; wording now scopes out the XML viewer width and the token-dependent fallback | Round 2 Playwright (one context; six loads 200, no console errors) carried; at 4cbf777 re-observed over HTTP against the running dev server | `curl /robots.txt` 200, body lists 20 Disallow lines and `Sitemap: http://localhost:3000/sitemap.xml`; `/sitemap.xml` 12 `<loc>`; `/pricing` headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`; `/sign/x` and `/review/x` `referrer-policy: no-referrer`. The reworded check no longer claims the XML viewer width or a live token, so round 2's objection is met. A fresh browser console pass was not repeated (no code changed on those routes) | PASS |
| C7014 | no new failures | `npx vitest run` at 4cbf777 - Test Files 6 failed / 328 passed (334); Tests 33 failed / 5483 passed (5516) | failing files: `components/kanban/pipeline-view.test.ts` (28), `components/kanban/expiring-view.test.ts` (1), `components/shell/app-shell.test.ts` (1), `app/pricing/pricing-catalog.test.ts` (1), `components/vocabulary.test.ts` (1), `domain/purity.test.ts` (1). All on the known list. rls_isolation C35 and customer_portal are DB suites, not in this run. An earlier full run during the coordinator's uncommitted edits also showed 3 `template-choices.test.ts` C7110 failures; they were an in-flight tree state, the file passes alone (6/6) and the full run at the committed 4cbf777 is clean of them | PASS |

## Coverage

Recomputed at 4cbf777.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| report spellings typed (6) | checks.md C7001 | each -> `matching.test.ts:15-20`; also typed in my probe over both a 4-type and an 8-type catalog | - |
| must stay unmatched (3 + blank) | checks.md C7002 | `matching.test.ts:25`; probe: all null | - |
| round 1 over-reach examples (7) | round 1 | `:43-52` | - |
| waiver paths (period, alias, bracket) x negative | `matchAssetType` | period `:67-70`, alias `:72-75`, bracket `:77-79`, each mutant-killed | - |
| quantity forms (6) | `splitQuantity` | C7004; extraction C7005 | - |
| security headers (4) and two no-referrer rules | `next.config.ts` | C7011 | - |
| public sitemap pages (12) | `SITEMAP_PATHS` in `components/site/content.ts:29` | all 12 literals in `robots.test.ts:7`, asserted `toEqual` at `:24` | - |
| disallowed prefixes (20) | `DISALLOWED` in `app/robots.ts:5`; app routes from `web/app` and `web/app/(app)` directories | all 20 literals in `robots.test.ts:8`, `toEqual` at `:16` | - |
| startup config: public paths (1 place) | `session.ts` PUBLIC_PATHS read directly | C7010 over the real module | - |
| startup config: headers (1 place) | `next.config.ts` read directly | C7011 imports the real config | - |

Not a Coverage set: the quantity x duplicate interaction (C7005 x C7006) has no proof and is accepted as the first bullet of `## Known limits`.

## Test policy rows

No `Test policy` section in checks.md. Nothing to judge; the repo's own convention decided the level.

## Faults injected

Verified at 4cbf777. Mutants applied in place, then restored with `git checkout` of the single file; `git status --porcelain` before and after: `?? node_modules/` only.

| Mutation | Location | Killed |
| --- | --- | --- |
| alias waiver made global (`!ALIASES[token]`) | `domain/imports/index.ts` `unexplained` | yes - 7 "an alias only explains its own family" tests fail |
| period waiver for any dotted word (`!dotted.has(token)`) | `domain/imports/index.ts` `unexplained` | yes - 5 "not explained by a period alone" tests fail |
| bracket descriptor check deleted | `domain/imports/index.ts:187` | yes - 4 "bracketed equipment words" tests fail |
| `/members` removed from `DISALLOWED` | `app/robots.ts:5` | yes - C7009 robots test fails |
| `/security` removed from `SITEMAP_PATHS` | `components/site/content.ts:29` | yes - C7009 sitemap test fails |

Round 1 and 2 mutants (ties, `unexplained` filter, alias expansion, bracket strip, C7005 confidence, C7007 guard, C7011 HSTS, C7010 public paths) carried; the files they touch changed only in the three waiver lines above.

## Findings

Round 2 failures, judged against 4cbf777:

- F1 (period waiver): resolved. A period explains only a short form of a qualifier; "Boiler pump." and four more null.
- F2 (alias waiver): resolved. An alias explains only a word its type holds; seven combinations null.
- F3 (bracket ignored): resolved. Bracketed words must be in `DESCRIPTORS`, else null; four null.
- C7009 precision: resolved. Both sets asserted as full literals.
- C7013 wording: resolved. Check states the XML viewer and token limits.

Matcher re-probe (scratch copy outside the repo, about 190 realistic labels x two catalogs: a 4-type set and an 8-type set with Pump, Fan, Rooftop unit, Air handling unit): no wrong typing found among the pump/fan/boiler/chiller/exhaust/backflow combinations, with and without periods, brackets and aliases. All of these stay null: Boiler pump / pump. / feed pump / (feed pump) / (pump) / (water pump) / (HW) / room / plant / tank / heat exchanger / controls, Chiller pump(.) / (pump) / Chlr pump(.), Exhaust pump, Exh. pump, Exhaust fan motor(.), Fan coil, Pump fan, Pump RPZ, RPZ pump, Boiler RPZ, Backflow pump, Backflow tank, Water heater, Sump pump, Grease interceptor. The 6 report items type, and the 3 stay untyped. Other things type that are acceptable: "Boiler (2)", "Boiler (A)", "Boiler eff.", "Boiler high eff.", "Boiler (spare/new/old/roof/air/water)", "Chiller (high/low/spare)", "Exh. fan 3", "Backflow prev.", "Chiller cond.", "Cond. pump" -> Pump (a condensing/condenser pump is still a pump).

Not blocking, for awareness (all unlisted in `## Known limits`, but each is the same family as the listed one-word/first-word limit or safe-side):
- "Backflow" alone, "Exhaust" alone type to the single type that starts with them (listed limit).
- "Chiller cond." types Chiller although "cond." can mean the condenser, a component; "Boiler con." types Boiler. A short qualifier prefix is accepted by design (`fitsWord` with a period).
- Bracketed single digit-led tokens such as "2nd" are ignored; "Boiler (2nd pump)" still nulls through "pump". Contrived.
- Under-matching ("Boiler (HW)", "Boiler (north)", "Boiler water", "Boiler heat") gives null, the safe direction.
- `/concepts/` is publicly reachable and neither in the sitemap nor disallowed; design-concept pages, minor. `/billing` is in `DISALLOWED` with no matching route directory; harmless.
- P2: C7008 is a source-substring proof.
- N1: C2222 title in `starter-packs.test.ts` still reads "left untyped" while its first assertion now expects the backflow type; the comment explains. Cosmetic.

Nothing else blocks. `## Known limits` items are accepted as documented limits.

## Gate

`npx vitest run` - Tests 33 failed (all on the known pre-existing list), 5483 passed; Test Files 6 failed, 328 passed.
Batched target run (9 files, verbose) - 233 passed, 0 failed.
`npm run test:db import_duplicates` - PASS import_duplicates, 1 passed, 0 failed.
