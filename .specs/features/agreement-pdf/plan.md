# Agreement PDF: download a tenant-branded PDF of any agreement version

## Problem

An estimator can price an agreement and see what it covers, but nothing the customer can read comes out of the app. `/agreements/<id>` shows service lines, "Service included" and "Equipment" on a screen only members can open. To put a proposal in front of a property manager, the estimator has to copy those sections into a Word file by hand, and that file carries none of the tenant's legal name, address, phone or terms from Company settings. It also drifts from what the app recorded as sent.

The source (ROADMAP.md Phase 3 item 3, M8, PRODUCT.md "Documents") gives no user evidence or date. The customer review portal (item 4) and the emailed link (item 5) both need a PDF to attach or offer for download, so they cannot start until it exists.

When this ships, a member opens any agreement, on any version, and downloads a PDF. The PDF carries the tenant's name, address, phone and accent colour, the service lines with the annual total, the service included, the equipment list and the tenant's default terms. A draft's PDF is marked as a draft. A sent version's PDF shows the scope as it was frozen when it was sent.

## Flow

This reuses `AgreementReader.get` (which already picks live or frozen scope), `OrgSettingsStore.get`, the money formatting in `web/lib`, and the composition root's per-request container. It adds no new read of the database.

1. Browser `GET /agreements/[agreementId]/pdf?version=<n>` -> route handler (door 3, new) - asks the container for the member's session and rejects non-members.
2. `AgreementReader` (exists) -> `AgreementDetail` for that version, or `null` (404).
3. `OrgSettingsStore` (exists) -> the tenant's name, address, phone, accent colour and terms.
4. `buildAgreementDocument` (new, pure, in `web/domain/agreement`; exact location settled while building) -> `AgreementDocument`: plain data with every string, amount and ordering already decided, no React.
5. `DocumentRenderer` (door 2, new port) -> `@react-pdf/renderer` adapter in `web/infrastructure` (door 1) -> bytes.
6. out: `200 application/pdf` with `Content-Disposition: attachment; filename="<number>-v<n>.pdf"`.
7. `AgreementView` (exists) gains a "Download PDF" link to the route for the version shown.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `AgreementDocument` - the plain-data content of one rendered agreement, lives next to `AgreementDetail` |
| domain | existing term: `Company settings` terms were only edited and displayed; they are now printed on customer-facing paper. Who reads them today: the settings form and `OrgSettingsStore` only, so nothing else branches on them |
| dependency | `@react-pdf/renderer` joins `web/package.json`; it must load in a Node route handler under Next 16 and must not enter any client bundle |
| stored data | nothing to migrate: no table, column or policy changes |
| screens | `/agreements/[agreementId]` gains one link, at every status and version |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /agreements/[agreementId]/pdf` | path `agreementId`, query `version` (optional) | the PDF bytes, `application/pdf`, filename `<number>-v<n>.pdf` | `200`, `404`, `503` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. New dependency | `"@react-pdf/renderer": "4.9.0"` in `web/package.json` dependencies, pinned exact like every other runtime dependency; built-in Helvetica only, no font files | Headless Chrome: ROADMAP says serverless-friendly with no browser, and it cannot run in a Vercel-style function. A custom font: adds a file every later PDF (contract, invoice) would copy |
| 2. `DocumentRenderer` port | `renderAgreement(document: AgreementDocument): Promise<Uint8Array>` in `web/application/ports/index.ts`, where `AgreementDocument` is plain data | A port that takes a React element: `web/application` may not import `react` (boundaries test), and the contract and portal would then depend on the renderer's tree |
| 3. Public route | `GET /agreements/[agreementId]/pdf`, flat by uuid with `?version=<n>`, file name `<number>-v<n>.pdf` | A token-based customer URL: the portal item owns customer access. A member-only route does not pre-empt it, because the portal can call the same `DocumentRenderer` |
| 4. Layout tree in `.tsx` (added while building) | `web/infrastructure/documents/*.tsx` builds the `@react-pdf/renderer` tree and imports `react`; the adapter lint rule (`infrastructure/**/*.ts`) does not cover `.tsx` and is not widened | Building the tree with `createElement` in `.ts`: it would import `react` from a `.ts` adapter, which the lint rule forbids, and no later document (contract, invoice) would want to write layout that way |

- Nothing else in this change is hard to reverse

## Criteria

### S1: A member downloads the PDF of an agreement version (P1)

The estimator clicks "Download PDF" on an agreement and gets the document the customer would read.

**Acceptance Criteria**

1. WHEN a member of the agreement's org requests `GET /agreements/<id>/pdf` THEN the system SHALL answer `200` with `Content-Type: application/pdf` and a body that begins with `%PDF-`
2. WHEN the request has `?version=<n>` and version `n` exists THEN the system SHALL render version `n`; WHEN `n` is absent, not a whole number or unknown THEN the system SHALL render the current version
3. The system SHALL name the download `<number>-v<n>.pdf` (for example `AG-1052-v1.pdf`) using the version rendered
4. IF the id is malformed, the agreement does not exist, or it belongs to another org THEN the system SHALL answer `404` with no body naming the agreement
5. WHEN a viewer, estimator, admin or owner of the org requests the PDF THEN the system SHALL answer `200` for each of them
6. IF the request carries no signed-in session THEN the system SHALL send it to sign-in as every other member route does, and SHALL NOT render
7. WHEN the agreement page is shown for any version at any status THEN the system SHALL show a "Download PDF" link to that version's route

### S2: The PDF reads as the tenant's proposal (P1)

**Acceptance Criteria**

8. The system SHALL print the tenant's legal name, and address and phone when set, at the top of the first page, and the accent colour on the title rule and table headings, falling back to the product's neutral accent when none is set
9. The system SHALL print the agreement number, the version number, the customer name and the site name
10. The system SHALL print every service line with description, visits per year, cost per visit and annual amount, then `Total per year` equal to the version's `annualCents`, each as CAD with two decimals, and the words "before tax"
11. WHERE the version has no service lines THEN the system SHALL print "No services priced yet" in place of the table and SHALL print no total
12. The system SHALL print "Service included" with each equipment type, its unit count and its checklist, in the order `AgreementDetail.serviceScope` provides
13. The system SHALL print "Equipment" grouped by type, one row per asset with unit #, type/model and location
14. The system SHALL print each of the tenant's default terms that is set (repair discount %, CPI cap %, cancellation notice days, payment days, governing province, tax note) and SHALL omit one that is null
15. WHEN content reaches the end of a page THEN the system SHALL continue on the next page and SHALL show `Page <x> of <y>` and the agreement number in the footer of every page

### S3: The PDF is honest about its state (P1)

**Acceptance Criteria**

16. WHILE the agreement is `draft` and the version rendered is the current one the system SHALL mark every page "DRAFT - not yet sent to the customer" and SHALL print the scope as the site holds it today
17. WHILE the version rendered is frozen the system SHALL print "Scope recorded <date>" from `takenAt` and the scope exactly as frozen
18. IF the version's scope is `not_recorded` THEN the system SHALL print "The equipment covered by this version was not recorded" in place of "Service included" and "Equipment", and SHALL still answer `200`
19. IF the renderer fails or the settings read fails THEN the system SHALL answer `503`, SHALL log the cause, and SHALL NOT return a partial PDF

### S4: Large and awkward content still renders (P2)

**Acceptance Criteria**

20. WHEN the version's site has 2,000 assets THEN the system SHALL render every row and answer `200` within the route's time limit
21. IF a description, location or tenant name has 200 characters with no space THEN the system SHALL wrap it inside its column rather than clipping or overflowing it
22. The system SHALL render text containing accents and apostrophes (for example "Café Rénée's") with every character intact

**Independent test:** open a demo agreement (a draft and a sent one), press "Download PDF", and read the file.

## Out of scope

| Excluded | Why |
| --- | --- |
| Tenant logo on the PDF | `org_settings.logo_path` exists but there is no bucket and no upload yet (CONTEXT.md Company profile); a header with the name and accent is complete. Logo upload is its own item |
| Signature blocks and the contract PDF | Phase 4 (M10) |
| Customer access by magic link | Item 4 (portal) |
| Storing the PDF or attaching it to an email | Item 5; this renders on demand |
| Custom fonts, a cover page, per-tenant layouts | one layout; reversible later because it is placement |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Terms on a sent version | The PDF prints the org's current terms, not terms frozen at send time | Terms are not versioned (`agreement_versions.snapshot` holds scope only). Freezing them is a migration and belongs with the portal, which makes the sent PDF a promise | n |
| Currency and locale | CAD, `en-CA`, dates as `Month D, YYYY` | Money is CAD (CONTEXT.md); the product is English-only (AGENTS..md) | n |
| Page size | Letter | Canadian business paper | n |
| Time limit for 2,000 assets | The route sets `maxDuration` high enough for the 2,000-asset demo case; the number is measured while building | Unknown until `@react-pdf/renderer` is timed here | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | open | Should a sent agreement's terms freeze with its scope, so an old PDF cannot change when Company settings do? | Written meanwhile: terms are live (see assumptions). Should be settled before item 4 lets customers rely on the PDF |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/agreements/[agreementId]` | empty, loading, error and unauthorised states of the page | existing - `loading.tsx`, `error.tsx`, `not-found.tsx` already cover the page; the only change is the link, AC 7 |
| screen `/agreements/[agreementId]` | destructive action confirms | n/a - the link changes no data |
| API `GET /agreements/[agreementId]/pdf` | error shape and codes | AC 4, AC 19: empty `404`, empty `503` |
| API `GET /agreements/[agreementId]/pdf` | who may call it | AC 5, AC 6 |
| API `GET /agreements/[agreementId]/pdf` | versioning, rate limits | n/a - an internal member route; the portal's rate limits belong to item 4 |
| document `the agreement PDF` | structure, tone, depth | AC 8 to 15 |
| document `the agreement PDF` | what the reader does next | n/a - this PDF has no call to action; Accept and Refuse live in the portal (item 4) |
| document `the agreement PDF` | draft versus final | AC 16, AC 17, AC 18 |

## Sources

- ROADMAP.md Phase 3 item 3 and M8 - an agreement PDF, tenant-branded, behind `DocumentRenderer` using `@react-pdf/renderer`
- PRODUCT.md "Agreement anatomy" and "Brand Commitments" - what the document holds, and that it wears the tenant's brand, never the product's
- STATE.md AD-058, AD-061 - the scope document and `AgreementDetail.serviceScope` this reads
