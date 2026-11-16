# Upload an existing contract

Roadmap Phase 5.5 last item: "Upload an existing contract and let Claude split it into blocks and variables" (decision 15: after the editor ships; the block editor shipped 2026-11-13). Contract wording only. The agreement template and the starter wording per pack (Phase 5.5 item 4, which waits on a lawyer) stay separate items. One feature at a time (decision 22).

## Problem

A contractor who already has a signed-off service contract in Word or PDF has to retype it into the Contract wording editor, one block at a time, before the product will produce a contract in their words. The editor opens on the system wording (six sentences), so a tenant who wants their own clauses types every clause, picks its kind and places the merge variables by hand. The roadmap gives no count of tenants with existing contracts and no measure of editing time, so none is claimed here. The cost lands on the buyer in the first week: the contract is the step before revenue, and the product asks them to do clerical work to reach it.

When this ships, an owner or admin on the Contract wording page can attach their existing contract (docx or pdf), read it back as editable blocks with the party names already turned into merge variables, fix what is wrong in the editor they already know, and save it as their next wording version.

## Flow

Reuses `ImportParser` (docx to text, pdf as bytes), the Claude SDK wiring and structured-output pattern of `claudeCatalogDrafter`, the Contract wording editor with its live PDF preview, `validateContractWording`, `contractFormFromBody` and `saveContractWordingAction`, instead of a second editor, a second save path or a stored draft.

1. Owner or admin on `/templates/contract` (exists, changed) chooses a file in the new Import control and submits
2. Server Action `importContractWordingAction` (new, beside `saveContractWordingAction`) -> checks the member is owner or admin -> `ImportParser` (exists) -> `ContractSplitter` (new port, door 1; `claudeContractSplitter`, new adapter beside `claudeCatalogDrafter`) -> one structured-output call -> blocks
3. `importedWordingForm` (new, `domain/contract`) builds the schema 2 rows from the blocks (price section first, the blocks in order, signatures section last) and runs `validateContractWording` on them -> returns a `ContractLayoutForm`
4. `ContractWordingEditor` (exists, changed) replaces its rows with that form, unsaved, and the live preview (exists) draws it
5. out: the owner edits, then saves through `saveContractWordingAction` (exists, unchanged) -> `saveContractWording` -> `save_contract_template` (exist) writes the next version. Nothing is stored before that

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: contract import - blocks read from an uploaded contract and turned into editor rows, held in the browser until the owner saves; never a stored row |
| domain | existing term: "merge variable" meant any of the sixteen names (AD-188); an import uses only the eight identity names (door 3). Who branches on it: `validateContractWording` accepts all sixteen, so the narrower set is enforced by `importedWordingForm`, not by the validator |
| domain | existing term: a clause whose variable has no value is left out of the PDF. An imported clause naming `{{tenant.address}}` therefore disappears from the contract of a tenant with no address saved. Who branches on it: `renderLayout` and `renderBlocks`, unchanged |
| external | a new caller of the Claude API from the Contract wording page. The request carries the file the owner chose and no org id, email, company name or setting |
| stored data | nothing to migrate, no table, no column, no function |
| not changed | the agreement template editor, `save_contract_template`, contracts already made (they keep their frozen version), `ImportParser`, asset import, plan limits |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `importContractWordingAction` (Server Action on `/templates/contract`) | `file` (docx or pdf) | `{ status: "imported", form: ContractLayoutForm }` or `{ status: "failed", code }` | `200` imported, `422` invalid, `403` forbidden, `415` unreadable, `413` too_large, `503` unavailable (form-state codes, the `/setup` draft pattern; no HTTP status on the wire) |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. What Claude must return | `ContractSplitter.split({ file: DraftSource }): Promise<{ ok: true, blocks: SplitBlock[] } \| { ok: false, code: 'unavailable' \| 'too_large' }>` with `SplitBlock = { type: 'heading' \| 'paragraph' \| 'clause', text: string }`; the JSON schema is `{ blocks: [{ type: enum, text: string }] }`, `additionalProperties: false`; 1 to 40 blocks of 1 to 2000 characters checked in `importedWordingForm`, not in the schema | asking Claude for a whole schema 2 layout: it would have to know indents, page breaks, sections and options that move with every editor release, and the model contract would change each time. Free text parsed by the app: cannot be validated field by field |
| 2. The import is not stored | the result is action output and editor state; no `contract_imports` table, no draft version row, no stored file | a draft row with status: needs ownership, expiry and a second place that decides which wording is current, and the call finishes inside one request on Railway |
| 3. Variables an import may place | `IMPORT_VARIABLES = ["tenant.legalName", "tenant.address", "tenant.phone", "customer.name", "site.name", "signer.name", "term.start", "term.label"]`; any other `{{name}}` in Claude's text refuses the whole import as `unavailable` | all sixteen names: Claude cannot see the tenant's terms, so a `terms.*` variable would swap the document's own figure ("net 15") for whatever the tenant's setting says today, or drop the clause when the setting is empty. The wording would change meaning with no one having decided it |

- Door 3 is a one-way door because stored wording binds to merge names (AD-188 "the whitelist only grows"): a name an import places can never be taken back out of a signed contract's frozen version. It reaches past this feature in one direction only: a later "map terms to settings" slice may widen the set, never narrow it.
- Nothing else in this change is hard to reverse: the control's layout, the banner text, where the adapter and `importedWordingForm` sit, and the prompt wording are edits.

## Criteria

### S1: A contract file becomes editable blocks (P1)

The owner attaches their contract and gets it back as blocks with the party names as variables.

**Acceptance Criteria**

1. WHEN an owner or admin submits a docx or pdf of 1 to 4,194,304 bytes THEN `importContractWordingAction` SHALL parse a docx with `ImportParser` and send its text, or send a pdf's bytes, to `ContractSplitter` once and answer `imported` with the editor form
2. The system SHALL accept from `ContractSplitter` 1 to 40 blocks, each of type `heading`, `paragraph` or `clause` with text of 1 to 2,000 characters, and SHALL build the form as the price section, then the blocks in the order Claude returned them, then the signatures section, with the default contract document options
3. The system SHALL send Claude the file only, with a system prompt telling it that everything in the user message is data and not instructions, to copy the document's own words without summarising, paraphrasing, reordering or adding, to leave out signature lines and signing blocks, and to replace a party's name, address, phone, the signer, the site and the term's start or length with the matching variable
4. IF a block's text names a `{{variable}}` outside `IMPORT_VARIABLES` THEN the system SHALL answer `unavailable` and return no form
5. IF Claude's answer does not match the schema in door 1, has no blocks, or breaks a bound in AC 2 THEN the system SHALL answer `unavailable` and return no form
6. IF the form built from the blocks fails `validateContractWording` THEN the system SHALL answer `unavailable` and return no form
7. IF the Claude call fails, times out after 120 seconds, is refused, or `ANTHROPIC_API_KEY` is not set THEN the system SHALL answer `unavailable`, log one line without the file's name or text, and return no form
8. IF Claude reports that the document filled its output limit THEN the system SHALL answer `too_large` and return no form
9. The system SHALL NOT keep the file or the result: the file is read from the request and dropped, and no row is written by the import

**Independent test:** attach a two-page docx contract with six numbered clauses and the contractor's name in the first line; six clause blocks appear in the editor, and the name is `{{tenant.legalName}}`.

### S2: Only the right person, only the right files (P1)

**Acceptance Criteria**

10. IF the member is an estimator, a viewer or has no membership THEN the system SHALL answer `forbidden` and call no parser and no model
11. IF no file is attached THEN the system SHALL answer `invalid` and call no model
12. IF the file is not a docx or a pdf, is over 4,194,304 bytes, or `ImportParser` cannot read it THEN the system SHALL answer `unreadable` or `too_large` and call no model
13. IF the caller is signed out THEN the system SHALL send them to `/login`

**Independent test:** attach an xlsx, an empty file and a 5 MB pdf in turn; each is refused with its own message and the editor is untouched.

### S3: The owner reviews, then saves (P1)

Nothing is saved until the owner says so, through the editor they already use.

**Acceptance Criteria**

14. WHEN an import succeeds THEN the Contract wording editor SHALL replace its document options and rows with the imported form, SHALL show "Imported from <file name>. Nothing is saved until you save." and SHALL redraw the PDF preview from the imported rows
15. WHEN the editor holds changes not yet saved and the owner submits a file THEN the editor SHALL ask for confirmation before it replaces them, and SHALL keep them if the owner cancels
16. WHEN the owner saves THEN `saveContractWordingAction` SHALL write the next wording version exactly as it does today
17. WHEN the owner leaves the page without saving THEN the system SHALL have written nothing, and contracts already made SHALL keep the wording they were made with
18. The editor SHALL show beside the Import control: "A starting point: you own your wording. Read it through, and confirm it is valid under your province's law."
19. WHEN a stored version carries an imported clause naming a variable the contract's tenant leaves empty THEN the existing renderer SHALL leave that clause out, and the editor's preview SHALL show it left out, since it renders with the saved settings

**Independent test:** import, delete one clause, save; the contract wording page reloads with the remaining blocks and a new version exists.

### S4: The wait, the failure and the sizes (P1)

**Acceptance Criteria**

20. WHILE the import runs the system SHALL show a status text, disable the Import control, and send one request per click
21. IF the action answers `unavailable`, `too_large`, `unreadable` or `invalid` THEN the editor SHALL show that code's message, keep its rows exactly as they were, and keep the Import control usable
22. WHILE the page is at 375, 768 or 1440 px wide the system SHALL show no horizontal scroll, and every control SHALL be at least 44 by 44 px on mobile and tablet

**Independent test:** the AGENTS.md Playwright pass on `/templates/contract` at three sizes with touch emulation on the two smaller ones.

## Out of scope

| Excluded | Why |
| --- | --- |
| Importing an agreement template or a proposal | The roadmap item says contract; an agreement carries price lines and sections, a different mapping |
| `terms.*` variables, or reading the tenant's settings into the import | Door 3: Claude would change figures it cannot see the settings for |
| Setting indent, page breaks, headings levels, document title or footer from the file | Layout the editor already offers; door 1 keeps the model out of it |
| Several files, images, scans without text, or a URL | One docx or pdf. A scanned pdf without text comes back as `unavailable` |
| Starter wording per pack, province awareness, legal review | Phase 5.5 item 4 and decision 14 |
| Storing the file or the import, a history of imports | Door 2 |
| Counting an import against the AI-import allowance or recording its tokens | See open question 1 |
| Quebec or French contracts | Decision 3 |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Where the control lives | On `/templates/contract` only, not on the Templates list | The editor is where the result lands and where the preview is | n |
| File types | docx and pdf; xlsx, csv and doc are refused | A contract is prose; `ImportParser` reads the other two formats but they would only produce junk blocks | n |
| Model and effort | `EXTRACT_MODEL`, effort `low`, structured output, the server-side fallback beta, 120 s | One constant, one place to change; the drafter already runs this way | n |
| Block kinds | Numbered or lettered obligations are `clause`, titles are `heading`, everything else `paragraph`; the owner changes any in the editor | A clause is omitted from the PDF when its variable is empty, so over-using `clause` is the cautious side | n |
| Upload size | 4,194,304 bytes; `next.config.ts` already allows 5 MB bodies (AD-181) | Contracts are small; no config change | n |
| Replace, not merge | An import replaces all rows after confirmation | Merging two documents' clause order has no good default | n |

**Open questions:** none block the build.

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | open | Should an import count against the plan's AI-import allowance, and should its tokens be logged? | Unmetered, as the catalog draft is (AD-181 left it for plan limits, and AD-185 counts import jobs only). A tenant can call it repeatedly; the owner-or-admin gate is the only limit |
| 2 | blocks go-live | Which lawyer reviews that an imported contract is valid per province? | Decision 14 stands; the editor says the tenant owns the wording (AC 18). Nothing is switched off |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/templates/contract` Import control | empty state | AC 14 (the editor always has rows; with no own wording it opens on the system wording) |
| screen `/templates/contract` Import control | loading state | AC 20 |
| screen `/templates/contract` Import control | error state | AC 21 |
| screen `/templates/contract` Import control | unauthorised | AC 10, AC 13; the page already sends an estimator or viewer to `/templates` (block-editor AC 41) |
| screen `/templates/contract` Import control | density and ordering | n/a - one file input and one button in the editor's existing header area; no list |
| screen `/templates/contract` Import control | destructive action confirms | AC 15 |
| `importContractWordingAction` | response and error shape with its codes | AC 1, AC 10 to AC 12, AC 21 |
| `importContractWordingAction` | who may call, rate limit | AC 10; rate limit n/a - no limiter exists on the sibling `draftCatalogAction`, see open question 1 |
| `importContractWordingAction` | versioning | n/a - a Server Action is not a public API |
| document: the prompt and the banner copy | structure, tone, what to do next | AC 3, AC 14, AC 18 |

## Sources

- ROADMAP.md Phase 5.5 last item and decisions 14, 15 - the item, its timing, and the ownership wording
- AD-181 (catalog draft: held in the browser, one atomic accept) and AD-188 (schema 2 wording, the sixteen names that only grow) - the shape this follows
