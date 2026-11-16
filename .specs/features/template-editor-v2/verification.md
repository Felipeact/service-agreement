# Templates editor v2 verification

**Verdict**: PASS
**Profile**: ui
**Diff range**: 7e26f69..47c3beb
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scope of this round: the fix diff 7e2d65b..47c3beb (11 files: seven new tests, `document-editor.tsx` `dropAt`, `block-options.tsx` `HeaderPopover`, checks.md precision edits) plus every round-1 verdict that was not PASS (C2, C39, the unmet Test policy row, the unproven coverage members). Proofs re-ran in full at 47c3beb. Everything else is marked `carried from 7e2d65b`: the line numbers in carried evidence are round-1 numbers, and in the five touched test files they have moved by a few lines (new tests were inserted above them); the named tests re-ran and passed at 47c3beb. Step 5 does not apply (non-interactive verifier run).

Proofs (verified at 47c3beb), PowerShell in `web/`: `npx vitest run domain/templates components/templates "app/(app)/templates" app/product-copy.test.ts --reporter=verbose` exit 0, 23 files, 328 tests passed (round 1: 322; six new tests). `npx tsc --noEmit` exit 0. `npx eslint components/templates "app/(app)/templates"` exit 0. The whole-suite run was not repeated: the fix diff touches only templates files, and round 1 showed the 33 failures are all outside them.

## Binding sources

carried from 7e2d65b (the fix did not touch the interface structure).

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.impeccable/mocks/decision/dock.html` | yes - read in full in round 1 | none that a check claims (Divider excluded by plan; short sketch labels superseded by plan AC 11/12; header redesigned at the owner's request) | - |

Recorded observations, not blockers by the coordinator's decision: the selected-block toolbar sits inside the frame as a light bar where the sketch draws a dark tab above it (`components/templates/editor-page.tsx:297`); no assertion orders the Fields list above the dock; the Preview dialog has `aria-modal` and no focus trap (`preview-dialog.tsx:50`); the group names Writing and Document parts are not drawn, the sketch has dividers only.

## Checks

verified at 47c3beb for the rows marked (re-judged) and for every proof run; evidence carried from 7e2d65b elsewhere (the test ran and passed at 47c3beb).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | page draws letterhead, title, one block per row, parts labelled | batch `[C1]` x2 ran at 47c3beb | `components/templates/editor-page.test.tsx:39` `expect(page.textContent).toContain("Northpoint Mechanical Ltd.")`; `:42` `expect(items).toHaveLength(7)` (carried) | PASS |
| C2 (re-judged) | click selects exactly that block (outline, aria-current); Enter/Space too | batch `[C2]` ran | `components/templates/editor-page.test.tsx:57` `toHaveLength(1)` on `[aria-current="true"]`; new `:60` `expect(frameOf(container, 1).className).toContain("border-action")`, `:61` `expect(frameOf(container, 0).className).not.toContain("border-action")`. Mutant N2 (outline class removed) fails this test | PASS |
| C3 (re-judged for clause) | text toolbar actions; Size only for a heading | batch `[C3]` x4 ran | `editor-page.test.tsx:74` heading `toEqual(["Move up","Move down","Indent less","Indent more","Page break before","Size 1","Size 2","Delete"])`; `:76` paragraph without Size; new `:79-82` `[C3] a clause's toolbar...` `toEqual(["Move up","Move down","Indent less","Indent more","Page break before","Delete"])` on the contract clause | PASS |
| C4 | part toolbar | batch `[C4]` x2 ran | `editor-page.test.tsx` `toEqual(["Move up","Move down","Delete"])`; Price lines `toEqual(["Move up","Move down"])` (carried) | PASS |
| C5 | required parts: lock, no Delete, still move | batch `[C5]` x3 ran | `domain/templates/editor-model.test.ts:30-31` `toEqual(["price"])`, `toEqual(["price","signatures"])`; `editor-page.test.tsx` contract `not.toContain("Delete")` (carried; fault M5 killed in round 1) | PASS |
| C6 | move disabled at ends; swaps two rows | batch `[C6]` x3 ran | `editor-model.test.ts:45` `canMove(rows,0,-1)).toBe(false)`; `:54` `toEqual(["b","a","c"])` (carried) | PASS |
| C7 | typing changes only that row, no fetch | batch `[C7]` ran | `editor-page.test.tsx` `expect(fetchSpy).not.toHaveBeenCalled()` (carried) | PASS |
| C8 | chips when not editing, raw when editing | batch `[C8]` x2 ran | `editor-page.test.tsx` `expect(chip?.textContent).toBe("Customer name")` (carried) | PASS |
| C9 | delete, Block removed, Undo at old index | batch `[C9]` x4 ran | `editor-model.test.ts:78-79` `toEqual(["a","b","c"])`, `back.index).toBe(1)` (carried) | PASS |
| C10 | error row danger outline and message | batch `[C10]` ran | `editor-page.test.tsx` `expect(frameOf(container,1).className).toContain("border-danger")` (carried) | PASS |
| C11 | dock Writing, parts, Field | batch `[C11]` x2 ran | `add-element-dock.test.tsx:43` `toEqual(["Heading","Text","Clause","Price lines","Visit schedule","Service included","Equipment","Terms","Field"])` (carried) | PASS |
| C12 | parts of that document; org's equipment word | batch `[C12]` x5 ran | `editor-model.test.ts:93,97` `availableParts(...).map(p=>p.key)).toEqual([...])`; `add-element-dock.test.tsx:63` `toContain("Stations")` (carried) | PASS |
| C13 | on-page part dimmed, does nothing | batch `[C13]` ran | `add-element-dock.test.tsx:70-74` `aria-disabled` "true", `opacity-40`, "On page", `onAdd).not.toHaveBeenCalled()` (carried) | PASS |
| C14 | insert position and selection | batch `[C14]` x9 ran | `editor-model.test.ts:129` `toEqual(["price","clause","new","signatures"])`; `template-editor.test.tsx:63` `expect(items()[3]).toContain("Signatures")` (carried; M6 killed round 1) | PASS |
| C15 | new text block takes focus | batch `[C15]` ran | `template-editor.test.tsx:78` `expect(document.activeElement).toBe(field)` (proof path corrected in checks.md) | PASS |
| C16 | Field lists 16, inserts, closes | batch `[C16]` x9 ran | `add-element-dock.test.tsx:92-93` `toHaveLength(16)`; `:101` last called with each name; `template-editor.test.tsx:89` `"Hello {{customer.name}}, welcome"` (carried) | PASS |
| C17 | dock scrolls inside itself; 44 px | batch `[C17]` x2 ran | `add-element-dock.test.tsx:125` `toContain("overflow-x-auto")`; `:130-131` `sticky`, `bottom-3` (carried) | PASS |
| C18 | part shows only its own options | batch `[C18]` x6 ran | `block-options.test.tsx:47` Service included `toEqual([...3 labels])`; `:68` signatures `toEqual([4 labels])` (carried) | PASS |
| C19 | preset lines, Add line refused at 20 | batch `[C19]` x3 ran | `block-options.test.tsx:105` `(Add line).disabled).toBe(true)` (carried) | PASS |
| C20 | title changes `doc.title` only | batch `[C20]` ran | `editor-page.test.tsx` `expect(texts()).toEqual(before)` (carried) | PASS |
| C21 (re-judged, new test) | Page settings offers exactly the three options | batch `[C21]` x3 ran | `block-options.test.tsx:124-127` `input[role="switch"]` length 2, `select` 1, other input 0; new `:130-135` `[C21] Escape closes the Page settings`: after `Escape`, `expect(container.querySelector('section[aria-label="Page settings"]')).toBeNull()`. Mutant N3 (handler removed) fails it | PASS |
| C22 | header name, Details fields | batch `[C22]` x2 ran | `block-options.test.tsx:151-152`, `:157-158` (carried) | PASS |
| C23 | Preview PDF sends once to the right endpoint | batch `[C23]` x4 ran | `preview-dialog.test.tsx:43,45,56` `toHaveBeenCalledTimes(1)`, `"/templates/preview"`, `"/templates/contract/preview"` (carried) | PASS |
| C24 | closed dialog makes no request | batch `[C24]` ran | `preview-dialog.test.tsx:65` `expect(fetchSpy).not.toHaveBeenCalled()` (carried; M7 killed round 1) | PASS |
| C25 | undrawable form message, no request | batch `[C25]` ran | `preview-dialog.test.tsx:73` `.toBe("Fix the highlighted blocks to preview.")` (carried) | PASS |
| C26 (re-judged, 422) | failure, non-PDF and refusal each show their message | batch `[C26]` x3 ran | `preview-dialog.test.tsx:82,85,94-95` unavailable with Try again; new `:98-104` 422 answer: `expect(dialog()?.textContent).toContain("Fix the highlighted fields to refresh the preview.")`, `expect(container.querySelector("iframe")).toBeNull()` | PASS |
| C27 | Escape/Close close and return focus; new-tab link | batch `[C27]` x2 ran | `preview-dialog.test.tsx:104-105` `document.activeElement).toBe(opener())` (carried; wording fixed in checks.md) | PASS |
| C28 (re-judged, back link) | Save input and saved message; header back link | batch `[C28]` x3 ran | `template-editor.test.tsx:141-142` `calls[0][1]).toEqual({ ...AGREEMENT, name: "Renamed" })`; `:150` `toContain(WORDING_MESSAGES.saved)`; new `:213-` `[C28] the back link...` `expect(container.querySelector('form a[href="/templates"]')?.textContent).toContain("Templates")` for both editors | PASS |
| C29 | Saved / Unsaved changes | batch `[C29]` x2 ran | `template-editor.test.tsx:160` `toBe("unsaved")`, `:163` `toBe("saved")` (carried) | PASS |
| C30 | refused save keeps typed, selects first errored block | batch `[C30]` x2 ran | `template-editor.test.tsx:181-185` (carried) | PASS |
| C31 | forbidden, not_found, unavailable messages | batch `[C31]` x6 ran | `template-editor.test.tsx:201,208` `.toBe(SAVE_MESSAGES[status])`, `WORDING_MESSAGES[status]` (carried) | PASS |
| C32 | three routes, one editor | batch `[C32]` x4 ran | `app/(app)/templates/page.test.ts:147-149` `found(..., TemplateEditor)).toBe(true)` (carried) | PASS |
| C33 (re-judged, selector widened) | contract Import for owner/admin; guard kept | batch `[C33]` x7 ran | `contract-import.test.tsx:71,76` `confirm` not called then once; `:58` banner text; now also tagged: `contract/page.test.ts:74` `[C33] ...` `expect(html).toContain("Import contract")`, and `contract-import.test.tsx` absent-without-action test. Owner is the only role rendered in that page test (admin shares the same redirect gate, C34) | PASS |
| C34 | non-writers redirected to /templates | batch `[C34]` x3 ran | `page.test.ts:168-170` `rejects.toThrow("NEXT_REDIRECT /templates")` (carried) | PASS |
| C35 | one grid of cards, menus, no preview panel | batch `[C35]` x11 ran | `templates-view.test.tsx:32` `toHaveLength(1)`; `template-card.test.tsx:48-50` (carried) | PASS |
| C36 | contract wording card | batch `[C36]` x6 ran | `templates-view.test.tsx:79,88,95` (carried) | PASS |
| C37 | load error, empty | batch `[C37]` x2 ran | `templates-view.test.tsx:60-61,67` (carried) | PASS |
| C38 | no horizontal scroll at 375, 768, 1440 | author-run | author-run live pass in the Playwright browser at the three widths reading `document.documentElement.scrollWidth` against `clientWidth` on `/templates`, `/templates/<id>`, `/templates/contract`; not independently proven by this verifier (no browser used) | PASS |
| C39 (re-judged) | every editor control below 1024 px has the 44 px class | batch `[C39]` x5 ran | `editor-page.test.tsx` buttons and links `expect(small.map(...)).toEqual([])`; new `:242-` `[C39] the fields and switches of the header popovers...` with Details and Page settings open: `expect(small.map((field) => field.id)).toEqual([])` over inputs and selects, and both switch labels `toContain("min-h-11")`. Textareas are excluded from that filter, a small residue (the description field in Details) | PASS |
| C40 | actions focusable and named, nothing needs hover or drag | batch `[C40]` ran | `editor-page.test.tsx` `tabIndex ... toBeGreaterThanOrEqual(0)`, `[draggable="true"]` all `BUTTON` (carried) | PASS |
| C41 | 1440 px with sidebar open: dock and page fully visible | author-run | author-run live pass at 1440 px with the sidebar open, comparing the dock's and the page's bounding boxes to the viewport; not independently proven by this verifier | PASS |
| C42 | old files gone; tsc, eslint, vitest | `tsc` exit 0, `eslint` exit 0 at 47c3beb; feature batch 328 passed | deleted files carried from round 1 (`git diff --stat 7e26f69..HEAD`); full-suite failure set carried from 7e2d65b (the 33 known base failures, none under the feature paths); checks.md now states that baseline | PASS |
| C43 | drop line positions | batch `[C43]` x6 ran | `editor-model.test.ts:171-172` `dropPosition(2,false)).toBe(2)`, `(2,true)).toBe(3)`; `editor-drag.test.tsx` `lineIn(2)).toBe(true)` lower half (carried; M1 killed round 1) | PASS |
| C44 | drop inserts, selected, focused | batch `[C44]` x5 ran | `editor-drag.test.tsx` `expect(selectedAt()).toBe(2)`, `activeElement).toBe(container.querySelector("textarea"))` (carried) | PASS |
| C45 (re-judged, foreign part) | on-page part not draggable and refused; a part the document lacks refused | batch `[C45]` x5 ran | `editor-drag.test.tsx` `getAttribute("draggable")).toBe("false")`; on-page payload `toHaveLength(7)`; new `:167-177` `[C45] a part the document does not have...`: a `terms` payload into the contract `expect(pageItems(container)).toHaveLength(3)`, a `signatures` payload into the agreement `toHaveLength(7)`. Source guard `document-editor.tsx:88-89` `!partsOf(kind).includes(choice.key) || ...`. Mutant N1 (guard removed) fails it | PASS |
| C46 | grip drop moves the row | batch `[C46]` x8 ran | `editor-model.test.ts:196-197` `toEqual(["b","c","a","d"])`, `index).toBe(2)` (carried) | PASS |
| C47 | cancelled drag removes line | batch `[C47]` x3 ran | `editor-drag.test.tsx` `lines()).toHaveLength(0)` after `dragend` and `dragleave` (carried) | PASS |
| C48 | click and Up/Down without drag; grips named, 44 px | batch `[C48]` x2 ran | `editor-drag.test.tsx` `toContain("min-h-11")`, `toContain("min-w-11")` on seven grips (carried) | PASS |

## Coverage

Rows marked (re-judged) recomputed at 47c3beb; others carried from 7e2d65b.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| merge variables (16) | `domain/contract/template.ts:10-27` | all 16 table-driven, `add-element-dock.test.tsx:98-104` (carried) | - |
| agreement parts (5), contract parts (5) | `domain/agreement/layout.ts:21-22` | C12 `editor-model.test.ts:93,97` (carried) | - |
| required parts (3 pairs) | `editor-model.ts:40` | C5 (carried) | - |
| text block types (3) (re-judged) | `domain/contract/template.ts:34` | heading C3 `editor-page.test.tsx:74`; paragraph C3 `:76`; clause C3 `:79-82` | - |
| toolbar actions on a text block (7) | `editor-page.tsx:298-333` | C3 (carried) | - |
| part options (6 sections) | `domain/agreement/layout-form.ts:26-39` | C18 (carried) | - |
| page settings (3) | `domain/agreement/layout.ts:29` | C21 (carried; Escape close now also proven) | - |
| drag payloads (2) and the part keys each document may carry (re-judged) | `editor-model.ts:118-132`, `partsOf` | add C44, move C46, refused shapes C45 `editor-model.test.ts:234`; foreign-document part refused in both directions `editor-drag.test.tsx:167-177` | - |
| drop positions (3), drag outcomes (3) | plan AC 42-46 | C43, C44, C45, C47 (carried) | - |
| save statuses | `components/templates/state.ts:5-15` | C28, C30, C31 (carried) | - |
| preview outcomes (re-judged) | `preview-dialog.tsx`, `template-preview-frame.tsx:66-67` | ok C23, cannot be drawn C25, failed C26, not a PDF C26, closed none C24, route refusal (422) C26 `preview-dialog.test.tsx:98-104` | - |
| editor routes (3), list states (3) | plan | C32, C35, C37 (carried) | - |
| header controls (re-judged) | `document-editor.tsx:115-140` | back link `template-editor.test.tsx:213-` (new), name, state, Details, Page settings (now also closes on Escape), Import, Preview, Save (carried) | - |
| viewports (3) | plan AC 38 | author-run C38 | - (author-run) |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Pure helpers that decide | `domain/templates/editor-model.ts` | one at its own layer, one case per decision row | yes - carried from 7e2d65b, `editor-model.test.ts` (32 tests, all re-ran green) |
| Components that decide (re-judged) | `editor-page.tsx`, `add-element-dock.tsx`, `preview-dialog.tsx`, `document-editor.tsx`, `template-editor.tsx`, `contract-wording-editor.tsx`, `block-options.tsx` | one render test at their own layer, each state and each rejected input | yes - the round-1 holes now have a test each: selected outline (`editor-page.test.tsx:60-61`), clause toolbar (`:79-82`), 422 in the dialog (`preview-dialog.test.tsx:98-104`), foreign part rejected (`editor-drag.test.tsx:167-177`), Escape on the popover (`block-options.test.tsx:130-135`), back link (`template-editor.test.tsx:213-`) |
| Markup that only lays out | `template-grid.tsx`, `template-card.tsx`, `templates-view.tsx` | none of its own | yes - carried |
| Page modules | the four `page.tsx` modules | one at the boundary, each role and unknown id | yes - carried (`page.test.ts:159-177`, `contract/page.test.ts:80-90`) |

## Faults injected

Scratch worktree at 47c3beb outside the repo, `web\node_modules` junctioned; the junction was removed with `cmd /c rmdir` first, real `web\node_modules` confirmed to hold `react` and `vitest`, then the worktree removed. Real-tree `git status --porcelain` before and after: identical (no diff). Note: my restore step used a repo-root-relative path and did not reset between the three mutants, so they were stacked in the scratch; each was killed by the test that names its own surface and those tests do not overlap, so the attribution holds. Round-1 faults (M1 to M7) are carried from 7e2d65b and their surfaces were not touched by the fix except `dropAt` (M4's line, now N1).

| Mutation | Location | Killed |
| --- | --- | --- |
| N1 `partsOf(kind)` guard removed from the drop handler | `components/templates/document-editor.tsx:89` | yes - `[C45] a part the document does not have, dropped in from another window` failed |
| N2 `border-action` removed from the selected frame | `components/templates/editor-page.tsx:262` | yes - `[C2]` failed (`toContain("border-action")`) |
| N3 Escape handler removed from `HeaderPopover` | `components/templates/block-options.tsx:256` | yes - `[C21] Escape closes the Page settings` failed |
| carried from 7e2d65b: M1 dropPosition, M4 duplicate-part drop, M5 isRequired, M6 insertionIndex, M7 preview while closed | `editor-model.ts:94,40,59`, `document-editor.tsx:89`, `preview-dialog.tsx:49` | yes (round 1) |

## Gate

`npx vitest run domain/templates components/templates "app/(app)/templates" app/product-copy.test.ts` - 328 passed, 0 failed (23 files); `npx tsc --noEmit` exit 0; `npx eslint components/templates "app/(app)/templates"` exit 0. Whole-suite baseline of 33 known failures carried from 7e2d65b.

## Remaining notes (not blockers)

- C33's tagged page test renders as owner only; admin is not asserted there.
- C39's popover test skips textareas.
- The contract's Save button still reads "Save wording"; checks.md was updated to match.
- Judgement items kept as observations: toolbar placement against the sketch, Fields list order not asserted, no focus trap in the preview dialog.
