# Block editor

## Problem

Phase 5.5 item 3 asks for a block editor with a live PDF preview, plus clone. What exists is half of it: a form editor for agreement templates with the live PDF beside it, Duplicate and Archive. Three things are missing, and the owner hit the first one directly when asked to reproduce a real proposal (the Enviroware PDF):

1. **The layout is not the tenant's.** Intro and closing text are two text areas using a `# ` / `- ` line convention, and the sections of an agreement are drawn in one fixed order (title, intro, price, visit schedule, service included, equipment, terms, closing). The Enviroware proposal puts the service-included list before the price table and has no visit schedule or terms block; the editor can hide the schedule and the scope but cannot move anything. The ROADMAP says the tenant can "move or hide" system blocks except the price table and the signature block.
2. **It is not a block editor.** A member cannot add, reorder or delete a heading, paragraph or clause as a block, or insert a merge variable without typing `{{...}}` by hand.
3. **The contract wording has no editor.** The six sentences became data on 2026-11-12 (contract-templates), but no screen edits them and nothing can save an org's own contract template, so every tenant still signs the system wording. The legal review of those sentences blocks go-live (decision 14); an editor is how a tenant's lawyer's wording gets in.

Evidence the source gives: the ROADMAP line and decisions 12 and 14, the owner's request to reproduce the Enviroware proposal (the PDF attached on 2026-11-13: schedule, then service included, then the price charge, then the equipment list, with a repeated page header), and the limits found while building that template (the section order is fixed, the equipment list cannot sit after the price).

When this ships, an owner or admin edits an agreement template as a list of blocks and sections they can add, reorder, show and hide, with the real agreement PDF refreshing beside it, and edits the contract wording the same way with the contract PDF beside it; Duplicate keeps working on the richer templates.

## Flow

Reuses `document_templates` and immutable `document_template_versions`, the merge-variable whitelist and `renderBlocks` (contract-templates), `save_agreement_template`'s pattern (definer, owner and admin, body check, advisory lock), the live preview frame and `POST /templates/preview` (template-flow), and `buildAgreementDocument` as the one seam for the PDF, the review page and the staff preview, instead of a second editor, a second renderer or a second preview.

1. Editor change -> `BlockListEditor` (new, no door - placement) edits an ordered `layout` list in the form state -> `bodyFromTemplateForm` (exists, extended) -> `validateAgreementTemplate` (exists, extended to schema 2) -> after 700 ms `POST /templates/preview` (exists) -> `buildTemplatePreviewDocument` (exists) -> `buildAgreementDocument` (exists, extended: `layout` instead of `intro`, `footer` and `sections`) -> `agreement-pdf.tsx` (exists, extended) draws the document's items in layout order.
2. Save -> `saveAgreementTemplateAction` (exists) -> `public.save_agreement_template` (exists, extended: accepts schema 1 and schema 2 bodies, new saves are schema 2) -> a new immutable version (door 1).
3. Reading an old version: `layoutOf(body)` (new, no door) turns a schema 1 body into the same ordered layout it always drew (intro blocks, price, visit schedule, service included, equipment, terms, closing blocks), so every sent agreement prints as it did.
4. Review page and portal: `portal_view` (exists, unchanged) returns the pinned body -> `portalTemplateText` and `review-view.tsx` (exist, extended) draw sections in layout order.
5. Contract wording: owner or admin opens `/templates/contract` (new route) -> `ContractWordingEditor` (new, no door) reuses `BlockListEditor` for the contract's blocks -> `saveContractWordingAction` (new) -> `validateBlocks` (exists) -> `public.save_contract_template` (new, door 2) inserts the org's contract template on first save and a next version after -> `private.make_contract` (exists, unchanged) already picks the org's own latest version for new contracts.
6. Contract preview: `POST /templates/contract/preview` (new route handler) -> `buildContractPreviewDocument` (new, no door) -> `buildContractDocument` (exists) -> `reactPdfContractRenderer` (exists) -> `application/pdf` in the same `TemplatePreviewFrame` (exists, parameterised by its URL).

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: layout - the ordered list of items an agreement draws between its title block and its page footer: text blocks (heading, paragraph, clause) and system sections |
| domain | new term: system section - one of `price`, `schedule`, `included`, `equipment`, `terms`. `price` can be moved but never hidden or removed; the others can be moved, hidden and shown |
| domain | existing term: `AgreementTemplateBody` (`intro`, `footer`, `sections: { schedule, scope }`) - schema 1 keeps meaning what it meant (the layout fixed by code) and is read through `layoutOf`; schema 2 stores the layout. Who branches on `intro`, `footer` or `sections` today: `domain/agreement/document.ts`, `domain/agreement/template.ts`, `domain/agreement/template-form.ts`, `domain/agreement/template-preview.ts`, `infrastructure/documents/agreement-pdf.tsx`, `application/use-cases/portal.ts` (`portalTemplateText`), `components/review/review-view.tsx`, `components/templates/template-editor.tsx`, `components/templates/template-preview.tsx` and `template-card.tsx` (section and clause counts), `private.agreement_template_problem` in SQL |
| existing callers | `ScopeSections` in `pdf-sections.tsx` draws service included and equipment in one function; it becomes two so each can sit and hide on its own |
| existing callers | `save_agreement_template` accepts both schemas; the system template and every saved version stay schema 1 and are never rewritten |
| stored data | nothing to migrate: old versions are immutable and are read through `layoutOf`; new saves are schema 2. One new function and no table change |

## Relations

None - no stored-data shape change. The contract wording uses the existing `document_templates` (kind `contract`, one per org) and `document_template_versions`.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /templates/contract` | session | the contract wording editor with a loading screen | 200, 302 to `/login`, 302 to `/templates` |
| `POST /templates/contract/preview` | JSON: the editor's blocks | `application/pdf` bytes | 200, 401, 403, 422 with `{ errors: [{ field, message }] }`, 503 |
| `rpc save_contract_template(p_body)` | contract body | the template id and version number | 200, 403 `42501`, 422 `22023` |
| `rpc save_agreement_template(p_template_id, p_body)` | template id or null, schema 1 or 2 body | the template id and version number | 200, 403 `42501`, 404 `P0002`, 409 `23505`, 422 `22023` (unchanged statuses) |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. The agreement body, schema 2 | `{ "schema": 2, "name", "description", "layout": [ { "kind": "block", "type": "heading" or "paragraph" or "clause", "text": "..." } or { "kind": "section", "key": "price" or "schedule" or "included" or "equipment" or "terms" } ], "preset": { "termMonths", "lines": [...] } }`; `layout` has at most 40 items, at most 30 of them blocks, each section key at most once and `price` exactly once; a text is 1 to 2,000 characters; schema 1 stays valid and unchanged | Add `order` arrays beside `intro` and `footer`: cannot say that a block sits between the price table and the schedule. Rewrite schema 1 versions in place: breaks immutability and the freeze of every sent agreement. Hide-flags only: cannot reproduce the proposal where service included comes before the price |
| 2. Saving contract wording | `public.save_contract_template(p_body jsonb) returns table (template_id uuid, version_no integer)`, `security definer`, `set search_path = ''`, owner and admin only, kind fixed to `contract`, creates the caller's org's contract template on first call and the next version after, validates `{ "schema": 1, "blocks": [...] }` structurally in SQL (types, 60 blocks, 2,000 characters), under the per-org advisory lock | Direct writes with an RLS policy: a policy cannot number versions or check the body. One shared save for both kinds: the two bodies differ and a shared function would carry both validations |

- A contract wording text uses the same merge-variable whitelist as today; an unknown variable is refused by `validateBlocks` on save and renders as no value
- Nothing else in this change is hard to reverse

## Criteria

### S1: The agreement layout is the tenant's (P1)

An agreement's items come in the order the template says, and a section can be hidden.

**Acceptance Criteria**

1. WHEN `layoutOf` reads a schema 1 body THEN it SHALL return, in order, the intro blocks, `price`, `schedule` (only when the body shows it), `included` and `equipment` (only when the body shows the scope), `terms`, then the closing blocks
2. WHEN a schema 2 body is read THEN `layoutOf` SHALL return its `layout` as stored
3. WHEN the agreement PDF is drawn THEN after the title block it SHALL draw the layout items in order: a block as heading, paragraph or clause text, a section as its own section, and the page footer last
4. IF a section is absent from the layout THEN the PDF SHALL NOT draw it, and the price table SHALL always be drawn exactly once
5. WHEN the layout places `included` before `price` THEN the PDF text SHALL show "Service included" before "Service and price"
6. WHEN the customer's review page is drawn THEN it SHALL draw the same items in the same order as the PDF for that version
7. WHEN an existing agreement pinned to a schema 1 version or to no template is drawn THEN its PDF and review page SHALL print exactly what they print today
8. WHERE an agreement version was sent THEN its layout SHALL come only from its frozen pin, never from today's template versions
9. WHEN a body is validated THEN `validateAgreementTemplate` SHALL accept a schema 2 body and refuse one with an unknown item kind, an unknown section key, a repeated section, a missing or repeated `price`, more than 40 items, more than 30 blocks, a text over 2,000 characters or an unknown variable, each with its own message
10. WHEN a body is saved THEN `save_agreement_template` SHALL accept a schema 1 or schema 2 body, SHALL raise `22023` for a schema 2 body the same rules refuse, and SHALL leave every earlier version unchanged

**Independent test:** save a schema 2 template with the equipment list after the price table and read the PDF text order.

### S2: The block editor (P1)

The editor edits the layout as a list.

**Acceptance Criteria**

11. WHEN the editor opens THEN it SHALL show the layout as a list of rows in order, each block row with its type and its text and each section row with its name
12. WHEN a member adds a block THEN the editor SHALL offer Heading, Paragraph and Clause and append a new empty row of that type
13. WHEN a member moves a row up or down THEN it SHALL swap places with its neighbour, the first row's Up and the last row's Down SHALL be disabled, and the order SHALL be what is saved
14. WHEN a member removes a block row THEN the row SHALL go; and WHEN a member turns a section off THEN it SHALL leave the layout, while the `price` row SHALL have no Remove and no switch
15. WHEN a member turns a hidden section on THEN it SHALL be added at the end of the layout, and WHEN a section is on THEN its row SHALL show it with a Hide control
16. WHEN a member chooses a merge variable from the Insert variable control of a text row THEN `{{name}}` SHALL be inserted at the cursor of that row's text and the control SHALL list exactly the whitelisted variables
17. WHEN a template saved as schema 1 is opened THEN the editor SHALL show its `layoutOf` rows, and WHEN it is saved THEN a schema 2 version SHALL be written
18. WHEN a field fails validation THEN the editor SHALL stay open with that row's message beside the row and keep every typed value, as it does today
19. WHEN the layout changes THEN the live PDF SHALL refresh as it does for any change (700 ms, one request at a time)
20. WHERE the screen is narrower than 1280 px THEN the rows SHALL stack with the preview below, every control SHALL be at least 44 px high, and nothing SHALL depend on hover or drag
21. WHEN a template is duplicated THEN the copy SHALL carry the layout of the latest version (schema 1 or 2) and be named as today

**Independent test:** open `/templates/new`, add a heading and a clause, move the equipment section above the price table and watch the PDF follow.

### S3: The contract wording editor (P1)

**Acceptance Criteria**

22. WHEN an owner or admin opens `/templates/contract` THEN the page SHALL show the contract blocks of the org's own contract template, or of the system wording while the org has none, as an editable list with the contract PDF preview beside it
23. WHEN the member saves THEN `save_contract_template` SHALL create the org's contract template on the first save and a new version on every later one, and new contracts SHALL use the latest version while contracts already made keep the version they carry
24. WHEN the blocks fail validation (an unknown variable, 61 blocks, a text over 2,000 characters, an empty text) THEN the editor SHALL show each row's message, keep what was typed and save nothing
25. IF an estimator, a viewer or a non-member calls `save_contract_template` THEN it SHALL raise `42501` and write nothing; and IF the body is not `schema` 1 with a list of valid blocks THEN it SHALL raise `22023`
26. WHEN `POST /templates/contract/preview` receives valid blocks from an owner or admin THEN it SHALL answer a contract PDF built with `buildContractDocument` from the posted blocks and sample data (customer "Sample Customer Ltd.", site "Sample Site", number "AG-0000", the org's letterhead and logo, today's terms) and write nothing
27. IF the caller is signed out THEN the route SHALL answer 401; if not an owner or admin 403; if the blocks are invalid 422 with the field errors; if rendering fails 503
28. WHEN the Templates screen is drawn THEN below the agreement templates it SHALL show a Contract wording card with the name of the wording in use ("Standard contract wording" or "Your contract wording") and, to an owner or admin, an Edit (or Customize, while the org has none) link to `/templates/contract`; an estimator and a viewer see the card without the link
29. WHEN `/templates/contract` is requested THEN it SHALL redirect an estimator and a viewer to `/templates`, and a signed-out visitor to `/login`, and SHALL have a loading screen titled "Contract wording"

**Independent test:** as the owner open Contract wording, change a sentence, save, and read the contract PDF of a new contract.

## Out of scope

| Excluded | Why |
| --- | --- |
| Click-on-the-page editing and drag-and-drop | The owner chose the live PDF beside the editor; reorder is by Up and Down buttons, which work by touch and keyboard |
| Hiding or moving the title block, the page footer and the signatures | The ROADMAP keeps the price table and the signature block fixed; the title block and page footer are the letterhead |
| A repeating page header like the proposal's "(Address) Maintenance" line | A separate layout feature |
| Cloning the contract wording | An org has one; there is nothing to pick between |
| Resetting contract wording to the system wording | Editing back is possible; a reset can follow with archive semantics |
| Starter wording per trade and province, legally reviewed | Phase 5.5 item 4 and decision 14 |
| Upload an existing contract | Phase 5.5 item 5 |
| Rewriting existing schema 1 versions | Versions are immutable and frozen into sent agreements |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Which sections can be hidden | `schedule`, `included`, `equipment` and `terms`; `price` cannot | The ROADMAP keeps the price table; terms are the org's own and a proposal may not print them (the Enviroware proposal prints none) | n |
| Can the price table move | Yes, but not hide | The real proposal prints service included before the price | n |
| Where a section turned back on goes | At the end of the layout | Predictable; the member then moves it | n |
| Merge variable insertion | A select beside each text row that inserts `{{name}}` at the cursor | The whitelist is fixed and typed names are error-prone | n |
| New agreement templates start from | The Standard layout: price, schedule, included, equipment, terms, no text blocks | The same order every agreement has today | n |
| Existing template default layout | A schema 1 body opens as its `layoutOf` rows | Nothing changes until the member saves | n |
| Block text length | 1 to 2,000 characters, as today | One limit for both editors | n |
| Profile | `ui` (project floor); no screenshot binds this feature, so the checks enumerate the editor structure from this plan | Same as template-flow | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen agreement template editor | empty state | AC 11 (a new template shows the Standard layout) |
| screen agreement template editor | loading, error, unauthorised | existing - loading screens, field messages (AC 18), redirects of template-flow |
| screen agreement template editor | density and ordering, arrangement | AC 11, AC 13, AC 20 |
| screen agreement template editor | destructive action confirms | n/a - removing a block row is undone by adding it again and nothing is saved until Save |
| screen contract wording editor | empty state | AC 22 (the system wording while the org has none) |
| screen contract wording editor | loading | AC 29 |
| screen contract wording editor | error state | AC 24 |
| screen contract wording editor | unauthorised | AC 29 |
| screen Templates, Contract wording card | density and ordering, unauthorised | AC 28 |
| api `POST /templates/contract/preview` | error shape and codes, who may call | AC 27 |
| api `POST /templates/contract/preview` | versioning, rate limits | n/a - consumed only by this app's editor; the product has no rate limiter (template-flow Out of scope) |
| rpc `save_contract_template` | response shape, error shape, who may call | Surface row; AC 25 |
| document the agreement PDF | structure, ordering, next step for the reader | AC 3, AC 4, AC 5 (the reader's next step, Accept or Refuse, is the unchanged review page) |
| document the contract PDF | structure, ordering | AC 26 and the contract-templates ordering checks |

## Sources

- ROADMAP Phase 5.5 item 3, "Document templates" section, decisions 12 and 14 - the block editor, the live preview, clone, and the rule that the price table and the signature block stay
- The owner's proposal PDF (Enviroware, 2026-11-13) - the order of schedule, service included, price and equipment list that the fixed layout cannot reproduce
- `.specs/features/contract-templates/`, `.specs/features/agreement-templates/`, `.specs/features/template-flow/` - the tables, body shape, save functions, editor and preview this builds on
