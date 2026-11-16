# Templates editor v2 checks

Profile: ui
Plan: `.specs/features/template-editor-v2/plan.md`

48 checks in 8 slices · 0 one-way doors · 0 open

Proof commands run from PowerShell in `web/` (vitest fails from Git Bash): `npx vitest run <file> -t "<selector>"`. A test is named `[C<n>] <claim>`, so `-t "\[C12\]"` selects exactly one. Live checks are author-run in the Playwright browser, as in every earlier UI feature.

## Checks

### S1 - Edit the document on a page · `editor-page.tsx`, `domain/templates/editor-model.ts` · ~30 KB · ~12k

**C1** - The page draws the letterhead with the org's legal name, the title, then one block per layout row in layout order, each part showing its labelled sample (AC 1)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C1\]"`

**C2** - Clicking a block selects exactly that block (outline, `aria-current`), and Enter or Space on a focused block does the same (AC 2)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C2\]"`

**C3** - A selected text block's toolbar offers Move up, Move down, Delete, Indent less, Indent more, Page break before, and Size 1 or 2 for a heading only (AC 3)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C3\]"`

**C4** - A selected part's toolbar offers Move up and Move down, and Delete unless the part is required (AC 4)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C4\]"`

**C5** - Price lines (agreement), Price lines and Signatures (contract) show a "Required" lock and no Delete, and still move (AC 5)
Proof: `npx vitest run domain/templates/editor-model.test.ts -t "\[C5\]"`
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C5\]"`

**C6** - Move up is disabled on the first row and Move down on the last; elsewhere a move swaps exactly two rows (AC 6)
Proof: `npx vitest run domain/templates/editor-model.test.ts -t "\[C6\]"`

**C7** - Typing in a selected text block changes only that row's text in the form and makes no `fetch` call (AC 7)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C7\]"`

**C8** - A text block that is not being edited shows each `{{variable}}` as a chip with its plain label, and while being edited shows the raw `{{name}}` (AC 8)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C8\]"`

**C9** - Deleting a block removes it and shows "Block removed. Undo" until the next change; Undo restores it at its old index (AC 9)
Proof: `npx vitest run domain/templates/editor-model.test.ts -t "\[C9\]"`
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C9\]"`

**C10** - A row with a validation error gets a danger outline and its message under its own block (AC 10)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C10\]"`

### S2 - Add Element dock · `add-element-dock.tsx`, `domain/templates/editor-model.ts` · ~20 KB · ~8k

**C11** - The dock has a Writing group (Heading, Text, Clause), a Document parts group and a Field button (AC 11)
Proof: `npx vitest run components/templates/add-element-dock.test.tsx -t "\[C11\]"`

**C12** - The Document parts group lists exactly the parts of that document, the equipment part named with the org's item word (AC 12)
Proof: `npx vitest run domain/templates/editor-model.test.ts -t "\[C12\]"`
Proof: `npx vitest run components/templates/add-element-dock.test.tsx -t "\[C12\]"`

**C13** - A part already on the page is dimmed, reads "On page" and does nothing when chosen; after its Delete the item is addable again (AC 13)
Proof: `npx vitest run components/templates/add-element-dock.test.tsx -t "\[C13\]"`

**C14** - Choosing an item inserts after the selected block; with nothing selected it inserts at the end, or before a final Signatures part; the new block becomes selected (AC 14)
Proof: `npx vitest run domain/templates/editor-model.test.ts -t "\[C14\]"`

**C15** - A newly added text block's field takes focus (AC 15)
Proof: `npx vitest run components/templates/add-element-dock.test.tsx -t "\[C15\]"`

**C16** - The Field button lists the 16 merge variables as chips, and choosing one inserts `{{name}}` at the caret, or at the end when the field was not focused, and closes the list (AC 16)
Proof: `npx vitest run domain/templates/editor-model.test.ts -t "\[C16\]"`
Proof: `npx vitest run components/templates/add-element-dock.test.tsx -t "\[C16\]"`

**C17** - The dock scrolls sideways inside itself when it is narrower than its items, never the page, and every dock control carries the 44 px class below 1024 px (AC 17)
Proof: `npx vitest run components/templates/add-element-dock.test.tsx -t "\[C17\]"`

### S3 - Options on the block · `block-options.tsx`, `template-editor.tsx` · ~25 KB · ~10k

**C18** - A selected part shows only its own options: Price lines title, five column labels and visits format; Service included title, show frequency and uppercase; Visit schedule and Equipment title; Signatures four fields; Terms none (AC 18)
Proof: `npx vitest run components/templates/block-options.test.tsx -t "\[C18\]"`

**C19** - The agreement's Price lines shows the preset lines with description, price per visit, visit months and equipment types, Add line and Remove, and Add line is refused at 20 lines (AC 19)
Proof: `npx vitest run components/templates/block-options.test.tsx -t "\[C19\]"`

**C20** - Editing the title at the top of the page changes `doc.title` and nothing else (AC 20)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C20\]"`

**C21** - Page settings offers exactly show-meta, letterhead on every page and the footer style (AC 21)
Proof: `npx vitest run components/templates/block-options.test.tsx -t "\[C21\]"`

**C22** - Editing the header name, or the description and term length in Details (agreement only), changes those fields and nothing else; the contract editor has no Details (AC 22)
Proof: `npx vitest run components/templates/block-options.test.tsx -t "\[C22\]"`

### S4 - Preview PDF · `preview-dialog.tsx` · ~8 KB · ~3k

**C23** - Preview PDF sends the current form once to the agreement or the contract endpoint and shows the PDF in a dialog (AC 23)
Proof: `npx vitest run components/templates/preview-dialog.test.tsx -t "\[C23\]"`

**C24** - With the dialog closed, typing makes no preview request (AC 24)
Proof: `npx vitest run components/templates/preview-dialog.test.tsx -t "\[C24\]"`

**C25** - A form that cannot be drawn opens the dialog with "Fix the highlighted blocks to preview" and makes no request (AC 25)
Proof: `npx vitest run components/templates/preview-dialog.test.tsx -t "\[C25\]"`

**C26** - A failed request, and an answer that is not a PDF, each show "Preview unavailable." with Try again, and Try again requests again (AC 26)
Proof: `npx vitest run components/templates/preview-dialog.test.tsx -t "\[C26\]"`

**C27** - Escape or Close closes the dialog and returns focus to the Preview PDF button; below 1024 px it offers "Open in a new tab" (AC 27)
Proof: `npx vitest run components/templates/preview-dialog.test.tsx -t "\[C27\]"`

### S5 - Save, import, one editor · `template-editor.tsx`, the three page modules · ~35 KB · ~14k

**C28** - Save template calls the save with the same input as before (agreement: `save(templateId, values)`; contract: `save(values)`), and the contract editor shows its saved message and stays open (AC 28)
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "\[C28\]"`

**C29** - The header reads "Unsaved changes" while the form differs from the last save, and "Saved" otherwise (AC 29)
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "\[C29\]"`

**C30** - A refused save keeps everything typed, shows each error on its block or field, and selects the first block with an error (AC 30)
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "\[C30\]"`

**C31** - Forbidden, not found and unavailable each show their existing message (AC 31)
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "\[C31\]"`

**C32** - `/templates/new`, `/templates/[templateId]` and `/templates/contract` all render the one editor, with the parts of their document (AC 32)
Proof: `npx vitest run "app/(app)/templates/page.test.ts" -t "\[C32\]"`
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "\[C32\]"`

**C33** - The contract editor shows Import for an owner or admin and keeps the unsaved-rows and overwrite guard (AC 33)
Proof: `npx vitest run components/templates/contract-import.test.tsx -t "\[C33\]"`

**C34** - A role that cannot write templates is redirected to `/templates` from both editor routes (AC 34)
Proof: `npx vitest run "app/(app)/templates/page.test.ts" -t "\[C34\]"`

### S6 - Templates list · `templates-view.tsx`, `template-card.tsx` · ~15 KB · ~6k

**C35** - `/templates` shows one grid of cards with name, description, frequency, updated-ago, a Use template button for members who can use templates, and a writer's menu of Edit, Duplicate and Archive; no right-hand preview panel (AC 35)
Proof: `npx vitest run components/templates/templates-view.test.tsx -t "\[C35\]"`
Proof: `npx vitest run components/templates/template-card.test.tsx -t "\[C35\]"`

**C36** - The contract wording is a card in the same grid, labelled "Contract wording", with Edit for writers only (AC 36)
Proof: `npx vitest run components/templates/templates-view.test.tsx -t "\[C36\]"`

**C37** - An unreadable list shows the load error with Try again, and an empty list shows "No templates yet." (AC 37)
Proof: `npx vitest run components/templates/templates-view.test.tsx -t "\[C37\]"`

### S7 - Phone, keyboard, desktop fit · all of the above · ~0 KB · ~4k

**C38** - No horizontal scroll at 375, 768 and 1440 px on the editor (agreement and contract) and the list: `scrollWidth <= clientWidth` (AC 38)
Proof: author-run live pass in the Playwright browser at the three widths on `/templates`, `/templates/<id>` and `/templates/contract`, reading `document.documentElement.scrollWidth` and `clientWidth`; no automated selector exists for it

**C39** - Every editor control below 1024 px carries the 44 px class (`min-h-11`/`min-w-11` or `size-11`) (AC 39)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C39\]"`
Proof: `npx vitest run components/templates/add-element-dock.test.tsx -t "\[C39\]"`

**C40** - Every editor action is a focusable button or a link with an accessible name, and nothing needs hover or drag: whatever can be dragged is a button with a click path (AC 40)
Proof: `npx vitest run components/templates/editor-page.test.tsx -t "\[C40\]"`

**C41** - At 1440 px with the sidebar open, the dock and the page are fully visible with no horizontal scroll (AC 41)
Proof: author-run live pass at 1440 px with the sidebar open, comparing the dock's and the page's bounding boxes to the viewport

**C42** - The old editor files and their now-wrong tests are gone, and `npx tsc --noEmit`, `npx eslint components/templates "app/(app)/templates"` and the whole `npx vitest run` pass (all ACs, regression)
Proof: `npx tsc --noEmit`
Proof: `npx eslint components/templates "app/(app)/templates"`
Proof: `npx vitest run`

### S8 - Drag from the dock and drag to reorder · `editor-page.tsx`, `add-element-dock.tsx`, `domain/templates/editor-model.ts` · ~25 KB · ~10k

**C43** - Dragging an Add Element item over a block shows one drop line before it in the upper half and after it in the lower half, and at the end of the page below the last block (AC 42)
Proof: `npx vitest run domain/templates/editor-model.test.ts -t "\[C43\]"`
Proof: `npx vitest run components/templates/editor-drag.test.tsx -t "\[C43\]"`

**C44** - Dropping an Add Element item inserts the new block at the drop line, selected, a text block's field focused (AC 43)
Proof: `npx vitest run components/templates/editor-drag.test.tsx -t "\[C44\]"`

**C45** - A part already on the page is not draggable, and dropping its payload changes nothing (AC 44)
Proof: `npx vitest run components/templates/editor-drag.test.tsx -t "\[C45\]"`

**C46** - Dropping a block dragged by its grip moves that row to the drop line, keeps it selected and keeps the other rows in order; a drop where it already is changes nothing (AC 45)
Proof: `npx vitest run domain/templates/editor-model.test.ts -t "\[C46\]"`
Proof: `npx vitest run components/templates/editor-drag.test.tsx -t "\[C46\]"`

**C47** - A drag that ends without a drop, or leaves the page, removes the drop line and changes nothing (AC 46)
Proof: `npx vitest run components/templates/editor-drag.test.tsx -t "\[C47\]"`

**C48** - Click-to-add and Up and Down still work with no drag event fired, and every grip is named "Drag to move" with the 44 px class (AC 47, AC 48)
Proof: `npx vitest run components/templates/editor-drag.test.tsx -t "\[C48\]"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| text block types (3) | heading C3 · paragraph C3 · clause C3 | - |
| toolbar actions on a text block (7) | Move up C3 · Move down C3 · Delete C3 · Indent less C3 · Indent more C3 · Page break before C3 · Size C3 | - |
| agreement parts (5) | price C12 · schedule C12 · included C12 · equipment C12 · terms C12 | - |
| contract parts (5) | price C12 · schedule C12 · included C12 · equipment C12 · signatures C12 | - |
| required parts (3 document-part pairs) | agreement price C5 · contract price C5 · contract signatures C5 | - |
| part options (6 sections) | price C18 · included C18 · schedule C18 · equipment C18 · signatures C18 · terms (none) C18 | - |
| merge variables (16) | all 16 C16, table-driven over the whitelist | - |
| page settings (3) | show meta C21 · letterhead on every page C21 · footer style C21 | - |
| preview outcomes (5) | ok C23 · cannot be drawn C25 · request failed C26 · not a PDF C26 · closed makes none C24 | - |
| save statuses (5) | saved C28 · invalid C30 · forbidden C31 · not_found C31 · unavailable C31 | - |
| editor routes (3) | `/templates/new` C32 · `/templates/[templateId]` C32 · `/templates/contract` C32 | - |
| list states (3) | cards C35 · empty C37 · load error C37 | - |
| drag payloads (2) | add an element C44 · move a block C46 | - |
| drop positions (3) | before a block C43 · after a block C43 · end of the page C43 | - |
| drag outcomes (3) | drop C44 · refused (part on page) C45 · cancelled C47 | - |
| viewports (3) | 375 C38 · 768 C38 · 1440 C38 | - |

- Claims naming a route, a status or a response shape: C23, C25, C26, C28, C30, C31, C32, C34 - each has a proof that crosses its boundary
- C38 and C41 have no automated selector; they are live passes, stated as such
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Pure helpers that decide (move, insert position, required rows, parts available, delete and undo, variable insert) | one at its own layer, `domain/templates/editor-model.test.ts` | one asserted case per row of each decision table |
| Components that decide (selection, toolbar rules, dock state, dialog states, save states) | one render test at their own layer | each state and each rejected input |
| Markup that only lays out | none of its own | covered by the state test above and the live pass |
| Page modules (redirects, 404, which editor) | one at the boundary | each role and each unknown-id case |

Evidence:

- `domain/templates/editor-model.ts` (new): 6 helpers, about 14 branch points -> decides
- `components/templates/editor-page.tsx` (new): selection, five toolbar rules, error outline -> decides
- `components/templates/add-element-panel.tsx` (new): group layout, on-page state, field menu -> decides
- `components/templates/preview-dialog.tsx` (new): five outcomes -> decides
- closest analogue: `components/templates/block-editor.test.tsx`, same shape, already proven at this level with about 40 cases

Cost: 5 proof files at their own layer, about 120 asserted cases. Without these rows the toolbar and panel rules would be proven only by the save path traversing them.

## Swept

- validation: C10, C30 - the existing `validateLayout` rules, now shown on the block they belong to
- failure modes: C26 (preview), C30 and C31 (save)
- idempotency: n/a - Save writes the next version exactly as today; the editor adds no new write
- authorization: C34, existing - the three page modules and the save functions already check owner or admin
- concurrency: n/a - two members saving the same template is the existing last-version-wins behaviour, unchanged
- data lifecycle: n/a - nothing new is stored; frozen versions and sent documents are untouched
- dependency failure: C26 - the PDF route being down
- state transitions: C13 (part on page or not), C29 (saved or unsaved), C9 (deleted or restored)
- observability: n/a - no logging requirement; an editor UI emits none today

## Out of scope

- Divider, drag and drop on touch screens, formatting beyond plain text, a live PDF beside the page, new variables or options, starter templates - see the plan's `Out of scope`

## Handoff

- S8 = 10k (drag from the panel and reorder; same files as S1 and S2) is added on top of S1 to S7 (~49k): ~59k, under the 150k budget - one builder
- S1 = 12k and S2 = 8k enter `components/templates/` and the new `domain/templates/editor-model.ts`; S3 = 10k and S4 = 3k stay there; S5 = 14k adds the three page modules; S6 = 6k; S7 = 4k. Source touched about 58 KB and tests about 96 KB (~39k tokens read) plus about 60k of new code and tests: ~100k total, under the 150k budget - one builder
