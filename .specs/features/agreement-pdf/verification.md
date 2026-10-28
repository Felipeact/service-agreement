# Agreement PDF verification

**Verdict**: FAIL - blocked only by live checks no independent run could perform: C877 and C878 (signed-in half) are AUTHOR-RECORDED, NOT INDEPENDENTLY RUN, and the live overflow half of C871 and C878 other-org were run by nobody. Every code-level gap from round 1 is closed: the 2 surviving mutants (C858 accent, C860 visits per year) are now KILLED, and 5 of 5 round 2 faults were killed
**Profile**: standard
**Diff range**: 976a7fb..3f9620f (HEAD)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scope of this round: the fix diff (`3f9620f`, tests only: `agreement-pdf.test.ts`, `pdf-text.testing.ts`, `pdf/route.test.ts`, `composition/pdf-route.test.ts`, plus checks.md and the round 1 report) and every check that was not PASS in round 1 (C858, C860, C863, C870, C871, C877, C878) plus C866. Everything else is `carried from ba2385e` (the commit round 1 verified at; the feature's build commit is `2c0bef9`). The fix changed no production file, so no carried row's behaviour could move, and every proof re-ran at the new HEAD anyway.

## Binding sources

carried from ba2385e - Step 1 runs under `ui` only and this feature is `standard`; it did not run. The fix touched no interface.

## Checks

Proofs verified at 3f9620f in two invocations from `web/`: (1) `npm test -- --reporter=verbose`, exit 0, 59 files, 1344 passed, 0 failed (round 1: 1338; the 6 added tests are the fix's), each `C###:` test listed individually in the output (every name in the Evidence column ran, including the 6 new ones); (2) `npm run lint` exit 0, `npx tsc --noEmit` exit 0, `npm run build` exit 0 with `├ ƒ /agreements/[agreementId]/pdf`, and the C875 grep (`grep -rn "Kettle Ridge" ... --exclude=*.test.ts --exclude=*.test.tsx`) printed nothing, exit 1. Filters of the form `app/\(app\)/...` do not match under vitest; `pdf/route` does.

### Re-judged in round 2 (verified at 3f9620f)

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C858 | header: name, address, phone, accent drawn | `npm test` (verbose), ran; fault (a) | `infrastructure/documents/agreement-pdf.test.ts:190-193` - `expect(teal.has("#1f6f8b")).toBe(true); expect(teal.has("#7a1f5c")).toBe(false); expect(plum.has("#7a1f5c")).toBe(true); expect(plum.has("#1f6f8b")).toBe(false)`, colours read from the `scn`/`SCN` operators of the real bytes (`pdf-text.testing.ts` `pdfColours`). Adversarial: hard-coded `#000000` fails line 190 (killed, fault a); a constant `#1f6f8b` fails line 192. Name, address, phone and null handling carried (`:46-53`, `document.test.ts:36,46`). PRECISION GAP, not a demonstrated survivor: `pdfColours` returns one set over fill and stroke, so the text accent alone satisfies `teal.has`; a mutant that hard-codes only the title rule (`borderBottomColor`) would likely survive. I had no fault slot left to demonstrate it (cap five). | PASS (with precision gap) |
| C860 | each line's visits per year, figures, total | `npm test`, ran; fault (b) | `agreement-pdf.test.ts:203` - `expect(rows.slice(at("Quarterly visit"), at("Quarterly visit") + 4)).toEqual(["Quarterly visit", "4", "$450.00", "$1,800.00"])`; `:204` same for `["Monthly check", "12", "$100.00", "$1,200.00"]`. Adversarial: `+1`, a swapped column or a missing column all change the 4-row slice. Total from `annualCents` and the figures carried (`:64-73`, `document.test.ts:93-94`). | PASS |
| C863 | one row per asset, null -> empty cell | `npm test`, ran; faults (d), (e) | `agreement-pdf.test.ts:211` - `expect(section.filter((row) => /^[AB]-\d$/.test(row))).toEqual(["A-1", "A-2", "B-1"])`; `:212` `expect(section.filter((row) => /^(Model 7|Model 8|Cast iron)$/.test(row))).toHaveLength(3)`. Adversarial: duplicated rows fail `toEqual` (fault d), a dropped row fails (fault e). Grouping and empty cells carried (`:99-100`). | PASS |
| C866 | draft mark: current draft yes, past version of a draft no, sent no | `npm test` (route + adapter + model), ran; fault (c) | Route level, real builder, mocked renderer: `pdf/route.test.ts:140` `expect(renderAgreement.mock.calls[0][0].mark).toBe("DRAFT - not yet sent to the customer")` (draft, `editable: true`); `:144` `expect(renderAgreement.mock.calls[1][0].mark).toBeNull()` (draft, `editable: false`, `?version=1`); `:148` `expect(renderAgreement.mock.calls[2][0].mark).toBeNull()` (sent). Bytes: `agreement-pdf.test.ts:136-137` carried. This closes round 1's past-version gap at the route. Adversarial: `editable \|\| true` kills `:144` and `:148` (fault c); marking by `status === "draft"` would fail `:144`. Residual: the past-version case is proven on the document handed to the renderer, not on rendered bytes; the renderer draws exactly `document.mark` (round 1 fault F2 and `:136`), so it is the same `null` path as a sent version. | PASS |
| C870 | 2,000 rows in 40 types, route 200, `maxDuration` >= 2x measured | `npm test` (`pdf-route`, `pdf/route`, adapter), ran; fault (e) | `composition/pdf-route.test.ts:78` `expect(response.status).toBe(200)`; `:80` `expect(found.size).toBe(2000)` - through the real route and the real adapter, 120 s test timeout, about 19 s here. Adapter `agreement-pdf.test.ts:164-165`, `route.test.ts:168` `toBeGreaterThanOrEqual(44)` and `route.ts:7` `maxDuration = 60` carried. Adversarial: dropping the last asset per type fails `:80` (fault e). Round 1's "route 200 not exercised" gap is closed. | PASS |
| C871 | 200-char unspaced string in 3 places, every char present; page count unchanged except added lines; live: no overflow | `npm test`, ran | Text half: `agreement-pdf.test.ts:176` `toContain(long)` x3 (carried); `:182-183` wraps over > 3 lines, longest < 60 (carried); new `:218` `expect(plain).toHaveLength(1)`, `:219` `expect(long).toHaveLength(plain.length)`. Adversarial: the page-count assertion alone is loose (a clipping implementation also keeps one page), but clipping is caught by the `toContain(long)` assertions, so the pair holds. Live overflow by eye: NOT RUN by anyone (the author did not write a 200-character string to the live project; I cannot sign in). | NOT RUN (live overflow half); text half PASS |
| C877 | live: download, draft mark only on draft, tenant name + accent, 375/768/1440, 44 px target | not runnable by this verifier | AUTHOR-RECORDED, NOT INDEPENDENTLY RUN. checks.md "Round 1 fixes and live record" reports, as the demo owner on a dev server with Playwright: `AG-1052-v1.pdf`, 5,396 bytes, `%PDF-`, draft mark on both pages, Kettle Ridge name/address/phone, 2 lines + `Total per year $3,870.00` + `before tax`, Service included and Equipment for 3 types, 6 terms, `Page 1 of 2`/`Page 2 of 2`; AG-1052, AG-1039, AG-1048 all `200 application/pdf`; link 91 x 44 px at 375 and 768 px, 91 x 19 px at 1440 px, no horizontal scroll at all three widths, console 0 errors. Not stated by the record: that a `sent` agreement's PDF was seen without the draft mark (the page text read-back was of the draft AG-1052), and the `#1f6f8b` accent on the live file. | AUTHOR-RECORDED, NOT INDEPENDENTLY RUN |
| C878 | live: other org -> 404, signed out -> `/login` | not runnable by this verifier | AUTHOR-RECORDED, NOT INDEPENDENTLY RUN: signed out, `/agreements/<uuid>/pdf`, with `?version=2`, and `/agreements/not-a-uuid/pdf` all `307` to `/login` (curl); signed in, an unknown uuid and `not-a-uuid` answer an empty `404`. NOT RUN by anyone: another org's real agreement (no second-org user). Test-level coverage that did run: signed-out redirect `session.test.ts` C856, 404 for another org `route.test.ts` C854 (mocked reader returns `null`). | AUTHOR-RECORDED, NOT INDEPENDENTLY RUN (other-org live: NOT RUN) |

### Carried forward (carried from ba2385e)

Each row is round 1's evidence; the named tests re-ran green at 3f9620f (see the proofs paragraph above).


| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C851 | 200, application/pdf, `%PDF-` ... `%%EOF`, real adapter | `vitest run pdf/route composition/pdf-route` exit 0 | `composition/pdf-route.test.ts:58-62` - `expect(response.status).toBe(200)`; `expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-")`; `expect(body.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true)`. Mocked-renderer header: `route.test.ts:73` `expect(response.headers.get("Content-Type")).toBe("application/pdf")` | PASS (carried from ba2385e) |
| C852 | 7 `version` inputs -> `get(id, n \| undefined)` | same run, 7 `C852:` rows ran | `route.test.ts:88-89` - `expect(get).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledWith(AGR, expected)`, table at `:78-85` holds all 7 inputs, `0` -> `undefined`. Mutant F1 (`/^\d+$/`) killed by the `?version=0` row | PASS (carried from ba2385e) |
| C853 | filename uses version rendered | same run | `route.test.ts:93` `toBe('attachment; filename="AG-1052-v1.pdf"')`, `:96` `toBe('attachment; filename="AG-1052-v2.pdf"')` with `?version=9` and reader returning v2 | PASS (carried from ba2385e) |
| C854 | empty 404, renderer never called, 3 causes | same run, 3 rows | `route.test.ts:107-112` - `expect(response.status).toBe(404)`; `expect(body).toBe("")`; `expect(body).not.toContain("Fernwood")`; `expect(renderAgreement).not.toHaveBeenCalled()`. Route: `route.ts:19` `if (!isUuid(agreementId)) return empty(404)` | PASS (carried from ba2385e) |
| C855 | 200 for owner, admin, estimator, viewer | same run, 4 rows | `route.test.ts:116-118` - `test.each(["owner","admin","estimator","viewer"])` ... `expect((await call()).status).toBe(200)` | PASS (carried from ba2385e) |
| C856 | no session -> redirect to `/login`, no handler; matcher matches the path | `proxy.test.ts`, `session.test.ts`, route test ran | `proxy.test.ts:31-32` - `expect(matches(".../pdf")).toBe(true)` and with `?version=2`; `session.test.ts:107-108` - `expect(response.status).toBe(307); expect(locationPath(response)).toBe("/login")`; `route.test.ts:125-128` - 307 to `/login`, `expect(get).not.toHaveBeenCalled()`. Split across three files is acceptable (see Deviations). | PASS (carried from ba2385e) |
| C857 | "Download PDF" link `href` for the version shown, 4 cases + viewer | `vitest run components/agreements` | `components/agreements/agreements.test.ts:159` - `expect(pdfLink(html)).toBe(href)`, table `:148-154` includes `?version=1` past version and `not_recorded`, plus a `viewer` row | PASS (carried from ba2385e) |
| C859 | page 1 has number, `Version 1`, customer, site | `infrastructure/documents` | `agreement-pdf.test.ts:58-59` - `expect(first).toContain(expected)` over `["AG-1052","Version 3","Fernwood Dental","Fernwood Dental, Main"]`; `inOrder(...)` | PASS (carried from ba2385e) |
| C861 | 0 lines -> "No services priced yet", no total, no header | same | `:78-80` - `toContain("No services priced yet")`, `not.toContain("Total per year")`, `not.toContain("Visits per year")` (the header text is "Visits per year", `agreement-pdf.tsx:81`) | PASS (carried from ba2385e) |
| C862 | order, `<n> unit(s)`, checklist order, empty checklist | same | `:91-92` - `inOrder(indexOfIn(section, "AHU, 2 units", "- Replace filters", "- Check belts", "Boiler, 1 unit", "Unit heater, 1 unit", "- Inspect burner"))`, `not.toContain("Boiler, 1 unit\n-")` | PASS (carried from ba2385e) |
| C864 | 6 terms, 4 nullable each absent, all-4-null leaves 2 | model + rendered | Model `document.test.ts:52-59` full `toEqual` of 6; `:68-70` `not.toContain(label)`, `toHaveLength(5)` x4; `:75` `toEqual(["Repair discount","CPI cap"])`. Rendered `agreement-pdf.test.ts:105-110` - `toContain` of all terms; tax note null -> `not.toContain("Tax note")` | PASS (carried from ba2385e) |
| C865 | footer `Page x of N` + number on every page; row not split; heading not last | `infrastructure/documents` | `:120` - `expect(rows.slice(-2)).toEqual(["AG-1052", \`Page ${i + 1} of ${pages.length}\`])`; `:121` heading not third from last; `:117` `pages.length >= 3` | PASS (carried from ba2385e) |
| C867 | frozen: `Scope recorded <date>`, no mark | same | `:144` `toContain(\`Scope recorded ${date.format(recordedOn)}\`)`; `:146` `not.toContain("DRAFT")`; `:147` live render `not.toContain("Scope recorded")` | PASS (carried from ba2385e) |
| C868 | not_recorded: 200, sentence, no headings, lines+total kept | adapter + real-adapter route | `agreement-pdf.test.ts:152-156` - `toContain("The equipment covered ... not recorded")`, `not.toContain("Service included")`, `not.toContain("Equipment\n")`, `toContain("$3,870.00")`; `composition/pdf-route.test.ts:69-70` - `status 200` and sentence in the real route's bytes | PASS (carried from ba2385e) |
| C869 | empty 503, `console.error`, no bytes, 3 causes; reader reject not caught | `pdf/route` | `route.test.ts:155-158` - `toBe(503)`, `await response.text()).toBe("")`, `Content-Type).not.toBe("application/pdf")`, `expect(log).toHaveBeenCalledTimes(1)`; `:163` `rejects.toThrow("db down")` | PASS (carried from ba2385e) |
| C872 | `Café Rénée's` x3 and typographic `’` | adapter | `:190` `expect(all.split(winAnsi(name)).length - 1).toBe(3)` (customer, task, location); `:192` straight apostrophe `toContain("Rénée's Café")` | PASS (carried from ba2385e) |
| C873 | dependency pinned exact; only the adapter may import it | `boundaries.test.ts` | `boundaries.test.ts:68` `expect(pkg.dependencies["@react-pdf/renderer"]).toBe("4.9.0")`; `:56-60` 7 places each give 1 lint message naming `infrastructure/documents`; `:62-64` the adapter folder gets 0. Note: the route does not import the library at all (through the container only), stricter than the check | PASS (carried from ba2385e) |
| C874 | port signature, document type has no react, container exposes `documentRenderer` | `boundaries.test.ts`, `composition.test.ts` | `boundaries.test.ts:74` `toContain("renderAgreement(document: AgreementDocument): Promise<Uint8Array>;")`; `:77-78` no react import, no `ReactElement`; `composition.test.ts:228` `typeof container.documentRenderer.renderAgreement).toBe("function")` and `:229` source `toMatch(/documentRenderer: reactPdfDocumentRenderer,/)`; `composition/index.ts:114` | PASS (carried from ba2385e) |
| C875 | no `Kettle Ridge` literal in non-test source | `grep -rn "Kettle Ridge" app components domain application infrastructure composition lib --include=*.ts --include=*.tsx --exclude=*.test.ts --exclude=*.test.tsx` | no output, exit 1 | PASS (carried from ba2385e) |
| C876 | build, lint, tsc exit 0; route `ƒ` | `npm run build`, `npm run lint`, `npx tsc --noEmit` | build exit 0, `├ ƒ /agreements/[agreementId]/pdf`; lint exit 0; tsc exit 0 (no typegen needed) | PASS (carried from ba2385e) |

C875 and C876 were also re-run at 3f9620f (grep empty; build, lint, tsc exit 0), so they are verified at 3f9620f as well as carried.

### Deviations from the author's Build record

Carried from ba2385e, unchanged. New this round: the author's claim that both surviving mutants were "re-injected by hand and killed" was confirmed independently (faults a and b below). The round 1 report was committed inside the fix commit `3f9620f`; it is overwritten here.

## Coverage

Recomputed at 3f9620f for the rows whose authority the fix touched; the rest are carried from ba2385e.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Header fields (4: name, address, phone, accent) | AC 8; `agreement-pdf.tsx:42-56` (verified at 3f9620f) | name/address/phone `agreement-pdf.test.ts:46`; accent on the bytes `:190-193` | - (precision gap: fill vs stroke not separated, see C858) |
| Content sections (6) | AC 10-14 (verified at 3f9620f) | header C858, lines C860 now incl. visits per year `:203-204`, Service included C862, Equipment C863 `:211-212`, terms C864 | - |
| Scope source (3) x draft mark (3: current draft, past version of a draft, sent) | `document.ts:66`; AC 16 (verified at 3f9620f) | current draft `route.test.ts:140` and bytes `agreement-pdf.test.ts:136`; past version of a draft `route.test.ts:144`, `document.test.ts:99`; sent `route.test.ts:148`, bytes `:137`; frozen C867 and not_recorded C868 carried | - |
| Large/awkward (3: 2,000 rows, 200-char, accents) | AC 20-22 (verified at 3f9620f) | C870 `pdf-route.test.ts:80` and `agreement-pdf.test.ts:165`; C871 text `:176`, page count `:219`; C872 `:190` carried | AC 21 "no overflow, inside its column" is live-only and NOT RUN |
| Route statuses, 404 causes, 503 causes, roles, `?version` inputs, redirect, terms, view link, one-way doors, footer, startup config | carried from ba2385e | unchanged; the fix touched none of their sources | - |

Level check: the fix moved the accent, visits, row count and draft-mark evidence to the rendered bytes or the route, closing round 1's model-only exceptions except the residual noted under C866.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `pdf/route.ts`, `document.ts`, `agreement-pdf.tsx` | route boundary + own layer; builder `document.test.ts` + bytes; adapter layout on bytes | yes at 3f9620f - the adapter's accent colour and visits column, the decisions round 1 found unasserted, now fail when changed (faults a, b) |
| Decides, not reached across a boundary | builder null handling, ordering, wording | one at its own layer, one case per row | yes (carried from ba2385e) |
| Instrumentation | `agreement-view.tsx` link, container wiring | none of its own; C857 and C874 pass-through | yes (carried from ba2385e) |

## Faults injected

verified at 3f9620f. Isolated in `git worktree add --detach` (node_modules junctioned), removed with `git worktree remove --force` and pruned; no `git stash`. Real-tree `git status --porcelain` before: empty; after: empty. They match. The five round 1 faults are carried from ba2385e (all killed or recorded there); these five are new surfaces from the fix.

| Mutation | Location | Killed |
| --- | --- | --- |
| (a) tenant accent hard-coded `#000000`, both the text colour `accent` and the `borderBottomColor` rule | `web/infrastructure/documents/agreement-pdf.tsx:42-43` | yes - `C858: the accent colour is drawn on the page...` fails (1 failed, 180 passed) |
| (b) visits per year `{line.visitsPerYear + 1}` | `web/infrastructure/documents/agreement-pdf.tsx:88` | yes - `C860: each line prints its own visits per year...` fails (1 failed, 180 passed) |
| (c) draft mark always on: `source.editable \|\| true ? DRAFT_MARK : null` | `web/domain/agreement/document.ts:66` | yes - route `C866: the draft mark is handed over only for the current version of a draft` and model `C866: only an editable...` fail |
| (d) every asset row rendered twice: `[...type.assets, ...type.assets].map` | `web/infrastructure/documents/agreement-pdf.tsx:127` | yes - `C863: exactly one row per asset...` and `C872` fail |
| (e) last asset of each type dropped: `type.assets.slice(0, -1).map` | `web/infrastructure/documents/agreement-pdf.tsx:127` | yes - route-level `C870: a site with 2,000 assets answers 200 through the route...` fails, with adapter `C870`, both `C863`, `C871` location, `C872` |

Not injected (cap five): a rule-only accent mutant (see the C858 precision gap).

## Gate

verified at 3f9620f: `npm test` (from `web/`) - 59 test files, 1344 passed, 0 failed. `npm run lint` exit 0, `npx tsc --noEmit` exit 0, `npm run build` exit 0 with `ƒ /agreements/[agreementId]/pdf`, C875 grep empty.

## Ranked gaps

1. Live checks not independently run: C877 and C878 signed-in half are author-recorded only; C871 live overflow and C878 another org's agreement were run by nobody. These are the only rows blocking a PASS. - C877, C878, C871 - checks.md "Round 1 fixes and live record"
2. C858 precision gap: the accent assertion pools fill and stroke colours, so the title rule colour is not separately pinned; a rule-only hard-coded colour probably survives. - C858 - `agreement-pdf.test.ts:190-193`
3. C877 record does not state that a `sent` PDF was seen without the draft mark, nor the accent colour on the live file. - C877 - checks.md live record
