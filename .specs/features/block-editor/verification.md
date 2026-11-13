# Block editor and document layout verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: cbcd91a..HEAD (HEAD 5b9fe4c)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Summary: all 53 checks have a named test that exists and ran green at HEAD (50 clean, 3 with a surviving mutant or a contradiction with the plan: C5527, C5546, C5550). 44 faults were injected; 33 killed, 11 survived. The binding enumeration has two elements with no check and no renderer. The gate fails on survivors, on the unproven contract and agreement wiring members, and on AC 39 (44 px below 1280 px) versus the check that weakened it to 1024 px. Nothing here claims approval; the orchestrator runs the gate script.

## Binding sources

The two Enviroware PDFs are not on disk (declared in the brief). `checks.md` `## Binding sources` (lines 18-25) and plan Problem (lines 3-14) were compared against the checks and against the code instead. "Opened" below means the enumeration was opened and each element traced to a check and to the rendering code, not that a PDF page was seen.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| PROPOSAL.pdf: letterhead on every page (logo, name, address, phone) | enumeration in checks.md:22 traced to `agreement-pdf.tsx:88`, `pdf-sections.tsx:46-60` and C5507 `agreement-pdf.test.ts:545` | none | C5507 asserts the company name at the top of each page only; address, phone and logo on pages 2+ are one shared component and have no assertion |
| PROPOSAL.pdf: the "(Address) Maintenance" line of the header | enumeration checks.md:22 | none | the letterhead has no separate line for it (`pdf-sections.tsx:55-57` draws name, address, phone); no check, no control (it can only live inside the address setting) |
| PROPOSAL.pdf: title "MAINTENANCE SCHEDULE" and the "Site:" line | C5505 `agreement-pdf.test.ts:528`, C5506 `:535`; the Site line is a paragraph block with the `{{site.name}}` variable (`domain/contract/template.ts:21`) | none | - |
| PROPOSAL.pdf: numbered list with lettered and roman sub-levels | C5519 `agreement-pdf.test.ts:645-649`, `:655-656`; `pdf-sections.tsx:264-278` | none | - |
| PROPOSAL.pdf: "Service included:" with a heading per type carrying the frequency in capitals | C5515 `agreement-pdf.test.ts:587-591`, C5516 `:596-601`, C5517 `:616` | none | - |
| PROPOSAL.pdf: service charge table title, four column labels, "4 times per year" | C5517 `agreement-pdf.test.ts:616`, C5518 `:626-629`; `pdf-sections.tsx:73,99-127` | none | - |
| PROPOSAL.pdf: "EQUIPMENT LIST" after the price; no terms block, no visit schedule | C5517 `:616`, C5504 `:519`, C5503 `:494` | none | - |
| contract.pdf: title without the meta block; Client, Site, Effective date lines | C5522 `contract-pdf.test.ts:339-341`; variables `customer.name`, `site.name`, `term.start` C5527 `template.test.ts:216-221` | none | - |
| contract.pdf: numbered headings and wording paragraphs, acceptance paragraph | heading and paragraph blocks, C5522 `contract-pdf.test.ts:301-305` | none | - |
| contract.pdf: price table inside the numbered section "Price & payment" | C5522 `contract-pdf.test.ts:356-359` | none | - |
| contract.pdf: signature blocks "Client" and "For and on behalf of <company>", "Signed electronically", "Signature", "Name & title (print)", "Date" | C5523 `contract-pdf.test.ts:381-388`, C5524 `:401-409`; `contract-pdf.tsx:23-48,114-127` | none ("Signature (electronic)" is a documented difference, checks.md:25) | - |
| contract.pdf: two italic closing lines | enumerated at checks.md:23 | none | no italic style exists anywhere (`rg -i italic` over web finds nothing); `LayoutBlock` has heading, paragraph and clause styles only; no check names it. Closing lines render as plain paragraphs |
| contract.pdf: small-logo header and address footer on every page | C5522 `contract-pdf.test.ts:347-352` | none | - |
| contract.pdf: Schedule A and B each on a new page after the signatures | C5522 `contract-pdf.test.ts:307-335` | none | - |
| Plan S4 editor enumeration (AC 29-39), screens below | opened in full, see "Screen enumeration" | AC 39 says "narrower than 1280 px ... every control at least 44 px"; check C5550 (checks.md:166) says "below lg" and the code is 44 px only below 1024 px (`button.tsx`: `h-11 ... lg:h-[34px]`, `block-list-editor.tsx:39`: `min-h-11 lg:min-h-0`, `switch.tsx:5`: `lg:min-h-9`); controls are 34 px from 1024 to 1279 px while the layout is still stacked | C5550 asserts the arrangement and 44 px for the agreement editor only; the contract wording editor's container classes and the Templates card arrangement have no structure assertion (see mutant M25) |

### Screen enumeration (rendered structure, from the code and the tests)

| Screen | Present and in order | Absent | Arrangement | Proof |
| --- | --- | --- | --- | --- |
| Agreement template editor | Name, Description, Term length, Document options panel (Title, Show the number/customer/site lines, Letterhead on every page, Footer), Layout rows, Add block (Heading, Paragraph, Clause), Hidden sections, Preset lines, Save and Cancel (`template-editor.tsx:55-178`) | no drag handle, no hover-only control | column below 1280 px, two `minmax(0,1fr)` tracks from `xl`, form region before preview (`template-editor.tsx:209-231`) | C5540 `block-editor.test.tsx:97-141`, C5550 `:346-368`, C5430 `template-editor.test.tsx:133-153` |
| Block row | Up, Down, Remove (blocks) or Hide (hideable sections); type, level (heading only), indent, text, Insert variable (16 names), page break (`block-list-editor.tsx:119-185`) | price: no Remove, no Hide; contract signatures: no Remove, no Hide | 44 px (`min-h-11`) below `lg` only | C5542-C5545 `block-editor.test.tsx:160-249` |
| Section options | price: title, five column labels, visits format; included: title, frequency, capitals; equipment, schedule: title; signatures: customer label, contractor label, caption, name field; terms: text only | - | `sm:grid-cols-2` for the five labels | C5546 `block-editor.test.tsx:256-289` (presence and values; order of the five labels not asserted) |
| Contract wording editor | same options panel and rows with the signatures section; Save wording, Back to templates; preview frame `/templates/contract/preview` | - | same classes as the agreement editor (`contract-wording-editor.tsx:36`) but no test asserts them | C5552 `page.test.ts:43-57` (form before preview), `contract-wording-editor.test.tsx:54-59`; classes unproven (M25) |
| Templates screen, Contract wording card | card below the agreement templates, Standard or Your contract wording, Customize or Edit link for owner and admin only | no link for estimator and viewer; no card when the wording cannot be read | `md:flex-row` | C5557 `templates-view.test.tsx:153-182` |
| Review page | layout items in layout order, same titles as the PDF (`review-view.tsx:106-200`) | doc title is not drawn on the page (existing behaviour) | - | C5509 `components/review/layout.test.ts:29-79` |

## Checks

All proofs run at HEAD from PowerShell, one invocation for the 20 files with `-t "C55(0[0-9]|1[0-9]|2[0-9]|3[01]|4[0-9]|5[0-9]|60):"`: 20 files, 206 passed, 199 skipped, 0 failed. Every id below appears in the verbose output. The SQL ids were run with `npm run test:db block_editor` (PASS) and the three older recipes (`agreement_templates contract_templates plan_limits`, PASS). Setup-feature tests that reuse ids C5500-C5515 (`components/setup`, `app/setup`, `domain/contract/starter-preview.test.ts`) were not in the run (finding F7).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5500 | layoutOf schema 1, four schedule/scope combinations, default doc | `vitest domain/agreement/layout.test.ts -t C5500:` exit 0 (5 tests) | `layout.test.ts:37` `expect(layout).toEqual([...intro, ...middle, ...closing])`, `:38` doc toEqual four defaults | PASS |
| C5501 | layoutOf schema 2 as stored; system body equals no-template layout | `-t C5501:` (2) | `layout.test.ts:95` `expect(layout).toEqual(stored.layout)`, `:100` `layoutOf(SYSTEM_AGREEMENT_BODY).layout` toEqual `buildAgreementDocument(...).layout` | PASS |
| C5502 | items in order, level 1/2, page break starts a page | `agreement-pdf.test.ts -t C5502:` (1) | `agreement-pdf.test.ts:486` inOrder of title, headings, paragraph, clause, price, next-page text, Terms; `:489` `pages[1].split("\n")[0]` is "Starts the next page." | PASS |
| C5503 | absent sections not drawn, price once in every layout | `-t C5503:` (5) | `agreement-pdf.test.ts:494` absent list not.toContain, `:495,500,511` `count(all,"Service and price")` is 1 | PASS |
| C5504 | included before price and the reverse | `-t C5504:` (1) | `agreement-pdf.test.ts:519` `indexOf("Service included")` < `indexOf("Service and price")`, `:521` reverse | PASS |
| C5505 | showMeta false/true | `-t C5505:` (1) | `agreement-pdf.test.ts:527` absent lines, `:528` title kept, `:530` present when true | PASS |
| C5506 | title with merge variables, empty draws none | domain `-t C5506:` (1), pdf (1) | `document.test.ts:281` `doc.title` toBe "Maintenance schedule for Fernwood Dental, Main"; `agreement-pdf.test.ts:535,538-539` | PASS |
| C5507 | pageHeader every on 3 pages, first once | `-t C5507:` (1) | `agreement-pdf.test.ts:545` every page `startsWith("Kettle Ridge Mechanical Ltd.")`, `:549` later pages not.toContain | PASS |
| C5508 | footer letterhead vs number | `-t C5508:` (1) | `agreement-pdf.test.ts:556` last 3 lines equal name, address, phone; `:560` last 2 lines number and "Page i of n" | PASS |
| C5509 | review page same items, titles, order as PDF | `components/review/layout.test.ts -t C5509:` (3) | `layout.test.ts:43-52` PDF layout list toEqual, `:60-62` positions sorted and `headings(page)` arrayContaining titles | PASS |
| C5510 | schema 1 / no template print as before | `-t C5510:` (1) | `agreement-pdf.test.ts:581` `pdfPages(built)` toEqual `pdfPages(before)` (before = built minus layout and doc); the old agreement-pdf.test.ts assertions are intact (diff is 256 added lines, 0 removed) | PASS |
| C5511 | sent version takes layout only from its pin | `document.test.ts -t C5511:` (1) | `document.test.ts:290` `after.layout` toEqual `before.layout` with other settings | PASS |
| C5512 | validateAgreementTemplate schema 2: fourteen refusals, each its own message | `layout.test.ts -t C5512:` (19) | `layout.test.ts:159` `reasonOf(input)` toContain per case (14 cases `:144-157`), `:179` `new Set(...).size` is 14 | PASS |
| C5513 | save_agreement_template accepts schema 1 and 2, earlier version unchanged, 22023 for repeated section and missing price | `npm run test:db block_editor` PASS | `block_editor.sql:93,102,103` versions 1, 2 and byte-for-byte, `:115,117,119` expect_error `22023`, `:126` estimator `42501`, `:128` other org `P0002` | PASS |
| C5514 | 22023 for each invalid schema 2 body, nothing written | same | `block_editor.sql:166` expect_error `22023` over 20 labelled bodies, `:169` counts unchanged | PASS |
| C5515 | frequency labels and per-type derivation | domain (4) + pdf (1) | `document.test.ts:297` labels list, `:301` `typeFrequencies` toEqual five entries; `agreement-pdf.test.ts:587-591` headings; first-line rule: see M5 | PASS |
| C5516 | uppercase headings | `-t C5516:` (1) | `agreement-pdf.test.ts:597` contains "AHU (QUARTERLY)", `:598` not "Boiler (BI-ANNUAL)" | PASS |
| C5517 | title option replaces defaults in PDF and review page | pdf (1) + review (3) | `agreement-pdf.test.ts:616-619` rows contain titles and not the defaults; `layout.test.ts:83-86` headings | PASS |
| C5518 | price columns, visitsFormat | `-t C5518:` (1) | `agreement-pdf.test.ts:626` four labels, `:627` "TOTAL $500.00", `:628-629` "4 times per year", "1 time per year" | PASS |
| C5519 | indent two levels, level 1/2 styles | `-t C5519:` (2) | `agreement-pdf.test.ts:646` `indented.marginLeft` toBe 32, `:648-649` style arrays | PASS |
| C5520 | empty option objects draw the same | `-t C5520:` (1) | `agreement-pdf.test.ts:670` `expect(empty).toEqual(bare)` | PASS |
| C5521 | contractLayoutOf schema 1 and system wording | `domain/contract/layout.test.ts -t C5521:` (4) | `layout.test.ts:23-33` layout toEqual seven items, `:34` doc "Service Contract"; `:223+` built document layout | PASS |
| C5522 | contract PDF order, schedules after signatures on new pages | `contract-pdf.test.ts -t C5522:` (4) | `contract-pdf.test.ts:313-329` inOrder of title...Service included, `:334-335` page starts with "SCHEDULE A..." and "SCHEDULE B..." | PASS |
| C5523 | signatures default block, labels, caption, four tags | `-t C5523:` (3) | `contract-pdf.test.ts:365-374` headings, 2 "Signature\n", 2 "Date\n", each of the four tags once, no Name; `:385,388` caption under each heading | PASS |
| C5524 | nameField adds Name line and tag, customer only | `-t C5524:` (2) | `contract-pdf.test.ts:401` one "Name & title (print)", `:404-405` the Name tag once and only one `{{Name;` | PASS |
| C5525 | validateContractWording ten reasons | `domain/contract/layout.test.ts -t C5525:` (16) | `layout.test.ts:106` `reasonOf(input)` toContain (11 cases `:94-104`), `:127` set size 10, `:89` any position | PASS |
| C5526 | old contracts print the same | `-t C5526:` (1) | `contract-pdf.test.ts:439` `expect(withLayout).toEqual(without)`; old contract-pdf.test.ts diff is 3 changed import lines | PASS |
| C5527 | five variables resolve for contract and agreement; sixteen names | `domain/contract/template.test.ts -t C5527:` (8) | `template.test.ts:216-221` "November 13, 2026"; `:243-257` `agreementTemplateValues` resolves them; `:212` length 16. Wiring of agreement and review page to those values is unproven: M33, M34, M35 survive | FAIL |
| C5528 | save_contract_template create, v2, contracts keep versions | SQL | `block_editor.sql:187,197` versions 1 and 2, `:192` contract keeps v1, `:202` contract after has v2, `:203` earlier unmoved | PASS |
| C5529 | 42501 for estimator, viewer, non-member, anon; 22023 for bad bodies | SQL | `block_editor.sql:216` expect_error `42501` for uE, uV, uX; `:220` anon; `:243` 13 bad bodies `22023`; `:245` null body | PASS |
| C5530 | contract reader: schema 1 and 2, throws on invalid | `infrastructure/supabase/contracts.test.ts -t C5530:` (7) | `contracts.test.ts:289-290` bodies as stored, `:300` `rejects.toThrow("tv-2")` for six invalid cases | PASS |
| C5531 | buildContractPreviewDocument | `domain/contract/layout.test.ts -t C5531:` (4) | `layout.test.ts:168-175` number, customer, site, signer, one line; `:181-186` posted layout and doc; `:192` term string | PASS |
| C5540 | options panel then rows; block and section rows | `components/templates/block-editor.test.tsx -t C5540:` (4) | `block-editor.test.tsx:108` order sorted, `:114-119` heading controls, `:126-134` section labels, `:140` signatures labels | PASS |
| C5541 | Add block offers exactly three and appends | `-t C5541:` (1) | `block-editor.test.tsx:148` buttons text toEqual ["Heading","Paragraph","Clause"], `:152-156` appended row | PASS |
| C5542 | Up/Down swap and boundaries | `-t C5542:` (1) | `block-editor.test.tsx:163,165` boundary disabled, `:168,170,171` saved order | PASS |
| C5543 | Remove, Hide, price and signatures have neither | `-t C5543:` (2) | `block-editor.test.tsx:181` price buttons toEqual ["Up","Down"], `:182` rows 3-6 ["Up","Down","Hide"], `:191` signatures | PASS |
| C5544 | Show appends at the end | `-t C5544:` (2) | `block-editor.test.tsx:204,206` last keys, `:215-217` contract hidden list | PASS |
| C5545 | Insert variable lists the sixteen names and inserts at the cursor | `-t C5545:` (3) | `block-editor.test.tsx:226` options toEqual SIXTEEN, `:236` "Wel{{customer.name}}come." | PASS |
| C5546 | section row options reach the posted layout | `-t C5546:` (5) | `block-editor.test.tsx:263,273-275,284-288,296-297` bodies toEqual; indent is asserted at 2 only (`:294`): M23 (indent 1 dropped on save) survives the whole suite | FAIL |
| C5547 | schema 1 opens as layoutOf rows and saves as schema 2 | `domain/agreement/template-form.test.ts -t C5547:` (6) | `template-form.test.ts:109-121` rows, `:129` `saved.body.layout` toEqual `layoutOf(V1).layout`, `:152` round trip | PASS |
| C5548 | validation failure keeps editor open, messages on rows, values kept | block-editor (1), template-editor (3), form (1) | `block-editor.test.tsx:316-325` row messages, aria-invalid, typed value, order; `template-editor.test.tsx:100-110,117-120` | PASS |
| C5549 | preview request once, 700 ms after the last change | `components/templates/template-editor.test.tsx -t C5549:` (5) | `template-editor.test.tsx:207-212` 699 ms none, 1 ms one call with the new title; `:224-226` 300+700 ms one call carrying both | PASS |
| C5550 | column below 1280 px, two tracks from xl, 44 px controls, no hover-only | `block-editor.test.tsx -t C5550:` (3) | `block-editor.test.tsx:349-351` classes `flex-col`, `xl:grid`, `xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`; `:356-358` `min-h-11`, `h-11`; the assertions hold but they test the agreement editor only (M25 survives for the contract editor) and AC 39's 1280 px is weakened to 1024 px | FAIL |
| C5551 | duplicate carries layout and options | `application/use-cases/templates.test.ts -t C5551:` (2) | `templates.test.ts:57` `save` toHaveBeenCalledWith(null, `{ ...V2, name: "Proposal (copy)" }`) | PASS |
| C5552 | /templates/contract shows the org's or the system wording with the preview beside | `app/(app)/templates/contract/page.test.ts -t C5552:` (4) + editor + form | `page.test.ts:49-56` `value="Service Contract"`, form before preview; `:62-65` own wording | PASS |
| C5553 | saveContractWordingAction once with the validated body; estimator forbidden | `contract-actions.test.ts -t C5553:` (8) | `contract-actions.test.ts:31-33` `toHaveBeenCalledTimes(1)`, body toMatchObject schema 2; `:41-42` forbidden and not called | PASS |
| C5554 | invalid values show row messages, call nothing | actions (2), editor (3), form (1) | `contract-actions.test.ts:75-78` row messages and layout message, `:79` not called; `block-editor.test.tsx:335-338` | PASS |
| C5555 | preview route 200 pdf, once, no writes | `contract/preview/route.test.ts -t C5555:` (7) | `route.test.ts:75-78` 200, `application/pdf`, `private, no-store`; `:84-92` renderContract once with sample data and posted layout | PASS |
| C5556 | 401, 403, 422, 503, no writes | `-t C5556:` (7) | `route.test.ts:122` 401, `:132` 403 for estimator and viewer, `:143` 422 body toEqual, `:162` 503 | PASS |
| C5557 | Contract wording card, texts and links by role | `components/templates/templates-view.test.tsx -t C5557:` (5) | `templates-view.test.tsx:154-159` below the templates, `link(html)[1]` "Customize" / "Edit", `:176` no `href="/templates/contract"` for estimator and viewer | PASS |
| C5558 | redirects and loading screen | `page.test.ts -t C5558:` (4) | `page.test.ts:76` `NEXT_REDIRECT /login`, `:82` `/templates`, `:89-90` "Contract wording" and "Loading" | PASS |
| C5559 | wording store reads and maps errors | `contract-wording.test.ts -t C5559:` (11) | `contract-wording.test.ts:28` `{ ok: true, body: V2, own: true }`, `:57` rpc args, `:66` `42501` forbidden, `22023` invalid | PASS |
| C5560 | container exposes the read and save use cases | `composition/block-editor-wiring.test.ts -t C5560:` (2) | `block-editor-wiring.test.ts:36` `getContractWording()` toEqual system body, `:45` `rpc` toHaveBeenCalledWith("save_contract_template", ...) | PASS |

## Coverage

Sets recomputed from the plan (Surface, Landing, Criteria), the binding enumeration and the code, then each member run against a mutant where it carries behaviour.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| agreement sections (5) | plan Landing door 1, `layout.ts:21` | price, schedule, included, equipment, terms -> C5503 `agreement-pdf.test.ts:494-514`; titles C5517 | - |
| contract sections (5) | `layout.ts:22` | price C5522 `:356`, included and equipment C5522 `:313`, signatures C5523, schedule: default title C5526 and mutant M44 (killed) | - |
| document options (4) | Landing door 1 | title C5506, showMeta C5505, pageHeader C5507, pageFooter C5508 (agreement and contract) | - |
| section options of the agreement PDF (price 3, included 3, equipment 1, schedule 1) | Landing door 1 | C5517, C5518, C5516, C5515; mutants M3, M19, M37, M48 killed | - |
| section options of the contract PDF (price columns, included frequency and capitals, equipment title) | AC 35 and plan Impact (one adapter draws both) | C5522 tests only price title and default included/equipment | contract price `columns` and `visitsFormat` pass-through (M47), contract `included` showFrequency (M45), contract `equipment` title (M46) have no assertion |
| signatures options (4) | Landing door 1 and door 4 | customerLabel, contractorLabel, caption C5523; nameField C5524 | - |
| block fields (3) | Landing door 1 | level and indent C5519 (PDF); pageBreakBefore C5502; indent 1 through the form conversion: none | `indent` value 1 saved by the editor (M23) |
| frequency labels (6) | AC 15 | MONTHLY, QUARTERLY, BI-ANNUAL, ANNUAL, N TIMES PER YEAR C5515 `document.test.ts:297`; none C5515 `:301`; "first covering line" rule (door 6) only by `components/review/layout.test.ts:95` (M5 killed there) | - |
| agreement body refusal reasons (14) | AC 13 | C5512 `layout.test.ts:144-157`; label limits (column 40, signature labels 120, Landing doors 1 and 5) | column label 41 and signature label 121 refused by TS: no case (M40, M41 survive); SQL refuses a 41-character column label (`block_editor.sql` C5514 "column of 41") |
| contract body refusal reasons (10) | AC 24 | C5525 `layout.test.ts:94-104` | - |
| merge variables added (5) | door 3 | values C5527 `template.test.ts:216-241`; agreement values `:243`; wiring in `buildAgreementDocument` (`document.ts:162-164`) and `portalLayout` (`portal.ts:86-88`) | agreement `tenant.address`, `term.start` through the document builder (M33, M35) and the review page (M34) |
| `save_contract_template` statuses (3) and roles (4) | Surface, AC 28 | 200 C5528, 42501 C5529 for estimator, viewer, non-member, anon, 22023 C5529; owner and admin C5528 `:187,197` | - |
| `save_agreement_template` statuses (5) | Surface (409 included) | 200 C5513, 42501 C5513 `:126`, 404 `P0002` C5513 `:128`, 22023 C5514; 409 `23505`: existing recipe `agreement_templates.sql:230` (schema 1 bodies only; schema 2 shares the function) | - |
| contract preview route statuses (5) | Surface | 200 C5555, 401, 403, 422, 503 C5556 | - |
| agreement preview route statuses (5) | Surface | existing C5435, C5437; mutant M32 (403 gate removed) killed | - |
| editor row controls (6) and block types (3) | AC 31-34 | Up, Down C5542; Remove, Hide C5543; Show C5544; Insert variable C5545; Heading, Paragraph, Clause C5541; mutants M6, M7, M8 killed | - |
| editor arrangement (column below xl, two tracks, form before preview) | AC 39, C5550 | agreement editor C5550 `block-editor.test.tsx:349-351`, C5430; contract editor: order only (`page.test.ts:55-56`) | contract wording editor container classes (M25) |
| control height below 1280 px | AC 39 | 44 px below `lg` only (`block-list-editor.tsx:39`, `button.tsx`, `switch.tsx:5`) | 1024-1279 px: controls are 34 px, the plan wants 44 px |
| ways a body is read (3) | AC 1, 2, 21 | schema 1 agreement C5500, schema 2 C5501, schema 1 and 2 contract C5530 | - |
| contract routes (3) | Surface | `/templates/contract` C5552, C5558; preview C5555, C5556; card C5557; mutant M22 killed | - |
| old documents print as before (3) | Test policy row 4 | C5510 `:581`, C5520 `:670`, C5526 `:439`; the pre-existing tests of both PDFs and the signing documents are unedited and green | - |
| binding enumeration: letterhead elements, italic closing lines | checks.md:22-23 | see Binding sources | the "(Address) Maintenance" line, italic closing lines |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `20261113100000_block_editor.sql` (via `block_editor.sql`), `contract/preview/route.ts`, `preview/route.ts`, `contract-actions.ts`, `template-actions.ts` | SQL as the role (C5513, C5514, C5528, C5529); handlers with doubles (C5553, C5555, C5556) | yes - each status, role and invalid-body reason of the checks has a case; SQL harness proven live by two test-side faults (SQL-S1, SQL-S2) |
| Decides, not reached across a boundary | `layout.ts` (both), `layout-form.ts` (both), `document.ts`, `contract/document.ts`, `template.ts` | own layer test per branch and set member | no - indent 1 through the form conversion (M23), the label limits (M40, M41) and the empty-label fallback (M36) have no case; the "first covering line" branch is killed only at the review page |
| Screens and documents | `block-list-editor.tsx`, `document-options-panel.tsx`, `contract-wording-editor.tsx`, `contract-wording-card.tsx`, `agreement-pdf.tsx`, `contract-pdf.tsx`, `pdf-sections.tsx`, `review-view.tsx` | one render test per region, one PDF-text test per option, structure and classes | no - contract PDF section options (M45, M46, M47) and the contract editor's arrangement (M25) have no test; 44 px between 1024 and 1279 px contradicts AC 39; italic closing lines and the header's address line of the binding enumeration have no check |
| Instrumentation | `composition/index.ts`, `loading.tsx`, schema 1 pass-through | one proof each | yes - C5560, C5558 loading screen, C5510, C5520, C5526 (the old-document tests are unedited) |

## Faults injected

Applied to the real tree one at a time with an exact-string replacement and reverted with `git checkout -- <file>` in a `finally`; `git status --short` after every batch showed only the untracked `node_modules/`. Where the narrowest proof let a mutant live, the whole suite was run before calling it a survivor.

| Mutation | Location | Killed |
| --- | --- | --- |
| legacyLayout: equipment before included | `domain/agreement/layout.ts:72` | yes (C5500, 3 failed) |
| pageHeader condition inverted | `agreement-pdf.tsx:88` | yes (C5507) |
| uppercase ignored | `pdf-sections.tsx:188` | yes (C5516) |
| contractor block also gets the Name line | `contract-pdf.tsx:125` | yes (C5524) |
| typeFrequencies picks the last covering line (M5) | `domain/agreement/document.ts` `typeFrequencies` | yes (only by `components/review/layout.test.ts` C5517; the domain proof C5515 passes) |
| price row may be hidden (M6) | `block-list-editor.tsx:115` | yes (C5543, 2 failed) |
| last row's Down never disabled (M7) | `block-list-editor.tsx:124` | yes (C5542) |
| Insert variable lists 15 names (M8) | `block-list-editor.tsx:176` | yes (C5545) |
| contract preview role gate removed (M9) | `contract/preview/route.ts:26` | yes (C5556, 2 failed) |
| review page draws sections in reverse (M10) | `review-view.tsx` `Content` | yes (C5509, 2 failed) |
| preview debounce 700 to 600 ms (M11) | `template-preview-frame.tsx:8` | yes (C5549, 2 failed) |
| Edit link for every role (M12) | `contract-wording-card.tsx:15` | yes (C5557, 2 failed) |
| contract save action role gate removed (M13) | `contract-actions.ts:17` | yes (C5553, 2 failed) |
| contract layout needs price only (M14) | `domain/contract/layout.ts:59` | yes (C5525, 2 failed) |
| contract sample term start fixed (M15) | `domain/contract/layout.ts:120` | yes (C5531, 2 failed) |
| 42501 mapped to unavailable (M16) | `infrastructure/supabase/contract-wording.ts:8` | yes (C5559) |
| INDENT 16 to 8 (M17) | `pdf-sections.tsx:261` | yes (C5519) |
| letterhead switch inverted (M18) | `document-options-panel.tsx:52` | yes (C5546) |
| "time" and "times" swapped (M19) | `pdf-sections.tsx:73` | yes (C5518) |
| showMeta ignored (M20) | `agreement-pdf.tsx:91` | yes (C5505) |
| item limit 60 to 61 (M21) | `domain/agreement/layout.ts:270` | yes (C5512) |
| contract page role redirect removed (M22) | `contract/page.tsx:20` | yes (C5558, 2 failed) |
| form conversion drops indent 1 (M23) | `domain/agreement/layout-form.ts:100` | no - survives the whole suite (2,581 domain, component, app and application tests) |
| heading page break dropped (M24) | `pdf-sections.tsx:268` | yes (only by contract C5522; agreement C5502 uses a paragraph) |
| contract editor container `xl:` to `lg:` (M25) | `contract-wording-editor.tsx:36` | no - survives the full suite (4,707 tests) |
| agreement preview role gate removed (M32) | `preview/route.ts:32` | yes (C5437, 2 failed) |
| agreement document drops `tenantAddress` (M33) | `domain/agreement/document.ts:162` | no - survives the full suite |
| review page drops `tenantAddress` (M34) | `application/use-cases/portal.ts:86` | no - survives the full suite |
| agreement document drops `termStart` (M35) | `domain/agreement/document.ts:164` | no - survives the full suite |
| option label that fills to nothing is kept (M36) | `domain/agreement/layout.ts:120` | no - survives the full suite |
| type heading ignores the frequency (M37) | `pdf-sections.tsx:199` | yes (C5515, 5 failed) |
| Edit link forced on (M38) | `templates-view.tsx:70` | yes (C5557, 2 failed) |
| signature label limit 120 to 40 (M39) | `domain/agreement/layout.ts:15` | yes (C5525) |
| column label limit 40 to 120 (M40) | `domain/agreement/layout.ts:13` | no - survives 2,581 tests; SQL refuses 41, TS would accept it |
| signature label limit 120 to 200 (M41) | `domain/agreement/layout.ts:15` | no - survives 2,581 tests |
| title limit 120 to 121 (M42) | `domain/agreement/layout.ts:12` | yes (C5512, 2 failed) |
| block limit 40 to 41 (M43) | `domain/agreement/layout.ts:11` | yes (C5512, C5525) |
| contract `schedule` section drawn as nothing (M44) | `contract-pdf.tsx:93` | yes (C5522) |
| contract `included` ignores showFrequency (M45) | `contract-pdf.tsx:104` | no - survives 4,599 tests |
| contract `equipment` ignores its title (M46) | `contract-pdf.tsx:112` | no - survives 4,599 tests |
| contract price drops `columns` (M47) | `contract-pdf.tsx:86` | no - survives 4,599 tests |
| agreement `schedule` ignores its title (M48) | `agreement-pdf.tsx:37` | yes (C5517, 1 failed) |
| SQL-S1: expected version 2 changed to 3 in the SQL test | `supabase/tests/block_editor.sql:197` | yes (`FAIL block_editor: C5528 admin adds version 2: returned 2`) |
| SQL-S2: expected code of the estimator refusal changed to 22023 | `supabase/tests/block_editor.sql:216` | yes (`expected SQLSTATE 22023, got 42501 (not allowed to save contract wording)`) |

44 injected, 33 killed, 11 survived (M23, M25, M33, M34, M35, M36, M40, M41, M45, M46, M47). The SQL objects live on the hosted project and were not mutated; the SQL-S1 and SQL-S2 rows prove the harness fails when an expectation is wrong, and the run against the hosted objects passed.

## Ranked gaps

1. Eleven surviving mutants, each a plausible wrong implementation the suite accepts: M23 the editor loses `indent` 1 on save (the proposal's lettered sub-level), `layout-form.ts:100`, check C5546 `block-editor.test.tsx:294`; M33, M34, M35 the agreement document and review page never pass the contractor address or the term start to the merge values, `document.ts:162-164`, `portal.ts:86-88`, check C5527 (AC 26 "for a contract and for an agreement"); M45, M46, M47 the contract PDF's included, equipment and price options have no assertion, `contract-pdf.tsx:86,104,112`; M40, M41 the 40 and 120 label limits (Landing doors 1 and 5) have no TS case; M36 the empty-label fallback `layout.ts:120`; M25 the contract editor's arrangement.
2. AC 39 contradicted: plan line 135 says narrower than 1280 px needs 44 px controls; C5550 (checks.md:166) and the code give 44 px below 1024 px only, 34 px from 1024 to 1279 px while the screen is stacked (`block-list-editor.tsx:39`, `button.tsx`, `select.tsx`, `text-input.tsx`, `switch.tsx:5`). One of the plan and the check is wrong.
3. Binding enumeration elements with no check and no renderer: the two italic closing lines of the contract (no italic style exists), and the "(Address) Maintenance" line of the proposal header.
4. Schema 1 to schema 2 conversion changes rendered output for a heading with nothing under it: with intro `[paragraph, heading "Childless heading"]`, `renderAgreementLayout(schema 1)` draws `["Hello.","price",...]` and the converted schema 2 body draws `["Hello.","Childless heading","price",...]` (shown with a temporary test, since removed). Cause: `renderBlocks` drops a trailing or doubled heading (`domain/contract/template.ts:162`), `renderLayout` only drops a heading whose clauses all vanished (`layout.ts:141-153`), and the editor opens a schema 1 body from its raw blocks (`layout.ts:81`). It breaks "same rendered output" for a template saved through the editor; sent agreements are unaffected (they print through the schema 1 path).
5. SQL is looser than the TS validators on structure: `private.jsonb_text_between` counts whitespace as text (`migration:27`), the TS `checkText` trims (`layout.ts:177`), so `save_contract_template` through the rpc accepts a block or label of spaces that `validateContractWording` refuses; the contract reader then throws for any contract made from that version (`contracts.ts:86-90`). The size cap differs too (SQL 65,536 bytes, TS 60,000 characters: a multi-byte body TS accepts can raise 22023, which the action reports as "unavailable"). Reachable only by the owner or admin calling the rpc directly.
6. Test of the replaced behaviour is thinner than the retired one: the retired C5433 editor-level test also asserted `aria-invalid` on the price field and "Fix the highlighted fields to refresh the preview."; the replacement (`template-editor.test.tsx:245-252`) asserts the message and no alert only (the frame-level C5433 tests remain at `template-preview-frame.test.tsx:160-190`).
7. Id collision: checks.md:10 says C5439 is the highest id in use; ids C5500-C5515 are already used by the setup-template-preview feature (`components/setup/setup.test.ts:178-193`, `components/setup/starter-templates.test.tsx:71-121`, `app/setup/page.test.ts:95,106`, `domain/contract/starter-preview.test.ts:39-66`). A whole-suite `-t "C5510:"` runs two unrelated tests.
8. Low: the SQL "61 items" cases are not isolated (60 blocks also trip the 40-block rule; a valid layout can never exceed 45 items, so the 60-item limit is unreachable in both languages); `ContractWordingEditor` keeps the "Saved." line after later edits (`contract-wording-editor.tsx:73-77`); the two preview routes read the whole body before applying the 200,000 character cap (`route.ts:28-29`, same as template-flow); C5560's text says the preview route uses the wording use cases, it does not (it builds from `buildContractPreviewDocument`); C5510 and C5526 compare one builder with itself minus the layout fields, so the "as before" guarantee rests on the unedited older tests, which are green.

## Adversarial sweeps

- (a) Old documents print as before. `git diff cbcd91a --numstat` of the existing test files: `agreement-pdf.test.ts` +256/-0, `contract-pdf.test.ts` +163/-3 (the 3 are import lines), `document.test.ts` +66/-1 (import), `contracts.test.ts` +35/-0, `template-form.test.ts` +116/-1 (import). `template.test.ts` C5219 (`:151-186` of the diff): the whitelist test now lists sixteen names and keeps the eleven earlier ones; the full-context test supplies the five new values and keeps `toEqual(expect.any(String))`, `not.toBe("")` and the clause render: every assertion kept. `runner.test.ts` counts 38 to 39 recipes and 40 to 41 files: mechanical. Retired tests: C5349 (three) to C5540 `block-editor.test.tsx:97-141`, C5543 `:176-194`, C5550 `:346-368`: real; C5350 and C5424 (three cases) to C5548 `template-editor.test.tsx:95-120` (the three messages kept verbatim, typed rows, Save re-enabled) and `block-editor.test.tsx:311-325`: real; C5431 to C5549 `template-editor.test.tsx:206-212` (699 ms none, at 700 ms one) and `:218-231` (two changes 300 ms apart, one request at 1,000 ms), the frame-level C5431 timing tests remain at `template-preview-frame.test.tsx:69-95`; C5434 (saved) to `template-editor.test.tsx:197-204`; C5434 (new template, nameless) is covered in pieces by `template-form.test.ts:183-188` and `preview/route.test.ts:108-120`; C5438 to `template-editor.test.tsx:233-243`; C5433 partly (gap 6); C5349 page test to C5547 `[templateId]/page.test.ts:72-81`. C5351, C5422, C5435, C5437 are unedited and green.
- (b) Migration. `save_contract_template`: null user raises 42501 (`:359-361`), owner or admin of the caller's own org only (`:362-365`, `has_org_role(v_org, ['owner','admin'])`), body check before the lock (`:367-370`), per-org advisory lock (`:373`), version number read after the lock (`:378`), `revoke ... from public, anon` and `grant ... to authenticated` (`:383-384`); helpers and `layout_problem` revoked from public, anon, authenticated (`:40-42,171,298,341`). Parity with the TS validators: keys, types, 60 items (unreachable), 40 blocks, 1..2000 text, title 0..120, labels 1..40 and 1..120, level 1..2 heading only, indent 0..3, columns all five, visitsFormat, required `price` (and `signatures` for a contract): equal except the trim and size differences in gap 5; unknown variables are TS-only by design (`migration:9`). `save_agreement_template` is not redefined; only `private.agreement_template_problem` is replaced (`:174-296`) and its schema 1 branch is line for line the earlier one (`20261112240000:220-240` against `:200-205,220-241`), so name uniqueness 23505, 404 and 403 are untouched. No row of any template or version is updated or deleted by the migration. `private.make_contract` (`20261112230000:87-152`) picks the org's own newest contract version, else the system's; contracts made keep `template_version_id` (C5528 `:192,202,203`). `makeContractDocuments` builds the provider's PDF from `contract.template` (`signing.ts:129-133`), now read with `validateContractWording` (`contracts.ts:86-90`).
- (c) PDFs. Fixed header: `<View fixed>{letterhead}</View>` only for `every` (`agreement-pdf.tsx:88`, `contract-pdf.tsx:137`), footer `LetterheadFooter` fixed (`pdf-sections.tsx:291-298`), `break={item.pageBreakBefore}` on headings and paragraphs (`:268,274`), indent 16 pt per level (`:261,265`), frequency by code else name, first covering line (`document.ts` `typeFrequencies`), uppercase after the frequency (`pdf-sections.tsx:187-188`). Name tag only when `nameField === true` and only on the customer block (`contract-pdf.tsx:123,125`), tag `{{Name;role=Customer;type=text}}` (`:18`), four older tags unchanged (`:12-15`). Review page and PDF both walk `portalLayout` / `document.layout` in order (`review-view.tsx:106-200`, C5509).
- (d) Preview routes. Both: 401 unless a member (`route.ts:25`), 403 unless owner or admin (`:26`) before any read; body JSON, capped at 200,000 characters, every field typed by `readLayoutFormState` (`layout-form.ts:160-205`: non-string, wrong enum, non-array, non-object rows each one 422; unknown section keys refused; no prototype keys reach an object); the validator then bounds rows (60) and blocks (40); `buildContractPreviewDocument(body, settings, logo, today(clock.now()), words)` takes today as a string (`route.ts:44`); variables are filled once and values are never re-read (`fillVariables`); no store is called (`noWrites()` in the tests).
- (e) Editor. Hide and Remove absent for price and (contract) signatures, boundaries, sixteen names: proven (C5542-C5545). A schema 1 template opens and saves as schema 2 with the same layout rows (C5547) but not always the same rendered output (gap 4). The old text form pair (`bodyFromTemplateForm`, `templateFormFromBody`) and C5351, C5422, C5435, C5437 are unedited and green.
- (f) Contract path: see (b).
- (g) Plan Flow 1-6, Impact, Landing rows 1-8 against the code: all present (`layoutOf`, `contractLayoutOf`, `portalLayout`, `ServiceIncludedSection` and `ServiceEquipmentSection` with `ServiceScopeSections` still drawing both, `PriceSection` with title, columns and visits format, the `heading` option for schema 1 signatures, flat form rows, the action and route reading both forms). Rows 5 and 6 match the code (`layout.ts:15`, `pdf-sections.tsx:187`).
- (h) Anything else: gaps 3-8 above. The `agreement_templates`, `contract_templates` and `plan_limits` recipes stay green.

## Gate

- `npx vitest run <20 files> -t "C55(...):" --reporter=verbose` (PowerShell): 20 files passed, 206 passed, 0 failed.
- `npm test` (full): 310 files passed, 5,148 tests passed, 0 failed.
- `npm run test:db block_editor`: PASS, 1 passed, 0 failed. `npm run test:db agreement_templates contract_templates plan_limits`: 3 passed, 0 failed.
- `npx tsc --noEmit -p .`: only the known errors (`.next/types/validator.ts` twice, `app/setup/draft-actions.test.ts:62,104`).
- `npx eslint` over the changed `.ts`, `.tsx` and `.mts` files: 0 errors, 1 warning (`composition/signing-wiring.test.ts:11`, a file this feature did not touch).
- Tree: `git status --short` after every fault batch and at the end shows only `?? node_modules/` apart from this file.

Verdict reasons, in order: surviving mutants (gap 1), AC 39 versus C5550 (gap 2), binding enumeration elements without a check (gap 3).
