# Agreement PDF verification

**Verdict**: FAIL - 2 surviving mutants (accent colour and visits-per-year are not asserted on the rendered bytes: C858, C860); C877, C878 (signed-in half) and the live part of C871 are NOT RUN (need a signed-in browser); C871 and C870 each have a stated sub-claim with no assertion
**Profile**: standard
**Diff range**: 976a7fb..ba2385e (HEAD)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

Step 1 (check the checks against binding sources) runs under `ui` only and this feature is `standard`, so it did not run. The plan marks no binding external source beyond ROADMAP.md Phase 3 item 3 and PRODUCT.md, and neither decides a screen, label or status that a check contradicts. Nothing was compared against a design.

## Checks

All proofs ran at HEAD in one verbose vitest invocation (12 files, 373 tests, exit 0), then `npm test` (59 files, 1338 passed). Named tests were listed individually by their `C###:` prefix in the verbose output. Proof selectors of the form `app/\(app\)/...` do not match under vitest; the working filter is `pdf/route`, and the real-adapter route tests sit in `composition/pdf-route.test.ts`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C851 | 200, application/pdf, `%PDF-` ... `%%EOF`, real adapter | `vitest run pdf/route composition/pdf-route` exit 0 | `composition/pdf-route.test.ts:58-62` - `expect(response.status).toBe(200)`; `expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-")`; `expect(body.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true)`. Mocked-renderer header: `route.test.ts:73` `expect(response.headers.get("Content-Type")).toBe("application/pdf")` | PASS |
| C852 | 7 `version` inputs -> `get(id, n \| undefined)` | same run, 7 `C852:` rows ran | `route.test.ts:88-89` - `expect(get).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledWith(AGR, expected)`, table at `:78-85` holds all 7 inputs, `0` -> `undefined`. Mutant F1 (`/^\d+$/`) killed by the `?version=0` row | PASS |
| C853 | filename uses version rendered | same run | `route.test.ts:93` `toBe('attachment; filename="AG-1052-v1.pdf"')`, `:96` `toBe('attachment; filename="AG-1052-v2.pdf"')` with `?version=9` and reader returning v2 | PASS |
| C854 | empty 404, renderer never called, 3 causes | same run, 3 rows | `route.test.ts:107-112` - `expect(response.status).toBe(404)`; `expect(body).toBe("")`; `expect(body).not.toContain("Fernwood")`; `expect(renderAgreement).not.toHaveBeenCalled()`. Route: `route.ts:19` `if (!isUuid(agreementId)) return empty(404)` | PASS |
| C855 | 200 for owner, admin, estimator, viewer | same run, 4 rows | `route.test.ts:116-118` - `test.each(["owner","admin","estimator","viewer"])` ... `expect((await call()).status).toBe(200)` | PASS |
| C856 | no session -> redirect to `/login`, no handler; matcher matches the path | `proxy.test.ts`, `session.test.ts`, route test ran | `proxy.test.ts:31-32` - `expect(matches(".../pdf")).toBe(true)` and with `?version=2`; `session.test.ts:107-108` - `expect(response.status).toBe(307); expect(locationPath(response)).toBe("/login")`; `route.test.ts:125-128` - 307 to `/login`, `expect(get).not.toHaveBeenCalled()`. Split across three files is acceptable (see Deviations). | PASS |
| C857 | "Download PDF" link `href` for the version shown, 4 cases + viewer | `vitest run components/agreements` | `components/agreements/agreements.test.ts:159` - `expect(pdfLink(html)).toBe(href)`, table `:148-154` includes `?version=1` past version and `not_recorded`, plus a `viewer` row | PASS |
| C858 | header: name, address, phone, accent; nulls; neutral accent; no literal name | model + rendered ran | Model `domain/agreement/document.test.ts:36,46` - `.tenant).toEqual({ name, address, phone, accent: "#1f6f8b" })`, `{... accent: NEUTRAL_ACCENT }`. Rendered `agreement-pdf.test.ts:46-47` - `inOrder(indexOfIn(first, name, address, phone))` and `first.startsWith("Kettle Ridge Mechanical Ltd.")`; `:52-53` `not.toMatch(/null\|undefined/)`. The accent is NOT asserted on the rendered bytes: mutant F4 survived | FAIL (see Faults) |
| C859 | page 1 has number, `Version 1`, customer, site | `infrastructure/documents` | `agreement-pdf.test.ts:58-59` - `expect(first).toContain(expected)` over `["AG-1052","Version 3","Fernwood Dental","Fernwood Dental, Main"]`; `inOrder(...)` | PASS |
| C860 | each line's figures, `Total per year`, `$3,870.00`, `before tax`; total from `annualCents` | same | `:64-67` - `toContain("$450.00" ... "$3,870.00", "Total per year", "before tax")`, `inOrder`; `:72-73` input 123456 -> `toContain("$1,234.56")`, `not.toContain("$3,870.00")`. Model `document.test.ts:93-94` kills the total-from-lines mutant (F3). Visits per year (4, 2) is in the claim but not asserted: mutant F5 survived | FAIL (see Faults) |
| C861 | 0 lines -> "No services priced yet", no total, no header | same | `:78-80` - `toContain("No services priced yet")`, `not.toContain("Total per year")`, `not.toContain("Visits per year")` (the header text is "Visits per year", `agreement-pdf.tsx:81`) | PASS |
| C862 | order, `<n> unit(s)`, checklist order, empty checklist | same | `:91-92` - `inOrder(indexOfIn(section, "AHU, 2 units", "- Replace filters", "- Check belts", "Boiler, 1 unit", "Unit heater, 1 unit", "- Inspect burner"))`, `not.toContain("Boiler, 1 unit\n-")` | PASS |
| C863 | one row per asset, grouped by type, null -> empty cell | same | `:99-100` - `inOrder(indexOfIn(section, "AHU","A-1","Model 7","Roof","A-2","Boiler","Basement"))`, `not.toMatch(/null\|undefined/)`. The "exactly 3 rows" count in the claim is not asserted (order only); precision gap, not a surviving mutant I demonstrated | PASS (with precision gap) |
| C864 | 6 terms, 4 nullable each absent, all-4-null leaves 2 | model + rendered | Model `document.test.ts:52-59` full `toEqual` of 6; `:68-70` `not.toContain(label)`, `toHaveLength(5)` x4; `:75` `toEqual(["Repair discount","CPI cap"])`. Rendered `agreement-pdf.test.ts:105-110` - `toContain` of all terms; tax note null -> `not.toContain("Tax note")` | PASS |
| C865 | footer `Page x of N` + number on every page; row not split; heading not last | `infrastructure/documents` | `:120` - `expect(rows.slice(-2)).toEqual(["AG-1052", \`Page ${i + 1} of ${pages.length}\`])`; `:121` heading not third from last; `:117` `pages.length >= 3` | PASS |
| C866 | draft mark on every page; absent for sent and past version | same | `:136` `for (const page of draft) expect(page).toContain("DRAFT - not yet sent to the customer")` over >= 3 pages; `:137` `not.toContain("DRAFT")`. Mutant F2 (mark not `fixed`, page 1 only) killed. Past version of a draft is proven on the model only (`document.test.ts:99` `editable: false -> null`); the reader supplies `editable` | PASS |
| C867 | frozen: `Scope recorded <date>`, no mark | same | `:144` `toContain(\`Scope recorded ${date.format(recordedOn)}\`)`; `:146` `not.toContain("DRAFT")`; `:147` live render `not.toContain("Scope recorded")` | PASS |
| C868 | not_recorded: 200, sentence, no headings, lines+total kept | adapter + real-adapter route | `agreement-pdf.test.ts:152-156` - `toContain("The equipment covered ... not recorded")`, `not.toContain("Service included")`, `not.toContain("Equipment\n")`, `toContain("$3,870.00")`; `composition/pdf-route.test.ts:69-70` - `status 200` and sentence in the real route's bytes | PASS |
| C869 | empty 503, `console.error`, no bytes, 3 causes; reader reject not caught | `pdf/route` | `route.test.ts:155-158` - `toBe(503)`, `await response.text()).toBe("")`, `Content-Type).not.toBe("application/pdf")`, `expect(log).toHaveBeenCalledTimes(1)`; `:163` `rejects.toThrow("db down")` | PASS |
| C870 | 2,000 rows in 40 types, route 200, `maxDuration` >= 2x measured | adapter test + route test + grep | `agreement-pdf.test.ts:164-165` - `new Set(text(pages).match(/^T\d+-\d+$/gm))`, `expect(found.size).toBe(2000)`; `route.ts:7` `export const maxDuration = 60` and `route.test.ts:168` `toBeGreaterThanOrEqual(44)`. Measured here 12.7 s, 17.2 s (author recorded 21.5-21.8 s). The "route answers 200" for the 2,000-asset case is not exercised at the route (the route test uses a mocked renderer, the adapter test calls the adapter); the 200 path is proven separately by C851 | PASS (precision gap) |
| C871 | 200-char unspaced string in 3 places, every char present; page count unchanged except added lines; live: no overflow | adapter ran; live not run | `:176` `expect(unwrapped(await render(make(long)))).toContain(long)` x3; `:182-183` wraps over >3 lines, longest line < 60. The "page count unchanged" sub-claim has no assertion. Live half `NOT RUN (needs signed-in browser)` | NOT RUN (live half); text half PASS |
| C872 | `Café Rénée's` x3 and typographic `’` | adapter | `:190` `expect(all.split(winAnsi(name)).length - 1).toBe(3)` (customer, task, location); `:192` straight apostrophe `toContain("Rénée's Café")` | PASS |
| C873 | dependency pinned exact; only the adapter may import it | `boundaries.test.ts` | `boundaries.test.ts:68` `expect(pkg.dependencies["@react-pdf/renderer"]).toBe("4.9.0")`; `:56-60` 7 places each give 1 lint message naming `infrastructure/documents`; `:62-64` the adapter folder gets 0. Note: the route does not import the library at all (through the container only), stricter than the check | PASS |
| C874 | port signature, document type has no react, container exposes `documentRenderer` | `boundaries.test.ts`, `composition.test.ts` | `boundaries.test.ts:74` `toContain("renderAgreement(document: AgreementDocument): Promise<Uint8Array>;")`; `:77-78` no react import, no `ReactElement`; `composition.test.ts:228` `typeof container.documentRenderer.renderAgreement).toBe("function")` and `:229` source `toMatch(/documentRenderer: reactPdfDocumentRenderer,/)`; `composition/index.ts:114` | PASS |
| C875 | no `Kettle Ridge` literal in non-test source | `grep -rn "Kettle Ridge" app components domain application infrastructure composition lib --include=*.ts --include=*.tsx --exclude=*.test.ts --exclude=*.test.tsx` | no output, exit 1 | PASS |
| C876 | build, lint, tsc exit 0; route `ƒ` | `npm run build`, `npm run lint`, `npx tsc --noEmit` | build exit 0, `├ ƒ /agreements/[agreementId]/pdf`; lint exit 0; tsc exit 0 (no typegen needed) | PASS |
| C877 | live: download, draft mark only on draft, tenant name + accent, 375/768/1440, 44 px target | not runnable by this verifier | needs a signed-in browser (magic link by email) | NOT RUN (needs signed-in browser) |
| C878 | live: other org -> 404, signed out -> `/login` | not runnable by this verifier | signed-in half needs a second-org browser session. The author's signed-out curl (307 to `/login`) is recorded in checks.md Build record and was not repeated by me; route-level 404 is covered by C854 | NOT RUN (needs signed-in browser) |

### Deviations from the author's Build record

- C864 corrected from 6 nullable to 4 nullable terms before code: acceptable. `OrgSettingsValue` makes repair discount and CPI cap non-null and the model test now asserts both are always present (`document.test.ts:75`).
- Extra Landing row 4 (`.tsx` layout): acceptable, recorded in the plan before the code that needed it, and `eslint.config.mjs` scopes the documents folder deliberately.
- C856 across `proxy.test.ts`, `session.test.ts` and the route test: acceptable, because the claim is the proxy's redirect and that is asserted in `session.test.ts` (the redirect) plus `proxy.test.ts` (matcher); it does not weaken the check.
- C851/C868 in `composition/pdf-route.test.ts`: acceptable and better than the original, because it runs the real route with the real adapter; the `%PDF-`/`%%EOF` assertions are only at that level.
- Date style `medium`: consistent with the check's own note.
- C876 says the route imports `@react-pdf/renderer`; it does not (it goes through the container). Benign; the dependency is still loaded by the build through the adapter.

## Coverage

Recomputed from the plan's Surface, Landing and Criteria and from the code, not read back from the author's table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Route statuses (3: 200, 404, 503) | plan Surface; `route.ts:19,26,41` | 200 `route.test.ts:72` + `pdf-route.test.ts:58`; 404 `:107`; 503 `:155` | - |
| 404 causes (3) | AC 4; `route.ts:19,26` | malformed id, missing, other org: `route.test.ts:99-102` | - |
| 503 causes (3) | AC 19; `route.ts:30,31` | renderer rejects, settings rejects, settings null: `route.test.ts:146-149` | - |
| Redirect when signed out (1) | AC 6; `route.ts:23` | `route.test.ts:125`, `session.test.ts:108` | - |
| Roles (4) | AC 5 | `route.test.ts:116` | - |
| `?version` inputs (7) | `route.ts:12-14` | all 7: `route.test.ts:78-85` | - |
| Scope source (3) | `AgreementDetail.serviceScope` | live C866/C867, frozen C867, not_recorded C868 | - |
| Draft mark cases (3) | AC 16 | current draft `agreement-pdf.test.ts:136`, sent `:137`, past version of a draft: model only `document.test.ts:99` | past version of a draft is not proven on rendered bytes (low risk: the same `mark: null` path as sent) |
| Terms (6) | AC 14; `document.ts:46-56` | all 6 `document.test.ts:52`; rendered `agreement-pdf.test.ts:105` | - |
| View link cases (4 + viewer) | AC 7 | `agreements.test.ts:148-154` | - |
| One-way doors (4 incl. added row 4) | plan Landing | door 1 C873/C876; door 2 C874; door 3 C851/C853/C855; door 4 (`.tsx` layout) no check, covered by the lint run C876 | - |
| Header fields (4: name, address, phone, accent) | AC 8 | name/address/phone rendered `:46`; accent model only `document.test.ts:36,46` | accent on the rendered bytes (mutant F4 survived) |
| Content sections (6) | AC 10-14 | header C858, lines C860/C861, Service included C862, Equipment C863, terms C864 | line column "Visits per year" values (F5 survived) |
| Footer (2 fields x every page) | AC 15 | `agreement-pdf.test.ts:120` | - |
| Large/awkward (3: 2,000 rows, 200-char, accents) | AC 20-22 | C870 `:165`, C871 `:176`, C872 `:190` | AC 21 "page count unchanged"; overflow check is live-only (NOT RUN) |
| Startup config: `documentRenderer` in the container (1 assembly) | `composition/index.ts:114` read directly: `documentRenderer: reactPdfDocumentRenderer,` | `composition.test.ts:228-229` builds `getContainer()` and also matches the source line | - |

Level check: C851-C856 and C869 each have a proof at the route boundary or proxy. C858-C872 are proven on real renderer bytes (`pdfPages` inflates the content streams of the produced PDF), with the model-only exceptions listed above (accent colour, past-version draft).

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `pdf/route.ts`, `domain/agreement/document.ts`, `infrastructure/documents/agreement-pdf.tsx` | route: boundary (`route.test.ts`, `pdf-route.test.ts`) and own layer; builder: `document.test.ts` plus rendered bytes; adapter: layout on bytes C865-C872 | partly - one asserted case per decision row holds for the route (7/4/3/3) and the builder (6 terms, 3 scope sources, header nulls). It is not met for the adapter: the accent colour and the visits column are decisions the adapter makes and no assertion fails when they change |
| Decides, not reached across a boundary | builder null handling, ordering, wording | one at its own layer, one case per row | yes - `document.test.ts` |
| Instrumentation | `agreement-view.tsx` link, container wiring | none of its own; C857 and C874 pass-through | yes - `agreements.test.ts:159`, `composition.test.ts:228` |

## Faults injected

Isolated in a git worktree (`git worktree add --detach`, node_modules junctioned), discarded and pruned afterward; no `git stash`. Real-tree `git status --porcelain` before: empty (clean). After all runs: empty. They match.

| Mutation | Location | Killed |
| --- | --- | --- |
| `?version` regex accepts `0` (`/^[1-9]\d*$/` -> `/^\d+$/`) | `web/app/(app)/agreements/[agreementId]/pdf/route.ts:13` | yes - `C852: ?version=0` fails |
| draft mark drawn on page 1 only (`<Text fixed ...>` -> `<Text ...>`) | `web/infrastructure/documents/agreement-pdf.tsx:50` | yes - `C866` fails |
| total computed from the sum of lines instead of `annualCents` | `web/domain/agreement/document.ts:73` | yes - `C860` (model) fails |
| tenant accent ignored (heading and rule colour hard-coded `#000000`) | `web/infrastructure/documents/agreement-pdf.tsx:42-43` | **no** - all 149 tests in `infrastructure/documents` and `domain/agreement` pass |
| visits per year printed wrong (`{line.visitsPerYear + 1}`) | `web/infrastructure/documents/agreement-pdf.tsx:88` | **no** - all 19 tests in `infrastructure/documents` pass |

Faults not injected beyond five: the wrong version in the filename (C853 asserts both v1 and v2, so a route using the requested version would fail `:96`), and a null printed as text (C858 `:52` and C863 `:100` assert the `/null|undefined/` regex), were judged by assertion reading only, not by mutation.

## Gate

`npm test` (from `web/`) - 59 test files, 1338 passed, 0 failed. Targeted batch: 12 files, 373 passed, 0 failed. `npm run lint` exit 0, `npx tsc --noEmit` exit 0, `npm run build` exit 0 with `ƒ /agreements/[agreementId]/pdf`.

## Ranked gaps

1. Accent colour on the rendered PDF is unproven; mutant F4 survived. AC 8 says the accent is on the title rule and table headings, and a tenant's brand colour is the feature's whole point (PRODUCT.md Brand Commitments). The test needs to read the fill colour in the content stream (an `rg` operator with `0.121 0.435 0.545` for `#1f6f8b`) and the neutral fallback. - C858 - `agreement-pdf.test.ts` (no assertion) / `agreement-pdf.tsx:42-43`
2. Visits per year values are unproven on the bytes; mutant F5 survived. C860 names "visits per year" and the fixture's 4 and 2 are never asserted. - C860 - `agreement-pdf.test.ts:64`
3. Live checks not run: C877 and C878 signed-in half (needs a signed-in browser), and the overflow half of C871 (the only proof of "inside its column"). The signed-out `/login` redirect is covered by tests (C856), not by me live. - C877, C878, C871
4. C871 "page count unchanged except added lines" has no assertion. - C871 - `agreement-pdf.test.ts:176-183`
5. C863 "exactly 3 asset rows" is asserted as order only, and C870 "route answers 200" for 2,000 assets is not exercised at the route. - C863, C870 - `agreement-pdf.test.ts:99`, `route.test.ts:166-169`
6. Past version of a draft has the draft mark absent proven on the model only, not on the bytes. - C866 - `document.test.ts:99`
