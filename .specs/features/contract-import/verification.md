# Upload an existing contract verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: ca7df72..HEAD (fa9e2f0, 4fb8191)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 2 closes the three ranked gaps it was given: the stale banner is fixed and now tested, M12 and M20 are both killed, and C5825 has a specific author-run record that matches the code. Every proof was re-run at HEAD (4fb8191) and all pass. The verdict is still FAIL for one reason that round 1 already recorded and no commit touched: the AC 5 coverage row still has an unproven member. `validateSplitBlocks` accepts an answer with an extra property even though door 1 sets `additionalProperties: false` (`web/domain/contract/import.ts:36` reads only `type` and `text`, and the file is unchanged since ca7df72). The API's structured output (`contract-splitter.ts:56`, `output_config.format` json_schema) makes such an answer unlikely in practice. But no proof shows that the app refuses one, so the member stays unproven. It needs one refusal for extra keys plus one test, or the owner deciding that AC 5 is met by the provider and amending the plan.

Environment deviation (unchanged from round 1): vitest runs as `node node_modules/vitest/vitest.mjs run ... --pool=vmThreads` from `web/`. The default pool fails every test on this machine with "Cannot read properties of undefined (reading 'config')".

Earlier rounds are superseded. Round 1 is archived verbatim at the end of this file, inside a fenced block, so the gate reads only this round.

## Binding sources

Carried from round 1 (verified at ca7df72). Step 1 reruns only where a fix touched the interface. fa9e2f0 changed one behaviour on `/templates/contract`: the banner now clears after a save. It added no control, label or region. The verified changes are `contract-wording-editor.tsx:67-70`, where `setImportedFrom(null)` runs inside the `saved` branch, and the new test C5820 at `contract-import.test.tsx:113-120`.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `AGENTS..md` Web validation (Playwright 375/768/1440, touch, 44 px, no h-scroll, console clean) | yes - carried from round 1 (lines 25-41); the C5825 record checked against it this round | none | - (the round 1 gap was the live pass; it is now covered by C5825's author-run record, see Checks) |
| `DESIGN.md` control heights and button shape | yes - carried from round 1 | none | - |
| `PRODUCT.md` | yes - carried from round 1 | none | - |

## Checks

Proof run for every row except C5822 and C5825: `node node_modules/vitest/vitest.mjs run domain/contract/import.test.ts infrastructure/claude/contract-splitter.test.ts application/use-cases/import-contract-wording.test.ts "app/(app)/templates/contract" composition/contract-import-wiring.test.ts components/templates/contract-import.test.tsx --pool=vmThreads --reporter=verbose`, run from `web/` at 4fb8191. Result: 9 files, 84 passed, 0 failed. The verbose output listed each C58xx title individually as passed: C5801, C5802, C5803 x11, C5804 to C5807, C5808 x2, C5809 to C5810, C5811 x2, C5812 to C5817, C5818, C5819 x2, C5820 x2, C5821 x2, C5823, C5824 x5, C5826 and C5827. The folder also brought in the existing C5552 to C5558 tests, which all passed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5801 | form = price, blocks, signatures; default doc; storable | batch - passed at 4fb8191 | carried from ca7df72 (file unchanged): `web/domain/contract/import.test.ts:18-26` | PASS |
| C5802 | block and length bounds | batch - passed | carried: `web/domain/contract/import.test.ts:34-43` | PASS |
| C5803 | 8 import variables accepted, the other 8 and unknown refused | batch - 11 passed | carried: `web/domain/contract/import.test.ts:51`, `:57-59`, `:63-64` | PASS |
| C5804 | schema, the prompt instructions, and a user message that carries only the file | batch - passed | refreshed (file changed): `web/infrastructure/claude/contract-splitter.test.ts:42` `toContain("Do not summarise, paraphrase, reorder or add anything")`; `:43-44` `toContain("write the matching variable instead")`, `toContain("the contractor, the customer, the site, the person signing")`; `:45` `toContain("Never write a variable for them")`; `:40-41`, `:46-48` as in round 1 (data not instructions, copy, signatures, the 8 variables, no `{{terms.`) | PASS (round 1 precision gap closed; M12 and M20 now killed) |
| C5805 | bad answers are unavailable, a good answer is returned | batch - passed | carried; lines shift by +4 in the changed file (round 1 `:57-72`) | PASS |
| C5806 | throw, refusal, no key and timeout are unavailable; the log has nothing from the file | batch - passed | carried, shift +4; `:102` `not.toContain("SECRET")` | PASS |
| C5807 | `max_tokens` is too_large | batch - passed | carried, shift +4 (round 1 `:103`) | PASS |
| C5808 | docx and pdf paths; form returned | batch - 2 passed | carried: `web/application/use-cases/import-contract-wording.test.ts:23-27`, `:36` | PASS |
| C5809 | over the wording limit is unavailable | batch - passed | carried: `import-contract-wording.test.ts:42` | PASS |
| C5810 | passthrough | batch - passed | carried: `import-contract-wording.test.ts:48` | PASS |
| C5811 | no writer; action never saves | batch - 2 passed | carried: `import-contract-wording.test.ts:55`; `app/(app)/templates/contract/import-actions.test.ts:58` | PASS |
| C5812 | address clause left out | batch - passed | carried: `web/domain/contract/import.test.ts:98-99` | PASS |
| C5813 | estimator, viewer, none forbidden | batch - passed | carried: `import-contract-wording.test.ts:61-63` | PASS |
| C5814 | no file or zero bytes is invalid | batch - passed | carried: `import-contract-wording.test.ts:70-72` | PASS |
| C5815 | extensions, parser failure, size edge | batch - passed | carried: `import-contract-wording.test.ts:79-91` | PASS |
| C5816 | action statuses and redirect | batch - 3 passed | carried: `import-actions.test.ts:31-50` | PASS |
| C5817 | container wiring | batch - passed | carried: `web/composition/contract-import-wiring.test.ts:16-18`; `web/composition/index.ts:228` (unchanged) | PASS |
| C5818 | imported rows, banner, preview body | batch - passed | carried: `web/components/templates/contract-import.test.tsx:55-61` (lines before 103 unchanged) | PASS |
| C5819 | confirm when there are unsaved edits; keep the rows on cancel | batch - 2 passed | carried: `contract-import.test.tsx:69-100` | PASS |
| C5820 | saving after an import sends the form once; the banner then clears | batch - 2 passed | carried `contract-import.test.tsx:109-110` `save).toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(IMPORTED)`; new `:117` `toContain("Imported from a.docx")`, `:119` `not.toContain("Imported from")`, `:120` `toContain("Saved.")` | PASS |
| C5821 | notice beside the control; page passes the action | batch - 2 passed | carried; component lines shift +10 (round 1 `:115-116`); `page.test.ts:76-77` | PASS |
| C5822 | frozen `template_version_id` (existing AD-186) | not re-run this round. Nothing in ca7df72..HEAD touches `supabase/`. Round 1 ran `npm run test:db contract_templates`: 1 passed | carried from ca7df72: `supabase/tests/contract_templates.sql:121-122`, `:64` | PASS |
| C5825 | live pass at 375, 768 and 1440 px, plus a real docx import | not runnable by the Verifier (no browser observed, Playwright not used). This is the author's record: `.specs/features/contract-import/checks.md:160`, added in 4fb8191 | The record is specific and matches the code. scrollWidth equals clientWidth at all three widths. The input and button are 44 px at 375 and 768, and the button is 34 px at 1440, which matches `h-11 lg:h-[34px]` (lg is 1024 px) and the input's `min-h-11`. The console showed 0 errors and 0 warnings after a restart. The banner text it quotes matches the code's template (`contract-import.test.tsx:55`). The rows it reports keep `15 days`, `45 days` and `Ontario` literal, use only import variables and drop the signature line, which matches prompt lines 16-21. The second press asked to confirm, which matches the Handoff's rule that "dirty" means rows differ from the baseline. The record's date (2026-11-16) agrees in UTC with the commit time 2026-11-15 18:51 -0700. The record states what it did not exercise: a save, a pdf, and the import at 375 px. | PASS (author-run, author's record) |
| C5826 | 44 px classes; no wide fixed width | batch - passed | carried, shift +10 | PASS |
| C5827 | input `.docx,.pdf`, labelled | batch - passed | carried, shift +10 | PASS |

## Coverage

Recomputed only for the rows whose authority the fix touched. The rest are carried from round 1, recomputed there at ca7df72.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| action statuses (6) | plan Surface | carried from ca7df72 | - |
| import variables (8) | plan door 3 | carried | - |
| whitelist names refused (8) | AD-188 minus door 3 | carried | - |
| block types (3) | plan door 1 | carried | - |
| roles (5) | `web/domain/members/index.ts` ROLES + none | carried | - |
| file kinds (6) | plan Assumptions | carried | - |
| block bounds (6 edges) | plan AC 2 | carried | - |
| file-size bounds (2 edges) | plan AC 1, AC 12 | carried | - |
| editor failure messages (5) | plan AC 21 | carried | - |
| AC 7 failure causes (4) | plan AC 7 | carried | - |
| AC 5 schema mismatches | plan AC 5 + door 1 `additionalProperties: false` (re-judged: a non-PASS row in round 1) | not JSON, no `blocks`, empty list, wrong field type, unknown type, out of bounds: C5805 | extra property on the answer or on a block: still accepted by `validateSplitBlocks` (`web/domain/contract/import.ts:36`, unchanged in ca7df72..HEAD). No proof shows the app refuses it. Only the API's structured output (`contract-splitter.ts:56`) prevents it |
| AC 3 prompt instructions (6) | plan AC 3 (re-computed: fa9e2f0 touched it) | data, not instructions `contract-splitter.test.ts:40` · copy the words `:41` · no summarise, paraphrase, reorder or add `:42` (M12 killed) · write the matching variable for the parties, site, signer and term `:43-44` (M20 killed) · leave out signature lines `:46` · only the 8 variables, figures literal `:45`, `:47-48` · file only, per round 1 | - |
| editor banner lifecycle (2 states: shown after import, cleared after save) | plan AC 14, AC 16 + fa9e2f0 (new member) | shown C5818 `contract-import.test.tsx:55` · cleared after save C5820 `:119` (M-banner killed) | - |
| Landing doors (3) | plan Landing | carried | - |
| startup configuration (1 assembly) | `web/composition/index.ts:228` | carried | - |
| screen widths (3) | AGENTS..md Web validation (re-judged: a non-PASS row in round 1) | 375, 768 and 1440: C5825, author-run record `checks.md:160` | - |

## Test policy rows

`contract-splitter.ts` falls under the "Decides, reached across a boundary" row, and its test was the only one touched. C5804 still asserts at the adapter boundary, so that row is met. The other rows are carried from round 1 (met at ca7df72). `contract-wording-editor.tsx` is a component and no policy row classifies it. C5820 proves it.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `import-actions.ts`, `contract-splitter.ts` | boundary plus the layer beneath | yes - re-judged at 4fb8191 for the splitter; carried for the action |
| Decides, not reached across a boundary | `domain/contract/import.ts`, `import-contract-wording.ts` | own layer | yes - carried from ca7df72. The gap in the AC 5 extra-property member is recorded under Coverage |
| Instrumentation | port type, container line | C5817 | yes - carried |

## Faults injected

Each fault was applied in place in the real tree with `sed`. The covering file was then run (`--pool=vmThreads`), and the file was reverted with `git checkout -- <file>`. `git status --porcelain` was empty before the first fault and after every revert. `git stash` was not used.

| Mutation | Location | Killed |
| --- | --- | --- |
| M12 deleted the sentence "Do not summarise, paraphrase, reorder or add anything." | `web/infrastructure/claude/contract-splitter.ts:16` | yes - C5804 failed (1 failed, 3 passed) |
| M20 deleted the line "Where the text names the contractor ..." | `web/infrastructure/claude/contract-splitter.ts:19` | yes - C5804 failed (1 failed, 3 passed) |
| M-banner removed `setImportedFrom(null);` | `web/components/templates/contract-wording-editor.tsx:69` | yes - "C5820: after the save the import banner is gone" failed (1 failed, 13 passed) |

The round 1 faults M1 to M18 are carried. Their targets are unchanged in ca7df72..HEAD, apart from the test files that gained assertions.

## Remaining notes, carried from round 1 and not gating

- The confirmation still comes after the model call (`contract-import-control.tsx`). This meets AC 15 to the letter. It is a design choice for the user to confirm.
- No check pins where the control sits (above the form and outside it). The plan's "existing header area" has no selector check.
- A timeout does not abort the stream.
- M9 is an equivalent mutant, because the `if (pending) return` guard is redundant.

## Gate

`node node_modules/vitest/vitest.mjs run domain/contract/import.test.ts infrastructure/claude/contract-splitter.test.ts application/use-cases/import-contract-wording.test.ts "app/(app)/templates/contract" composition/contract-import-wiring.test.ts components/templates/contract-import.test.tsx --pool=vmThreads --reporter=verbose` (from `web/`, at 4fb8191): 9 files, 84 passed, 0 failed.

## Ranked gaps

1. AC 5 / door 1: an answer with an extra property is accepted by the app (`web/domain/contract/import.ts:36`), and no proof covers that member. Carried unchanged from round 1 gap 4.

## Archive: earlier rounds (superseded by Round 2)

```text
# Upload an existing contract verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: b09ffec..HEAD (ca7df72, 499382f)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

FAIL for three reasons, in rank order: C5825 (the live browser pass, AC 22) was never run, so the three screen widths are unproven; two prompt mutants survived because AC 3 is only half asserted; and one UI defect no test can see (the "Nothing is saved" banner stays on screen after a save). Every other check is proven at HEAD with located evidence. 16 of 19 injected faults were killed.

Environment deviation: vitest runs as `node node_modules/vitest/vitest.mjs run ... --pool=vmThreads` from `web/`. The default pool fails every test on this machine with "Cannot read properties of undefined (reading 'config')", including files this feature did not touch. `npx vitest run` as written in checks.md was not used.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `AGENTS..md` - Web validation (Playwright at 375x812, 768x1024, 1440x900, touch emulation, 44x44 px targets, no horizontal scroll, console and network clean) | yes - read in full, lines 25-41 | none | the whole live pass: 375, 768 and 1440 px, touch taps on the file input and "Read my contract", console and network check (C5825 not run) |
| `DESIGN.md` - control height (line 238: 44px below 1024px, 34px buttons on desktop), Button shape (line 264), the "Do" rule at line 341, no coloured left stripe (line 350) | yes - searched and read the relevant lines; no section draws `/templates/contract` or a file-input control | none. The button uses `buttonClass` (`h-11 ... lg:h-[34px]`, `web/components/ui/button.tsx`). The file input is `min-h-11` at every width, which is allowed because DESIGN.md sets no desktop height for file inputs | - (DESIGN.md does not draw this screen, so it fixes no arrangement for the control) |
| `PRODUCT.md` | yes - searched for import, upload, wording, legal | none (line 48 says the starter wording needs a lawyer, which matches AC 18's notice) | - |

Enumeration of the control, taken from the plan (no binding design draws it): label "Import your existing contract (Word or PDF)" (C5827), file input `.docx,.pdf` (C5827), "Read my contract" button (C5823, C5826), pending status line (C5823), failure alert (C5824), ownership notice (C5821), post-import banner (C5818). Arrangement: the plan's Observable row says "in the editor's existing header area". The code puts the control as the first child of the left `section[aria-label="Contract wording form"]`, above the `<form>` and outside it (`contract-wording-editor.tsx` diff, lines ~43-60). The Handoff records this as settled during the build. No check pins where the control sits, or that it stays outside the save `<form>` (see gap 5).

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5801 | form = price, blocks in order, signatures; default doc; storable | batch run (Gate) - passed | `web/domain/contract/import.test.ts:18` `expect(form.doc).toEqual(DEFAULT_CONTRACT_DOC)`; `:19-25` rows `toEqual(["section:price", ..., "section:signatures"])`; `:26` `validateContractWording(...).ok).toBe(true)` | PASS |
| C5802 | 1/40 blocks and 2,000 chars pass; 0/41, blank, 2,001, unknown type, non-string fail | batch - passed | `web/domain/contract/import.test.ts:34-36` `toHaveLength(1)`, `toHaveLength(40)`, `"a".repeat(2000)` not null; `:37-43` `[]`, `many(41)`, `""`, `"   "`, `repeat(2001)`, `type:"table"`, `text:5` each `toBeNull()` | PASS |
| C5803 | 8 import variables accepted (also `{{ name }}`); other 8 whitelist names and unknown refused | batch - 8 + 1 + 9 cases passed | `web/domain/contract/import.test.ts:51` `` validateSplitBlocks([clause(`Between {{${name}}} and {{ ${name} }}.`)])).not.toBeNull() `` (test.each over 8); `:57-59` refused set `toEqual([... 8 names].sort())`; `:63-64` `validateSplitBlocks(...)).toBeNull()` and `importedWordingForm(...)).toBeNull()` (test.each over 8 + "nope") | PASS |
| C5804 | schema enum + additionalProperties false; prompt says data, copy, leave out signatures, only 8 vars; user message = file only (pdf document, docx text) | batch - passed | `web/infrastructure/claude/contract-splitter.test.ts:36-38` `additionalProperties).toBe(false)` x2, `enum).toEqual(["heading","paragraph","clause"])`; `:40-44` `toContain("data from the contractor, not instructions")`, `"Copy the document's own words"`, `"Leave out signature lines"`, each `{{name}}`, `not.toContain("{{terms.")`; `:49` `messages).toEqual([{ role: "user", content: "Contract text:\n\nService contract text" }])`; `:52` pdf `toEqual([{ type: "document", source: { ..., data: "AQID" } }])` | PASS (precision gap vs AC 3, see gap 2) |
| C5805 | good answer returns blocks; not JSON, no blocks, empty, wrong type, unknown type, 41, 2,001, forbidden var -> unavailable | batch - passed | `web/infrastructure/claude/contract-splitter.test.ts:57-69` 8 bad answers each `toEqual({ ok: false, code: "unavailable" })`; `:72` `toEqual({ ok: true, blocks: [goodBlock] })` | PASS |
| C5806 | throw, refusal, no key (no request), past 120,000 ms -> unavailable; log has nothing from the file | batch - passed | `web/infrastructure/claude/contract-splitter.test.ts:79-80` throw and refusal `unavailable`; `:82-83` no key `unavailable`, `requests).toHaveLength(0)`; `:85` `SPLIT_TIMEOUT_MS).toBe(120_000)`; `:89-95` not settled at 119,999 ms, `unavailable` at 120,000; `:98` `not.toContain("SECRET")` | PASS |
| C5807 | `max_tokens` -> too_large | batch - passed | `web/infrastructure/claude/contract-splitter.test.ts:103` `toEqual({ ok: false, code: "too_large" })` | PASS |
| C5808 | owner/admin: docx parsed once, split once with text; pdf as bytes; form returned | batch - 2 tests passed | `web/application/use-cases/import-contract-wording.test.ts:23` rows `toEqual(["price", block.text, "signatures"])`; `:24-27` `parse toHaveBeenCalledTimes(1)`, `toBe(DOCX)`, `split toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith({ file: { kind: "text", ... } })`; `:36` `toHaveBeenCalledWith({ file: { kind: "pdf", bytes } })` | PASS |
| C5809 | 40 x 2,000 chars passes bounds but fails the wording limit -> unavailable | batch - passed | `web/application/use-cases/import-contract-wording.test.ts:42` `toEqual({ ok: false, code: "unavailable" })` | PASS |
| C5810 | splitter too_large / unavailable pass through | batch - passed | `web/application/use-cases/import-contract-wording.test.ts:48` `toEqual({ ok: false, code })` for both codes | PASS |
| C5811 | use case takes parser + splitter, no writer; action never calls saveContractWording | batch - 2 tests passed | `web/application/use-cases/import-contract-wording.test.ts:55` `makeImportContractWording.length).toBe(2)`; `web/app/(app)/templates/contract/import-actions.test.ts:58` `saveContractWording).not.toHaveBeenCalled()` | PASS |
| C5812 | `{{tenant.address}}` clause left out with no address | batch - passed | `web/domain/contract/import.test.ts:98` `toEqual(["Work is done by Kettle Ridge Mechanical Ltd.."])`; `:99` drawn when an address is set | PASS |
| C5813 | estimator, viewer, none -> forbidden, nothing called | batch - passed | `web/application/use-cases/import-contract-wording.test.ts:61-63` `toEqual({ ok: false, code: "forbidden" })`, `parse).not.toHaveBeenCalled()`, `split).not.toHaveBeenCalled()` | PASS |
| C5814 | no file and zero bytes -> invalid, nothing called | batch - passed | `web/application/use-cases/import-contract-wording.test.ts:70-72` `toEqual({ ok: false, code: "invalid" })`, parse and split not called | PASS |
| C5815 | xlsx/csv/doc/no ext unreadable; parser failure unreadable; 4,194,305 too_large; 4,194,304 accepted; splitter not called | batch - passed | `web/application/use-cases/import-contract-wording.test.ts:79-80` `toEqual({ ok: false, code: "unreadable" })`, `split).not.toHaveBeenCalled()`; `:83-84` broken parser `unreadable`; `:87` `+ 1` -> `too_large`; `:89` `toBe(4_194_304)`; `:91` edge `.ok).toBe(true)` | PASS |
| C5816 | signed out -> /login; owner -> imported with form; bytes and name passed; no file passes none; each code -> failed | batch - 3 tests passed | `web/app/(app)/templates/contract/import-actions.test.ts:31` `toEqual({ status: "imported", form: FORM })`; `:33-35` role, name, bytes `[7, 8]`; `:41-42` `rejects.toThrow("NEXT_REDIRECT /login")`, use case not called; `:49-50` `toEqual({ status: "failed", code })` x5, `file).toBeUndefined()` | PASS |
| C5817 | container exposes the use case built with `claudeContractSplitter({ apiKey: process.env.ANTHROPIC_API_KEY })` | batch - passed | `web/composition/contract-import-wiring.test.ts:16` `typeof ... importContractWording).toBe("function")`; `:18` source `toMatch(/claudeContractSplitter\(\{ apiKey: process\.env\.ANTHROPIC_API_KEY \}\)/)`; assembly read directly at `web/composition/index.ts:228` | PASS |
| C5818 | imported rows replace own, banner names file, preview request carries form | batch - passed | `web/components/templates/contract-import.test.tsx:55` `toBe("Imported from Our contract.docx. Nothing is saved until you save.")`; `:56-57` row count and "Imported terms"; `:61` `lastPreviewBody()).toEqual(JSON.parse(JSON.stringify(IMPORTED)))` | PASS |
| C5819 | with unsaved edits asks and keeps them on cancel; none -> no ask | batch - 2 tests passed | `web/components/templates/contract-import.test.tsx:69` `confirm).not.toHaveBeenCalled()`; `:74-75` `toHaveBeenCalledTimes(1)`, prompt text; `:97-100` `rowTexts()).toEqual(before)`, `not.toContain("Imported terms")` | PASS |
| C5820 | save after import sends the imported form once | batch - passed | `web/components/templates/contract-import.test.tsx:109-110` `save).toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(IMPORTED)` | PASS |
| C5821 | notice text beside the control; page passes the import action | batch - 2 tests passed | `web/components/templates/contract-import.test.tsx:115` `IMPORT_NOTICE).toBe("A starting point: you own your wording. ...")`; `:116` `closest("div")!.textContent).toContain(IMPORT_NOTICE)`; `web/app/(app)/templates/contract/page.test.ts:76-77` `toContain('id="contract-import-file"')`, `toContain("A starting point: you own your wording.")` | PASS |
| C5822 | contracts keep their frozen `template_version_id` (existing AD-186) | `npm run test:db contract_templates` - "PASS contract_templates, 1 passed, 0 failed" (the hosted DB was reachable) | `supabase/tests/contract_templates.sql:121-122` `expect_error('C5204 owner update' ... '55000')`, `('C5204 owner delete' ... '55000')`; `:64` `template_version_id is null) = 0` | PASS |
| C5823 | while running: status text, control disabled, second press sends nothing | batch - passed | `web/components/templates/contract-import.test.tsx:129-134` `importAction toHaveBeenCalledTimes(1)`, `readButton().disabled).toBe(true)`, `fileInput().disabled).toBe(true)`, status `toContain("Claude is reading your contract")`, still `toHaveBeenCalledTimes(1)` after a second press | PASS |
| C5824 | each of 5 codes: own message, rows kept, control enabled | batch - 5 cases passed | `web/components/templates/contract-import.test.tsx:144-147` `[role="alert"] textContent).toBe(IMPORT_MESSAGES[code])`, `rowTexts()).toEqual(before)`, button and input `disabled).toBe(false)` | PASS |
| C5825 | live pass at 375/768/1440 with touch, no h-scroll, 44 px, no console warning, real docx import | not run. The author did not run it (Playwright browser locked, checks.md Handoff line 160), and this Verifier did not either | no evidence - checks.md:160 records "C5825 not run" | NOT RUN - unproven |
| C5826 | button `h-11 lg:h-[34px]`, input 44 px, no width past w-44 | batch - passed | `web/components/templates/contract-import.test.tsx:152-154` `toContain("h-11")`, `toContain("lg:h-[34px]")`, input `toContain("min-h-11")`; `:156-157` source `not.toMatch(/\bw-(5\d\|[6-9]\d\|\d{3})\b\|w-\[\d+px\]/)`, `not.toContain("overflow-x")` | PASS |
| C5827 | input accepts only `.docx,.pdf` and is labelled | batch - passed | `web/components/templates/contract-import.test.tsx:162` `accept).toBe(".docx,.pdf")`; `:163` `label[for="contract-import-file"]` `toContain("Import your existing contract")` | PASS |

Every named test was confirmed to exist and to have run. The verbose output listed each C58xx title individually as passed, and none was matched by an empty filter. Every proof file is new or changed in `b09ffec..HEAD`, except the SQL test behind C5822, which is existing proof as the check states.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| action statuses (6) | plan Surface row | imported C5816:31 · invalid C5814:70, C5816:49 · forbidden C5813:61, C5816:49 · unreadable C5815:79 · too_large C5815:87, C5807:103 · unavailable C5805, C5806, C5809 | - |
| import variables (8) | plan door 3 literal list | each in C5803:51 (test.each) and C5804:43. The set is pinned as the complement of the 16 by C5803:57, and M1 was killed | - |
| whitelist names refused (8) | AD-188 sixteen minus door 3 | C5803:57 exact list, C5803:63 per name | - |
| block types (3) | plan door 1 enum | heading C5801:13/C5804:38 · paragraph C5801:14 · clause C5801:15, C5812 | - |
| roles (5) | `web/domain/members/index.ts:2` ROLES (4) + no membership | owner C5808, C5816 · admin C5808:20 · estimator, viewer, null C5813:59 | - |
| file kinds (6) | plan Assumptions "File types" | docx C5808 · pdf C5808:34 (also upper-case `.PDF`) · xlsx, csv, doc, none C5815:77 | - |
| block bounds (6 edges) | plan AC 2 | 0, 1, 40, 41, 2,000, 2,001 all C5802:34-41 | - |
| file-size bounds (2 edges) | plan AC 1, AC 12 | 4,194,304 C5815:91 · 4,194,305 C5815:87 | - |
| editor failure messages (5) | plan AC 21 + forbidden | all C5824 test.each | - |
| AC 7 failure causes (4) | plan AC 7 | call fails C5806:79 · times out C5806:89-95 · refused C5806:80 · no key C5806:82 | - |
| AC 5 schema mismatches | plan AC 5 + door 1 `additionalProperties: false` | not JSON, no `blocks`, empty, wrong field type, unknown type, bounds: C5805:57-66 | an extra property (`{blocks:[...], note:"x"}` or a block with a third key) is accepted by `validateSplitBlocks` (`web/domain/contract/import.ts:36` reads only `type`/`text`), so the app does not refuse a reply that breaks door 1's `additionalProperties: false`. Only the API's structured output stops it |
| AC 3 prompt instructions (6) | plan AC 3 | data not instructions C5804:40 · copy the words C5804:41 · leave out signature lines C5804:42 · only the 8 variables C5804:43 · file only C5804:49,52 | "do not summarise, paraphrase, reorder or add" (M12 survived) · "replace a party's name, address, phone, signer, site, term with the matching variable" (M20 survived) |
| Landing doors (3) | plan Landing | door 1 C5804, C5805 · door 2 C5811 (M8 killed) · door 3 C5803 (M1 killed) | - |
| startup configuration (1 assembly) | `web/composition/index.ts:228`, read directly | C5817 | - |
| screen widths (3) | AGENTS..md Web validation | C5825 only | 375 · 768 · 1440 (live pass not run) |

Plan criteria swept for a check: AC 1-22 each map to at least one check (AC 1 C5808/C5816/C5827, AC 2 C5801/C5802, AC 3 C5804, AC 4 C5803/C5805, AC 5 C5802/C5805, AC 6 C5809, AC 7 C5806/C5810, AC 8 C5807/C5810, AC 9 C5811, AC 10 C5813, AC 11 C5814/C5816, AC 12 C5815/C5827, AC 13 C5816, AC 14 C5818, AC 15 C5819, AC 16 C5820, AC 17 C5811/C5822, AC 18 C5821, AC 19 C5812, AC 20 C5823, AC 21 C5824, AC 22 C5825/C5826). AC 3 and AC 22 are only partly proven (rows above).

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `import-actions.ts`, `contract-splitter.ts` | action boundary C5816/C5811 over use case C5813-C5815; adapter C5804-C5807 over domain C5802/C5803 | yes - every status and answer-shape row has a boundary proof and one beneath it |
| Decides, not reached across a boundary | `domain/contract/import.ts`, `import-contract-wording.ts` | own layer: C5801-C5803, C5812; C5808-C5815 | yes - each branch (bounds, type, variable filter, form build, final validation; role, file, extension, size, parse, passthrough, form) has an asserted case |
| Instrumentation | port type, container line | none of its own; C5817 | yes |

Swept existing: the per-org advisory lock cited for concurrency (AD-188) and frozen versions (`supabase/migrations/20261112230000_contract_templates.sql:35-52`, trigger `template_version_frozen`) are present. Block-editor AC 41 (estimator and viewer redirect) is proven by C5558 in `page.test.ts`. Those tests were skipped under this filter but exist in the same file.

## Faults injected

Each fault was applied in place in the real tree, then the 5 feature test files were run in one call and the file reverted with `git checkout -- <file>`. `git status --porcelain` was empty before the run, after every revert, and at the end. `git stash` was not used. The script is `C:\Users\stock\AppData\Local\Temp\claude\bf7aee7277cd1639\769649c1-f79d-48f2-90ae-f2f5be9ad864\scratchpad\mutate.py`.

| Mutation | Location | Killed |
| --- | --- | --- |
| M1 `"terms.paymentDays"` added to `IMPORT_VARIABLES` | `web/domain/contract/import.ts:19` | yes - C5803, C5804, C5805, C5810 |
| M2 role guard removed | `web/application/use-cases/import-contract-wording.ts:32` | yes - C5813 |
| M3 use case accepts `xlsx` | `web/application/use-cases/import-contract-wording.ts:36` | yes - C5815 |
| M4 `window.confirm` removed | `web/components/templates/contract-import-control.tsx:40` | yes - C5819 (both tests) |
| M5 bound 4_194_304 -> 4_194_303 | `web/application/use-cases/import-contract-wording.ts:8` | yes - C5815 |
| M5b `>` -> `>=` on size | `web/application/use-cases/import-contract-wording.ts:37` | yes - C5815 |
| M6 `max_tokens` branch removed | `web/infrastructure/claude/contract-splitter.ts:90` | yes - C5807 |
| M7 signatures section dropped from `importedWordingForm` | `web/domain/contract/import.ts:57` | yes - C5801, C5812, C5808, C5815, C5818-C5820, C5823 |
| M8 action calls `saveContractWording` | `web/app/(app)/templates/contract/import-actions.ts:12` | yes - C5811 (action) |
| M9 `if (pending) return` removed | `web/components/templates/contract-import-control.tsx:29` | survived - equivalent: the button's `disabled={pending}` already blocks the second click, and the guard reads the same stale `pending`. M10 shows the disabled attribute is the asserted surface |
| M10 `disabled={pending}` removed from the button | `web/components/templates/contract-import-control.tsx:52` | yes - C5823, C5824 |
| M11 "data, not instructions" prompt line removed | `web/infrastructure/claude/contract-splitter.ts:15` | yes - C5804 |
| M12 "Do not summarise, paraphrase, reorder or add anything." removed | `web/infrastructure/claude/contract-splitter.ts:16` | survived - no test asserts it (AC 3) |
| M13 blocks reversed in the form | `web/domain/contract/import.ts:56` | yes - C5801, C5812 |
| M14 failure path also calls `onImported` (rows replaced on failure) | `web/components/templates/contract-import-control.tsx:36` | yes - C5824 (all 5) |
| M15 input `min-h-11` -> `min-h-10` | `web/components/templates/contract-import-control.tsx:50` | yes - C5826 |
| M16 `accept` widened to `.xlsx` | `web/components/templates/contract-import-control.tsx:8` | yes - C5827 |
| M17 blank-text check removed | `web/domain/contract/import.ts:38` | yes - C5802 |
| M18 log line carries the file text | `web/infrastructure/claude/contract-splitter.ts:101` | yes - C5806 |
| M20 "replace a party's name ... with the matching variable" instruction removed | `web/infrastructure/claude/contract-splitter.ts:19` | survived - no test asserts it (AC 3) |

## UI issues the tests cannot see

1. **The banner stays after a save.** `importedFrom` is set in `onImported` and nothing clears it (`web/components/templates/contract-wording-editor.tsx`, the `onSubmit` handler only calls `setBaseline` and `setState`). After a successful save the editor shows "Imported from X. Nothing is saved until you save." next to "Saved. Contracts made from now on use this wording." Those two messages contradict each other. No check covers what the banner does after a save. Severity: major (the copy is wrong).
2. **Confirmation comes after the model call.** `run()` calls `importAction` first and asks `window.confirm` only when the answer arrives (`contract-import-control.tsx:34-40`). An owner with unsaved edits waits up to a minute and a Claude call is spent before they are asked, and cancelling throws the result away. This meets AC 15 to the letter ("before it replaces them"), but the plan's Observable row calls it "destructive action confirms". Severity: minor.
3. **Placement is not pinned.** The control sits above the `<form>`, outside it, in the left column (no nested form, correct). The plan says "the editor's existing header area", and no check asserts the placement or that the control stays outside the save form. Severity: minor.
4. **A timeout does not cancel the call.** On timeout the `Promise.race` rejects, but the stream is not aborted (`contract-splitter.ts:84-88`), so the request keeps running and can still be billed. The plan does not decide this. It is an observation, not a check failure.
5. **Desktop height differs.** On desktop the file input stays 44px (`min-h-11`, with no `lg:` reduction) while the button is 34px. DESIGN.md sets no file-input height, so this is cosmetic only.

## Gate

`node node_modules/vitest/vitest.mjs run domain/contract/import.test.ts infrastructure/claude/contract-splitter.test.ts application/use-cases/import-contract-wording.test.ts "app/(app)/templates/contract/import-actions.test.ts" "app/(app)/templates/contract/page.test.ts" composition/contract-import-wiring.test.ts components/templates/contract-import.test.tsx -t "C58(0|1|2)" --pool=vmThreads --reporter=verbose` (from `web/`). Result: 7 files, 52 passed, 0 failed, 8 skipped (the page.test.ts tests outside the filter).

`npm run test:db contract_templates`: 1 passed, 0 failed.

## Ranked gaps

1. C5825 not run. The live Playwright pass at 375, 768 and 1440 px (AC 22, the AGENTS..md mandate) has no evidence, so the screen-width set is unproven. Evidence: checks.md:160.
2. AC 3 is half asserted, and C5804 has a precision gap. The "no summarise/paraphrase/reorder/add" and "replace party details with variables" instructions can be deleted from `SPLIT_SYSTEM_PROMPT` with the suite green (M12 and M20 survived). See `web/infrastructure/claude/contract-splitter.test.ts:40-44`.
3. The stale import banner after a save (UI issue 1). No check covers it. See `web/components/templates/contract-wording-editor.tsx` (`importedFrom` is never cleared).
4. AC 5 / door 1: the app accepts answers with extra properties despite `additionalProperties: false`. See `web/domain/contract/import.ts:36`.
5. Placement of the Import control is not pinned by any check (UI issue 3). The confirm-after-call order is a design choice to confirm with the user (UI issue 2).
6. M9 survived as an equivalent mutant (the redundant `if (pending) return`). No action is needed beyond noting that the guard is dead code.
```
