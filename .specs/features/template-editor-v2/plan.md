# Templates editor v2: a page you click, with an Add Element panel

## Problem

The Templates pages ask a non-technical owner to edit a document by filling in a form. The owner said so on 2026-11-16: "I did not like the way template pages is right now, all of it, I still think is too complex". Today an agreement template editor is a column of fields (Name, Description, Term length), a Document options card, a list of folded layout rows each with its own options and a "More options" fold, a list of preset lines, and a live PDF pane beside it. The contract wording is a second screen that works the same way. The owner does not see the document while editing it, has to learn what a "row", a "section" and an "indent" are, and meets the same ideas on two screens.

The owner is the one who edits, usually once at setup, and is not technical. There are no usage figures or support reports in the repo, so this rests on the owner's own judgement and the reference they sent (the Jotform PDF editor: a short "Add Element" panel, a page, one thing selected at a time).

When this ships the owner edits the document itself: they click a block on a page that looks like the agreement or contract, type in it, and add things from one short panel. The PDF is one click away instead of always on screen.

## Flow

This reuses the form state, the validation, the save actions and the two PDF preview routes unchanged; only the screen that edits the form changes.

1. Request for `/templates/[templateId]`, `/templates/new` or `/templates/contract` -> the existing page modules read the template and build the form with `layoutFormFromBody` / `contractFormFromBody` (exist); the three pages render one editor.
2. `components/templates/template-editor.tsx` (exists, rebuilt) holds the form state and draws the Add Element panel, the page and the header; `contract-wording-editor.tsx` (exists) becomes the same editor with `document="contract"`.
3. Each edit -> `domain/agreement/layout-form.ts` (exists) and `domain/agreement/layout.ts` (exists) rebuild the body and return errors live; errors are shown on the block they belong to.
4. Preview PDF -> `POST /templates/preview` (exists) or `POST /templates/contract/preview` (exists), one request, shown in a dialog.
5. Save -> `saveAgreementTemplateAction` (exists) or the contract save action (exists) -> the next `document_template_versions` row; the page stays open.
6. `/templates` (exists) -> `templates-view.tsx` (exists) and `template-card.tsx` (exists, simplified) list the cards.

## Impact

| Front | What changes |
| --- | --- |
| domain | none. No new block type, option or variable; `LayoutItem`, `DocOptions` and the 16 merge variables are unchanged |
| screens | replaced: `template-editor.tsx`, `contract-wording-editor.tsx`, `block-list-editor.tsx`, `layout-fields.tsx`, `document-options-panel.tsx`. Changed: `templates-view.tsx`, `template-card.tsx`, `template-use-dialog.tsx`. Reused inside the new dialog: `template-preview-frame.tsx`. `more-options.tsx` and `switch.tsx` stay only if another screen still uses them |
| existing behaviour | the live PDF pane goes away; whoever relied on seeing the PDF while typing now presses Preview PDF. The setup screen's template preview (`setup-template-preview`) uses the preview route, not the editor, and is unaffected |
| tests | about ten component test files in `web/components/templates/` assert the old editor and are rewritten from the new criteria; the domain and action tests do not change |
| stored data | nothing to migrate; saved versions, frozen agreement and contract versions and sent documents are read and written exactly as before |
| docs | DESIGN.md gains the editor's components at finish (the panel, the page block, the dock-less selection toolbar); ROADMAP Phase 5.5 gets a line |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. The two preview routes, the save actions and the import action keep their signatures.

## Landing

None - nothing here is hard to reverse. No stored shape, contract, dependency or backfill changes: the editor keeps `LayoutFormState` as its state and adds no library. Drag and drop uses the browser's own drag events (added 2026-11-16 after the owner said the chosen layout meant dragging from the panel), and a UI component can be replaced again by another commit.

## Criteria

### S1: Edit the document on a page (P1)

The owner sees the agreement or contract as a page, clicks a block and changes it.

**Acceptance Criteria**

1. WHEN the editor opens THEN the system SHALL draw one white page in layout order: the letterhead with the org's legal name, the title (`doc.title`), then each layout row as its own block, text rows showing their text and each part (price table, visit schedule, service included, equipment, terms, signatures) showing a labelled sample of what it prints.
2. WHEN the member clicks a block, or presses Enter or Space on a focused block THEN the system SHALL select exactly that block, outline it in Action Blue and show its toolbar.
3. WHEN a text block is selected THEN its toolbar SHALL offer Move up, Move down, Delete, Indent less, Indent more (0 to 3) and Page break before, and for a heading also Size 1 or 2.
4. WHEN a part is selected THEN its toolbar SHALL offer Move up and Move down, and Delete unless the part is required.
5. The system SHALL treat Price lines (both documents) and Signatures (contract) as required: no Delete action, a "Required" lock label, and the block can still move.
6. WHILE the selected block is first in the layout the Move up control SHALL be disabled, and while it is last Move down SHALL be disabled.
7. WHEN the member types in a selected text block THEN the system SHALL change only that row's text in the form and SHALL make no network request.
8. WHILE a text block is not being edited THEN each `{{variable}}` in it SHALL show as a chip with its plain-words label (for example "Customer name"), and WHILE it is being edited the raw `{{name}}` text SHALL show.
9. WHEN the member deletes a block THEN the system SHALL remove it and show "Block removed. Undo" until the next change, and WHEN Undo is chosen THEN the block SHALL return to its place.
10. IF a row has a validation error THEN the system SHALL outline its block in the danger colour and show the message under that block.

**Independent test:** open an agreement template, click a paragraph, change a word, move it down, delete and undo it.

### S2: Add things from one short panel (P1)

The owner adds text and document parts from an Add Element panel, as in the reference.

**Acceptance Criteria**

11. The system SHALL show an Add Element panel with two tabs, Writing (Heading, Text, Clause) and Document parts.
12. WHEN the Document parts tab is open THEN it SHALL list the parts that document supports (agreement: Price lines, Visit schedule, Service included, Equipment, Terms; contract: Price lines, Visit schedule, Service included, Equipment, Signatures), the equipment part named with the org's item word.
13. WHILE a part is already on the page its panel item SHALL read "On page" and SHALL do nothing when chosen; WHEN that part is deleted its item SHALL become addable again.
14. WHEN the member chooses an item THEN the system SHALL insert the new block after the selected block, and with nothing selected at the end of the layout but before a final Signatures part, and SHALL select the new block.
15. WHEN a new text block is added THEN its text field SHALL take focus.
16. WHILE the Writing tab is open the panel SHALL list the 16 merge variables as field chips, and WHEN a chip is chosen while a text block is selected THEN `{{name}}` SHALL be inserted at the caret, or at the end when the field has not been focused.
17. WHILE the viewport is below 1024 px the panel SHALL be a bottom sheet opened by an "Add" button of at least 44 px, and WHEN an item is chosen THEN the sheet SHALL close.

**Independent test:** add a Heading and a Clause, insert Customer name into the clause, open the parts tab and add Visit schedule.

### S3: Options live on the block they belong to (P1)

The owner changes a part's wording and the template's details without a settings form.

**Acceptance Criteria**

18. WHEN a part is selected THEN the system SHALL show its existing options under it and nothing else: Price lines (title, the five column labels, visits format), Service included (title, show frequency, uppercase), Visit schedule and Equipment (title), Signatures (customer label, contractor label, caption, name line); Terms has none.
19. WHEN the agreement's Price lines part is selected THEN the system SHALL show the preset lines under it: each line's description, price per visit, visit months and equipment types, with Add line and Remove, up to 20 lines.
20. WHEN the member edits the title at the top of the page THEN the system SHALL change `doc.title` only.
21. WHEN the member opens Page settings THEN the system SHALL offer show the number, customer and site lines, letterhead on every page, and the footer style, and no other option.
22. WHEN the member edits the template name in the header, or the description and term length in Details (agreement only) THEN the system SHALL change those form fields only, and a duplicate name SHALL still be refused by the existing save.

**Independent test:** select Price lines, rename a column and add a preset line, then switch the footer in Page settings.

### S4: Preview the real PDF on request (P1)

The owner checks the true PDF with one click, instead of watching a live pane.

**Acceptance Criteria**

23. WHEN the member chooses Preview PDF THEN the system SHALL send the current form once to `/templates/preview` (agreement) or `/templates/contract/preview` (contract) and show the PDF in a dialog.
24. WHILE the dialog is closed THEN the system SHALL make no preview request, however much is typed.
25. IF the form cannot be drawn THEN the system SHALL open the dialog with "Fix the highlighted blocks to preview" and SHALL make no request.
26. IF the preview request fails or does not return a PDF THEN the dialog SHALL say "Preview unavailable." with a Try again button.
27. WHEN the member presses Escape or Close THEN the dialog SHALL close and focus SHALL return to the Preview PDF button; below 1024 px the dialog SHALL offer "Open in a new tab".

**Independent test:** edit a clause, press Preview PDF, see the edit in the PDF, press Escape.

### S5: Save, import and one editor for both documents (P1)

**Acceptance Criteria**

28. WHEN the member chooses Save template THEN the system SHALL call the existing save with the same input it takes today and keep what happens after it: an agreement template goes back to the list (the existing redirect), and the contract wording stays open with its existing saved message. (Amended before the build: the agreement action redirects today and changing it is outside this UI rebuild.)
29. WHILE the form differs from what was last saved THEN the header SHALL read "Unsaved changes", and otherwise "Saved".
30. IF the save is refused with field errors THEN the system SHALL keep everything typed, show each error on its block or field, and select the first block with an error.
31. IF the save answers forbidden, not found or unavailable THEN the system SHALL show the existing message for that status.
32. The system SHALL render `/templates/new`, `/templates/[templateId]` and `/templates/contract` with the same editor, with the parts of that document.
33. WHERE the contract editor is open for an owner or admin THEN the system SHALL offer Import in the header with the existing import behaviour (upload, unsaved rows, overwrite guard).
34. WHILE the member's role cannot write templates THEN the system SHALL keep the existing redirect to `/templates`.

**Independent test:** edit a contract, import a docx, save, reload and see the new version.

### S6: A simpler Templates list (P2)

**Acceptance Criteria**

35. WHEN `/templates` opens THEN the system SHALL show one grid of cards, each with name, description, frequency, "updated ago", a Use template button for members who can use templates, and a menu with Edit, Duplicate and Archive for writers; the right-hand preview panel SHALL be gone.
36. The system SHALL show the contract wording as a card in the same grid, labelled "Contract wording", with Edit for writers.
37. IF the list cannot be read THEN the system SHALL keep the existing load error with Try again, and WHEN there are no templates THEN "No templates yet.".

**Independent test:** open `/templates`, use a template, edit one, edit the contract wording.

### S7: It works on a phone and without a mouse (P1)

**Acceptance Criteria**

38. WHERE the viewport is 375, 768 or 1440 px wide THEN the editor and the list SHALL have no horizontal scroll.
39. WHILE the viewport is below 1024 px every control in the editor SHALL be at least 44 px tall and wide.
40. The system SHALL make every editor action reachable by keyboard and SHALL need no hover and no drag.
41. WHILE the viewport is 1440 px wide with the app's existing sidebar open THEN the Add Element panel and the page SHALL both be fully visible without horizontal scroll. (Amended before checks: the icon rail was dropped, the shell's existing collapse stays; see Assumptions.)

**Independent test:** run the editor at 375, 768 and 1440 px with the keyboard only.

### S8: Drag from the panel and drag blocks to reorder (P1)

The owner drags an element from the Add Element panel onto the page, and drags a block to move it, as the chosen sketch showed ("Drop Heading here"). Click and the Up and Down controls stay, for the keyboard and for touch. (Added 2026-11-16 after the owner pointed out the build had no drag; it was wrongly listed out of scope.)

**Acceptance Criteria**

42. WHEN a member drags an Add Element item over a block of the page THEN the system SHALL show one drop line at that block's top edge when the pointer is in its upper half and at its bottom edge when it is in its lower half, and a drop line at the end of the page when the pointer is below the last block.
43. WHEN a dragged Add Element item is dropped THEN the system SHALL insert the new block at the drop line, select it and focus a new text block's field, exactly as choosing the item would.
44. WHILE a part is already on the page its panel item SHALL NOT be draggable, and IF its payload is dropped anyway THEN the system SHALL change nothing.
45. WHEN a block is dragged by its grip and dropped THEN the system SHALL move that row to the drop line, keep it selected, and leave the order of every other row as it was; a drop that leaves it where it was SHALL change nothing.
46. WHEN a drag ends without a drop, or the pointer leaves the page THEN the system SHALL remove the drop line and change nothing.
47. The system SHALL keep every drag outcome reachable without a drag: tap or click an item to add it, and Up and Down to move a block.
48. The system SHALL give every block a grip with the accessible name "Drag to move" and a 44 px touch size below 1024 px.

**Independent test:** drag Heading from the panel between two blocks, then drag that block to the end.

## Out of scope

| Excluded | Why |
| --- | --- |
| Divider element | the layout model has no divider; adding one changes the stored body (a one-way door) |
| Drag and drop on touch screens | the browser's drag events do not fire on most touch browsers; tap, the Add button and the Up and Down controls stay the way on a phone |
| Italic, bold, other formatting | the model stores plain text; decided against on 2026-11-13 |
| Per-page header note, click-anywhere pixel placement | deliberately not built in Phase 5.5 |
| A live PDF beside the page | replaced by Preview PDF on request, the owner's choice |
| New merge variables or new options | the whitelist and the options are stored contracts |
| Starter templates per pack | a separate open item (ROADMAP 5.5) |
| Per-asset plus base fee pricing | a separate open item |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| The slim icon rail while editing | dropped: the shell already has a desktop sidebar collapse remembered per browser (`app-shell.tsx`), so the editor uses it and fits beside the open sidebar (AC 41) | a new shell mode is larger than the editor and was the plan's stated fallback | n |
| Page break | a toolbar toggle on a text block, not a panel item | the model stores it as a flag on a block, not a block | n |
| Where Fields chips live | on the Writing tab only | they only insert into text | n |
| How text is edited on the page | a text field styled as page text, with chips shown when it is not focused | a contenteditable with inline chips is fragile on phones and screen readers | n |
| Where the preset lines live | under the Price lines part's options | they are the price rows | n |
| Save | unchanged: an agreement template returns to the list through the action's existing redirect, the contract wording stays open | changing the agreement action is outside a UI rebuild | n |
| Deleting a block | removes it at once, with an Undo line | cheaper and safer than a confirm for a non-technical owner | n |
| What the Templates list loses | the right-hand preview panel; Use template moves onto each card | owner said the list was not liked; the preview is available inside the editor | n |
| Tab names | "Writing" and "Document parts" | taken from the sketch the owner chose | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `editor` | empty state | n/a - a document always has its required parts, so it is never empty; the Document parts tab with every part used says "Every part is on the page" (AC 13) |
| screen `editor` | loading state | existing - `templates/[templateId]/loading.tsx`, `templates/new/loading.tsx` and `templates/contract/loading.tsx` |
| screen `editor` | error state | AC 10 and AC 30 |
| screen `editor` | unauthorised state | AC 34 |
| screen `editor` | density and ordering | AC 1, AC 6 and AC 42 |
| screen `editor` | drag in progress, cancelled, refused | AC 42, AC 44 and AC 46 |
| screen `editor` | destructive action confirms | AC 9 |
| screen `preview dialog` | empty, error | AC 25 and AC 26 |
| screen `templates list` | empty and error state | AC 37 |
| screen `templates list` | destructive action confirms | existing - `archive-control.tsx` confirms before archiving |
| all screens | phone and keyboard | AC 38, AC 39, AC 40 and AC 47 |
| `POST /templates/preview` and `/templates/contract/preview` | error shape, versioning, rate limits | n/a - the routes are unchanged |

## Sources

- The owner's request, 2026-11-16, and the Jotform PDF editor reference image they sent - the interaction model
- `.impeccable/mocks/decision/palette.html` - the layout chosen on 2026-11-16 (Add Element panel plus page)
- `ROADMAP.md` Phase 5.5 and Decision 13 and 14 - what the templates are and who edits them
