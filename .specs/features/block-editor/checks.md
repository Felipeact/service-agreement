# Block editor and document layout checks

Profile: ui
Plan: `.specs/features/block-editor/plan.md`

53 checks in 5 slices (S6 is delivery, run live by the orchestrator) · 4 one-way doors (approved: "see attch ... create template, change the system what needs to be changed and implement", 2026-11-13) · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`, from PowerShell on this machine (`powershell -NoProfile -Command "cd 'c:/Users/dispa/Music/repos/ServiceAgreement/web'; npx vitest run <files> -t '<pattern>'"`); every new test name starts with its check id and a colon (`C5500:`). This feature numbers from C5500 (C5439 is the highest id in use).
- **SQL** recipe `block_editor` runs with `npm run test:db block_editor` from `web/` (new `supabase/tests/block_editor.sql`, registered in `RECIPES` with the migration between `fixture.sql` and the test, as `agreement_templates` first did, so the hosted project needs no change until the owner applies it). Every run is rolled back; each assertion label starts with its check id. The existing recipes `agreement_templates`, `contract_templates` and `plan_limits` must stay green against the hosted project.
- Supabase, DocuSeal and the PDF renderer are never real in a vitest proof: use cases take fakes, adapters take a client double, routes take a container double, components render with `renderToStaticMarkup`, PDF text is read with `pdfPages` as the existing PDF tests do.
- Existing approved checks stay true and unedited. Mechanical updates that keep every assertion (fixtures carrying the new optional fields, container doubles, registry counts) are allowed and recorded in `## Handoff`.
- S6 (the two Enviroware templates) is data in the hosted project: the orchestrator creates and checks it live against the attached PDFs and records the result in CONTEXT.md; it is not a numbered check.

## Binding sources

The binding sources are the owner's two PDFs of 2026-11-13: PROPOSAL.pdf (11 pages) and contract.pdf (9 pages). They decide **order, wording, structure and arrangement** of the two documents; DESIGN.md decides the editor's colours, type and components, and the PDF fonts stay the product's own (Helvetica), so a font or an exact spacing that differs from the PDFs is not a finding.

What the checks hold the code to, per document (enumerated, not summarised):

- **Proposal:** letterhead (logo, name, address, "(Address) Maintenance" line, office phone) on every page (C5507); title "MAINTENANCE SCHEDULE" and a "Site:" line (C5505, C5506); a numbered list with lettered and roman sub-levels (C5519); "Service included:" with a heading per equipment type carrying its frequency in capitals, e.g. "AHU (QUARTERLY)" (C5515, C5516); a service charge table titled "PREVENTIVE MAINTENANCE SERVICE CHARGE" with the columns PREVENTATIVE MAINTENANCE, NUMBER OF TIMES PER YEAR, COST PER VISIT, TOTAL COST PER YEAR and rows reading "4 times per year" (C5517, C5518); an "EQUIPMENT LIST" with a "Site:" line after the price (C5503, C5517); no terms block and no visit schedule (C5503).
- **Contract:** a title without the meta block and Client, Site and Effective date lines (C5505, C5527); numbered headings and wording paragraphs (C5519); the price table inside the section "Price & payment" (C5522); an acceptance paragraph; signature blocks headed "Client" and "For and on behalf of <company>", with "Signed electronically" under each heading, "Signature (electronic)", "Name & title (print)" and "Date" (C5523, C5524); two italic closing lines; page header with a small logo and an address footer on every page (C5507, C5508); "SCHEDULE A - List of Equipment" and "SCHEDULE B - Maintenance Task List" each on a new page after the signatures (C5502, C5522).

Deliberate differences, not findings: PDF fonts and exact spacing; the contract's small logo header is the letterhead drawn on every page; "Signature (electronic)" and the Date line keep the product's existing DocuSeal-tagged lines; the Major and Minor boiler task groups and the word "SUBCONTRACTOR" in a heading come from task data, not from the layout (plan Out of scope).

## Checks

### S1 - The layout and options of an agreement are the tenant's · ~14 files · ~160 KB · ~40k

**C5500** - `layoutOf` of a schema 1 agreement body returns, in order, the intro blocks, `price`, then `schedule` only when the body shows the schedule, `included` and `equipment` only when it shows the scope, then `terms`, then the closing blocks, for each of the four combinations of schedule and scope, with `doc` `{ title: "Preventive maintenance service agreement", showMeta: true, pageHeader: "first", pageFooter: "number" }` (AC 1)
Proof: `npx vitest run domain/agreement/layout.test.ts -t "C5500:"`

**C5501** - `layoutOf` of a schema 2 body returns its `layout` and `doc` exactly as stored, and `layoutOf(SYSTEM_AGREEMENT_BODY)` equals the layout of an agreement with no template (AC 2)
Proof: `npx vitest run domain/agreement/layout.test.ts -t "C5501:"`

**C5502** - The agreement PDF draws, after the title block, the layout items in order: a heading with `level` 1 as a title and `level` 2 as a section heading, a paragraph and a clause as body text, a section as its own section, and a block with `pageBreakBefore` starts a new page (AC 3)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5502:"`

**C5503** - A layout without `schedule`, `included`, `equipment` or `terms` draws none of them, a layout of `price` alone draws the price table once, and the price table is drawn exactly once in every layout the validator accepts (AC 4)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5503:"`

**C5504** - With `included` before `price` in the layout the PDF text shows the service-included title before the price title, and the reverse with `price` first (AC 5)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5504:"`

**C5505** - With `doc.showMeta` false the PDF has no agreement number, customer, site, term or validity line and still has the title when it is not empty; with `showMeta` true it has them (AC 6)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5505:"`

**C5506** - `doc.title` "Maintenance schedule for {{site.name}}" is drawn as the document title with the site name filled in, and an empty title draws no title (AC 7)
Proof: `npx vitest run domain/agreement/document.test.ts -t "C5506:"`
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5506:"`

**C5507** - With `doc.pageHeader` `every` the company name appears at the top of each page of a three-page agreement (three times as a header), and with `first` once (AC 8)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5507:"`

**C5508** - With `doc.pageFooter` `letterhead` each page ends with the company name, address and phone; with `number` it ends with the agreement number and "Page n of m" as today (AC 9)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5508:"`

**C5509** - The review page draws the same layout items, section titles and order as the PDF for the same body, including a section moved before `price` and a section with a title option (AC 10)
Proof: `npx vitest run components/review/layout.test.ts -t "C5509:"`

**C5510** - An agreement pinned to a schema 1 version or to no template draws the same PDF text and the same review page as before this feature (the existing agreement PDF and review tests pass unedited, and a document built from `SYSTEM_AGREEMENT_BODY` equals one built with no body) (AC 11)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5510:"`

**C5511** - For a sent version the layout and options come only from its frozen pin: changing the settings or publishing a newer template version changes nothing in `buildAgreementDocument` (AC 12)
Proof: `npx vitest run domain/agreement/document.test.ts -t "C5511:"`

**C5512** - `validateAgreementTemplate` accepts a valid schema 2 body and refuses each of these with its own message: an unknown item kind, an unknown section key, an unknown `pageHeader`, an unknown `pageFooter`, a repeated section, a missing `price`, a repeated `price`, 61 items, 41 blocks, a text of 2,001 characters, a title of 121 characters, an unknown variable, an `indent` of 4, a heading `level` of 3 (AC 13)
Proof: `npx vitest run domain/agreement/layout.test.ts -t "C5512:"`

**C5513** - `save_agreement_template` accepts a schema 1 body and a valid schema 2 body, leaves every earlier version unchanged, and raises `22023` for a schema 2 body with a repeated section and for one with no `price` (AC 14)
Proof: `npm run test:db block_editor` (label C5513)

**C5514** - `save_agreement_template` raises `22023` for each of: an unknown item kind, an unknown section key, 61 items, 41 blocks, a text of 2,001 characters, a title of 121 characters, an `indent` of 4, an unknown `pageHeader`, and writes nothing (AC 14, SQL side of C5512)
Proof: `npm run test:db block_editor` (label C5514)

### S2 - Section options reproduce the proposal's presentation · ~8 files · ~70 KB · ~20k

**C5515** - With `included.showFrequency` the type heading reads `Boiler (BI-ANNUAL)` for a line with 2 visits, `AHU (QUARTERLY)` for 4, `Fire damper (ANNUAL)` for 1, `Chiller (MONTHLY)` for 12, `Pump (3 TIMES PER YEAR)` for 3, and `Wye strainer` with no frequency for a type no line covers (AC 15)
Proof: `npx vitest run domain/agreement/document.test.ts -t "C5515:"`
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5515:"`

**C5516** - With `included.uppercase` the type headings are drawn in capitals (`AHU (QUARTERLY)`, `BOILER (BI-ANNUAL)`) and without it as typed (AC 16)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5516:"`

**C5517** - A `title` option replaces the default title of each of `price` ("Service and price"), `schedule` ("Visit schedule"), `included` ("Service included") and `equipment` (the org's word) in the PDF and in the review page, and with no option the defaults are drawn (AC 17)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5517:"`
Proof: `npx vitest run components/review/layout.test.ts -t "C5517:"`

**C5518** - A `price` option with `columns` draws those five labels in the table header and total row, and `visitsFormat` `times_per_year` draws `4 times per year` for 4 and `1 time per year` for 1; the default draws the visits as a number as today (AC 18)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5518:"`

**C5519** - A block with `indent` 2 is drawn indented two levels further than `indent` 0 (the text starts further right), a heading with `level` 1 is drawn in the title style and `level` 2 in the section style, and a block with neither is drawn as before (AC 19)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5519:"`

**C5520** - With no section option, no `level`, no `indent` and no `doc` change, every section draws as it does today: the existing agreement PDF, scope and price tests pass unedited, and a layout carrying empty option objects draws the same text as one with none (AC 20)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5520:"`

### S3 - The contract is a layout too · ~12 files · ~140 KB · ~35k

**C5521** - `contractLayoutOf` of a schema 1 contract body returns, in order, `price`, `schedule`, `included`, `equipment`, the wording blocks, then `signatures`, with `doc` `{ title: "Service Contract", showMeta: true, pageHeader: "first", pageFooter: "number" }`; and the system contract wording gives the same layout as the contract PDF drew before this feature (AC 21)
Proof: `npx vitest run domain/contract/layout.test.ts -t "C5521:"`

**C5522** - The contract PDF draws the title, the meta lines when `showMeta`, then the layout items in order: with the layout title block, wording blocks, `price` inside the numbered wording, `signatures`, then `equipment` and `included` each after a block with `pageBreakBefore` ("Schedule A", "Schedule B"), the PDF text shows them in that order and each schedule starts a new page (AC 22)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C5522:"`

**C5523** - The `signatures` section prints the customer block headed by `customerLabel` (default `For the Customer: <signer name>`), the contractor block headed by `contractorLabel` (default `For <company>`), the `caption` under each heading when set, one Signature and one Date line each, and the four DocuSeal tags `{{Sig;role=Customer;type=signature}}`, `{{Date;role=Customer;type=date}}`, `{{Sig;role=Contractor;type=signature}}`, `{{Date;role=Contractor;type=date}}` exactly as before; with `nameField` false there is no Name line and no Name tag (AC 23)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C5523:"`

**C5524** - With `signatures.nameField` true the customer block gains a "Name & title (print)" line carrying the tag `{{Name;role=Customer;type=text}}` and the contractor block gains none (AC 23, door 4)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C5524:"`

**C5525** - `validateContractWording` accepts a valid schema 2 body and refuses, each with its own message: a layout with no `signatures`, a repeated `signatures`, a missing `price`, an unknown section key, a section `terms` (agreement only), 61 items, 41 blocks, a text of 2,001 characters, an unknown variable and an unknown document option; and `signatures` and `price` can sit at any position (AC 24)
Proof: `npx vitest run domain/contract/layout.test.ts -t "C5525:"`

**C5526** - A contract made before this feature (a schema 1 body, or the system wording) draws the same PDF text as before: the existing contract PDF, signing-documents and route tests pass unedited, and a document built from `contractLayoutOf(SYSTEM_CONTRACT_BODY)` equals one built before (AC 25)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C5526:"`

**C5527** - `term.start` reads `November 13, 2026` for a term starting 2026-11-13, `tenant.address` and `tenant.phone` the contractor's, `signer.name` the signer's name, `terms.taxNote` the frozen tax note; each is a missing value when the source has none; and the whitelist is exactly the sixteen names (the eleven of contract-templates and these five), for a contract and for an agreement (AC 26)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5527:"`

**C5528** - `save_contract_template` by an owner creates the org's contract template and its version 1 on the first call, adds version 2 on the second, leaves version 1 unchanged, a contract made after the second call carries version 2 and a contract made between them keeps version 1 (AC 27)
Proof: `npm run test:db block_editor` (label C5528)

**C5529** - `save_contract_template` raises `42501` for an estimator, a viewer and a non-member and writes nothing, and `22023` for a body with a missing `signatures`, an unknown block type, 61 items or a text of 2,001 characters (AC 28)
Proof: `npm run test:db block_editor` (label C5529)

**C5530** - The contract reader returns the body of a schema 1 version and of a schema 2 version and throws, never answering other wording, for an invalid one (AC 21, AC 22 reader)
Proof: `npx vitest run infrastructure/supabase/contracts.test.ts -t "C5530:"`

**C5531** - `buildContractPreviewDocument` builds a contract document from posted values and sample data: number "AG-0000", customer "Sample Customer Ltd.", site "Sample Site", a signer, one priced sample line, the org's letterhead and today's terms, and the layout and options posted (AC 44, domain side)
Proof: `npx vitest run domain/contract/layout.test.ts -t "C5531:"`

### S4 - The block editor · ~10 files · ~90 KB · ~30k

**C5540** - The editor draws, in this order, the document options panel (Title, Show the number, customer and site lines, Letterhead on every page, Footer) and then the layout rows; each block row shows its type, its text, its level or indent and its page-break control, and each section row shows its name and its options (AC 29)
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5540:"`

**C5541** - Add block offers exactly Heading, Paragraph and Clause and appends an empty row of the chosen type at the end (AC 30)
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5541:"`

**C5542** - Up and Down swap a row with its neighbour, the first row's Up and the last row's Down are disabled, and the saved layout has the order shown (AC 31)
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5542:"`

**C5543** - Remove deletes a block row; Hide removes a hideable section from the layout; the `price` row (and `signatures` in a contract) has no Remove and no Hide (AC 32)
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5543:"`

**C5544** - Showing a hidden section appends it at the end of the layout (AC 33)
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5544:"`

**C5545** - The Insert variable control lists exactly the sixteen whitelisted names and inserts `{{name}}` at the cursor of its row's text, leaving the rest of the text and the other rows unchanged (AC 34)
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5545:"`

**C5546** - Each section row opens its options: `price` (title, five column labels, visits format), `included` (title, show frequency, uppercase), `equipment` (title), `schedule` (title), `signatures` (customer label, contractor label, caption, name field); a change is in the posted values the preview sends (AC 35)
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5546:"`

**C5547** - A schema 1 template opens as its `layoutOf` rows and options, and saving it posts a schema 2 body whose layout equals the rows shown (AC 36)
Proof: `npx vitest run domain/agreement/template-form.test.ts -t "C5547:"`

**C5548** - When validation fails the editor stays open with each failing row's message beside it and keeps every typed value and row order (AC 37)
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5548:"`

**C5549** - A change to the layout or to an option makes the preview request exactly once, 700 ms after the last change, carrying the new layout and options (AC 38)
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "C5549:"`

**C5550** - The editor's container is a column below 1280 px and two tracks from `xl`, every row control has a height of at least 44 px below `lg` (class `min-h-11`), and no control is hover-only or a drag handle (AC 39)
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5550:"`

**C5551** - Duplicating a template saves a copy whose latest version has the same layout and document options, named as before (AC 40)
Proof: `npx vitest run application/use-cases/templates.test.ts -t "C5551:"`

### S5 - The contract wording editor · ~10 files · ~90 KB · ~25k

**C5552** - `/templates/contract` for an owner shows the layout and options of the org's own contract template, or of the system wording while the org has none, in the block editor with the contract preview frame beside it (AC 41)
Proof: `npx vitest run "app/(app)/templates/contract/page.test.ts" -t "C5552:"`

**C5553** - `saveContractWordingAction` for an owner calls `save_contract_template` once with the validated body and answers the saved state; for an estimator it answers `forbidden` and calls nothing (AC 42)
Proof: `npx vitest run "app/(app)/templates/contract/contract-actions.test.ts" -t "C5553:"`

**C5554** - Invalid values (an unknown variable, 61 items, a missing signatures section, an empty text) show each row's message in the contract editor and call nothing (AC 43)
Proof: `npx vitest run "app/(app)/templates/contract/contract-actions.test.ts" -t "C5554:"`
Proof: `npx vitest run components/templates/block-editor.test.tsx -t "C5554:"`

**C5555** - `POST /templates/contract/preview` with valid values from an owner calls the renderer once with a contract document built from sample data and the posted layout and options, answers 200 `application/pdf` with `Cache-Control: private, no-store`, and calls no store write (AC 44)
Proof: `npx vitest run "app/(app)/templates/contract/preview/route.test.ts" -t "C5555:"`

**C5556** - The contract preview route answers 401 signed out, 403 for an estimator and a viewer, 422 with `{ errors: [{ field, message }] }` for invalid values, 503 when the renderer throws, and writes nothing in each case (AC 45)
Proof: `npx vitest run "app/(app)/templates/contract/preview/route.test.ts" -t "C5556:"`

**C5557** - The Templates screen draws a Contract wording card below the agreement templates: "Standard contract wording" while the org has none and "Your contract wording" after, with an Edit link (Customize while none) to `/templates/contract` for an owner and an admin and no link for an estimator and a viewer (AC 46)
Proof: `npx vitest run components/templates/templates-view.test.tsx -t "C5557:"`

**C5558** - `/templates/contract` redirects an estimator and a viewer to `/templates` and a signed-out visitor to `/login`, and has a loading screen titled "Contract wording" (AC 47)
Proof: `npx vitest run "app/(app)/templates/contract/page.test.ts" -t "C5558:"`

**C5559** - The contract wording store reads the org's own latest contract template body, or the system body while it has none, and maps `42501` to forbidden, `22023` to invalid and anything else to unavailable with the code logged (AC 41, AC 42 adapter)
Proof: `npx vitest run infrastructure/supabase/contract-wording.test.ts -t "C5559:"`

**C5560** - The container exposes the contract wording read and save use cases built on the member's own client, and the preview route and the Templates page use them (wiring)
Proof: `npx vitest run composition/block-editor-wiring.test.ts -t "C5560:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| agreement sections (5) | `price` C5503 · `schedule` C5503 · `included` C5503 · `equipment` C5503 · `terms` C5503 | - |
| contract sections (5) | `price` C5522 · `schedule` C5522 · `included` C5522 · `equipment` C5522 · `signatures` C5523 | - |
| document options (4) | `title` C5506 · `showMeta` C5505 · `pageHeader` C5507 · `pageFooter` C5508 | - |
| section options (5 sections) | `price` C5518 · `included` C5516 · `equipment` C5517 · `schedule` C5517 · `signatures` C5523 | - |
| block fields (3) | `level` C5519 · `indent` C5519 · `pageBreakBefore` C5502 | - |
| frequency labels (6) | MONTHLY C5515 · QUARTERLY C5515 · BI-ANNUAL C5515 · ANNUAL C5515 · N TIMES PER YEAR C5515 · none C5515 | - |
| section titles (4) | price C5517 · schedule C5517 · included C5517 · equipment C5517 | - |
| invalid agreement body reasons (14) | unknown kind C5512 · unknown section C5512 · unknown pageHeader C5512 · unknown pageFooter C5512 · repeated section C5512 · missing price C5512 · repeated price C5512 · 61 items C5512 · 41 blocks C5512 · text over 2,000 C5512 · title over 120 C5512 · unknown variable C5512 · indent 4 C5512 · level 3 C5512 | - |
| invalid contract body reasons (10) | no signatures C5525 · repeated signatures C5525 · missing price C5525 · unknown section C5525 · terms section C5525 · 61 items C5525 · 41 blocks C5525 · text over 2,000 C5525 · unknown variable C5525 · unknown option C5525 | - |
| added merge variables (5) | `term.start` C5527 · `tenant.address` C5527 · `tenant.phone` C5527 · `signer.name` C5527 · `terms.taxNote` C5527 | - |
| `save_contract_template` statuses (3) | 200 C5528 · 403 `42501` C5529 · 422 `22023` C5529 | - |
| `save_agreement_template` statuses (4) | 200 C5513 · 403 `42501` C5513 · 404 `P0002` C5513 · 422 `22023` C5514 | - |
| roles on `save_contract_template` (4) | owner C5528 · admin C5528 · estimator C5529 · viewer C5529 | - |
| contract preview route statuses (5) | 200 C5555 · 401 C5556 · 403 C5556 · 422 C5556 · 503 C5556 | - |
| editor row controls (6) | Up C5542 · Down C5542 · Remove C5543 · Hide C5543 · Show C5544 · Insert variable C5545 | - |
| editor block types (3) | Heading C5541 · Paragraph C5541 · Clause C5541 | - |
| ways a body is read (3) | schema 1 agreement C5500 · schema 2 agreement C5501 · schema 1 and 2 contract C5530 | - |
| contract routes (3) | `/templates/contract` C5552, C5558 · `POST /templates/contract/preview` C5555, C5556 · Contract wording card C5557 | - |

- `POST /templates/preview` keeps its statuses (200, 401, 403, 422, 503), still proven by the existing template-flow checks C5435 and C5437, which must stay green; the new fields it carries (layout and options) are proven by C5549 and C5546
- Claims naming a status code, route or response shape: C5513, C5514, C5528, C5529, C5555, C5556, C5558 - each has a proof that crosses the boundary (SQL as the role; route tests call the handler with a container double; the page tests call the page function)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (`save_agreement_template`, `save_contract_template`, the preview routes, the actions) | one at the boundary (SQL as the role, handler or action with a double) | one asserted case per row of the status table, the role table and the invalid-body reasons |
| Decides, not reached across a boundary (`layoutOf`, `contractLayoutOf`, the two validators, the frequency derivation, `buildContractPreviewDocument`, the form conversion) | one at its own layer | one asserted case per branch and per member of each set above |
| Screens and documents (the block editor, the PDFs, the review page, the Templates card) | one render test per region and one PDF-text test per option, asserting the controls or text, their order and the classes that arrange them | each member of the binding-source enumeration above and of AC 29 to AC 39 |
| Instrumentation (composition wiring, schema 1 pass-through, loading screens) | one proof each | old documents print as before (C5510, C5520, C5526); the wiring exists (C5560); the loading screen exists (C5558) |

Evidence:

- `layoutOf`: 4 schedule and scope combinations, 2 schemas -> decides
- the validators: 14 and 10 reasons -> decide
- the PDF components: 4 document options, 5 section options, 3 block fields, 2 documents -> decide the drawing
- closest analogues in the repo: `agreement-templates` (C5300-C5354) and `template-flow` (C5400-C5439), proven at the same levels, and `contract-templates` for the SQL and the contract reader

Cost: about 55 proofs at their own layer across about 30 files. Without these rows the order of sections, the options and the old-document guarantee would be proven only by one page that happens to render.

## Swept

- validation: C5512, C5514, C5525, C5529 (the bodies), C5548 (the editor)
- failure modes: C5530 (an unreadable contract version never answers other wording), C5556 (503), C5548
- idempotency: n/a - the previews write nothing and a save always adds a version; two saves make two versions
- authorization: C5513, C5528, C5529, C5553, C5556, C5557, C5558
- concurrency: n/a - versions are immutable and numbered inside one definer call under the per-org advisory lock (the unique `(template_id, version_no)` decides a race), as in agreement-templates
- data lifecycle: C5510, C5520, C5526: old versions are never rewritten and keep printing as before; C5528 (a contract keeps its version)
- dependency failure: C5556 (renderer), C5530
- state transitions: C5511 (a sent version never changes layout), C5528
- observability: n/a - no logging requirement beyond the existing route and adapter logging

## Out of scope

Same as the plan's `Out of scope`: click-on-the-page editing and drag-and-drop, moving the title block and page footer as items, editing the task library, a DocuSeal sandbox run of the new Name field, starter wording per trade and province, upload of an existing contract, contract wording reset, rewriting schema 1 versions.

## Retired by instruction (batch 2)

The owner's instruction that the agreement editor becomes a block editor replaces the Intro and Closing text areas and the two switches. Each test below asserts that replaced structure (or opens the editor on the old form) and is replaced by the check named; nothing else is weakened or deleted. The old `bodyFromTemplateForm` / `templateFormFromBody` pair, the save action and the preview route keep reading the old form (plan Landing row 8), so C5351, C5422, C5435 and C5437 stay unedited.

- `web/components/templates/template-editor.test.tsx` "C5349: the fields come in order: Name, Description, Intro, Visit schedule, Scope, Closing text, Term length, Preset lines, then Save and Cancel" -> C5540
- `web/components/templates/template-editor.test.tsx` "C5349: the two sections are switches and say whether they are on" -> C5540, C5543
- `web/components/templates/template-editor.test.tsx` "C5349: the buttons are real buttons and the fields are labelled, so the controls can be reached by touch and by name" -> C5540, C5550
- `web/components/templates/template-editor.test.tsx` "C5350: the editor stays open and shows each message beside its field, announced with it" -> C5548
- `web/components/templates/template-editor.test.tsx` "C5350: every field keeps what was typed" -> C5548
- `web/components/templates/template-editor.test.tsx` "C5424: a save answering %s shows %s, keeps every typed value and re-enables Save" (three cases: forbidden, not_found, unavailable) -> C5548
- `web/components/templates/template-preview-frame.test.tsx` "C5431: typing in the editor's own Intro field is what the request carries" -> C5549
- `web/components/templates/template-preview-frame.test.tsx` "C5433: in the editor the fields the preview cannot draw show their messages as soon as they are typed, without the save banner" -> C5548
- `web/components/templates/template-preview-frame.test.tsx` "C5438: with the preview unavailable the form's fields stay editable" (opens the editor on the old form and reads its Intro and Closing text fields) -> C5549
- `web/components/templates/template-preview-frame.test.tsx` "C5434: an editor opened on a saved template requests a PDF once on mount, with no edit" -> C5549
- `web/components/templates/template-preview-frame.test.tsx` "C5434: an editor opened on a new template requests a PDF once on mount too, before a name is typed" -> C5549
- `web/app/(app)/templates/[templateId]/page.test.ts` "C5349: a %s gets the editor filled with the latest version and told which version saving writes" (owner, admin) -> C5547

## Handoff

- Batch 1 = S1 + S2 + S3 (C5500-C5531: the migration `save_contract_template` and the schema 2 checks, `layoutOf` and `contractLayoutOf`, the validators, the variables, both PDF renderers, the review page, the contract reader, `buildContractPreviewDocument`, the `block_editor` SQL recipe): about 95k to write plus about 45k of existing files to read (about 180 KB: `document.ts` both, `agreement-pdf.tsx`, `contract-pdf.tsx`, `pdf-sections.tsx`, `review-view.tsx`, `portal.ts`, `template.ts` both, `agreement-pdf.test.ts`, `contract-pdf.test.ts`). About 140k.
- Batch 2 = S4 + S5 (C5540-C5560: the block editor component and options panel, form conversion, the contract wording editor, store, actions, preview route, the Templates card, wiring): about 70k to write plus about 40k of existing files to read (`template-editor.tsx`, `template-form.ts`, the templates view and actions, the preview route and frame). About 110k.
- Total about 250k against the 150k budget: over. Mechanism: handoff, batch 1 then batch 2, each only on green (the same mechanism as agreement-templates, the owner's standing recommendation)
- Boundary (batch 1 done): C5500-C5531 closed and green (domain, PDFs, review page, contract reader, variables, `block_editor` SQL recipe); last commit dd7df0d (ee5fd76 migration and recipe, 7487dae domain, dd7df0d PDFs and review page). Batch 2 (C5540-C5560) starts from that diff. The migration `20261113100000_block_editor.sql` is replayed by the `block_editor` recipe only and is not applied to the hosted project. Mechanical updates to existing tests, all assertions kept: `web/scripts/test-db/runner.test.ts` counts (38 to 39 recipes, 40 to 41 SQL files, the `block_editor` name in the list); `web/domain/contract/template.test.ts` C5219: the whitelist test now lists the sixteen names (door 3 supersedes "eleven") and the full-context test passes the term start, the contractor's address and phone, the signer and a tax note (the five new variables have no value in the old context).
- Settled mid-build: nothing from the user. Builder choices recorded as plan `Landing` rows 5 and 6: signature labels and caption are 1..120 characters (column labels stay 1..40); with `showFrequency` a type heading reads `<name> (<FREQUENCY>)` with no units count, from the first line covering the type. A schema 1 body still goes through `renderAgreementTemplate` / `renderBlocks` (so old documents print byte for byte); `signatures` options carry an internal `heading` ("Signatures") only for a schema 1 contract, never stored; a schema 2 signatures section prints no title of its own. Batch 2 notes: `templateFormFromBody` reads a schema 2 body through `introAndFooter` / `sectionFlags` until the block editor replaces the form; `buildContractPreviewDocument(body, settings, logo, today, words)` takes today as `YYYY-MM-DD` (the domain reads no clock).
- Abandoned: nothing. Noted, not touched: the `customer_portal` SQL recipe fails against the hosted project with or without this migration (`view tenant` now carries `logoPath`), a stale test that predates this feature.
- Boundary (batch 2 done): C5540-C5560 closed. Commits c4c5758 (layout form conversion), c79968e (block editor, agreement editor, action and preview route) and the S5 commit after it (contract wording store, use cases, wiring, editor, action, preview route, page, Templates card). Mechanical updates keeping every assertion: `web/app/(app)/templates/page.test.ts` container double gains `getContractWording`; `web/app/(app)/templates/loading.test.ts` C5423 route list gains `contract`; `template-editor.test.tsx` fixtures moved to the layout form; `database.types.ts` gains `save_contract_template` by hand (regenerate after the migration is applied).
- Settled mid-build: nothing from the user. Builder choices: plan Landing rows 7 (flat form rows) and 8 (the action and `POST /templates/preview` keep reading the old text form). Section rows are always open (no collapse); "44 px" is `min-h-11` on row buttons and `h-11` on the shared Select and TextInput. A schema 1 contract opens with its "Signatures" title as a heading row.
- Abandoned: nothing. Noted: `npm run test:db block_editor` failed on the hosted project with `function "jsonb_keys_within" already exists` (the migration's function seems to exist there already; it passed in batch 1); the other three recipes pass.
