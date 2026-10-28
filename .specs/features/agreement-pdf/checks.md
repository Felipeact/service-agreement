# Agreement PDF: download a tenant-branded PDF of any agreement version - checks

Profile: standard
Plan: `.specs/features/agreement-pdf/plan.md`

24 checks in 4 slices plus doors and delivery · 3 one-way doors · 1 open (does not block)

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C851:`). This feature numbers from C851, because service-included owns up to `C832:`. Proofs name the folder their test file sits in; the file inside it is the builder's call.
  - The route is tested like `app/auth/confirm/route.test.ts`: `vi.mock("@/composition")` supplies a container with `currentMember`, `agreementReader.get`, `orgSettingsStore.get` and `documentRenderer`, and the test calls `GET` with a `NextRequest`.
  - The document builder is pure domain code and is tested with literal `AgreementDetail` and settings values.
  - **Rendered** checks (marked "rendered") call the real adapter and read the produced bytes back. The builder picks how text is read from a PDF. If that needs a new dev dependency, it gets a `Landing` row in the plan before the code, as plan rule 4 says. A check about text may never be proven by asserting the document model alone.
  - The view link is asserted with `renderToStaticMarkup`, as `components/agreements` does.
- **shell** - a command run from `web/` that passes when it exits 0 or prints the stated output.
- **live** - a real browser on `npm run dev` through the Playwright MCP, in one signed-in context as the demo owner. Not committed (AGENTS..md).

Terms:

- "the route" is `GET /agreements/[agreementId]/pdf`.
- "the builder" is `buildAgreementDocument`; "the document" is its `AgreementDocument` output.
- "the renderer" is the `@react-pdf/renderer` adapter behind `DocumentRenderer`.
- "the view" is the agreement view component the page renders.
- **Fixture agreement** is AG-1052 (`Fernwood Dental`, version 1, 2 service lines, total $3,870.00), built as literal values in tests. **Fixture settings** are legal name `Kettle Ridge Mechanical Ltd.`, address `100 Sample Street, Burnaby, BC`, phone `604-555-0100`, accent `#1f6f8b`, repair discount 10, CPI cap 5, notice 30 days, payment 30 days, province `BC` and a tax note.
- **The date format** is the `Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" })` the agreement view already uses for dates. Expected text is computed with that formatter in the test, never typed out. (The plan's "Month D, YYYY" is the `long` style; this check set uses the existing medium style, an assumption the builder records, not a change to a criterion. If the user wants `long`, one constant changes.)

## Checks

### S1 - A member downloads the PDF of an agreement version · ~7 files · ~25k

**C851** - For a member of the agreement's org, the route answers `200` with header `Content-Type: application/pdf`, and the body's first 5 bytes are `%PDF-` and it ends with `%%EOF` after trimming whitespace. The renderer is the real adapter (AC 1, door 3)
Proof: `npm test -- app/\(app\)/agreements/\[agreementId\]/pdf -t "C851:"`

**C852** - The route asks the reader for the version in `?version`, table-driven over 7 inputs: `?version=2` -> `get(id, 2)`; no query -> `get(id, undefined)`; `abc`, `1.5`, `0`, `-1` and `2abc` -> `get(id, undefined)`. The reader, not the route, decides that an unknown number shows the current version (AC 2)
Proof: `npm test -- app/\(app\)/agreements/\[agreementId\]/pdf -t "C852:"`

**C853** - The `Content-Disposition` is `attachment; filename="AG-1052-v1.pdf"` for the fixture agreement version 1, and `AG-1052-v2.pdf` when the reader returns `shown.versionNo` 2 for `?version=9`. The name uses the version rendered, not the version asked for (AC 3, door 3)
Proof: `npm test -- app/\(app\)/agreements/\[agreementId\]/pdf -t "C853:"`

**C854** - The route answers `404` with an empty body, and the renderer is never called, in each of 3 cases: the id is `not-a-uuid` (reader returns `null`), the reader returns `null` for a missing agreement, and the reader returns `null` for another org's agreement. The body does not contain the agreement number or the string `Fernwood` (AC 4)
Proof: `npm test -- app/\(app\)/agreements/\[agreementId\]/pdf -t "C854:"`

**C855** - The route answers `200` for each of the 4 roles `owner`, `admin`, `estimator` and `viewer` (AC 5)
Proof: `npm test -- app/\(app\)/agreements/\[agreementId\]/pdf -t "C855:"`

**C856** - A request for `/agreements/<uuid>/pdf` with no session is answered by `proxy` with a redirect to `/login` and reaches no route handler, the same as for `/agreements/<uuid>`. The proxy's matcher does match this path (AC 6)
Proof: `npm test -- proxy.test.ts -t "C856:"`

**C857** - The view renders a link whose text is "Download PDF" and whose `href` is `/agreements/<id>/pdf?version=<n>` for the version shown, in 4 cases: a `draft` current version, a `sent` current version, a past version (`?version=1` of a 2-version agreement, href ends `?version=1`), and a `not_recorded` scope. It is present for both a writer and a viewer (AC 7)
Proof: `npm test -- components/agreements -t "C857:"`

### S2 - The PDF reads as the tenant's proposal · ~6 files · ~30k

**C858** - The document's header carries the legal name, the address and the phone from the fixture settings, and the accent `#1f6f8b`. With address and phone `null` the header has the legal name only and no `null` or `undefined` text. With accent `null` the accent is the product's neutral accent, a `#rrggbb` constant, not the tenant's. The legal name is never a literal in the PDF source (AC 8)
Proof: `npm test -- domain/agreement -t "C858:"`
Proof: `npm test -- infrastructure/documents -t "C858:"` (rendered: the first page's text starts with `Kettle Ridge Mechanical Ltd.`, then `100 Sample Street, Burnaby, BC`, then `604-555-0100`)

**C859** - The rendered text of page 1 contains `AG-1052`, `Version 1`, `Fernwood Dental` and the site name from the fixture (AC 9)
Proof: `npm test -- infrastructure/documents -t "C859:"`

**C860** - The rendered text contains, for the fixture's 2 lines, each description, visits per year, cost per visit and annual amount formatted by `formatCadExact` (for example `$3,870.00`), then `Total per year` followed by the version's `annualCents` formatted the same way, and the words `before tax`. The amount shown is the one computed from `annualCents`; changing a line's cost in the input changes the total printed (AC 10)
Proof: `npm test -- infrastructure/documents -t "C860:"`

**C861** - With 0 lines the rendered text contains `No services priced yet` and contains neither `Total per year` nor a column header `Visits` (AC 11)
Proof: `npm test -- infrastructure/documents -t "C861:"`

**C862** - The rendered "Service included" lists the types in the order the scope provides (given `AHU`, `boiler`, `Unit heater (gas)`, the text positions are in that order), each with `<name>, <n> unit(s)` (singular for 1, plural otherwise) and every task of its checklist in order. A type with no tasks prints its heading and count and no task (AC 12)
Proof: `npm test -- infrastructure/documents -t "C862:"`

**C863** - The rendered "Equipment" has one row per asset, grouped under its type heading, with unit #, type/model and location. A null unit, model or location prints as an empty cell, never as `null`. With 3 assets in 2 types the text holds exactly 3 asset rows (AC 13)
Proof: `npm test -- infrastructure/documents -t "C863:"`

**C864** - The terms section prints each set term with its value, table-driven over the 6 terms: repair discount `10%`, CPI cap `5%`, cancellation notice `30 days`, payment `30 days`, governing province `BC` (the full name if the settings module has one), and the tax note. Repair discount and CPI cap are never null in `OrgSettingsValue`, so they always print. For each of the 4 nullable terms (notice days, payment days, province, tax note) set to `null` in turn, that term's label is absent and the other 5 are present. With all 4 null the section still prints the 2 numeric terms (AC 14)
Proof: `npm test -- domain/agreement -t "C864:"`
Proof: `npm test -- infrastructure/documents -t "C864:"` (rendered: the fixture settings, and the fixture with the tax note `null`)

**C865** - A document with enough rows for 3 pages has, on every page, the footer `Page <x> of 3` with that page's number, and `AG-1052`. The last service-line row is not split across a page boundary, and the "Service included" heading is never the last line of a page (AC 15)
Proof: `npm test -- infrastructure/documents -t "C865:"`

### S3 - The PDF is honest about its state · ~4 files · ~15k

**C866** - For a `draft` agreement whose shown version is the current one (`editable: true`, `serviceScope.source: "live"`), every page of the rendered text contains `DRAFT - not yet sent to the customer`, over 3 pages. For a `sent` agreement and for a past version of a `draft` it is absent from every page (AC 16)
Proof: `npm test -- infrastructure/documents -t "C866:"`

**C867** - For `serviceScope.source: "frozen"` with `takenAt` 2026-10-20T15:00:00Z, the rendered text contains `Scope recorded ` followed by that instant in the date format, and does not contain the live-draft mark. The types printed are the frozen ones, not those of any other input (AC 17)
Proof: `npm test -- infrastructure/documents -t "C867:"`

**C868** - For `serviceScope.source: "not_recorded"`, the route answers `200`, the text contains `The equipment covered by this version was not recorded`, and contains neither the headings `Service included` nor `Equipment`. The lines and total are still printed (AC 18)
Proof: `npm test -- infrastructure/documents -t "C868:"`
Proof: `npm test -- app/\(app\)/agreements/\[agreementId\]/pdf -t "C868:"`

**C869** - The route answers `503` with an empty body, logs the cause with `console.error`, and returns no PDF bytes, in each of 3 cases: the renderer rejects, `orgSettingsStore.get` rejects, and `orgSettingsStore.get` resolves `null` (no settings row; the plan names the read failing, and a document with no tenant identity must not go out). A rejected `agreementReader.get` is not caught by the route (it reaches Next's error handling, as the page does) (AC 19)
Proof: `npm test -- app/\(app\)/agreements/\[agreementId\]/pdf -t "C869:"`

### S4 - Large and awkward content still renders · ~3 files · ~10k

**C870** - A rendered document for a scope with 2,000 assets in 40 types contains all 2,000 rows (the count of distinct unit numbers read back is 2,000) and the route answers `200`. The measured duration is recorded in the Handoff, and the route's `maxDuration` is at least 2 times that duration (AC 20)
Proof: `npm test -- infrastructure/documents -t "C870:"`
Proof: `grep -n "maxDuration" "app/(app)/agreements/[agreementId]/pdf/route.ts"` (the line exists, the value is recorded)

**C871** - A 200-character string with no space, used as a service-line description, as a location and as the legal name, in turn, renders with every one of its 200 characters present in the extracted text (none clipped), and the document's page count is unchanged by it except for added lines (AC 21)
Proof: `npm test -- infrastructure/documents -t "C871:"`
Proof: live: the downloaded PDF of a temporary agreement with the long description is opened in the browser and no text runs past the table's right edge or the page's margin. This is the only proof of "inside its column"; text extraction cannot see overflow.

**C872** - The rendered text contains `Café Rénée's` intact when used as the customer name, as a task and as a location, and `’` (a typographic apostrophe) is also kept (AC 22)
Proof: `npm test -- infrastructure/documents -t "C872:"`

### Doors and delivery

**C873** - `web/package.json` dependencies hold `"@react-pdf/renderer": "4.9.0"` exactly (no `^` or `~`), and no file under `web/domain`, `web/application`, `web/components` or `web/app` outside the route imports `@react-pdf/renderer` (door 1)
Proof: `npm test -- boundaries.test.ts -t "C873:"`

**C874** - `DocumentRenderer.renderAgreement` is declared in `application/ports` with the parameter type `AgreementDocument` and the return type `Promise<Uint8Array>`, the document type has no `ReactElement` or `react` import, and the container exposes `documentRenderer`. The composition test builds the container and finds the adapter (door 2)
Proof: `npm test -- boundaries.test.ts -t "C874:"`
Proof: `npm test -- composition -t "C874:"`

**C875** - No source file under `web/` (excluding tests, `node_modules` and `.next`) contains the string `Kettle Ridge`. The PDF source holds no company name, address or phone number as a literal (AC 8)
Proof: `grep -rn "Kettle Ridge" app components domain application infrastructure composition lib --include=*.ts --include=*.tsx --exclude=*.test.ts --exclude=*.test.tsx` (no output, exit 1)

**C876** - `npm run build` in `web/` exits 0 with `@react-pdf/renderer` imported by the route, `/agreements/[agreementId]/pdf` appears in the route list as dynamic (`ƒ`), and `npm run lint` and `npx tsc --noEmit` exit 0. This proves the dependency loads under Next 16 (Impact: dependency)
Proof: `npm run build`
Proof: `npm run lint`
Proof: `npx tsc --noEmit`

**C877** - Live as the demo owner: the "Download PDF" link on a `draft` demo agreement and on a `sent` one each downloads a file named `<number>-v<n>.pdf` that opens in the browser, shows the draft mark only for the draft, and shows the tenant name and the `#1f6f8b` accent. At 375, 768 and 1440 px the link is visible without horizontal scroll, and at 375 px its touch target is at least 44 px tall (AC 7, AC 8, AC 16, AGENTS..md)
Proof: live (Playwright MCP), result recorded in the Handoff

**C878** - Live as a user from a second org (or with the signed-out context): `GET /agreements/<org A id>/pdf` answers `404` for the other org's member and a redirect to `/login` when signed out (AC 4, AC 6)
Proof: live (Playwright MCP), result recorded in the Handoff

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /agreements/[agreementId]/pdf` statuses (3) | `200` C851 · `404` C854 · `503` C869 | - |
| roles allowed (4) | owner C855 · admin C855 · estimator C855 · viewer C855 | - |
| `?version` inputs (7) | `2` C852 · absent C852 · `abc` C852 · `1.5` C852 · `0` C852 · `-1` C852 · `2abc` C852 | - |
| 404 causes (3) | malformed id C854 · missing C854 · other org C854 | - |
| 503 causes (3) | renderer rejects C869 · settings rejects C869 · settings `null` C869 | - |
| terms (6) | repair discount C864 · CPI cap C864 · notice days C864 · payment days C864 · province C864 · tax note C864 | - |
| scope source (3) | `live` C866 · `frozen` C867 · `not_recorded` C868 | - |
| agreement status x draft mark (3) | `draft` current C866 · `sent` C866 · past version of a draft C866 | - |
| view link cases (4) | draft C857 · sent C857 · past version C857 · `not_recorded` C857 | - |
| one-way doors (3) | door 1 dependency C873, C876 · door 2 port C874 · door 3 route C851, C853, C855 | - |
| header fields (4) | legal name C858 · address C858 · phone C858 · accent C858 | - |
| content sections (6) | header C858 · lines C860, C861 · total C860 · Service included C862 · Equipment C863 · terms C864 | - |
| startup config: `documentRenderer` in the container (1 assembly) | composition root C874 | - |

- Claims naming a status code, route or response shape: C851, C852, C853, C854, C855, C856, C868, C869, C878 - each has a proof that crosses the route (or the proxy for C856)
- Claims about what a reader sees in the PDF (C858 to C868, C870 to C872) are proven on the bytes the real renderer produced, not on the document model alone; C858 and C864 add a model-level proof because they also decide
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (the route, the builder, the adapter's layout) | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary (the builder's null handling, ordering and wording) | one at its own layer | one asserted case per row of the decision table |
| Instrumentation (the view link, the container wiring) | none of its own | covered by its consumer's proof, with C857 and C874 as the pass-through checks |

Evidence:

- the route: 3 statuses, 7 `version` inputs, 4 roles, 3 failure causes -> decides
- the builder: 6 optional terms, 3 scope sources, 3 header fields that may be null, line count 0 or more, plural/singular unit count -> decides
- the adapter: pagination, footer, draft mark on every page, wrapping -> decides (layout is proven on bytes, C865 to C872)
- the view link: forwards the version into a URL, no conditional beyond the version value -> instrumentation
- closest analogue in the repo: `app/auth/confirm/route.test.ts` proves a route at its boundary with a mocked container, and `components/agreements/agreements.test.ts` proves a view with `renderToStaticMarkup`

Cost: about 20 proofs across 5 test files. Without these rows, the builder's decision tables would be proven only by the one rendered fixture that happens to traverse them.

## Swept

- validation: C852 (`version` inputs), C854 (malformed id), C871 (long strings), C872 (accents)
- failure modes: C869 (renderer fails, settings fail or are missing, no partial PDF)
- idempotency: n/a - the route is a read with no side effect, and two requests for one version give the same document (C860 changes the total only when the input changes)
- authorization: C855 (all 4 roles may read), C856 (no session), C854 (another org's agreement is a `404`, RLS decides what the reader returns), C878 (live)
- concurrency: n/a - nothing is written, and a send committing during a render is either the draft or the frozen scope according to commit order, each of which C866 and C867 prove is rendered consistently
- data lifecycle: C867 (a frozen version's PDF follows the frozen scope, not the site). The terms are live by the plan's assumption and open question 1; no check pins them to send time, deliberately
- dependency failure: C869 (renderer and settings read). n/a for external services, because none is called
- state transitions: C866 (draft mark by status and currency), C867, C868. n/a otherwise, because the route triggers no transition
- observability: C869 (`console.error` on a 503). There is no metric or tracing requirement

## Handoff

- Read set measured with `wc -c` before building: the ports, the agreement reader and its test, `domain/agreement`, `components/agreements/*`, the agreement page and its test, `composition/index.ts` and its test, `app/auth/confirm/route.*`, `proxy.test.ts`, `boundaries.test.ts`, `lib/money.ts` and `domain/org-settings`. Estimated from file sizes at about 55k tokens; the builder confirms with `wc -c` before the first edit.
- Writing: the builder and its test about 8k, the adapter with its layout and test about 14k, the route and its tests about 8k, the view link about 2k, docs about 4k.
- Live validation (C877, C878): about 25k tokens of snapshots.
- Total: S1-S2 with the read set come to about 100k. S3 and S4 enter at about 115k, and the live run brings it to about 140k, under the 150k budget. One builder.
- Mechanism: one builder (fits the budget, no ask).
