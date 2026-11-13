# Block editor and document layout verification

**Verdict**: PASS
**Profile**: ui
**Diff range**: cbcd91a..HEAD (HEAD 5c8f5bc)
**Round**: 2 - scoped (round 1 is kept in `verification-round1.md`, verified at 5b9fe4c)
**Verifier**: independent sub-agent (author != verifier)

Scope of this round: the fix diff 5b9fe4c..5c8f5bc (tests only in `web/`, plus plan AC 39 and the checks.md binding text) and every verdict that was not PASS in round 1. Proofs were re-run in full at the new HEAD. Sections that the fix could not touch are marked `carried from 5b9fe4c`. This report does not claim approval; the orchestrator runs the gate script.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| PROPOSAL.pdf and contract.pdf (not on disk) via checks.md `## Binding sources` (lines 18-25) and plan Problem | yes - the enumeration, re-read at HEAD after commit 721027a; per-element trace carried from 5b9fe4c except the two rows below | none | - |
| the contract's two italic closing lines and the proposal's "(Address) Maintenance" header line | yes - now named as deliberate differences in checks.md (the `Deliberate differences` paragraph and the Contract bullet), with a handoff line saying they are reported at delivery | none (a documented decision, not a contradiction; the code still has no italic style and no header note field, as stated) | - |
| plan S4 / AC 39 against C5550 and the code | yes - plan line 135 now reads: stack below 1280 px, every control 44 px high below 1024 px (`lg`); C5550 (checks.md line 166) says "44 px below lg"; code `ROW_BUTTON = "min-h-11 lg:min-h-0"` (`block-list-editor.tsx:39`), `h-11 ... lg:h-[34px]` in `button.tsx`, `select.tsx`, `text-input.tsx`, `lg:min-h-9` in `switch.tsx:5` | none - the three now agree | - |

Screen enumeration for the two editors, carried from 5b9fe4c with these changes: the contract wording editor's arrangement (column below xl, two tracks from xl, form region before preview, no `lg`/`md`/`sm` grid) and its 44 px row controls are now asserted at `contract-wording-editor.test.tsx:62` and `:75` and by mutants M25 and M49 below.

## Checks

Proofs run at HEAD from PowerShell in one invocation over the 31 touched and related files with `-t "C55(0[0-9]|1[0-9]|2[0-9]|3[01]|4[0-9]|5[0-9]|60):"`: 24 files passed (7 skipped by the filter), 226 passed, 0 failed; every one of the 53 ids appears in the verbose output (the check on the output file found none missing). SQL ids by `npm run test:db block_editor`: PASS. Checks the fix could not touch are `carried from 5b9fe4c` (evidence in `verification-round1.md`, re-run green now). The re-judged ones are verified at 5c8f5bc.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5500 | layoutOf schema 1, four combinations | `layout.test.ts -t C5500:` green | carried from 5b9fe4c: `domain/agreement/layout.test.ts:37` `expect(layout).toEqual([...intro, ...middle, ...closing])` | PASS |
| C5501 | layoutOf schema 2 as stored | green | carried: `layout.test.ts:95` | PASS |
| C5502 | items in order, page break | green | carried: `infrastructure/documents/agreement-pdf.test.ts:489` `pages[1].split("\n")[0]` is "Starts the next page." | PASS |
| C5503 | absent sections, price once | green | carried: `agreement-pdf.test.ts:495` | PASS |
| C5504 | included before price | green | carried: `agreement-pdf.test.ts:519` | PASS |
| C5505 | showMeta | green | carried: `agreement-pdf.test.ts:527-530` | PASS |
| C5506 | title with variables | green | carried: `domain/agreement/document.test.ts:281`, `agreement-pdf.test.ts:535` | PASS |
| C5507 | pageHeader every | green | carried: `agreement-pdf.test.ts:545` | PASS |
| C5508 | pageFooter letterhead | green | carried: `agreement-pdf.test.ts:556,560` | PASS |
| C5509 | review page same items and order | green | carried: `components/review/layout.test.ts:43-62` | PASS |
| C5510 | schema 1 prints as before | green | carried: `agreement-pdf.test.ts:581`; older agreement-pdf assertions intact | PASS |
| C5511 | sent version frozen | green | carried: `document.test.ts:290` | PASS |
| C5512 | fourteen schema 2 refusals, plus new label limit | green | `domain/agreement/layout.test.ts:159` `reasonOf(input)` toContain; new `:182` `reasonOf(price("x".repeat(41)))` toContain "column label of item 1 is too long (41 characters, at most 40)" and 40 accepted | PASS |
| C5513 | save_agreement_template schema 1 and 2 | `npm run test:db block_editor` PASS | carried: `supabase/tests/block_editor.sql:93,102,115,117,119,126,128` | PASS |
| C5514 | 22023 for invalid schema 2 bodies | same | carried: `block_editor.sql:166` | PASS |
| C5515 | frequency labels and derivation | green | carried: `document.test.ts:297,301`, `agreement-pdf.test.ts:587-591`; first-line rule also killed at `components/review/layout.test.ts:95` | PASS |
| C5516 | uppercase headings | green | carried: `agreement-pdf.test.ts:597-598` | PASS |
| C5517 | title options, and a title that fills to nothing | green | carried: `agreement-pdf.test.ts:616-619`; new `domain/agreement/layout.test.ts:212` `layout?.[0]` toEqual `{ kind: "section", key: "price", options: {} }` and a filled title kept | PASS |
| C5518 | price columns, visitsFormat | green | carried: `agreement-pdf.test.ts:626-629` | PASS |
| C5519 | indent and level styles | green | carried: `agreement-pdf.test.ts:646,648-649` | PASS |
| C5520 | empty option objects | green | carried: `agreement-pdf.test.ts:670` | PASS |
| C5521 | contractLayoutOf | green | carried: `domain/contract/layout.test.ts:23-34` | PASS |
| C5522 | contract PDF order and options | green | `contract-pdf.test.ts:313-335` (carried); new `:362` `asked` contains "Rooftop unit (QUARTERLY)", `upper` contains "ROOFTOP UNIT (QUARTERLY)", `titled` contains "Service included:"; `:379` `titled` contains "EQUIPMENT LIST" and not "Equipment"; `:387` rows contain the four labels, "TOTAL $3,690.00", "4 times per year", "2 times per year" | PASS |
| C5523 | signatures block | green | carried: `contract-pdf.test.ts:365-374,385,388` | PASS |
| C5524 | nameField adds Name line and tag | green | carried: `contract-pdf.test.ts:401,404-405` | PASS |
| C5525 | contract refusals, plus label limits | green | carried `domain/contract/layout.test.ts:106,127`; new `:109` customer label, contractor label and caption of 120 accepted, 121 each refused with "is too long (121 characters, at most 120)", set size 3; `:118` column label 41 refused, 40 accepted | PASS |
| C5526 | old contracts print the same | green | carried: `contract-pdf.test.ts:439` | PASS |
| C5527 | five variables for contract and agreement | green | `domain/contract/template.test.ts:216-257` (carried); new `domain/agreement/document.test.ts:286` `text(buildAgreementDocument(source, SETTINGS, template))` toBe "100 Sample Street, Burnaby, BC, 604-555-0100, November 13, 2026 and GST extra joined by separators"; `agreement-pdf.test.ts:542` PDF contains "Write to 100 Sample Street, Burnaby, BC.", "Call 604-555-0100 to reach us.", "Starting November 13, 2026."; `components/review/layout.test.ts:66` the page shows the same three texts and no "{{" | PASS |
| C5528 | save_contract_template versions | SQL PASS | carried: `block_editor.sql:187,192,197,202,203` | PASS |
| C5529 | 42501 and 22023 | SQL PASS | carried: `block_editor.sql:216,220,243,245` | PASS |
| C5530 | contract reader | green | carried: `infrastructure/supabase/contracts.test.ts:289-300` | PASS |
| C5531 | buildContractPreviewDocument | green | carried: `domain/contract/layout.test.ts:168-192` | PASS |
| C5540 | editor regions and rows | green | carried: `components/templates/block-editor.test.tsx:108-140` | PASS |
| C5541 | Add block | green | carried: `block-editor.test.tsx:148` | PASS |
| C5542 | Up/Down | green | carried: `block-editor.test.tsx:163-171` | PASS |
| C5543 | Remove, Hide | green | carried: `block-editor.test.tsx:181-191` | PASS |
| C5544 | Show appends | green | carried: `block-editor.test.tsx:204-217` | PASS |
| C5545 | Insert variable | green | carried: `block-editor.test.tsx:226,236` | PASS |
| C5546 | section and block options reach the body | green | `block-editor.test.tsx:263,273-288` (carried); new `:300` for indent 0, 1, 2, 3 and level 1, 2 `expect(body()[1]).toEqual({ kind: "block", type: "paragraph", text: "Welcome.", ...(indent > 0 ? { indent } : {}) })` and `:312` the same through the contract wording's saved body | PASS |
| C5547 | schema 1 opens and saves as schema 2 | green | carried: `domain/agreement/template-form.test.ts:109,129,152` | PASS |
| C5548 | validation failure keeps editor open | green | carried: `block-editor.test.tsx:316-325`, `template-editor.test.tsx:100-110`; restored: `template-editor.test.tsx:245` price field `aria-invalid` is not "true" before and "true" after typing "lots", the text "Fix the highlighted fields to refresh the preview." appears, `calls` still length 1 | PASS |
| C5549 | preview once, 700 ms after the last change | green | carried: `template-editor.test.tsx:207-231` | PASS |
| C5550 | column below 1280 px, two tracks from xl, 44 px below lg | green | `block-editor.test.tsx:384-391` (agreement editor); new `contract-wording-editor.test.tsx:62` classes `flex-col`, `xl:grid`, `xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`, no `lg:grid`, `md:grid` or `sm:grid`, children[0] "Contract wording form", children[1] "Preview"; `:75` every row button `min-h-11`, every row field `h-11`; plan, check and code now agree on 44 px below 1024 px | PASS |
| C5551 | duplicate carries layout | green | carried: `application/use-cases/templates.test.ts:57` | PASS |
| C5552 | /templates/contract shows the wording | green | carried: `app/(app)/templates/contract/page.test.ts:49-65` | PASS |
| C5553 | save action | green | carried: `contract/contract-actions.test.ts:31-42` | PASS |
| C5554 | invalid values on rows | green | carried: `contract-actions.test.ts:75-79` | PASS |
| C5555 | preview route 200 | green | carried: `contract/preview/route.test.ts:75-92` | PASS |
| C5556 | 401, 403, 422, 503 | green | carried: `route.test.ts:122,132,143,162` | PASS |
| C5557 | Contract wording card | green | carried: `components/templates/templates-view.test.tsx:154-176` | PASS |
| C5558 | redirects and loading screen | green | carried: `page.test.ts:76,82,89-90` | PASS |
| C5559 | wording store | green | carried: `infrastructure/supabase/contract-wording.test.ts:28,57,66` | PASS |
| C5560 | container wiring | green | carried: `composition/block-editor-wiring.test.ts:36,45` | PASS |

## Coverage

Round 1's coverage table recomputed for the rows the fix touched; every other row is carried from 5b9fe4c (all of its members stay proven).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| section options of the contract PDF (price columns and visitsFormat, included showFrequency and uppercase and title, equipment title) | AC 35, plan Impact (one adapter draws both) | C5522 `contract-pdf.test.ts:362,379,387`; mutants M45, M46, M47 killed | - |
| block fields (3: level, indent, pageBreakBefore) through the editor | Landing door 1 | indent 0-3 and level 1-2 C5546 `block-editor.test.tsx:300,312`; pageBreakBefore C5546 `:297` (carried); mutant M23 killed | - |
| merge variables added (5), agreement side | door 3, AC 26 | document builder C5527 `document.test.ts:286`, PDF `agreement-pdf.test.ts:542`, review page `layout.test.ts:66`; `signer.name` is no value for an agreement (C5527 domain test, carried); mutants M33, M34, M35 killed | - |
| label limits (column 40, signature 120, title 120) | Landing doors 1 and 5 | C5512 `layout.test.ts:182`, C5525 `domain/contract/layout.test.ts:109,118`, title 121 (carried); mutants M40, M41 killed | - |
| empty-label fallback of section options | `layout.ts:120` | C5517 `domain/agreement/layout.test.ts:212`; mutant M36 killed | - |
| editor arrangement and control height, both editors | AC 39 as now written | agreement C5550 `block-editor.test.tsx:384-391`; contract editor `contract-wording-editor.test.tsx:62,75`; mutants M25, M49 killed | - |
| every other set of round 1 (agreement and contract sections, document options, frequency labels, refusal reasons, statuses, roles, editor row controls, routes, ways a body is read) | plan Surface, Landing, Criteria | carried from 5b9fe4c | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `20261113100000_block_editor.sql`, both preview routes, both save actions | SQL as the role; handlers with doubles | yes - unchanged and green (SQL run now also green with the three older recipes) |
| Decides, not reached across a boundary | `layout.ts`, `layout-form.ts`, `document.ts`, `contract/layout.ts` | own layer test per branch and member | yes - indent 1 through the form (M23), both label limits (M40, M41), the empty-label fallback (M36) and the agreement address, phone and term start (M33-M35) are now each asserted and each mutant killed |
| Screens and documents | both editors, the contract and agreement PDFs, the review page, the Templates card | one render test per region, one PDF-text test per option, structure and classes | yes - contract PDF options (M45-M47) and the contract editor arrangement and 44 px (M25, M49) are asserted; AC 39, C5550 and the code agree; the two binding differences are documented decisions |
| Instrumentation | composition wiring, loading screens, schema 1 pass-through | one proof each | yes - C5560, C5558, C5510, C5520, C5526 green |

## Faults injected

Round 2 re-injected every round 1 survivor on the real tree against the full suite (4,722 tests each), one at a time, each reverted with `git checkout -- <file>`; `git status --short` afterwards showed only the untracked `verification-round1.md`, `node_modules/` and this file. Round 1's 33 other kills are carried from 5b9fe4c (their production code did not change in the fix round).

| Mutation | Location | Killed |
| --- | --- | --- |
| form conversion drops indent 1 (M23) | `domain/agreement/layout-form.ts:100` | yes (C5546 `block-editor.test.tsx:300`, 2 failed) |
| contract editor container `xl:` to `lg:` (M25) | `components/templates/contract-wording-editor.tsx:36` | yes (C5550 `contract-wording-editor.test.tsx:62`) |
| agreement document drops `tenantAddress` (M33) | `domain/agreement/document.ts:162` | yes (C5527 `document.test.ts:286` and `agreement-pdf.test.ts:542`) |
| review page drops `tenantAddress` (M34) | `application/use-cases/portal.ts:86` | yes (C5527 `components/review/layout.test.ts:66`) |
| agreement document drops `termStart` (M35) | `domain/agreement/document.ts:164` | yes (C5527, 3 failed across review, document and PDF tests) |
| option label that fills to nothing kept (M36) | `domain/agreement/layout.ts:120` | yes (C5517 `layout.test.ts:212`) |
| column label limit 40 to 120 (M40) | `domain/agreement/layout.ts:13` | yes (C5512 `layout.test.ts:182`, C5525 `domain/contract/layout.test.ts:118`) |
| signature label limit 120 to 200 (M41) | `domain/agreement/layout.ts:15` | yes (C5525 `domain/contract/layout.test.ts:109`) |
| contract `included` ignores showFrequency (M45) | `infrastructure/documents/contract-pdf.tsx:104` | yes (C5522 `contract-pdf.test.ts:362`) |
| contract `equipment` ignores its title (M46) | `contract-pdf.tsx:112` | yes (C5522 `contract-pdf.test.ts:379`) |
| contract price drops `columns` (M47) | `contract-pdf.tsx:86` | yes (C5522 `contract-pdf.test.ts:387`) |
| row buttons lose `min-h-11` (M49, new) | `components/templates/block-list-editor.tsx:39` | yes (C5550 in both editors, 2 failed) |

12 re-injected, 12 killed, none survived. Round 1: 44 injected, 33 killed, 11 survived; those 11 are the first 11 rows above.

## Re-judgment of round 1 findings

- AC 39 versus C5550: closed. Plan, check and code all say 44 px below 1024 px, stacked below 1280 px.
- Italic closing lines and "(Address) Maintenance": accepted as documented deliberate differences (checks.md `Deliberate differences`). They are decisions the owner should see in the delivery report; the proposal's repeating header line is the larger of the two.
- Contract editor arrangement and the retired C5433 aria-invalid assertion: closed by the new C5550 and C5548 tests.
- Accepted lows, judged again: none of them should fail the feature. The childless-heading difference (a heading with nothing under it prints after a schema 1 template is saved through the editor, where schema 1 dropped it) is the only one that changes what a customer sees, and only for a template the owner edits and saves; sent agreements keep printing through the schema 1 path. It should be listed in the delivery report. The SQL whitespace and size looseness is reachable only by an owner or admin calling the rpc directly; the id collision, the non-isolated "61 items" SQL case, the stale "Saved." line, the body read before the cap, C5560's wording and the C5510/C5526 self-comparison do not hide a defect.

## Gate

- `npx vitest run <31 files> -t "C55(...):" --reporter=verbose` (PowerShell): 24 files passed, 226 passed, 0 failed, all 53 ids present.
- `npm test` (full): 310 files passed, 5,163 tests passed, 0 failed.
- `npm run test:db block_editor agreement_templates contract_templates plan_limits`: 4 passed, 0 failed.
- `npx tsc --noEmit -p .`: only the known errors (`.next/types/validator.ts` twice, `app/setup/draft-actions.test.ts:62,104`).
- `npx eslint` over the changed `.ts`, `.tsx` and `.mts` files: no output (clean).
- Tree: after every mutant `git status --short` shows only untracked files (`verification-round1.md`, `node_modules/`) and this report.
