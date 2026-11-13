# Block editor and document layout

## Problem

Phase 5.5 item 3 asks for a block editor with a live PDF preview. The owner then attached the two real documents their company sends, a **proposal** (the Enviroware "Maintenance schedule" with per-equipment service included and a four-row service charge) and a **contract** (the Enviroware "Preventive maintenance service agreement" with eight numbered sections, a priced table in the middle, signature blocks and two schedules after them), and asked for both to be created as templates, changing the system wherever it cannot reproduce them. Comparing the two PDFs with what the product draws today finds what is missing:

1. **The order of an agreement is code, not the tenant's.** The proposal puts the maintenance schedule, then service included, then the price, then the equipment list; the product draws price first and has no way to move anything.
2. **The contract wording is only a "Terms" list at the end.** The real contract is a layout: a title and Client, Site, Effective date lines, numbered sections of wording, the price table inside section 2, signature blocks, then Schedule A (equipment) and Schedule B (task list) on new pages after the signatures. The contract PDF today draws its own title, meta block, price, schedule, scope, a Terms list and signatures at the end, always in that order, and no screen edits the wording at all.
3. **Both documents repeat their letterhead on every page** (the proposal a full header, the contract a small logo and an address footer). The product draws the letterhead once and a page number footer.
4. **Presentation the product cannot say.** The proposal's service-included headings carry the frequency in capitals ("AHU (QUARTERLY)", "BOILER (BI-ANNUAL)"); its price table says "NUMBER OF TIMES PER YEAR" and "4 times per year" under its own title; its schedule is a nested list (1. a. i.); the contract's headings are numbered, its signature blocks read "Client / Signed electronically / Signature (electronic) / Name & title (print) / Date" and "For and on behalf of <company>", and it begins with no meta block but Client, Site and Effective date.
5. **It is not a block editor.** Intro and closing text are two text areas; a member cannot add, move or delete a block, or insert a merge variable without typing the braces.

Evidence the source gives: the ROADMAP line and decisions 12 and 14, the owner's two PDFs (read page by page: the proposal has 11 pages, the contract 9), and the limits found while building the earlier "Preventive maintenance proposal" template on 2026-11-13.

When this ships, an owner or admin edits an agreement template and the contract wording as a list of blocks and sections they add, reorder, show and hide, with document options (title, letterhead on every page, section titles and labels), with the real PDF refreshing beside the editor; and both Enviroware documents exist as templates in the app and draw, from a real agreement and a real contract, in the order and with the wording of the attachments.

## Flow

Reuses `document_templates` and immutable `document_template_versions`, the merge-variable whitelist and `renderBlocks`, the `save_agreement_template` pattern (definer, owner and admin, body check, advisory lock), the live preview frame and the preview route (template-flow), `buildAgreementDocument` and `buildContractDocument` as the seams for every PDF and the review page, and the DocuSeal text-tag signature block, instead of a second editor, a second renderer or a second signing path.

1. Editor change -> `BlockListEditor` and `DocumentOptionsPanel` (new, no door - placement) edit one `layout` and the document options in the form state -> `bodyFromTemplateForm` (exists, extended) -> `validateAgreementTemplate` / `validateContractWording` (exist / new) -> after 700 ms `POST /templates/preview` or `POST /templates/contract/preview` -> `buildTemplatePreviewDocument` (exists) or `buildContractPreviewDocument` (new) -> `buildAgreementDocument` / `buildContractDocument` (exist, extended) -> `agreement-pdf.tsx` / `contract-pdf.tsx` (exist, extended) draw the title block, the layout items in order and the page header and footer.
2. Save -> `saveAgreementTemplateAction` (exists) -> `public.save_agreement_template` (exists, extended: schema 1 or 2); contract: `saveContractWordingAction` (new) -> `public.save_contract_template` (new, door 2) -> a new immutable version (door 1).
3. Old versions: `layoutOf` (new, no door) turns a schema 1 agreement body, and `contractLayoutOf` (new, no door) a schema 1 contract body, into the layout code drew before, so every sent agreement and every existing contract prints as it did.
4. Review page and portal: `portal_view` (exists, unchanged) returns the pinned body -> `portalLayout` (new, built on `renderAgreementLayout`; `portalTemplateText` stays as its schema 1 reading) and `review-view.tsx` (exists, extended) draw the sections in layout order with the same titles, through `ServiceIncludedSection` and `ServiceEquipmentSection` (the two halves of `ServiceScopeSections`, which keeps drawing both).
5. New contracts: `private.make_contract` (exists, unchanged) pins the org's own latest contract version, so the saved wording governs contracts made afterwards.
6. Signing: `makeContractDocuments` (exists) builds the contract PDF the signature provider receives; the signature section prints the DocuSeal text tags, including the new Name and title field.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: layout - the ordered list of items a document draws between its title block and its page footer: text blocks and system sections |
| domain | new term: system section - agreement: `price`, `schedule`, `included`, `equipment`, `terms`; contract: `price`, `schedule`, `included`, `equipment`, `signatures`. `price` and `signatures` can be moved but never hidden |
| domain | new term: document options - `title`, `showMeta` (the number, customer, site, signer and term lines), `pageHeader` (`first` or `every`) and `pageFooter` (`number` or `letterhead`) |
| domain | existing term: `AgreementTemplateBody` (`intro`, `footer`, `sections`) and the contract body (`blocks`) - schema 1 keeps meaning what it meant; schema 2 stores layout and options. Who branches on them today: `domain/agreement/document.ts`, `template.ts`, `template-form.ts`, `template-preview.ts`, `domain/contract/document.ts`, `template.ts`, `infrastructure/documents/agreement-pdf.tsx`, `contract-pdf.tsx`, `pdf-sections.tsx`, `application/use-cases/portal.ts`, `signing.ts`, `components/review/review-view.tsx`, `components/templates/*`, SQL `private.agreement_template_problem` |
| existing callers | `ScopeSections` draws service included and equipment in one function; it becomes two, each with its own title and options. `PriceSection` takes a title, column labels and a visits format. `LetterHead` and `PageFooter` become the page header and footer the options choose |
| existing callers | the signature block (`SignatureBlock`, `signerTags`) gains labels, a caption and an optional Name and title field; the existing tags and `contract_signature_requests` flow are unchanged for a contract that uses the default block |
| stored data | no table change. Existing versions stay schema 1 and are never rewritten. One new function (`save_contract_template`) and a changed one (`save_agreement_template`) |

## Relations

None - no stored-data shape change. The contract wording uses the existing `document_templates` (kind `contract`, one per org) and `document_template_versions`.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /templates/contract` | session | the contract wording editor with a loading screen | 200, 302 to `/login`, 302 to `/templates` |
| `POST /templates/contract/preview` | JSON: the editor's values | `application/pdf` bytes | 200, 401, 403, 422 with `{ errors: [{ field, message }] }`, 503 |
| `rpc save_contract_template(p_body)` | contract body, schema 2 | the template id and version number | 200, 403 `42501`, 422 `22023` |
| `rpc save_agreement_template(p_template_id, p_body)` | template id or null, schema 1 or 2 body | the template id and version number | 200, 403 `42501`, 404 `P0002`, 409 `23505`, 422 `22023` (unchanged statuses) |
| `POST /templates/preview` | JSON: the editor's values (schema 2 fields added) | `application/pdf` bytes | 200, 401, 403, 422, 503 (unchanged statuses) |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Schema 2 of both bodies | agreement: `{ "schema": 2, "name", "description", "doc": DocOptions, "layout": [Item], "preset": { "termMonths", "lines": [...] } }`; contract: `{ "schema": 2, "doc": DocOptions, "layout": [Item] }`. `DocOptions = { "title": string 0..120, "showMeta": boolean, "pageHeader": "first" or "every", "pageFooter": "number" or "letterhead" }`. `Item = { "kind": "block", "type": "heading" or "paragraph" or "clause", "text": 1..2000, "level"?: 1 or 2 (heading only), "indent"?: 0..3, "pageBreakBefore"?: boolean }` or `{ "kind": "section", "key": ..., "options"?: SectionOptions }`. `SectionOptions` by key: `price { title?, columns?: { description, visits, perVisit, perYear, total } each 1..40, visitsFormat?: "number" or "times_per_year" }`, `included { title?, showFrequency?: boolean, uppercase?: boolean }`, `equipment { title? }`, `schedule { title? }`, `signatures { customerLabel?, contractorLabel?, caption?, nameField?: boolean }`; `layout` at most 60 items, at most 40 blocks, each section key at most once, `price` exactly once (and `signatures` exactly once for a contract) | Add `order` arrays beside `intro` and `footer`: cannot put a block between the price table and the schedule, or the schedules after the signatures. Free-form HTML or markdown per block: needs sanitizing and a second renderer. Rewrite schema 1 versions: breaks immutability and every sent agreement |
| 2. Saving contract wording | `public.save_contract_template(p_body jsonb) returns table (template_id uuid, version_no integer)`, `security definer`, `set search_path = ''`, owner and admin only, kind fixed to `contract`, creates the caller's org's contract template on first call and the next version after, accepts schema 1 or schema 2 and validates the structure in SQL (keys, types, limits above) under the per-org advisory lock | Direct writes with an RLS policy: a policy cannot number versions or check the body. One shared save for both kinds: the two bodies differ and a shared function would carry both validations |
| 3. Merge-variable names added | `term.start` (the effective date as `November 13, 2026`), `tenant.address`, `tenant.phone`, `signer.name`, `terms.taxNote` join the eleven of contract-templates door 4; names are never renamed after this | Free-form variables: stored templates bind to names |
| 4. The signature Name field | the signature block prints one more DocuSeal text tag for the customer, `{{Name;role=Customer;type=text}}`, only when `nameField` is true; no other tag changes | A separate signing step: a second provider call and a webhook change for one printed line |
| 5. Signature label and caption limit (found while building batch 1) | `signatures.customerLabel`, `contractorLabel` and `caption` are 1..120 characters and may carry merge variables; price column labels stay 1..40, titles 1..120 | 40 for every label: "For and on behalf of {{tenant.legalName}}" is 41 characters, so the contract's own signature heading could not be stored |
| 6. Frequency heading shape (found while building batch 1) | with `included.showFrequency` a type heading reads exactly `<name> (<FREQUENCY>)` (no units count), the frequency is that of the first service line, in position order, that covers the type (matched by type code, else by name) | Keep `, N units` beside the frequency: AC 15 gives the heading as `<name> (<FREQUENCY>)` and the proposal prints no count. Highest visits when several lines cover a type: no source says which, the first is stable |

- A text uses the same whitelist (now sixteen names); an unknown variable is refused by the validator on save and renders as no value
- Nothing else in this change is hard to reverse

## Criteria

### S1: The layout and options of an agreement are the tenant's (P1)

**Acceptance Criteria**

1. WHEN `layoutOf` reads a schema 1 agreement body THEN it SHALL return, in order, the intro blocks, `price`, `schedule` (only when the body shows it), `included` and `equipment` (only when the body shows the scope), `terms`, then the closing blocks, with default options and the document options of today (title "Preventive maintenance service agreement", `showMeta` true, `pageHeader` first, `pageFooter` number)
2. WHEN a schema 2 body is read THEN `layoutOf` SHALL return its layout and `doc` as stored
3. WHEN the agreement PDF is drawn THEN after the title block it SHALL draw the layout items in order, a block as its heading level, indent and text, a section as its own section, with a new page before a block that has `pageBreakBefore`
4. IF a section is absent from the layout THEN the PDF SHALL NOT draw it, and the price table SHALL always be drawn exactly once
5. WHEN the layout places `included` before `price` THEN the PDF text SHALL show the service-included title before the price title
6. WHEN `doc.showMeta` is false THEN the PDF SHALL NOT draw the number, customer, site, term or validity lines, and the title SHALL still be drawn when it is not empty
7. WHEN `doc.title` is set THEN the PDF SHALL draw it as the document title with its merge variables filled
8. WHEN `doc.pageHeader` is `every` THEN the letterhead SHALL be drawn at the top of every page, and WHEN `first` only on the first page
9. WHEN `doc.pageFooter` is `letterhead` THEN every page SHALL end with the company name, address and phone, and WHEN `number` with the agreement number and page count as today
10. WHEN the customer's review page is drawn THEN it SHALL show the same layout items, section titles and order as the PDF for that version
11. WHEN an agreement pinned to a schema 1 version or to no template is drawn THEN its PDF and review page SHALL print exactly what they print today
12. WHERE an agreement version was sent THEN its layout and options SHALL come only from its frozen pin
13. WHEN a body is validated THEN `validateAgreementTemplate` SHALL accept schema 2 and refuse, each with its own message, an unknown item kind, section key or document option value, a repeated section, a missing or repeated `price`, more than 60 items, more than 40 blocks, a text over 2,000 characters, a title over 120, an unknown variable and an indent or level out of range
14. WHEN a body is saved THEN `save_agreement_template` SHALL accept schema 1 or schema 2, SHALL raise `22023` for a schema 2 body the same rules refuse, and SHALL leave every earlier version unchanged

**Independent test:** save a schema 2 template with the equipment list after the price table and a title, and read the PDF text order.

### S2: Section options reproduce the proposal's presentation (P1)

**Acceptance Criteria**

15. WHEN the `included` section has `showFrequency` THEN each equipment type's heading SHALL read `<name> (<FREQUENCY>)` where the frequency comes from the visits per year of the service line that covers that type: 12 `MONTHLY`, 4 `QUARTERLY`, 2 `BI-ANNUAL`, 1 `ANNUAL`, any other count `N TIMES PER YEAR`; and a type covered by no line SHALL read without a frequency
16. WHEN the `included` section has `uppercase` THEN the type headings SHALL be drawn in capitals
17. WHEN a section has a `title` option THEN the PDF and the review page SHALL draw that title instead of the default ("Service and price", "Visit schedule", "Service included", "Equipment" in the org's word)
18. WHEN the `price` section has `columns` THEN the table header SHALL use those labels, and WHEN `visitsFormat` is `times_per_year` a line's visits SHALL read `4 times per year` and `1 time per year`
19. WHEN a block has `indent` n THEN its text SHALL be drawn indented n levels, and WHEN a heading has `level` 1 it SHALL be drawn as the document-title style and `level` 2 as the section style
20. WHEN no option is set THEN every section SHALL draw exactly as it does today

**Independent test:** draw an agreement whose quarterly line covers AHU and boiler type and read "AHU (QUARTERLY)" in capitals.

### S3: The contract is a layout too (P1)

**Acceptance Criteria**

21. WHEN `contractLayoutOf` reads a schema 1 contract body THEN it SHALL return the layout code drew before: price, schedule, included, equipment, the wording blocks, then signatures, with today's document options (title "Service Contract", `showMeta` true, header first, footer number)
22. WHEN the contract PDF is drawn THEN it SHALL draw the title, the meta lines when `showMeta`, then the layout items in order, including the signatures section where the layout puts it, and the schedules after it when the layout says so
23. WHEN the `signatures` section is drawn THEN it SHALL print the customer block headed by `customerLabel` (default "For the Customer: <signer>"), the contractor block headed by `contractorLabel` (default "For <company>"), the `caption` under each heading when set, one Signature and one Date line each with their DocuSeal tags unchanged, and, only when `nameField` is true, a Name and title line for the customer with the tag `{{Name;role=Customer;type=text}}`
24. IF the `signatures` section is missing from a contract layout THEN the validator SHALL refuse it, and the section SHALL be draggable to any position but never hidden
25. WHEN a contract made before this feature is drawn THEN its PDF SHALL print exactly what it prints today
26. WHEN a merge variable is `term.start`, `tenant.address`, `tenant.phone`, `signer.name` or `terms.taxNote` THEN it SHALL resolve for a contract and for an agreement (a missing value counts as no value) and be accepted by the validators
27. WHEN `save_contract_template` is called by an owner or admin with a valid schema 1 or 2 body THEN it SHALL create the org's contract template on the first call and a new version on later ones, and new contracts SHALL use the newest version while contracts already made keep theirs
28. IF an estimator, a viewer or a non-member calls `save_contract_template` THEN it SHALL raise `42501` and write nothing, and IF the body does not pass the structural rules THEN it SHALL raise `22023`

**Independent test:** save a contract wording with the signatures before the schedules and make a contract from it.

### S4: The block editor (P1)

**Acceptance Criteria**

29. WHEN the editor opens THEN it SHALL show the document options panel (title, show meta lines, letterhead on every page, footer style) and the layout as ordered rows, each block row with type, text, level or indent and page break controls and each section row with its name and its options
30. WHEN a member adds a block THEN the editor SHALL offer Heading, Paragraph and Clause and append an empty row of that type
31. WHEN a member moves a row up or down THEN it SHALL swap with its neighbour, the first row's Up and the last row's Down SHALL be disabled, and that order SHALL be what is saved
32. WHEN a member removes a block row THEN it SHALL go, and WHEN a member hides a hideable section THEN it SHALL leave the layout, while `price` (and `signatures` for a contract) SHALL have no Remove and no Hide
33. WHEN a member shows a hidden section THEN it SHALL be added at the end of the layout
34. WHEN a member chooses a merge variable from a text row's Insert variable control THEN `{{name}}` SHALL be inserted at the cursor and the control SHALL list exactly the whitelisted names
35. WHEN a section row is opened THEN it SHALL show that section's options (title, labels, visits format, show frequency, uppercase, signature labels, caption and name field) and a change SHALL appear in the live PDF
36. WHEN a template saved as schema 1 is opened THEN the editor SHALL show its `layoutOf` rows and options, and WHEN it is saved a schema 2 version SHALL be written
37. WHEN a field fails validation THEN the editor SHALL stay open with the row's message beside it and keep every typed value
38. WHEN the layout or an option changes THEN the live PDF SHALL refresh as for any change
39. WHERE the screen is narrower than 1280 px THEN rows SHALL stack with the preview below, every control SHALL be at least 44 px high, and nothing SHALL depend on hover or drag
40. WHEN a template is duplicated THEN the copy SHALL carry the layout and options of its latest version and be named as today

**Independent test:** open `/templates/new`, add a heading, move the equipment section above the price table, turn on letterhead on every page, and watch the PDF follow.

### S5: The contract wording editor (P1)

**Acceptance Criteria**

41. WHEN an owner or admin opens `/templates/contract` THEN the page SHALL show the layout and options of the org's own contract template, or of the system wording while it has none, with the contract PDF preview beside it
42. WHEN the member saves THEN `save_contract_template` SHALL be called once with the validated body and the page SHALL show the saved wording
43. WHEN the values fail validation THEN the editor SHALL show each row's message and save nothing
44. WHEN `POST /templates/contract/preview` receives valid values from an owner or admin THEN it SHALL answer a contract PDF built with `buildContractDocument` from sample data (customer "Sample Customer Ltd.", site "Sample Site", number "AG-0000", a signer, the org's letterhead and logo, today's terms, one priced sample line) and write nothing
45. IF the caller is signed out THEN the route SHALL answer 401, not an owner or admin 403, invalid values 422 with the field errors, a renderer failure 503
46. WHEN the Templates screen is drawn THEN below the agreement templates it SHALL show a Contract wording card with "Standard contract wording" or "Your contract wording" and, to an owner or admin, an Edit (or Customize while the org has none) link to `/templates/contract`; others see the card without the link
47. WHEN `/templates/contract` is requested THEN it SHALL redirect an estimator and a viewer to `/templates`, a signed-out visitor to `/login`, and SHALL have a loading screen titled "Contract wording"

**Independent test:** as the owner open Contract wording, move a block, save, and read the contract PDF of a new contract.

### S6: The two Enviroware documents exist as templates (delivery, live)

The orchestrator creates them in the running app once S1 to S5 are verified, from the attached PDFs, and checks them against the PDFs page by page. They are acceptance by observation, not numbered checks, because they are data in the hosted project.

**Acceptance Criteria**

48. WHEN the Enviroware proposal template is used on a site with equipment THEN the agreement PDF SHALL show, in order, the title "MAINTENANCE SCHEDULE", the Site line, the numbered and lettered schedule text, "Service included:" with each type's tasks under a heading carrying its frequency in capitals, the service charge table titled "PREVENTIVE MAINTENANCE SERVICE CHARGE" with the labels and "N times per year" of the proposal, and the equipment list titled "EQUIPMENT LIST", with the letterhead on every page
49. WHEN a contract is made from the Enviroware contract wording THEN the contract PDF SHALL show the title "PREVENTIVE MAINTENANCE SERVICE AGREEMENT", Client, Site and Effective date lines, the numbered sections of the attached contract in order with the price table inside "Price & payment", the acceptance paragraph, the signature blocks labelled as in the attachment, the closing italic lines, and then Schedule A (equipment) and Schedule B (task list) each starting on a new page

**Independent test:** open the generated PDFs beside the attachments.

## Out of scope

| Excluded | Why |
| --- | --- |
| Click-on-the-page editing and drag-and-drop | The owner chose the live PDF beside the editor; reorder is by Up and Down buttons (works by touch and keyboard) |
| Hiding or moving the title block and the page footer as items | They are the document options; the letterhead and footer choices cover the attachments |
| Editing the task library (the Major and Minor boiler task groups, "SUBCONTRACTOR" in a heading, the new boiler tasks of the proposal) | The service-included text comes from each org's task library, which has no screen since 2026-11-10; the proposal's boiler Major and Minor lists are task data. Reported at delivery with the exact differences |
| A real-signer test against DocuSeal's sandbox for the new Name field | The sandbox needs the owner's key; the tag text and the PDF are proven, the provider's handling of a text tag is not |
| Starter wording per trade and province, legally reviewed | Phase 5.5 item 4 and decision 14 |
| Upload an existing contract | Phase 5.5 item 5 |
| Resetting contract wording to the system wording | Editing back is possible; a reset can follow |
| Rewriting existing schema 1 versions | Immutable and frozen into sent agreements |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Frequency in a service-included heading | Derived from the visits per year of the line that covers the type | The proposal prints the frequency per type; a line already states it | n |
| Which sections can be hidden | agreement `schedule`, `included`, `equipment`, `terms`; contract `schedule`, `included`, `equipment`; `price` and (contract) `signatures` never | The ROADMAP keeps the price table and the signature block | n |
| Price table and signatures can move | Yes (the contract puts the schedules after the signatures; the proposal puts service included before the price) | The attachments | n |
| A section shown again goes | To the end of the layout | Predictable | n |
| Nested lists | A block's `indent` 0 to 3 and its label typed by the member ("a.", "i.") | No numbering engine; the attachments use typed labels | n |
| Numbered contract headings | Typed in the heading text ("1. Service provided") | Same | n |
| A new template starts from | The Standard layout and today's options | Nothing changes until the member edits | n |
| Body limits | 60 items, 40 blocks, 2,000 characters per text, title 120, labels 40 | Bounded renderer and save | n |
| The contract's "ongoing until cancelled" | Wording text; the contract still stores a term (the term line can be hidden with `showMeta` false) | The contract status machine is out of scope | n |
| Profile | `ui` (project floor); the two PDFs are the binding sources for S6 and the structure of the editor is enumerated from this plan | Same as template-flow | y |
| Mechanism | Handoff in batches (same as agreement-templates, the owner's standing recommendation) | The estimate is over the 150k budget | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen agreement template editor | empty state | AC 29 (a new template shows the Standard layout) |
| screen agreement template editor | loading, error, unauthorised | existing - loading screens, field messages (AC 37), redirects of template-flow |
| screen agreement template editor | density and ordering, arrangement | AC 29, AC 31, AC 39 |
| screen agreement template editor | destructive action confirms | n/a - removing a row is undone by adding it again and nothing is saved until Save |
| screen contract wording editor | empty state | AC 41 (the system wording while the org has none) |
| screen contract wording editor | loading | AC 47 |
| screen contract wording editor | error state | AC 43 |
| screen contract wording editor | unauthorised | AC 47 |
| screen Templates, Contract wording card | density, ordering, unauthorised | AC 46 |
| api `POST /templates/contract/preview` | error shape and codes, who may call | AC 45 |
| api both preview routes | versioning, rate limits | n/a - consumed only by this app's editor; the product has no rate limiter (template-flow Out of scope) |
| rpc `save_contract_template` | response shape, error shape, who may call | Surface row; AC 28 |
| document the agreement PDF | structure, ordering, next step for the reader | AC 3 to AC 9 (the reader's next step, Accept or Refuse, is the unchanged review page) |
| document the contract PDF | structure, ordering, next step for the reader | AC 22, AC 23 (the next step, sign, is the signature section) |
| document the review page | structure and ordering | AC 10 |

## Sources

- ROADMAP Phase 5.5 item 3, "Document templates" section, decisions 12 and 14 - the block editor, the live preview, clone, and the rule that the price table and the signature block stay
- The owner's PROPOSAL.pdf and contract.pdf (2026-11-13) - the order, wording, repeated header and footer, frequency headings, price table labels, signature block labels and schedules after the signatures that the product must reproduce
- `.specs/features/contract-templates/`, `.specs/features/agreement-templates/`, `.specs/features/template-flow/` - the tables, body shape, save functions, editor and preview this builds on
